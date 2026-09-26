import { PersonaId } from '../types';

export interface MiniMaxConfig {
  apiKey: string;
  groupId: string;
  enabled: boolean;
  // TTS voice model, e.g., 'speech-01-turbo' or 'speech-01-240228'
  ttsModel: string;
  // Custom voice mapping for the 3 personas
  voiceIds: {
    energetic: string;     // e.g. "female-tianmei" / "sweet_girl"
    gentle: string;        // e.g. "female-shaonv" / "gentle_woman"
    professional: string;  // e.g. "female-yujie" / "male-qn-qingse" / "presenter_male"
  };
  // ASR model name
  asrModel: string;
}

export const DEFAULT_MINIMAX_CONFIG: MiniMaxConfig = {
  apiKey: '',
  groupId: '',
  enabled: false,
  ttsModel: 'speech-01-turbo',
  voiceIds: {
    energetic: 'female-tianmei',    // 甜美少女音
    gentle: 'female-shaonv',        // 温柔知性女声
    professional: 'presenter_female' // 沉稳专业主播音
  },
  asrModel: 'asr-01'
};

const MINIMAX_STORAGE_KEY = 'ai_schedule_minimax_config';

export function getStoredMiniMaxConfig(): MiniMaxConfig {
  try {
    const raw = localStorage.getItem(MINIMAX_STORAGE_KEY);
    if (!raw) return DEFAULT_MINIMAX_CONFIG;
    return { ...DEFAULT_MINIMAX_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MINIMAX_CONFIG;
  }
}

export function saveStoredMiniMaxConfig(cfg: MiniMaxConfig) {
  try {
    localStorage.setItem(MINIMAX_STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn('Failed to save MiniMax config', err);
  }
}

let activeAudioElement: HTMLAudioElement | null = null;

export function stopMiniMaxAudio() {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement = null;
    } catch (e) {
      console.warn(e);
    }
  }
}

export function isMiniMaxAudioPlaying(): boolean {
  return Boolean(activeAudioElement && !activeAudioElement.paused);
}

/**
 * Synthesize speech using MiniMax TTS API T2A (Text to Audio)
 * Documentation endpoint: https://api.minimax.chat/v1/t2a_v2?GroupId=...
 */
export async function synthesizeMiniMaxSpeech(
  text: string,
  personaId: PersonaId = 'energetic',
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  }
): Promise<boolean> {
  const cfg = getStoredMiniMaxConfig();
  if (!cfg.enabled || !cfg.apiKey.trim() || !cfg.groupId.trim()) {
    return false; // Indicate caller to fallback to browser speech synthesis
  }

  stopMiniMaxAudio();

  const voiceId = cfg.voiceIds[personaId] || cfg.voiceIds.energetic || 'female-tianmei';
  const url = `https://api.minimax.chat/v1/t2a_v2?GroupId=${encodeURIComponent(cfg.groupId.trim())}`;

  try {
    options?.onStart?.();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.ttsModel || 'speech-01-turbo',
        text: text,
        stream: false,
        voice_setting: {
          voice_id: voiceId,
          speed: personaId === 'energetic' ? 1.15 : personaId === 'gentle' ? 0.95 : 1.05,
          vol: 1.0,
          pitch: personaId === 'energetic' ? 2 : personaId === 'gentle' ? 0 : -1
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`MiniMax TTS HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax TTS Error: [${data.base_resp.status_code}] ${data.base_resp.status_msg}`);
    }

    // MiniMax returns hex audio or direct audio binary in data.data.audio
    const hexAudio = data.data?.audio;
    if (!hexAudio) {
      throw new Error('MiniMax did not return audio data');
    }

    // Convert hex string to Uint8Array -> Blob -> ObjectURL
    const match = hexAudio.match(/[\da-f]{2}/gi);
    if (!match) throw new Error('Invalid audio hex data format');
    
    const byteArray = new Uint8Array(match.map((h: string) => parseInt(h, 16)));
    const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);

    const audio = new Audio(audioUrl);
    activeAudioElement = audio;

    audio.onended = () => {
      activeAudioElement = null;
      URL.revokeObjectURL(audioUrl);
      options?.onEnd?.();
    };

    audio.onerror = (e) => {
      activeAudioElement = null;
      URL.revokeObjectURL(audioUrl);
      options?.onError?.(new Error('Audio playback failed'));
    };

    await audio.play();
    return true;
  } catch (err: any) {
    console.warn('[MiniMax TTS Error, falling back to local SpeechSynthesis]:', err);
    options?.onError?.(err);
    return false;
  }
}

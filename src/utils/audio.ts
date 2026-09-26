/**
 * Audio feedback and Speech Synthesis / Recognition utilities
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playAudioFeedback(type: 'wake' | 'success' | 'tap' | 'bubble') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'wake') {
      // Pleasant dual tone chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'success') {
      // Harmonic chord chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'bubble') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.warn('AudioContext playback error or disabled:', err);
  }
}

import { 
  synthesizeMiniMaxSpeech, 
  stopMiniMaxAudio, 
  isMiniMaxAudioPlaying, 
  getStoredMiniMaxConfig 
} from '../services/minimaxClient';
import { PersonaId } from '../types';

let currentUtterance: SpeechSynthesisUtterance | null = null;

export async function speakText(
  text: string,
  options?: {
    pitch?: number;
    rate?: number;
    personaId?: PersonaId;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  // Check if MiniMax is enabled & configured
  const mmCfg = getStoredMiniMaxConfig();
  if (mmCfg.enabled && mmCfg.apiKey.trim() && mmCfg.groupId.trim()) {
    try {
      const handled = await synthesizeMiniMaxSpeech(text, options?.personaId || 'energetic', {
        onStart: options?.onStart,
        onEnd: options?.onEnd,
        onError: () => {
          // If MiniMax fails, fallback immediately to browser synthesis
          fallbackBrowserSpeak(text, options);
        }
      });
      if (handled) return;
    } catch (e) {
      console.warn('MiniMax synthesis failed, falling back:', e);
    }
  }

  // Fallback to browser SpeechSynthesis
  fallbackBrowserSpeak(text, options);
}

function fallbackBrowserSpeak(
  text: string,
  options?: {
    pitch?: number;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser.');
    options?.onEnd?.();
    return;
  }

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.pitch = options?.pitch ?? 1.1;
  utterance.rate = options?.rate ?? 1.05;

  // Attempt to select a natural Chinese voice if available
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.includes('zh') || v.name.includes('Chinese') || v.name.includes('Mandarin') || v.name.includes('Tingting') || v.name.includes('Xiaoxiao') || v.name.includes('Mei-Jia'));
  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    options?.onEnd?.();
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis error:', e);
    currentUtterance = null;
    options?.onEnd?.();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  stopMiniMaxAudio();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  if (isMiniMaxAudioPlaying()) return true;
  if (!('speechSynthesis' in window)) return false;
  return window.speechSynthesis.speaking;
}

// Browser speech recognition abstraction
export function createSpeechRecognition(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (err: string) => void
) {
  const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition || 
    (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    let finalStr = '';
    let interimStr = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalStr += event.results[i][0].transcript;
      } else {
        interimStr += event.results[i][0].transcript;
      }
    }
    const combined = finalStr || interimStr;
    onTranscript(combined, Boolean(finalStr));
  };

  recognition.onerror = (event: any) => {
    onError(event.error || '语音识别出错');
  };

  return recognition;
}

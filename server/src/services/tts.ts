/**
 * AI 语音反馈（PRD §9）：MiniMax TTS 代理。
 * 语音反馈与日程理解解耦；后端仅提供代理，是否自动播报由前端（开关 + 喇叭按钮）决定。
 * 未配置 MiniMax 时返回明确的“未配置”状态，前端可回退浏览器语音合成。
 */
import { MiniMaxConfig, PersonaId } from '../types.js';
import { getPersona } from './personas.js';

export interface TtsResult {
  audioBase64: string;
  format: string;
  source: 'minimax';
}

export function ttsReady(cfg: MiniMaxConfig): boolean {
  // PHASE 4-G：MiniMax 新版控制台已不再暴露 Group ID，纯 API Key（Bearer）鉴权即可；
  // 兼容旧模式：配置了 groupId 时仍走 URL GroupId 参数。
  return cfg.enabled && Boolean(cfg.apiKey.trim());
}

/** 调用 MiniMax T2A v2，返回 mp3（hex → base64）。voiceOverride 可指定 voice_id（任务书 {text, voice} 兼容） */
export async function synthesizeTts(
  cfg: MiniMaxConfig,
  text: string,
  personaId: PersonaId = 'energetic',
  voiceOverride?: string,
): Promise<TtsResult> {
  const persona = getPersona(personaId);
  const voice = persona.voice;
  const voiceId = voiceOverride?.trim() || voice.voiceId;
  const qs = cfg.groupId.trim() ? `?GroupId=${encodeURIComponent(cfg.groupId.trim())}` : '';
  const url = `https://api.minimax.chat/v1/t2a_v2${qs}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.ttsModel || 'speech-01-turbo',
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: voice.speed,
        vol: voice.vol,
        pitch: voice.pitch,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) {
    throw new Error(`MiniMax TTS HTTP ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as {
    base_resp?: { status_code?: number; status_msg?: string };
    data?: { audio?: string };
  };
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax TTS Error [${data.base_resp.status_code}] ${data.base_resp.status_msg}`);
  }
  const hex = data.data?.audio;
  if (!hex) throw new Error('MiniMax 未返回音频数据');

  const buffer = Buffer.from(hex, 'hex');
  if (buffer.length === 0) throw new Error('MiniMax 音频数据为空');

  return {
    audioBase64: buffer.toString('base64'),
    format: 'mp3',
    source: 'minimax',
  };
}

/**
 * 语音输入代理（PRD §12 P0-01）：MiniMax ASR（asr-01）转发。
 * 前端录音得到音频（base64）后交给后端，由后端调用 MiniMax 识别为文本。
 * 未配置时返回“未配置”状态，前端可回退浏览器 Web Speech 识别。
 */
import { MiniMaxConfig } from '../types.js';

export interface AsrResult {
  text: string;
  source: 'minimax';
}

export function asrReady(cfg: MiniMaxConfig): boolean {
  return cfg.enabled && Boolean(cfg.apiKey.trim()) && Boolean(cfg.groupId.trim());
}

/**
 * 调用 MiniMax ASR（asr-01）。
 * @param audioBase64 音频 base64
 * @param fileName 文件名（决定识别格式推断），默认 audio.mp3
 */
export async function recognizeAudio(
  cfg: MiniMaxConfig,
  audioBase64: string,
  fileName = 'audio.mp3',
): Promise<AsrResult> {
  const url = `https://api.minimax.chat/v1/audio/asr?GroupId=${encodeURIComponent(cfg.groupId.trim())}`;

  const audioBytes = Buffer.from(audioBase64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([audioBytes], { type: 'audio/mpeg' }), fileName);
  form.append('model', cfg.asrModel || 'asr-01');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey.trim()}`,
    },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    throw new Error(`MiniMax ASR HTTP ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as {
    base_resp?: { status_code?: number; status_msg?: string };
    text?: string;
    data?: { text?: string; result?: string };
  };
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax ASR Error [${data.base_resp.status_code}] ${data.base_resp.status_msg}`);
  }
  const text = data.text || data.data?.text || data.data?.result || '';
  if (!text.trim()) throw new Error('MiniMax ASR 未返回识别文本');
  return { text: text.trim(), source: 'minimax' };
}

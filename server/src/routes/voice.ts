import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { asrReady, recognizeAudio } from '../services/asr.js';
import { synthesizeTts, ttsReady } from '../services/tts.js';
import { PersonaId } from '../types.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function voiceRouter(repos: Repos): Router {
  const r = Router();

  /**
   * TTS：POST /api/voice/tts { text, personaId? | voice? }
   * voice 参数兼容任务书（voice = MiniMax voice_id）；personaId 走人格预设音色。
   * 返回 audioBase64(mp3)；未配置 MiniMax 时 503，前端应回退浏览器语音。
   */
  r.post('/tts', async (req, res) => {
    const { text, personaId, voice } = (req.body || {}) as { text?: string; personaId?: string; voice?: string };
    if (!text || !text.trim()) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'text 不能为空');
      return;
    }
    const cfg = repos.runtimeConfig.minimax;
    if (!ttsReady(cfg)) {
      sendError(res, 503, 'tts_not_configured', 'MiniMax TTS 未配置', {
        fallback: 'browser',
        hint: '请在后端配置 MINIMAX_API_KEY / MINIMAX_GROUP_ID 或通过 PUT /api/config 启用',
      });
      return;
    }
    try {
      const result = await synthesizeTts(
        cfg,
        text.trim(),
        (personaId || 'energetic') as PersonaId,
        typeof voice === 'string' && voice.trim() ? voice.trim() : undefined,
      );
      res.json(result);
    } catch (err) {
      console.error('[tts] 失败', (err as Error).message);
      sendError(res, 502, ERROR_CODES.VOICE_UNAVAILABLE, 'MiniMax TTS 调用失败', (err as Error).message);
    }
  });

  /**
   * ASR：POST /api/voice/asr { audioBase64, fileName? }
   * 返回识别文本；未配置 MiniMax 时 503，前端可回退浏览器 Web Speech。
   */
  r.post('/asr', async (req, res) => {
    const { audioBase64, fileName } = (req.body || {}) as { audioBase64?: string; fileName?: string };
    if (!audioBase64) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'audioBase64 不能为空');
      return;
    }
    const cfg = repos.runtimeConfig.minimax;
    if (!asrReady(cfg)) {
      sendError(res, 503, 'asr_not_configured', 'MiniMax ASR 未配置', {
        fallback: 'browser',
        hint: '请在后端配置 MINIMAX_API_KEY / MINIMAX_GROUP_ID 或通过 PUT /api/config 启用',
      });
      return;
    }
    try {
      const result = await recognizeAudio(cfg, audioBase64, fileName || 'audio.mp3');
      res.json(result);
    } catch (err) {
      console.error('[asr] 失败', (err as Error).message);
      sendError(res, 502, ERROR_CODES.VOICE_UNAVAILABLE, 'MiniMax ASR 调用失败', (err as Error).message);
    }
  });

  return r;
}

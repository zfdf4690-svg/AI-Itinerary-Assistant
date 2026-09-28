import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { understandOneShot } from '../services/conversation.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function understandRouter(repos: Repos): Router {
  const r = Router();

  /**
   * 单轮理解：POST /api/understand
   * body: { text: string, conversationId?: string, currentDraft?: Partial<ScheduleItem>, personaId?: PersonaId }
   * 返回：5 字段槽位 + 完整性判断 + 委婉追问/确认回复 + 前端动作枚举（任务书 §8/§9）
   */
  r.post('/', async (req, res) => {
    const { utterance, text, currentDraft, personaId } = (req.body || {}) as {
      utterance?: string;
      text?: string;
      currentDraft?: Parameters<typeof understandOneShot>[1]['currentDraft'];
      personaId?: string;
    };
    // 兼容任务书请求体字段名 { text }
    const input = utterance ?? text;
    if (!input || !input.trim()) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'text/utterance 不能为空');
      return;
    }
    try {
      const result = await understandOneShot(repos, {
        utterance: input.trim(),
        currentDraft,
        personaId,
      });
      res.json(result);
    } catch (err) {
      console.error('[understand] 失败', err);
      sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, '理解服务异常', (err as Error).message);
    }
  });

  return r;
}

import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { confirmConversation, createConversation, runTurn } from '../services/conversation.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function conversationsRouter(repos: Repos): Router {
  const r = Router();

  /** 新建会话并执行首轮理解：POST /api/conversations { utterance, personaId? } */
  r.post('/', async (req, res) => {
    const { utterance, personaId } = (req.body || {}) as { utterance?: string; personaId?: string };
    if (!utterance || !utterance.trim()) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'utterance 不能为空');
      return;
    }
    try {
      const conv = await createConversation(repos, { utterance: utterance.trim(), personaId });
      res.status(201).json(conv);
    } catch (err) {
      console.error('[conversations] 创建失败', err);
      sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, '会话服务异常', (err as Error).message);
    }
  });

  /** 读取会话当前状态 */
  r.get('/:id', (req, res) => {
    const conv = repos.findConversation(req.params.id);
    if (!conv) {
      sendError(res, 404, ERROR_CODES.CONVERSATION_NOT_FOUND, '找不到对应会话');
      return;
    }
    res.json(conv);
  });

  /** 推进一轮（状态机核心）：POST /api/conversations/:id/turn { utterance } */
  r.post('/:id/turn', async (req, res) => {
    const conv = repos.findConversation(req.params.id);
    if (!conv) {
      sendError(res, 404, ERROR_CODES.CONVERSATION_NOT_FOUND, '找不到对应会话');
      return;
    }
    const { utterance } = (req.body || {}) as { utterance?: string };
    if (!utterance || !utterance.trim()) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'utterance 不能为空');
      return;
    }
    try {
      const updated = await runTurn(repos, conv, utterance.trim());
      res.json(updated);
    } catch (err) {
      console.error('[conversations] turn 失败', err);
      sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, '会话服务异常', (err as Error).message);
    }
  });

  /** 确认创建：POST /api/conversations/:id/confirm */
  r.post('/:id/confirm', async (req, res) => {
    const conv = repos.findConversation(req.params.id);
    if (!conv) {
      sendError(res, 404, ERROR_CODES.CONVERSATION_NOT_FOUND, '找不到对应会话');
      return;
    }
    try {
      const result = await confirmConversation(repos, conv);
      if ('error' in result) {
        sendError(res, 422, ERROR_CODES.VALIDATION_ERROR, result.error, {
          missingRequired: result.missingRequired,
          conversation: result.conv,
        });
        return;
      }
      res.json({ conversation: result.conv, schedule: result.schedule });
    } catch (err) {
      console.error('[conversations] confirm 失败', err);
      sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, '会话服务异常', (err as Error).message);
    }
  });

  r.delete('/:id', (req, res) => {
    const idx = repos.conversations.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      sendError(res, 404, ERROR_CODES.CONVERSATION_NOT_FOUND, '找不到对应会话');
      return;
    }
    repos.conversations.splice(idx, 1);
    repos.saveConversations();
    res.json({ ok: true });
  });

  return r;
}

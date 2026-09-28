import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { dismissReminder, getActiveReminders, scanReminders } from '../services/reminders.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function remindersRouter(repos: Repos): Router {
  const r = Router();

  /** 活跃（未处理）提醒列表：供前端轮询/Toast */
  r.get('/active', (_req, res) => {
    res.json({ items: getActiveReminders(repos), total: getActiveReminders(repos).length });
  });

  /** 历史提醒（含已处理） */
  r.get('/history', (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    res.json({ items: repos.reminders.slice(0, limit), total: repos.reminders.length });
  });

  /** 手动触发一次扫描（调试/测试用） */
  r.post('/scan', (_req, res) => {
    const created = scanReminders(repos);
    res.json({ created, count: created.length, active: getActiveReminders(repos).length });
  });

  /** 标记提醒已处理：PATCH /api/reminders/:id/dismiss */
  r.patch('/:id/dismiss', (req, res) => {
    const r2 = dismissReminder(repos, req.params.id);
    if (!r2) {
      sendError(res, 404, ERROR_CODES.NOT_FOUND, '找不到对应提醒');
      return;
    }
    res.json(r2);
  });

  /** 提醒配置：GET /api/reminders/config */
  r.get('/config', (_req, res) => {
    res.json(repos.reminderConfig);
  });

  /** 提醒配置：PUT /api/reminders/config */
  r.put('/config', (req, res) => {
    const body = (req.body || {}) as Partial<Repos['reminderConfig']>;
    const next = { ...repos.reminderConfig, ...body };
    // 基础校验
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof next.dailyReminderTime === 'string' && !timeRe.test(next.dailyReminderTime)) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'dailyReminderTime 格式须为 HH:mm');
      return;
    }
    if (typeof next.eveningReviewTime === 'string' && !timeRe.test(next.eveningReviewTime)) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'eveningReviewTime 格式须为 HH:mm');
      return;
    }
    if (next.priorityOffsets) {
      for (const k of ['high', 'medium', 'low'] as const) {
        const v = next.priorityOffsets[k];
        if (typeof v !== 'number' || v < 0 || v > 24 * 60) {
          sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, `priorityOffsets.${k} 须为 0-1440 的分钟数`);
          return;
        }
      }
    }
    repos.reminderConfig = next;
    repos.saveReminderConfig();
    res.json(repos.reminderConfig);
  });

  return r;
}

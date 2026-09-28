import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { derivePreferenceSummary, listPreferences, setPreference } from '../services/memory.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function memoryRouter(repos: Repos): Router {
  const r = Router();

  /** Event Memory：历史日程 */
  r.get('/events', (_req, res) => {
    res.json({ items: repos.memoryEvents, total: repos.memoryEvents.length });
  });

  /** Entity Memory：人物/地点/组织 */
  r.get('/entities', (req, res) => {
    const type = (req.query.type as string) || '';
    const list = type
      ? repos.memoryEntities.filter((e) => e.type === type)
      : repos.memoryEntities;
    res.json({ items: [...list].sort((a, b) => b.count - a.count), total: list.length });
  });

  /** Preference Memory：用户设置 + 由日程推导的偏好摘要 */
  r.get('/preferences', (_req, res) => {
    res.json({
      items: listPreferences(repos),
      derived: derivePreferenceSummary(repos),
    });
  });

  /** 设置偏好：PUT /api/memory/preferences { key, value } */
  r.put('/preferences', (req, res) => {
    const { key, value } = (req.body || {}) as { key?: string; value?: unknown };
    if (!key || typeof key !== 'string' || !key.trim()) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'key 不能为空');
      return;
    }
    const record = setPreference(repos, key.trim(), value);
    res.json(record);
  });

  return r;
}

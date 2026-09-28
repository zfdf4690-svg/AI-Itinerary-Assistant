import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { ScheduleItem } from '../types.js';
import { applyPartialUpdate, buildScheduleFromSlots, sortSchedules, validateRequiredFields } from '../services/schedule.js';
import { recordEntities, recordEvent } from '../services/memory.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function schedulesRouter(repos: Repos): Router {
  const r = Router();

  // 列表：?date=YYYY-MM-DD &status=active&from=&to=
  r.get('/', (req, res) => {
    const { date, status, from, to } = req.query as { date?: string; status?: string; from?: string; to?: string };
    let list = repos.schedules;
    if (date) list = list.filter((s) => s.date === date);
    if (status) list = list.filter((s) => s.status === status);
    if (from) list = list.filter((s) => `${s.date}T${s.time}` >= `${from}T00:00`);
    if (to) list = list.filter((s) => `${s.date}T${s.time}` <= `${to}T23:59`);
    res.json({ items: sortSchedules(list), total: list.length });
  });

  // 手动创建（显式 5 字段）
  r.post('/', (req, res) => {
    const body = (req.body || {}) as Partial<ScheduleItem>;
    const validation = validateRequiredFields(body);
    if (!validation.ok) {
      sendError(res, 422, ERROR_CODES.VALIDATION_ERROR, '缺少必填字段（时间 + 任务为最低要求）', {
        missingRequired: validation.missingRequired,
        errors: validation.errors,
      });
      return;
    }
    const schedule = buildScheduleFromSlots(repos, {
      time: body.time,
      date: body.date,
      dateLabel: body.dateLabel,
      task: body.task,
      title: body.title,
      location: body.location,
      matters: body.matters,
      remindOffset: body.remindOffset,
      remindOffsetMinutes: body.remindOffsetMinutes,
      priority: body.priority,
      hasAlarm: body.hasAlarm ?? true,
    });
    repos.schedules.unshift(schedule);
    repos.saveSchedules();
    recordEvent(repos, schedule);
    recordEntities(repos, schedule.title, { location: schedule.location, task: schedule.task });
    res.status(201).json(schedule);
  });

  r.get('/:id', (req, res) => {
    const s = repos.findSchedule(req.params.id);
    if (!s) {
      sendError(res, 404, ERROR_CODES.SCHEDULE_NOT_FOUND, '找不到对应日程');
      return;
    }
    res.json(s);
  });

  // 局部修改（PRD §7）：只更新传入字段
  r.patch('/:id', (req, res) => {
    const existing = repos.findSchedule(req.params.id);
    if (!existing) {
      sendError(res, 404, ERROR_CODES.SCHEDULE_NOT_FOUND, '找不到对应日程');
      return;
    }
    const body = (req.body || {}) as Partial<ScheduleItem>;
    if (body.id || body.createdAt) {
      sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, '不允许修改 id / createdAt');
      return;
    }
    const updated = applyPartialUpdate(existing, body);
    const validation = validateRequiredFields(updated);
    if (!validation.ok) {
      sendError(res, 422, ERROR_CODES.VALIDATION_ERROR, '修改后缺少必填字段（时间 + 任务为最低要求）', {
        missingRequired: validation.missingRequired,
        errors: validation.errors,
      });
      return;
    }
    const idx = repos.schedules.findIndex((s) => s.id === existing.id);
    repos.schedules[idx] = updated;
    repos.saveSchedules();
    if (updated.status === 'completed') recordEvent(repos, updated);
    res.json(updated);
  });

  r.delete('/:id', (req, res) => {
    const idx = repos.schedules.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      sendError(res, 404, ERROR_CODES.SCHEDULE_NOT_FOUND, '找不到对应日程');
      return;
    }
    const [removed] = repos.schedules.splice(idx, 1);
    repos.saveSchedules();
    res.json({ ok: true, id: removed.id });
  });

  return r;
}

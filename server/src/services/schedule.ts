/**
 * Schedule Core（PRD §2）：日程数据模型、5 字段完整性校验、创建/局部修改。
 * 原则（PRD §15）：时间 + 任务是形成有效日程的最低信息要求；
 * 用户只修改对应字段（局部修改，不重建整个日程）。
 */
import { AccentColor, ParsedSlots, ScheduleItem, SchedulePriority, ScheduleStatus } from '../types.js';
import { genId, Repos } from '../db/repos.js';
import { formatDateLabel, parseRemindOffset, parseClockTime, todayStr } from '../utils/date.js';

export interface ScheduleValidation {
  ok: boolean;
  missingRequired?: string[];
  errors?: string[];
}

/** 校验 5 字段最低要求（时间 + 任务） */
export function validateRequiredFields(slots: Partial<ScheduleItem>): ScheduleValidation {
  const missingRequired: string[] = [];
  const errors: string[] = [];
  if (!slots.time) missingRequired.push('time');
  if (!slots.task && !slots.title) missingRequired.push('task');
  if (slots.time && !parseClockTime(slots.time)) {
    errors.push('time 格式须为 HH:mm');
  }
  if (slots.date && !/^\d{4}-\d{2}-\d{2}$/.test(slots.date)) {
    errors.push('date 格式须为 YYYY-MM-DD');
  }
  return {
    ok: missingRequired.length === 0 && errors.length === 0,
    missingRequired,
    errors,
  };
}

/** 从解析槽位构建 ScheduleItem（确认创建时调用） */
export function buildScheduleFromSlots(repos: Repos, slots: ParsedSlots): ScheduleItem {
  const now = Date.now();
  // PHASE 4-B：禁止编造默认值（任务书 §12/§22.G）。调用前须经 validateRequiredFields 校验；
  // 此处显式防御，防止绕过校验时产生虚假的 15:00 / 重要日程。
  if (!slots.time || (!slots.task && !slots.title)) {
    throw new Error('buildScheduleFromSlots: 缺少必填字段（time/task），调用方应先校验');
  }
  const date = slots.date || todayStr();
  const dateLabel = slots.dateLabel || formatDateLabel(date);
  const time = slots.time;
  const task = slots.task || slots.title!;
  const title = slots.title || task;
  const location = slots.location || '';
  const matters = slots.matters || '';
  const remindOffset = slots.remindOffset || '提前30分钟';
  const remindOffsetMinutes = slots.remindOffsetMinutes
    ?? parseRemindOffset(remindOffset)?.minutes
    ?? 30;
  const priority: SchedulePriority = slots.priority || 'medium';
  const hasAlarm = slots.hasAlarm ?? true;
  const accentColor: AccentColor = priority === 'high' ? 'red' : priority === 'low' ? 'orange' : 'blue';

  const item: ScheduleItem = {
    id: genId('sched'),
    time,
    date,
    dateLabel,
    task,
    title,
    location,
    matters,
    remindOffset,
    remindOffsetMinutes,
    accentColor,
    priority,
    hasAlarm,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  return item;
}

/** 局部修改（PRD §7）：只更新传入字段，其余保留 */
export function applyPartialUpdate(
  existing: ScheduleItem,
  updates: Partial<ScheduleItem> & { remindOffsetMinutes?: number },
): ScheduleItem {
  const next: ScheduleItem = { ...existing, ...updates, updatedAt: Date.now() };
  // 保持字段一致性
  if (updates.task && !updates.title) next.title = updates.task;
  if (updates.title && !updates.task) next.task = updates.title;
  if (updates.date && !updates.dateLabel) next.dateLabel = formatDateLabel(updates.date);
  if (updates.remindOffset && updates.remindOffsetMinutes === undefined) {
    const parsed = parseRemindOffset(updates.remindOffset);
    if (parsed) {
      next.remindOffset = parsed.label;
      next.remindOffsetMinutes = parsed.minutes;
    }
  }
  if (updates.priority) {
    next.accentColor = updates.priority === 'high' ? 'red' : updates.priority === 'low' ? 'orange' : 'blue';
  }
  return next;
}

export function sortSchedules(list: ScheduleItem[]): ScheduleItem[] {
  return [...list].sort((a, b) => {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    return da.localeCompare(db);
  });
}

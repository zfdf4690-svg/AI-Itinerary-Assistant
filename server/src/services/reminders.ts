/**
 * Reminder Engine（PRD §12 P0-09 提醒 / 核心闭环「…创建 → 提醒」）：
 * 后台扫描日程，按「日程开始时刻 - 提前量」触发日程提醒；
 * 同时支持每日简报与晚间复盘提醒（对应用户配置）。
 * 提醒记录持久化，前端可轮询 active 列表。
 */
import { ReminderRecord, ReminderType, ScheduleItem } from '../types.js';
import { genId, Repos } from '../db/repos.js';
import { getPersona } from './personas.js';
import { dateTimeToDate, parseClockTime, todayStr } from '../utils/date.js';

export function getActiveReminders(repos: Repos): ReminderRecord[] {
  return repos.reminders
    .filter((r) => !r.dismissed)
    .sort((a, b) => b.triggeredAt - a.triggeredAt);
}

export function dismissReminder(repos: Repos, id: string): ReminderRecord | null {
  const r = repos.reminders.find((x) => x.id === id);
  if (!r) return null;
  r.dismissed = true;
  repos.saveReminders();
  return r;
}

function hasAlarmFired(repos: Repos, type: ReminderType, key: string): boolean {
  return repos.reminders.some((r) => r.type === type && r.scheduleId === key);
}

function hasDailyFired(repos: Repos, type: ReminderType, key: string): boolean {
  return repos.reminders.some((r) => r.type === type && r.title === key);
}

function pushReminder(repos: Repos, record: Omit<ReminderRecord, 'id' | 'dismissed'>): ReminderRecord {
  const r: ReminderRecord = { ...record, id: genId('rem'), dismissed: false };
  repos.reminders.unshift(r);
  repos.saveReminders();
  return r;
}

/** 扫描一次：日程提醒 + 每日简报 + 晚间复盘（幂等） */
export function scanReminders(repos: Repos, nowMs = Date.now()): ReminderRecord[] {
  const created: ReminderRecord[] = [];
  const now = new Date(nowMs);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = todayStr();

  // 1. 日程提醒
  for (const s of repos.schedules) {
    if (s.status !== 'active' || !s.hasAlarm) continue;
    if (hasAlarmFired(repos, 'schedule_alarm', s.id)) continue;

    const startAt = dateTimeToDate(s.date, s.time);
    if (!startAt) continue;
    const dueAt = startAt.getTime() - s.remindOffsetMinutes * 60 * 1000;
    if (dueAt <= nowMs) {
      const persona = getPersona('energetic');
      const message = persona.prompt.reminder(s.title, s.remindOffsetMinutes);
      created.push(pushReminder(repos, {
        type: 'schedule_alarm',
        scheduleId: s.id,
        title: `${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}优先级日程提醒 · ${s.title}`,
        message,
        dueAt,
        triggeredAt: nowMs,
        priority: s.priority,
      }));
    }
  }

  // 2. 每日简报
  const cfg = repos.reminderConfig;
  if (cfg.dailyAlarmEnabled && cfg.dailyReminderTime === hhmm) {
    const key = `daily-briefing-${dateStr}`;
    if (!hasDailyFired(repos, 'daily_briefing', key)) {
      const activeCount = repos.schedules.filter((s) => s.status === 'active').length;
      const first = sortByStart(repos.schedules.filter((s) => s.status === 'active'))[0];
      const message = `早安！今天共规划了 ${activeCount} 项行程，第一项日程安排在 ${first?.time || '上午'}。`;
      created.push(pushReminder(repos, {
        type: 'daily_briefing',
        title: key,
        message,
        dueAt: parseClockTime(cfg.dailyReminderTime)?.minutes ?? 0,
        triggeredAt: nowMs,
      }));
    }
  }

  // 3. 晚间复盘
  if (cfg.eveningReviewEnabled && cfg.eveningReviewTime === hhmm) {
    const key = `evening-review-${dateStr}`;
    if (!hasDailyFired(repos, 'evening_review', key)) {
      const doneCount = repos.schedules.filter((s) => s.status === 'completed').length;
      const persona = getPersona('energetic');
      const message = persona.prompt.eveningReview(doneCount || repos.schedules.length);
      created.push(pushReminder(repos, {
        type: 'evening_review',
        title: key,
        message,
        dueAt: parseClockTime(cfg.eveningReviewTime)?.minutes ?? 0,
        triggeredAt: nowMs,
      }));
    }
  }

  return created;
}

function sortByStart(list: ScheduleItem[]): ScheduleItem[] {
  return [...list].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

/** 启动后台调度（默认每 20 秒扫描一次） */
export function startReminderScheduler(repos: Repos, intervalMs = 20000): NodeJS.Timeout {
  const timer = setInterval(() => {
    try {
      scanReminders(repos);
    } catch (err) {
      console.warn('[Reminder Engine] 扫描失败', (err as Error).message);
    }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

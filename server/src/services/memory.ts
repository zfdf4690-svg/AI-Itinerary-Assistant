/**
 * Memory Layer（PRD §11）：Event Memory（历史日程）、Entity Memory（人物/地点/组织）、
 * Preference Memory（提醒与时间安排偏好）。
 * P0 优先使用 Event Memory 与 Preference Memory；Memory 服务于日程管理，不扩展为 AI Companion。
 */
import { EventMemoryRecord, EntityMemoryRecord, PreferenceMemoryRecord, ScheduleItem } from '../types.js';
import { genId, Repos } from '../db/repos.js';
import { extractEntities } from './nlu.js';

const EVENT_LIMIT = 200;
const ENTITY_LIMIT = 500;
const PREFERENCE_LIMIT = 200;

/** 日程创建/更新后写入 Event Memory */
export function recordEvent(repos: Repos, schedule: ScheduleItem): void {
  const record: EventMemoryRecord = {
    scheduleId: schedule.id,
    task: schedule.task,
    title: schedule.title,
    date: schedule.date,
    time: schedule.time,
    status: schedule.status,
    createdAt: Date.now(),
  };
  repos.memoryEvents.unshift(record);
  if (repos.memoryEvents.length > EVENT_LIMIT) {
    repos.memoryEvents.length = EVENT_LIMIT;
  }
  repos.saveMemory();
}

/** 从输入文本与解析槽位提取实体并写入 Entity Memory */
export function recordEntities(repos: Repos, text: string, slots: { location?: string; task?: string }): void {
  const found = extractEntities(text, slots);
  // 从任务描述（如「与张总开会」「拜访李总」）提取人物实体
  if (slots.task) {
    const personInTask = slots.task.match(/(?:与|和|跟|约)\s*([^与和跟约\s]{1,6}?)(?:开会|会议|喝咖啡|聚餐|吃饭|沟通|讨论|见面)/)
      || slots.task.match(/拜访\s*([^，,。！？!?\s]{1,6})/);
    if (personInTask && !found.some((e) => e.type === 'person' && e.name === personInTask[1].trim())) {
      found.push({ name: personInTask[1].trim(), type: 'person' });
    }
  }
  for (const e of found) {
    const existing = repos.memoryEntities.find(
      (x) => x.type === e.type && x.name === e.name,
    );
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = Date.now();
    } else {
      repos.memoryEntities.push({
        id: genId('ent'),
        name: e.name,
        type: e.type,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        count: 1,
      });
    }
  }
  if (repos.memoryEntities.length > ENTITY_LIMIT) {
    repos.memoryEntities = repos.memoryEntities.slice(-ENTITY_LIMIT);
  }
  repos.saveMemory();
}

/** 用户显式设置偏好（如默认提醒提前量） */
export function setPreference(repos: Repos, key: string, value: unknown): PreferenceMemoryRecord {
  const existing = repos.memoryPreferences.find((p) => p.key === key);
  if (existing) {
    existing.value = value;
    existing.source = 'user';
    existing.updatedAt = Date.now();
    repos.saveMemory();
    return existing;
  }
  const record: PreferenceMemoryRecord = {
    id: genId('pref'),
    key,
    value,
    source: 'user',
    updatedAt: Date.now(),
  };
  repos.memoryPreferences.push(record);
  if (repos.memoryPreferences.length > PREFERENCE_LIMIT) {
    repos.memoryPreferences = repos.memoryPreferences.slice(-PREFERENCE_LIMIT);
  }
  repos.saveMemory();
  return record;
}

/** 从日程数据推导偏好摘要（最常见时间 / 默认提醒提前量 / 各优先级提醒偏好） */
export function derivePreferenceSummary(repos: Repos): {
  mostCommonTime?: string;
  mostCommonRemindMinutes?: number;
  preferenceByPriority: Record<string, number>;
} {
  const active = repos.schedules.filter((s) => s.status !== 'cancelled');
  const timeCount = new Map<string, number>();
  const remindCount = new Map<number, number>();
  const byPriority: Record<string, number> = { high: 30, medium: 15, low: 10 };
  for (const s of active) {
    timeCount.set(s.time, (timeCount.get(s.time) || 0) + 1);
    remindCount.set(s.remindOffsetMinutes, (remindCount.get(s.remindOffsetMinutes) || 0) + 1);
    byPriority[s.priority] = s.remindOffsetMinutes;
  }
  let mostCommonTime: string | undefined;
  let mostCommonRemind: number | undefined;
  let maxT = 0;
  for (const [k, v] of timeCount) {
    if (v > maxT) {
      maxT = v;
      mostCommonTime = k;
    }
  }
  let maxR = 0;
  for (const [k, v] of remindCount) {
    if (v > maxR) {
      maxR = v;
      mostCommonRemind = k;
    }
  }
  return {
    mostCommonTime,
    mostCommonRemindMinutes: mostCommonRemind,
    preferenceByPriority: byPriority,
  };
}

export function listPreferences(repos: Repos): PreferenceMemoryRecord[] {
  return repos.memoryPreferences;
}

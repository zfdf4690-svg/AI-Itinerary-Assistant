/**
 * PHASE 4-D · D3 Schedule Conflict Checker —— 确定性程序逻辑，不经过 LLM。
 *
 * 规则（任务书 P0）：
 * - exact  = 同一天 + 同一时间（时间差 0）
 * - nearby = 同一天 + 时间差 ≤ 60min（仅提醒，绝不表述为 exact，不阻止创建）
 * - none   = 其余
 *
 * 仅检查 status === 'active' 的已有日程；draft 尚未创建（无 id），天然排除自身。
 * 输入：{ date: YYYY-MM-DD, time: HH:mm }；输出结构化 ConflictResult，
 * 自然语言表达交给 Response Generator（LLM 只负责"说"，不负责"判"）。
 */
import { Repos } from '../db/repos.js';
import { ConflictEntry, ConflictLevel, ConflictResult } from '../types.js';
import { parseClockTime } from '../utils/date.js';

export interface ConflictTarget {
  date: string;
  time: string;
}

/** 同一天内与目标时间差（分钟）；差 0 → exact；0 < 差 ≤ 60 → nearby */
export function checkScheduleConflict(repos: Repos, target: ConflictTarget): ConflictResult {
  const { date, time } = target;
  const empty: ConflictResult = { hasConflict: false, level: 'none', conflicts: [] };
  if (!date || !time) return empty;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return empty;
  const t = parseClockTime(time);
  if (!t) return empty;

  const exactEntries: ConflictEntry[] = [];
  const nearbyEntries: ConflictEntry[] = [];

  for (const s of repos.schedules) {
    if (s.status !== 'active') continue; // 仅活跃日程参与冲突判定
    if (s.date !== date) continue;       // 跨天不冲突
    const st = parseClockTime(s.time);
    if (!st) continue;
    const diff = Math.abs(st.minutes - t.minutes);
    if (diff === 0) {
      exactEntries.push({ scheduleId: s.id, date: s.date, time: s.time, task: s.task || s.title, location: s.location || '' });
    } else if (diff <= 60) {
      nearbyEntries.push({ scheduleId: s.id, date: s.date, time: s.time, task: s.task || s.title, location: s.location || '' });
    }
  }

  if (exactEntries.length > 0) {
    return { hasConflict: true, level: 'exact', conflicts: exactEntries };
  }
  if (nearbyEntries.length > 0) {
    return { hasConflict: true, level: 'nearby', conflicts: nearbyEntries };
  }
  return empty;
}

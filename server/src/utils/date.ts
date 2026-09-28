/**
 * 日期与中文数字工具。
 * 所有日期解析均基于服务器本地时区；提醒引擎据此计算提醒时刻。
 */

export const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const CN_NUM_MAP: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 中文数字（支持「十」「十五」「二十」）→ number */
export function cnNumberToInt(raw: string): number {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_NUM_MAP[s[1]] || 0);
  if (s.endsWith('十')) return (CN_NUM_MAP[s[0]] || 1) * 10;
  // 二十X / 两X
  if (s.length === 2) {
    const tens = CN_NUM_MAP[s[0]];
    const ones = CN_NUM_MAP[s[1]];
    if (tens !== undefined && ones !== undefined) return tens * 10 + ones;
  }
  for (const ch of s) {
    if (CN_NUM_MAP[ch] !== undefined) return CN_NUM_MAP[ch];
  }
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 1 : n;
}

/** 格式化为 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今天日期字符串 */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** 解析 YYYY-MM-DD → Date（本地时区） */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 偏移天数 → { date, weekday } */
export function dateByOffset(offsetDays: number): { date: string; weekday: string } {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { date: toDateStr(d), weekday: WEEKDAYS_CN[d.getDay()] };
}

/** 下一个周 X（若今天就是周 X，返回今天） */
export function nextWeekday(target: number): { date: string; weekday: string } {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return { date: toDateStr(d), weekday: WEEKDAYS_CN[d.getDay()] };
}

/** 展示用日期标签：今天/明天/后天 → 「明天 (周二)」；更远 → 「9月28日 周一」 */
export function formatDateLabel(date: string): string {
  const today = todayStr();
  const d = parseDateStr(date);
  const weekday = WEEKDAYS_CN[d.getDay()];
  if (date === today) return `今天 (${weekday})`;
  const tomorrow = dateByOffset(1).date;
  if (date === tomorrow) return `明天 (${weekday})`;
  const dayAfter = dateByOffset(2).date;
  if (date === dayAfter) return `后天 (${weekday})`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`;
}

/** 解析「提前30分钟 / 提前1小时 / 提前半小时 / 提前15分钟」→ 分钟；无法解析返回 null */
export function parseRemindOffset(text: string): { label: string; minutes: number } | null {
  if (!text) return null;
  if (text.includes('半小时')) return { label: '提前30分钟', minutes: 30 };
  const m = text.match(/提前\s*([0-9一二两三四五六七八九十]+)\s*(小时|分钟|小时半)/);
  if (!m) return null;
  const num = cnNumberToInt(m[1]);
  if (m[2] === '小时') return { label: `提前${num}小时`, minutes: num * 60 };
  return { label: `提前${num}分钟`, minutes: num };
}

/** 解析「HH:mm」或「H:mm」→ {HH:mm, minutes}；失败返回 null */
export function parseClockTime(raw: string): { time: string; minutes: number } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  return { time, minutes: h * 60 + min };
}

/** 组合日期 + 时间 → 本地 Date */
export function dateTimeToDate(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const t = parseClockTime(time);
  if (!t) return null;
  const d = parseDateStr(date);
  d.setHours(Math.floor(t.minutes / 60), t.minutes % 60, 0, 0);
  return d;
}

/** 归一化保留原有 draft 字段，只合并解析出的新槽位 */
export function isRefusal(text: string): boolean {
  const t = text.trim();
  return /^(不用了?|不?需要|先不填|算了|暂时?不用|先不用|不用问|跳过|就这样|都可以|随便|行|好的|可以|嗯|好)$/.test(t)
    || /^(不用了?|不?需要|先不填|算了|暂时?不用|先不用|不用问|跳过)[，。！!？?\s]*$/.test(t)
    || (t.includes('不用') && t.length <= 8)
    || (t.includes('先不填') && t.length <= 8)
    || (t.includes('不需要') && t.length <= 8);
}

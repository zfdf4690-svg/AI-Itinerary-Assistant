/**
 * 本地规则 NLU 引擎（PRD §4）：按 5 字段模板解析中文自然语言日程输入，
 * 支持首轮新建与多轮局部修改（“不是X，是Y”“改成/改到”）。
 * 作为 LLM 通道不可用时的兜底，也是 LLM 结果的补充校准。
 */
import {
  ParsedSlots, SchedulePriority,
} from '../types.js';
import {
  cnNumberToInt, dateByOffset, formatDateLabel, nextWeekday, parseRemindOffset,
  todayStr, toDateStr, WEEKDAYS_CN,
} from '../utils/date.js';

/** 从文本提取实体（人物/地点/组织），供 Entity Memory 使用 */
export function extractEntities(text: string, slots: ParsedSlots): { name: string; type: 'person' | 'location' | 'organization' }[] {
  const entities: { name: string; type: 'person' | 'location' | 'organization' }[] = [];
  const seen = new Set<string>();

  const personMatch = text.match(/(?:和|与|跟|约)\s*([^，,。！？!?\s]{1,6}?)\s*(?:开会|会议|喝咖啡|吃饭|聚餐|拜访|沟通|讨论|见面|谈)/);
  if (personMatch) {
    const name = personMatch[1].trim();
    if (name && name.length >= 1 && !seen.has(name)) {
      entities.push({ name, type: 'person' });
      seen.add(name);
    }
  }

  if (slots.location && !seen.has(slots.location)) {
    entities.push({ name: slots.location, type: 'location' });
    seen.add(slots.location);
  }

  return entities;
}

/** 解析一句话，返回 5 字段槽位（与已有 draft 合并） */
export function parseUtterance(text: string, currentDraft?: Partial<ParsedSlots>): ParsedSlots {
  const normalized = text.trim();
  if (!normalized) return { ...(currentDraft || {}) };

  const result: ParsedSlots = { ...(currentDraft || {}) };

  // ---- 0. 显式“不是 X，是 Y”修正（PRD §7 异常修正） ----
  // 地点修正
  const locNotMatch = normalized.match(/(?:地点|位置)(?:不是|不在)([^，,。！？!?\s]{1,12}?)(?:，|,|是|在|改成)([^，,。！？!?\s]{1,20})/);
  if (locNotMatch) result.location = locNotMatch[2].trim();
  // 人物修正：不是张威，是张伟（须与地点修正互斥）
  const personNotMatch = normalized.match(/(?:不是)([^，,。！？!?\s]{1,6})(?:，|,)(?:是|改成)([^，,。！？!?\s]{1,6})(?:开会|会议)?/);
  if (personNotMatch && !/(地点|位置|地方)/.test(normalized)) {
    const person = personNotMatch[2].trim();
    const action = result.task?.includes('喝咖啡') ? '喝咖啡'
      : result.task?.includes('聚餐') || result.task?.includes('吃饭') ? '聚餐'
        : result.task?.includes('拜访') ? '拜访'
          : '开会';
    result.task = action === '拜访' ? `拜访${person}` : `与${person}${action}`;
    result.title = result.task;
  }

  // ---- 1. 日期 ----
  if (normalized.includes('大后天')) {
    const d = dateByOffset(3);
    result.date = d.date;
    result.dateLabel = `${formatDateLabel(d.date)}`;
  } else if (normalized.includes('后天')) {
    const d = dateByOffset(2);
    result.date = d.date;
    result.dateLabel = formatDateLabel(d.date);
  } else if (normalized.includes('明天')) {
    const d = dateByOffset(1);
    result.date = d.date;
    result.dateLabel = formatDateLabel(d.date);
  } else if (normalized.includes('今天')) {
    result.date = todayStr();
    result.dateLabel = formatDateLabel(todayStr());
  } else if (/周[一二三四五六日天]/.test(normalized)) {
    const m = normalized.match(/周([一二三四五六日天])/);
    if (m) {
      const target = '一二三四五六日'.indexOf(m[1]);
      const d = nextWeekday(target);
      result.date = d.date;
      result.dateLabel = formatDateLabel(d.date);
    }
  } else {
    // 具体日期：9月28日 / 2026年9月28日 / 9/28
    const monthDay = normalized.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
    if (monthDay) {
      const year = monthDay[1] ? parseInt(monthDay[1], 10) : new Date().getFullYear();
      const month = parseInt(monthDay[2], 10);
      const day = parseInt(monthDay[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        result.date = toDateStr(d);
        result.dateLabel = formatDateLabel(result.date);
      }
    }
  }

  // ---- 2. 时间 ----
  // HH:mm / H:mm
  const clockMatch = normalized.match(/(\d{1,2}):(\d{2})/);
  if (clockMatch) {
    const h = parseInt(clockMatch[1], 10);
    const min = parseInt(clockMatch[2], 10);
    if (h <= 23 && min <= 59) {
      result.time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  } else {
    // 上午/下午/晚上/中午 N点(半|一刻|三刻)
    const timeMatch = normalized.match(/(今天|明天|后天)?\s*(上午|早上|中午|下午|晚上|凌晨)?\s*([0-9一二两三四五六七八九十]{1,2})点(?:(半|一刻|三刻|整))?/);
    if (timeMatch) {
      const period = timeMatch[2];
      let h = cnNumberToInt(timeMatch[3]);
      if (period === '下午' || period === '晚上') {
        if (h < 12) h += 12;
      } else if (period === '中午' && h < 12) {
        h += 12;
      }
      if (h === 24) h = 0;
      const half = timeMatch[4];
      const min = half === '半' ? 30 : half === '一刻' ? 15 : half === '三刻' ? 45 : 0;
      result.time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  // ---- 3. 地点 ----
  // 时间/日期类表达（用于与地点“改到/换成”规则互斥）
  const isTimePhrase = (x: string): boolean =>
    /点|上午|下午|晚上|中午|今天|明天|后天|大后天|周[一二三四五六日天]|\d{1,2}:\d{2}|\d{1,2}月\d{1,2}日/.test(x);

  // 修正型：地点改成X / 地点改到X / 换成X（显式地点前缀优先）
  const locExplicit = normalized.match(/(?:地点|位置)(?:改成|改为|换到|改到|换成|移到|挪到)\s*([^，,。！？!?\s]{1,16})/);
  if (locExplicit) {
    result.location = locExplicit[1].trim();
  }
  // 修正型：改到/换到/移到/挪到/换成 X（语义上倾向地点；X 为时间表达时交给时间规则）
  if (!result.location) {
    const locChangeMatch = normalized.match(/(?:改到|换到|移到|挪到|换成)\s*([^，,。！？!?\s]{1,16})/);
    if (locChangeMatch && !isTimePhrase(locChangeMatch[1])) {
      result.location = locChangeMatch[1].trim();
    }
  }
  // 任务/事项类“改成”不应落入地点
  if (!result.location && /(?:任务|事项|议题|内容|时间|日期|提醒)(?:改成|改为)/.test(normalized)) {
    /* 留给对应字段规则处理 */
  }
  // 描述型：在/去/到 X + 动作词（X 为时间表达时跳过）
  if (!result.location || normalized.includes('在') || normalized.includes('去')) {
    const locMatch = normalized.match(/(?:在|去|到)\s*([^，,。！？!?和与跟开会吃饭聚餐喝咖啡聊谈讨论]{1,14}?)(?:开会|会议|吃饭|聚餐|喝咖啡|拜访|沟通|讨论|见面|谈|，|,|$)/);
    if (locMatch && !isTimePhrase(locMatch[1])) {
      const place = locMatch[1].trim();
      if (place && place.length >= 2 && !/^(开会|吃饭|聚餐|喝咖啡|拜访|讨论|见面)$/.test(place)) {
        result.location = place;
      }
    }
  }

  // ---- 4. 人物与任务 ----
  const personMatch = normalized.match(/(?:和|与|跟|约)\s*([^，,。！？!?\s]{1,6}?)\s*(开会|会议|喝咖啡|吃饭|聚餐|拜访|沟通|讨论|见面|谈)/);
  if (personMatch) {
    const person = personMatch[1].trim();
    const action = personMatch[2];
    let task = '';
    if (action.includes('开会') || action.includes('会议')) task = `与${person}开会`;
    else if (action.includes('喝咖啡')) task = `与${person}喝咖啡`;
    else if (action.includes('吃饭') || action.includes('聚餐')) task = `与${person}聚餐`;
    else if (action.includes('拜访')) task = `拜访${person}`;
    else task = `与${person}沟通`;
    result.task = task;
    result.title = task;
  } else if (/开会|会议/.test(normalized)) {
    result.task = '项目会议';
    result.title = '项目推进会议';
  } else if (/吃饭|聚餐|晚宴/.test(normalized)) {
    result.task = '聚餐';
    result.title = '朋友聚餐';
  } else if (/喝咖啡|咖啡/.test(normalized)) {
    result.task = '喝咖啡';
    result.title = '咖啡时光';
  }

  // ---- 5. 事项 ----
  const mattersChangeMatch = normalized.match(/(?:事项|议题|内容)(?:改成|改为|是)?\s*([^，,。！？!?\s]{1,24})/);
  if (mattersChangeMatch) {
    result.matters = mattersChangeMatch[1].trim();
  }
  const discussMatch = normalized.match(/(?:讨论|聊|谈|跟进|确认)\s*([^，,。！？!?\s]{1,20})/);
  if (discussMatch && !result.matters && !/^(地点|时间|提醒|改成|改为)/.test(discussMatch[0])) {
    result.matters = discussMatch[1].trim();
  }

  // ---- 6. 提醒时间 ----
  const remindChange = normalized.match(/(?:提醒|提前)\s*(?:改成|改为|设置为|设成)?\s*(提前)?\s*([0-9一二两三四五六七八九十半]+)\s*(小时|分钟)/);
  if (remindChange) {
    const raw = `提前${remindChange[2]}${remindChange[3]}`;
    const parsed = parseRemindOffset(raw);
    if (parsed) {
      result.remindOffset = parsed.label;
      result.remindOffsetMinutes = parsed.minutes;
    }
  }

  // ---- 7. 优先级 ----
  if (/重要|紧急|务必|高层|谈判|签约|投标/.test(normalized)) {
    result.priority = 'high';
  } else if (/聚餐|咖啡|休闲|下午茶|锻炼|健身|放松/.test(normalized)) {
    result.priority = 'low';
  } else if (!result.priority) {
    result.priority = 'medium';
  }

  return result;
}

/** 解析提醒字段并补全 remindOffsetMinutes */
export function normalizeRemind(slots: ParsedSlots): ParsedSlots {
  if (slots.remindOffset && slots.remindOffsetMinutes === undefined) {
    const parsed = parseRemindOffset(slots.remindOffset);
    if (parsed) {
      slots.remindOffset = parsed.label;
      slots.remindOffsetMinutes = parsed.minutes;
    }
  }
  return slots;
}

/** 判断 5 字段完整性（PRD §3：时间 + 任务为最低要求） */
export function checkCompleteness(slots: ParsedSlots): {
  missingRequired: string[];
  missingOptional: string[];
} {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  if (!slots.time) missingRequired.push('time');
  if (!slots.task && !slots.title) missingRequired.push('task');
  if (!slots.location) missingOptional.push('location');
  if (!slots.matters) missingOptional.push('matters');
  if (!slots.remindOffset && !slots.remindOffsetMinutes) missingOptional.push('remindOffset');
  return { missingRequired, missingOptional };
}

/** 识别用户明确表达的长期偏好（任务书 §21）。
 *  仅当语句含「以后/每次/默认/记住/总是」等泛化词时才记录，不擅自推断。
 *  例：「以后会议都提前30分钟提醒我」→ { key: 'defaultMeetingReminder', value: 30 } */
export function extractPreferenceFromText(text: string): { key: string; value: number } | null {
  const t = text.trim();
  if (!t) return null;
  const generalized = /(以后|以后都|每次|每次都给|默认|记住|长期|总是|向来)/.test(t);
  if (!generalized) return null;

  let minutes: number | null = null;
  if (t.includes('半小时')) {
    minutes = 30;
  } else {
    const m = t.match(/提前\s*([0-9一二两三四五六七八九十]+)\s*(小时|分钟)/);
    if (m) {
      minutes = m[2] === '小时' ? cnNumberToInt(m[1]) * 60 : cnNumberToInt(m[1]);
    }
  }
  if (minutes === null || minutes <= 0 || minutes > 24 * 60) return null;

  const key = /会议|会面|谈判/.test(t)
    ? 'defaultMeetingReminder'
    : /日程|安排|行程|事项/.test(t)
      ? 'defaultScheduleReminder'
      : 'defaultReminder';
  return { key, value: minutes };
}

/** 生成日期兜底：未指定日期时默认明天（与前端既有行为一致） */
export function ensureDefaultDate(slots: ParsedSlots): ParsedSlots {
  if (!slots.date) {
    const d = dateByOffset(1);
    slots.date = d.date;
    slots.dateLabel = formatDateLabel(d.date);
  }
  return slots;
}

export function weekdayCnFromIndex(i: number): string {
  return WEEKDAYS_CN[i] || '';
}

export { cnNumberToInt };

/**
 * AI 语音行程助手 P0 后端领域类型
 * 依据 PRD：5 字段标准日程模板（时间/地点/任务/事项/提醒时间）、
 * 5 状态状态机（输入→AI理解→补充信息→日程卡片→已创建）、Memory Layer。
 */

export type PersonaId = 'energetic' | 'gentle' | 'professional';
export type SchedulePriority = 'high' | 'medium' | 'low';
export type ScheduleStatus = 'active' | 'completed' | 'cancelled';
export type AccentColor = 'blue' | 'red' | 'orange' | 'emerald';

/** P0 标准日程卡片（5 字段 + 展示辅助字段） */
export interface ScheduleItem {
  id: string;
  /** 24 小时制时间 HH:mm（时间字段） */
  time: string;
  /** 绝对日期 YYYY-MM-DD（由 dateLabel 计算，用于提醒引擎） */
  date: string;
  /** 展示用日期标签，如「明天 (周二)」「9月28日 周一」 */
  dateLabel: string;
  /** 任务（任务字段，必填） */
  task: string;
  /** 标题（展示用，通常与任务一致） */
  title: string;
  /** 地点（地点字段，可选） */
  location: string;
  /** 事项（事项字段，可选） */
  matters: string;
  /** 提醒时间（提醒字段，可选），如「提前30分钟」 */
  remindOffset: string;
  /** 提醒提前量（分钟），由 remindOffset 解析得到 */
  remindOffsetMinutes: number;
  accentColor: AccentColor;
  priority: SchedulePriority;
  hasAlarm: boolean;
  status: ScheduleStatus;
  createdAt: number;
  updatedAt: number;
}

/** 会话状态机：① 输入 → ② AI理解 → ③ 补充信息 → ④ 日程卡片 → ⑤ 已创建 */
export type ConversationState =
  | 'input'           // ① 输入
  | 'understanding'   // ② AI理解（解析中）
  | 'awaiting_clarify' // 必填缺失（时间/任务）→ 必须澄清
  | 'awaiting_supplement' // 可选字段缺失 → 委婉追问，允许拒绝
  | 'card_ready'      // ④ 日程卡片（可确认 / 可修改）
  | 'chatting'        // 普通闲聊（general_chat），不产生日程
  | 'created';        // ⑤ 已创建

/**
 * Conversation Intent（PHASE 4-B）：用户本轮「想做什么」。
 * 与 Action（系统下一步「需要做什么」）分离：intent 由 Intent Router 结合上下文判定。
 */
export type ConversationIntent =
  | 'schedule_create'   // 创建日程
  | 'schedule_modify'   // 修改/补充当前 draft
  | 'schedule_confirm'  // 确认当前待确认 draft（必须有草稿且必填完整）
  | 'schedule_cancel'   // 取消当前创建流程（必须有进行中的 draft 上下文）
  | 'general_chat';     // 普通闲聊（问候/自我介绍/能力询问等），绝不进入 Schedule NLU

/** 前端需要的下一步动作（任务书 §8/§9 枚举语义） */
export type ActionType =
  | 'ASK_REQUIRED'       // 必填缺失，必须澄清
  | 'ASK_OPTIONAL'       // 可选缺失，委婉追问（可拒绝）
  | 'SHOW_SCHEDULE_CARD' // 展示日程卡片
  | 'NONE';              // 无动作（已创建/输入中/闲聊）

export interface ConversationTurn {
  role: 'user' | 'ai';
  text: string;
  at: number;
}

export interface Conversation {
  id: string;
  state: ConversationState;
  personaId: PersonaId;
  /** PHASE 4-B：当前用户意图（由 Intent Router 结合上下文判定） */
  intent: ConversationIntent;
  intentConfidence?: number;
  /** 当前草稿（5 字段） */
  draft: Partial<ScheduleItem>;
  /** 正在追问的可选字段 */
  missing: string[];
  turns: ConversationTurn[];
  source: 'llm' | 'local';
  /** 前端下一步动作（任务书枚举） */
  action: ActionType;
  createdAt: number;
  updatedAt: number;
}

/** 单轮理解结果（POST /api/understand） */
export interface UnderstandResult {
  state: ConversationState;
  slots: Partial<ScheduleItem>;
  /** 缺失的必填字段（时间/任务） */
  missingRequired: string[];
  /** 缺失的可选字段（地点/事项/提醒） */
  missingOptional: string[];
  replyText: string;
  source: 'llm' | 'local';
  /** 前端下一步动作（任务书 §8/§9：ASK_OPTIONAL / SHOW_SCHEDULE_CARD 等） */
  actionRequired: ActionType;
}

/** LLM / 本地 NLU 统一输出槽位 */
export interface ParsedSlots {
  time?: string;
  date?: string;
  dateLabel?: string;
  task?: string;
  title?: string;
  location?: string;
  matters?: string;
  remindOffset?: string;
  remindOffsetMinutes?: number;
  priority?: SchedulePriority;
  replyText?: string;
  hasAlarm?: boolean;
  status?: ScheduleStatus;
}

export interface LLMConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface MiniMaxVoiceIds {
  energetic: string;
  gentle: string;
  professional: string;
}

export interface MiniMaxConfig {
  enabled: boolean;
  apiKey: string;
  groupId: string;
  ttsModel: string;
  asrModel: string;
  voiceIds: MiniMaxVoiceIds;
}

export interface RuntimeConfig {
  llm: LLMConfig;
  minimax: MiniMaxConfig;
  updatedAt?: number;
}

/** Memory Layer —— Event Memory */
export interface EventMemoryRecord {
  scheduleId: string;
  task: string;
  title: string;
  date: string;
  time: string;
  status: ScheduleStatus;
  createdAt: number;
}

/** Memory Layer —— Entity Memory（人物/地点/组织） */
export type EntityType = 'person' | 'location' | 'organization';

export interface EntityMemoryRecord {
  id: string;
  name: string;
  type: EntityType;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
}

/** Memory Layer —— Preference Memory */
export interface PreferenceMemoryRecord {
  id: string;
  key: string;
  value: unknown;
  source: 'user' | 'derived';
  updatedAt: number;
}

export type ReminderType = 'schedule_alarm' | 'daily_briefing' | 'evening_review';

export interface ReminderRecord {
  id: string;
  type: ReminderType;
  scheduleId?: string;
  title: string;
  message: string;
  /** 应提醒时刻（时间戳） */
  dueAt: number;
  /** 实际触发时刻（时间戳） */
  triggeredAt: number;
  priority?: SchedulePriority;
  dismissed: boolean;
}

export interface ReminderConfig {
  dailyAlarmEnabled: boolean;
  dailyReminderTime: string; // HH:mm 每日简报
  eveningReviewEnabled: boolean;
  eveningReviewTime: string; // HH:mm 晚间复盘
  priorityOffsets: {
    high: number;
    medium: number;
    low: number;
  };
}

/** Persona Layer（后端承载 Prompt 与 Voice；UI Theme 仍在前端） */
export interface PersonaVoice {
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  model: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  description: string;
  traits: string[];
  voiceStyle: string;
  voice: PersonaVoice;
  prompt: {
    /** 注入 LLM 的系统人格 Prompt */
    system: string;
    welcome: string;
    /** 委婉追问可选字段 */
    askOptional: (field: string) => string;
    /** 用户拒绝补充可选信息时的回复（不阻塞创建） */
    refuseAccepted: string;
    /** 必填缺失时的澄清询问 */
    askRequired: (fields: string[]) => string;
    /** 展示日程卡片时的确认语 */
    confirmCard: string;
    /** 创建成功回复 */
    confirmCreated: (title: string) => string;
    /** 局部修改成功回复 */
    updated: (fields: string[]) => string;
    /** PHASE 4-B：general_chat 闲聊回复 */
    generalChat: string;
    /** PHASE 4-B：schedule_cancel 取消创建回复 */
    cancelAccepted: string;
    /** 日程提醒模板 */
    reminder: (title: string, minutes: number) => string;
    /** 晚间复盘模板 */
    eveningReview: (count: number) => string;
  };
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

export type PersonaId = 'energetic' | 'gentle' | 'professional';

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  description: string;
  traits: string[];
  avatar: string;
  voiceStyle: string;
  speechPitch: number;
  speechRate: number;
  sampleAudioText: string;
  confirmReplyText: string;
  reminderTemplate: (title: string, minutes: number) => string;
  eveningReviewText: (itemCount: number) => string;
}

export type SchedulePriority = 'high' | 'medium' | 'low';

export interface DeepSeekSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface PriorityReminderPreference {
  enabled: boolean;
  offsetMinutes: number; // e.g. 15, 30, 60
  soundAlert: boolean;
}

export interface DailyReminderConfig {
  dailyAlarmEnabled: boolean;
  dailyReminderTime: string; // e.g. "08:30" (morning briefing)
  eveningReviewEnabled: boolean;
  eveningReviewTime: string; // e.g. "21:00"
  priorityPreferences: {
    high: PriorityReminderPreference;
    medium: PriorityReminderPreference;
    low: PriorityReminderPreference;
  };
}

export interface ScheduleItem {
  id: string;
  time: string; // e.g. "15:00"
  dateLabel: string; // e.g. "明天 (周二)" or "9月29日"
  title: string; // e.g. "与张总开会"
  location?: string; // e.g. "陆家嘴"
  task: string; // e.g. "与张总开会"
  matters?: string; // e.g. "二期项目"
  remindOffset?: string; // e.g. "提前 30 分钟"
  accentColor?: 'blue' | 'red' | 'orange' | 'emerald';
  priority?: SchedulePriority;
  hasAlarm?: boolean;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  scheduleDraft?: Partial<ScheduleItem>;
  timestamp: number;
  actionRequired?: boolean;
}

/**
 * 对应设计系统规范定义的 P0 页面与状态机
 * 01: Home (日常入口)
 * 02: Listening (语音输入)
 * 03: AI Clarification (AI 补充信息)
 * 04: Schedule Card (AI 生成日程)
 * 05: Schedule Edit (用户手动修改轻量结构化表单)
 * 06: Created (创建完成)
 * 07: Calendar (查看日历安排)
 * 08: Persona (人格/声音设置)
 * 09: Settings (系统设置)
 */
export type ViewType = 
  | 'home'             // 01 Home
  | 'listening'        // 02 Listening
  | 'clarification'    // 03 AI Clarification
  | 'confirmation'     // 04 Schedule Card
  | 'schedule_edit'    // 05 Schedule Edit
  | 'success'          // 06 Created
  | 'calendar'         // 07 Calendar
  | 'persona_detail'   // 08 Persona
  | 'settings'         // 09 Settings
;

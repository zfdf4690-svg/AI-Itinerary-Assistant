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
  dateLabel: string; // e.g. "明天 (周二)" or "4月23日 周二"
  title: string; // e.g. "与张总开会"
  location: string; // e.g. "上海虹桥"
  task: string; // e.g. "与张总开会"
  matters: string; // e.g. "讨论二期项目"
  remindOffset: string; // e.g. "提前30分钟"
  accentColor: 'blue' | 'red' | 'orange' | 'emerald';
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

export type ViewType = 
  | 'home'             // 01-首页-语音唤醒
  | 'listening'        // 02-语音输入中
  | 'confirmation'     // 03-日程卡片展示 / 04-二次修改
  | 'success'          // 08-创建成功-提醒设置
  | 'calendar'         // 05-日程列表-今日行程
  | 'settings'         // 06-AI人格设置
  | 'persona_detail'   // 07-人格选择详情
;

/**
 * 数据仓储：schedules / conversations / reminders / memory / config。
 * 内存副本 + JSON 文件持久化，写操作即落盘。
 */
import crypto from 'node:crypto';
import { JsonStore } from './store.js';
import {
  Conversation, EventMemoryRecord, EntityMemoryRecord, PreferenceMemoryRecord,
  ReminderConfig, ReminderRecord, ScheduleItem,
} from '../types.js';
import { ENV, ConfigStore, RuntimeConfig } from '../config.js';

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

export class Repos {
  schedules: ScheduleItem[];
  conversations: Conversation[];
  reminders: ReminderRecord[];
  memoryEvents: EventMemoryRecord[];
  memoryEntities: EntityMemoryRecord[];
  memoryPreferences: PreferenceMemoryRecord[];
  reminderConfig: ReminderConfig;
  runtimeConfig: RuntimeConfig;

  private store: {
    schedules: JsonStore<ScheduleItem[]>;
    conversations: JsonStore<Conversation[]>;
    reminders: JsonStore<ReminderRecord[]>;
    events: JsonStore<EventMemoryRecord[]>;
    entities: JsonStore<EntityMemoryRecord[]>;
    preferences: JsonStore<PreferenceMemoryRecord[]>;
    reminderConfig: JsonStore<ReminderConfig>;
  };

  constructor() {
    const dir = ENV.dataDir;
    this.store = {
      schedules: new JsonStore<ScheduleItem[]>(dir, 'schedules', []),
      conversations: new JsonStore<Conversation[]>(dir, 'conversations', []),
      reminders: new JsonStore<ReminderRecord[]>(dir, 'reminders', []),
      events: new JsonStore<EventMemoryRecord[]>(dir, 'memory_events', []),
      entities: new JsonStore<EntityMemoryRecord[]>(dir, 'memory_entities', []),
      preferences: new JsonStore<PreferenceMemoryRecord[]>(dir, 'memory_preferences', []),
      reminderConfig: new JsonStore<ReminderConfig>(dir, 'reminder_config', defaultReminderConfig()),
    };

    this.schedules = this.store.schedules.load();
    this.conversations = this.store.conversations.load();
    this.reminders = this.store.reminders.load();
    this.memoryEvents = this.store.events.load();
    this.memoryEntities = this.store.entities.load();
    this.memoryPreferences = this.store.preferences.load();
    this.reminderConfig = { ...defaultReminderConfig(), ...this.store.reminderConfig.load() };

    const cfgStore = new ConfigStore(ENV.dataDir);
    this.runtimeConfig = cfgStore.load();
  }

  saveSchedules(): void { this.store.schedules.save(this.schedules); }
  saveConversations(): void { this.store.conversations.save(this.conversations); }
  saveReminders(): void { this.store.reminders.save(this.reminders); }
  saveMemory(): void {
    this.store.events.save(this.memoryEvents);
    this.store.entities.save(this.memoryEntities);
    this.store.preferences.save(this.memoryPreferences);
  }
  saveReminderConfig(): void { this.store.reminderConfig.save(this.reminderConfig); }

  findSchedule(id: string): ScheduleItem | undefined {
    return this.schedules.find((s) => s.id === id);
  }

  findConversation(id: string): Conversation | undefined {
    return this.conversations.find((c) => c.id === id);
  }
}

export function defaultReminderConfig(): ReminderConfig {
  return {
    dailyAlarmEnabled: true,
    dailyReminderTime: '08:30',
    eveningReviewEnabled: true,
    eveningReviewTime: '21:00',
    priorityOffsets: { high: 30, medium: 15, low: 10 },
  };
}

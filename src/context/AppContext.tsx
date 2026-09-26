import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  PersonaId, 
  Persona, 
  ScheduleItem, 
  ChatMessage, 
  ViewType, 
  DailyReminderConfig, 
  SchedulePriority 
} from '../types';
import { PERSONAS } from '../constants/personas';
import { parseScheduleFromUtterance } from '../utils/nlu';
import { playAudioFeedback, speakText } from '../utils/audio';
import { BackgroundNotificationToast } from '../components/common/NotificationToast';
import { 
  DeepSeekConfig, 
  DEFAULT_DEEPSEEK_CONFIG 
} from '../services/llmService';
import { 
  getStoredDeepSeekConfig, 
  saveStoredDeepSeekConfig, 
  parseWithDeepSeekOrFallback 
} from '../services/deepseekClient';
import {
  MiniMaxConfig,
  getStoredMiniMaxConfig,
  saveStoredMiniMaxConfig
} from '../services/minimaxClient';

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  activePersonaId: PersonaId;
  setActivePersonaId: (id: PersonaId) => void;
  activePersona: Persona;
  autoVoiceEnabled: boolean;
  setAutoVoiceEnabled: (enabled: boolean) => void;
  dailyReminderConfig: DailyReminderConfig;
  updateDailyReminderConfig: (updates: Partial<DailyReminderConfig>) => void;
  updatePriorityPreference: (priority: SchedulePriority, updates: Partial<DailyReminderConfig['priorityPreferences']['high']>) => void;
  deepSeekConfig: DeepSeekConfig;
  updateDeepSeekConfig: (updates: Partial<DeepSeekConfig>) => void;
  miniMaxConfig: MiniMaxConfig;
  updateMiniMaxConfig: (updates: Partial<MiniMaxConfig>) => void;
  isLlmProcessing: boolean;
  lastLlmSource: 'deepseek' | 'local_fallback' | null;
  schedules: ScheduleItem[];
  addSchedule: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => ScheduleItem;
  updateSchedule: (id: string, updates: Partial<ScheduleItem>) => void;
  deleteSchedule: (id: string) => void;
  currentDraft: Partial<ScheduleItem> | null;
  setCurrentDraft: React.Dispatch<React.SetStateAction<Partial<ScheduleItem> | null>>;
  chatMessages: ChatMessage[];
  resetChatWithUtterance: (utterance: string) => void;
  applyModification: (correctionText: string) => void;
  confirmDraftSchedule: () => ScheduleItem | null;
  confirmedItem: ScheduleItem | null;
  isEveningReviewOpen: boolean;
  setIsEveningReviewOpen: (open: boolean) => void;
  isManualAddOpen: boolean;
  setIsManualAddOpen: (open: boolean) => void;
  previewDevice: 'mobile' | 'responsive';
  setPreviewDevice: (mode: 'mobile' | 'responsive') => void;
  activeNotification: BackgroundNotificationToast | null;
  dismissNotification: () => void;
  triggerManualReminderTest: (priority?: SchedulePriority) => void;
}

const DEFAULT_REMINDER_CONFIG: DailyReminderConfig = {
  dailyAlarmEnabled: true,
  dailyReminderTime: '08:30',
  eveningReviewEnabled: true,
  eveningReviewTime: '21:00',
  priorityPreferences: {
    high: { enabled: true, offsetMinutes: 30, soundAlert: true },
    medium: { enabled: true, offsetMinutes: 15, soundAlert: true },
    low: { enabled: false, offsetMinutes: 10, soundAlert: false }
  }
};

const INITIAL_SCHEDULES: ScheduleItem[] = [
  {
    id: 'sched-1',
    time: '09:00',
    dateLabel: '4月23日 周二',
    title: '团队例会',
    location: '上海 · 会议室A',
    task: '团队例会',
    matters: '季度规划与进度对齐',
    remindOffset: '提前15分钟',
    accentColor: 'blue',
    priority: 'medium',
    hasAlarm: true,
    status: 'active',
    createdAt: Date.now() - 36000000
  },
  {
    id: 'sched-2',
    time: '11:30',
    dateLabel: '4月23日 周二',
    title: '客户拜访',
    location: '陆家嘴 · 3号楼',
    task: '客户拜访',
    matters: '商务方案演示',
    remindOffset: '提前30分钟',
    accentColor: 'red',
    priority: 'high',
    hasAlarm: true,
    status: 'active',
    createdAt: Date.now() - 28000000
  },
  {
    id: 'sched-3',
    time: '14:00',
    dateLabel: '4月23日 周二',
    title: '项目评审',
    location: '线上会议',
    task: '项目评审',
    matters: 'UI及交互方案验收',
    remindOffset: '提前10分钟',
    accentColor: 'blue',
    priority: 'medium',
    hasAlarm: true,
    status: 'active',
    createdAt: Date.now() - 20000000
  },
  {
    id: 'sched-4',
    time: '16:00',
    dateLabel: '4月23日 周二',
    title: '与张总开会',
    location: '陆家嘴 · 3号楼',
    task: '与张总开会',
    matters: '讨论二期项目推进',
    remindOffset: '提前30分钟',
    accentColor: 'blue',
    priority: 'high',
    hasAlarm: true,
    status: 'active',
    createdAt: Date.now() - 10000000
  },
  {
    id: 'sched-5',
    time: '19:00',
    dateLabel: '4月23日 周二',
    title: '晚餐',
    location: '徐汇 · 绿地餐厅',
    task: '晚餐',
    matters: '朋友聚餐',
    remindOffset: '提前30分钟',
    accentColor: 'orange',
    priority: 'low',
    hasAlarm: false,
    status: 'active',
    createdAt: Date.now() - 5000000
  }
];

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [activePersonaId, setActivePersonaId] = useState<PersonaId>('energetic');
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState<boolean>(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>(INITIAL_SCHEDULES);
  const [currentDraft, setCurrentDraft] = useState<Partial<ScheduleItem> | null>(null);
  const [confirmedItem, setConfirmedItem] = useState<ScheduleItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isEveningReviewOpen, setIsEveningReviewOpen] = useState<boolean>(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'responsive'>('mobile');
  const [dailyReminderConfig, setDailyReminderConfig] = useState<DailyReminderConfig>(() => {
    try {
      const saved = localStorage.getItem('ai_schedule_reminder_config');
      return saved ? JSON.parse(saved) : DEFAULT_REMINDER_CONFIG;
    } catch {
      return DEFAULT_REMINDER_CONFIG;
    }
  });
  const [deepSeekConfig, setDeepSeekConfig] = useState<DeepSeekConfig>(() => {
    return getStoredDeepSeekConfig();
  });
  const [miniMaxConfig, setMiniMaxConfig] = useState<MiniMaxConfig>(() => {
    return getStoredMiniMaxConfig();
  });
  const [isLlmProcessing, setIsLlmProcessing] = useState<boolean>(false);
  const [lastLlmSource, setLastLlmSource] = useState<'deepseek' | 'local_fallback' | null>(null);
  const [activeNotification, setActiveNotification] = useState<BackgroundNotificationToast | null>(null);
  const triggeredTaskIds = useRef<Set<string>>(new Set());

  const activePersona = PERSONAS[activePersonaId];

  const updateDeepSeekConfig = (updates: Partial<DeepSeekConfig>) => {
    setDeepSeekConfig((prev) => {
      const next = { ...prev, ...updates };
      saveStoredDeepSeekConfig(next);
      return next;
    });
    playAudioFeedback('tap');
  };

  const updateMiniMaxConfig = (updates: Partial<MiniMaxConfig>) => {
    setMiniMaxConfig((prev) => {
      const next = { ...prev, ...updates };
      saveStoredMiniMaxConfig(next);
      return next;
    });
    playAudioFeedback('tap');
  };

  // Save reminder config to localStorage
  const updateDailyReminderConfig = (updates: Partial<DailyReminderConfig>) => {
    setDailyReminderConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('ai_schedule_reminder_config', JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
    playAudioFeedback('tap');
  };

  const updatePriorityPreference = (
    priority: SchedulePriority,
    updates: Partial<DailyReminderConfig['priorityPreferences']['high']>
  ) => {
    setDailyReminderConfig((prev) => {
      const next = {
        ...prev,
        priorityPreferences: {
          ...prev.priorityPreferences,
          [priority]: {
            ...prev.priorityPreferences[priority],
            ...updates
          }
        }
      };
      try {
        localStorage.setItem('ai_schedule_reminder_config', JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
    playAudioFeedback('tap');
  };

  const dismissNotification = () => {
    setActiveNotification(null);
  };

  // Background Task Engine: simulates server/client background alarm daemon
  useEffect(() => {
    if (!dailyReminderConfig.dailyAlarmEnabled) return;

    const checkAlarms = () => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMins = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMins}`;

      // 1. Daily morning briefing alarm check
      const morningKey = `morning-${now.toDateString()}`;
      if (
        dailyReminderConfig.dailyReminderTime === currentTimeStr &&
        !triggeredTaskIds.current.has(morningKey)
      ) {
        triggeredTaskIds.current.add(morningKey);
        const activeCount = schedules.filter((s) => s.status !== 'completed').length;
        const msg = `早安！今天共规划了 ${activeCount} 项行程，第一项日程安排在 ${schedules[0]?.time || '上午'}。`;
        
        setActiveNotification({
          id: `toast-${Date.now()}`,
          type: 'daily_briefing',
          title: `每日日程简报 (${dailyReminderConfig.dailyReminderTime})`,
          message: msg,
          timeStr: currentTimeStr,
          personaName: activePersona.name
        });

        if (autoVoiceEnabled) {
          speakText(msg, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
        } else {
          playAudioFeedback('bubble');
        }
      }

      // 2. Evening review alarm check
      const eveningKey = `evening-${now.toDateString()}`;
      if (
        dailyReminderConfig.eveningReviewEnabled &&
        dailyReminderConfig.eveningReviewTime === currentTimeStr &&
        !triggeredTaskIds.current.has(eveningKey)
      ) {
        triggeredTaskIds.current.add(eveningKey);
        const doneCount = schedules.filter((s) => s.status === 'completed').length;
        const reviewText = activePersona.eveningReviewText(doneCount || schedules.length);
        
        setActiveNotification({
          id: `toast-${Date.now()}`,
          type: 'evening_review',
          title: `晚间复盘提醒 (${dailyReminderConfig.eveningReviewTime})`,
          message: reviewText,
          timeStr: currentTimeStr,
          personaName: activePersona.name
        });

        if (autoVoiceEnabled) {
          speakText(reviewText, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
        } else {
          playAudioFeedback('bubble');
        }
      }
    };

    const interval = setInterval(checkAlarms, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [dailyReminderConfig, schedules, activePersona, autoVoiceEnabled]);

  // Test trigger for demonstration
  const triggerManualReminderTest = (priority: SchedulePriority = 'high') => {
    playAudioFeedback('wake');
    const targetSchedule = schedules.find((s) => (s.priority || 'medium') === priority) || schedules[0];
    const pref = dailyReminderConfig.priorityPreferences[priority];
    const offset = pref.offsetMinutes;
    const msg = activePersona.reminderTemplate(targetSchedule?.title || '重要会议', offset);

    setActiveNotification({
      id: `toast-${Date.now()}`,
      type: 'schedule_alarm',
      title: `${priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}优先级日程提醒 · ${targetSchedule?.title || '日程'}`,
      message: msg,
      timeStr: targetSchedule?.time || '15:00',
      priority,
      personaName: activePersona.name
    });

    if (pref.soundAlert && autoVoiceEnabled) {
      speakText(msg, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
    }
  };

  // Initialize draft when voice utterance starts (DeepSeek / Local dual-mode)
  const resetChatWithUtterance = async (utterance: string) => {
    // 1. Instant fallback parse for zero-latency screen transition
    const localSlots = parseScheduleFromUtterance(utterance);
    const initialDraft: Partial<ScheduleItem> = {
      time: localSlots.time || '15:00',
      dateLabel: localSlots.dateLabel || '明天 (周二)',
      title: localSlots.title || '与张总开会',
      location: localSlots.location || '上海虹桥',
      task: localSlots.task || '与张总开会',
      matters: localSlots.matters || '讨论二期项目',
      remindOffset: localSlots.remindOffset || '提前30分钟',
      accentColor: 'blue',
      hasAlarm: true,
      status: 'active'
    };

    setCurrentDraft(initialDraft);

    const initialMessages: ChatMessage[] = [
      {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: '好的，我帮你记下来了。\n这样安排可以吗？',
        scheduleDraft: initialDraft,
        timestamp: Date.now(),
        actionRequired: true
      }
    ];

    setChatMessages(initialMessages);
    setCurrentView('confirmation');
    playAudioFeedback('bubble');

    // 2. If DeepSeek is enabled and configured, run DeepSeek extraction asynchronously
    if (deepSeekConfig.enabled && deepSeekConfig.apiKey.trim()) {
      setIsLlmProcessing(true);
      try {
        const result = await parseWithDeepSeekOrFallback(utterance, undefined, activePersona);
        setLastLlmSource(result.source);
        if (result.slots && Object.keys(result.slots).length > 0) {
          const mergedDraft: Partial<ScheduleItem> = {
            ...initialDraft,
            ...result.slots
          };
          setCurrentDraft(mergedDraft);
          setChatMessages([
            {
              id: `msg-${Date.now()}-ai`,
              sender: 'ai',
              text: result.replyText || '好的，我已通过大模型分析并记下来了。\n这样安排可以吗？',
              scheduleDraft: mergedDraft,
              timestamp: Date.now(),
              actionRequired: true
            }
          ]);
        }
      } catch (err) {
        console.warn('DeepSeek utterance error', err);
        setLastLlmSource('local_fallback');
      } finally {
        setIsLlmProcessing(false);
      }
    } else {
      setLastLlmSource('local_fallback');
      if (autoVoiceEnabled) {
        setTimeout(() => {
          speakText('好的，我帮你记下来了。这样安排可以吗？', {
            pitch: activePersona.speechPitch,
            rate: activePersona.speechRate,
            personaId: activePersonaId
          });
        }, 300);
      }
    }
  };

  // Handle multi-turn corrections (DeepSeek / Local dual-mode)
  const applyModification = async (correctionText: string) => {
    if (!currentDraft) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: correctionText,
      timestamp: Date.now()
    };

    // Instant local slots estimation
    const updatedSlots = parseScheduleFromUtterance(correctionText, currentDraft);
    const newDraft: Partial<ScheduleItem> = {
      ...currentDraft,
      ...updatedSlots
    };

    setCurrentDraft(newDraft);

    let aiReplyText = '好的，我已为你更新相关信息。\n这样安排可以吗？';
    if (correctionText.includes('地点') || correctionText.includes('陆家嘴')) {
      aiReplyText = '好的，我已为你更新地点信息。\n这样安排可以吗？';
    } else if (correctionText.includes('时间') || correctionText.includes('点')) {
      aiReplyText = '好的，我已为你调整了日程时间。\n这样安排可以吗？';
    } else if (correctionText.includes('提醒')) {
      aiReplyText = '好的，提醒时间已为你更新。\n这样安排可以吗？';
    }

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now() + 50}-ai`,
      sender: 'ai',
      text: aiReplyText,
      scheduleDraft: newDraft,
      timestamp: Date.now() + 50,
      actionRequired: true
    };

    setChatMessages((prev) => [...prev, userMsg, aiMsg]);
    playAudioFeedback('bubble');

    // DeepSeek refinement if configured
    if (deepSeekConfig.enabled && deepSeekConfig.apiKey.trim()) {
      setIsLlmProcessing(true);
      try {
        const result = await parseWithDeepSeekOrFallback(correctionText, currentDraft, activePersona);
        setLastLlmSource(result.source);
        if (result.slots && Object.keys(result.slots).length > 0) {
          const refinedDraft: Partial<ScheduleItem> = {
            ...newDraft,
            ...result.slots
          };
          setCurrentDraft(refinedDraft);
          setChatMessages((prev) => {
            const next = [...prev];
            const lastAi = next[next.length - 1];
            if (lastAi && lastAi.sender === 'ai') {
              lastAi.text = result.replyText || lastAi.text;
              lastAi.scheduleDraft = refinedDraft;
            }
            return next;
          });
        }
      } catch (err) {
        console.warn('DeepSeek correction error', err);
        setLastLlmSource('local_fallback');
      } finally {
        setIsLlmProcessing(false);
      }
    } else {
      setLastLlmSource('local_fallback');
      if (autoVoiceEnabled) {
        setTimeout(() => {
          speakText(aiReplyText.replace('\n', ' '), {
            pitch: activePersona.speechPitch,
            rate: activePersona.speechRate,
            personaId: activePersonaId
          });
        }, 300);
      }
    }
  };

  // Confirm schedule
  const confirmDraftSchedule = (): ScheduleItem | null => {
    if (!currentDraft) return null;

    const newItem: ScheduleItem = {
      id: `sched-${Date.now()}`,
      time: currentDraft.time || '15:00',
      dateLabel: currentDraft.dateLabel || '明天 (周二)',
      title: currentDraft.title || '与张总开会',
      location: currentDraft.location || '陆家嘴',
      task: currentDraft.task || '与张总开会',
      matters: currentDraft.matters || '讨论二期项目',
      remindOffset: currentDraft.remindOffset || '提前30分钟',
      accentColor: 'blue',
      hasAlarm: true,
      status: 'active',
      createdAt: Date.now()
    };

    setSchedules((prev) => [newItem, ...prev]);
    setConfirmedItem(newItem);
    playAudioFeedback('success');
    setCurrentView('success');

    if (autoVoiceEnabled) {
      setTimeout(() => {
        speakText(`已为您创建日程：${newItem.title}，我会在事前提醒你。`, {
          pitch: activePersona.speechPitch,
          rate: activePersona.speechRate,
          personaId: activePersonaId
        });
      }, 400);
    }

    return newItem;
  };

  const addSchedule = (item: Omit<ScheduleItem, 'id' | 'createdAt'>): ScheduleItem => {
    const newItem: ScheduleItem = {
      ...item,
      id: `sched-${Date.now()}`,
      createdAt: Date.now()
    };
    setSchedules((prev) => [newItem, ...prev]);
    playAudioFeedback('success');
    return newItem;
  };

  const updateSchedule = (id: string, updates: Partial<ScheduleItem>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    playAudioFeedback('tap');
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        activePersonaId,
        setActivePersonaId,
        activePersona,
        autoVoiceEnabled,
        setAutoVoiceEnabled,
        dailyReminderConfig,
        updateDailyReminderConfig,
        updatePriorityPreference,
        deepSeekConfig,
        updateDeepSeekConfig,
        miniMaxConfig,
        updateMiniMaxConfig,
        isLlmProcessing,
        lastLlmSource,
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        currentDraft,
        setCurrentDraft,
        chatMessages,
        resetChatWithUtterance,
        applyModification,
        confirmDraftSchedule,
        confirmedItem,
        isEveningReviewOpen,
        setIsEveningReviewOpen,
        isManualAddOpen,
        setIsManualAddOpen,
        previewDevice,
        setPreviewDevice,
        activeNotification,
        dismissNotification,
        triggerManualReminderTest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

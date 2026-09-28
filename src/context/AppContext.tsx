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
import { playAudioFeedback, playBase64Audio, speakText } from '../utils/audio';
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
import {
  apiConfirmConversation,
  apiCreateConversation,
  apiCreateSchedule,
  apiDeleteSchedule,
  apiListSchedules,
  apiPutConfig,
  apiTts,
  apiTurnConversation,
  apiUnderstand,
  apiUpdateSchedule,
  BackendConversation,
  getBackendUrl,
  isBackendReachable,
  setBackendUrl,
  BackendActionType,
} from '../services/apiClient';

type BackendStatus = 'checking' | 'online' | 'offline';

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
  /** 后端连接状态（任务书 Phase 4）：checking → online/offline */
  backendStatus: BackendStatus;
  backendUrl: string;
  updateBackendUrl: (url: string) => void;
  recheckBackend: () => Promise<boolean>;
  schedules: ScheduleItem[];
  addSchedule: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => Promise<ScheduleItem>;
  updateSchedule: (id: string, updates: Partial<ScheduleItem>) => void;
  deleteSchedule: (id: string) => void;
  currentDraft: Partial<ScheduleItem> | null;
  setCurrentDraft: React.Dispatch<React.SetStateAction<Partial<ScheduleItem> | null>>;
  chatMessages: ChatMessage[];
  resetChatWithUtterance: (utterance: string) => void;
  applyModification: (correctionText: string) => void;
  confirmDraftSchedule: () => Promise<ScheduleItem | null>;
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

const AppContext = createContext<AppContextType | null>(null);

/** 历史内置演示日程 id（去演示化后仅用于识别并清理旧 mock 缓存） */
const MOCK_SCHEDULE_IDS = new Set(['sched-1', 'sched-2', 'sched-3', 'sched-4', 'sched-5']);

/** 会话流动作是否需要进入澄清视图 */
function needsClarify(action: BackendActionType | boolean | undefined): boolean {
  return action === 'ASK_REQUIRED' || action === 'ASK_OPTIONAL';
}

/** 从后端会话/理解结果取 AI 回复文本 */
function lastAiText(conv: BackendConversation | undefined, fallback: string): string {
  if (!conv) return fallback;
  for (let i = conv.turns.length - 1; i >= 0; i -= 1) {
    if (conv.turns[i].role === 'ai') return conv.turns[i].text;
  }
  return fallback;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [activePersonaId, setActivePersonaId] = useState<PersonaId>('energetic');
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState<boolean>(true);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendUrl, setBackendUrlState] = useState<string>(getBackendUrl());
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem('ai_schedule_local_schedules');
      if (saved) {
        const arr = JSON.parse(saved);
        // 去演示化：清理历史内置 mock；真实数据（后端 id 或用户创建）保留
        if (Array.isArray(arr) && arr.length > 0) {
          const isAllMock = arr.every((it) => MOCK_SCHEDULE_IDS.has(String(it?.id)));
          if (!isAllMock) return arr;
          localStorage.removeItem('ai_schedule_local_schedules');
        }
      }
    } catch { /* ignore */ }
    return [];
  });
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
  /** 当前会话流 id（后端在线时使用，任务书 Phase 4） */
  const convIdRef = useRef<string | null>(null);

  const activePersona = PERSONAS[activePersonaId];

  // 启动探测后端：在线则拉取日程（后端为权威数据源），离线则本地兜底
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isBackendReachable();
      if (cancelled) return;
      setBackendStatus(ok ? 'online' : 'offline');
      if (ok) {
        try {
          const list = await apiListSchedules();
          // 后端为权威数据源：items 存在即覆盖（含空数组，不保留演示数据）
          if (!cancelled && list?.items) {
            setSchedules(list.items);
          }
        } catch (err) {
          console.warn('[backend] 拉取日程列表失败，使用本地数据', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 本地兜底持久化：schedules 变化写入 localStorage（后端在线时后端仍是权威）
  useEffect(() => {
    try {
      localStorage.setItem('ai_schedule_local_schedules', JSON.stringify(schedules));
    } catch { /* ignore */ }
  }, [schedules]);

  /** 重新探测后端（设置页「重新检测」） */
  const recheckBackend = async (): Promise<boolean> => {
    setBackendStatus('checking');
    const ok = await isBackendReachable();
    setBackendStatus(ok ? 'online' : 'offline');
    if (ok) {
      try {
        const list = await apiListSchedules();
        if (list?.items) setSchedules(list.items);
      } catch (err) {
        console.warn('[backend] 拉取日程列表失败', err);
      }
    }
    return ok;
  };

  const updateBackendUrl = (url: string) => {
    const normalized = url.trim().replace(/\/+$/, '');
    setBackendUrl(normalized);
    setBackendUrlState(normalized);
    void recheckBackend();
  };

  /** 语音播报：后端在线时优先走后端 TTS（MiniMax），失败降级浏览器/本地 MiniMax */
  const speakSmart = (text: string, opts?: { pitch?: number; rate?: number }) => {
    if (!text) return;
    if (backendStatus === 'online') {
      apiTtsText(text)
        .then((ok) => {
          if (!ok) speakText(text, { ...opts, personaId: activePersonaId });
        })
        .catch(() => speakText(text, { ...opts, personaId: activePersonaId }));
    } else {
      speakText(text, { ...opts, personaId: activePersonaId });
    }
  };

  const apiTtsText = async (text: string): Promise<boolean> => {
    try {
      const res = await apiTts(text, { personaId: activePersonaId });
      if (res?.audioBase64) {
        playBase64Audio(res.audioBase64);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateDeepSeekConfig = (updates: Partial<DeepSeekConfig>) => {
    setDeepSeekConfig((prev) => {
      const next = { ...prev, ...updates };
      saveStoredDeepSeekConfig(next);
      return next;
    });
    if (backendStatus === 'online') {
      apiPutConfig({ llm: updates }).catch((err) => console.warn('[backend] 同步 LLM 配置失败', err));
    }
    playAudioFeedback('tap');
  };

  const updateMiniMaxConfig = (updates: Partial<MiniMaxConfig>) => {
    setMiniMaxConfig((prev) => {
      const next = { ...prev, ...updates };
      saveStoredMiniMaxConfig(next);
      return next;
    });
    if (backendStatus === 'online') {
      apiPutConfig({ minimax: updates }).catch((err) => console.warn('[backend] 同步 MiniMax 配置失败', err));
    }
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
          speakSmart(msg, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
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
          speakSmart(reviewText, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
        } else {
          playAudioFeedback('bubble');
        }
      }
    };

    const interval = setInterval(checkAlarms, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [dailyReminderConfig, schedules, activePersona, autoVoiceEnabled, backendStatus]);

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
      speakSmart(msg, { pitch: activePersona.speechPitch, rate: activePersona.speechRate });
    }
  };

  // 首轮语音输入 → 后端会话流（任务书 Phase 4）；离线时走本地 NLU + DeepSeek 双模
  const resetChatWithUtterance = async (utterance: string) => {
    // 后端在线：创建会话，由后端完成理解 → 追问 → 卡片（权威链路）
    if (backendStatus === 'online') {
      setIsLlmProcessing(true);
      try {
        const conv = await apiCreateConversation(utterance, activePersonaId);
        convIdRef.current = conv.id;
        const draft: Partial<ScheduleItem> =
          conv.draft && Object.keys(conv.draft).length > 0
            ? (conv.draft as Partial<ScheduleItem>)
            : { status: 'active', hasAlarm: true };
        const replyText = lastAiText(conv, '好的，我帮你记下来了。\n这样安排可以吗？');
        setCurrentDraft(draft);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'ai',
            text: replyText,
            scheduleDraft: draft,
            timestamp: Date.now(),
            actionRequired: conv.action,
          },
        ]);
        // 对话式模式：由首页聊天流承接，视图保持 home（不跳转独立确认页）
        setCurrentView('home');
        setIsLlmProcessing(false);
        playAudioFeedback('bubble');
        if (autoVoiceEnabled) {
          setTimeout(() => speakSmart(replyText.replace(/\n/g, ' ')), 300);
        }
        return;
      } catch (err) {
        console.warn('[backend] 创建会话失败，降级本地', err);
        setIsLlmProcessing(false);
      }
    }

    // 1. Instant fallback parse for zero-latency screen transition
    const localSlots = parseScheduleFromUtterance(utterance);
    const initialDraft: Partial<ScheduleItem> = {
      ...(localSlots.time ? { time: localSlots.time } : {}),
      ...(localSlots.dateLabel ? { dateLabel: localSlots.dateLabel } : {}),
      ...(localSlots.title ? { title: localSlots.title } : {}),
      ...(localSlots.location ? { location: localSlots.location } : {}),
      ...(localSlots.task ? { task: localSlots.task } : {}),
      ...(localSlots.matters ? { matters: localSlots.matters } : {}),
      ...(localSlots.remindOffset ? { remindOffset: localSlots.remindOffset } : {}),
      accentColor: 'blue',
      hasAlarm: true,
      status: 'active'
    };

    setCurrentDraft(initialDraft);

    const initialMessages: ChatMessage[] = [
      {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: '好的，我按你的意思草拟了一条日程。\n这样安排可以吗？确认后我就帮你创建。',
        scheduleDraft: initialDraft,
        timestamp: Date.now(),
        actionRequired: true
      }
    ];

    setChatMessages((prev) => [...prev, ...initialMessages]);
    setCurrentView('home');
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
          setChatMessages((prev) => [
            ...prev,
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
          speakSmart('好的，我帮你记下来了。这样安排可以吗？', {
            pitch: activePersona.speechPitch,
            rate: activePersona.speechRate,
          });
        }, 300);
      }
    }
  };

  // 多轮修正 → 后端会话流/单轮理解（任务书 Phase 4）；离线时本地 NLU + DeepSeek 双模
  const applyModification = async (correctionText: string) => {
    if (!currentDraft) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: correctionText,
      timestamp: Date.now()
    };
    setChatMessages((prev) => [...prev, userMsg]);

    // 后端在线：优先会话流（convIdRef），无会话则单轮理解
    if (backendStatus === 'online') {
      setIsLlmProcessing(true);
      try {
        let conv: BackendConversation | undefined;
        let slots: Partial<ScheduleItem> | undefined;
        let action: BackendActionType | boolean | undefined;
        let replyText: string;

        if (convIdRef.current) {
          conv = await apiTurnConversation(convIdRef.current, correctionText);
          slots = conv.draft && Object.keys(conv.draft).length > 0
            ? (conv.draft as Partial<ScheduleItem>)
            : undefined;
          action = conv.action;
          replyText = lastAiText(conv, '好的，我已为你更新相关信息。\n这样安排可以吗？');
        } else {
          const result = await apiUnderstand(correctionText, currentDraft, activePersonaId);
          slots = result.slots && Object.keys(result.slots).length > 0
            ? result.slots
            : undefined;
          action = result.actionRequired;
          replyText = result.replyText || '好的，我已为你更新相关信息。\n这样安排可以吗？';
        }

        // 用户输入确认词（对/可以/好）→ 后端已创建日程 → 清草稿 + 成功消息入聊天
        if (conv && conv.state === 'created') {
          const createdTitle = (conv.draft && (conv.draft.title || conv.draft.task)) || '新日程';
          setCurrentDraft(null);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}-created`,
              sender: 'ai',
              text: `已为你创建日程：${createdTitle}，我会在事前提醒你。`,
              timestamp: Date.now(),
            },
          ]);
          setCurrentView('home');
          setIsLlmProcessing(false);
          playAudioFeedback('success');
          return;
        }

        const newDraft: Partial<ScheduleItem> = slots || currentDraft;
        setCurrentDraft(newDraft);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-ai`,
            sender: 'ai',
            text: replyText,
            scheduleDraft: newDraft,
            timestamp: Date.now(),
            actionRequired: action,
          },
        ]);
        // 对话式模式：由首页聊天流承接，视图保持 home（不跳转独立确认页）
        setCurrentView('home');
        setIsLlmProcessing(false);
        playAudioFeedback('bubble');
        if (autoVoiceEnabled) {
          setTimeout(() => speakSmart(replyText.replace(/\n/g, ' ')), 300);
        }
        return;
      } catch (err) {
        console.warn('[backend] 修正请求失败，降级本地', err);
        setIsLlmProcessing(false);
      }
    }

    // 本地 fallback：instant local slots estimation
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

    setChatMessages((prev) => [...prev, aiMsg]);
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
          speakSmart(aiReplyText.replace('\n', ' '), {
            pitch: activePersona.speechPitch,
            rate: activePersona.speechRate,
          });
        }, 300);
      }
    }
  };

  // 确认创建 → 后端会话确认/直建（任务书 Phase 4）；离线时本地创建
  const confirmDraftSchedule = async (): Promise<ScheduleItem | null> => {
    if (!currentDraft) return null;

    if (backendStatus === 'online') {
      setIsLlmProcessing(true);
      try {
        let schedule: ScheduleItem;
        if (convIdRef.current) {
          const res = await apiConfirmConversation(convIdRef.current);
          schedule = res.schedule;
          convIdRef.current = null;
        } else {
          schedule = await apiCreateSchedule(currentDraft);
        }
        // 刷新列表（后端为权威）
        try {
          const list = await apiListSchedules();
          if (list?.items) setSchedules(list.items);
        } catch (err) {
          console.warn('[backend] 刷新日程列表失败', err);
        }
        setConfirmedItem(schedule);
        setCurrentDraft(null);
        playAudioFeedback('success');
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-created`,
            sender: 'ai',
            text: `已为你创建日程：${schedule.title}，我会在事前提醒你。`,
            timestamp: Date.now(),
          },
        ]);
        if (autoVoiceEnabled) {
          setTimeout(() => {
            speakSmart(`已为您创建日程：${schedule.title}，我会在事前提醒你。`);
          }, 400);
        }
        setIsLlmProcessing(false);
        return schedule;
      } catch (err) {
        console.warn('[backend] 创建日程失败，降级本地', err);
        setIsLlmProcessing(false);
      }
    }

    if (!currentDraft.time || (!currentDraft.task && !currentDraft.title)) {
      setChatMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, sender: 'ai', text: '还差时间和任务哦～方便告诉我吗？', timestamp: Date.now(), actionRequired: 'ASK_REQUIRED' },
      ]);
      return null;
    }
    const newItem: ScheduleItem = {
      id: `sched-${Date.now()}`,
      time: currentDraft.time || '',
      dateLabel: currentDraft.dateLabel || '',
      title: currentDraft.title || currentDraft.task || '',
      location: currentDraft.location || '',
      task: currentDraft.task || currentDraft.title || '',
      matters: currentDraft.matters || '',
      remindOffset: currentDraft.remindOffset || '',
      accentColor: 'blue',
      hasAlarm: true,
      status: 'active',
      createdAt: Date.now()
    };

    setSchedules((prev) => [newItem, ...prev]);
    setConfirmedItem(newItem);
    setCurrentDraft(null);
    playAudioFeedback('success');
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-created`,
        sender: 'ai',
        text: `已为你创建日程：${newItem.title}，我会在事前提醒你。`,
        timestamp: Date.now(),
      },
    ]);

    if (autoVoiceEnabled) {
      setTimeout(() => {
        speakSmart(`已为您创建日程：${newItem.title}，我会在事前提醒你。`);
      }, 400);
    }

    return newItem;
  };

  const addSchedule = async (item: Omit<ScheduleItem, 'id' | 'createdAt'>): Promise<ScheduleItem> => {
    if (backendStatus === 'online') {
      try {
        const created = await apiCreateSchedule(item);
        setSchedules((prev) => [created, ...prev]);
        playAudioFeedback('success');
        return created;
      } catch (err) {
        console.warn('[backend] 创建日程失败，使用本地 id', err);
      }
    }
    const newItem: ScheduleItem = {
      ...item,
      id: `sched-${Date.now()}`,
      createdAt: Date.now()
    };
    setSchedules((prev) => [newItem, ...prev]);
    playAudioFeedback('success');
    return newItem;
  };

  const updateSchedule = async (id: string, updates: Partial<ScheduleItem>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    if (backendStatus === 'online') {
      try {
        await apiUpdateSchedule(id, updates);
      } catch (err) {
        console.warn('[backend] 局部修改同步失败', err);
      }
    }
  };

  const deleteSchedule = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    if (backendStatus === 'online') {
      try {
        await apiDeleteSchedule(id);
      } catch (err) {
        console.warn('[backend] 删除日程同步失败', err);
      }
    }
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
        backendStatus,
        backendUrl,
        updateBackendUrl,
        recheckBackend,
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

/**
 * 后端 API 客户端（任务书 Phase 4：前端走后端 API）。
 *
 * 后端地址可配置：默认 http://localhost:4599/api/v1，
 * 可在「设置 → 后端连接」修改（localStorage 持久化）。
 *
 * 所有请求失败时抛出带 code/status 的 Error，调用方按「后端优先、本地降级」策略处理。
 */
import { ScheduleItem, PersonaId } from '../types';

export const DEFAULT_BACKEND_URL = 'http://localhost:4599/api/v1';
const BACKEND_URL_KEY = 'ai_schedule_backend_url';

export type BackendActionType = 'ASK_REQUIRED' | 'ASK_OPTIONAL' | 'SHOW_SCHEDULE_CARD' | 'NONE';

/** PHASE 4-D · D3：后端确定性冲突检测结果（程序计算，非 LLM 判断） */
export interface BackendConflictEntry {
  scheduleId: string;
  date: string;
  time: string;
  task: string;
  location: string;
}

export interface BackendConflictResult {
  hasConflict: boolean;
  level: 'none' | 'exact' | 'nearby';
  conflicts: BackendConflictEntry[];
}

export interface BackendUnderstandResult {
  state: string;
  slots: Partial<ScheduleItem>;
  missingRequired: string[];
  missingOptional: string[];
  replyText: string;
  /** PHASE 4-E · F1：单轮确认创建由确定性规则执行（非 LLM/NLU 输出） */
  source: 'llm' | 'local' | 'deterministic';
  actionRequired: BackendActionType;
}

export interface BackendConversation {
  id: string;
  intent?: string;
  intentConfidence?: number;
  state: string;
  personaId: PersonaId;
  draft: Partial<ScheduleItem>;
  missing: string[];
  turns: { role: 'user' | 'ai'; text: string; at: number }[];
  source: 'llm' | 'local';
  action: BackendActionType;
  /** PHASE 4-D · D3：冲突检测结果（卡片阶段/confirm 时由后端计算） */
  conflict?: BackendConflictResult;
  createdAt: number;
  updatedAt: number;
}

export function getBackendUrl(): string {
  try {
    const saved = localStorage.getItem(BACKEND_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch { /* ignore */ }
  return DEFAULT_BACKEND_URL;
}

export function setBackendUrl(url: string) {
  const normalized = url.trim().replace(/\/+$/, '');
  if (normalized) {
    try {
      localStorage.setItem(BACKEND_URL_KEY, normalized);
    } catch { /* ignore */ }
  }
}

export function resetBackendUrl() {
  try {
    localStorage.removeItem(BACKEND_URL_KEY);
  } catch { /* ignore */ }
}

export class BackendError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getBackendUrl().replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error?.message || `后端请求失败（HTTP ${res.status}）`;
    const code = data?.error?.code || 'BACKEND_ERROR';
    throw new BackendError(message, code, res.status);
  }
  return data as T;
}

/** 后端连通性探测（短超时，用于启动与设置页检测） */
export async function isBackendReachable(): Promise<boolean> {
  try {
    const base = getBackendUrl().replace(/\/+$/, '');
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiHealth(): Promise<{ status: string; version?: string; features?: Record<string, boolean> }> {
  return request('/health');
}

/** 单轮理解：POST /understand（任务书 §9） */
export async function apiUnderstand(
  utterance: string,
  currentDraft?: Partial<ScheduleItem>,
  personaId?: PersonaId,
): Promise<BackendUnderstandResult> {
  return request('/understand', {
    method: 'POST',
    body: JSON.stringify({ utterance, currentDraft, personaId }),
  });
}

/** 新建会话：POST /conversations */
export async function apiCreateConversation(utterance: string, personaId?: PersonaId): Promise<BackendConversation> {
  return request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ utterance, personaId }),
  });
}

/** 推进一轮：POST /conversations/:id/turn */
export async function apiTurnConversation(id: string, utterance: string): Promise<BackendConversation> {
  return request(`/conversations/${id}/turn`, {
    method: 'POST',
    body: JSON.stringify({ utterance }),
  });
}

/** 确认创建：POST /conversations/:id/confirm */
export async function apiConfirmConversation(id: string): Promise<{ conversation: BackendConversation; schedule: ScheduleItem }> {
  return request(`/conversations/${id}/confirm`, { method: 'POST' });
}

export interface ScheduleListParams {
  date?: string;
  status?: string;
  from?: string;
  to?: string;
}

/** 日程列表：GET /schedules */
export async function apiListSchedules(params?: ScheduleListParams): Promise<{ items: ScheduleItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set('date', params.date);
  if (params?.status) qs.set('status', params.status);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const query = qs.toString();
  return request(`/schedules${query ? `?${query}` : ''}`);
}

/** 创建日程：POST /schedules */
export async function apiCreateSchedule(item: Partial<ScheduleItem>): Promise<ScheduleItem> {
  return request('/schedules', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

/** 局部修改：PATCH /schedules/:id（只更新传入字段，任务书 §7） */
export async function apiUpdateSchedule(id: string, updates: Partial<ScheduleItem>): Promise<ScheduleItem> {
  return request(`/schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** 删除日程：DELETE /schedules/:id */
export async function apiDeleteSchedule(id: string): Promise<{ ok: boolean; id: string }> {
  return request(`/schedules/${id}`, { method: 'DELETE' });
}

/** 活跃提醒：GET /reminders/active（scheduleId 供"查看详情"定位日历日程） */
export async function apiGetActiveReminders(): Promise<{ items: { id: string; type: string; title: string; message: string; dueAt: number; priority?: string; scheduleId?: string }[]; total: number }> {
  return request('/reminders/active');
}

/** 标记提醒已处理：PATCH /reminders/:id/dismiss */
export async function apiDismissReminder(id: string): Promise<{ ok: boolean; id: string }> {
  return request(`/reminders/${id}/dismiss`, { method: 'PATCH' });
}

/** 配置读取：GET /config（Key 脱敏） */
export async function apiGetConfig(): Promise<any> {
  return request('/config');
}

/** 配置更新：PUT /config */
export async function apiPutConfig(patch: Record<string, unknown>): Promise<any> {
  return request('/config', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/** TTS：POST /voice/tts { text, personaId? | voice? } → { audioBase64, format } */
export async function apiTts(text: string, opts?: { personaId?: PersonaId; voice?: string }): Promise<{ audioBase64: string; format: string; source: string }> {
  return request('/voice/tts', {
    method: 'POST',
    body: JSON.stringify({
      text,
      ...(opts?.personaId ? { personaId: opts.personaId } : {}),
      ...(opts?.voice ? { voice: opts.voice } : {}),
    }),
  });
}

/** ASR：POST /voice/asr { audioBase64, fileName? } */
export async function apiAsr(audioBase64: string, fileName?: string): Promise<{ text: string; source: string }> {
  return request('/voice/asr', {
    method: 'POST',
    body: JSON.stringify({ audioBase64, fileName }),
  });
}

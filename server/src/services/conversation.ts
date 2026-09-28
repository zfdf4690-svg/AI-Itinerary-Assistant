/**
 * 会话状态机（PRD §5）：① 输入 → ② AI理解 → ③ 补充信息 → ④ 日程卡片 → ⑤ 已创建。
 * 修改不是独立主状态：日程卡片 → 用户自然语言修改 → AI 局部字段更新 → 更新日程卡片。
 *
 * 关键规则（PRD §4/§15）：
 * - 时间 + 任务为必填；缺失必须澄清（不阻塞）。
 * - 地点/事项/提醒为可选；缺失时委婉追问，用户拒绝则用已有信息创建。
 * - 局部修改只更新对应字段，修改后重新展示卡片并再次请求确认。
 */
import { ActionType, Conversation, ConversationState, ParsedSlots, ScheduleItem, UnderstandResult } from '../types.js';
import { genId, Repos } from '../db/repos.js';
import { getPersona } from './personas.js';
import { parseWithLLMOrLocal } from './llm.js';
import { checkCompleteness, extractPreferenceFromText } from './nlu.js';
import { isRefusal } from '../utils/date.js';
import { buildScheduleFromSlots, validateRequiredFields } from './schedule.js';
import { recordEntities, recordEvent, setPreference } from './memory.js';

const FIELD_NAMES: Record<string, string> = {
  time: '时间',
  date: '日期',
  location: '地点',
  task: '任务',
  title: '标题',
  matters: '事项',
  remindOffset: '提醒',
  remindOffsetMinutes: '提醒',
  priority: '优先级',
};

export interface TurnOptions {
  utterance: string;
  personaId?: string;
}

function now(): number {
  return Date.now();
}

function lastUserText(conv: Conversation): string {
  for (let i = conv.turns.length - 1; i >= 0; i -= 1) {
    if (conv.turns[i].role === 'user') return conv.turns[i].text;
  }
  return '';
}

/** 确认意图识别：用户明确说"对/可以/好/确认"等肯定词（整句精确匹配，避免误伤修改句） */
export function isAffirmative(text: string): boolean {
  const t = text.trim().replace(/[，。！？、,.!?\s]+/g, '');
  return /^(对|对的|是|是的|可以|可以了|行|行吧|好|好的|好呀|好滴|没问题|确认|确定|就这样|就这么定|嗯|嗯嗯|ok|okay|sure|yes|y)(啊|呀|吧|呢|的|了|哦|啦)?((可以|行|对|好|确认|确定|就这样|没问题))?$/i.test(t);
}

function changedFields(prev: Partial<ScheduleItem>, next: Partial<ScheduleItem>): string[] {
  const keys = ['time', 'date', 'location', 'task', 'matters', 'remindOffset', 'remindOffsetMinutes', 'priority'];
  return keys.filter((k) => {
    const a = prev[k as keyof Partial<ScheduleItem>];
    const b = next[k as keyof Partial<ScheduleItem>];
    return a !== b && b !== undefined && b !== null && b !== '';
  }).map((k) => FIELD_NAMES[k] || k);
}

/** 依据完整性判断下一步状态、回复与前端动作。
 *  追问策略（PRD §4）：必填缺失必须澄清；可选字段只追问最有价值的一项，
 *  用户补充或拒绝后即进入卡片，不再连环追问。 */
function decideNext(
  personaId: string,
  draft: Partial<ScheduleItem>,
  parsedReply: string | undefined,
  prevDraft: Partial<ScheduleItem>,
  prevState: ConversationState,
): { state: ConversationState; reply: string; missing: string[]; action: ActionType } {
  const { missingRequired, missingOptional } = checkCompleteness(draft as ParsedSlots);
  const persona = getPersona(personaId);

  if (missingRequired.length > 0) {
    return {
      state: 'awaiting_clarify',
      reply: persona.prompt.askRequired(missingRequired),
      missing: missingRequired,
      action: 'ASK_REQUIRED',
    };
  }
  // 可选字段：仅在刚进入对话（或上一轮不在追问态）时询问一次
  if (missingOptional.length > 0 && prevState !== 'awaiting_supplement') {
    return {
      state: 'awaiting_supplement',
      reply: parsedReply || persona.prompt.askOptional(missingOptional[0]),
      missing: missingOptional,
      action: 'ASK_OPTIONAL',
    };
  }
  const changed = changedFields(prevDraft, draft);
  return {
    state: 'card_ready',
    reply: parsedReply || (changed.length > 0 ? persona.prompt.updated(changed) : persona.prompt.confirmCard),
    missing: [],
    action: 'SHOW_SCHEDULE_CARD',
  };
}

/** 合并解析槽位到草稿（仅更新有效字段） */
function mergeDraft(draft: Partial<ScheduleItem>, slots: Partial<ScheduleItem>): Partial<ScheduleItem> {
  const next = { ...draft };
  const keys = ['time', 'date', 'dateLabel', 'task', 'title', 'location', 'matters', 'remindOffset', 'remindOffsetMinutes', 'priority', 'hasAlarm', 'status'] as const;
  for (const k of keys) {
    const v = (slots as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== '') {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  return next;
}

/** 新建会话并执行首轮理解 */
export async function createConversation(
  repos: Repos,
  options: TurnOptions,
): Promise<Conversation> {
  const conv: Conversation = {
    id: genId('conv'),
    state: 'input',
    personaId: (options.personaId === 'energetic' || options.personaId === 'gentle' || options.personaId === 'professional')
      ? options.personaId
      : 'energetic',
    draft: {},
    missing: [],
    turns: [],
    source: 'local',
    action: 'NONE',
    createdAt: now(),
    updatedAt: now(),
  };
  repos.conversations.push(conv);
  await runTurn(repos, conv, options.utterance);
  return conv;
}

/** 推进一轮（核心状态机） */
export async function runTurn(repos: Repos, conv: Conversation, utterance: string): Promise<Conversation> {
  conv.turns.push({ role: 'user', text: utterance, at: now() });

  const persona = getPersona(conv.personaId);

  // 已创建状态收到新输入 → 开始新一轮日程理解
  if (conv.state === 'created') {
    conv.draft = {};
    conv.missing = [];
    conv.state = 'input';
  }

  // 用户确认意图：草稿必填完整 → 直接确认创建（纯对话流：不出卡片，确认后才创建）
  if (isAffirmative(utterance)) {
    const validation = validateRequiredFields(conv.draft);
    if (validation.ok) {
      const confirmed = await confirmConversation(repos, conv);
      if ('schedule' in confirmed) {
        return confirmed.conv;
      }
      // 校验失败（理论上必填已满足）→ 走正常流程
    }
  }

  const refusal = isRefusal(utterance);
  let reply: string;

  if (refusal) {
    // 用户拒绝/终止补充（PRD §4：AI 可以询问，但不能因为用户不愿补充可选信息而阻塞创建）
    const { missingRequired } = checkCompleteness(conv.draft as ParsedSlots);
    if (missingRequired.length > 0) {
      // 必填（时间/任务）缺失时不可省略，继续澄清
      conv.state = 'awaiting_clarify';
      conv.missing = missingRequired;
      conv.action = 'ASK_REQUIRED';
      reply = conv.draft.task || conv.draft.time
        ? persona.prompt.askRequired(missingRequired)
        : persona.prompt.welcome;
    } else {
      conv.state = 'card_ready';
      conv.missing = [];
      conv.action = 'SHOW_SCHEDULE_CARD';
      reply = persona.prompt.refuseAccepted;
    }
  } else {
    // ② AI理解：LLM 优先，本地 NLU 兜底
    const prevDraft = { ...conv.draft };
    const prevState = conv.state;
    const result = await parseWithLLMOrLocal(utterance, conv.draft as ParsedSlots, persona, repos.runtimeConfig.llm);
    conv.source = result.source;
    conv.draft = mergeDraft(conv.draft, result.slots as Partial<ScheduleItem>);

    const decision = decideNext(conv.personaId, conv.draft, result.replyText, prevDraft, prevState);
    conv.state = decision.state;
    conv.missing = decision.missing;
    conv.action = decision.action;
    reply = decision.reply;
  }

  // Preference Memory（任务书 §21）：仅识别用户明确表达的偏好（如「以后会议都提前30分钟提醒我」）
  if (!refusal) {
    tryRecordPreference(repos, utterance);
  }

  conv.turns.push({ role: 'ai', text: reply, at: now() });
  conv.updatedAt = now();
  repos.saveConversations();
  return conv;
}

/** 从用户语句识别明确偏好并写入 Preference Memory（任务书 §21：不擅自推断） */
function tryRecordPreference(repos: Repos, text: string): void {
  const pref = extractPreferenceFromText(text);
  if (pref) {
    setPreference(repos, pref.key, pref.value);
  }
}

/** 确认创建日程（④ → ⑤） */
export async function confirmConversation(repos: Repos, conv: Conversation): Promise<{ conv: Conversation; schedule: ScheduleItem } | { conv: Conversation; error: string; missingRequired: string[] }> {
  const validation = validateRequiredFields(conv.draft);
  if (!validation.ok) {
    const persona = getPersona(conv.personaId);
    conv.state = 'awaiting_clarify';
    conv.missing = validation.missingRequired || [];
    conv.action = 'ASK_REQUIRED';
    const reply = persona.prompt.askRequired(validation.missingRequired || []);
    conv.turns.push({ role: 'ai', text: reply, at: now() });
    conv.updatedAt = now();
    repos.saveConversations();
    return { conv, error: '缺少必填字段', missingRequired: validation.missingRequired || [] };
  }

  const schedule = buildScheduleFromSlots(repos, conv.draft as ParsedSlots);
  repos.schedules.unshift(schedule);
  repos.saveSchedules();

  // Memory Layer：Event + Entity
  recordEvent(repos, schedule);
  recordEntities(repos, lastUserText(conv), { location: schedule.location, task: schedule.task });

  conv.state = 'created';
  conv.action = 'NONE';
  const persona = getPersona(conv.personaId);
  const reply = persona.prompt.confirmCreated(schedule.title);
  conv.turns.push({ role: 'ai', text: reply, at: now() });
  conv.updatedAt = now();
  repos.saveConversations();

  return { conv, schedule };
}

/** 单轮理解（无会话状态，供前端一次性调用） */
export async function understandOneShot(
  repos: Repos,
  input: { utterance: string; currentDraft?: Partial<ScheduleItem>; personaId?: string },
): Promise<UnderstandResult> {
  const persona = getPersona(input.personaId);
  const refusal = isRefusal(input.utterance);
  const draft = input.currentDraft ? { ...input.currentDraft } : {};

  if (refusal && input.currentDraft) {
    const { missingRequired, missingOptional } = checkCompleteness(draft as ParsedSlots);
    const reply = missingRequired.length > 0
      ? persona.prompt.askRequired(missingRequired)
      : persona.prompt.refuseAccepted;
    return {
      state: missingRequired.length > 0 ? 'awaiting_clarify' : 'card_ready',
      slots: draft,
      missingRequired,
      missingOptional,
      replyText: reply,
      source: 'local',
      actionRequired: missingRequired.length > 0 ? 'ASK_REQUIRED' : 'SHOW_SCHEDULE_CARD',
    };
  }

  const result = await parseWithLLMOrLocal(input.utterance, draft as ParsedSlots, persona, repos.runtimeConfig.llm);
  const merged = mergeDraft(draft, result.slots as Partial<ScheduleItem>);
  const { missingRequired, missingOptional } = checkCompleteness(merged as ParsedSlots);
  // 已有草稿视为进行中的修改流程 → 不追问可选字段；全新输入 → 最多追问一次
  const prevState = draft && Object.keys(draft).length > 0 ? 'card_ready' : 'input';
  const decision = decideNext(persona.id, merged, result.replyText, draft, prevState);

  // Preference Memory（任务书 §21）：仅识别用户明确表达的偏好
  if (!refusal) {
    tryRecordPreference(repos, input.utterance);
  }

  return {
    state: decision.state,
    slots: merged,
    missingRequired,
    missingOptional,
    replyText: decision.reply,
    source: result.source,
    actionRequired: decision.action,
  };
}

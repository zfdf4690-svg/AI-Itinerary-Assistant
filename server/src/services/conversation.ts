/**
 * 会话状态机（PRD §5；PHASE 4-B 升级）：① 输入 → Intent Router → 分派。
 *
 * PHASE 4-B 架构：
 *   User Input + Conversation Context
 *       ↓ Intent Router（规则 + Context 优先，LLM 辅助）
 *       ↓ ConversationIntent（schedule_create / modify / confirm / cancel / general_chat）
 *       ↓ 按 Intent 进入不同处理路径
 *
 * 关键规则：
 * - Intent（用户想做什么）与 Action（系统下一步做什么）分离。
 * - 多轮输入复用同一 Conversation（不每轮重建），turns 完整保存。
 * - general_chat 绝不进入 Schedule NLU、绝不生成草稿/卡片。
 * - schedule_confirm 仅在「存在待确认草稿 + 用户明确肯定」时触发创建。
 * - schedule_cancel 仅在有进行中草稿的上下文中触发，清草稿但保留会话。
 */
import { ActionType, Conversation, ParsedSlots, ScheduleItem, UnderstandResult } from '../types.js';
import { genId, Repos } from '../db/repos.js';
import { getPersona } from './personas.js';
import { parseWithLLMOrLocal, generateReplyWithContext } from './llm.js';
import { checkCompleteness, extractPreferenceFromText } from './nlu.js';
import { isRefusal } from '../utils/date.js';
import { buildScheduleFromSlots, validateRequiredFields } from './schedule.js';
import { recordEntities, recordEvent, setPreference } from './memory.js';
import { routeIntent } from './intentRouter.js';

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
  prevState: Conversation['state'],
): { state: Conversation['state']; reply: string; missing: string[]; action: ActionType } {
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

/** 新建会话并执行首轮理解（Conversation 一旦创建，多轮输入持续复用） */
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
    intent: 'general_chat',
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

/** 推进一轮（核心状态机：Intent Router 分派） */
export async function runTurn(repos: Repos, conv: Conversation, utterance: string): Promise<Conversation> {
  conv.turns.push({ role: 'user', text: utterance, at: now() });

  const persona = getPersona(conv.personaId);

  // 已创建状态收到新输入 → 开始新一轮日程理解（保留会话本身，turns 持续累积）
  if (conv.state === 'created') {
    conv.draft = {};
    conv.missing = [];
    conv.state = 'input';
  }

  // ① Intent Router：User Input + Conversation Context → Intent
  let { intent, confidence } = routeIntent(utterance, conv);
  conv.intent = intent;
  conv.intentConfidence = confidence;

  // ② schedule_confirm：存在待确认草稿 + 用户明确肯定 → 直接创建
  if (intent === 'schedule_confirm') {
    const validation = validateRequiredFields(conv.draft);
    if (validation.ok) {
      const confirmed = await confirmConversation(repos, conv);
      if ('schedule' in confirmed) {
        return confirmed.conv; // confirmConversation 已写入 ai turn + state=created
      }
    }
    // 必填不完整（理论上罕见）：继续澄清
    conv.state = 'awaiting_clarify';
    conv.missing = validation.missingRequired || [];
    conv.action = 'ASK_REQUIRED';
    const reply = persona.prompt.askRequired(validation.missingRequired || []);
    conv.turns.push({ role: 'ai', text: reply, at: now() });
    conv.updatedAt = now();
    repos.saveConversations();
    return conv;
  }

  // ③ schedule_cancel：取消当前创建流程（清草稿，保留会话）
  if (intent === 'schedule_cancel') {
    conv.draft = {};
    conv.missing = [];
    conv.state = 'input';
    conv.action = 'NONE';
    const reply = persona.prompt.cancelAccepted;
    conv.turns.push({ role: 'ai', text: reply, at: now() });
    conv.updatedAt = now();
    repos.saveConversations();
    return conv;
  }

  // ④ general_chat：普通闲聊 —— 绝不进入 Schedule NLU、绝不生成草稿/卡片；
  //    回复由 Response Generator 基于完整 Conversation Context 生成，模板仅作 LLM 失败兜底
  if (intent === 'general_chat') {
    conv.state = 'chatting';
    conv.action = 'NONE';
    // 保留既有 draft（若有），上下文不丢；本轮只做闲聊回复
    const llmReply = await generateReplyWithContext({
      persona,
      llmConfig: repos.runtimeConfig.llm,
      intent,
      state: 'chatting',
      action: 'NONE',
      draft: conv.draft as Record<string, unknown>,
      missing: [],
      turns: conv.turns.map((t) => ({ role: t.role, text: t.text })),
      latestUtterance: utterance,
    });
    const reply = llmReply || persona.prompt.generalChat;
    conv.turns.push({ role: 'ai', text: reply, at: now() });
    conv.updatedAt = now();
    repos.saveConversations();
    return conv;
  }

  // ⑤ schedule_create / schedule_modify → Schedule NLU 解析（LLM 优先，Local 兜底）
  const refusal = isRefusal(utterance);
  let reply: string;

  if (refusal) {
    // 用户拒绝/终止补充（PRD §4：AI 可以询问，但不能因为用户不愿补充可选信息而阻塞创建）
    const { missingRequired } = checkCompleteness(conv.draft as ParsedSlots);
    if (missingRequired.length > 0) {
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
    const prevDraft = { ...conv.draft };
    const prevState = conv.state;
    const result = await parseWithLLMOrLocal(utterance, conv.draft as ParsedSlots, persona, repos.runtimeConfig.llm);
    conv.source = result.source;

    // 模糊输入（规则 confidence 低）且 LLM 判定为闲聊 → 回流 general_chat（不 merge slots）
    if (confidence <= 0.7 && result.intent === 'general_chat') {
      conv.intent = 'general_chat';
      conv.state = 'chatting';
      conv.action = 'NONE';
      const chatReply = (await generateReplyWithContext({
        persona,
        llmConfig: repos.runtimeConfig.llm,
        intent: 'general_chat',
        state: 'chatting',
        action: 'NONE',
        draft: conv.draft as Record<string, unknown>,
        missing: [],
        turns: conv.turns.map((t) => ({ role: t.role, text: t.text })),
        latestUtterance: utterance,
      })) || persona.prompt.generalChat;
      conv.turns.push({ role: 'ai', text: chatReply, at: now() });
      conv.updatedAt = now();
      repos.saveConversations();
      return conv;
    }

    // LLM 意图辅助修正（规则已优先；此处仅修正低置信度的 create/modify 二选一）
    if (result.intent === 'schedule_modify' && confidence < 0.9 && Object.keys(conv.draft).length > 0) {
      conv.intent = 'schedule_modify';
      conv.intentConfidence = 0.85;
    }

    conv.draft = mergeDraft(conv.draft, result.slots as Partial<ScheduleItem>);
    const decision = decideNext(conv.personaId, conv.draft, result.replyText, prevDraft, prevState);
    conv.state = decision.state;
    conv.missing = decision.missing;
    conv.action = decision.action;
    // PHASE 4-C：Response Generator —— 基于完整对话上下文生成自然回复；模板仅兜底
    reply = (await generateReplyWithContext({
      persona,
      llmConfig: repos.runtimeConfig.llm,
      intent: conv.intent,
      state: decision.state,
      action: decision.action,
      draft: conv.draft as Record<string, unknown>,
      missing: decision.missing,
      turns: conv.turns.map((t) => ({ role: t.role, text: t.text })),
      latestUtterance: utterance,
      facts: ['日程尚未创建，正在等待用户确认'],
    })) || decision.reply;
  }

  // Preference Memory（任务书 §21）：仅识别用户明确表达的偏好
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
  conv.intent = 'schedule_confirm';
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

  // Intent Router（无会话上下文 → 用草稿模拟上下文）
  const pseudoConv = input.currentDraft && Object.keys(input.currentDraft).length > 0
    ? ({ state: 'awaiting_supplement', draft: input.currentDraft } as Conversation)
    : undefined;
  const { intent } = routeIntent(input.utterance, pseudoConv);

  // general_chat：绝不进 NLU
  if (intent === 'general_chat' && !input.currentDraft) {
    return {
      state: 'chatting',
      slots: {},
      missingRequired: [],
      missingOptional: [],
      replyText: persona.prompt.generalChat,
      source: 'local',
      actionRequired: 'NONE',
    };
  }

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

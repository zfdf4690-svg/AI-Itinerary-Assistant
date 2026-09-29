/**
 * Intent Router（PHASE 4-B）：User Input + Conversation Context → ConversationIntent。
 *
 * 设计原则（任务书第八/九/十八节）：
 * - 意图判断必须结合上下文：确认/取消/修改优先走规则 + Context；
 * - general_chat 绝不进入 Schedule NLU；
 * - LLM 可提供 intent 作为辅助，但规则命中（confirm/cancel/问候）时以规则为准。
 */
import { Conversation, ConversationIntent, ConversationState } from '../types.js';

export interface IntentRoutingResult {
  intent: ConversationIntent;
  confidence: number;
}

/** 会话处于"进行中"（可继续多轮）的状态集合 */
const ACTIVE_STATES: ConversationState[] = [
  'input',
  'understanding',
  'awaiting_clarify',
  'awaiting_supplement',
  'card_ready',
];

/** 确认词（整句精确匹配，避免误伤修改句） */
const AFFIRM_RE =
  /^(对|对的|是|是的|可以|可以了|行|行吧|好|好的|好呀|好滴|没问题|确认|确定|就这样|就这么定|嗯|嗯嗯|ok|okay|sure|yes|y)(啊|呀|吧|呢|的|了|哦|啦)?((可以|行|对|好|确认|确定|就这样|没问题))?$/i;

/** 显式"确认创建"动作短语（独立于纯确认词；有草稿必填完整时 → 确认，未就绪 → 继续创建流程） */
const DIRECT_CONFIRM_RE =
  /^(直接创建|直接确认|确认创建|直接建|立即创建|创建吧|直接创建吧|确认创建吧|建吧|就这么办|按这个(来|创建)|照这个(来|创建)|就这样创建|现在创建|直接安排|安排吧|好，创建|好，直接创建|直接帮我创建|帮我创建吧|帮我直接创建)([！!。?？\s]*)$/;

/** 取消词：取消当前创建流程 */
const CANCEL_RE =
  /^(算了|不用了?|取消|不安排了?|先不要了?|暂时?不用|先不用|不要了|不搞了|算了算了|撤了?|不要了不要了)([，,。！!？?\s]*)$/;

/** 纯问候/闲聊（无日程信号） */
const GREETING_RE =
  /^(你好|您好|hello|hi|嗨|哈喽|早上好|下午好|晚上好|你好呀|您好呀)([！!。?？\s]*)$/i;

/** 自我介绍/能力询问（必须整句命中，避免"介绍下日程"误伤） */
const INTRO_RE =
  /^(介绍下你自己|介绍一下你自己|介绍下你|你是谁|你叫什么|你叫什么名字|你能做什么|你会做什么|你有什么功能|你能干什么|你是谁呀|介绍你自己|做个自我介绍|介绍一下你自己吧|介绍下你自己吧)([！!。?？\s]*)$/;

/** 感谢/道别等社交性表达 */
const SOCIAL_RE =
  /^(谢谢|谢谢你|感谢|多谢|辛苦了|再见|拜拜|晚安|好的谢谢|谢谢你啦)([！!。?？\s]*)$/;

/** 明确日程创建信号：时间词或日程动词 */
const SCHEDULE_SIGNAL_RE =
  /(今天|明天|后天|大后天|下周|这周|周[一二三四五六日天]|\d{1,2}点|\d{1,2}:\d{2}|\d{1,2}月\d{1,2}日|上午|下午|晚上|中午|凌晨|开会|会议|约|安排|提醒我|记一下|帮我安排|见面|聚餐|吃饭|喝咖啡|拜访|面试|出差|行程|日程|几点)/;

/** 修改/补充信号：命中即视为对当前 draft 的修改或字段补充 */
const MODIFY_SIGNAL_RE =
  /(改到|改成|改为|换成|换到|移到|挪到|地点|位置|时间|日期|提醒|事项|不是.*是|补充|加上|加个|加上个|提前|延后|推迟|取消.*提醒)/;

/** 纯补充值（在陆家嘴 / 下午4点 / 提前30分钟 / 事项是X）——无显式"修改"词，但对已有 draft 是字段补充 */
const SUPPLEMENT_SIGNAL_RE =
  /^(在|去|到|改成|改为|是|就是|设成|设置为)?\s*(.*)$/;

/** 判断是否存在待确认草稿（必填完整） */
function draftReady(conv: Conversation | undefined): boolean {
  if (!conv) return false;
  const d = conv.draft || {};
  return Boolean(d.time && (d.task || d.title));
}

/** 判断当前会话是否有进行中的草稿（任何字段） */
function hasDraft(conv: Conversation | undefined): boolean {
  return Boolean(conv && conv.draft && Object.keys(conv.draft).length > 0);
}

/**
 * 主入口：结合上下文路由意图。
 * @param text 用户本轮输入
 * @param conv 当前 Conversation（无则视为新会话）
 * @param llmIntent 可选的 LLM 意图（辅助，规则优先）
 */
export function routeIntent(
  text: string,
  conv?: Conversation,
  llmIntent?: ConversationIntent,
): IntentRoutingResult {
  const t = (text || '').trim();
  const active = Boolean(conv && ACTIVE_STATES.includes(conv.state));
  const ready = draftReady(conv);
  const hasD = hasDraft(conv);

  // ---- 1. 确认意图（必须有待确认草稿；规则优先）----
  if (active && ready && (AFFIRM_RE.test(t) || DIRECT_CONFIRM_RE.test(t))) {
    return { intent: 'schedule_confirm', confidence: 0.97 };
  }
  // 显式"确认创建"短语但草稿未就绪（如缺必填）→ 继续创建流程，由状态机澄清必填字段，
  // 绝不落到 general_chat / 闲聊。
  if (active && hasD && DIRECT_CONFIRM_RE.test(t)) {
    return { intent: 'schedule_create', confidence: 0.9 };
  }

  // ---- 2. 取消意图（必须有进行中的草稿上下文；规则优先）----
  if (active && hasD && CANCEL_RE.test(t)) {
    // 「不用了」是拒绝补充表达而非取消：任何进行中状态（追问可选/卡片/澄清）都保留草稿，
    // 由 conversation.ts 的 refusal 分支处理（进入/保持 card_ready），符合任务书 Test 06 与回归语义。
    if (/^不用了?[，。！!？?\s]*$/.test(t)) {
      return { intent: 'schedule_create', confidence: 0.85 };
    }
    return { intent: 'schedule_cancel', confidence: 0.97 };
  }

  // ---- 3. 修改/补充意图（必须有草稿；规则优先）----
  if (active && hasD) {
    // 明确的修改信号词
    if (MODIFY_SIGNAL_RE.test(t)) {
      return { intent: 'schedule_modify', confidence: 0.94 };
    }
    // 字段值补充（"在陆家嘴"、"下午4点"、"提前30分钟"）：长度短、含补充关键词
    if (
      /^(在|去|到|改成|改为|是|就是|设成|设置为)/.test(t) ||
      /^(上午|下午|晚上|中午|凌晨|\d{1,2}点|\d{1,2}:\d{2})/.test(t) ||
      /^(提前|延后|推迟)\s*\d/.test(t) ||
      /(事项|议题|内容)\s*(是|为|：|:)/.test(t)
    ) {
      return { intent: 'schedule_modify', confidence: 0.92 };
    }
  }

  // ---- 4. general_chat（新会话或无草稿时；规则优先，绝不进 NLU）----
  if (GREETING_RE.test(t) || INTRO_RE.test(t) || SOCIAL_RE.test(t)) {
    return { intent: 'general_chat', confidence: 0.98 };
  }
  // 无草稿上下文时的取消表达 → 礼貌闲聊（没有可取消的日程）
  if (!hasD && CANCEL_RE.test(t)) {
    return { intent: 'general_chat', confidence: 0.9 };
  }
  // 确认词但无草稿 → 无法确认，走普通对话（不当作日程处理）
  if (!hasD && AFFIRM_RE.test(t)) {
    return { intent: 'general_chat', confidence: 0.85 };
  }

  // ---- 5. schedule_create（新会话或有草稿但无修改信号 → 新日程/继续创建）----
  if (SCHEDULE_SIGNAL_RE.test(t) || !hasD) {
    // 没有日程信号但也没有草稿 → 模糊输入，交由 LLM 判断，规则默认创建
    return { intent: 'schedule_create', confidence: SCHEDULE_SIGNAL_RE.test(t) ? 0.9 : 0.6 };
  }

  // ---- 6. LLM 辅助：合法 intent 兜底 ----
  if (llmIntent && ['schedule_create', 'schedule_modify', 'schedule_confirm', 'schedule_cancel', 'general_chat'].includes(llmIntent)) {
    return { intent: llmIntent, confidence: 0.7 };
  }

  // ---- 7. 兜底 ----
  return { intent: 'general_chat', confidence: 0.5 };
}

export { ACTIVE_STATES };

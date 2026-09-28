/**
 * LLM 智能解析通道（OpenAI 兼容协议，默认 DeepSeek）。
 * PHASE 4-B：除日程槽位外，同时输出 intent / confidence；
 * 未配置 / 调用失败 / 输出非法时自动降级为本地规则 NLU（PRD §4 双通道）。
 */
import { ConversationIntent, LLMConfig, ParsedSlots, Persona, SchedulePriority } from '../types.js';
import { checkCompleteness, ensureDefaultDate, normalizeRemind, parseUtterance } from './nlu.js';
import { parseRemindOffset } from '../utils/date.js';

export interface LLMOrLocalResult {
  slots: ParsedSlots;
  replyText?: string;
  source: 'llm' | 'local';
  modelUsed?: string;
  /** PHASE 4-B：LLM 判定的意图（辅助 Intent Router，规则优先） */
  intent?: ConversationIntent;
  confidence?: number;
}

/** 合法 intent 集合 */
const INTENTS: ConversationIntent[] = ['schedule_create', 'schedule_modify', 'schedule_confirm', 'schedule_cancel', 'general_chat'];

/** 构建 LLM 系统 Prompt（含 Persona 表达、Intent 判定与字段白名单） */
export function buildSystemPrompt(persona: Persona, isModification: boolean): string {
  return `${persona.prompt.system}

【任务目标】
分析用户的语音口语输入${isModification ? '或对当前日程草稿的修改/补充语句' : ''}，完成两件事：
1. 判断用户意图（intent）；
2. 若意图涉及日程（schedule_create / schedule_modify），提取日程槽位字段；
   若为普通闲聊（general_chat），【禁止】提取任何日程字段（时间/地点/任务等一律不输出）。
并以【严格的 JSON 格式】返回，不得包含任何 Markdown 标记或多余文字，不得输出思考过程。

【返回 JSON 规范 —— 字段白名单，只能包含以下字段】
{
  "intent": "schedule_create | schedule_modify | schedule_confirm | schedule_cancel | general_chat（只选一个）",
  "confidence": 0.0-1.0（你对意图判断的把握程度）,
  "slots": {
    "title": "日程标题（简明扼要，如：与张总开会）",
    "dateLabel": "人类可读的日期标签（如：明天 (周二) 或 9月28日 周一；若不确定今天具体几号，输出相对日期如“明天 (周二)”；用户未提到日期则省略）",
    "time": "24小时制时间（如：15:00；用户未提到时间则省略）",
    "location": "地点（如：上海虹桥；用户未提到则省略该字段）",
    "task": "任务（如：与张总开会；用户未提到则省略）",
    "matters": "事项（如：讨论二期项目；用户未提到则省略）",
    "remindOffset": "提醒提前量（如：提前30分钟、提前15分钟；用户未提到则省略）",
    "priority": "high | medium | low（商务谈判/高层会议通常为 high，默认为 medium）"
  },
  "replyText": "以你的人设口吻给用户的简短回复（1-2句话）"
}

【Intent 判定指引】
- schedule_create：用户明确表达要创建/安排日程（含时间词或"开会/约/安排/提醒我"等日程动词）。
- schedule_modify：用户在已有草稿基础上修改/补充字段（地点改到X、提前X分钟、在陆家嘴、下午4点 等）。
- schedule_confirm / schedule_cancel：仅当用户明确肯定（可以/好的/就这样）或取消（算了/不用了/取消）时输出；
  但最终以系统规则判定为准。
- general_chat：问候、自我介绍（介绍下你自己/你是谁/你能做什么）、感谢、闲聊等，【绝对】不要输出任何日程字段。

【硬性约束】
1. slots 内只能出现上述 7 个字段，禁止输出 date、attendees、participants、summary、start_time、end_time、description、reminder、status 等任何未列出字段。
2. 如果用户提供了旧 draft 上下文（例如原本是虹桥，用户说“地点不是虹桥，是陆家嘴”），请务必保留其他未修改字段，只更新修改项。
3. priority 字段必须是 "high"、"medium"、"low" 之一。
4. 必须直接输出合法 JSON，不能以 \`\`\`json 开头包裹，不要有任何解释文字。
5. replyText 措辞规范【关键】：日程【尚未创建】时，必须使用“待确认/确认后创建”口吻（如：“你看这样安排可以吗？确认后我就帮你创建”），严禁出现“已创建”“已记下”“搞定”“安排好了”等已完成措辞。只有确认创建完成后才可使用完成式。`;
}

function maskContent(content: string): string {
  return content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
}

function sanitizeSlots(parsed: Record<string, unknown>): ParsedSlots {
  const slots: ParsedSlots = {};
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  // 兼容两种输出形态：{ slots: {...} } 嵌套 或 平铺字段
  const body = (parsed.slots && typeof parsed.slots === 'object')
    ? (parsed.slots as Record<string, unknown>)
    : parsed;

  // 字段别名兼容：部分代理模型会输出 summary/start_time/participants/date 等近似字段，这里归一化。
  const title = str(body.title) ?? str(body.summary) ?? str(body.event) ?? str(body.name);
  const time = str(body.time) ?? str(body.start_time) ?? str(body.startTime) ?? str(body.start);
  const dateLabel = str(body.dateLabel) ?? str(body.date) ?? str(body.day) ?? str(body.when);
  const task = str(body.task) ?? title;

  slots.title = title;
  slots.task = task;
  slots.time = time;
  slots.dateLabel = dateLabel;
  slots.location = str(body.location) ?? str(body.place) ?? str(body.address);
  slots.matters = str(body.matters) ?? str(body.description) ?? str(body.agenda);
  slots.remindOffset = str(body.remindOffset) ?? str(body.reminder) ?? str(body.remind);
  if (body.priority === 'high' || body.priority === 'medium' || body.priority === 'low') {
    slots.priority = body.priority as SchedulePriority;
  }
  const reply = str(parsed.replyText) ?? str(body.replyText) ?? str(body.reply);
  if (reply) slots.replyText = reply;

  // 校验时间格式
  if (slots.time && !/^\d{1,2}:\d{2}$/.test(slots.time)) {
    const m = slots.time.match(/(\d{1,2}):(\d{1,2})/);
    slots.time = m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${String(parseInt(m[2], 10)).padStart(2, '0')}` : undefined;
  }
  // 提醒字段规范化
  if (slots.remindOffset) {
    const parsedOffset = parseRemindOffset(slots.remindOffset);
    if (parsedOffset) {
      slots.remindOffset = parsedOffset.label;
      slots.remindOffsetMinutes = parsedOffset.minutes;
    }
  }
  return slots;
}

/** 由 dateLabel 推断 date（如「明天」「9月28日」），失败返回 undefined */
export function dateFromLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const local = parseUtterance(label);
  return local.date;
}

/**
 * 主入口：优先 LLM，失败/未配置则本地 NLU。
 * @param utterance 用户输入
 * @param currentDraft 已有草稿（多轮修改时传入）
 * @param persona 人格（影响系统 Prompt 与回复口吻）
 * @param llmConfig LLM 配置
 */
export async function parseWithLLMOrLocal(
  utterance: string,
  currentDraft: ParsedSlots | undefined,
  persona: Persona,
  llmConfig: LLMConfig,
): Promise<LLMOrLocalResult> {
  // ---- LLM 通道 ----
  if (llmConfig.enabled && llmConfig.apiKey.trim() && llmConfig.baseUrl.trim()) {
    try {
      const isModification = Boolean(currentDraft && Object.keys(currentDraft).length > 0);
      const systemPrompt = buildSystemPrompt(persona, isModification);
      const userContent = isModification
        ? `【历史已识别日程】:\n${JSON.stringify(currentDraft, null, 2)}\n\n【用户最新修改或补充语句】:\n"${utterance}"`
        : `【用户输入】:\n"${utterance}"`;

      const baseUrl = llmConfig.baseUrl.replace(/\/+$/, '');
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: llmConfig.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`LLM HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('LLM 空响应');

      let parsedObj: Record<string, unknown>;
      try {
        parsedObj = JSON.parse(maskContent(content)) as Record<string, unknown>;
      } catch {
        throw new Error('LLM 输出非法 JSON');
      }

      // intent 解析（LLM 辅助；非法则忽略，由规则兜底）
      let llmIntent: ConversationIntent | undefined;
      const rawIntent = typeof parsedObj.intent === 'string' ? parsedObj.intent.trim() : undefined;
      if (rawIntent && INTENTS.includes(rawIntent as ConversationIntent)) {
        llmIntent = rawIntent as ConversationIntent;
      }
      const confidence = typeof parsedObj.confidence === 'number'
        ? Math.min(Math.max(parsedObj.confidence, 0), 1)
        : undefined;

      let slots = sanitizeSlots(parsedObj);

      // general_chat：严禁输出任何日程字段（即使 LLM 误填也清空）
      if (llmIntent === 'general_chat') {
        slots = {};
      }

      // 本地 NLU 补充校准：LLM 漏掉的字段用规则引擎补全（仅限非闲聊路径）
      if (llmIntent !== 'general_chat') {
        const localSlots = parseUtterance(utterance, undefined);
        slots = {
          ...currentDraft,
          ...slots,
          ...{
            time: slots.time ?? localSlots.time,
            date: slots.date ?? localSlots.date,
            dateLabel: slots.dateLabel ?? localSlots.dateLabel,
            location: slots.location ?? localSlots.location,
            task: slots.task ?? localSlots.task ?? localSlots.title,
            title: slots.title ?? localSlots.title ?? localSlots.task,
            matters: slots.matters ?? localSlots.matters,
            remindOffset: slots.remindOffset ?? localSlots.remindOffset,
            remindOffsetMinutes: slots.remindOffsetMinutes ?? localSlots.remindOffsetMinutes,
            priority: slots.priority ?? localSlots.priority,
          },
        };

        // LLM 只给了 dateLabel 未给 date 时，由日期标签反推
        if (!slots.date && slots.dateLabel) {
          const d = dateFromLabel(slots.dateLabel);
          if (d) slots.date = d;
        }
        ensureDefaultDate(slots);
        normalizeRemind(slots);
        if (!slots.priority) slots.priority = 'medium';
      }

      const result: LLMOrLocalResult = {
        slots,
        replyText: slots.replyText,
        source: 'llm',
        modelUsed: llmConfig.model || 'deepseek-chat',
        intent: llmIntent,
        confidence,
      };
      delete slots.replyText;
      return result;
    } catch (err) {
      console.warn('[LLM 通道失败，降级本地 NLU]', (err as Error).message);
    }
  }

  // ---- 本地规则 NLU 兜底（intent 由 Intent Router 规则判定，此处仅解析槽位）----
  const localSlots = parseUtterance(utterance, currentDraft);
  ensureDefaultDate(localSlots);
  normalizeRemind(localSlots);
  if (!localSlots.priority) localSlots.priority = 'medium';
  return {
    slots: localSlots,
    source: 'local',
    modelUsed: 'local-nlu',
  };
}

/* ==============================
 * PHASE 4-C · Response Generator
 * 与「理解」（parseWithLLMOrLocal）分离：理解定 intent/slots/action，
 * 这里只基于完整 Conversation Context 生成自然回复文本。
 * LLM 不可用/失败时返回 undefined，由调用方用 persona 模板兜底。
 * ============================== */

export interface ReplyTurn {
  role: 'user' | 'ai';
  text: string;
}

export interface ReplyContext {
  persona: Persona;
  llmConfig: LLMConfig;
  intent: ConversationIntent;
  state: string;
  action: string;
  /** 当前草稿（含本轮合并后的最新值） */
  draft: Record<string, unknown>;
  /** 当前缺失字段（英文 key） */
  missing: string[];
  /** 对话历史（含本轮用户消息） */
  turns: ReplyTurn[];
  latestUtterance: string;
  /** 系统事实提示（如：日程尚未创建 / 已创建 / 已取消） */
  facts?: string[];
}

const FIELD_CN: Record<string, string> = {
  time: '时间', date: '日期', dateLabel: '日期', location: '地点',
  task: '任务', title: '标题', matters: '事项',
  remindOffset: '提醒', remindOffsetMinutes: '提醒', priority: '优先级',
};

/** 基于完整 Conversation Context 生成 AI 回复（LLM 单轮，历史内联进 system）。 */
export async function generateReplyWithContext(ctx: ReplyContext): Promise<string | undefined> {
  if (!(ctx.llmConfig.enabled && ctx.llmConfig.apiKey.trim() && ctx.llmConfig.baseUrl.trim())) {
    return undefined;
  }
  try {
    const missingCn = ctx.missing.map((k) => FIELD_CN[k] || k);
    const history = ctx.turns.map((t) => `${t.role === 'user' ? '用户' : '助手'}: ${t.text}`).join('\n');
    const system = `${ctx.persona.prompt.system}

【你的任务】
你是对话式日程助手的【AI 回复层】。根据下面给出的完整对话上下文，生成自然、口语化、贴合上下文的回复（1-2 句话）。
你只负责回复，不执行任何日程创建/修改/取消动作——这些由系统完成，你只生成回复文本。

【硬性约束】
1. 必须结合完整上下文回复，体现你已经"看到"之前的对话：不要重复用户或你已经说过、且上下文里已存在的信息；不要像第一轮那样重新介绍。
2. 严禁重新创建新日程、严禁丢失草稿里已有字段、严禁编造上下文里没有出现的时间/地点/任务/人物。
3. 日程【尚未确认创建】时（状态为 awaiting_supplement / awaiting_clarify / card_ready），回复必须保持"待确认/确认后创建"口吻（如"这样安排可以吗？确认后我就帮你创建"）；严禁出现"已创建""已记下""搞定""安排好了"等完成式措辞。
4. 若系统事实标注【已创建】或【已取消】，则按该状态回复。
5. 直接输出回复文本本身：不要 JSON、不要 Markdown、不要引号包裹、不要解释。

【对话上下文】
当前意图: ${ctx.intent}
当前状态: ${ctx.state}
当前系统动作: ${ctx.action}
当前日程草稿: ${JSON.stringify(ctx.draft, null, 2)}
当前缺失字段: ${missingCn.length ? missingCn.join('、') : '无'}
${ctx.facts && ctx.facts.length ? `系统事实: ${ctx.facts.join('；')}` : ''}

【对话历史】
${history}

【最新用户消息】
"${ctx.latestUtterance}"`;

    const baseUrl = ctx.llmConfig.baseUrl.replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ctx.llmConfig.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: ctx.llmConfig.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: ctx.latestUtterance },
        ],
        temperature: 0.7,
        max_tokens: 200,
        signal: AbortSignal.timeout(15000),
      }),
    });
    if (!resp.ok) {
      throw new Error(`Reply LLM HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return undefined;
    const cleaned = content.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
    return cleaned || undefined;
  } catch (err) {
    console.warn('[Reply Generator 失败，使用模板兜底]', (err as Error).message);
    return undefined;
  }
}

export { checkCompleteness };

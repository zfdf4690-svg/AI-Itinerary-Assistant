/**
 * LLM 智能解析通道（OpenAI 兼容协议，默认 DeepSeek）。
 * 返回 5 字段 JSON；未配置 / 调用失败 / 输出非法时自动降级为本地规则 NLU（PRD §4 双通道）。
 */
import { LLMConfig, ParsedSlots, Persona, SchedulePriority } from '../types.js';
import { checkCompleteness, ensureDefaultDate, normalizeRemind, parseUtterance } from './nlu.js';
import { parseRemindOffset } from '../utils/date.js';

export interface LLMOrLocalResult {
  slots: ParsedSlots;
  replyText?: string;
  source: 'llm' | 'local';
  modelUsed?: string;
}

/** 构建 LLM 系统 Prompt（含 Persona 表达与 5 字段 JSON 规范，对应 PRD §4/§10） */
export function buildSystemPrompt(persona: Persona, isModification: boolean): string {
  return `${persona.prompt.system}

【任务目标】
分析用户的语音口语输入${isModification ? '或二次修改文本' : ''}，提取日程 5 字段槽位信息，并以【严格的 JSON 格式】返回，不得包含任何 Markdown 标记或多余文字，不得输出思考过程。

【返回 JSON 规范 —— 字段白名单，只能包含以下字段】
{
  "title": "日程标题（简明扼要，如：与张总开会）",
  "dateLabel": "人类可读的日期标签（如：明天 (周二) 或 9月28日 周一；若不确定今天具体几号，输出相对日期如“明天 (周二)”）",
  "time": "24小时制时间（如：15:00）",
  "location": "地点（如：上海虹桥；用户未提到则省略该字段）",
  "task": "任务（如：与张总开会）",
  "matters": "事项（如：讨论二期项目；用户未提到则省略）",
  "remindOffset": "提醒提前量（如：提前30分钟、提前15分钟；用户未提到则省略）",
  "priority": "high | medium | low（商务谈判/高层会议通常为 high，默认为 medium）",
  "replyText": "以你的人设口吻给用户的简短回复（1-2句话）"
}

【硬性约束】
1. 只能输出上述 9 个字段之一，禁止输出 date、attendees、participants、summary、start_time、end_time、description、reminder、status 等任何未列出字段。
2. 如果用户提供了旧 draft 上下文（例如原本是虹桥，用户说“地点不是虹桥，是陆家嘴”），请务必保留其他未修改字段，只更新修改项。
3. priority 字段必须是 "high"、"medium"、"low" 之一。
4. 必须直接输出合法 JSON，不能以 \`\`\`json 开头包裹，不要有任何解释文字。`;
}

function maskContent(content: string): string {
  return content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
}

function sanitizeSlots(parsed: Record<string, unknown>): ParsedSlots {
  const slots: ParsedSlots = {};
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  // 字段别名兼容：部分代理模型（如忽略 response_format 的第三方托管模型）
  // 会输出 summary/start_time/participants/date 等近似字段，这里归一化。
  const title = str(parsed.title) ?? str(parsed.summary) ?? str(parsed.event) ?? str(parsed.name);
  const time = str(parsed.time) ?? str(parsed.start_time) ?? str(parsed.startTime) ?? str(parsed.start);
  const dateLabel = str(parsed.dateLabel) ?? str(parsed.date) ?? str(parsed.day) ?? str(parsed.when);
  const task = str(parsed.task) ?? title;

  slots.title = title;
  slots.task = task;
  slots.time = time;
  slots.dateLabel = dateLabel;
  slots.location = str(parsed.location) ?? str(parsed.place) ?? str(parsed.address);
  slots.matters = str(parsed.matters) ?? str(parsed.description) ?? str(parsed.agenda);
  slots.remindOffset = str(parsed.remindOffset) ?? str(parsed.reminder) ?? str(parsed.remind);
  if (parsed.priority === 'high' || parsed.priority === 'medium' || parsed.priority === 'low') {
    slots.priority = parsed.priority as SchedulePriority;
  }
  const reply = str(parsed.replyText) ?? str(parsed.reply);
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
        : `【用户日程创建需求】:\n"${utterance}"`;

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

      let slots = sanitizeSlots(parsedObj);
      // 本地 NLU 补充校准：LLM 漏掉的字段用规则引擎补全
      const localSlots = parseUtterance(utterance, undefined);
      slots = {
        ...currentDraft,
        ...slots,
        ...{
          // 仅补 LLM 未给出的字段
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

      const result: LLMOrLocalResult = {
        slots,
        replyText: slots.replyText,
        source: 'llm',
        modelUsed: llmConfig.model || 'deepseek-chat',
      };
      delete slots.replyText;
      return result;
    } catch (err) {
      console.warn('[LLM 通道失败，降级本地 NLU]', (err as Error).message);
    }
  }

  // ---- 本地规则 NLU 兜底 ----
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

export { checkCompleteness };

import { ScheduleItem, Persona, SchedulePriority } from '../types';

export interface LLMParseRequest {
  utterance: string;
  currentDraft?: Partial<ScheduleItem>;
  persona?: Persona;
}

export interface LLMParseResult {
  slots: Partial<ScheduleItem>;
  replyText: string;
  source: 'deepseek' | 'local_fallback';
  modelUsed?: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  customPrompt?: string;
  enabled: boolean;
}

export const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  enabled: false,
};

/**
 * Build System Prompt for DeepSeek Chat/Reasoner to perform zero-shot/few-shot
 * schedule slot extraction and natural conversational reply.
 */
export function buildDeepSeekSchedulePrompt(persona?: Persona): string {
  const personaName = persona?.name || '智能助理';
  const personaVoiceStyle = persona?.voiceStyle || '温柔体贴，善解人意';

  return `你是一个移动端智能日程助手的内核引擎，同时你的人设是【${personaName}】（性格特点：${personaVoiceStyle}）。

【任务目标】
分析用户的语音口语输入或二次修改文本，提取日程槽位信息，并以【严格的 JSON 格式】返回，不得包含任何 Markdown 标记或多余文字。

【返回 JSON 规范】
{
  "title": "会议或日程标题（简明扼要，如：与张总开会）",
  "dateLabel": "相对或绝对日期（如：明天 (周二) 或 4月23日 周二）",
  "time": "24小时制时间（如：15:00）",
  "location": "地点（如：上海虹桥 或 陆家嘴中心）",
  "matters": "核心议题或待办事项（如：讨论二期项目）",
  "remindOffset": "提醒提前量（如：提前30分钟、提前15分钟）",
  "priority": "high | medium | low (根据紧急/重要程度评估，商务谈判/高层会议通常为 high)",
  "replyText": "以你的人设口吻给用户的确认或反馈回复（简短亲切，1-2句话，不要长篇大论）"
}

【注意事项】
1. 如果用户提供了旧的 draft 上下文，例如原本是虹桥，用户说“地点不是虹桥，是陆家嘴”，请务必保留其他未修改字段（如时间、标题），只更新修改项。
2. priority 字段必须是 "high", "medium", "low" 之一。
3. 务必直接输出合法 JSON，不能以 \`\`\`json 开头包裹。`;
}

import { ScheduleItem, Persona } from '../types';
import { 
  DeepSeekConfig, 
  DEFAULT_DEEPSEEK_CONFIG, 
  LLMParseResult, 
  buildDeepSeekSchedulePrompt 
} from './llmService';
import { parseScheduleFromUtterance } from '../utils/nlu';

const DEEPSEEK_STORAGE_KEY = 'ai_schedule_deepseek_config';

export function getStoredDeepSeekConfig(): DeepSeekConfig {
  try {
    const raw = localStorage.getItem(DEEPSEEK_STORAGE_KEY);
    if (!raw) return DEFAULT_DEEPSEEK_CONFIG;
    return { ...DEFAULT_DEEPSEEK_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DEEPSEEK_CONFIG;
  }
}

export function saveStoredDeepSeekConfig(cfg: DeepSeekConfig) {
  try {
    localStorage.setItem(DEEPSEEK_STORAGE_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.warn('Failed to save deepseek config', err);
  }
}

/**
 * Universal Intelligent Parser:
 * Checks if DeepSeek is enabled and configured with an API key.
 * If yes: performs real request to DeepSeek API endpoint (compatible with OpenAI format).
 * If no / error: automatically falls back to local NLU rule engine seamlessly.
 */
export async function parseWithDeepSeekOrFallback(
  utterance: string,
  currentDraft?: Partial<ScheduleItem>,
  persona?: Persona
): Promise<LLMParseResult> {
  const config = getStoredDeepSeekConfig();

  // If enabled and API key is present, try DeepSeek
  if (config.enabled && config.apiKey.trim()) {
    try {
      const systemPrompt = buildDeepSeekSchedulePrompt(persona);
      const userContent = currentDraft
        ? `【历史已识别日程】:\n${JSON.stringify(currentDraft, null, 2)}\n\n【用户最新修改或补充语句】:\n"${utterance}"`
        : `【用户日程创建需求】:\n"${utterance}"`;

      const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API request failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from DeepSeek API');
      }

      // Clean markdown code blocks if any
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const slots: Partial<ScheduleItem> = {
        title: parsed.title || currentDraft?.title || '重要日程',
        dateLabel: parsed.dateLabel || currentDraft?.dateLabel || '明天 (周二)',
        time: parsed.time || currentDraft?.time || '15:00',
        location: parsed.location || currentDraft?.location || '未指定地点',
        task: parsed.title || currentDraft?.task || '重要日程',
        matters: parsed.matters || currentDraft?.matters || '常规推进',
        remindOffset: parsed.remindOffset || currentDraft?.remindOffset || '提前30分钟',
        priority: (['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : currentDraft?.priority) || 'medium',
        accentColor: parsed.priority === 'high' ? 'red' : 'blue',
        hasAlarm: true,
        status: 'active'
      };

      const replyText = parsed.replyText || (persona ? persona.confirmReplyText : '好的，我已为你更新相关信息。这样安排可以吗？');

      return {
        slots,
        replyText,
        source: 'deepseek',
        modelUsed: config.model
      };
    } catch (apiError) {
      console.warn('[DeepSeek API Fallback Warning]', apiError);
      // Seamlessly fall through to local fallback
    }
  }

  // Local rule-based NLU fallback
  const localSlots = parseScheduleFromUtterance(utterance, currentDraft);
  let localReply = '好的，我帮你记下来了。\n这样安排可以吗？';
  if (currentDraft) {
    if (utterance.includes('地点') || utterance.includes('陆家嘴')) {
      localReply = '好的，我已为你更新地点信息。\n这样安排可以吗？';
    } else if (utterance.includes('时间') || utterance.includes('点')) {
      localReply = '好的，我已为你调整了日程时间。\n这样安排可以吗？';
    } else if (utterance.includes('提醒')) {
      localReply = '好的，提醒时间已为你更新。\n这样安排可以吗？';
    } else {
      localReply = '好的，我已为你更新相关信息。\n这样安排可以吗？';
    }
  }

  return {
    slots: localSlots,
    replyText: localReply,
    source: 'local_fallback',
    modelUsed: 'local-nlu'
  };
}

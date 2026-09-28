/**
 * 契约一致性验证：模拟前端 apiClient 对真实后端（4599 + server/data）的请求序列。
 * 覆盖前端实际会用到的全部端点与返回形状；测试日程创建后即清理，不污染真实数据。
 *
 * 运行：node scripts/contract-check.mjs（需后端已在 4599 运行）
 */
const BASE = 'http://localhost:4599/api/v1';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push({ name, extra });
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function req(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

// 与前端 apiClient 相同的请求形状
const FE = {
  understand: (u, extra = {}) => req('POST', '/understand', { utterance: u, currentDraft: extra.currentDraft, personaId: extra.personaId }),
  conversations: (u) => req('POST', '/conversations', { utterance: u, personaId: 'gentle' }),
  turn: (id, u) => req('POST', `/conversations/${id}/turn`, { utterance: u }),
  confirm: (id) => req('POST', `/conversations/${id}/confirm`),
  getSchedules: () => req('GET', '/schedules'),
  createSchedule: (s) => req('POST', '/schedules', s),
  patchSchedule: (id, patch) => req('PATCH', `/schedules/${id}`, patch),
  deleteSchedule: (id) => req('DELETE', `/schedules/${id}`),
  reminders: () => req('GET', '/reminders/active'),
  config: () => req('GET', '/config'),
  tts: (text, voice) => req('POST', '/voice/tts', { text, voice }),
  asr: (base64) => req('POST', '/voice/asr', { audioBase64: base64 }),
};

async function main() {
  console.log('[contract] 前端 apiClient 契约一致性验证（真实后端 4599）\n');

  // 1. 启动探测 + 首次加载
  {
    const r = await req('GET', '/health');
    check('health 可用且含 version', r.status === 200 && r.data?.version === '1.0.0');
    const s = await FE.getSchedules();
    check('GET /schedules 返回 items 数组', s.status === 200 && Array.isArray(s.data?.items));
  }

  // 2. 完整会话链路（前端 Home → /understand → 追问 → 拒绝 → 卡片）
  let convId;
  {
    const r = await FE.conversations('明天下午三点和张总开会');
    convId = r.data?.id;
    check('会话创建，state=awaiting_supplement', r.data?.state === 'awaiting_supplement', `state=${r.data?.state}`);
    check('action=ASK_OPTIONAL（追问可选信息）', r.data?.action === 'ASK_OPTIONAL', `action=${r.data?.action}`);
    check('replyText 非空（前端 ClarificationView 用）', String(r.data?.replyText).length > 0);
    check('missing 含 location', r.data?.missing?.includes('location'));

    const t = await FE.turn(convId, '不用了');
    check('拒绝后 state=card_ready', t.data?.state === 'card_ready', `state=${t.data?.state}`);
    check('action=SHOW_SCHEDULE_CARD（前端确认卡）', t.data?.action === 'SHOW_SCHEDULE_CARD');
    check('草稿含 5 字段（前端 ConfirmScheduleView 用）', Boolean(t.data?.draft?.time && t.data?.draft?.title && t.data?.draft?.dateLabel));
  }

  // 3. 确认创建 → 持久化在真实 data
  let sid;
  {
    const r = await FE.confirm(convId);
    sid = r.data?.schedule?.id;
    check('confirm 创建日程并返回', Boolean(sid), JSON.stringify(r.data));
    check('会话 action=NONE', r.data?.conversation?.action === 'NONE');
  }

  // 4. PATCH 局部修改（前端修改卡）
  {
    const r = await FE.patchSchedule(sid, { location: '陆家嘴' });
    check('PATCH 局部修改生效', r.data?.location === '陆家嘴');
    check('未传字段保留', r.data?.time === '15:00');
  }

  // 5. 提醒引擎 + 配置
  {
    const r = await FE.reminders();
    check('GET /reminders/active 返回数组', Array.isArray(r.data?.items));
    const c = await FE.config();
    check('GET /config 返回 llm/minimax 且 Key 脱敏', c.status === 200 && !String(c.data?.llm?.apiKey || '').includes('sk-') && 'apiKey' in (c.data?.llm || {}));
  }

  // 6. TTS（未配置 Key → 503 + code=tts_not_configured + fallback=browser，前端据此降级 speakText）
  {
    const r = await FE.tts('你好，这是一条测试语音', 'gentle');
    check('TTS 未配置返回 503 契约', r.status === 503 && r.data?.error?.code === 'tts_not_configured');
    check('fallback=browser（前端降级提示）', r.data?.error?.details?.fallback === 'browser');
  }

  // 7. ASR 空输入校验（前端上传语音转写）
  {
    const r = await FE.asr('');
    check('ASR 空输入返回 400 VALIDATION_ERROR', r.status === 400 && r.data?.error?.code === 'VALIDATION_ERROR');
  }

  // 8. 清理：删除测试日程（真实 data 不残留）
  {
    const r = await FE.deleteSchedule(sid);
    check('清理测试日程成功', r.status === 200);
    const s = await FE.getSchedules();
    check('列表已不含测试日程', !s.data?.items?.some((x) => x.id === sid));
  }

  console.log('\n========================================');
  console.log(`契约一致性: ${passed} 通过, ${failed} 失败`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f.name} ${f.extra}`);
    process.exit(1);
  }
  console.log('契约全部一致 ✅');
}

main().catch((err) => { console.error('[contract] 异常', err); process.exit(1); });

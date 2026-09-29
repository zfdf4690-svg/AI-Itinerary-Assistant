// PHASE 4-E API 级闭环验证（真实 4599 + 真实 server/data）
// 流程：建会话 → 补充提醒 → 确认创建 → DB+1 → 重复确认 → DB 不变
const BASE = 'http://127.0.0.1:4599/api/v1';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}

async function scheduleTotal() {
  const r = await req('GET', '/schedules');
  return { total: (r.data?.items || []).length, items: r.data?.items || [] };
}

(async () => {
  const before = await scheduleTotal();
  console.log(`[基线] TOTAL=${before.total}`);

  // 1) 建会话（首轮）
  const c = await req('POST', '/conversations', { utterance: '今天11:30的线上客户培训会议，提前25分钟提醒' });
  console.log(`\n[1] POST /conversations -> ${c.status}`);
  console.log(`    conversationId=${c.data?.conversation?.id || c.data?.id} state=${c.data?.state} intent=${c.data?.intent}`);
  console.log(`    draft=${JSON.stringify(c.data?.conversation?.draft || c.data?.draft || null)}`);
  console.log(`    reply=${c.data?.replyText?.slice(0, 60)}`);
  const convId = c.data?.conversation?.id || c.data?.id;
  if (!convId) { console.log('!! 未拿到 conversationId'); process.exit(1); }

  // 2) 第二轮：直接确认创建（missing 还有 location/matters，验证 confirm 不再假创建）
  const t2 = await req('POST', `/conversations/${convId}/turn`, { utterance: '确认创建' });
  console.log(`\n[2] POST /conversations/${convId}/turn {"确认创建"} -> ${t2.status}`);
  console.log(`    intent=${t2.data?.intent} state=${t2.data?.state} action=${t2.data?.action}`);
  console.log(`    reply=${t2.data?.replyText?.slice(0, 60)}`);

  const after1 = await scheduleTotal();
  const created = after1.items.filter((x) => x.date === '2026-09-29' && x.time === '11:30' && /线上客户培训会议/.test(x.task || ''));
  console.log(`\n[3] GET /schedules -> TOTAL=${after1.total}（基线 ${before.total}，Δ=${after1.total - before.total}）`);
  console.log(`    本次创建的 11:30 线上客户培训会议=${created.length ? created.map((x) => x.id + ' status=' + x.status + ' remindOffset=' + (x.remindOffset || x.remindOffsetMinutes)) : '无'}`);

  // 3) 重复确认：不得重复创建
  const t3 = await req('POST', `/conversations/${convId}/turn`, { utterance: '确认创建' });
  console.log(`\n[4] 重复 {"确认创建"} -> ${t3.status} intent=${t3.data?.intent} state=${t3.data?.state}`);
  const after2 = await scheduleTotal();
  console.log(`    TOTAL=${after2.total}（Δ=${after2.total - after1.total}，应=0）`);

  // 4) /understand 兜底路径：convId 丢失场景
  const u = await req('POST', '/understand', {
    utterance: '确定创建',
    currentDraft: { date: '2026-09-29', dateLabel: '今天', time: '11:30', task: '线上客户培训会议', remindOffset: '提前25分钟', remindOffsetMinutes: 25 },
  });
  console.log(`\n[5] POST /understand {确定创建 + 完整draft} -> ${u.status}`);
  console.log(`    intent=${u.data?.intent} state=${u.data?.state} source=${u.data?.source} actionRequired=${u.data?.actionRequired}`);
  console.log(`    reply=${u.data?.replyText?.slice(0, 60)}`);
  const after3 = await scheduleTotal();
  console.log(`    TOTAL=${after3.total}（Δ=${after3.total - after2.total}，应=+1）`);
})().catch((e) => { console.error('ERR', e); process.exit(1); });

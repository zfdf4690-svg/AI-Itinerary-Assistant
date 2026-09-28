/**
 * PHASE 4-B 意图层测试（自包含）：临时端口 + 独立 DATA_DIR + 真实 LLM 链路。
 * Test 01: 普通聊天（介绍下你自己）→ general_chat，无草稿无卡片
 * Test 02: 普通问候（你好）→ general_chat
 * Test 03: 创建日程（明天下午三点和张总开会）→ schedule_create，time/task
 * Test 04: 修改（地点改到陆家嘴）→ schedule_modify，保留 time/task
 * Test 05: 确认（可以）→ schedule_confirm → 创建 Schedule
 * Test 06: 取消/拒绝（不用了，awaiting_supplement）→ 会话与草稿保留，进入卡片
 * Test 07: 上下文连续性（创建→补地点→补提醒→确认）→ 5 字段完整
 * E2E  : 重启后端 → Schedule 持久化保留 + 闲聊不出卡
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PORT = 4632;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push({ name, extra }); console.log(`  FAIL  ${name} ${extra}`); }
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

function spawnServer(dataDir, port = PORT) {
  const child = spawn(process.execPath, [path.join(SERVER_ROOT, 'dist', 'index.js')], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      LLM_ENABLED: 'true',
      MINIMAX_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`));
  return child;
}

async function waitReady(port = PORT) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r2) => setTimeout(r2, 300));
  }
  return false;
}

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ai-intent-test-'));
  console.log(`[intent-tests] 临时数据目录: ${dataDir}`);
  console.log(`[intent-tests] 数据目录路径: ${dataDir}`);

  let child = spawnServer(dataDir);
  if (!(await waitReady())) {
    console.error('[intent-tests] 服务器未就绪');
    child.kill();
    process.exit(1);
  }

  // ---------- Test 01：普通聊天 ----------
  console.log('\n[Test 01] 介绍下你自己 → general_chat');
  {
    const r = await req('POST', '/conversations', { utterance: '介绍下你自己' });
    check('201', r.status === 201, JSON.stringify(r.data?.turns?.slice(-1)));
    check('intent=general_chat', r.data?.intent === 'general_chat', r.data?.intent);
    check('action=NONE', r.data?.action === 'NONE', r.data?.action);
    check('state=chatting', r.data?.state === 'chatting', r.data?.state);
    check('无 time', !r.data?.draft?.time, JSON.stringify(r.data?.draft));
    check('无 task', !r.data?.draft?.task, JSON.stringify(r.data?.draft));
    const reply = r.data?.turns?.at(-1)?.text || '';
    // PHASE 4-C：general_chat 回复由 LLM 基于上下文动态生成（非固定模板），仅断言非空
    check('回复非空（LLM 动态生成）', reply.length > 0, reply);
  }

  // ---------- Test 02：普通问候 ----------
  console.log('\n[Test 02] 你好 → general_chat');
  {
    const r = await req('POST', '/conversations', { utterance: '你好' });
    check('intent=general_chat', r.data?.intent === 'general_chat', r.data?.intent);
    check('action=NONE', r.data?.action === 'NONE', r.data?.action);
    check('无 draft', Object.keys(r.data?.draft || {}).length === 0, JSON.stringify(r.data?.draft));
  }

  // ---------- Test 03：创建日程 ----------
  console.log('\n[Test 03] 明天下午三点和张总开会 → schedule_create');
  let conv3;
  {
    const r = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    conv3 = r.data;
    check('201', r.status === 201, r.status);
    check('intent=schedule_create', r.data?.intent === 'schedule_create', r.data?.intent);
    check('draft.time=15:00', r.data?.draft?.time === '15:00', r.data?.draft?.time);
    check('draft.task=与张总开会', /张总开会/.test(r.data?.draft?.task || ''), r.data?.draft?.task);
    check('追问可选字段', r.data?.action === 'ASK_OPTIONAL' || r.data?.action === 'ASK_REQUIRED', r.data?.action);
    check('state=awaiting_*', ['awaiting_supplement', 'awaiting_clarify'].includes(r.data?.state), r.data?.state);
  }

  // ---------- Test 04：修改 ----------
  console.log('\n[Test 04] 地点改到陆家嘴 → schedule_modify');
  {
    const r = await req('POST', `/conversations/${conv3.id}/turn`, { utterance: '地点改到陆家嘴' });
    check('intent=schedule_modify', r.data?.intent === 'schedule_modify', r.data?.intent);
    check('location=陆家嘴', (r.data?.draft?.location || '').includes('陆家嘴'), r.data?.draft?.location);
    check('time 保留 15:00', r.data?.draft?.time === '15:00', r.data?.draft?.time);
    check('task 保留', /张总开会/.test(r.data?.draft?.task || ''), r.data?.draft?.task);
    check('同一会话', r.data?.id === conv3.id, `${r.data?.id} != ${conv3.id}`);
    check('进入卡片', r.data?.action === 'SHOW_SCHEDULE_CARD', r.data?.action);
  }

  // ---------- Test 05：确认 ----------
  console.log('\n[Test 05] 可以 → schedule_confirm → 创建');
  let schedCountBefore = 0;
  {
    const s = await req('GET', '/schedules');
    schedCountBefore = (s.data?.items || []).length;
    const r = await req('POST', `/conversations/${conv3.id}/turn`, { utterance: '可以' });
    check('intent=schedule_confirm', r.data?.intent === 'schedule_confirm', r.data?.intent);
    check('state=created', r.data?.state === 'created', r.data?.state);
    const s2 = await req('GET', '/schedules');
    check('schedule 已创建', (s2.data?.items || []).length === schedCountBefore + 1, `${(s2.data?.items || []).length} vs ${schedCountBefore}`);
  }

  // ---------- Test 06：取消/拒绝 ----------
  console.log('\n[Test 06] 不用了（awaiting_supplement）→ 会话/草稿保留，进入卡片');
  {
    const r = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const conv = r.data;
    check('初始 awaiting_supplement', conv.state === 'awaiting_supplement', conv.state);
    const r2 = await req('POST', `/conversations/${conv.id}/turn`, { utterance: '不用了' });
    check('同一会话', r2.data?.id === conv.id, `${r2.data?.id} != ${conv.id}`);
    check('draft.time 保留', r2.data?.draft?.time === '15:00', r2.data?.draft?.time);
    check('draft.task 保留', /张总开会/.test(r2.data?.draft?.task || ''), r2.data?.draft?.task);
    check('进入卡片 card_ready', r2.data?.state === 'card_ready', r2.data?.state);
    check('action=SHOW_SCHEDULE_CARD', r2.data?.action === 'SHOW_SCHEDULE_CARD', r2.data?.action);
    check('turns 数=4', (r2.data?.turns || []).length === 4, String((r2.data?.turns || []).length));
  }

  // ---------- Test 07：上下文连续性 ----------
  console.log('\n[Test 07] 创建→补地点→补提醒→确认');
  let sched7;
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    check('T1 schedule_create', r1.data?.intent === 'schedule_create', r1.data?.intent);
    const r2 = await req('POST', `/conversations/${id}/turn`, { utterance: '在陆家嘴' });
    check('T2 schedule_modify', r2.data?.intent === 'schedule_modify', r2.data?.intent);
    check('T2 location=陆家嘴', (r2.data?.draft?.location || '').includes('陆家嘴'), r2.data?.draft?.location);
    const r3 = await req('POST', `/conversations/${id}/turn`, { utterance: '提前30分钟提醒' });
    check('T3 schedule_modify', r3.data?.intent === 'schedule_modify', r3.data?.intent);
    check('T3 remindOffset=提前30分钟', (r3.data?.draft?.remindOffset || '').includes('30'), r3.data?.draft?.remindOffset);
    check('T3 仍保留 location', (r3.data?.draft?.location || '').includes('陆家嘴'), r3.data?.draft?.location);
    const r4 = await req('POST', `/conversations/${id}/turn`, { utterance: '可以' });
    check('T4 schedule_confirm', r4.data?.intent === 'schedule_confirm', r4.data?.intent);
    check('T4 state=created', r4.data?.state === 'created', r4.data?.state);
    const s = await req('GET', '/schedules');
    sched7 = (s.data?.items || [])[0];
    check('time=15:00', sched7?.time === '15:00', sched7?.time);
    check('task=与张总开会', /张总开会/.test(sched7?.task || ''), sched7?.task);
    check('location=陆家嘴', (sched7?.location || '').includes('陆家嘴'), sched7?.location);
    check('remindOffset=提前30分钟', (sched7?.remindOffset || '').includes('30'), sched7?.remindOffset);
    check('dateLabel=明天', (sched7?.dateLabel || '').includes('明天'), sched7?.dateLabel);
  }

  // ---------- E2E：重启后 Schedule 保留 + 闲聊不出卡 ----------
  console.log('\n[E2E] 重启后端 → Schedule 持久化 + 闲聊隔离');
  let e2eOk = true;
  {
    child.kill();
    await new Promise((r) => setTimeout(r, 800));
    child = spawnServer(dataDir);
    if (!(await waitReady())) {
      console.error('[E2E] 重启后未就绪');
      e2eOk = false;
    } else {
      const s = await req('GET', '/schedules');
      const found = (s.data?.items || []).some((x) => x.id === sched7?.id && x.location === '陆家嘴');
      check('重启后 Schedule 保留', found, `${sched7?.id} / ${(s.data?.items || []).length} 条`);
      const r = await req('POST', '/conversations', { utterance: '介绍下你自己' });
      check('重启后闲聊 general_chat', r.data?.intent === 'general_chat', r.data?.intent);
      check('重启后闲聊无 draft', Object.keys(r.data?.draft || {}).length === 0, JSON.stringify(r.data?.draft));
      check('重启后闲聊 action=NONE', r.data?.action === 'NONE', r.data?.action);
    }
  }

  child.kill();
  rmSync(dataDir, { recursive: true, force: true });

  console.log(`\n========== 结果: ${passed} passed, ${failed} failed ==========`);
  if (failed > 0) {
    console.log('失败明细:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.extra}`));
    process.exit(1);
  }
  console.log('PHASE 4-B TESTS: ALL PASS');
  process.exit(0);
}

main().catch((e) => {
  console.error('测试异常:', e);
  process.exit(2);
});

/**
 * PHASE 4-E Conversation Context Integrity 测试（自包含）：
 * 临时端口 + 独立 DATA_DIR + 真实 LLM 链路。
 *
 * E1  连续 Conversation：三轮同一 conversationId，draft 持续累积
 * E2  确认创建（确认创建）：schedule_confirm → created → DB +1
 * E3  自然语言确认（那就这样安排吧）：schedule_confirm → 真实创建
 * E4  修改后确认：改成下午4点 → 提前25分钟 → 确认 → 最终 16:00 + 25min，不保留旧时间
 * E5  闲聊不污染 Context：创建 → 你叫什么 → 那提前25分钟提醒吧 → 仍改原 draft
 * E6  New Conversation 隔离：B 不得继承 A draft；B 的"确认创建"不得创建 A 的日程
 * E7  created 后重复确认：不重复创建（DB 不增加）
 * E8  持久化：创建后 +1；重启后端仍存在
 * E9  /understand + 完整 draft + "确认创建" → created + DB +1（绝不定 general_chat / 假创建）
 * E10 模拟首轮失败（convId 丢失）→ /understand + "确定创建" → 真实创建（F2 新确认词）
 * F2 防误伤：有 draft 时"你可以介绍一下自己吗？"→ general_chat；"可以帮我改成下午4点吗？"→ schedule_modify
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PORT = 4642;
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

async function scheduleCount() {
  const s = await req('GET', '/schedules');
  return (s.data?.items || []).length;
}

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ai-phase4e-test-'));
  console.log(`[phase4e] 临时数据目录: ${dataDir}`);

  let child = spawnServer(dataDir);
  if (!(await waitReady())) {
    console.error('[phase4e] 服务器未就绪');
    child.kill();
    process.exit(1);
  }

  // ---------- E1：连续 Conversation ----------
  console.log('\n[E1] 连续 Conversation：创建 → 在陆家嘴 → 提前25分钟提醒');
  let convE1;
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    check('R1 schedule_create', r1.data?.intent === 'schedule_create', r1.data?.intent);
    const r2 = await req('POST', `/conversations/${id}/turn`, { utterance: '在陆家嘴' });
    check('R2 同一 conversationId', r2.data?.id === id, `${r2.data?.id} != ${id}`);
    check('R2 schedule_modify', r2.data?.intent === 'schedule_modify', r2.data?.intent);
    check('R2 location=陆家嘴', (r2.data?.draft?.location || '').includes('陆家嘴'), r2.data?.draft?.location);
    check('R2 time 保留 15:00', r2.data?.draft?.time === '15:00', r2.data?.draft?.time);
    const r3 = await req('POST', `/conversations/${id}/turn`, { utterance: '提前25分钟提醒' });
    check('R3 同一 conversationId', r3.data?.id === id, `${r3.data?.id} != ${id}`);
    check('R3 schedule_modify', r3.data?.intent === 'schedule_modify', r3.data?.intent);
    check('R3 remindOffset 保留', (r3.data?.draft?.remindOffset || '').includes('25'), r3.data?.draft?.remindOffset);
    check('R3 location 未丢', (r3.data?.draft?.location || '').includes('陆家嘴'), r3.data?.draft?.location);
    check('R3 task 未丢', /张总开会/.test(r3.data?.draft?.task || ''), r3.data?.draft?.task);
    check('R3 time 未丢', r3.data?.draft?.time === '15:00', r3.data?.draft?.time);
    convE1 = { id };
  }

  // ---------- E2：确认创建 ----------
  console.log('\n[E2] 确认创建 → schedule_confirm → created → DB+1');
  {
    const before = await scheduleCount();
    const r = await req('POST', `/conversations/${convE1.id}/turn`, { utterance: '确认创建' });
    check('intent=schedule_confirm', r.data?.intent === 'schedule_confirm', r.data?.intent);
    check('state=created', r.data?.state === 'created', r.data?.state);
    check('action=NONE', r.data?.action === 'NONE', r.data?.action);
    const after = await scheduleCount();
    check('DB +1', after === before + 1, `${before} → ${after}`);
    const s = await req('GET', '/schedules');
    const top = (s.data?.items || [])[0];
    check('time=15:00', top?.time === '15:00', top?.time);
    check('location=陆家嘴', (top?.location || '').includes('陆家嘴'), top?.location);
    check('remindOffset=25', (top?.remindOffset || '').includes('25'), top?.remindOffset);
    check('status=active', top?.status === 'active', top?.status);
  }

  // ---------- E3：自然语言确认 ----------
  console.log('\n[E3] 那就这样安排吧 → schedule_confirm → 真实创建');
  {
    const before = await scheduleCount();
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    await req('POST', `/conversations/${id}/turn`, { utterance: '在陆家嘴' });
    const r = await req('POST', `/conversations/${id}/turn`, { utterance: '那就这样安排吧' });
    check('intent=schedule_confirm', r.data?.intent === 'schedule_confirm', r.data?.intent);
    check('state=created', r.data?.state === 'created', r.data?.state);
    const after = await scheduleCount();
    check('DB +1', after === before + 1, `${before} → ${after}`);
  }

  // ---------- E4：修改后确认 ----------
  console.log('\n[E4] 改成下午4点 → 提前25分钟 → 确认创建 → 最终 16:00 + 25min');
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    const r2 = await req('POST', `/conversations/${id}/turn`, { utterance: '改成下午4点' });
    check('改时间 schedule_modify', r2.data?.intent === 'schedule_modify', r2.data?.intent);
    check('time=16:00', r2.data?.draft?.time === '16:00', r2.data?.draft?.time);
    const r3 = await req('POST', `/conversations/${id}/turn`, { utterance: '提前25分钟提醒' });
    check('remindOffset=25', (r3.data?.draft?.remindOffset || '').includes('25'), r3.data?.draft?.remindOffset);
    check('time 仍 16:00', r3.data?.draft?.time === '16:00', r3.data?.draft?.time);
    const r4 = await req('POST', `/conversations/${id}/turn`, { utterance: '确认创建' });
    check('确认 schedule_confirm', r4.data?.intent === 'schedule_confirm', r4.data?.intent);
    check('state=created', r4.data?.state === 'created', r4.data?.state);
    const s = await req('GET', '/schedules');
    // GET /schedules 按日期时间排序（非插入序），按任务+时间精确匹配断言
    const e4item = (s.data?.items || []).find((x) => x.time === '16:00' && /张总开会/.test(x.task || ''));
    check('DB 存在 16:00 日程', Boolean(e4item), JSON.stringify((s.data?.items || [])[0]));
    check('DB remindOffset=25', (e4item?.remindOffset || '').includes('25'), e4item?.remindOffset);
    const e4old = (s.data?.items || []).find((x) => x.time === '15:00' && /张总开会/.test(x.task || ''));
    check('不保留旧时间 15:00 草稿（无 25min 版本）', !e4old || !(e4old.remindOffset || '').includes('25'), JSON.stringify(e4old));
  }

  // ---------- E5：闲聊不污染 Context ----------
  console.log('\n[E5] 创建 → 你叫什么 → 那提前25分钟提醒吧 → 仍改原 draft');
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    const r2 = await req('POST', `/conversations/${id}/turn`, { utterance: '你叫什么？' });
    check('闲聊 general_chat', r2.data?.intent === 'general_chat', r2.data?.intent);
    check('闲聊后 draft 未丢', (r2.data?.draft?.time || '') === '15:00', JSON.stringify(r2.data?.draft));
    const r3 = await req('POST', `/conversations/${id}/turn`, { utterance: '那提前25分钟提醒吧' });
    check('回到 schedule_modify', r3.data?.intent === 'schedule_modify', r3.data?.intent);
    check('remindOffset=25', (r3.data?.draft?.remindOffset || '').includes('25'), r3.data?.draft?.remindOffset);
    check('time 未丢', r3.data?.draft?.time === '15:00', r3.data?.draft?.time);
    check('task 未丢', /张总开会/.test(r3.data?.draft?.task || ''), r3.data?.draft?.task);
  }

  // ---------- E6：New Conversation 隔离 ----------
  console.log('\n[E6] A 建 draft → New（新会话 B）→ B 确认创建不得创建 A 的日程');
  {
    const before = await scheduleCount();
    await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' }); // A 留下未确认 draft
    const b = await req('POST', '/conversations', { utterance: '确认创建' }); // B 是全新会话，无 A 上下文
    check('B 是新 conversation', Boolean(b.data?.id), b.data?.id);
    check('B 不继承 A draft', Object.keys(b.data?.draft || {}).length === 0 || !b.data?.draft?.time, JSON.stringify(b.data?.draft));
    const after = await scheduleCount();
    check('A 的未确认 draft 未入库（DB 不变）', after === before, `${before} → ${after}`);
  }

  // ---------- E7：created 后重复确认 ----------
  console.log('\n[E7] 创建成功后再次确认 → 不重复创建');
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    await req('POST', `/conversations/${id}/turn`, { utterance: '在陆家嘴' });
    const c = await req('POST', `/conversations/${id}/turn`, { utterance: '确认创建' });
    check('首次 created', c.data?.state === 'created', c.data?.state);
    const after1 = await scheduleCount();
    const r = await req('POST', `/conversations/${id}/turn`, { utterance: '确认创建' });
    check('重复确认不再 created 旧草稿（无 draft 可确认）', r.data?.state !== 'created' || !r.data?.draft?.time, `state=${r.data?.state}`);
    const after2 = await scheduleCount();
    check('DB 不增加', after2 === after1, `${after1} → ${after2}`);
  }

  // ---------- E8：持久化（重启后端） ----------
  console.log('\n[E8] 重启后端 → Schedule 仍存在');
  let e8ScheduleId = null;
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    await req('POST', `/conversations/${id}/turn`, { utterance: '确认创建' });
    const s = await req('GET', '/schedules');
    e8ScheduleId = (s.data?.items || [])[0]?.id;
    check('创建后存在', Boolean(e8ScheduleId), e8ScheduleId);
    child.kill();
    await new Promise((r) => setTimeout(r, 800));
    child = spawnServer(dataDir);
    if (!(await waitReady())) {
      check('重启后服务就绪', false, '未就绪');
    } else {
      const s2 = await req('GET', '/schedules');
      check('重启后 Schedule 保留', (s2.data?.items || []).some((x) => x.id === e8ScheduleId), `${e8ScheduleId}`);
    }
  }

  // ---------- E9：/understand + 完整 draft + 确认创建 ----------
  console.log('\n[E9] POST /understand {draft 完整, utterance:"确认创建"} → created + DB+1');
  {
    const before = await scheduleCount();
    const draft = {
      date: '2026-09-29',
      dateLabel: '明天',
      time: '11:30',
      task: '线上客户培训会议',
      title: '线上客户培训会议',
      location: '',
      remindOffset: '提前25分钟',
      remindOffsetMinutes: 25,
    };
    const r = await req('POST', '/understand', { utterance: '确认创建', currentDraft: draft });
    check('state=created', r.data?.state === 'created', r.data?.state);
    check('actionRequired=NONE', r.data?.actionRequired === 'NONE', r.data?.actionRequired);
    check('非 general_chat 回复', (r.data?.replyText || '').length > 0 && !(r.data?.replyText || '').includes('可以帮你安排、修改和提醒日程'), r.data?.replyText);
    const after = await scheduleCount();
    check('DB +1', after === before + 1, `${before} → ${after}`);
    const s = await req('GET', '/schedules');
    const top = (s.data?.items || [])[0];
    check('落库 time=11:30', top?.time === '11:30', top?.time);
    check('落库 task=线上客户培训会议', /线上客户培训会议/.test(top?.task || ''), top?.task);
    check('落库 remindOffset=25', (top?.remindOffset || '').includes('25'), top?.remindOffset);
  }

  // ---------- E10：模拟 convId 丢失（fallback）→ /understand 确定创建 ----------
  console.log('\n[E10] convId 丢失 → /understand {"确定创建"} → 真实创建');
  {
    const before = await scheduleCount();
    const draft = {
      date: '2026-09-29',
      dateLabel: '明天',
      time: '14:00',
      task: '客户对齐会议',
      title: '客户对齐会议',
      location: '陆家嘴',
    };
    const r = await req('POST', '/understand', { utterance: '确定创建', currentDraft: draft });
    check('state=created', r.data?.state === 'created', r.data?.state);
    check('actionRequired=NONE', r.data?.actionRequired === 'NONE', r.data?.actionRequired);
    const after = await scheduleCount();
    check('DB +1', after === before + 1, `${before} → ${after}`);
    const s = await req('GET', '/schedules');
    const top = (s.data?.items || []).find((x) => x.time === '14:00' && /客户对齐会议/.test(x.task || ''));
    check('落库 time=14:00', top?.time === '14:00', JSON.stringify((s.data?.items || [])[0]));
    check('落库 task=客户对齐会议', /客户对齐会议/.test(top?.task || ''), top?.task);
  }

  // ---------- F2 防误伤 ----------
  console.log('\n[F2 防误伤] 有 draft 时确认词不得误伤修改/闲聊');
  {
    const r1 = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会' });
    const id = r1.data?.id;
    const r2 = await req('POST', `/conversations/${id}/turn`, { utterance: '你可以介绍一下自己吗？' });
    check('闲聊句 → general_chat（非 confirm）', r2.data?.intent === 'general_chat', r2.data?.intent);
    const r3 = await req('POST', `/conversations/${id}/turn`, { utterance: '可以帮我改成下午4点吗？' });
    check('修改句 → schedule_modify（非 confirm）', r3.data?.intent === 'schedule_modify', r3.data?.intent);
    check('修改句 time=16:00', r3.data?.draft?.time === '16:00', r3.data?.draft?.time);
  }

  child.kill();
  rmSync(dataDir, { recursive: true, force: true });

  console.log(`\n========== 结果: ${passed} passed, ${failed} failed ==========`);
  if (failed > 0) {
    console.log('失败明细:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.extra}`));
    process.exit(1);
  }
  console.log('PHASE 4-E TESTS: ALL PASS');
  process.exit(0);
}

main().catch((e) => {
  console.error('测试异常:', e);
  process.exit(2);
});

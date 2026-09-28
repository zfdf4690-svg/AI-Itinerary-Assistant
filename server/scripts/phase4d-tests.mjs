/**
 * PHASE 4-D 测试（自包含）：临时端口 + 独立 DATA_DIR + 真实 LLM 链路。
 * T-D2-1: 会话 A 建草稿 → 新建会话 B 说"可以" → general_chat，不得创建 A 的日程
 * T-D2-2: 会话 B 独立创建草稿（16:00）；A/B id 不同、B 不继承 A
 * T-D3-1: 预置 D+1 15:00 客户拜访 → "明天下午三点有个客户对齐会议"+"不用了" → exact 冲突
 * T-D3-4: 同一会话 confirm → 新日程落库（仍按原时间创建）
 * T-D3-2: 预置 D+2 14:30 → "后天下午三点…" → nearby（非 exact）
 * T-D3-3: 预置 D+3 10:00 → "M月D号下午三点…" → no conflict
 * T-D3-5: exact 会话 → "改到下午6点"→"不用了" → 18:00 卡片无冲突 → confirm 落库
 * T-M1:   无事项词 → matters 为空；"讨论二期项目" → matters 写入
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PORT = 4640;
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

function spawnServer(dataDir) {
  const child = spawn(process.execPath, [path.join(SERVER_ROOT, 'dist', 'index.js')], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      LLM_ENABLED: 'true',
      MINIMAX_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function waitReady() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r2) => setTimeout(r2, 300));
  }
  return false;
}

const pad = (n) => String(n).padStart(2, '0');
function offsetDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    monthDay: `${d.getMonth() + 1}月${d.getDate()}号`,
  };
}

async function seedSchedule(body) {
  return (await req('POST', '/schedules', body)).data;
}

async function newConv(utterance) {
  return (await req('POST', '/conversations', { utterance })).data;
}
async function turn(convId, utterance) {
  return (await req('POST', `/conversations/${convId}/turn`, { utterance })).data;
}
async function confirm(convId) {
  return (await req('POST', `/conversations/${convId}/confirm`)).data;
}

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ai-phase4d-test-'));
  console.log(`[phase4d-tests] 临时数据目录: ${dataDir}`);
  const child = spawnServer(dataDir);
  if (!(await waitReady())) {
    console.error('[phase4d-tests] 服务器未就绪');
    child.kill();
    process.exit(1);
  }

  const D1 = offsetDate(1); // 服务器本地"明天"
  const D2 = offsetDate(2); // 后天
  const D3 = offsetDate(3); // 大后天
  console.log(`[phase4d-tests] 基准日期 明天=${D1.date} 后天=${D2.date} 大后天=${D3.date}`);

  // ---------- T-D2-1 / T-D2-2：New Conversation 会话隔离 ----------
  console.log('\n== T-D2: New Conversation ==');
  const a1 = await newConv('明天下午三点和张总开会');
  const convA = a1.conversation || a1;
  check('D2-A draft.time=15:00', convA.draft && convA.draft.time === '15:00', JSON.stringify(convA.draft));
  check('D2-A intent=schedule_create', convA.intent === 'schedule_create', convA.intent);

  // 模拟前端"＋ New"：新会话 = 全新 POST /conversations
  const b1 = await newConv('可以');
  const convB = b1.conversation || b1;
  check('D2-B "可以"→general_chat', convB.intent === 'general_chat', convB.intent);
  check('D2-B 无 draft（不继承 A）', !convB.draft || Object.keys(convB.draft).length === 0, JSON.stringify(convB.draft));
  check('D2-A/B id 不同', convA.id !== convB.id, `${convA.id} vs ${convB.id}`);
  const schedsAfter = (await req('GET', '/schedules')).data;
  check('D2-B 未创建任何日程', schedsAfter.total === 0, `total=${schedsAfter.total}`);

  const b2 = await turn(convB.id, '明天下午四点开会');
  const convB2 = b2.conversation || b2;
  check('D2-B 独立草稿 time=16:00', convB2.draft && convB2.draft.time === '16:00', JSON.stringify(convB2.draft));
  check('D2-B 同一会话（id 不变）', (b2.conversation || b2).id === convB.id);
  check('D2-B turns 不包含 A 内容', !JSON.stringify(convB2.turns).includes('与张总开会'));

  // ---------- T-D3-1 / T-D3-4：exact 冲突 + 仍按原时间创建 ----------
  console.log('\n== T-D3-1/4: exact conflict + confirm ==');
  await seedSchedule({ time: '15:00', date: D1.date, dateLabel: '明天', task: '客户拜访', title: '客户拜访', location: '陆家嘴', status: 'active' });
  const c1 = await newConv('明天下午三点有个客户对齐会议');
  const convC = c1.conversation || c1;
  const c2 = await turn(convC.id, '不用了');
  const convC2 = c2.conversation || c2;
  check('D3-1 state=card_ready', convC2.state === 'card_ready', convC2.state);
  check('D3-1 action=SHOW_SCHEDULE_CARD', convC2.action === 'SHOW_SCHEDULE_CARD', convC2.action);
  check('D3-1 conflict.hasConflict=true', !!convC2.conflict && convC2.conflict.hasConflict === true, JSON.stringify(convC2.conflict));
  check('D3-1 level=exact', convC2.conflict && convC2.conflict.level === 'exact', convC2.conflict && convC2.conflict.level);
  check('D3-1 conflicts 含客户拜访', JSON.stringify(convC2.conflict ? convC2.conflict.conflicts : []).includes('客户拜访'));

  const cf = await confirm(convC.id);
  check('D3-4 confirm 返回 schedule', !!(cf.schedule && cf.schedule.id), JSON.stringify(cf.schedule));
  const schedsAfterC = (await req('GET', '/schedules')).data;
  const cCreated = schedsAfterC.items.filter((s) => s.task === '客户对齐会议' && s.status === 'active');
  check('D3-4 新日程落库（15:00 客户对齐会议）', cCreated.length >= 1, `count=${cCreated.length}`);
  check('D3-4 冲突日程保留（未删除旧日程）', schedsAfterC.items.filter((s) => s.task === '客户拜访').length === 1);

  // ---------- T-D3-2：nearby（非 exact） ----------
  console.log('\n== T-D3-2: nearby ==');
  await seedSchedule({ time: '14:30', date: D2.date, dateLabel: '后天', task: '供应商回访', title: '供应商回访', location: '张江', status: 'active' });
  const d1 = await newConv(`后天下午三点有个对齐会议`);
  const convD = d1.conversation || d1;
  const d2 = await turn(convD.id, '不用了');
  const convD2 = d2.conversation || d2;
  check('D3-2 nearby level=nearby', convD2.conflict && convD2.conflict.level === 'nearby', JSON.stringify(convD2.conflict));
  check('D3-2 不是 exact', convD2.conflict && convD2.conflict.level !== 'exact');
  check('D3-2 draft.time=15:00（未自动改时间）', convD2.draft && convD2.draft.time === '15:00', JSON.stringify(convD2.draft));

  // ---------- T-D3-3：无冲突 ----------
  console.log('\n== T-D3-3: none ==');
  await seedSchedule({ time: '10:00', date: D3.date, dateLabel: '大后天', task: '晨会', title: '晨会', status: 'active' });
  const e1 = await newConv(`${D3.monthDay}下午三点有个对齐会议`);
  const convE = e1.conversation || e1;
  const e2 = await turn(convE.id, '不用了');
  const convE2 = e2.conversation || e2;
  check('D3-3 conflict=none 或 hasConflict=false', !convE2.conflict || convE2.conflict.hasConflict === false, JSON.stringify(convE2.conflict));

  // ---------- T-D3-5：冲突后调整时间 → 重查 → 无冲突 → confirm ----------
  console.log('\n== T-D3-5: adjust time then recheck ==');
  const f1 = await newConv('明天下午三点有个客户对齐会议');
  const convF = f1.conversation || f1;
  await turn(convF.id, '不用了');
  const f3 = await turn(convF.id, '改到下午6点');
  const convF3 = f3.conversation || f3;
  check('D3-5 修改后 draft.time=18:00', convF3.draft && convF3.draft.time === '18:00', JSON.stringify(convF3.draft));
  check('D3-5 修改后保留 task', convF3.draft && convF3.draft.task === '客户对齐会议');
  const f4 = await turn(convF.id, '不用了');
  const convF4 = f4.conversation || f4;
  check('D3-5 调整后重查无冲突', !convF4.conflict || convF4.conflict.hasConflict === false, JSON.stringify(convF4.conflict));
  check('D3-5 调整后 card_ready', convF4.state === 'card_ready', convF4.state);
  const cfF = await confirm(convF.id);
  const schedsAfterF = (await req('GET', '/schedules')).data;
  const fCreated = schedsAfterF.items.filter((s) => s.task === '客户对齐会议' && s.time === '18:00' && s.status === 'active');
  check('D3-5 18:00 新日程落库', fCreated.length >= 1, `count=${fCreated.length}`);

  // ---------- T-M1：matters 门控 ----------
  console.log('\n== T-M1: matters conservative ==');
  const g1 = await newConv('明天下午三点和张总开会');
  const convG = g1.conversation || g1;
  check('M1 无事项词 → matters 为空', !convG.draft.matters, JSON.stringify(convG.draft.matters));
  const h1 = await newConv('明天下午三点和张总开会，讨论二期项目');
  const convH = h1.conversation || h1;
  check('M1 明确讨论 → matters 含二期项目', typeof convH.draft.matters === 'string' && convH.draft.matters.includes('二期项目'), JSON.stringify(convH.draft.matters));

  // ---------- 汇总 ----------
  child.kill();
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n[phase4d-tests] PASS=${passed} FAIL=${failed}`);
  if (failures.length) {
    console.log('失败明细:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.extra}`);
  }
  process.exit(failed ? 1 : 0);
}

main();

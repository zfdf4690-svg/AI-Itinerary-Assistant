/**
 * E2E 联调验证（任务书 §30/§31）：
 * 模拟前端 apiClient 的完整调用序列：
 *   Home(输入) → /conversations 首轮理解 → 追问可选字段 → 拒绝 → 卡片
 *   → confirm 创建 → PATCH 局部修改 → 重启服务 → 数据持久化不丢
 *
 * 运行：node scripts/e2e.mjs（自行 spawn dist/index.js，独立 DATA_DIR，结束清理）
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

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
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function spawnServer(dataDir, port) {
  const child = spawn(process.execPath, [path.join(SERVER_ROOT, 'dist', 'index.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      LLM_ENABLED: 'false',
      MINIMAX_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`));
  return child;
}

async function waitReady(port, timeoutMs = 15000) {
  const base = `http://127.0.0.1:${port}/api/v1`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r2) => setTimeout(r2, 300));
  }
  return false;
}

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ai-schedule-e2e-'));
  console.log(`[e2e] 临时数据目录: ${dataDir}`);
  console.log(`[e2e] 端口: ${PORT}`);

  console.log('\n[1] 启动后端（首次）');
  let child = spawnServer(dataDir, PORT);
  const ready = await waitReady(PORT);
  check('后端就绪', ready);
  if (!ready) {
    child.kill();
    process.exit(1);
  }

  console.log('\n[2] 首轮理解：明天下午三点和张总开会 → 追问地点（任务书 §30 链路）');
  let convId;
  {
    const r = await req('POST', '/conversations', { utterance: '明天下午三点和张总开会', personaId: 'gentle' });
    convId = r.data?.id;
    check('会话创建成功', Boolean(convId), JSON.stringify(r.data));
    check('状态=awaiting_supplement（追问可选）', r.data?.state === 'awaiting_supplement', `state=${r.data?.state}`);
    check('action=ASK_OPTIONAL', r.data?.action === 'ASK_OPTIONAL', `action=${r.data?.action}`);
    check('missingOptional 含 location', (r.data?.missing || []).includes('location'));
    check('草稿含时间/任务', r.data?.draft?.time === '15:00' && String(r.data?.draft?.task).includes('张总'));
    check('回复为委婉追问（含“先不填”）', /先不填/.test(String(lastAi(r.data))), lastAi(r.data));
  }

  console.log('\n[3] 拒绝补充：不用了 → 卡片（不阻塞创建，PRD §15）');
  let schedule;
  {
    const r = await req('POST', `/conversations/${convId}/turn`, { utterance: '不用了' });
    check('状态=card_ready', r.data?.state === 'card_ready', `state=${r.data?.state}`);
    check('action=SHOW_SCHEDULE_CARD', r.data?.action === 'SHOW_SCHEDULE_CARD', `action=${r.data?.action}`);
  }

  console.log('\n[4] 确认创建 → 日程持久化（④ → ⑤）');
  {
    const r = await req('POST', `/conversations/${convId}/confirm`);
    schedule = r.data?.schedule;
    check('创建成功并返回日程', Boolean(schedule?.id), JSON.stringify(r.data));
    check('会话状态=created', r.data?.conversation?.state === 'created');
    check('会话 action=NONE', r.data?.conversation?.action === 'NONE');
    check('日程 5 字段完整', schedule?.time === '15:00' && String(schedule?.task).includes('张总'));
  }

  console.log('\n[5] PATCH 局部修改：地点改到陆家嘴（任务书 §7，只更新传入字段）');
  {
    const r = await req('PATCH', `/schedules/${schedule?.id}`, { location: '陆家嘴' });
    check('修改成功', r.status === 200 && r.data?.location === '陆家嘴', JSON.stringify(r.data));
    check('其他字段保留', r.data?.time === '15:00' && String(r.data?.task).includes('张总'));
    check('提醒保留', String(r.data?.remindOffset).length > 0);
  }

  console.log('\n[6] 查看日历列表（GET /schedules）');
  {
    const r = await req('GET', '/schedules');
    check('列表含新日程', r.data?.items?.some((s) => s.id === schedule?.id));
    check('列表字段与前端契约一致', r.data?.items?.[0]?.time && r.data?.items?.[0]?.task && r.data?.items?.[0]?.dateLabel !== undefined);
  }

  console.log('\n[7] 重启后端（同 DATA_DIR）→ 持久化不丢（任务书 DoD）');
  child.kill();
  await new Promise((r2) => setTimeout(r2, 800));
  child = spawnServer(dataDir, PORT);
  const ready2 = await waitReady(PORT);
  check('重启后后端就绪', ready2);
  {
    const r = await req('GET', '/schedules');
    const found = r.data?.items?.find((s) => s.id === schedule?.id);
    check('重启后日程仍在', Boolean(found), JSON.stringify(r.data?.items));
    check('重启后局部修改仍生效', found?.location === '陆家嘴', `location=${found?.location}`);
    check('重启后状态仍为 active', found?.status === 'active');
  }

  console.log('\n[8] 会话与记忆层可追溯（Memory 三层）');
  {
    const events = await req('GET', '/memory/events');
    check('Event Memory 记录日程', events.data?.items?.some((e) => e.scheduleId === schedule?.id));
    const entities = await req('GET', '/memory/entities');
    check('Entity Memory 记录人物张总', entities.data?.items?.some((e) => e.type === 'person' && String(e.name).includes('张总')));
    const prefs = await req('GET', '/memory/preferences');
    check('Preference Memory 可读', prefs.status === 200);
  }

  // 清理
  child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('\n========================================');
  console.log(`E2E 结果: ${passed} 通过, ${failed} 失败`);
  if (failures.length) {
    console.log('失败明细:');
    for (const f of failures) console.log(`  - ${f.name} ${f.extra}`);
    process.exit(1);
  }
  console.log('E2E 全部通过 ✅');
  process.exit(0);
}

function lastAi(conv) {
  if (!conv?.turns) return '';
  for (let i = conv.turns.length - 1; i >= 0; i -= 1) {
    if (conv.turns[i].role === 'ai') return conv.turns[i].text;
  }
  return '';
}

main().catch((err) => {
  console.error('[e2e] 异常', err);
  process.exit(1);
});

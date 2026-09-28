/**
 * 后端冒烟测试（自包含）：
 * 启动一个临时端口上的服务器（独立 DATA_DIR），按 PRD P0 验收场景逐项断言：
 *  1. 健康检查
 *  2. 完整输入 → 直接生成完整卡片（card_ready，5 字段齐全）
 *  3. 缺少可选信息 → 委婉追问；拒绝后仍生成卡片
 *  4. 缺少时间 → 必须询问
 *  5. 局部修改（地点/时间/事项/提醒）→ 只改对应字段
 *  6. 会话状态机：输入→理解→补充→卡片→确认→已创建
 *  7. 日程 CRUD
 *  8. 提醒引擎（到期触发 + 每日简报 + 晚间复盘）
 *  9. Memory（Event / Entity / Preference）
 * 10. Persona（3 套）
 * 11. TTS / ASR 未配置 → 明确降级状态
 * 12. 配置读写（Key 脱敏）
 *
 * 运行：npm run smoke（需先 build 或直接 dev 起服务；本脚本自行 spawn）
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

async function main() {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ai-schedule-smoke-'));
  console.log(`[smoke] 临时数据目录: ${dataDir}`);

  const child = spawn(process.execPath, [path.join(SERVER_ROOT, 'dist', 'index.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      LLM_ENABLED: 'false',
      MINIMAX_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`));

  // 等待服务就绪
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry */
    }
    await new Promise((r2) => setTimeout(r2, 300));
  }
  if (!ready) {
    console.error('[smoke] 服务器未在预期时间内就绪');
    child.kill();
    process.exit(1);
  }

  console.log('\n[1] 健康检查');
  {
    const r = await req('GET', '/health');
    check('GET /health 返回 ok', r.status === 200 && r.data?.status === 'ok', JSON.stringify(r.data));
    check('健康检查声明核心能力', r.data?.features?.scheduleCore === true && r.data?.features?.reminderEngine === true);
  }

  console.log('\n[2] 完整输入 → 直接生成完整卡片（PRD 验收 1）');
  {
    const r = await req('POST', '/understand', {
      utterance: '明天下午三点和张总开会，地点在上海虹桥，讨论二期项目，提前30分钟提醒',
      personaId: 'gentle',
    });
    check('状态为 card_ready', r.data?.state === 'card_ready', JSON.stringify(r.data));
    check('5 字段齐全：time', r.data?.slots?.time === '15:00', JSON.stringify(r.data?.slots));
    check('5 字段齐全：task', String(r.data?.slots?.task).includes('张总'), String(r.data?.slots?.task));
    check('5 字段齐全：location', r.data?.slots?.location?.includes('虹桥'));
    check('5 字段齐全：matters', String(r.data?.slots?.matters).includes('二期'));
    check('5 字段齐全：remindOffset', String(r.data?.slots?.remindOffset).includes('30'));
    check('无必填/可选缺失', r.data?.missingRequired?.length === 0 && r.data?.missingOptional?.length === 0);
    check('动作=展示日程卡片', r.data?.actionRequired === 'SHOW_SCHEDULE_CARD', JSON.stringify(r.data?.actionRequired));
    check('date 为明天', r.data?.slots?.date === futureDate(1), `got=${r.data?.slots?.date}`);
  }

  console.log('\n[3] 缺少可选信息 → 委婉追问；拒绝后仍生成卡片（PRD 验收 2 / §15 原则 1）');
  {
    const r = await req('POST', '/understand', {
      utterance: '明天下午三点和张总开会',
      personaId: 'gentle',
    });
    check('状态为 awaiting_supplement', r.data?.state === 'awaiting_supplement', JSON.stringify(r.data));
    check('追问可选字段（地点）', (r.data?.missingOptional || []).includes('location'));
    check('动作=追问可选字段', r.data?.actionRequired === 'ASK_OPTIONAL', JSON.stringify(r.data?.actionRequired));
    check('回复为委婉追问（含“先不填”）', /先不填/.test(String(r.data?.replyText)), r.data?.replyText);

    const r2 = await req('POST', '/understand', {
      utterance: '不用了',
      personaId: 'gentle',
      currentDraft: r.data?.slots,
    });
    check('拒绝后状态为 card_ready（不阻塞创建）', r2.data?.state === 'card_ready', JSON.stringify(r2.data));
    check('拒绝后动作=展示日程卡片', r2.data?.actionRequired === 'SHOW_SCHEDULE_CARD', JSON.stringify(r2.data?.actionRequired));
  }

  console.log('\n[4] 缺少时间 → 必须询问（PRD 验收 3）');
  {
    const r = await req('POST', '/understand', {
      utterance: '和张总开个会',
      personaId: 'gentle',
    });
    check('状态为 awaiting_clarify', r.data?.state === 'awaiting_clarify', JSON.stringify(r.data));
    check('missingRequired 含 time', (r.data?.missingRequired || []).includes('time'));
    check('动作=必须澄清', r.data?.actionRequired === 'ASK_REQUIRED', JSON.stringify(r.data?.actionRequired));
  }

  console.log('\n[5] 局部修改 → 只改对应字段（PRD §7 / 验收 4-5）');
  {
    const first = await req('POST', '/understand', {
      utterance: '明天下午三点和张总开会，地点在上海虹桥，讨论二期项目，提前30分钟提醒',
      personaId: 'professional',
    });
    const draft = first.data?.slots;

    const r = await req('POST', '/understand', {
      utterance: '地点不是虹桥，是陆家嘴',
      personaId: 'professional',
      currentDraft: draft,
    });
    check('地点已更新', String(r.data?.slots?.location).includes('陆家嘴'), JSON.stringify(r.data?.slots));
    check('时间保持不变', r.data?.slots?.time === '15:00');
    check('任务保持不变', String(r.data?.slots?.task).includes('张总'));

    const r2 = await req('POST', '/understand', {
      utterance: '改到后天下午四点',
      personaId: 'professional',
      currentDraft: r.data?.slots,
    });
    check('时间已更新为 16:00', r2.data?.slots?.time === '16:00', JSON.stringify(r2.data?.slots));
    check('日期已更新为后天', r2.data?.slots?.date === futureDate(2), `got=${r2.data?.slots?.date}`);

    const r3 = await req('POST', '/understand', {
      utterance: '提醒改成提前1小时',
      personaId: 'professional',
      currentDraft: r2.data?.slots,
    });
    check('提醒已更新为提前1小时', String(r3.data?.slots?.remindOffset).includes('1小时'));
    check('提醒分钟数=60', r3.data?.slots?.remindOffsetMinutes === 60);

    const r4 = await req('POST', '/understand', {
      utterance: '事项改成讨论合同',
      personaId: 'professional',
      currentDraft: r3.data?.slots,
    });
    check('事项已更新为讨论合同', String(r4.data?.slots?.matters).includes('合同'));
    check('地点/时间保持不变', r4.data?.slots?.location?.includes('陆家嘴') && r4.data?.slots?.time === '16:00');
  }

  console.log('\n[6] 会话状态机（PRD §5：输入→理解→补充→卡片→已创建）');
  let convId;
  {
    const r = await req('POST', '/conversations', {
      utterance: '明天下午三点和张总开会',
      personaId: 'gentle',
    });
    convId = r.data?.id;
    check('会话已创建', Boolean(convId));
    check('首轮进入补充状态', r.data?.state === 'awaiting_supplement', JSON.stringify(r.data));
    check('会话 action=追问可选', r.data?.action === 'ASK_OPTIONAL', JSON.stringify(r.data?.action));

    const r2 = await req('POST', `/conversations/${convId}/turn`, {
      utterance: '在上海虹桥',
    });
    check('补充地点后进入卡片状态', r2.data?.state === 'card_ready', JSON.stringify(r2.data));
    check('地点已合入', String(r2.data?.draft?.location).includes('虹桥'));
    check('会话 action=展示卡片', r2.data?.action === 'SHOW_SCHEDULE_CARD', JSON.stringify(r2.data?.action));

    const r3 = await req('POST', `/conversations/${convId}/turn`, {
      utterance: '不用了',
    });
    check('拒绝补充不阻塞，仍在卡片状态', r3.data?.state === 'card_ready', JSON.stringify(r3.data));

    const r4 = await req('POST', `/conversations/${convId}/confirm`);
    check('确认创建成功', r4.data?.schedule?.id && r4.data?.conversation?.state === 'created', JSON.stringify(r4.data));
    check('创建后会话 action=NONE', r4.data?.conversation?.action === 'NONE', JSON.stringify(r4.data?.conversation?.action));
    check('日程 5 字段完整', r4.data?.schedule?.time === '15:00' && String(r4.data?.schedule?.task).includes('张总'));
    check('日期标签正确', String(r4.data?.schedule?.dateLabel).includes('明天'));
  }

  console.log('\n[7] 日程 CRUD');
  let schedId;
  {
    const r = await req('POST', '/schedules', {
      time: '10:00',
      date: futureDate(1),
      task: '团队例会',
      title: '团队例会',
      location: '会议室A',
      matters: '季度规划',
      remindOffset: '提前15分钟',
      priority: 'medium',
    });
    schedId = r.data?.id;
    check('创建日程 201', r.status === 201 && Boolean(schedId), JSON.stringify(r.data));
    check('remindOffsetMinutes=15', r.data?.remindOffsetMinutes === 15);

    const r2 = await req('GET', `/schedules/${schedId}`);
    check('按 id 查询', r2.status === 200 && r2.data?.id === schedId);

    const r3 = await req('PATCH', `/schedules/${schedId}`, { matters: '更新后的议题', location: '陆家嘴' });
    check('局部修改只更新字段', r3.data?.matters === '更新后的议题' && r3.data?.location === '陆家嘴');
    check('未修改字段保留', r3.data?.time === '10:00' && r3.data?.task === '团队例会');

    const r4 = await req('PATCH', `/schedules/${schedId}`, { time: undefined, task: undefined });
    // PATCH 传入 undefined 不应清空必填
    check('空字段不破坏已有日程', r4.status === 200, `status=${r4.status}`);

    const r5 = await req('POST', '/schedules', { task: '只有任务没有时间' });
    check('缺少时间创建被拒绝 422', r5.status === 422, `status=${r5.status}`);

    const r6 = await req('DELETE', `/schedules/${schedId}`);
    check('删除日程', r6.status === 200 && r6.data?.ok === true);
  }

  console.log('\n[8] 提醒引擎（到期触发 + 每日简报 + 晚间复盘）');
  {
    // 创建一个已经到期的日程（今天 -1 分钟，提前 5 分钟提醒 → 必然已到期）
    const past = await req('POST', '/schedules', {
      time: minutesAgo(1),
      date: todayDate(),
      task: '已到期测试日程',
      title: '已到期测试日程',
      remindOffset: '提前5分钟',
      priority: 'high',
    });
    check('已到期日程创建成功', past.status === 201);

    const scan = await req('POST', '/reminders/scan');
    check('扫描产生提醒', scan.data?.count >= 1, JSON.stringify(scan.data));
    const alarm = (scan.data?.created || []).find((x) => x.type === 'schedule_alarm');
    check('日程提醒类型正确', Boolean(alarm) && alarm?.scheduleId === past.data?.id);
    check('提醒文案含日程标题', alarm ? String(alarm.message).includes('已到期测试日程') : false);

    const r2 = await req('GET', '/reminders/active');
    check('活跃提醒可查询', r2.data?.items?.length >= 1);

    const dismiss = await req('PATCH', `/reminders/${alarm?.id}/dismiss`);
    check('提醒可标记处理', dismiss.status === 200 && dismiss.data?.dismissed === true);

    const r3 = await req('GET', '/reminders/history');
    check('历史提醒含已处理', r3.data?.items?.length >= 1);

    const cfg = await req('PUT', '/reminders/config', {
      dailyReminderTime: '23:59',
      eveningReviewTime: '23:58',
    });
    check('提醒配置可更新', cfg.status === 200 && cfg.data?.dailyReminderTime === '23:59');

    const cfgBad = await req('PUT', '/reminders/config', { dailyReminderTime: '25:99' });
    check('非法时间被拒绝 400', cfgBad.status === 400);
  }

  console.log('\n[9] Memory Layer（Event / Entity / Preference）');
  {
    const events = await req('GET', '/memory/events');
    check('Event Memory 有历史记录', events.data?.items?.length >= 1);

    const entities = await req('GET', '/memory/entities');
    const person = (entities.data?.items || []).find((e) => e.type === 'person' && String(e.name).includes('张总'));
    check('Entity Memory 记录人物', Boolean(person), JSON.stringify(entities.data?.items?.slice(0, 3)));

    const pref = await req('PUT', '/memory/preferences', { key: 'default_remind_minutes', value: 30 });
    check('Preference 可写入', pref.status === 200 && pref.data?.key === 'default_remind_minutes');

    const prefs = await req('GET', '/memory/preferences');
    check('Preference 可读取（含推导摘要）', prefs.data?.items?.length >= 1 && prefs.data?.derived?.mostCommonRemindMinutes !== undefined);
  }

  console.log('\n[9b] 偏好自然语言识别（任务书 §21：不擅自推断）');
  {
    // 无泛化词 → 不应写入偏好
    const r0 = await req('POST', '/understand', {
      utterance: '这次会议提前30分钟提醒我',
      personaId: 'gentle',
    });
    const prefs0 = await req('GET', '/memory/preferences');
    const meeting0 = (prefs0.data?.items || []).find((p) => p.key === 'defaultMeetingReminder');
    check('单次提醒不写入长期偏好', !meeting0, JSON.stringify(prefs0.data?.items));

    // 明确偏好：「以后会议都提前30分钟提醒我」
    const r = await req('POST', '/understand', {
      utterance: '以后会议都提前30分钟提醒我',
      personaId: 'gentle',
    });
    const prefs = await req('GET', '/memory/preferences');
    const meeting = (prefs.data?.items || []).find((p) => p.key === 'defaultMeetingReminder');
    check('识别并写入 defaultMeetingReminder', Boolean(meeting) && meeting?.value === 30, JSON.stringify(prefs.data?.items));

    // 「以后日程都提前1小时提醒」→ defaultScheduleReminder = 60
    await req('POST', '/understand', {
      utterance: '以后日程都提前1小时提醒',
      personaId: 'gentle',
    });
    const prefs2 = await req('GET', '/memory/preferences');
    const sched = (prefs2.data?.items || []).find((p) => p.key === 'defaultScheduleReminder');
    check('识别并写入 defaultScheduleReminder=60', Boolean(sched) && sched?.value === 60, JSON.stringify(prefs2.data?.items));
  }

  console.log('\n[10] Persona（3 套人格）');
  {
    const r = await req('GET', '/personas');
    check('返回 3 套人格', r.data?.items?.length === 3, JSON.stringify(r.data?.items?.map((p) => p.id)));
    const ids = (r.data?.items || []).map((p) => p.id).sort();
    check('人格 id 正确', JSON.stringify(ids) === JSON.stringify(['energetic', 'gentle', 'professional']));
    check('人格含 Voice 配置', r.data?.items?.every((p) => p.voice?.voiceId));
    const detail = await req('GET', '/personas/gentle');
    check('人格详情可查询', detail.status === 200 && detail.data?.name === '温柔知性');
  }

  console.log('\n[11] TTS / ASR 未配置 → 明确降级状态（PRD §9）');
  {
    const tts = await req('POST', '/voice/tts', { text: '你好，这样安排可以吗？', personaId: 'energetic' });
    check('TTS 未配置返回 503 + 统一错误体', tts.status === 503 && tts.data?.success === false && tts.data?.error?.code === 'tts_not_configured', JSON.stringify(tts.data));
    check('TTS 提示前端回退', tts.data?.error?.details?.fallback === 'browser');

    const ttsVoice = await req('POST', '/voice/tts', { text: '你好', voice: 'male-qn-qingse' });
    check('TTS 兼容 {text, voice} 参数', ttsVoice.status === 503 && ttsVoice.data?.error?.code === 'tts_not_configured');

    const asr = await req('POST', '/voice/asr', { audioBase64: 'AAAA' });
    check('ASR 未配置返回 503 + 统一错误体', asr.status === 503 && asr.data?.error?.code === 'asr_not_configured');
  }

  console.log('\n[12] 配置读写（Key 脱敏）');
  {
    const r = await req('GET', '/config');
    const apiKey = r.data?.llm?.apiKey || '';
    check('配置可读取且 Key 脱敏（空 Key 或掩码）', r.status === 200 && !apiKey.includes('sk-') && (apiKey === '' || apiKey.includes('****')), `apiKey=${apiKey}`);
    const r2 = await req('PUT', '/config', {
      llm: { enabled: true, baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-test-1234567890' },
    });
    check('配置可更新', r2.status === 200 && r2.data?.llm?.model === 'deepseek-chat');
    check('更新后 Key 仍脱敏', String(r2.data?.llm?.apiKey).includes('****') && !String(r2.data?.llm?.apiKey).includes('sk-test'));
    const r3 = await req('GET', '/config');
    check('重启后（本进程内持久化）配置生效', r3.data?.llm?.enabled === true);
  }

  console.log('\n[13] 边界与异常（统一错误格式）');
  {
    const r = await req('POST', '/understand', { utterance: '   ' });
    check('空输入 400 + 统一错误体', r.status === 400 && r.data?.success === false && r.data?.error?.code === 'VALIDATION_ERROR', JSON.stringify(r.data));
    const r2 = await req('GET', '/schedules/not-exist');
    check('不存在日程 404 + 统一错误体', r2.status === 404 && r2.data?.error?.code === 'SCHEDULE_NOT_FOUND', JSON.stringify(r2.data));
    const r3 = await req('GET', '/api/v1/nonexistent');
    check('未知接口 404 + 统一错误体', r3.status === 404 && r3.data?.error?.code === 'NOT_FOUND', JSON.stringify(r3.data));
  }

  // 清理
  child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }

  console.log('\n========================================');
  console.log(`结果: ${passed} 通过, ${failed} 失败`);
  if (failures.length) {
    console.log('失败明细:');
    for (const f of failures) console.log(`  - ${f.name} ${f.extra}`);
    process.exit(1);
  }
  console.log('全部通过 ✅');
  process.exit(0);
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function futureDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function minutesAgo(min) {
  const d = new Date(Date.now() - min * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

main().catch((err) => {
  console.error('[smoke] 异常', err);
  process.exit(1);
});

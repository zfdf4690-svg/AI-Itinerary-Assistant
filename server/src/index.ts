/**
 * AI 语音行程助手 P0 后端入口。
 * 启动流程：初始化仓储（JSON 持久化）→ 启动 Reminder Engine 调度 → 监听端口。
 */
import { ENV } from './config.js';
import { Repos } from './db/repos.js';
import { createApp } from './app.js';
import { scanReminders, startReminderScheduler } from './services/reminders.js';

const repos = new Repos();
const app = createApp(repos);

// 启动时先扫描一次（补齐重启期间到期的提醒）
try {
  scanReminders(repos);
} catch (err) {
  console.warn('[启动] 提醒扫描失败', (err as Error).message);
}

const scheduler = startReminderScheduler(repos);

const server = app.listen(ENV.port, () => {
  console.log('==============================================');
  console.log('  AI 语音行程助手 · P0 后端已启动');
  console.log(`  地址: http://localhost:${ENV.port}`);
  console.log(`  API:  http://localhost:${ENV.port}/api/v1`);
  console.log(`  健康检查: http://localhost:${ENV.port}/api/v1/health`);
  console.log(`  数据目录: ${ENV.dataDir}`);
  console.log(`  允许跨域: ${ENV.corsOrigins.join(', ')}`);
  console.log('==============================================');
});

function shutdown(signal: string) {
  console.log(`\n[退出] 收到 ${signal}，正在关闭…`);
  clearInterval(scheduler);
  server.close(() => {
    process.exit(0);
  });
  // 兜底退出
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

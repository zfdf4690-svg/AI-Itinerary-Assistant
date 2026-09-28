/**
 * Express 应用工厂（便于测试复用）。
 */
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { ENV } from './config.js';
import { Repos } from './db/repos.js';
import { buildApiRouter } from './routes/index.js';
import { ERROR_CODES, sendError } from './utils/response.js';

export function createApp(repos: Repos) {
  const app = express();

  app.use(cors({
    origin(origin, cb) {
      // 允许无 origin 请求（同源/curl）与配置的白名单来源；其余来源静默拒绝（浏览器表现为无 CORS 头）
      cb(null, !origin || ENV.corsOrigins.includes(origin));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '25mb' }));

  // 轻量请求日志（不打印请求体，避免泄露 Key）
  app.use((req, _res, next) => {
    const start = Date.now();
    _res.on('finish', () => {
      console.log(`[api] ${req.method} ${req.originalUrl} -> ${_res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'AI 语音行程助手 · P0 后端',
      docs: '/api/health',
      api: '/api/v1',
    });
  });

  app.use('/api/v1', buildApiRouter(repos));
  // 兼容无版本前缀
  app.use('/api', buildApiRouter(repos));

  // 404
  app.use((_req, res) => {
    sendError(res, 404, ERROR_CODES.NOT_FOUND, '接口不存在');
  });

  // 统一错误处理
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('[server] 未捕获错误', err);
    }
    sendError(res, status, ERROR_CODES.INTERNAL_ERROR, err.message || '服务器内部错误');
  });

  return app;
}

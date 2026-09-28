import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { ENV } from '../config.js';

export function healthRouter(_repos: Repos): Router {
  const r = Router();
  r.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ai-itinerary-backend',
      version: '1.0.0',
      time: new Date().toISOString(),
      features: {
        scheduleCore: true,
        aiUnderstanding: true,
        conversationStateMachine: true,
        memoryLayer: true,
        reminderEngine: true,
        personaLayer: true,
        ttsProxy: true,
        asrProxy: true,
      },
    });
  });
  r.get('/env', (_req, res) => {
    res.json({
      port: ENV.port,
      dataDir: ENV.dataDir,
      corsOrigins: ENV.corsOrigins,
    });
  });
  return r;
}

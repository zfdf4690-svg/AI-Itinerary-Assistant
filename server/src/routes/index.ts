import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { configRouter } from './config.js';
import { conversationsRouter } from './conversations.js';
import { healthRouter } from './health.js';
import { memoryRouter } from './memory.js';
import { personasRouter } from './personas.js';
import { remindersRouter } from './reminders.js';
import { schedulesRouter } from './schedules.js';
import { understandRouter } from './understand.js';
import { voiceRouter } from './voice.js';

export function buildApiRouter(repos: Repos): Router {
  const r = Router();
  r.use('/health', healthRouter(repos));
  r.use('/schedules', schedulesRouter(repos));
  r.use('/understand', understandRouter(repos));
  r.use('/conversations', conversationsRouter(repos));
  r.use('/memory', memoryRouter(repos));
  r.use('/reminders', remindersRouter(repos));
  r.use('/personas', personasRouter(repos));
  r.use('/config', configRouter(repos));
  r.use('/voice', voiceRouter(repos));
  return r;
}

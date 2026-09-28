import { Router } from 'express';
import { ConfigStore, ENV } from '../config.js';
import { Repos } from '../db/repos.js';
import { LLMConfig, MiniMaxConfig } from '../types.js';

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

export function configRouter(repos: Repos): Router {
  const r = Router();
  const cfgStore = new ConfigStore(ENV.dataDir);

  /** 读取配置（API Key 脱敏） */
  r.get('/', (_req, res) => {
    res.json({
      llm: { ...repos.runtimeConfig.llm, apiKey: maskKey(repos.runtimeConfig.llm.apiKey) },
      minimax: {
        ...repos.runtimeConfig.minimax,
        apiKey: maskKey(repos.runtimeConfig.minimax.apiKey),
      },
      updatedAt: repos.runtimeConfig.updatedAt,
    });
  });

  /** 更新配置（未传的 apiKey 保持原值） */
  r.put('/', (req, res) => {
    const body = (req.body || {}) as {
      llm?: Partial<LLMConfig>;
      minimax?: Partial<MiniMaxConfig>;
    };
    const next = { ...repos.runtimeConfig };

    if (body.llm) {
      next.llm = {
        ...next.llm,
        ...body.llm,
        apiKey: body.llm.apiKey !== undefined ? body.llm.apiKey : next.llm.apiKey,
      };
    }
    if (body.minimax) {
      const mm = body.minimax;
      next.minimax = {
        ...next.minimax,
        ...mm,
        apiKey: mm.apiKey !== undefined ? mm.apiKey : next.minimax.apiKey,
        voiceIds: { ...next.minimax.voiceIds, ...(mm.voiceIds || {}) },
      };
    }

    repos.runtimeConfig = next;
    cfgStore.save(next);
    res.json({
      llm: { ...next.llm, apiKey: maskKey(next.llm.apiKey) },
      minimax: { ...next.minimax, apiKey: maskKey(next.minimax.apiKey) },
      updatedAt: next.updatedAt,
    });
  });

  return r;
}

/**
 * 运行时配置：.env 提供默认值，data/config.json 为持久化的运行时配置（可经 API 修改）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuntimeConfig, MiniMaxConfig, LLMConfig } from './types.js';

export type { RuntimeConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, '..');

// 加载 .env（若存在）
try {
  const envPath = path.join(SERVER_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
} catch {
  /* 忽略 .env 解析错误 */
}

function envStr(key: string, def = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? def : v;
}

function envBool(key: string, def = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

export const ENV = {
  port: parseInt(envStr('PORT', '4599'), 10) || 4599,
  dataDir: path.resolve(SERVER_ROOT, envStr('DATA_DIR', './data')),
  corsOrigins: envStr('CORS_ORIGIN', 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

function defaultConfig(): RuntimeConfig {
  return {
    llm: {
      enabled: envBool('LLM_ENABLED', false),
      apiKey: envStr('LLM_API_KEY', ''),
      baseUrl: envStr('LLM_BASE_URL', 'https://api.deepseek.com'),
      model: envStr('LLM_MODEL', 'deepseek-chat'),
    },
    minimax: {
      enabled: envBool('MINIMAX_ENABLED', false),
      apiKey: envStr('MINIMAX_API_KEY', ''),
      groupId: envStr('MINIMAX_GROUP_ID', ''),
      ttsModel: envStr('MINIMAX_TTS_MODEL', 'speech-01-turbo'),
      asrModel: envStr('MINIMAX_ASR_MODEL', 'asr-01'),
      voiceIds: {
        energetic: envStr('MINIMAX_VOICE_ENERGETIC', 'female-tianmei'),
        gentle: envStr('MINIMAX_VOICE_GENTLE', 'female-shaonv'),
        professional: envStr('MINIMAX_VOICE_PROFESSIONAL', 'presenter_female'),
      },
    },
  };
}

export class ConfigStore {
  private path: string;

  constructor(dataDir: string) {
    this.path = path.join(dataDir, 'config.json');
  }

  load(): RuntimeConfig {
    const defaults = defaultConfig();
    try {
      if (fs.existsSync(this.path)) {
        const raw = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
        return mergeConfig(defaults, raw);
      }
    } catch {
      /* 损坏则回退默认 */
    }
    return defaults;
  }

  save(cfg: RuntimeConfig): void {
    const dir = path.dirname(this.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = { ...cfg, updatedAt: Date.now() };
    const tmp = `${this.path}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, this.path);
  }
}

function mergeConfig(base: RuntimeConfig, raw: Partial<RuntimeConfig>): RuntimeConfig {
  const llm: LLMConfig = { ...base.llm, ...(raw.llm || {}) };
  const mm = raw.minimax || {};
  const minimax: MiniMaxConfig = {
    ...base.minimax,
    ...mm,
    voiceIds: { ...base.minimax.voiceIds, ...((mm as MiniMaxConfig).voiceIds || {}) },
  };
  return { llm, minimax, updatedAt: raw.updatedAt };
}

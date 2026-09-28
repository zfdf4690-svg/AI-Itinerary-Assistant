/**
 * JSON 文件持久化存储：每个集合一个文件，原子写入（临时文件 + rename）。
 */
import fs from 'node:fs';
import path from 'node:path';

export class JsonStore<T> {
  private file: string;

  constructor(dataDir: string, name: string, private fallback: T) {
    this.file = path.join(dataDir, `${name}.json`);
  }

  load(): T {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        if (Array.isArray(this.fallback) && !Array.isArray(parsed)) return this.fallback;
        if (!Array.isArray(this.fallback) && Array.isArray(parsed)) return this.fallback;
        return parsed as T;
      }
    } catch {
      /* 损坏时回退 */
    }
    return this.fallback;
  }

  save(data: T): void {
    const dir = path.dirname(this.file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.file);
  }
}

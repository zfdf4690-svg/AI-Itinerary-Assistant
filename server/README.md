# AI 语音行程助手・P0 后端

依据 `AI语音行程助手_P0_PRD_V1.0.docx` 实现的 P0 后端服务，覆盖 PRD 中的：

**Schedule Core（日程核心）**、**AI 理解（5 字段 + 双通道）**、**会话状态机**、**Memory Layer（记忆层）**、

**Reminder Engine（提醒引擎）**、**Persona Layer（人格层）** 与 **MiniMax TTS/ASR 代理**。

技术栈：Node.js (≥18) + Express 4 + TypeScript，JSON 文件持久化（零外部依赖，开箱即用）。



***

## 一、快速开始



```
cd server
npm install
cp .env.example .env   # 按需配置 LLM / MiniMax
npm run dev            # 开发模式（tsx watch，默认端口 4599）
# 或
npm run build && npm start   # 生产模式
```

启动后：



* API 根地址：`http://localhost:4599/api/v1`

* 健康检查：`http://localhost:4599/api/v1/health`

> 数据默认持久化在 
>
> `server/data/`
>
> （JSON 文件），全部已加入 
>
> `.gitignore`
>
> 。
> 未配置任何外部服务时，后端完全可用：AI 理解走本地规则 NLU，TTS/ASR 返回 “未配置” 降级状态。

### 环境变量（.env）



| 变量                                                           | 默认值                                                        | 说明                    |
| ------------------------------------------------------------ | ---------------------------------------------------------- | --------------------- |
| `PORT`                                                       | `4599`                                                     | 服务端口（与前端 apiClient 默认地址一致）                  |
| `DATA_DIR`                                                   | `./data`                                                   | 数据目录                  |
| `CORS_ORIGIN`                                                | `http://localhost:3000,http://127.0.0.1:3000`              | 允许跨域的前端来源             |
| `LLM_ENABLED` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | `false` / 空 / `https://api.deepseek.com` / `deepseek-chat` | 智能解析 LLM（OpenAI 兼容协议） |
| `MINIMAX_ENABLED` / `MINIMAX_API_KEY` / `MINIMAX_GROUP_ID`   | `false` / 空 / 空                                            | TTS 语音合成与 ASR 语音识别    |

运行时也可以调用 `PUT /api/v1/config` 修改配置（持久化到 `data/config.json`，读取时 API Key 自动脱敏）。



***

## 二、架构



```
server/
├── src/
│   ├── index.ts                 # 入口：启动仓储、Reminder 调度、监听端口
│   ├── app.ts                   # Express 应用工厂（CORS / JSON / 日志 / 错误处理）
│   ├── config.ts                # .env + data/config.json 运行时配置
│   ├── types.ts                 # 领域类型（5 字段日程、状态机、Memory、Reminder…）
│   ├── db/
│   │   ├── store.ts             # JSON 文件存储（原子写入）
│   │   └── repos.ts             # 仓储：schedules / conversations / reminders / memory / config
│   ├── services/
│   │   ├── nlu.ts               # 本地规则 NLU：5 字段解析、局部修改识别、完整性判断
│   │   ├── llm.ts               # LLM 智能解析（OpenAI 兼容，失败自动降级 NLU）
│   │   ├── schedule.ts          # Schedule Core：校验 / 创建 / 局部修改
│   │   ├── conversation.ts      # 会话状态机：输入→理解→补充→卡片→已创建
│   │   ├── memory.ts            # Memory Layer：Event / Entity / Preference
│   │   ├── reminders.ts         # Reminder Engine：到期扫描 + 每日简报 + 晚间复盘
│   │   ├── personas.ts          # Persona Layer：3 套人格（Prompt + Voice）
│   │   ├── tts.ts               # MiniMax T2A 代理
│   │   └── asr.ts               # MiniMax ASR 代理
│   ├── utils/
│   │   ├── date.ts              # 中文日期解析与格式化
│   │   └── response.ts          # 统一错误体 sendError + ERROR_CODES
│   └── routes/                  # REST 路由（见下节）
├── scripts/
│   ├── smoke.mjs                # 冒烟测试（79 项断言，临时端口+临时数据目录）
│   ├── e2e.mjs                  # E2E 全链路（会话→追问→拒绝→卡片→创建→PATCH→重启持久化）
│   └── contract-check.mjs       # 前端 apiClient 契约一致性（真实后端）
└── data/                        # 运行时数据（自动创建，已 gitignore）
```

### 核心设计



* **5 字段标准模板**（PRD §3）：`time`（时间）+ `task`（任务）为最低要求；`location`（地点）、`matters`（事项）、`remindOffset`（提醒时间）为可选。

* **AI 理解双通道**（PRD §4）：优先 LLM（DeepSeek/OpenAI 兼容，`response_format: json_object`），失败或未配置自动降级本地规则 NLU；LLM 结果还会用规则引擎补全遗漏字段。

* **会话状态机**（PRD §5）：`input → understanding → awaiting_clarify / awaiting_supplement → card_ready → created`。


  * 必填缺失（时间 / 任务）→ 必须澄清，不阻塞；

  * 可选缺失 → 委婉追问一次（Persona 口吻），用户拒绝（“不用了 / 先不填”）→ 用已有信息进入卡片；

  * 局部修改不是独立主状态：卡片 → 用户自然语言修改 → AI 只更新对应字段 → 重新展示卡片 → 再次确认（PRD §7）。

* **Memory Layer**（PRD §11）：Event Memory（历史日程）、Entity Memory（人物 / 地点，含出现频次）、Preference Memory（用户偏好 + 从日程推导的偏好摘要）。

* **Reminder Engine**（PRD §12）：后台每 20 秒扫描，按「日程开始时刻 - 提前量」触发日程提醒；支持每日简报与晚间复盘；提醒记录持久化，前端轮询 `GET /api/v1/reminders/active` 即可。

* **Persona Layer**（PRD §10）：后端承载 Prompt 与 Voice（MiniMax voice\_id / 语速 / 音调），UI Theme 仍由前端控制；Persona 只改变表达，不改业务逻辑。

* **语音反馈解耦**（PRD §9）：TTS 由后端代理（Key 不下发浏览器），是否自动播报由前端开关 + 喇叭按钮决定。



***

## 三、API 参考

统一前缀：`/api/v1`。错误响应统一格式：`{ "success": false, "error": { "code": string, "message": string, "details"?: unknown } }`，`code` 取值见 `src/utils/response.ts` 的 `ERROR_CODES`（VALIDATION_ERROR / CONVERSATION_NOT_FOUND / SCHEDULE_NOT_FOUND / LLM_UNAVAILABLE / VOICE_UNAVAILABLE / INTERNAL_ERROR / NOT_FOUND 等）。

### 健康检查



| 方法  | 路径        | 说明        |
| --- | --------- | --------- |
| GET | `/health` | 服务状态与能力声明 |

### 日程（Schedule Core）



| 方法     | 路径                                   | 说明                            |
| ------ | ------------------------------------ | ----------------------------- |
| GET    | `/schedules?date=&status=&from=&to=` | 列表（按时间排序）                     |
| POST   | `/schedules`                         | 创建（校验时间 + 任务；缺必填返回 422 及缺失字段） |
| GET    | `/schedules/:id`                     | 详情                            |
| PATCH  | `/schedules/:id`                     | **局部修改**：只更新传入字段，其余保留（PRD §7） |
| DELETE | `/schedules/:id`                     | 删除                            |

### AI 理解



| 方法   | 路径            | 说明                                                                           |
| ---- | ------------- | ---------------------------------------------------------------------------- |
| POST | `/understand` | 单轮理解：`{ utterance|text, currentDraft?, personaId? }` → 5 字段槽位 + 完整性 + 委婉追问 / 确认回复 |

`/understand` 响应示例：



```
{
  "state": "awaiting_supplement",
  "slots": { "time": "15:00", "date": "2026-09-29", "dateLabel": "明天 (周二)", "task": "与张总开会", "priority": "medium" },
  "missingRequired": [],
  "missingOptional": ["location", "matters", "remindOffset"],
  "replyText": "好的，我帮你记下来了。是在什么地方呢？如果暂时不方便说，也可以先不填。",
  "source": "local",
  "actionRequired": "ASK_OPTIONAL"
}
```

`actionRequired` 为枚举：`ASK_REQUIRED`（必填缺失须澄清）/ `ASK_OPTIONAL`（可选缺失委婉追问，可拒绝）/ `SHOW_SCHEDULE_CARD`（信息齐备展示卡片）/ `NONE`（无动作）。

### 会话状态机



| 方法     | 路径                           | 说明                                    |
| ------ | ---------------------------- | ------------------------------------- |
| POST   | `/conversations`             | 新建会话并执行首轮：`{ utterance, personaId? }` → 含 `action` 枚举（ASK_REQUIRED / ASK_OPTIONAL / SHOW_SCHEDULE_CARD / NONE） |
| GET    | `/conversations/:id`         | 会话当前状态（draft /state/ 追问字段 / 消息历史）     |
| POST   | `/conversations/:id/turn`    | 推进一轮：`{ utterance }`；非拒绝输入自动尝试记录偏好（如“以后默认提前30分钟提醒”）                  |
| POST   | `/conversations/:id/confirm` | 确认创建（④→⑤），同时写入 Memory 与提醒             |
| DELETE | `/conversations/:id`         | 删除会话                                  |

### 记忆层（Memory Layer）



| 方法  | 路径                             | 说明                              |
| --- | ------------------------------ | ------------------------------- |
| GET | `/memory/events`               | Event Memory：历史日程               |
| GET | \`/memory/entities?type=person | location\`                      |
| GET | `/memory/preferences`          | Preference Memory：用户偏好 + 日程推导摘要 |
| PUT | `/memory/preferences`          | 设置偏好：`{ key, value }`           |

### 提醒（Reminder Engine）



| 方法        | 路径                          | 说明                          |
| --------- | --------------------------- | --------------------------- |
| GET       | `/reminders/active`         | 活跃提醒（未处理，供前端轮询 / Toast）     |
| GET       | `/reminders/history?limit=` | 历史提醒                        |
| POST      | `/reminders/scan`           | 手动触发一次扫描（调试 / 测试）           |
| PATCH     | `/reminders/:id/dismiss`    | 标记已处理                       |
| GET / PUT | `/reminders/config`         | 提醒配置（每日简报 / 晚间复盘时间、各优先级提前量） |

### 人格（Persona Layer）



| 方法  | 路径              | 说明                                                     |
| --- | --------------- | ------------------------------------------------------ |
| GET | `/personas`     | 3 套人格（energetic /gentle/professional），含 Prompt 与 Voice |
| GET | `/personas/:id` | 单套人格                                                   |

### 语音（MiniMax 代理）



| 方法   | 路径           | 说明                                                                                                  |
| ---- | ------------ | --------------------------------------------------------------------------------------------------- |
| POST | `/voice/tts` | `{ text, personaId?, voice? }` → `{ audioBase64, format: "mp3" }`；`voice` 可覆盖 persona 音色；未配置返回 503 `tts_not_configured`（`details.fallback="browser"`），前端应回退浏览器语音 |
| POST | `/voice/asr` | `{ audioBase64, fileName? }` → `{ text }`；未配置返回 503 `asr_not_configured`，前端可回退 Web Speech           |

### 配置



| 方法  | 路径        | 说明                                   |
| --- | --------- | ------------------------------------ |
| GET | `/config` | 读取运行时配置（API Key 脱敏）                  |
| PUT | `/config` | 更新 LLM / MiniMax 配置（未传的 apiKey 保持原值） |



***

## 四、测试



```
npm run typecheck   # TypeScript 类型检查
npm run build       # 编译到 dist/
npm run smoke       # 冒烟测试：临时目录起服务，79 项断言全绿
npm run e2e         # E2E 全链路：会话→追问→拒绝→卡片→创建→PATCH→重启持久化（25 项）
node scripts/contract-check.mjs  # 契约一致性：模拟前端 apiClient 对真实后端（20 项，需后端已在 4599 运行）
```

冒烟测试覆盖（对应 PRD P0 验收场景）：完整输入生成完整卡片、缺少可选信息委婉追问且拒绝不阻塞、

缺少时间必须询问、局部修改只改对应字段、会话状态机全流程、日程 CRUD、提醒到期触发与每日简报 / 晚间复盘、

Memory 三层、3 套人格、TTS/ASR 未配置降级、配置读写脱敏、边界与异常。



***

## 五、前端对接说明

仓库前端（`src/`）已完成 **Phase 4 后端接入**（后端优先、离线本地降级）：`src/services/apiClient.ts` 封装全部 API，AppContext 启动探测后端在线则用后端数据、离线自动降级 localStorage 本地模式；TTS 优先后端、失败回退浏览器语音；设置页可改后端地址（默认 `http://localhost:4599/api/v1`）。



***

## 六、设计取舍（P0 范围）



* **持久化**：JSON 文件 + 内存副本，适合单人本地 / 单机 P0；多用户或并发量大时替换为 SQLite/PostgreSQL（仓储接口已隔离）。

* **提醒调度**：进程内 `setInterval` 扫描；多实例部署时应改用外部调度（如 cron / 消息队列）。

* **LLM**：默认 DeepSeek，OpenAI 兼容协议下可换任意供应商（改 `LLM_BASE_URL` / `LLM_MODEL`）。

* **ASR/TTS**：P0 仅做 MiniMax 代理转发；前端无 Key 时按 PRD 回退浏览器能力。
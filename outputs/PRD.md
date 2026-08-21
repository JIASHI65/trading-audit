# 交易审计台 · 产品需求文档（PRD）

> 版本：v1.0 · 日期：2026-08-21 · 状态：开发中（功能冻结期，仅修 bug 与加固）
> 配套文档：`ROADMAP.md`（路线图）· `审计台产品全景.html`（可视化）

---

## 1. 产品概述

### 1.1 背景与定位

交易审计台是**单人模拟盘纪律工具**，不是自动交易系统，也不做行情预测。用户将各大模型（Claude / GPT / Gemini / Grok / DeepSeek）输出的交易信号粘贴进系统，系统以**硬性规则**审计信号质量，用户确认后进入追踪台账，最终用**真实成交结果**反向检验模型输出是否靠谱。

### 1.2 核心价值主张

1. **LLM 算数会错，JS 不会**：盈亏比、仓位等数字一律按价位重算，不采信模型自报。
2. **禁打太极**：每条结论必须是"合格 / 不合格 / 有条件 + 一句话依据"，软话术自动降级。
3. **历史防篡改**：确认记录串成哈希链，防止用户自己改历史欺骗自己。
4. **模型吹没吹，一算就现形**：统计真实胜率/期望值/盈亏比，与模型自报对比。

### 1.3 目标用户

- 主要：产品所有者（个人）
- 次要：用于审计台二次开发的 AI 编程助手（Claude Code / Codex），本 PRD 为其改造依据

### 1.4 交易范围

覆盖四个市场（赛道 lane）：美股（`stream_us`）、A股（`stream_a`）、港股（`stream_hk`）、加密（`stream_crypto`）。数据按赛道完全隔离。

---

## 2. 名词表

| 名词 | 含义 |
|---|---|
| 模型 | 输出交易信号的 AI（claude / gpt / gemini / grok / deepseek） |
| 信号 / trade | 单笔交易推荐，含 14 个合同字段 |
| 裁定 verdict | pass（通过）/ warn（存疑）/ fail（违规） |
| 合同层 core/ | 纯函数规则引擎，零 DOM 依赖，可单测 |
| 台账 tracker | 用户确认后的追踪交易列表 |
| 信号后验 | 录入现价，按止损/止盈自动模拟平仓 |
| lane | 市场赛道，localStorage 键前缀 |

---

## 3. 功能需求

### F1 多模型输入与解析

- **功能逻辑**：用户粘贴任一模型输出（JSON / Markdown / 代码块 / 纯文本），系统自动识别格式并解析出 `trades[]` 数组。
- **交互**：粘贴区 → 解析 → 校验 → 渲染交易卡片。
- **异常处理**：解析失败提示"无法识别格式，请粘贴 JSON 或字段速览块"；空结果提示"未解析到交易"。
- **模块**：`js/parser.js`

### F2 14 字段完整性校验

- **必填字段**（9 个硬字段 + 5 个叙事字段）：
  - 硬字段：`symbol` `direction` `entry_low` `entry_high` `stop` `target1` `target2` `claimed_rr` `size_cny`
  - 叙事字段：`anchors.stop` `anchors.target1` `anchors.target2` `falsification` `exit_strategy`
- **规则**：缺失任意项 → 校验项标 ⚠️ 并列出缺失清单；`falsification` / `exit_strategy` 缺失 → 直接 fail。
- **模块**：`core/audit-rules.js`（`R10A_REQUIRED_FIELDS` / `FIELD_KEYS`）

### F3 R-10a 九条审计

逐条输出 ✅ / ⚠️ / ❌，任一条 fail 则整体 `fail`：

| # | 检查项 | 判定要点 |
|---|---|---|
| 1 | 方向与价位一致 | 做多时 stop < 入场 < target1；做空镜像 |
| 2 | 止损锚定 | 必须有技术依据文本 |
| 3 | 目标锚定 | target1/target2 必须有依据 |
| 4 | 盈亏比 | 自报 `claimed_rr` ≥ 2 合格，< 2 降级 |
| 5 | 证伪条件 | 必须写明"什么情况证明判断错误" |
| 6 | 仓位 | > 30% fail，20%~30% warn |
| 7 | 入场区间宽度 | 区间 > 2% warn |
| 8 | 离场逻辑 | 文本 < 10 字 fail |
| 9 | 回测核验 | Sharpe>3 / 回撤>20% / 年化>100% 标存疑 |

另有附加检查：市场环境（R-12）、空头反驳（R-11，≥3 条）、14 字段完整性。

### F4 Compliance 数字风控（零 LLM）

| 检查项 | 规则 |
|---|---|
| 单笔仓位 | ≤ 20%（按 `size_cny / total` 计算） |
| 盈亏比反算 | 按入场/止损/目标价位反算，< 2:1 直接 fail（不采信自报） |
| 入场区间 | ≤ 2% |
| 组合现金 | ≥ 40% |
| 同方向笔数 | ≤ 3 |
| 今日推荐 | ≤ 3 笔 |
| 黑名单 | `excludeSymbols` 配置，命中即 fail |

- **模块**：`core/compliance.js`

### F5 R-13 软话术检测

- 扫描 `conclusion / falsification / exit_strategy / market_env / bear_case / anchors` 文本。
- 命中黑名单词（需谨慎观察 / 酌情 / 注意风险 / 风险与机会并存 / 静观其变 / 边走边看 / 有待观察 / 见机行事 / 不好说 / 说不准 / 再看吧）→ 该笔降级为 warn（观望）。
- **模块**：`core/audit-rules.js`（`SOFT_PHRASES`）

### F6 多模型对比看板

- 同一标的跨模型横向对比：方向共识百分比、最大分歧品种（标红预警）、各模型人格画像（多空倾向 / 平均盈亏比 / 风控完整度）。
- 违规拦截：任一模型 fail 的推荐不进入最终决策排行。

### F7 确认 / 驳回 → 追踪台账

- 用户对每笔交易点"✅ 人工确认"或"🔄 驳回"；支持批量操作；可撤销。
- 确认后写入台账（`tracker`）并追加日志链。
- 追踪字段：`id symbol direction entry_low entry_high stop target1 target2 claimed_rr size_cny tracked_at`

### F8 信号后验器（核心新增）

- 每笔未平仓交易提供"录入现价"输入框 + 判定按钮。
- 模拟逻辑（`core/signal-verifier.js`，纯函数）：
  - 逐价格点扫描，**止损优先**；
  - 触发 target1 → 半仓止盈（`result='half'`，剩半仓在途）；
  - 触发 target2 → 清仓（`result='tp2'`）；触发 stop → 止损（`result='sl'`）；
  - 跳空直达 target2 → 按限价单顺序 t1+t2 结算。
- 盈亏估算（金额口径，不含杠杆/手续费）：`size × (离场 − 入场) / 入场`（做多），做空镜像。
- 自动判定标记 `auto=true` 并显示 `🤖 自动 @离场价`；用户可手动覆盖。
- **状态机**：`持仓中 → 半仓止盈1（在途）→ 止盈2 / 止损（已平仓）`；`result='half'` 不计入已平仓统计。

### F9 真实统计报表

- 已平仓口径：`result ∈ {tp1, tp2, sl, manual}`（`half` 与持仓中排除）。
- 指标：胜率、累计盈亏、盈亏因子、**期望值（EV = 总盈亏/已平仓数）**、**真实盈亏比（平均盈利/平均亏损）**。
- 模型自报对比：已平仓单的 `claimed_rr` 均值 vs 真实盈亏比，标注"金额口径，仅供参考"。
- 样本 < 30 笔时提示"统计仅供参考"。

### F10 日志链防篡改

- 每条确认记录 `append`：内容 + 时间戳 + `prevHash` → 生成 `hash`。
- 校验：任一记录内容被改、hash 被伪造、中间记录被删除 → 全链校验失败并指出断裂点。
- **模块**：`core/audit-chain.js`

### F11 备份 / 导入 + 30 天提醒

- 右上角"💾 备份"：导出全部 localStorage（模型结果 + 确认 + 台账 + 日志链）为 JSON 文件。
- 导入：文件选择器恢复备份。
- 提醒：距上次备份 ≥ 30 天，页面加载后弹一次提醒（`sessionStorage` 记当日已提醒，不重复弹）。

### F12 行情快照

- 来源：`snapshots/latest.json`（本地静态文件）。
- 刷新策略：**每 10 分钟**轮询一次；页面不可见时暂停，切回页面（`visibilitychange`）立即刷新。
- 目标：审计时补充现价参考，不参与裁定计算。

### F13 提示词库

- 内置两套提示词：旗舰版 v5.3（周课深复盘）、实战版 v6.1（日常精简）。
- 提示词可编辑并持久化（`app_prompts`），加载示例时使用当前编辑版本。

---

## 4. 字段规则（合同 JSON）

模型输出末尾 JSON 必须包含：

```json
{
  "_meta": { "version": "v6.1", "generated_at": "ISO8601" },
  "portfolio": { "total": 10000, "cash": 10000, "same_direction": 0 },
  "trades": [
    {
      "symbol": "BTC/USDT",
      "direction": "long",
      "entry_low": 61000, "entry_high": 61700,
      "stop": 60400, "target1": 62900, "target2": 64900,
      "claimed_rr": 2.2, "size_cny": 1600,
      "anchors": { "stop": "...", "target1": "...", "target2": "..." },
      "falsification": "...", "exit_strategy": "...",
      "market_env": "宏观[顺风/逆风/中性] | 波动率[扩张/收缩] | 结论[适合/观望/禁止]",
      "bear_case": "1) ... 2) ... 3) ...",
      "backtest": { "win_rate": 62, "annualized": 34.7, "max_drawdown": -8.5, "sharpe": 1.42, "total_trades": 47, "period": "2025-01~2026-06", "source": "..." }
    }
  ]
}
```

### 字段校验规则

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| symbol | string | ✅ | 非空 |
| direction | string | ✅ | `long/buy` 或 `short/sell` |
| entry_low / entry_high | number | ✅ | 数值，区间宽度 ≤ 2% |
| stop | number | ✅ | 做多 < 入场；做空 > 入场 |
| target1 / target2 | number | ✅ | 做多 > 入场；做空 < 入场 |
| claimed_rr | number | ✅ | ≥ 2 合格（仍会被反算复核） |
| size_cny | number | ✅ | 单笔 ≤ 20% 总资金 |
| anchors.* | string | ✅ | 止损/目标必须说明技术依据 |
| falsification | string | ✅ | ≥ 2 字；缺失直接 fail |
| exit_strategy | string | ✅ | ≥ 2 字；缺失直接 fail |
| market_env | string | ✅ | 含"禁止/不适合"→ fail；"观望/谨慎"→ warn |
| bear_case | string | ⚠️ | 缺失 → warn（建议 ≥3 条） |
| backtest | object | ⚠️ | 缺失 → 不判；存在则核验异常值 |

---

## 5. 数据规则

### 5.1 存储（localStorage）

| 键 | 类型 | 说明 |
|---|---|---|
| `{lane}_models` | object | `{modelId: {input, data, time, version}}` |
| `{lane}_confirms` | object | `{modelId_idx: true/false/null}` |
| `{lane}_tracker` | array | 追踪台账 |
| `{lane}_selected` | array | 批量选择 |
| `{lane}_audit_chain` | array | 防篡改日志链 |
| `app_prompts` | object | 提示词库 |
| `{lane}_last_backup_at` | string | 上次备份时间 |

- lane 集合：`stream_us` / `stream_a` / `stream_hk` / `stream_crypto`。
- 单用户本地存储，容量上限约 5MB；追踪台账数百笔以内无压力。

### 5.2 统计口径

- 已平仓 = `result` 存在且 ≠ `'half'`。
- pnl 为金额（元），自动判定为估算值（不含杠杆/手续费），手动录入以用户输入为准。

---

## 6. 异常处理汇总

| 场景 | 处理 |
|---|---|
| 解析失败 | 提示格式错误，不崩溃 |
| 字段缺失 | 列出缺失清单，标 ⚠️；关键字段缺失 fail |
| 非法价格（负数/非数字） | 过滤或判 0，标注"拿不准标 0，不许编造" |
| 软话术 | 降级 warn，显示命中词 |
| localStorage 写入失败 | `try/catch` 静默，不中断操作 |
| 脚本全局错误 | 需保持 0 报错（验收项） |
| 行情拉取失败 | 显示上次快照或"无行情"状态，不阻塞审计 |

---

## 7. 权限与安全

- **无权限体系**：单人本机工具，无多用户、无登录。
- **XSS 防护**：所有外部文本经 `Renderer.esc()` 转义后进 DOM，禁止裸 `innerHTML` 拼接未转义文本。
- **数据防篡改**：日志链哈希校验（防自己改历史）。
- **不联网写数据**：纯前端，无任何后端写入。

---

## 8. 非功能需求

| 项 | 要求 |
|---|---|
| 性能 | 本地秒开；数百笔台账渲染无卡顿 |
| 兼容 | 现代浏览器（Chrome / Edge / Safari 最新版） |
| 可维护性 | 规则全部纯函数，单测覆盖（当前 49 + 32 = 81 项全绿） |
| 可部署 | 纯静态，GitHub Pages 直接托管，零构建 |
| 冻结纪律 | 功能冻结期：只修 bug、加固、补测试，不加新器官 |

---

## 9. 技术架构

```
浏览器（GitHub Pages）
├── 界面层 js/        store · parser · renderer · auditor · app · prompt · globals
├── 合同层 core/       audit-rules · rr-formula · compliance · audit-chain · signal-verifier
├── 存储              localStorage（分 lane）
└── 行情              snapshots/latest.json（10 分钟刷新 + 可见性检测）
```

- 事件委托架构：`data-action` → `handleAction`，无内联 onclick。
- 状态管理：Redux 式单向数据流（`dispatch → reducer → state`），订阅自动重渲染。
- 合同层与 UI 层严格分离：合同层零 DOM、可 node 直测。

---

## 10. 验收标准

1. `node audit-rules.test.js` 与 `node signal-verifier.test.js` 全绿（81/81）。
2. 浏览器零 console 报错；宽 736px / 窄 360px 无横向溢出。
3. 端到端用例：粘贴示例 → 九条审计 → 数字风控 → 确认入台账 → 录价判定（半仓 → 目标2 / 止损）→ 统计更新 → 日志链可验。
4. 任意关键规则改动须先改测试再改实现（红 → 绿）。

---

## 11. 路线图（详见 ROADMAP.md）

| 优先级 | 事项 | 状态 |
|---|---|---|
| P1 | 杠杆/合约（四字段 + 强平价审计） | 🔒 冻结：跑满 1 个月现货 + 台账 30 笔后解冻 |
| P2 | 全自动批跑脚本（5 模型 API） | ⏳ 等 5 家 API key |
| P4 | AI 教练行为归因 | ⏳ 等台账 ≥ 30 笔 |

---

## 12. 版本记录

| 日期 | 变更 |
|---|---|
| 2026-08-21 | 立档：对齐 v3 架构 + v5.3/v6.1 提示词 + 信号后验器 + R-13 软话术 |

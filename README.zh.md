# dsh-your-turn（轮到你了）

**DeepSeek Harness 的回合交接提醒。** 某个会话的 Agent 停下来、把回合交还给你时，
这个插件会弹出一个真正可以操作的居中窗口，并播放一段提示音——所有音色都在浏览器里
实时合成，插件**不携带任何音频文件**。

English: [README.md](README.md)

---

## 它做什么

- **察觉交接。** 它监听 Web 客户端本来就持有的「Agent 运行状态」，所以你没在看的
  会话同样有效——不需要 Host Remote、不需要轮询、不需要监听文件。
- **弹出真窗口。** 居中模态框，带焦点管理、Escape 与点击遮罩关闭；显示回合结果、
  会话标题、工作目录、回合用时，以及四个按钮：**跳到会话**、**静音该会话**、
  **5 分钟后再提醒**、**知道了**。也可以换成顶部横幅，或者两者都要。
- **播放提示音。** 六种音色加静音——双分音风铃、轻点、马林巴、上行街机琶音、水滴、
  以及给失败用的三音警示——成功与异常可以各选一种，另有音量控制。
- **知道什么时候闭嘴。** 仅在窗口未聚焦时提醒、最短回合时长、排除子代理、结果范围、
  会话级静音、免打扰时段，以及一个总静音开关。
- **让多个窗口协同。** 同源下开三个标签页只会响一次；在一处关掉，其它处一起关。
- **记住该记住的。** 被静音的会话与「稍后再提醒」在刷新后仍在；所有策略设置存在部署
  的设置文档里，对所有指向它的浏览器生效。

## 它不做什么

- 不服务于 `tui` / `headless` profile：那里没有浏览器可以画东西。只有 `web` profile
  才有客户端半边。
- 没有浏览器连接时不会发送任何通知。
- 不读取、不修改、也不依赖对话区 DOM、Harness 内部类名或任何私有 API。

## 环境要求

- DeepSeek Harness **`0.1.7-rc.2`**（构建与验证均基于该版本；客户端 bundle 只请求
  Web 基线模块——`react`、`react/jsx-runtime`、
  `@deepseek-ai/dsh-client-ui-primitives`——因此复用宿主自己的 React 实例，不另带一份）。
- 一个 `web` profile。

## 安装

```bash
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn
```

安装后**重启 Harness 进程**，再刷新浏览器页面：Host 半边需要重启，客户端 bundle 还需要
一次页面刷新。

已发布到 npm 时（可选）：`npx @deepseek-ai/dsh plugin --profile web add dsh-your-turn`。

从本地目录安装、不必发布：

```bash
npx @deepseek-ai/dsh plugin --profile web add file:D:\path\to\dsh-your-turn
```

需要可复现或更高安全性的场景请锁定提交——`pnpm` 会把 Git ref 写进 profile 的
lockfile，不锁定的安装是个移动靶：

```bash
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn#<sha>
```

`lib/` 已提交进仓库，因此 Git 安装不执行构建，也不需要 profile 的
`pnpm-workspace.yaml` 授予 `allowBuilds`。

### 更新

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-your-turn
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn#<new-sha>
```

先 remove 再 add 才是可靠的刷新方式：直接重复 add 可能继续用缓存的 tarball。两种方式
之后都要重启 Harness。

### 卸载

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-your-turn
```

多数情况下不必卸载，停用就够了——把 `enabled` 设为 `false`（见下），或者直接禁用
Loader 行：

```yaml
- id: your-turn
  disabled: true
```

## 数据放在哪里

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 全部设置 | 当前 profile 的 Cordis patch：`~/.dsh/profiles/<name>/cordis.patch.yml`，条目 id 为 `your-turn` | 由官方设置服务写入；插件把字段声明成 `.volatile()`，所以能在「设置 → 轮到你了」里编辑。 |
| 被静音的会话、被推迟的提醒 | 浏览器 `localStorage`，键 `dsh-your-turn/state/v1` | 天然属于单个浏览器；读取时校验，损坏即丢弃。 |

> **profile patch 命中已有行时会替换整段 `config`，不会深合并。** 手工覆盖某一个字段
> 时要把所有字段重述一遍；设置页会自动写完整的解析结果，所以它不受这条影响。

全程不涉及任何凭据、Token 或网络请求。

## 设置项

| 字段 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 总开关。 |
| `surface` | `modal` | `modal`、`toast` 或 `both`。 |
| `autoDismissSeconds` | `45` | `0` 表示一直留着直到手动关闭。 |
| `soundEnabled` | `true` | 是否播放提示音。 |
| `soundPreset` | `chime` | 正常交接时的音色。 |
| `errorSoundPreset` | `alert` | 出错、被中断或被截断时的音色。 |
| `volume` | `70` | 0–100。 |
| `onlyWhenUnfocused` | `true` | 窗口在前台、标签页可见时保持安静。 |
| `minTurnSeconds` | `3` | 更短的回合不提醒；`0` 关闭该过滤。 |
| `includeSubagents` | `false` | 子代理会连环结束，默认不提醒。 |
| `notifyOn` | `success-and-failure` | `success`、`success-and-failure` 或 `all`。 |
| `systemNotification` | `false` | 页面不可见时同时发系统通知。 |
| `flashTitle` | `false` | 在标签页标题前反复切换提示，直到窗口重新获得焦点。 |
| `quietHoursEnabled` | `false` | 在下面的时间段内不提醒。 |
| `quietHoursStart` | `22:00` | 本地时间 `HH:MM`。 |
| `quietHoursEnd` | `08:00` | 本地时间 `HH:MM`；早于开始时间表示跨过午夜。 |
| `muteAll` | `false` | 临时闭嘴，保留其它设置。 |

## 回合结束是怎么判断的

Agent 会把运行状态推给每一个已连接的浏览器——`dsh-agent-loop` 用它自己的阶段是否处于
`idle` / `maintenance` 之外来推导该状态，`dsh-api-session-controller` 再把每次变化镜像
进 Web 客户端本来就持有的会话列表。于是某一行会话上的 `true → false` 边沿，正好就是本
插件关心的那次交接，而且不需要任何客户端尚未公开的东西。

这条边沿只说明「回合结束了」，不说明「怎么结束的」。如果浏览器同时持有该会话的事件窗口
（也就是这个会话正开在这个页面里），插件会读取对应那条 `turn/end` 记录，拿到确切原因与
回合号。其余会话按「正常交接」处理——「Agent 回到空闲」本来就是这个意思。

## 已知限制

1. **按「空闲」提醒一次，而不是按「回合」各提醒一次。** 连续排队的多个回合会让 Agent
   一直保持运行，所以你在最后收到一条提醒，而不是每个回合一条。这是刻意的：那一刻回合
   才真正属于你。
2. **用时是下界。** 从*本页面*观察到该会话开始运行的那一刻计时。中途才打开的页面只会
   报告它看到的那一段。
3. **确切原因需要会话开在这里。** 在这个浏览器里从未打开过的会话，一律归类为正常交接。
4. **音频需要一次用户手势。** 浏览器在页面被交互之前会挂起音频。插件会在第一次
   pointer / keydown 时恢复；在那之前弹窗照常出现，只是不发声。设置页的「试听」按钮
   可以显式解锁，并在未解锁时给出提示。
5. **非 loopback 页面无法持久化设置。** Host 设置通路按平台设计仅限 loopback，因此通过
   隧道打开的页面会运行在内置默认值上，其设置页会显示「不可用」。提醒本身到处都能用。
6. **跨窗口去重以同源为界。** 同源的标签页与窗口通过 `BroadcastChannel` 协同。同一个会话
   同时开在桌面浏览器和手机上属于两个源，两边都会提醒——这通常正是你想要的，写在这里
   是为了让它不至于成为意外。

## 开发

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # 97 个测试：纯配置、监听器、提醒器、存储、构建产物 smoke
pnpm build         # lib/index.js + lib/client.js
pnpm check         # 插件结构与契约检查器
```

`lib/` 是生成物但已提交，因此仓库无需构建即可安装运行。改动 `src/` 后请重新构建并提交。

产物形态是刻意的：ModuleLoader id 与包名精确一致；每一个 `require(...)` 都属于 Web 基线
（由 `tests/bundle.test.ts` 断言）；整个 factory 体被包在 `try` 里，因此解析不到平台词时
只会退化成一个惰性模块并打一条 console 警告，而不是把整个页面拖下水。

## 许可证

MIT。

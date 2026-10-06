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
  会话标题、工作目录、回合用时，以及三个按钮：**跳到会话**、**5 分钟后再提醒**、
  **知道了**。也可以换成顶部横幅。
- **播放提示音。** 六种音色——双分音风铃、轻点、马林巴、上行街机琶音、水滴，
  以及给失败用的三音警示——成功与异常可以各选一种，另有音量控制。静音不是第七种
  音色，而是那个提示音开关。
- **一键静音。** 侧栏页脚有一个小喇叭图标，就挨着 remote-web-ui 那个电话：点一下静音
  （图标变成带斜杠的喇叭），再点一下恢复，恢复的同时会试听当前成功音色。它写的正是
  设置页那个「播放提示音」字段，两边永远一致；静音只停声音，提醒照样弹。
- **所有结束结果都提醒。** 正常完成、失败、中断、达到限制及未知结果均纳入提醒；
  仍可设置仅在窗口未聚焦时提醒；不再按回合时长过滤，子代理会话始终不提醒（回合结束与提问都不响）。
- **到时自动消失。** 弹窗和横幅默认出现 5 秒后自动关闭，时长可在设置页调整（0 表示
  一直留到手动关闭）；「稍后再提醒」重新弹出后重新计时。
- **让多个窗口协同。** 同源下开三个标签页只会响一次；在一处关掉，其它处一起关。
- **记住该记住的。**「稍后再提醒」在刷新后仍在；所有策略设置存在部署
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

多数情况下不必卸载，在 DSH 插件管理页停用即可。使用配置文件时，也可以禁用
Loader 行：

```yaml
- id: your-turn
  disabled: true
```

## 数据放在哪里

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 本机设置 | 当前 profile 的 Cordis patch：`~/.dsh/profiles/<name>/cordis.patch.yml`，条目 id 为 `your-turn` | 由官方设置服务写入；插件把字段声明成 `.volatile()`，所以能在「设置 → 轮到你了」里编辑。 |
| 远程页面设置 | 浏览器 `localStorage`，键 `dsh-your-turn/settings/v1` | 仅影响当前浏览器与网址，不写入台式机的部署设置。 |
| 被推迟的提醒 | 浏览器 `localStorage`，键 `dsh-your-turn/state/v1` | 天然属于单个浏览器；读取时校验，损坏即丢弃。 |

> **profile patch 命中已有行时会替换整段 `config`，不会深合并。** 手工覆盖某一个字段
> 时要把所有字段重述一遍；设置页会自动写完整的解析结果，所以它不受这条影响。

全程不涉及任何凭据、Token 或网络请求。

## 设置项

设置页严格按这个顺序渲染全部九行：前五行没有分区标题，后四行在「提示音」标题下。

| 设置页显示名 | 字段 | 默认 | 含义 |
| --- | --- | --- | --- |
| 提醒时机 | `onlyWhenUnfocused` | `true` | 窗口在前台、标签页可见时保持安静。 |
| 提醒形式 | `surface` | `modal` | `modal` 或 `toast`；旧配置里的 `both` 会解析成 `modal`。 |
| 自动消失（秒） | `autoDismissSeconds` | `5` | 提醒出现这么久后自动关闭；`0` 表示不自动消失，需要手动关闭。 |
| 闪烁标签标题 | `flashTitle` | `false` | 在标签页标题前反复切换提示，直到窗口重新获得焦点。 |
| 同时发系统通知 | `systemNotification` | `false` | 页面不可见时同时发系统通知。 |
| 播放提示音 | `soundEnabled` | `true` | 是否播放提示音；侧栏页脚那个小喇叭切换的是同一个字段。 |
| 成功响应 | `soundPreset` | `chime` | 正常交接时使用的音色。 |
| 异常响应 | `errorSoundPreset` | `alert` | 出错、被中断或被截断时使用的音色。 |
| 音量 | `volume` | `70` | 0–100。 |

## 回合结束是怎么判断的

Agent 会把运行状态推给每一个已连接的浏览器——`dsh-agent-loop` 用它自己的阶段是否处于
`idle` / `maintenance` 之外来推导该状态，`dsh-api-session-controller` 再把每次变化镜像
进 Web 客户端本来就持有的会话列表。于是某一行会话上的 `true → false` 边沿，正好就是本
插件关心的那次交接，而且不需要任何客户端尚未公开的东西。

这条边沿只说明「回合结束了」，不说明「怎么结束的」。如果浏览器同时持有该会话的事件窗口
（也就是这个会话正开在这个页面里），插件会读取对应那条 `turn/end` 记录，拿到确切原因与
回合号。其余会话按「正常交接」处理——「Agent 回到空闲」本来就是这个意思。

## 等待回答时的提示音

基于当前 DSH `0.2.0-rc.2` 的官方 `uiSession.sessionStatus` 待交互状态，新提问出现时响一次。
即使 Agent 仍在运行、窗口处于前台，也会提示；不会另外弹窗遮住问题。复用「播放提示音」、
成功响应音色与音量；仅后台提醒选项不影响提问提示音，子代理的提问不响。
同一个问题的状态刷新或隐藏后重新打开不会反复响；计划审阅、权限审批和普通文字问句不触发。
不提供该服务的旧版／精简组合保留原有回合结束提醒，不具备这项提示音。

## 已知限制

1. **按「空闲」提醒一次，而不是按「回合」各提醒一次。** 连续排队的多个回合会让 Agent
   一直保持运行，所以你在最后收到一条提醒，而不是每个回合一条。这是刻意的：那一刻回合
   才真正属于你。
2. **用时是下界。** 从*本页面*观察到该会话开始运行的那一刻计时。中途才打开的页面只会
   报告它看到的那一段。
3. **确切原因需要会话开在这里。** 在这个浏览器里从未打开过的会话，一律归类为正常交接。
4. **音频需要一次用户手势。** 浏览器在页面被交互之前会挂起音频。插件会在第一次
   pointer / keydown 时恢复；在那之前弹窗照常出现，只是不发声。设置页点击音色
   会解锁声音、立即试听该音色，并自动保存选择。
5. **远程设置仅属于当前浏览器。** Host 设置通路仅限 loopback；明确处于 memory 模式的
   远程页面使用浏览器 `localStorage` 保存（键 `dsh-your-turn/settings/v1`），不会修改台式机的
   部署设置。选项、开关与有效输入自动应用，无需保存按钮；真正保存成功后，底部固定占位淡入「已保存更改」并淡出，不挤动设置项。失败时在同一位置提示并保留输入。
6. **跨窗口去重以同源为界。** 同源的标签页与窗口通过 `BroadcastChannel` 协同。同一个会话
   同时开在桌面浏览器和手机上属于两个源，两边都会提醒——这通常正是你想要的，写在这里
   是为了让它不至于成为意外。

## 开发

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # 配置、监听器、提醒器、设置交互、存储、构建产物 smoke
pnpm build         # lib/index.js + lib/client.js
pnpm check         # 插件结构与契约检查器
```

`lib/` 是生成物但已提交，因此仓库无需构建即可安装运行。改动 `src/` 后请重新构建并提交。

产物形态是刻意的：ModuleLoader id 与包名精确一致；每一个 `require(...)` 都属于 Web 基线
（由 `tests/bundle.test.ts` 断言）；整个 factory 体被包在 `try` 里，因此解析不到平台词时
只会退化成一个惰性模块并打一条 console 警告，而不是把整个页面拖下水。

## 许可证

MIT。

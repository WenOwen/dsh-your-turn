# GitHub → npm 自动发布

包：`@wu5/dsh-your-turn`；仓库：`WenOwen/dsh-your-turn`；默认分支：`master`。
工作流：`.github/workflows/release.yml`。

## 一次性：在 npm 上授权 GitHub（必须）

打开 <https://www.npmjs.com/package/@wu5/dsh-your-turn/access>，在包的 Settings / Publishing access 中找到 **Trusted Publisher**，添加 GitHub Actions：

| 字段 | 值 |
| --- | --- |
| Organization or user | `WenOwen` |
| Repository | `dsh-your-turn` |
| Workflow filename | `release.yml`（不要填写完整路径） |
| Environment name | `release`（必须与工作流一致） |
| Allowed actions | 允许 **直接发布 `npm publish`**；仅允许 `npm stage publish` 不够 |

保存。不要把 Token 发到聊天或提交进仓库；此工作流不需要 `NPM_TOKEN`。
首次成功的真实 OIDC 发布才能证明授权有效；dry-run 不会验证 npm 发布权限。
新建但未验证的授权可能在 48 小时后过期，请按 npm 页面提示及时完成一次真实发布。

官方说明：<https://docs.npmjs.com/trusted-publishers/>。

## 日常：推送版本 tag

先提交并推送代码，然后更新版本（不要手动重复使用 `0.1.0`）：

```powershell
npm version patch
# 自动更新 package.json、提交并创建 v0.1.1 等版本 tag。
git push origin master --follow-tags
```

`npm version patch` 前应保证工作区干净。修改依赖时，请同步提交 `pnpm-lock.yaml`。
工作流校验 tag 与 package.json 的版本严格一致；不会从 tag 自动修改版本。
构建产物在 CI 中重新生成；源码有变化时，建议本地先构建并提交 lib/，以保持 Git 安装可用。

## 或者：在 GitHub 网页发布 Release

1. 更新并提交 package.json 版本及对应代码（例如 `0.1.1`）。
2. 推送到 `master`。
3. 在 GitHub Releases 中选择 / 新建 `v0.1.1` tag，确认目标提交正确，点击 **Publish release**。

发布 Release 或推送 `v*` tag 都会触发工作流。相同 tag 的任务串行运行；已存在的 npm 版本会跳过发布，不覆盖旧包，也不会把 dist-tag 改回旧版本。
推送 tag 的路径在 npm 成功后会自动创建 GitHub Release。
`0.2.0-rc.1` 等预发布版本发布到 `next`，稳定版本发布到 `latest`。
GitHub Release 的 prerelease 复选框不决定 npm dist-tag，package.json 的版本后缀才决定。

## 验证流程但不发包

GitHub → Actions → **Release** → **Run workflow**：

- 选择 `master`；
- 保持 `dry-run = true`；
- `tag` 可留空。

这会执行依赖安装、类型检查、构建、测试、插件契约检查和打包预览，不发布 npm，不创建 Release。
真实手动发布时需取消 dry-run 并填入已存在的版本 tag。

## 故障排查

- **401 / 403 / OIDC 404**：核对 npm 的 owner、repo、workflow、environment 和允许 `npm publish`；检查授权是否过期。不要用 `npm whoami` 判断 OIDC 是否有效。
- **Tag must match**：tag 与代码中的版本不一致；创建正确的新版本 tag，不要挪动已发布 tag。
- **等待 environment 审批**：在 GitHub 的 `release` Environment 中完成配置的人工审批。
- **已发布版本**：npm 版本不可覆盖，需要修改内容就升版。
- **npm 正在处理新包**：提交成功后可能暂时返回 404；工作流会有上限地重试查询。如果仍失败，待 npm 处理完成后用 Run workflow、`dry-run=false`、原版本 tag 重跑；已发布版本会跳过，不必升版或挪动 tag。
- **CI 成功但客户端没变化**：npm 不会自动升级已安装插件，用户需主动更新插件并重启 Harness。

## 本地手动发布（备用）

```powershell
npm login --registry=https://registry.npmjs.org
npm run build
npm publish --access public --registry=https://registry.npmjs.org
```

本地发布仍受 npm 账号的 2FA 策略约束；不要在非 CI 环境强制开启 provenance。

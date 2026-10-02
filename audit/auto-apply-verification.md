# 设置自动应用：验证记录

用户已澄清：没有看到保存按钮，期望选择后直接切换。因此取消手动保存交互，不再将“未点保存”当成实际存储接口故障。

## 修改

- 移除 SettingsForm 保存栏，不隐藏原按钮，而是由插件自行显示可用／只读／自动应用／失败状态。
- 选项、开关和有效输入直接提交该字段的 set/unset，携带最新 revision；输入无效时只留在该控件，不阻止其他有效字段应用。
- 自动应用队列串行执行，对尚未提交的同字段修改合并。进行中的旧写入完成后不会清除较新的输入。
- 修改失败保留输入并显示提示，再次选择／编辑即可重试。不循环盲目重试。
- 单字段重置自动应用；全部恢复默认只提交一组原子 unset。
- 保持本机 Host 设置、远程浏览器设置的原归属，不改全局配置、不重启当前宿主、不启动新 Web 服务。

实现：[自动应用模型](<D:/Project/Code/dsh-your-turn/src/client/immediateSettings.ts>)、[设置页面](<D:/Project/Code/dsh-your-turn/src/client/SettingsPage.tsx>)。

## 证据

- **115 个测试／11 个文件全部通过**，类型检查和 diff whitespace 检查通过。
- 设置点击测试确认没有 Save 按钮，点击后 ConfigForm 和持久化值更新。
- 自动应用与 SettingsController 集成测试确认提醒器读取的 resolved config 跟随变化。
- 延迟异步写入测试：连续修改同一字段及不同字段，不丢最后的值。
- 验证无效输入不阻塞其他开关、失败反馈及再次选择重试、全部重置单次原子提交、卸载丢弃排队写入。
- 本轮设置测试通过 `DSH_PRIMITIVES_PATH` 使用已提取的当前 `0.2.0-rc.2` 宿主原始 SettingsFormModel 和 Pill。Store 使用同契约 Observable；其他控件和服务有测试替身，不声称做过已登录真实页面视觉验收。
- 用相同 tsdown 配置重新生成现有安装产物；原生 Node 写入限制的处理方式沿用上一轮，没有新增权限操作。本地及 desktop profile 安装链接的 client bundle SHA256 均为 `08CC8E3F4F77A96F0F015B58457B2BAE4CAFD76ED6B01DAD8E9C0E878567348C`。
- 构建产物的回合结束弹窗及真实宿主 Modal DOM smoke 继续通过。

## 加载新版

未发现 dev:web watcher，不承诺自动 HMR。刷新台式机和笔记本页面确认新版设置页不再有保存按钮；若仍有该按钮，页面尚在用旧 bundle，需要在方便时重启 DSH 后重新加载。未读取当前认证页面的 boot manifest 或实时 DOM。

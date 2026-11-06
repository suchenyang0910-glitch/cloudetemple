# Chùa Mây 首版与家族牌位合并候选交付说明

日期：2026-11-06  
分支：`codex/combined-v1-v2-staging`  
基线：`8c3f83f`  
范围：首版问题 5–7 / 分享与静态内容（A）和家族牌位 staging pilot（B）的合并候选；未部署、未推送、未读取或改动密钥。

## 合并内容

- A 最终功能链：`562272f`、`3041bba`、`4839632`、`db5bb2e`、`c5183df`。
- B 最终功能链：`d0a009a`、`f5732de`、`bc248de`。
- 未带入仅记录部署状态的 `bfd0dba`、`d89caae`。
- 共享入口保留 A 的分享完成面板、推荐入口、活动深链与匿名 activity 归因；staging 的第六个主操作切换为家族供桌，离开入口移入“更多”。
- 家族邀请沿用与 A 一致的“系统分享可用时分享、否则复制链接”行为；家族事件仅允许固定事件名和枚举值。
- `staging`：念珠母珠采用 turn-back，包含 family 页面、脚本、素材和只读 outbox 页面。
- `production`：念珠母珠采用 pass-through；family 入口关闭，family/outbox 页面、脚本和素材不进入发布包。
- 图片加载的 fetch-blob → native-img 保底逻辑未改动。

## 已实测

- 服务端测试：26/26 通过，覆盖 waitlist、CORS、Telegram 禁用模式、家族登录/会话/成员权限/邀请、农历校验、提醒原子领取与重试。
- A 自包含浏览器回归通过：375×548、393×659；活动深链、分享卡、Zalo/Messenger 复制前置、Telegram 长按保存、静态指南、第二圈念珠回转均通过。
- B UI 浏览器回归通过：375×548、393×659；四时段供桌、供奉、建立牌位、账户、邀请页共 16 张截图，无页面脚本错误、无滚动或按钮越界。
- 邀请登录续接回归通过：未登录邀请不会调用受保护的接受接口；邮箱 OTP 登录后恢复邀请并由用户显式接受，接受后成员牌位可见；Google 跳转/回跳保留邀请；401 会回到登录引导并显示自然错误。
- `tests/beads-motion.mjs` 通过：慢拖、限速追赶、松手阈值、反向不计数、边缘手势、点击和 1.4/1.6 颗吸附规则。
- staging 发布包断言通过：family/outbox 和 family-i18n 存在且哈希化，analytics 带 debug 标记，念珠规则为 turn-back。
- production 发布包断言通过：无 family/outbox、无 audio-debug/debug_mode，family 入口关闭，念珠规则为 pass-through。
- `git diff --check` 通过。
- A 与 B 的独立 staging 候选在合并前均已分别完成验证；本说明中的自动测试针对合并后的本地候选重新执行。

## 只在代码里确认

- A 主站 GA 只接受固定 activity、分享渠道、时长/次数区间等枚举；来源和活动深链均经过白名单，查询参数在读取后移除。
- B 家族 GA 只接受 `memorial_create`、`memorial_offer`、`invite_create`、`invite_accept`、`reminder_channel_set`，供奉和提醒渠道必须在固定枚举内；没有发送姓名、邮箱、日期、牌位文字、邀请 token 或 Telegram ID 的调用路径。
- 邀请 token 从 URL hash 读取后立即移除，只暂存在当前标签页的 `sessionStorage`；不写入 query、GA、日志或 `localStorage`，成功接受后删除。
- production 打包不复制 family HTML/CSS/JS/i18n/analytics、family 素材或 dev outbox；staging 才复制并哈希这些文件。
- staging 和 production 的开关由打包时替换，不依赖浏览器或运行时查询参数。
- 隐私页同时披露首版匿名统计字段、家族 pilot 数据、技术日志和撤回方式。

## 没把握

- 未在本任务中部署合并候选，因此没有合并版公网、真实 iPhone、真实 Telegram WebView、真实邮件、Google 登录或系统日历证据。
- 家族邀请与 A 分享面板行为一致，但家族页没有复用 A 的渠道按钮外观；当前仅使用系统分享或复制链接。
- 越南语仍标注待母语者审核。
- 农历算法的内部往返和少量外部样例不能替代权威数据源核验。

## 需要用户决定 / 正式发布阻塞

1. 确认农历数据源与算法许可可用于正式产品。
2. 解决并核准 2030 年外部资料冲突，扩大独立核对样例后再开放真实忌日提醒。
3. 在备份、恢复和删除演练完成前，家族牌位只能使用明确标记的虚构 demo 数据，不能录入真实家庭资料。
4. 合并候选部署 staging 后，仍需用户在真机验证主站进入家族供桌、登录、邀请、分享/复制和返回首版的完整闭环。

## 发布边界

- 本候选只供 staging 验证；没有部署、没有推送，也没有改动 production。
- 正式发布必须重新执行两种打包断言，并在上面的农历与备份阻塞解除后另行批准。

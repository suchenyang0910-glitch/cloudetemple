# C 接入答疑

来源：`codexb/town-production-prep-a20261123-03 @ 63d0f3c`，`town-client.js` 与 `town-access.js` 原样接入，未改模块。

- 默认离线：只有 `entryEnabled === true` 且 `realtimeEnabled === true`，并显式调用 `enter(scene)`，才会请求票据或建立 WebSocket。
- `createTownClient` 只处理协议、重试、快照和座位状态，不创建 DOM 或三维人物；页面仍由场景模块负责渲染。
- 申请座位后先预留 15 秒；走到座位 0.8 米内才发送坐下。预留期间不重复发送 walk/stand。
- 被告知已有人时重新申请推荐空位，间隔至少 2 秒；重连后先清掉旧临时编号，再按新快照绘制。
- 五次重试失败后转单人并停止自动重连；未接入服务器、密钥或部署。

本次仅新增两个根目录模块，供 A 在本地浏览器执行两开关、进出场景、断线回退和座位交互验收。

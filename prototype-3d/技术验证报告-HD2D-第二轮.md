# Cloud Temple HD-2D 技术小样第二轮

日期：2026-11-07
分支：`codex/three-walk-prototype`

## 结论

### Verdict

建议**改用 2.5D / HD-2D 继续验证，不恢复完整 3D 人物，也不放弃空间漫步**。这一版已经消除第一轮最明显的 Roblox/积木感，并把首屏资源控制在 4.88MB；剩余关键不确定性是真实 iPhone、安卓和 Telegram WebView 的手感，而不是桌面浏览器里的可行性。

### Confidence

78%

### Why

- 已审核的 2D 人物和原画贴图直接决定视觉质量，比低面数程序人形更接近现有产品。
- 空间、碰撞、相机和活动触发仍由 Three.js 保留，继续满足“可走进去”的核心体验。
- 本地两个真实 CSS 视口和 4 倍 CPU 降速测试均高于 30FPS，首屏约为 10MB 上限的一半。

### Key Variables

1. Telegram iOS/Android WebView 的真实持续帧率与触控延迟。
2. 2D 人物侧/背切换在真机上的违和程度。
3. 真实移动网络下约 5MB 首屏能否在用户可接受时间内进入。

### Largest Unknown

没有物理 iPhone SE、iPhone 15、Redmi 与 Telegram WebView 的实测；Chromium 的 UA、网络和 CPU 模拟不能替代真实 GPU、Safari/WebKit 内存和 Telegram 容器行为。

### Reversal Condition

如果任一目标真机在连续走动与礼拜 30 秒内平均低于 30FPS、明显掉帧或超过 10 秒仍不能操作，则停止增加 3D 空间层，改成固定镜头的纯 2.5D 分镜；如果多数审核者仍认为画面像游戏而非水墨，则放弃漫步模式。

## 最小验证实验

- **Hypothesis**：HD-2D 在四类目标容器中能保持平均 ≥30FPS，首屏可操作时间 ≤8 秒，且用户能辨认“水墨画中的空间”而非通用 3D 游戏。
- **Test**：iPhone SE/15、中低端 Redmi、Telegram iOS/Android 各冷启动三次，完成院子走动、进殿、上香、礼拜；导出本机 JSON并录屏。
- **Success Metric**：全部设备平均 ≥30FPS；任一次低帧不连续超过 1 秒；4G 冷启动中位数 ≤8 秒；至少 4/5 位审核者选择“水墨画/2.5D”。
- **Failure Threshold**：任一主流目标容器持续低于 25FPS或中位启动 >10 秒；或半数以上审核者仍认为像普通 3D 游戏。
- **Time Limit**：1 个工作日。
- **Decision After Test**：通过则继续扩充院子和大殿互动；性能失败则降为固定镜头 2.5D；审美失败则停止该方向。

## 已实测

- `npm test`：3/3 通过；碰撞区、活动区和首屏字节统计保持正确。
- 375×548、393×659 Chromium 全流程：院子 → 大殿 → 上香 → 礼拜；无控制台错误、无横向滚动、无外部请求。
- 375×548：初始约 60FPS，采样低值约 52FPS；约 6,502 三角面、134 次绘制。
- 393×659：初始约 60FPS，采样低值约 55FPS；约 6,360 三角面、131 次绘制。
- 4Mbps 下载 / 1Mbps 上传 / 80ms RTT：iPhone 15 Chromium 代理约 4.95 秒可运行、约 60FPS；4 倍 CPU 的 Redmi 代理约 5.12 秒、约 55FPS。
- 浏览器实际请求资源约 4.88MB；静态发布包 4.88MB，低于 10MB。
- 性能面板可导出最近三分钟 FPS、绘制量、资源字节和浏览器可用内存 JSON；数据不上传。
- 30 秒 H.264 录屏：394×660、5FPS、958,611 字节、时长 30 秒。
- 人物为透明 2D billboard；走路使用侧/背帧，坐禅和礼拜复用现有批准帧；没有双臂上举动作。
- 独立预览 `https://staging.chuamay.org/hd2d/`：未认证返回 401；使用 staging 同一 Basic Auth 后，HTML、JS 和 WebP 均返回 200，并带 `X-Robots-Tag: noindex`。
- 公网 393×659 Chromium 加载：页面标题正确、WebGL canvas 存在、页面无滚动；应用自身无控制台错误。Cloudflare 注入的 Web Analytics beacon 被 staging CSP 拦截，不影响小样。
- 服务器上发布包 35 个文件均通过 SHA-256 复核；h5、miniapp 和 production API healthz 在部署后仍为 200。

证据：

- `evidence/hd2d/browser-report.json`
- `evidence/emulated-4g-report.json`
- `evidence/walk-hd2d-30s.mp4`
- `evidence/hd2d/comparison-{courtyard-walk,hall-front,incense,bow-mid}.png`

## 只在代码确认

- 地板、供桌和佛座继续使用盒体碰撞；活动时人物朝向佛像位置。
- 佛像只是本地无五官、手印或装饰的光晕剪影；不可点击。
- 本地模拟访客只有 `?locals=1` 才显示，独立预览默认不出现。
- 减少动效模式停用走路上下浮动和镜头缓动。
- 所有运行时资源为自托管项目素材和 Three.js；没有 CDN、外部字体、第三方模型或未知授权素材。

## 没把握

- 物理 iPhone SE、iPhone 15、Redmi 和 Telegram iOS/Android 的真实 FPS、内存峰值、触控延迟与休眠恢复。
- Safari/WebKit 通常不提供 `performance.memory`，届时内存字段会显示不支持，不能据此宣称真机峰值内存。
- 新补的侧/背走路和站立合掌帧虽已通过代码与截图检查，仍需用户按人物一致性人工审图。
- 独立预览的 Telegram 打开体验仍需用户用测试入口验证；正式机器人和正式环境均未修改。

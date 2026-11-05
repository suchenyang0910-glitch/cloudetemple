# iPhone 无声排查（仅 staging）

2026-11-05。用户截图来自 iPhone Chrome，未当成 Safari 测试证据。声音和触感分别处理。

## 部署证据

- staging 已切到 `cb4e5f6f3f4e`；分支 `fix/staging-iphone-audio` 已推送，未合并 main。上一静态版本 `f2e3804fc2b6` 保留。
- app.js、audio.js、audio-debug.js 服务器 SHA256 与本地 staging 包一致。
- 仅 staging Nginx 增加音频 MIME location，`nginx -t` 通过并 reload；原配置保存在服务器 staging 目录。没有关闭 Basic Auth。
- 未认证音频请求仍为 HTTP 401（预期保护行为，不是已登录浏览器的请求证据）。认证后的真实状态与 MIME 请看手机诊断条。
- 正式环境发布指针仍为 `849bafb840ec`，HTTP 200；未 reload 正式 Nginx、未变更正式代码/API/机器人配置。

## 已确认的代码缺口 / 尚未确认的根因

- 原代码遇到 AudioContext 非 running 时直接跳过敲击，没有在该次手势恢复。这是确认的代码缺口；本地用真实 AudioContext.suspend() 模拟后，修复版点击可以恢复 running。
- 原代码已在 fetch 前创建并 resume AudioContext，fetch 默认也已带同源凭据；不能把“原来必然没用户手势/没带凭据”说成根因。本轮增加同步静音帧解锁，显式声明 credentials: same-origin。
- staging 容器内原 MIME 为 audio/x-m4a；本轮只给 staging 增加音频 location，使用 audio/mp4、audio/mpeg。这个差异不能单独证明就是无声原因。
- 没有用户真机音频状态，无法确认静音开关、系统中断、网络鉴权、输出设备或其他因素哪一个导致本次无声。不得将“已开声音”或播放 Promise 成功当成物理扬声器可听的证明。

## 改了什么

- 设置 audioSession.type=playback 后再创建 Context；同一点击栈调用 resume 和极短静音 Buffer。resume 等待不阻塞下载，避免 interrupted 状态下卡住全部素材加载。
- 监听 statechange；开启声音时，每次点击尝试恢复 Context，前台返回同样恢复。音量钟从 0.45 改为 0.6，master 默认 0.25。
- 预建 preload=none 的 HTMLAudioElement。上下文未恢复时，用户点击可走 HTML 音频回退；诊断页也可单独测试该路径。静音同时停止 Web Audio 和 HTML 音频。
- 限制：应急 HTML 路径每种声音复用一个元素，不保证快速重叠；正常 Web Audio 路径仍是六声部。不能据此承诺 iPhone 已修好。
- 诊断脚本只随 `tools/package.ps1 -Environment staging` 打包；默认 production 打包删除旧诊断文件且不含脚本标签。正式网站没有部署任何修改。

## 如何真机诊断

1. 分别在 iPhone 的 Chrome、Safari 打开 https://staging.chuamay.org/?debug=audio ，沿用原来的 staging 登录方式。
2. 点 **测试声音：440Hz → 木鱼**，应先听到约 0.3 秒提示音，再听到木鱼。
3. 再点 **单独测试 HTML 音频**，记录是否能听到。
4. 点 **复制诊断**，发回文本或诊断条截图，并注明 Chrome/Safari、手机静音开关状态、哪一种声音能听见。文字区可滚动；收起诊断条后可以继续正常操作。

诊断包含 state、sampleRate、currentTime 是否前进、audioSession、各文件 HTTP/MIME/解码结果、最近调度与 gain、UA、Telegram 状态。只显示在本机，无上传、无本地持久化，不读取密码、Token、Cookie 内容。

## 已验证 / 未验证

- 本地 Chromium 自动化通过：诊断初始无音频下载；200/解码成功/时钟前进；HTML 音频播放 Promise 成功；挂起后点击恢复；静音停止两条链路；注入 401 和无效音频体后诊断可见。无 JS 异常。
- 原音频回归通过：20 次点击、六声部上限、静音记忆、后台停止、跨日清零、108 提示、60 秒背景恢复。
- production/staging 打包隔离断言通过。截图 `screenshots/iphone-audio-debug.png` 是 393×852 本地 Chromium 模拟截图，并非 iPhone Safari/Chrome 实机。
- 未实测 iPhone Chrome/Safari、物理静音开关、耳机/蓝牙路由、系统中断、硬件触感，也没有使用 staging 密码完成认证后的线上播放测试。

## 震动单独说明

保持 Telegram HapticFeedback 和支持时的 navigator.vibrate。是否实际震动还取决于设备、Telegram 和用户触感设置，不能保证一定震动。

本轮放弃隐藏 switch 方案：WebKit 已专门修复通过程序点击关联 label 触发触感的途径，要求可信用户事件。把不可见开关盖在木鱼上会改变控件语义与点击处理，没有真机证据不将此替换加入正式交互。[WebKit 原始变更与测试](https://github.com/WebKit/WebKit/commit/fc1ef8)。

音频中断依据：[MDN BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)。这是可能机制的文档，不是这台手机根因的证据。

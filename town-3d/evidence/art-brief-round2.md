# 3D 小镇美术简报 — Round 2（2026-11-11）

> 状态：P0 第 2 轮代码已提交，待用户取截图审图。
> 本文件记录**代码尚未解决、需要美术出图**的遗留项。

---

## A1. 合掌背影帧 `palms-back.webp`（阻塞项）

| 字段 | 规格 |
|------|------|
| 文件名 | `prototype-3d/assets/visitor/palms-back.webp` |
| 画幅 | 与其他 visitor 帧相同（参考 stand-back.webp 尺寸）|
| 内容 | 人物**背朝镜头**，双手于胸前合掌；与 `stand-back` 姿态相同，只是两臂向内合拢 |
| 优先级 | 高：现在在寺门触发时显示 `stand-back` 代替（代码注释已标注）|

> 交付后：在 `character.js` `poseVisitor('palms')` 里把 `rig.view === 'back'` 分支从 `'stand-back'` 改为 `'palms-back'`。

---

## A2. 寺庙外观参考图（下一轮，不阻塞 Round 2 审图）

| 寺 | 建筑特征 | 优先级 |
|----|----------|--------|
| Chùa Mây（云寺）| 越南北传，红木柱，双层飞檐，正门牌楼 | M |
| Chùa Di Lặc（弥勒寺）| 圆润拱门，宽广庭院，弥勒铜像轮廓 | M |
| 其余五寺 | 参考 v2.1-taskC-artwork-briefs.md § C2 | L |

> 现阶段寺庙用 canvas 程序化纹理（石板地、木纹、瓦片）代替。
> 有正式原画后换 `THREE.TextureLoader` 加载，`woodTexture()` 等工厂函数直接替换即可。

---

## 截图任务（用户手动）

用 `node tools/serve.mjs` 或 `npx serve .` 启动，Chrome 开发者工具设为 393×659（iPhone 14 Pro），截以下 3 张：

| 编号 | 场景 | 时机 |
|------|------|------|
| S1 | 全景 | 初始 spawn 位置，不移动，确认 ≥3 座寺可见 |
| S2 | 走路中 | 向弥勒寺方向走到中途 |
| S3 | 寺门触发 | 走到云寺门口（Vào chùa 面板出现）|

存入 `town-3d/evidence/screenshots/round2/`。

## 帧率测量

在 Chrome 开发者工具 → Performance 面板录制 10 秒走路，记录 median FPS；或在控制台：
```js
let f=0,t=performance.now(); const id=setInterval(()=>{ f++; if(performance.now()-t>5000){clearInterval(id);console.log('FPS:',f/5);} },16);
```

## 首屏体积

```
npx serve . # 启动 serve
curl -s -o /dev/null -w "%{size_download}" http://localhost:3000/town-3d/index.html
```
或在 Network 面板 → Disable cache → 刷新 → 查看 Transferred 合计。

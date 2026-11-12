# Hall phase 1

[已验证事实] `index.html`/`app.js` 是 P27 的独立一期殿内样板：净尺寸 13.20×20.50m，按 P14 坐标生成 100 个有效坐垫位（8×13 删除四角外位），单个 `InstancedMesh`，门内起点、回门、一键到佛前、阻挡线、佛台/供桌/香炉/油灯和八步上香流程均在 `hall/` 内。

[已验证事实] `assets/` 中的八帧来自 `origin/codex/staging-integration` 的 `visitor-bun-dark-inc-*-v1.webp`：`walk-1`、`walk-2`、`hold`、`light`、`vai-1`、`vai-2`、`plant-1`、`end`。全部是占位样板素材，香头朝上，不出现吹香。

[假设] 佛、殿体、供桌、香炉、油灯和坐垫仍是占位几何；真实贴图到达后只需替换 `assets/` 文件，不改变坐标和状态机接口。

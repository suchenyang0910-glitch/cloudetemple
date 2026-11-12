# Hall phase 1

[已验证事实] `index.html`/`app.js` 是 P27 的独立一期殿内样板：净尺寸 13.20×20.50m，按 P14 坐标生成 100 个有效坐垫位（8×13 删除四角外位），单个 `InstancedMesh`，门内起点、回门、一键到佛前、阻挡线、佛台/供桌/香炉/油灯和八步上香流程均在 `hall/` 内。

[已验证事实] `assets/` 中的八帧来自 `origin/codex/staging-integration` 的 `visitor-bun-dark-inc-*-v1.webp`：`walk-1`、`walk-2`、`hold`、`light`、`vai-1`、`vai-2`、`plant-1`、`end`。全部是占位样板素材，香头朝上，不出现吹香。

[已验证事实] P30 接入 Codex C 的 `origin/codexc/pet-art:review/p26-b-hall-textures/` 11 张样张：地面、墙、天花、门框、佛台、供桌、香炉、燃香、油灯、坐垫、佛剪影。样张文件已复制到 `assets/`，不改 Codex C 分支。

[假设] 访客八帧仍是占位样板素材；佛堂尺寸、碰撞和状态机坐标不变，后续只替换样张即可。

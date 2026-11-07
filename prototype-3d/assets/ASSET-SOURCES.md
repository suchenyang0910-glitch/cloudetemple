# HD-2D 素材来源

## 项目自有、已审核素材

- 人物身份与三视图：`reference-pack/visitor-bun-light-turnaround.png`。
- 礼拜三帧：`../assets/processed-v1/img/visitor-bun-light-bow-{1,2,3}.webp`。
- 坐禅正面：`../assets/processed-v1/img/visitor-bun-light-sit.webp`；第三轮侧面坐禅补帧：`assets/source/visitor-sit-side.png`。
- 无佛像大殿布局：`reference-pack/hall-front-day-no-buddha.png`。
- 院子：`../assets/processed-v1/img/scene-vn-courtyard-day.webp`。
- 香炉、供桌、蒲团、柱子、灯盏、托木参考：`reference-pack/objects/`。

这些素材均来自 Cloud Temple 自有原画与已批准的内置 imagegen 参考图，不含下载的第三方模型、动作或贴图。

## 本轮内置 imagegen 补帧

- `assets/source/visitor-walk-side-strip.png`：侧面走路两帧。
- `assets/source/visitor-walk-back-strip.png`：背面走路两帧。
- `assets/source/visitor-palms-standing.png`：站立合掌举至额前。
- `assets/source/visitor-sit-side.png`：左侧面盘腿坐禅，双手叠放腹前，人物与蒲团完整。

生成工具为 OpenAI 内置 imagegen；未调用 Tripo 或其他付费 3D 服务。完整提示词见 `IMAGEGEN-PROMPTS.md`。运行时 WebP 由 `tools/build-hd2d-assets.py` 从上述来源生成。

## 运行库

- Three.js 0.187.0，自托管，MIT；许可证见 `vendor/THREE-LICENSE.txt`。
- 页面不加载第三方 CDN、字体、模型、贴图或统计脚本。

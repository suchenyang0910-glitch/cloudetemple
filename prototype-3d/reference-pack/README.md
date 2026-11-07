# Tripo Private 小样参考包

本目录只包含 Cloud Temple 已审核、自有的 2D 原画及其机械裁切版本，不含任何 Tripo 或其他 AI 3D 生成物。

## 人物

采用首版访客中的发髻女性：越南年轻成年人、有头发、宽松米白色 áo bà ba、深棕长裤、赤脚，不是僧人。

- `visitor-bun-light-front.png`：正面几何参考。
- `visitor-bun-light-side.png`：左侧面几何参考。
- `visitor-bun-light-back.png`：背面与发髻参考。
- `visitor-bun-light-turnaround.png`：三视图总览。
- `visitor-bun-light-style.webp`：网页最终用色与水墨淡彩质感参考；只作风格参考，不与三视图混作多视图几何输入。

人物三视图来自 `source/approved-character-turnaround.png` 的右半部分，三张裁切保持同一比例、同一背景和同一姿势。生成前仍应在 Tripo 中核对三视图槽位，不得把侧面误放到背面。

## 大殿

- `hall-front-day.webp`：正面对称结构、木柱、屋梁、供台和水墨色彩参考。
- `hall-side-day.webp`：空间深度与侧向构图参考。

这两张大殿图不是同一对象的摄影多视图，不能当作 Tripo Multi-view 的相机一致输入。先以正面图生成结构小样；侧面图仅用于人工核对空间、材质和色彩。佛像本轮只保留简化剪影占位，禁止让生成工具补做造像细节。

## 完整性

`SHA256SUMS.txt` 记录提交时的参考文件哈希。用户下载模型后，应另建模型清单，记录 Tripo 任务日期、Private 状态截图、计划凭证、输入哈希与输出哈希。

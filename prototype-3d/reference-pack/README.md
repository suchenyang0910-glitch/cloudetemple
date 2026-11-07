# Tripo Private 小样参考包

本目录只包含 Cloud Temple 已审核的访客原画、无佛像布局参考及为独立物件准备的白底图；不含任何 Tripo 或其他 AI 3D 生成物。

## 人物

采用首版访客中的发髻女性：越南年轻成年人、有头发、宽松米白色 áo bà ba、深棕长裤、赤脚，不是僧人。

- `visitor-bun-light-front.png`：正面几何参考。
- `visitor-bun-light-side.png`：左侧面几何参考。
- `visitor-bun-light-back.png`：背面与发髻参考。
- `visitor-bun-light-turnaround.png`：三视图总览。
- `visitor-bun-light-style.webp`：网页最终用色与水墨淡彩质感参考；只作风格参考，不与三视图混作多视图几何输入。

人物三视图来自 `source/approved-character-turnaround.png` 的右半部分，三张裁切保持同一比例、同一背景和同一姿势。Tripo 正向提示词必须加 `adult woman, realistic adult proportions`；三视图槽位与裁切不得改变。

## 大殿布局

- `hall-front-day-no-buddha.png`：无佛像、莲座和背光细节的布局与色彩参考。
- 此图不用于整座大殿图生 3D；框架由 Blender/代码按原画布局搭建。
- 原始含佛像的大殿图不在本包内，不得上传给 Tripo。
- 佛像位置仅在本地场景放无细节剪影占位。

## 独立物件

`objects/` 内六张图均为单物件白底参考：香炉、供桌、蒲团、圆柱与石柱础、莲花灯盏、云纹托木。每次只上传一个物件；具体面数目标和导入流程见 `TRIPO-PRIVATE-PILOT.md`。

这些白底参考由 OpenAI 内置 imagegen 依据项目自有的无佛像水墨场景生成，仅作为 Tripo Private 生成前的待审输入；提示词记录在 `IMAGEGEN-PROMPTS.md`。

## 总览与完整性

- `reference-overview.png`：给用户审核用的总览，不作为 Tripo 多物件输入。
- `SHA256SUMS.txt`：提交时的参考文件哈希。

用户下载模型后，应另建模型清单，记录 Tripo 任务日期、Private 状态截图、计划凭证、输入哈希与输出哈希。

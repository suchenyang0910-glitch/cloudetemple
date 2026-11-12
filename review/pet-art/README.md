# P20 萌宠园美术样张

状态：仅供 Claude/用户审阅的 review 样张；未拆分到正式资产目录，未宣称已批准、已接入或已部署。

## 约束与参考

- 统一使用 Codex 内置 imagegen 生成，再转为 WebP；无外部素材来源。
- 参考现有云寺小镇外景与植物簇的手绘水彩、淡彩、东南亚小镇气质（如 `town-3d/assets/exterior-chuamay-day.webp`、`flora-cluster-01.webp`、`flora-cluster-02.webp`）。
- 全部提示词要求：无文字、无人物、无真实照片感、无宗教符号、无十字架、无惊悚/扰动内容。
- 石碑、供花、供灯、植物簇、物种图标为透明背景；场景与地面为不透明背景。
- `pet-species-icons.webp` 为五格 sprite（猫/狗/兔/鸟/其他），当前只作为样张，未声明已切帧。

## 文件与规格

| 文件 | 实测尺寸 | 实测大小 | 备注 |
|---|---:|---:|---|
| `pet-garden-ground.webp` | 1024×1024 | 168,996 B | 可平铺地面样张 |
| `pet-garden-entrance.webp` | 1024×512 | 107,236 B | 入口场景样张 |
| `pet-garden-walkway.webp` | 1024×512 | 127,914 B | P20 文字补充项 |
| `pet-garden-flora-cluster.webp` | 512×512 | 56,074 B | P20 文字补充项，透明 |
| `pet-memorial-wall.webp` | 1024×512 | 94,004 B | P20 文字补充项 |
| `pet-independent-garden.webp` | 1024×1024 | 291,592 B | P20 文字补充项 |
| `pet-memorial-stone-a.webp` | 512×512 | 32,922 B | 透明，空白石面 |
| `pet-memorial-stone-b.webp` | 512×512 | 49,342 B | 透明，空白牌面 |
| `pet-memorial-stone-c.webp` | 512×512 | 31,118 B | 透明，空白自然石 |
| `pet-flower-offering.webp` | 256×256 | 9,026 B | 透明 |
| `pet-lamp-offering.webp` | 256×256 | 16,262 B | 透明 |
| `pet-species-icons.webp` | 512×256 | 20,520 B | 透明五格 sprite |

## ASSET-SOURCES

每个文件均为：`source=Codex built-in imagegen; external_source=none; prompt=本 README 的约束与对应文件描述; generated=2026-11-12; status=review-only; formal_asset_dir=no`。

这些样张需要 Claude/用户逐项确认风格、构图、透明边缘、可平铺性及是否进入正式资产流程；本分支不执行正式资产目录迁移或接入。

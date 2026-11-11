# 3D 小镇美术简报 — Round 3（2026-11-11）

> 状态：P0 第 3 轮代码已提交，等待美术出图后替换占位图。
> 本文件是给 Codex / 人工画师的完整出图指令。

---

## 总体风格

**水墨立牌 / 越南庙宇水彩插画**（HD-2D billboard 风格）

| 参数 | 要求 |
|------|------|
| 整体色调 | 低饱和暖棕 × 青绿天空；水彩晕染边缘，不硬线描 |
| 视角 | 仰视约 15°，三点透视轻微；寺正面朝向镜头 |
| 时段 | 白天（daylight），光线从左上45°打入 |
| Alpha通道 | **必须**：PNG 或 WebP with transparency；天空/背景全透明 |
| 尺寸 | 每张 **1024 × 1536 px**（竖版 2:3），最终导出 WebP ≤ 300 KB |
| 命名规范 | `exterior-<id>-day.webp`，存入 `assets/processed-v1/img/` |

---

## 寺庙立牌（7 张）

### T1 — Chùa Mây（云寺）**阻塞项，最高优先级**

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-chuamay-day.webp` |
| 现用占位 | `scene-vn-courtyard-day.webp`（主寺内院全景，非外立面） |
| 建筑特征 | 越南北传，双层飞檐，红木柱，悬山式主门楼；山墙有云纹浮雕 |
| 前景 | 石台阶三级，石狮一对（小），香烟轻渗 |
| 植物 | 右侧探出一株盛开桃花（粉白） |
| 注意 | **这张是整个小镇视觉锚点**；和主 app 中的云寺场景图色调必须一致 |
| 优先级 | 🔴 P0 |

### T2 — Chùa Di Lặc（弥勒寺）*来自开放候选列表*

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-dilac-day.webp`（当前状态 coming_soon，提前备图） |
| 建筑特征 | 圆润拱门，宽广庭院；山门正中有弥勒铜像轮廓（侧面剪影可见） |
| 色调 | 比云寺更暖（金黄+赭石），圆形窗洞 |
| 优先级 | 🟡 P1 |

### T3 — Chùa Quan Âm（观音寺）

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-quanam-day.webp` |
| 建筑特征 | 白墙蓝瓦，观音莲台浮雕于山墙；正门有莲花纹铁栅 |
| 色调 | 冷白 × 淡蓝 × 金色线条 |
| 优先级 | 🟡 P1 |

### T4 — Chùa Liên Trì（莲池寺）

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-lienchi-day.webp` |
| 建筑特征 | 水边建筑风，前院有石莲池（干涸描绘即可），回廊低矮 |
| 色调 | 青灰 × 石绿苔痕 |
| 优先级 | 🟡 P1 |

### T5 — Chùa Địa Tạng（地藏寺）

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-diatang-day.webp` |
| 建筑特征 | 深褐木构，庭院植柏树；寺门可见，门内不画任何佛菩萨形象 |
| 色调 | 深褐 × 墨绿；整体较暗、肃穆 |
| 优先级 | 🟡 P1 |

### T6 — Chùa Dược Sư（药师寺）

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-duocsu-day.webp` |
| 建筑特征 | 青砖白灰，山门悬七宝琉璃灯；庭院植药草（模糊绿植即可） |
| 色调 | 青砖灰 × 透亮天蓝 |
| 优先级 | 🟡 P1 |

### T7 — Khu phố Nam Tông（南传街区）⏸ 暂缓

> **不出图**：继续使用灰调剪影立牌占位，待南传内容方向确认后再安排。

| 字段 | 规格 |
|------|------|
| 文件名 | `exterior-namtong-day.webp`（暂缓） |
| 现状 | canvas 灰调剪影（同其他未开放寺） |
| 优先级 | ⏸ 暂缓 |

---

## 地面贴图（3 张）

### G1 — 石板路（现有代码已用 canvas 替代，此为美术升级）

| 字段 | 规格 |
|------|------|
| 文件名 | `ground-stone-courtyard.webp` |
| 尺寸 | 512 × 512 px，可平铺（UV repeat 5×7） |
| 内容 | 越南庙宇石板地面；不规则多边形石块，间缝有苔痕；无格子网格感 |
| 色调 | **偏灰石板色**：底色 `#9ea89a`（灰绿），石缝 `rgba(50,55,45,.35)`；整体像潮湿石板 + 浅草绿，**不要橙黄沙漠色** |
| 优先级 | 🟢 P2（canvas 版暂用灰绿占位，见代码）|

### G2 — 庭院中心（汇合点）

| 字段 | 规格 |
|------|------|
| 文件名 | `ground-plaza-center.webp` |
| 尺寸 | 512 × 512 px，可平铺 |
| 内容 | 更规整的方形石砖；中央有莲花砖刻浮雕（水墨感） |
| 色调 | 比 G1 偏浅，`#c0c8b8`（浅灰绿石砖） |
| 优先级 | 🟢 P2 |

### G3 — 寺间绿化立牌（新增）

| 字段 | 规格 |
|------|------|
| 文件名 | `flora-cluster-01.webp`、`flora-cluster-02.webp`（至少 2 变体） |
| 尺寸 | 512 × 768 px（竖版），透明背景 |
| 内容 | 越南庙宇庭院常见植物丛：芭蕉、竹子、矮灌木 + 野草；水墨淡彩风格；**无人物、无建筑** |
| 用途 | 以 billboard 方式散布在各寺之间空地，让小镇有绿化而非空旷石板 |
| 色调 | 墨绿 × 黄绿，与 G1 石板灰绿协调 |
| 数量 | 2–3 变体（代码随机选用） |
| 优先级 | 🟡 P1（让小镇有小镇感）|

---

## 合掌背影帧（1 张）— 仍阻塞

### V1 — `palms-back.webp`

| 字段 | 规格 |
|------|------|
| 文件名 | `prototype-3d/assets/visitor/palms-back.webp` |
| 画幅 | 与其他 visitor 帧相同（参考 `stand-back.webp` 像素尺寸） |
| 内容 | 人物背朝镜头，双手于胸前合掌；与 `stand-back` 姿势相同，双臂向内合拢；衣物细节一致 |
| Alpha | 透明背景 |
| 优先级 | 🔴 P0（代码中已占 `stand-back` 代替，注释标明此处） |

---

## 代码占位说明（无美术图时的 fallback）

| 资产 | 现用占位 | 替换方式 |
|------|----------|---------|
| 云寺立牌 | `scene-vn-courtyard-day.webp` | 换 `exterior-chuamay-day.webp`，改 `scene.js` loader 路径 |
| 其余 6 寺立牌 | canvas 灰调剪影（程序化生成） | 同上，各对应文件名 |
| 地面贴图 | `organicStoneCanvas()`（canvas 程序化） | 换 `THREE.TextureLoader` 加载 G1/G2 |
| 合掌背影 | `stand-back.webp` | 换 `palms-back.webp`，改 `character.js` 一行 |

---

## Codex 生成提示词参考（T1 云寺）

```
Vietnamese Buddhist temple exterior facade, watercolor ink-wash style,
daytime lighting, warm ochre tones with cyan sky, double hip roof with
upturned eaves, red wooden columns, stone steps with small stone lions,
blooming pink-white peach tree on right side, transparent background,
no grid lines, painterly brushwork, 1024x1536 portrait orientation
```

调整寺名对应特征替换括号内描述即可生成 T2–T7。

---

## 审图检查单

在 393×659（iPhone 14 Pro）模拟宽度下：

- [ ] 云寺立牌比其他立牌更鲜明（不灰）
- [ ] 未开放寺：灰调剪影可辨认为寺庙（非方块），有屋顶轮廓
- [ ] 寺名字号可读（≥16px 主名，≥13px 状态）
- [ ] 地面无明显方格线
- [ ] 无深色斜条穿越场景
- [ ] 人物在立牌前方走动，遮挡关系正确

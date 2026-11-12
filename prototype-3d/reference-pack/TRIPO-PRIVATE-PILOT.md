# Tripo 付费 Private 小样参数与后处理

## 使用边界

- 由用户本人购买并操作 Tripo 付费账号。
- 生成前确认任务为 Private，并保存订阅、Private 状态和退订后永久商用权的书面确认。
- Codex 不登录、不调用 Tripo API、不接触 token，不把素材上传到任何第三方。
- 只生成一个访客和六类独立物件；大殿框架在 Blender/代码中搭建，不用 Tripo 整图生成。
- 任何上传给 Tripo 的图片都不得含佛像、佛像局部、面部、手印、莲座或背光细节。

参数名称依据 2026-11-07 的 Tripo 官方文档；购买当天以 Studio 实际界面为准，不为了匹配文档而调用 API。

## 人物建议

1. 使用 Studio 的 Multi-view，上传 front / side / back 三张一致视图；三视图顺序、裁切和比例保持不变。
2. 正向提示词必须包含：`adult woman, realistic adult proportions`。
3. 负向约束：`child, kid, teenager, baby face, chubby cheeks, short child proportions, bald, shaved head, monk, monk robe, kasaya, saffron robe`。
4. 选择 Clean Topology / Smart Mesh，而不是约 200 万面的 HD 输出。
5. 目标拓扑：Quad；初始面数 12,000–18,000，最高不超过 20,000。
6. 纹理先用 2K、PBR 开启；保留同一 seed。色彩以原图为准，不追加珠宝、袈裟、鞋、帽或僧人元素。
7. 如果界面提供 `delight`，人物保持开启，去掉参考图里的固定光照后再由网页灯光着色。
8. 先导出 FBX 保留四边面供绑定，再导出 GLB 做网页验证；不要在生成阶段改导出轴向后继续做 Tripo 后处理。

验收：明确是成年女性、真实成年人四肢与肩胯比例、发髻完整、衣服宽松直筒、手脚五指不粘连、无光头/僧服；A-pose 或自然站姿可稳定绑定。

## 大殿与物件方案

### 布局参考

- `hall-front-day-no-buddha.png` 只用于人工核对布局、透视和水墨色彩，不作为整座大殿的 Tripo 输入。
- 中央造像、莲座、背光已移除；原始含佛像大殿图不在本参考包内，也不得上传给 Tripo。
- 大殿框架（地板、柱网、梁、屋顶、背墙、两侧窗景）由 Blender/代码按参考图搭建。
- 佛像位置仅放不可点击、无细节的剪影占位；不使用任何含佛像细节的图像或生成任务。

### 独立物件生成

每次只上传 `objects/` 中一张白底图，使用 Image-to-3D、Clean Topology / Smart Mesh、PBR 和 `delight`（若有）。先以 2K 纹理生成，导入后统一降到 1K–2K。面数目标为最终三角面预算：

| 物件 | 参考图 | 目标三角面 |
| --- | --- | ---: |
| 三足香炉 | `objects/incense-burner.png` | 1,500–3,000 |
| 供桌（含浅雕花） | `objects/altar-table.png` | 4,000–8,000 |
| 圆形蒲团 | `objects/meditation-cushion.png` | 800–1,500 |
| 圆柱 + 石柱础 | `objects/column-stone-base.png` | 800–1,500 |
| 莲花灯盏 | `objects/lotus-oil-lamp.png` | 800–1,500 |
| 云纹托木 | `objects/cloud-bracket.png` | 800–1,500 |

验收：物件轮廓完整、底部可稳定落地、没有粘连背景、没有新增人物/造像/文字；浅雕花和编织纹理优先烘进贴图或法线，不用高密度几何硬刻。

### Blender/代码搭建预算

- 大殿壳体目标 20,000–35,000 三角面；圆柱、柱础和托木使用实例化复用。
- 地板、背墙、梁和屋顶做模块化低面数网格；不可走区域用简单盒体碰撞。
- 供桌、香炉、蒲团与灯盏作为独立对象摆放，便于按需加载和碰撞约束。
- 佛像剪影占位由本地简单网格/平面完成，不从 Tripo 生成，不刻画脸、手印或装饰。

## 收到模型后的本地流程

1. **隔离检查**：保存原始文件只读副本；记录 SHA-256、格式、面数、材质、纹理尺寸和授权证据。
2. **Blender 清理**：统一米制与朝向；应用变换；删除隐藏重复面、非流形碎片和无用材质；不自动补造佛像细节。
3. **人物绑定**：优先使用 Tripo 导出的 Quad FBX；建立简化 humanoid 骨架，检查肩、肘、腕、髋、膝、踝；手工修正权重。动作只做走、站、坐、合掌、越南 lạy。
4. **礼拜校准**：站立合掌举到额前 → 跪下 → 合掌俯身额头近地 → 起身，连续三拜；不得出现双臂上举或背对佛像。
5. **水墨着色**：把 Tripo PBR 贴图作为底色，降低饱和度；Three.js 使用 toon ramp、距离相关墨线、米纸纹理和柔雾。人物与建筑共用暖灰木色调，不靠高光塑料感表现材质。
6. **纹理压缩**：先降到 1024–2048；Base Color 使用 KTX2 ETC1S，Normal 使用 KTX2 UASTC；合并小贴图并生成 mipmap。
7. **几何压缩**：导出 GLB，优先 Meshopt；若现有运行链验证 Draco 更小且低端机解码可接受，再改用 Draco。删除未用动画、切线和顶点色。
8. **预算闸门**：人物最终文件 ≤3MB；六类物件合计建议 ≤3MB；首屏全部必需资源仍须 ≤10MB。超限时先降纹理，再减面，不牺牲人物轮廓和屋檐剪影。
9. **设备验证**：iPhone SE/15、中低端安卓、Telegram iOS/Android；记录首次加载、平均/最低 FPS、峰值内存和崩溃。

## 用户交付给 Codex 的文件

- 原始 FBX 或 GLB，不要经过聊天软件二次压缩。
- 对应纹理文件及材质引用；如有绑定，附骨架和动画。
- 生成任务日期、Private 状态截图、付费计划凭证、Tripo 永久商用权书面回复。
- Tripo 导出的预览图和参数截图；无需提供账号、密码、Cookie 或 API token。

## 官方参数依据

- Multi-view 与 Smart Mesh：https://www.tripo3d.ai/product-doc/model-generation/multi-view-to-3d
- Rigging 与动作：https://www.tripo3d.ai/product-doc/module-post-processing/rigging-animation
- 导出格式：https://www.tripo3d.ai/product-doc/export-and-integration/export-dcc
- 图生 3D 的面数、PBR、压缩与朝向：https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard

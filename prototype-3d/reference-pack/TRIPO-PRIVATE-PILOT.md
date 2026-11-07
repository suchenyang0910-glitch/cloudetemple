# Tripo 付费 Private 小样参数与后处理

## 使用边界

- 由用户本人购买并操作 Tripo 付费账号。
- 生成前确认任务为 Private，并保存订阅、Private 状态和退订后永久商用权的书面确认。
- Codex 不登录、不调用 Tripo API、不接触 token，不把素材上传到任何第三方。
- 只生成一个访客和一座大殿；不发布到 Community、Gallery 或公开链接。

参数名称依据 2026-11-07 的 Tripo 官方文档；购买当天以 Studio 实际界面为准，不为了匹配文档而调用 API。

## 人物建议

1. 使用 Studio 的 Multi-view，上传 front / side / back 三张一致视图。
2. 选择 Clean Topology / Smart Mesh，而不是约 200 万面的 HD 输出。
3. 目标拓扑：Quad；初始面数 12,000–18,000，最高不超过 20,000。
4. 纹理先用 2K、PBR 开启；保留同一 seed。色彩以原图为准，不追加珠宝、袈裟、鞋、帽或僧人元素。
5. 如果界面提供 `delight`，人物保持开启，去掉参考图里的固定光照后再由网页灯光着色。
6. 先导出 FBX 保留四边面供绑定，再导出 GLB 做网页验证；不要在生成阶段改导出轴向后继续做 Tripo 后处理。

验收：成年人比例、发髻完整、衣服宽松直筒、手脚五指不粘连、无光头/僧服；A-pose 或自然站姿可稳定绑定。

## 大殿建议

1. 当前两幅画不是摄影多视图，只上传 `hall-front-day.webp` 做单图结构小样；`hall-side-day.webp` 仅人工参照。
2. 选择 Clean Topology / Smart Mesh，Triangle 或 Quad 均可；目标 20,000–35,000 面。
3. 纹理 2K、PBR 开启；若可选 `delight` 则开启，避免把画面光影永久烘进颜色。
4. 供桌、香炉、蒲团后续应拆为独立低面数对象；本轮只判断屋顶、梁柱和正面空间能否成立。
5. 佛像只允许简化剪影占位；若生成结果出现新增脸部、手印或装饰细节，直接弃用，不进入人工修补。

验收：正面屋檐和佛像剪影完整入镜、中央轴线稳定、人物不能走上供桌或佛座、整体模型不依赖背面不可见的大面积错误封口。

## 收到模型后的本地流程

1. **隔离检查**：保存原始文件只读副本；记录 SHA-256、格式、面数、材质、纹理尺寸和授权证据。
2. **Blender 清理**：统一米制与朝向；应用变换；删除隐藏重复面、非流形碎片和无用材质；不自动重做佛像细节。
3. **人物绑定**：优先使用 Tripo 导出的 Quad FBX；建立简化 humanoid 骨架，检查肩、肘、腕、髋、膝、踝；手工修正权重。动作只做走、站、坐、合掌、越南 lạy。
4. **礼拜校准**：站立合掌举到额前 → 跪下 → 合掌俯身额头近地 → 起身，连续三拜；不得出现双臂上举或背对佛像。
5. **水墨着色**：把 Tripo PBR 贴图作为底色，降低饱和度；Three.js 使用 toon ramp、距离相关墨线、米纸纹理和柔雾。人物与建筑共用暖灰木色调，不靠高光塑料感表现材质。
6. **纹理压缩**：先降到 1024–2048；Base Color 使用 KTX2 ETC1S，Normal 使用 KTX2 UASTC；合并小贴图并生成 mipmap。
7. **几何压缩**：导出 GLB，优先 Meshopt；若现有运行链验证 Draco 更小且低端机解码可接受，再改用 Draco。删除未用动画、切线和顶点色。
8. **预算闸门**：人物与大殿各自最终下载文件 ≤3MB；首屏全部必需资源仍须 ≤10MB。超限时先降纹理，再减面，不牺牲人物轮廓和屋檐剪影。
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

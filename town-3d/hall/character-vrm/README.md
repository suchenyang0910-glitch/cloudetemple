# VRM 人物加载准备

- `@pixiv/three-vrm` 3.5.5，MIT；来源 npm 官方包，已放入 `vendor/three-vrm.module.js`。
- `three` 本地模块、`GLTFLoader.js`、`BufferGeometryUtils.js` 均放入 `vendor/`，不走 CDN；版本与体积见回执。
- 不含任何 VRoid 示例角色或 `.vrm` 文件；无 `?model=` 时只显示“等待模型文件”。
- `poses.json` 定义通用人形骨骼与站立呼吸、走路、合掌、持三炷香拜、跪拜、盘坐姿势数据；持香为独立三炷香约定，香头朝上。
- 页面只加载用户通过 `?model=路径` 指定的 VRM；MToon 使用模型自带材质。

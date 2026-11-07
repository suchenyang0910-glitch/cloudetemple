# Chùa Mây HD-2D walk technical prototype

第二轮把第一轮的程序化“积木 3D”改为 HD-2D：Three.js 只负责空间、碰撞、走动和镜头；画面质感来自 Cloud Temple 已审核的 2D 水墨原画、透明人物纸片和原画投影贴图。

## 本地运行

```powershell
cd E:\cloudtemple-worktrees\three-walk-prototype\prototype-3d
npm install
npm run vendor
py -3.12 tools\build-hd2d-assets.py
npm test
npm run budget
npm run serve
```

打开 `http://127.0.0.1:4173/`。内部性能检查可加 `?locals=1` 显示两个本地模拟访客；对外预览不加此参数。

## 操作

- 手机：点地面走过去；按住并左右拖动持续转向前进；双指缩放。
- 电脑：方向键或 WASD；`C` 坐下/站起；`P` 合掌；`B` 礼拜；滚轮缩放。
- 靠近香炉、蒲团或佛像剪影时显示对应按钮。
- FPS 面板记录最近三分钟的 FPS、绘制量、首屏体积和浏览器可用内存，并可导出本地 JSON；数据不上传。

## 范围边界

- 不使用 Tripo、付费服务、外部 3D 模型、外部动作、CDN 或第三方字体。
- 佛像只是不带五官、手印或装饰的光晕剪影占位。
- 本地模拟访客仅在 `?locals=1` 时出现。
- 本目录不接入 H5、Mini App、staging 主站或正式环境。

素材来源与补帧提示词见 `assets/ASSET-SOURCES.md` 和 `assets/IMAGEGEN-PROMPTS.md`。

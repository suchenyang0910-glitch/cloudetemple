# Chùa Mây UX Contract

- 管理台路由标题格式：`{栏目} — 云寺管理台`；第一期为单页锚点导航。
- Cloudflare Access 与源站 JWT 校验共同授权；失败统一返回 403，不泄露失败原因。UI 只显示通用的读取失败和重试。
- 所有管理数据只读。加载、成功、空数据、样本不足、失败与窄屏均有独立状态。
- 小于 5 个主体的细分数据不展示数值。传播节点编号仅在当前响应中有效。
- 权限、隐私、数据保留与推荐绑定规则来自 `Codex提示词-管理后台第一期.md` 和 `Codex提示词-正式版问题汇总.md` 的问题 9；本文件只记录 UI 后果。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Scrollbar | 浏览器原生 + 产品语义色 | `admin-ui/admin.css` 的 `:root` | 页面滚动；导航横向滚动 | 393px 与 1440px 浏览器回归 |

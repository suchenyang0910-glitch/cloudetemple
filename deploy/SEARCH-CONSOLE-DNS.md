# Google Search Console DNS 验证准备

本阶段只准备说明，不修改 Cloudflare。指南与常见问题页继续 `noindex,follow`，也不列入 sitemap。

1. 在 Google Search Console 新增“网域”资源：`chuamay.org`。
2. 复制 Google 生成的 TXT 内容（形如 `google-site-verification=...`）。
3. 打开 Cloudflare → `chuamay.org` → DNS → Records → Add record。
4. Type 选 `TXT`，Name 填 `@`，Content 原样粘贴 Google 的值，TTL 选 Auto；保存。
5. 等 DNS 生效后回 Search Console 点“验证”。验证成功后保留该 TXT 记录。

不要把验证值写进 Git、截图或交付说明。若以后更换 Search Console 资源，新增新 TXT，确认新验证通过后再决定是否移除旧值。

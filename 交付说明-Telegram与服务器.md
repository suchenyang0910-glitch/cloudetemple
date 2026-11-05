# Telegram 与自有服务器交付 · 2026-11-05

## 正式发布更新（用户已明确批准）

已发布h5.chuamay.org、miniapp.chuamay.org和api.chuamay.org，HTTPS可访问。正式API使用`/var/lib/chuamay/production/api.sqlite`，systemd低权限运行并开机自启，密钥只在服务器600权限文件中。

实际h5浏览器活动回归通过并保存9张`production-*.png`；正式邮箱登记201、同IP重复提交429、外站CORS403、本站预检204、webhook缺密钥401。合成测试邮箱核验后清理。

@ChuaMayBot已验证getMe，webhook指向正式API，菜单打开miniapp，越南语和英语命令已设置。没有冒充真实Telegram用户执行/start；真实客户端返回键、主题、震动、提醒登记仍需用户在机器人中打开检查。

Cloudflare后台现已自动注入Web Analytics；同步CSP仅允许官方统计域名，并更新隐私页。其后台SSL模式及完整统计报表未读取。

未完成项：Restic的R2/S3凭据与异地恢复验证、staging独立测试机器人配置、母语和真机审核。下文先前的“正式发布等待批准”和“正式API缺Token”是历史记录，以本更新为准。

## HTTPS 更新（2026-11-05，后续状态覆盖下文证书待配置项）

用户保存的文件实际位于 `E:/cloudtemple/chuamay-certs/`，已验证证书/私钥匹配、私钥有效，SAN包含`*.chuamay.org`和`chuamay.org`，有效期至2041-11-01。证书上传至`/etc/ssl/chuamay/`，属主caddy:caddy、文件600、目录750；未输出或提交私钥。

已新增staging独立Caddy配置，通过validate后reload。服务器实际呈现的证书指纹与上传文件一致；公网HTTPS未认证401，使用现有Basic Auth后curl访问首页及三个说明页均200，HSTS和noindex存在。Python urllib的一次公网探测返回403，curl同凭据重试四页均成功，未因此修改Cloudflare安全规则。

原Caddyfile内容哈希保持不变，只追加staging import；所有既有容器ID不变。Cloudflare后台Full(strict)设置未读取，需用户确认。此更新仅完成staging HTTPS，不代表API/Telegram/Restic已启用。

本轮在 `feat/telegram-staging` 分支，不合并正式main，不启动正式域名/正式机器人。此前首版VPS预览仍在原独立端口运行。

## 已实测确认的

- SSH检查了Ubuntu24.04.4、磁盘/内存、Caddy、Docker及既有容器；使用用户确认的Caddy→独立Nginx方案，没有修改全局SSH/防火墙或重启其他项目。
- `server/` 的 **12/12测试**在Windows和VPS Node22.22.1均通过。移植7类登记测试，补充CORS、可信CF IP、webhook密钥、initData正确/篡改/过期/重复字段、Telegram最小字段持久化、删除数据。
- SQLite限流与邮箱写入是同一IMMEDIATE事务。测试通过触发器让第二次写入失败，确认第一笔写入回滚且同IP可立即重试。
- 普通网页Playwright完整活动流程通过；h5域名模拟中未请求Telegram SDK。
- 实际VPS staging Nginx已运行于127.0.0.1:8803，未认证401；认证后首页、关于、隐私、条款200，X-Robots-Tag为noindex，Nginx配置验证通过。
- 通过临时SSH隧道与仅本机的认证代理，Playwright直接读取VPS staging静态文件，跑过进门、上香、礼拜、静坐暂停/恢复、108珠、分享PNG下载、登记表单空值校验、双语与宽度检查，保存9张 `screenshots/staging-01-entry.png` 至 `staging-09-night-bow.png`。**这不是公开HTTPS测试，也不是staging登记提交成功的证据**；截图网址显示本机隧道地址。
- `tests/telegram-browser-check.js` 用模拟Telegram桥验证ready/expand、主题、BackButton、light/heavy/soft震动调用、t.me分享、无邮箱的提醒同意与initData请求。截图 `screenshots/11-miniapp-mocked.png`，明确为模拟，不冒充真实客户端。
- API systemd模板和独立数据目录已放到服务器；真正的staging.env缺失，服务保持inactive，登记代理返回502，没有用假密钥对外运行。

## 只在代码/配置中确认的

- h5/miniapp调用api.chuamay.org，staging调用同源/api；Mini App SDK仅miniapp或staging显式测试参数加载；网址读取location.origin；数字与phút使用NBSP；时段首字母格式。
- 三个双语说明页和页脚链接、待母语审核标记；Telegram提醒保存user_id、language、consentAt，90天到期清理，/privacy按钮删除当前记录。
- Nginx四站配置；只有miniapp允许web.telegram.org嵌入。staging Basic Auth的webhook例外依赖secret头。安全头和HSTS模板已准备。
- `deploy/publish.ps1`/`activate.sh`完成打包、上传、原子切换、systemd重启、健康检查及失败回滚逻辑；正式环境需要批准开关。**尚未做真实故障回滚演练**。
- 源站证书Caddy配置只为云寺域名限制CF来源；全局防火墙/SSH按用户决定不修改。unattended-upgrades原已enabled。
- 用户已选Restic加密备份到R2/S3；一致性快照、14天保留、systemd timer脚本和配置样例已准备，尚未开启。

## 没把握 / 需要用户配置后继续的

1. **源站证书未准备好**：需要`/etc/ssl/chuamay/origin.pem`与`origin.key`，并在Cloudflare启用Full(strict)。因此还未把staging域名接进Caddy。
2. **测试机器人配置缺失**：需要`/etc/chuamay/staging.env`的真实三个secret；不会把token放聊天/仓库。缺失时API不启动，不能完成staging curl登记/限流/webhook实测、setWebhook、Telegram真机截图。
3. **异地存储配置缺失**：需要Restic R2/S3 bucket、访问凭据和独立仓库密码。尚无异地备份或恢复成功证据，不能宣称备份已启用。
4. 没有运营邮箱路由验证、越南母语审定、手机声音/锁屏/系统分享验证；按《运维手册》继续。
5. 正式站与正式机器人等待用户在staging验收后确认。当前分支不会自动发布正式站。

操作步骤、Cloudflare后台各项配置、服务器文件路径、备份及恢复流程均见[运维手册](运维手册.md)。

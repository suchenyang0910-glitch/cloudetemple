# 管理后台 staging：Cloudflare Access 设置

后台只允许在 `adminchy-staging.chuamay.org` 验证。正式后台本轮不开启。

1. 在 Cloudflare DNS 添加 `A` 记录：名称 `adminchy-staging`，地址 `159.223.92.104`，代理状态保持橙云。
2. 打开 **Zero Trust → Settings → Authentication → Login methods**：启用 **One-time PIN**；如需 Google，再添加 Google 登录方式。
3. 打开 **Zero Trust → Access → Applications → Add an application → Self-hosted**。
4. 应用名填写 `Chua May Admin Staging`，域名填写 `adminchy-staging.chuamay.org`，Session duration 建议 `24 hours`。
5. 新建一条 `Allow` 策略：Include 选择 **Emails**，只填本机 `chuamay-certs/admin-emails.txt` 中的唯一邮箱。不要创建 Bypass 策略。
6. 保存后，在应用详情复制 **Application Audience (AUD)**；在 Zero Trust 设置中确认团队域名，格式应为 `团队名.cloudflareaccess.com`。
7. 将这两个非密钥值写入 staging 的服务器环境文件：

   ```text
   CF_ACCESS_TEAM_DOMAIN=团队名.cloudflareaccess.com
   CF_ACCESS_AUD=应用的AUD
   ```

8. `ADMIN_EMAILS` 只从本机白名单文件写入服务器环境，文件权限保持 `600`；不要把邮箱提交到 Git 或发到对话。

完成第 1–6 步后，只需告知团队域名和 AUD 已准备好；部署程序会在启用后台前验证 Access JWT、白名单、403 负例和审计记录。

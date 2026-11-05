# VPS 部署记录 · 2026-11-05

公网预览：**http://159.223.92.104:8788/**。这是 HTTP 试用入口，尚无域名和 TLS。接入 HTTPS 前不要用于收集真实邮箱；手机系统分享可能不可用，下载作为后备。域名确定后把 Caddy 站点改为该域名，并同步 runtime.env 的 PUBLIC_ORIGIN，再重建本项目容器。

## 发布版本与隔离

- GitHub：`suchenyang0910-glitch/cloudetemple`，main。运行代码提交：`df603fe96b67e20db18c62c82667397b12623508`；之后的部署记录提交仅补文档和实测截图。
- 目录：`/opt/cloudtemple/releases/df603fe`，`/opt/cloudtemple/current` 指向该版本。
- Compose project：`cloudtemple`，容器 `cloudtemple-web-1`，独立 network，非 root 用户，192MB 内存上限、0.25 CPU，只读运行文件。
- 容器服务只发布至 `127.0.0.1:8789`。Caddy 的独立 HTTP 入口为8788，防火墙只新增该端口。
- Caddy 新增 `/etc/caddy/cloudtemple.caddy`，主配置末尾只有该文件的 import；原有内容哈希与部署前一致。发布前验证配置通过后执行 reload，没有重启其他项目。
- 现有17个容器的ID均未变化；IP原首页部署前后均返回401。

## 数据

VPS 不使用 Cloudflare KV，使用本项目独立 SQLite 适配器复用原来的登记校验 handler。数据库 `/opt/cloudtemple/shared/data/waitlist.sqlite`，运行配置 `/opt/cloudtemple/shared/runtime.env`；secret服务器生成，权限600，未下载或提交。没有共用其他项目的数据库。

邮箱TTL为90天，过期读不可见，启动及每分钟清理；SQLite开启secure_delete。此记录不代表云备份已配置。服务器管理员可读取数据库，因此这不是邮箱密文存储：HMAC用于键名/IP限流键，邮箱仍在登记记录中。

## 本次实测

- 本地及实际VPS Node 22.22.1容器：9/9测试通过，含持久化、到期处理、HTTP安全边界、写入失败重试。
- 外部HTTP首页200，返回CSP及安全响应头。
- Playwright从公网进入、选择访客、礼拜、提交合成测试邮箱，接口201；390px无横向滚动。截图 `screenshots/10-vps-live.png`。
- 云寺容器重启前后测试登记记录均存在；验证后仅删除本次合成测试邮箱记录。
- 健康端点 `/healthz` 返回ok。未把HTTP预览称为HTTPS生产上线。

## 运维

```sh
cd /opt/cloudtemple/current
RELEASE_DIR=/opt/cloudtemple/releases/df603fe docker compose -p cloudtemple -f deploy/compose.yml ps
RELEASE_DIR=/opt/cloudtemple/releases/df603fe docker compose -p cloudtemple -f deploy/compose.yml logs --tail 50
```

后续发布：上传新提交归档到新的releases目录，生成dist；以新目录作为RELEASE_DIR执行同一compose项目的up -d，健康验证后更新current。保留shared。回退时把RELEASE_DIR改回上一目录后up -d；不要重置SQLite，也不要执行全服务器docker清理。

取消本次公开入口：仅移除主Caddyfile中的cloudtemple import，验证配置后reload；删除8788防火墙规则；仅停止cloudtemple compose项目。部署前Caddyfile备份在shared中，因存在其他项目并发变动，不能直接用整份备份覆盖现有配置。

尚未验证：真实手机/母语审核、HTTPS证书、灾备恢复、并发负载、云主机故障恢复。本次没有改变Zalo和统计占位。

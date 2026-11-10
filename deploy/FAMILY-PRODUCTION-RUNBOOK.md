# 家族牌位正式环境开启/关闭手册

状态：准备材料，不执行。当前正式环境继续 `FAMILY_ENABLED=0`，当前正式包也没有家族页面或后台。

## 当前阻塞

- 最近一次正式备份恢复演练：restic 恢复成功，SQLite `integrity_check=ok`，但家族表为 `0/4`。上线前必须先在功能关闭状态执行经过审核的 schema 迁移，再做一次正式备份、恢复和 `4/4` 表核对。
- 当前代码会阻止 production 开启家族功能，production 打包也会排除家族资源。未来候选版必须经过单独审核，移除这两个闸门；本次不改。
- 公开上线前需完成隐私/同意书法律审核与 Google OAuth 正式发布。

## 配置差异（只列键，不含值）

| 能力 | staging 已有 | production 上线前需准备 |
| --- | --- | --- |
| 家族功能 | `FAMILY_ENABLED` | 保持 `0` 至最终批准；再改为 `1` |
| 邮件 | `MAIL_PROVIDER`, `MAIL_FROM`, `RESEND_API_KEY` | 同名键与已验证的正式发信域 |
| Google 登录 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 正式 OAuth 客户端与回调 |
| 数据库 | `DB_PATH` | 先迁移 schema，再备份恢复演练 |
| 提醒 | staging timer | production timer 仅在最终批准后启用 |
| 后台/统计 | staging 有 Access 与 admin | 不随家族首发自动开放 |

## 开启步骤（需逐步人工批准）

1. 备份生产数据库并记录 restic snapshot ID；恢复到临时目录，确认 `integrity_check=ok`。
2. 保持 `FAMILY_ENABLED=0`，部署含家族 schema 的候选版，执行迁移；确认家族表 `4/4`。
3. 再备份并恢复一次，确认 `integrity_check=ok` 与家族表 `4/4`。
4. 验证正式 Resend 发信、Google 登录回调、导出、删除、邀请权限和闰月用例。
5. production 打包断言确认无 debug、母珠规则为 pass-through，并显式允许 family 资源。
6. 备份 env 后只把 `FAMILY_ENABLED` 改为 `1`，重启 API，确认 healthz、h5、miniapp 与家族全流程。
7. 最后启用 `chuamay-reminders@production.timer`，先手动运行一次且不产生重复提醒。

## 关闭与回滚

1. 立即停止并禁用 production reminder timer。
2. 备份 env，只把 `FAMILY_ENABLED` 改回 `0`，重启 API，确认 healthz=200。
3. 回滚到上线前 release；保留数据库和备份，不删除任何用户资料。
4. 若涉及数据错误，先隔离写入并导出审计证据，再决定恢复；不得直接覆盖生产数据库。

## Google 登录从测试切到正式需准备

- 应用名称、云寺标识、支持邮箱与开发者联系邮箱。
- 已上线的首页、隐私政策、服务条款；授权域名 `chuamay.org`。
- Web OAuth 客户端的正式回调：`https://api.chuamay.org/auth/google/callback`。
- 仅申请 `openid email profile`；测试账号完成真机登录后，再在 OAuth consent screen 发布到 Production。
- 若 Google 要求验证，按控制台清单提交域名所有权与用途说明；用户本人在 Google Cloud 完成发布。

参考：Google 要求回调地址与控制台登记值完全一致，并说明 Testing/Production 发布状态与测试用户限制：

- https://developers.google.com/identity/openid-connect/reference
- https://support.google.com/cloud/answer/15549945

## 已做的恢复演练（2026-11-08）

- staging：真实 R2/restic 备份成功；恢复成功；SQLite `integrity_check=ok`；家族表 `4/4`；耗时 10 秒。
- production：只读恢复最近 snapshot 成功；SQLite `integrity_check=ok`；家族表 `0/4`。未修改 production 数据、配置或 release。

## 最新准备演练（2026-11-10）

- staging：新备份与恢复通过，`integrity_check=ok`、家族表 `4/4`；详见 `FAMILY-PRODUCTION-READINESS-20261110.md`。
- production：新备份只读恢复后仍为 `0/4`；迁移只在恢复副本演练，120 ms 后为 `4/4` 且完整性正常。在线 production 未迁移、未改配置、未改 release。

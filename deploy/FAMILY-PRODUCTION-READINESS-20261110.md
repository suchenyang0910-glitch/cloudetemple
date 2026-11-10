# 家族牌位正式上线准备演练（2026-11-10）

结论：**数据库迁移与配置已准备好，功能仍未开启**。正式环境仍为 `c51d8d2f3277`，`FAMILY_ENABLED=0`；家族候选尚未部署，提醒任务未启用。

## 已实测

- 迁移脚本：`server/migrate-family-schema.mjs`。默认 `--check` 只读，必须显式 `--apply` 才写入；只输出完整性和四张核心家族表的存在状态。
- 自动测试：53/53 通过；迁移可重复执行，并保留既有表和数据。
- staging 一致性副本：复制 125 ms；迁移 124 ms；重复迁移 127 ms；两次均为 `integrity_check=ok`、家族表 `4/4`。
- staging 异地备份/恢复：snapshot `ad15409a0a56`；备份 6 s；Restic 抽检 3.704 s；恢复 2.461 s；恢复库 `integrity_check=ok`、家族表 `4/4`。
- production 只读备份/恢复：snapshot `49bbe80254d7`；备份 7 s；Restic 抽检 4.693 s；恢复 2.279 s；恢复库 `integrity_check=ok`、家族表 `0/4`。
- 仅在上述 production **恢复副本**执行迁移：120 ms，迁移后 `integrity_check=ok`、家族表 `4/4`。未触碰在线 production 数据库；临时副本已安全删除。
- production 在线迁移前备份：snapshot `4e005b32`；恢复库 `integrity_check=ok`、家族表 `0/4`。
- 用户批准后在 `FAMILY_ENABLED=0` 下迁移在线 production 数据库：150 ms，迁移后 `integrity_check=ok`、家族表 `4/4`。
- production 在线迁移后备份：snapshot `5fbf7b5e`；恢复库 `integrity_check=ok`、家族表 `4/4`。
- 线上复核：production API health、h5、miniapp 均为 HTTP 200；production release 仍为 `c51d8d2f3277`。

## 开启前缺口

1. production 已配置 `MAIL_PROVIDER`、`MAIL_FROM`、`RESEND_API_KEY`；正式发信仍需在开启当天验证一封登录邮件。
2. production 已配置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和正式回调；用户转述 Google OAuth 已于 2026-11-10 12:20（Asia/Bangkok）发布为正式版，仍需手机真机登录验收。
3. 在线 production 数据库已在 `FAMILY_ENABLED=0` 下迁移并完成迁移前后备份恢复复核，家族核心表为 `4/4`。
4. production 候选显式带入家族前端资源，默认与本次打包仍保持 `FAMILY_ENABLED=0`；部署及开关需另行批准。
5. 用户转述：2026-11-10，律师已确认隐私政策和家族同意书；寺院顾问已按策划确认上香步骤、纪念日、称呼和剪影画法。本仓库未保存或独立核验书面意见；若公开范围或文案发生实质变化，需重新确认。
6. 需在 production 候选上完成 Resend、Google 登录、邀请权限、导出、删除、闰月与手机全流程验收。
7. `chuamay-reminders@production.timer` 仍为 disabled/inactive。功能上线后也只能在一次手动无重复发送验证通过后单独启用。

## 发布闸门

候选部署并取得用户逐步批准前，不得把 `FAMILY_ENABLED` 改为 `1`；提醒定时器作为最后一步另行批准。

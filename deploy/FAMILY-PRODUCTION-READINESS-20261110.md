# 家族牌位正式上线准备演练（2026-11-10）

结论：**尚不可开启**。本轮只验证迁移、恢复与候选打包能力；正式环境仍为 `c51d8d2f3277`，`FAMILY_ENABLED=0`，未迁移、未部署、未启用提醒。

## 已实测

- 迁移脚本：`server/migrate-family-schema.mjs`。默认 `--check` 只读，必须显式 `--apply` 才写入；只输出完整性和四张核心家族表的存在状态。
- 自动测试：53/53 通过；迁移可重复执行，并保留既有表和数据。
- staging 一致性副本：复制 125 ms；迁移 124 ms；重复迁移 127 ms；两次均为 `integrity_check=ok`、家族表 `4/4`。
- staging 异地备份/恢复：snapshot `ad15409a0a56`；备份 6 s；Restic 抽检 3.704 s；恢复 2.461 s；恢复库 `integrity_check=ok`、家族表 `4/4`。
- production 只读备份/恢复：snapshot `49bbe80254d7`；备份 7 s；Restic 抽检 4.693 s；恢复 2.279 s；恢复库 `integrity_check=ok`、家族表 `0/4`。
- 仅在上述 production **恢复副本**执行迁移：120 ms，迁移后 `integrity_check=ok`、家族表 `4/4`。未触碰在线 production 数据库；临时副本已安全删除。
- 线上复核：production API health、h5、miniapp 均为 HTTP 200；production release 仍为 `c51d8d2f3277`。

## 开启前缺口

1. production 环境尚无 `MAIL_PROVIDER`、`MAIL_FROM`、`RESEND_API_KEY`，不能发送登录验证码或提醒邮件。
2. production 环境尚无 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`；Google OAuth 正式发布、回调和真机登录尚未验收。
3. 在线 production 数据库仍是家族表 `0/4`；需在 `FAMILY_ENABLED=0` 下备份后执行已审核迁移，再备份恢复复核 `4/4`。
4. 已制作显式带入家族前端资源、但保持 `FAMILY_ENABLED=0` 的 production 候选；仍需在正式启用前完成发布审批和真机验收。
5. 用户转述：2026-11-10，律师已确认隐私政策和家族同意书；寺院顾问已按策划确认上香步骤、纪念日、称呼和剪影画法。本仓库未保存或独立核验书面意见；若公开范围或文案发生实质变化，需重新确认。
6. 需在 production 候选上完成 Resend、Google 登录、邀请权限、导出、删除、闰月与手机全流程验收。
7. `chuamay-reminders@production.timer` 仍为 disabled/inactive。功能上线后也只能在一次手动无重复发送验证通过后单独启用。

## 发布闸门

以上 1–6 全部完成并取得用户逐步批准前，不得把 `FAMILY_ENABLED` 改为 `1`；提醒定时器作为最后一步另行批准。

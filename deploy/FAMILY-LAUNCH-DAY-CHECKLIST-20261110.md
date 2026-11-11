# 家族牌位正式开启当天操作清单

状态：双账号灰度候选准备材料。执行前必须再次取得用户明确批准。

## 已知基线

- 当前正式 release／家族上线回滚目标：`f3e77aa876ae`（L1 念珠 + L2 上香）。
- 正式数据库已在 `FAMILY_ENABLED=0` 下迁移，核心家族表 `4/4`。
- 迁移前 Restic snapshot：`4e005b32`，恢复校验 `integrity_check=ok`、家族表 `0/4`。
- 迁移后 Restic snapshot：`5fbf7b5e`，恢复校验 `integrity_check=ok`、家族表 `4/4`。
- production 邮件和 Google OAuth 变量已配置；用户转述 Google OAuth 已发布为正式版。
- production reminder timer 必须保持 disabled/inactive，直到手动提醒验证另获批准。

## 开启前检查

1. 记录当前 release、env 备份文件和最新 Restic snapshot ID。
2. 运行 secret 权限闸门；确认 production env 为 `600 chuamay:chuamay`。
3. 对在线库运行只读检查：`integrity_check=ok`、家族核心表 `4/4`。
4. 用 production 参数打包；确认 `FAMILY_ENABLED=0`、无 debug、母珠规则为 `pass-through`、家族资源齐全。
5. 部署候选但暂不改开关；确认 API health、h5、miniapp 与现有首版流程正常。
6. 只从本机 `E:\cloudtemple\chuamay-certs\family-allowlist.txt` 逐行读取获准内测的两个 Google 邮箱，生成 production env 的 `FAMILY_ALLOWLIST`；不要读取 `admin-emails.txt`，也不要把邮箱写入代码、日志或交付截图。

## 开启

1. 备份 `/etc/chuamay/production.env`，保持属主与权限不变。
2. 只把 `FAMILY_ENABLED=0` 改为 `FAMILY_ENABLED=1`；`FAMILY_ALLOWLIST` 保持两人，不改其他配置。
3. 运行 secret 权限闸门。
4. 重启 `chuamay-api@production`，最多等待 30 秒确认 `/healthz=200`。
5. 确认 h5、miniapp 会从 `api.chuamay.org/family/status` 读取开关，未登录或名单外账号看不到入口且 family API 返回 404。
6. 确认登录 Cookie 为 `Domain=.chuamay.org; Secure; HttpOnly; SameSite=Lax`，h5、miniapp 和 Telegram WebView 共用会话；提醒 timer 仍保持关闭。
7. 每次正式发布固定检查：`https://h5.chuamay.org/family.html` 返回 200；`https://miniapp.chuamay.org/family.html?telegram=1` 返回 200；`https://t.me/ChuaMayBot/chuamay?startapp=family` 在 Telegram 中进入家族登录页。

## 手机验收路径

用户与太太使用两个不同账号，分别在 Safari/Chrome 和 Telegram Mini App 走一次：

1. 邮箱验证码登录，再验证 Google 登录；Telegram 内置浏览器若不支持 Google，确认外部浏览器提示正确。
2. 阅读并同意家族测试版声明和同意书。
3. 建立一块虚构测试牌位，核对姓名、农历月/日、闰月与越南语显示。
4. 完成上香或供奉，刷新后确认记录可见。
5. 账号 A 创建邀请；账号 B 接受后能看到同一牌位，但不能执行所有者专属操作。
6. 账号 A 撤销邀请或移除受邀成员，确认账号 B 随即失去访问权。
7. 导出账号全部资料，核对牌位、成员、供奉与提醒设置。
8. 核对一个普通农历忌日和一个闰月忌日的公历换算。
9. 手动触发一封登录邮件；确认发件人、链接、退订信息与收件结果。
10. 删除测试账号；确认会话失效、再次导出不可用、另一账号的数据未被删除。

## 立即关闭与回滚

1. 停止并禁用 production reminder timer；即使它尚未启用也要确认 inactive。
2. 备份 env，只把 `FAMILY_ENABLED=1` 改回 `0`。
3. 运行权限闸门并重启 API，确认 `/healthz=200`，family API 不再可用；h5、miniapp 无需重新部署，入口会自动消失。
4. 只有候选代码本身异常时，才将 h5、miniapp 和 API release 回滚到 `f3e77aa876ae`；确认 L1 念珠、L2 上香及首版流程正常。
5. 保留数据库和 Restic 快照，不删除家族表或用户数据，不用旧备份直接覆盖在线库。
6. 若发生数据错误，先隔离写入、导出审计证据，再决定是否从指定 snapshot 恢复。

## 提醒任务

家族页面验收通过不等于允许发送提醒。提醒 timer 只能在用户另行批准后，先手动执行一次并确认无重复发送，再单独启用。

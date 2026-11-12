# P77 萌宠园账号接口约定（v1）

状态：**供 Codex E 接线；未部署。** 基路径为 `/api/pet-garden`。所有 JSON 响应均为 `Cache-Control: no-store`。除 Telegram Mini App 签名请求外，浏览器 Cookie 请求必须带 `credentials: "include"`；邮箱会话的写请求另带 `X-CSRF-Token`。

## 身份与错误码

| 错误码 | HTTP | 前端动作 |
| --- | --- | --- |
| `pet_login_required` | 401 | 显示“请登录或前往 Telegram”。 |
| `email_code_invalid` | 401 | 提示重新输入验证码。 |
| `email_rate_limited` | 429 | 暂停重发，读取 `Retry-After`。 |
| `email_daily_limit` | 429 | 仅显示“请前往 Telegram”。 |
| `merge_confirmation_required` | 409 | 展示合并摘要，要求用户主动确认。 |
| `link_expired` / `link_forbidden` | 400 / 403 | 告知关联码无效或不属于当前会话。 |
| `family_merge_conflict` | 409 | 告知两个账号都有家族数据，当前不能合并。 |
| `public_creation_closed` | 503 | 保持现有公开建碑关闭提示。 |

## 邮箱登录与状态

`POST /auth/email/start`

```json
{"email":"user@example.com"}
```

成功为 `201 {"ok":true}`。按邮箱 60 秒、按 IP 30 秒限速；验证码 10 分钟有效，连续错误最多 5 次；全站每日验证码上限默认 200 封。该入口不查家族白名单。

`POST /auth/email/verify`

```json
{"email":"user@example.com","code":"123456"}
```

成功为 `200`，设置独立 `ct_pet_session` Cookie：

```json
{"ok":true,"csrf":"opaque","identityKinds":["email"]}
```

`GET /me` 返回当前萌宠会话状态。Telegram 登录时请求带 `Authorization: Telegram <initData>`；邮箱登录使用 `ct_pet_session`。

```json
{"authenticated":true,"identityKinds":["email","telegram"]}
```

未登录为 `200 {"authenticated":false,"identityKinds":[]}`。

## 建碑与我的碑

`POST /memorials` 只接受已验证 Telegram 身份或邮箱会话；无身份一律 `401 pet_login_required`。新碑直接归属登录用户，不返回认领码，也不写 `browser_claim_hash`。

```json
{"petName":"Miu","speciesCode":"cat","bornOn":"2013-06-15","diedOn":"2025-09-27","epitaph":"Luôn nhớ em.","visibility":"private"}
```

成功为：

```json
{"id":"uuid","publicStatus":"hidden"}
```

`GET /mine` 返回这个用户（不是当前单个登录方式）名下的碑：

```json
{"items":[{"id":"uuid","petName":"Miu","speciesCode":"cat","bornYear":"2013","diedYear":"2025","publicStatus":"hidden","districtId":1,"rowNo":1,"columnNo":1}]}
```

## 主动关联与账号合并

关联只由已登录本人发起；不按名字、设备或 IP 推断。一个邮箱或 Telegram 身份只能归属一个 `user_id`。若待关联身份已属另一个账号，先返回摘要，用户确认后才合并全部用户数据。

### Telegram 用户绑定邮箱

`POST /auth/link/email/start`（当前 Telegram 身份）请求 `{"email":"user@example.com"}`，成功 `201 {"ok":true}`。`POST /auth/link/email/verify` 请求 `{"email":"user@example.com","code":"123456"}`：没有冲突时返回 `200 {"linked":true,"identityKinds":["email","telegram"]}`；有冲突时返回：

```json
{"error":"merge_confirmation_required","mergeToken":"opaque","source":{"memorialCount":1,"hasFamilyData":false}}
```

再由当前已验证用户调用 `POST /auth/link/confirm`：`{"mergeToken":"opaque","confirm":true}`，成功 `200 {"merged":true,"identityKinds":["email","telegram"]}`。

### 邮箱用户绑定 Telegram

`POST /auth/link/telegram/start`（当前邮箱会话）成功返回：

```json
{"linkCode":"opaque","expiresAt":"2026-11-12T13:10:00.000Z","deepLink":"https://t.me/<bot>?start=pet-link-opaque"}
```

在 Telegram 内以签名身份调用 `POST /auth/link/telegram/confirm`，请求 `{"linkCode":"opaque"}`。无冲突时返回 `200 {"linked":true,"identityKinds":["email","telegram"]}`；有冲突时返回同一 `merge_confirmation_required` 摘要，Telegram 内再调用 `/auth/link/confirm` 完成。关联码单次消费、10 分钟有效，并绑定发起账号。

合并迁移碑、成员/邀请关系、账号归属的花灯与来访、同意和封禁；同碑同日同种类的两次花灯/来访合并为一条。若两个账号都含家族数据，返回 `409 family_merge_conflict`，不做任何写入。

## 旧浏览器碑

`GET /me/claim` 与 `POST /memorials/:id/claim` 仅保留给 staging 旧浏览器测试碑过渡；新建碑绝不进入该流程。新页面不应调用或展示认领码。

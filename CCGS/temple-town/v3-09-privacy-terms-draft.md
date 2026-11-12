# P35 · 萌宠园隐私政策和条款修改稿

**仅供 Claude、越南语母语审校及律师复核，勿发布。** 确认记录第 36 条授权写稿。集成源码固定在 `origin/codex/staging-integration@80a18a67218d14998e9810cc16202f65b49f16f4`；P24 增量另核 `origin/codexb/pet-backend@c272b385aa4fbd53adfdf73743090f144edfe68c`。原文取仓库正式版交付基线 `f385128` 的两页；集成分支隐私页另外加入了在线人数和推荐说明，以下也核对其披露差异。未读取线上数据库、实际配置、访问日志或供应商控制台。

## 1. 收集、存储与发送清单

每行是一类同用途数据，列出同组字段。下文「未见期限」表示代码没有可确认的自动清除期限，不等于永久保存承诺。「已有」指正式版基线已披露该类别；「集成页已有」只表示集成分支的隐私页有此说明。SQLite 读取权限以下按代码接口描述，另有数据库和备份运维权限待核。P24 行是候选分支代码证据，不能算进当前 staging 的行为。

### 萌宠园：集成分支

| 编号 | 收集或派生的数据、存放位置 | 保存时间 | 谁可见、发送到哪里 | 源码位置 |
| --- | --- | --- | --- | --- |
| P01 | 浏览器立碑身份：随机 32 字节及签名存 `ct_pet_browser` Cookie；认领码由该 Cookie 派生，建碑和查看接口可返回原码；服务端只存 `pet_memorials.browser_claim_hash,owner_ref,identity_kind`，所有者引用同步入成员表 | Cookie 最长 365 天；碑关联数据随碑删除；绑定时清空认领哈希，客户端是否另行保存原码未核实 | 用户浏览器及请求服务器；哈希和引用不进公开响应 | `server/pet-api.mjs:67-105,149-158,206-214`；`server/pet-store.mjs:14-20,77-100` |
| P02 | 访客计数随机号及签名：`ct_pet_visitor`，打开公开碑详情时按需签发；不设对应数据库原值列 | Cookie 最长 365 天 | 浏览器及萌宠园接口，非公开字段 | `server/pet-api.mjs:67-75,138-142,226-235` |
| P03 | Telegram 签名数据（含用户资料及签发时间）和语言在验证请求中处理；Telegram ID 转成分域 HMAC，用于 `pet_memorials.owner_ref,identity_kind` 或 `pet_members.principal_ref`；没有原始 initData、Telegram ID 或语言落库列 | 签名资料只在请求内，验签接受约 24 小时内签发；碑/成员引用随碑删除，无单独期限 | Telegram 提供凭据；接口本地验签，无宠物内容发回 Telegram 的调用；引用仅服务端 | `server/security.mjs:15-25`；`server/pet-api.mjs:78-95,106,179-190,201-206`；`server/pet-store.mjs:25-28,83-112` |
| P04 | 绑定：Telegram 签名凭据或 Bearer（后者需验证器），认领凭证原值在请求内、用 HMAC 比对；`pet_memorials.owner_ref,identity_kind,updated_at` 和 `pet_members` 所有者行替换 | 绑定后新引用随碑；`browser_claim_hash` 被清空，旧浏览器成员行删除 | 仅验权服务；客户端只收成功或失败。集成入口没传 `verifyBound`，不能据此承诺浏览器可绑邮箱或 Google；Telegram 认领 API 有路径，用户流程未证实 | `server/index.mjs:37-43`；`server/pet-api.mjs:78-105,149-158,235-239`；`server/pet-store.mjs:92-100` |
| P05 | 碑面：`pet_memorials.id,pet_name,species_code,born_on,died_on,epitaph,public_status,district_id,row_no,column_no,created_at,updated_at,last_qualifying_visit_at,wall_at,demo` | 主人删除前无期限；维护函数按最近合格来访/创建时间移墙，不删除；集成入口未调用维护函数 | 公开碑给任何访客：ID、名、种类、出生/离世年份、碑文、行列；列表按区分页，墙碑详情仍可公开访问；精确日期仅有效成员/主人接口，主人可读状态和分区；隐藏碑不给公众 | `server/pet-store.mjs:14-21,63-83,138-152`；`server/pet-api.mjs:41-65,130-162,237-241`；`server/index.mjs:18-65` |
| P06 | 机审输入宠物名、碑文、语言；被拒的文本不写入碑表；通过写 `pet_memorials.moderation_status,moderation_rule_version`；表有 `moderation_reason_code` 但此版创建未写 | 请求内处理；已通过记录随碑。未配置已批准词表，公开创建关闭 | 本地规则；申请者收审核结果/修改提示；无外部机审收件方 | `server/pet-moderation.mjs:1-24`；`server/pet-api.mjs:105-109,165-182,260-261`；`server/pet-store.mjs:17-18,77-81`；`server/index.mjs:39-43` |
| P07 | 邀请：`pet_invites.id,memorial_id,token_hash,created_by,expires_at,max_uses,uses,revoked_at`；凭证原值返回主人，受邀者提交凭证时在请求内处理 | 有效期最多 30 天，限 1–20 次且可撤销；过期/撤销行无定时删除，随碑删除 | 主人取得邀请凭证并可分享给选定对象；持凭证且已绑定的人可兑换；哈希和明细在服务端 | `server/pet-api.mjs:184-190,208-224`；`server/pet-store.mjs:22-24,95-119` |
| P08 | 成员：`pet_members.memorial_id,principal_ref,role,invite_id,created_at,revoked_at` | 撤销后保留状态，绑定时替换原所有者行；随碑删除 | 服务端用于访问控制；兑换者收到自己的碑 ID 和角色，成员可读私有详情 | `server/pet-store.mjs:25-28,55-59,86-119`；`server/pet-api.mjs:159-162,184-190` |
| P09 | 献花/点灯与合格来访：`pet_offerings.memorial_id,day,visitor_ref,kind,demo`；`pet_visits.memorial_id,day,visitor_ref,kind,created_at`。按越南日期将主体引用、随机访客号或无 Cookie 时的 IP 之一做 HMAC。单纯读详情不更新合格来访；主人自献不计 | 日粒度去重，行随碑删除；未见单独 TTL | 内部仅去重和计数；公众获花灯分项数，主人另可按日获去重人数；无访客名单或评论 | `server/pet-api.mjs:10,138-157,226-235`；`server/pet-store.mjs:29-35,51-54,121-130` |
| P10 | 滥用限速：`pet_rates.scope,subject_ref,bucket,hits`；动作范围可含碑 ID，IP 和已知身份各自做每分钟 HMAC | 限额窗口 1 分钟；过期桶删除需调用 `maintain`，当前入口未调，实际落库期限未确认 | 服务端；客户端只收到限速和重试时间，无原始 IP 落该表 | `server/pet-api.mjs:112-118,226-229`；`server/pet-store.mjs:36-38,139-151`；`server/index.mjs:18-65` |
| P11 | 举报：`pet_reports.id,memorial_id,reason_code,created_at`；类别限定，不保存举报人引用或自由文字，入口仍走限速 | 随碑删除，无单独 TTL | 举报人收回执 ID；当前无审核读取入口，P24 才加后台队列 | `server/pet-api.mjs:9,192-197`；`server/pet-store.mjs:39-41,132-138` |
| P12 | 萌宠园统计预留：`pet_analytics_events.visitor_ref,action,created_at,browser,os,device,screen,language,source,page`；独立 32 位十六进制引用，动作 open/flower/light/create，七项维度仅白名单粗分类，须显式 consent=true | 未见 TTL 或撤回删除；无生产调用点，故未证实有真实写入或浏览器生成接线 | 存储函数不接碑 ID、身份、IP 或全文；受保护接口只给管理员按动作合计；无 Google 发送路径 | `server/pet-store.mjs:1-9,42-44,153-160`；`server/pet-api.mjs:126-129`；`server/index.mjs:38-50` |
| P13 | 萌宠园统计管理员 Access 断言：验证签名、签发方、受众、时效和允许邮箱；本版回调只把通过/拒绝传入统计接口，无宠物审计表 | 断言和邮箱在请求内；验证公钥缓存约一小时 | Cloudflare Access 发断言；后端请求公钥，不将碑数据发给公钥端点 | `server/access-auth.mjs:6-45`；`server/index.mjs:37-43`；`server/pet-api.mjs:126-129` |

### 萌宠园：P24 候选增量（尚不在上述集成基线）

| 编号 | 收集或派生的数据、存放位置 | 保存时间 | 谁可见、发送到哪里 | 源码位置（c272b38） |
| --- | --- | --- | --- | --- |
| P14 | 机审拦截 `pet_admin_reviews.id,category,rule_version,created_at`，只留类别/规则版本/时间，无原文、主体或碑引用 | 无自动清除；处理后从队列过滤，底表仍留 | Access 管理员获上述字段；本地词表，未见发送原文到第三方 | `server/pet-admin-store.mjs:5-7,67-83`；`server/pet-admin-moderation-v1.mjs:52-65`；`server/pet-admin-api.mjs:35-47,77-90` |
| P15 | 举报队列从 P11 读取，联查公开/墙上碑的名和碑文，不复制到举报表；处理动作写 P18 | 底表随碑删除；处理后不再列为待处理 | Access 管理员可读举报 ID、碑 ID、类别、时间及仍可公开的名和碑文；无举报者身份 | `server/pet-admin-store.mjs:69-72,85-92`；`server/pet-admin-api.mjs:35-47` |
| P16 | 下架状态 `pet_admin_takedowns.memorial_id,prior_status`，并更新 `pet_memorials.public_status,updated_at` | 恢复或删碑时移除下架行；审计独立 | Access 管理员看到 ID、更新时间；下架后公众不可看 | `server/pet-admin-store.mjs:8-11,44-56,93-94` |
| P17 | 封禁 `pet_admin_bans.id,subject_ref,created_at`，主体引用复制自碑所有者；解封删除 | 无到期策略；解封才删，删碑不级联 | 服务端用引用拦截；Access 列表只回封禁 ID、时间，不回主体引用 | `server/pet-admin-store.mjs:12-14,58-66,76-79,95`；`server/pet-admin-api.mjs:71-73,84-89` |
| P18 | 管理审计 `pet_admin_audit.id,actor_ref,action,target_id,reason,result,request_id,created_at`；`actor_ref` 是允许的管理员邮箱做分域 HMAC；通过字段校验的理由为自由文，成功写请求 UUID，部分失败也记录，失败不保留请求 UUID | 仅追加且触发器禁止普通更新、删除、替换；无 TTL；删碑不级联 | 内部有权审计/数据库人员；该模块没有审计列表接口，不把邮箱原值或后台动作发给访客 | `server/pet-admin-api.mjs:35-39,49-73`；`server/pet-admin-store.mjs:15-37,40-73` |

### 主程序、家族与共用设施：集成分支

| 编号 | 收集或派生的数据、存放位置 | 保存时间 | 谁可见、发送到哪里 | 源码位置 |
| --- | --- | --- | --- | --- |
| C01 | **已有**角色编号、活动次数/时长、静音音量、惯用手、木鱼日/次数；另有坐禅时长、呼吸开关/节奏、环境声、自动插香、声音提示、念珠教程、晨间记录、花色等 `ct-*` 本机偏好 | 浏览器清除前，日计数只对当前日有效 | 本机；经同意发送的分类统计另见 C06 | `app.js:46-51,177,210,351-352,429-438,526-559,584-587,619`；`beads.js:33-34`；`morning.js:7-10`；`festival.js:4-6` |
| C02 | **已有**报名 `waitlist.key,email,language,consentAt,expires`；key 是邮箱 HMAC，`rates.key,until` 含限速 IP HMAC | 报名 90 天，限速窗口 1 分钟，启动和每日清理；邮箱删除按公布联系办法，代码无公开自助路由 | 报名者及有权运维；接口不回邮箱清单 | `app.js:472`；`server/app.mjs:25-35`；`server/store.mjs:4-11` |
| C03 | **已有** Telegram 提醒同意：`reminders.user_id,language,consentAt` 存原 Telegram 用户 ID；签名数据只验签；机器人 webhook 读消息/命令、发送人 ID/语言、更新编号等，更新编号只进内存去重 | 提醒 90 天、可用 /privacy 删除；更新编号约 24 小时，进程重启失效 | 机器人/服务端；Telegram 收命令回复及 chat_id，其他字段见提醒渠道 C17 | `app.js:460`；`server/app.mjs:37-58`；`server/store.mjs:6-11`；`server/security.mjs:15-25` |
| C04 | **已有**图片诊断日志：时间、无查询参数路径、状态、字节、耗时、截短 UA、截短 IP；无数据库列。通用 API 也处理来源、请求头和受信代理地址；边缘安全日志另核 | 图片日志配置每日滚动保留 6 份轮转，政策写至多 7 天；实机和 Cloudflare 期限未知 | Nginx/运维；Cloudflare 处理流量、安全，不能把应用日志限定套到供应商 | `deploy/image-access/00-image-log.conf:1-15`；`deploy/image-access/logrotate:1-9`；`deploy/nginx.conf:1-9`；`server/security.mjs:7-14`；`server/app.mjs:9-23` |
| C05 | **集成页已有**并发在线：页内随机 UUID，显示时约 30 秒心跳；后端内存记录 UUID/最后时间；`presence_5m.bucket,peak,total,samples` 只存聚合 | 内存窗口 75 秒；聚合清理阈值 31 天，入口启动清理；配置是否开启未核实 | 运维后台统计，小于 5 抑制；公众无 UUID 列表 | `app.js:57-65`；`server/metrics-api.mjs:42-50`；`server/metrics-store.mjs:3,15,21-23,86-96`；`server/index.mjs:18-25` |
| C06 | **已有**同意后 GA：`ct-analytics` 本机选项、可能的 GA Cookie；屏幕、活动、时长/次数桶、分享渠道、声音、惯用手、报名结果、图像错误分组、活动来源、晨间步骤及平台；家族只显式发送动作类别、祭礼种类/提醒渠道。家族脚本与主脚本不同，未显式设置同等 URL 清理 | 本机选择至清除；主脚本撤回停发并试删 GA Cookie；Google 持有期限、自动采集与家族撤回效果未验证 | Google Analytics/Tag Manager；显式业务参数不含身份、碑文、邀请凭证；供应商的网络元数据、客户端 ID、自动页面字段须单验 | `analytics.js:2-15,30-52`；`family-analytics.js:1-3`；`app.js:611-616` |
| C07 | 自有计数 `daily_counters.day,metric,dimension,value`（进入/分享/完成等，家族服务端动作也可加计）；`system_errors.hour,category,value` API 错误计数 | 日计数未见 TTL；错误清理阈值 2 天、启动清理 | Access 后台统计，无逐用户事件 | `referrals.js:32`；`server/metrics-api.mjs:4,50-55`；`server/metrics-store.mjs:8-9,86-96`；`server/index.mjs:34,52` |
| C08 | **集成页已有（部分）**推荐：浏览器本机 UUID/随机分享码，Telegram 可用验签身份；`referral_identities.id_hash,referral_code,account_hash,created_at,expires_at`；`referral_bindings.referee_hash,referrer_hash,channel,activity,first_seen_at,expires_at`；家庭会话合并可写账户 HMAC | 身份/关系阈值 730 天，启动清理；自助删身份/关系，不等于删所有计数 | 推荐者只读汇总，后台有达阈值才显示的关系图；分享渠道接收用户选择分享的链接/码；不能称所有推荐数据都与身份分离 | `referrals.js:10-34`；`family.js:545-546`；`server/metrics-api.mjs:7-8,56-74`；`server/metrics-store.mjs:3,10-11,23-49,65-76,91-96` |
| C09 | **集成页已有（部分）**拒绝推荐识别时仍计每码日点击 `referral_clicks.referral_code,day,value`；`referral_limits.referrer_hash,day,value` 限制推荐绑定 | 点击未见 TTL，删除推荐身份不删该表；限额约两天清理阈值 | 内部计数；用户不可看访客身份 | `server/metrics-api.mjs:61-67`；`server/metrics-store.mjs:12-13,45-46,85,93-96` |
| C10 | 旧后台审计 `admin_audit.at,email,action,object_type` 存已验证邮箱原值。与 P18 HMAC 完全不同 | 清理阈值 365 天，入口启动清理 | 旧后台读取请求触发，Access 管理员身份由 Cloudflare 提供；底表供有权运维 | `server/metrics-api.mjs:28-39`；`server/metrics-store.mjs:14,94-96`；`server/access-auth.mjs:6-45`；`server/index.mjs:18-20` |
| C11 | **已有**家族账户：`users.id,display_name,locale,created_at,deleted_at,demo`；`identities.id,user_id,provider,subject,email,created_at,demo`；邮箱/Google/Telegram 的主体按各登录流程做 HMAC，邮箱列可有原值；Google 获取已验证邮箱、sub、显示名等资料 | 删除账户级联，未见常规 TTL | 本人及登录服务；Google 收授权请求与换码，返回资料；常规管理指标无家族碑文 | `server/family-store.mjs:17-18,63-103,427-429`；`server/family-api.mjs:277-335,341-410` |
| C12 | **已有**会话：浏览器 `ct_session` 原值、客户端 CSRF 值，服务端 `sessions.token_hash,user_id,expires_at,ua_summary,csrf_hash,created_at,demo`；UA 最长 160 字符 | 会话最长 30 天，登出/账号删除可删，启用家族时约每分钟清理过期行 | 浏览器与家族服务；不发给公众，管理指标不读明细 | `server/family-api.mjs:32-40,186-211,415-442`；`server/family-store.mjs:19,167-196,430-435`；`server/index.mjs:26-35` |
| C13 | **已有**邮箱验证码：`email_codes.subject,email,code_hash,expires_at,attempts,ip_hash,created_at,demo`；`family_rates.key,until` 存邮箱/IP 等 HMAC 限额键 | 验证码 10 分钟、最多 5 次、成功消费；限额常见 1 分钟，过期任务清理 | 邮件仅向指定地址发验证码；原码在发送链路和邮件，不落主验证码表；模拟发信另见 C20 | `server/family-api.mjs:245-288,576-585`；`server/family-store.mjs:20-21,125-150,430-434`；`server/mail.mjs:4-18` |
| C14 | Google OAuth 临时：`oauth_states.state_hash,verifier,expires_at,created_at,demo`；`ct_oauth` Cookie 状态、授权码和临时访问令牌在流程中 | 状态有效 10 分钟/一次性消费；Google 自己的期限待查 | 浏览器、家族服务和 Google；OAuth token 用于请求 Google userinfo，未见长期落库 | `server/family-api.mjs:341-410`；`server/family-store.mjs:22,152-165,430-434` |
| C15 | **已有**家族牌位与成员：`tablets.id,owner_id,honorific,full_name,birth_year,death_year,death_lunar_day,death_lunar_month,death_lunar_leap,note,created_at,demo`；`tablet_members.tablet_id,user_id,role,created_at,demo` | 删除碑/账号级联；成员可退出或被移除；未见 TTL | 主人和获准家庭成员；一般后台只看聚合；本人导出、生成日历另见 C21 | `server/family-store.mjs:23-24,209-262,345-359`；`server/family-api.mjs:620-659,674-721,799-824` |
| C16 | **已有**家族邀请与祭礼：`invites.id,tablet_id,token_hash,created_by,expires_at,revoked_at,uses,max_uses,created_at,demo`；邀请凭证可暂存浏览器 `sessionStorage`；`offerings.id,tablet_id,user_id,kind,at,created_at,demo` | 邀请有效期 30 天、可撤销，行未见到期清除；祭礼随关联碑/账号删 | 主人分享邀请链接；已登录获准成员看家族详情；凭证用于兑换，不进业务统计字段 | `family.js:118-137,388-401`；`server/family-api.mjs:663-670,724-762`；`server/family-store.mjs:25-26,265-331` |
| C17 | **已有**提醒及发送记录：`reminder_prefs.user_id,email_on,telegram_on,telegram_chat_id,ics_token,festival_on,created_at,demo`（ICS 服务端存 HMAC）；`deliveries.id,user_id,tablet_id,kind,due_date,channel,sent_at,status,attempts,created_at,dedupe_key,demo` | 偏好可改；记录无独立 TTL，账号删除级联 | 本人/服务端；Telegram 收 chat ID 和提醒文字，邮件提供方收收件地址、主题和正文（可能含家庭纪念信息）；管理员为聚合 | `server/family-api.mjs:311-335,470-554,774-796`；`server/family-store.mjs:27-28,362-383`；`server/reminders.mjs:20-42,52-105,113-132`；`server/mail.mjs:4-18` |
| C18 | 家族同意凭据 `family_consents.user_id,version,consented_at,demo` | 更新覆盖上一版本；删除账号级联，无另设 TTL | 本人和家族服务（核验创建/提醒资格） | `server/family-store.mjs:29,198-204`；`server/family-api.mjs:590-597,627-629`；`server/reminders.mjs:52` |
| C19 | 条件启用的家族日历预登记与会员意向：`calendar_preorders.id,user_id,contact,family_name,edition,anniversaries_json,address,status,created_at,demo`；`membership_interests.id,name,contact,ancestor_count,willingness,region,created_at,expires_at,demo` | 订单未见 TTL，删账号只置空 user_id；意向 730 天阈值 | 提交者、启用时 Access 后台读部分原值（含联系方式及预登记地址，未回 anniversaries_json）；集成源码有路径，不代表目前开放、印刷或支付 | `server/family-api.mjs:68-94,574-588`；`server/family-store.mjs:30-31,410-435`；`server/metrics-api.mjs:28-39` |
| C20 | 测试邮件 `mail_outbox.id,to_address,subject,text_body,html_body,created_at,expires_at,demo`，正文可包含模拟验证码 | 10 分钟；过期清理随家族任务 | staging 开发接口受配置限制，只用虚构数据；真实发送分支为 Resend 或 SES，供应商期限待核 | `server/outbox-staging.mjs:2-45`；`server/family-api.mjs:232-242,269-276`；`server/family-store.mjs:436-444`；`server/mail.mjs:4-20` |
| C21 | 本人数据输出：家族 JSON 导出；ICS 链接带访问凭证，日历返回纪念/节日内容；PDF 生成使用家族名及纪念日期等，响应给申请者；无单独输出表 | 处理及响应期间；下载件由接收端保存；ICS 到期/撤销与外部日历缓存待核 | 获准用户及其选择的日历服务/分享对象；知悉有效 ICS 链接者可能读取，勿公开 | `server/family-api.mjs:470-554,599-615,783-809`；`server/family-store.mjs:379-409`；`family.js:481-501` |
| C22 | **已有**备份为整个 SQLite 的副本，含当时已存在的上述数据；备份文件限制权限，部署脚本可传已配置远端 | 政策写家族删除数据至多 30 天退出轮转；脚本的两个远端分支按 14 天阈值清理；配置和实机未核实，不能直接承诺宠物同期限 | 授权备份运维、选定远端供应商；存储地和访问范围待核 | `server/backup.mjs:1-4`；`deploy/backup.sh:2-23`；`deploy/chuamay-backup@.timer:1-7` |

**指纹排查。** 在上述身份、归因与统计路径未发现通过 Canvas/WebGL、字体、硬件配置等组合生成稳定设备指纹。P01/P02、C05/C08 的随机号不是硬件标识；P09 的无 Cookie 日粒度 IP HMAC 和 P10 的分钟粒度 HMAC 仍是可关联的安全标识。C04 的截短 UA/IP、C12 的 UA 摘要、P12 的粗分类组合、GA 供应商自动采集均有再识别可能，单列复核；不能据此证明外部 SDK、Cloudflare 或所有未来页面均无指纹处理。P12 原始事件应称去标识化或使用随机编号，对外合计才称匿名统计。

**建议删掉（只列建议，不改代码）。**

1. **D1（已核实，无需改码）** 绑定成功时已清除 `pet_memorials.browser_claim_hash`，并替换旧浏览器成员行（P04）。
2. **D2** 从 `pet_visits` / `pet_offerings` 合并重复的碑、日、访客、种类记录；保留一个去重事实与必要的时间，先确认历史计数无差异（P09）。
3. **D3** 萌宠统计若只用动作汇总，优先不留逐条 `visitor_ref`、精确事件时间及未使用的浏览器/系统/设备/屏幕维度；有具体用途再审计是否需要逐条数据（P12）。
4. **D4** 日历只送电子版时，停收实体配送地址；检视是否仍需联系信息、家庭名和纪念日期。历史预登记按律师确认的处理方式，勿直接删除（C19）。
5. **D5** 旧后台仅需要识别审核责任时，改用独立作用域 HMAC，避免长期存管理员邮箱原值；先确认追责和迁移要求（C10）。
6. **D6** 家族会话若确无安全用途，取消存储 UA 摘要；图片诊断 IP 前缀和 UA 只在明确故障用途下保留（C04/C12）。
7. **D7** P24 管理动作理由若固定类别已足够，减少长期保存的自由文；如确需补充说明，先定访问、去标识化和到期清理流程（P18）。

## 2. 越南语、英语原文 → 改后

“原文”只引相关原句作为插入点，不重写无关条文。以下为**目标上线文案**；【内部门槛】不随页面发布。需由 Claude 按最终接线删去未实现承诺，确认同意界面、浏览器安全 Cookie、绑定/恢复、导出、删除、纪念墙和监护流程后再发布。

### P74 · 认领码查看、保存与删除核验

- [已验证事实] 认领码不是服务端单独保存的原值；它由原浏览器的签名 `ct_pet_browser` Cookie 派生，数据库只保存其 HMAC 哈希。`server/pet-api.mjs:67-75,78-105,206-214`；`server/pet-store.mjs:14-20,77-90`。
- [已验证事实] 未绑定的碑，只有带原浏览器 Cookie 的 `GET /api/pet-garden/me/claim` 会重显认领码；无该 Cookie、换浏览器、清除浏览器数据或使用 Telegram 身份时接口返回空列表。`server/pet-api.mjs:149-158`；`server/pet-api.test.mjs:254-283`。
- [已验证事实] 该 Cookie 的最长有效期是 365 天；清除 Cookie 或换浏览器不会删除服务器上的碑，但会使当前接口无法再重显该浏览器的认领码。`server/pet-api.mjs:67-75,149-158`；`server/pet-api.test.mjs:254-283`。
- [已验证事实] 绑定成功会清空 `browser_claim_hash` 并移除旧浏览器成员行；之后即使仍持有原 Cookie，认领码查看接口也返回空列表。`server/pet-store.mjs:92-100`；`server/pet-api.test.mjs:254-283`。
- [已验证事实] 已绑定碑可由其所有者删除；删除 `pet_memorials` 会级联删除邀请、成员、献花/点灯、来访和举报等关联行。`server/pet-api.mjs:270-274`；`server/pet-store.mjs:23-40,145`；`server/pet-api.test.mjs:302-334`。
- [已验证事实] 当前接口尚不支持“同一 Telegram 账号的个人中心重显认领码”：Telegram 身份请求该查看接口返回空列表。`server/pet-api.test.mjs:254-283`。
- [待产品/接口补齐] 只有在 Telegram 身份可获得已绑定碑的安全管理入口、且产品决定是否展示原认领码后，才可对外承诺“在同一 Telegram 账号的个人中心查看认领码”。
- [待律师确认] 上述 Cookie、认领码和删除行为是代码事实，不构成对适用隐私义务、备份保留期限或删除完成时点的法律结论。

### 待 Codex E 修改的越南语提示（只列，不改页面）

| 文件:行号 | 当前句子/返回形状 | 建议改成的越南语 | 依据 |
| --- | --- | --- | --- |
| `town-3d/petgarden/demo.html:9` | `Mã nhận bia` | `Xem mã nhận bia` | 明确这是“查看”动作，避免暗示码只在当前弹层保存。 |
| `town-3d/petgarden/demo.js:27` | `Trước khi đổi trình duyệt hoặc xóa dữ liệu trình duyệt, hãy lưu mã này hoặc liên kết bia trong Telegram.` | `Khi bia chưa được liên kết, bạn có thể xem lại mã nhận bia trong mục Cá nhân trên cùng trình duyệt này. Nếu đổi trình duyệt hoặc xóa dữ liệu trình duyệt, bạn sẽ không xem lại được mã ở đó.` | 当前实现仅原浏览器、未绑定碑可重显；不能承诺 Telegram 账号可查看。 |
| `town-3d/petgarden/demo.js:27` | `Bia: ${claim.memorialId}` / `Mã: ${claim.claimCode}` | `Bia: ${claim.id}` / `Mã nhận bia: ${claim.claimToken}` | 接口实际返回 `items:[{id,claimToken}]`，不是 `memorialId/claimCode`；这是接线不一致，需由 Codex E 修正。 |
| `town-3d/petgarden/demo.js:28` | 读取 `data.claim || data`，并要求 `memorialId` 与 `claimCode` | 从 `data.items` 读取未绑定碑的 `{id, claimToken}`；无项目时隐藏入口。 | 与 `GET /api/pet-garden/me/claim` 实际返回形状一致；此行没有越南语用户文案，但会导致现有提示无法出现。 |
| `server/pet-api.mjs:149-158` | `{items:[{id,claimToken}]}`（无越南语用户文案） | 前端显示层映射为 `Mã nhận bia`，不在 API 返回中加入本地化文案。 | 保持接口返回为数据，避免服务端承诺 Telegram 个人中心重显。 |

### Tiếng Việt · Quyền riêng tư

**1. Số nhận diện trong trình duyệt và Telegram**

- 原文（`quyen-rieng-tu.html:2,6`）：“Bạn có thể xóa chúng trong cài đặt trình duyệt.” / “Telegram cung cấp dữ liệu có chữ ký để xác minh Mini App.”
- [已验证事实] 改后：Bạn có thể vào Vườn Thú Cưng mà không cần đăng nhập. Khi bạn mở một bia tưởng niệm công khai, trình duyệt lưu một mã ngẫu nhiên để không đếm lặp lượt đặt hoa hoặc thắp đèn. Khi bạn tạo bia đầu tiên, trình duyệt lưu một mã riêng để nhận ra bạn là người quản lý bia. Các mã này có thể được lưu tối đa 365 ngày. Chúng được tạo ngẫu nhiên, không dựa vào dấu vân tay thiết bị. `server/pet-api.mjs:67-75,138-142,206-214`。
- [已验证事实] 改后：Khi bia chưa được liên kết, bạn có thể xem lại mã nhận bia trong mục Cá nhân trên cùng trình duyệt này. Nếu bạn xóa cookie hoặc đổi trình duyệt, bia vẫn còn trên máy chủ nhưng bạn không thể xem lại mã ở đó. Sau khi liên kết bia, mã nhận bia không còn hiển thị lại. `server/pet-api.mjs:149-158`；`server/pet-store.mjs:92-100`；`server/pet-api.test.mjs:254-283`。
- [已验证事实] 改后：Nếu mở qua Telegram Mini App, Telegram gửi dữ liệu có chữ ký để xác minh. Chúng tôi dùng một mã được tạo từ mã người dùng Telegram để nhận ra bạn trong Vườn. Chúng tôi không lưu toàn bộ dữ liệu xác minh. `server/security.mjs:15-25`；`server/pet-api.mjs:78-95`。
- [已验证事实] 改后：Để liên kết bia đã tạo trong trình duyệt, hãy xác minh trong Telegram và dùng mã nhận bia của bạn. Hiện tại, mã nhận bia không hiển thị lại trong cùng một tài khoản Telegram. `server/pet-api.mjs:149-158,235-239`；`server/pet-api.test.mjs:254-283`。
- [待律师确认] 外发版仍须按最终界面确认 Cookie 告知、删除说明和备份期限；不得把上述代码事实表述为法律结论。
- 【内部门槛】验证认领凭证如何交给用户、安全保存、从浏览器切到 Telegram、遗失恢复和真实 Cookie 范围；未验证的邮箱/Google 绑定不写。

**2. Thông tin trên bia, quyền truy cập và xóa**

- 原文（`quyen-rieng-tu.html:4-5`）：“Thành viên không được mời không thể xem bài vị.” / “Trong trang Tài khoản, bạn có thể xuất dữ liệu hoặc xóa toàn bộ dữ liệu đang hoạt động.”
- 改后：Quy tắc của bàn thờ gia tiên vẫn giữ nguyên. Trong Vườn Thú Cưng, nếu bạn chọn bia công khai, bất kỳ ai cũng có thể xem tên, loài, năm sinh và năm mất nếu có, cùng lời tưởng niệm. Chỉ bạn và người được bạn mời mới có thể xem thông tin riêng, như ngày tháng đầy đủ. Bạn có thể thu hồi lời mời. Để lấy bản sao hoặc xóa bia, hãy mở mục quản lý bia bằng trình duyệt còn nhận ra bạn hoặc bằng danh tính đã liên kết. Nếu không dùng được mục này, hãy liên hệ hello@chuamay.org để được hướng dẫn xác minh. Xóa cookie không xóa bia trên máy chủ. Chúng tôi sẽ giải thích dữ liệu nào còn trong bản sao lưu hoặc cần được giữ và trong bao lâu.
- 【内部门槛】当前只有本人列表、完整日期详情及删除 API，无宠物专用导出接口或已核实的客服流程；确定导出范围、删除级联、P24 审计例外和备份期限。家族账号删除不能写成自动清除宠物数据。

**3. Thống kê, an toàn và báo cáo**

- 原文（`quyen-rieng-tu.html:3,8`）：“Địa chỉ IP chỉ được băm HMAC để giới hạn yêu cầu.”（该句见第 3 行报名段）/ “Rút lại qua Thêm → Tùy chọn thống kê → Không.”
- 改后：Để giới hạn yêu cầu và tránh đếm lặp, máy chủ dùng mã ngẫu nhiên hoặc mã được tạo từ danh tính đã xác minh. Nếu không có mã phù hợp, máy chủ có thể tạo mã tạm từ địa chỉ IP. Chúng tôi kiểm tra tên và lời tưởng niệm bằng quy tắc tự động. Bạn có thể gửi báo cáo bằng cách chọn lý do; bản ghi báo cáo không kèm tên người báo cáo. Người được phép kiểm duyệt có thể xem báo cáo và ghi lại quyết định để xử lý khiếu nại.
- 改后（续）：Thống kê tùy chọn của Vườn chỉ được ghi khi bạn đồng ý. Nếu được bật, chúng tôi dùng mã thống kê ngẫu nhiên riêng và các nhóm thông tin như loại hoạt động. Chúng tôi không đưa tên, nội dung bia hay mã tài khoản vào các sự kiện này. Báo cáo thống kê hiển thị số liệu tổng hợp ẩn danh. Bạn có thể ngừng gửi sự kiện mới qua Thêm → Tùy chọn thống kê → Không. Google Analytics của các phần khác và dữ liệu giới thiệu được mô tả riêng.
- 【内部门槛】P24 审核尚待接线；说明留存和申诉入口。统计尚无采集接线；需验证禁用、撤回和标识分离后方可启用第二段。若上线推荐，另明确推荐关系可与账户链接及删除计数的范围。将报名段 IP 说明限定于报名，不暗示全站 IP 只用于限速。

### Tiếng Việt · Điều khoản

**4. Viếng bia, kiểm duyệt và Tường Tưởng Niệm**

- 原文（`dieu-khoan.html:1`）：“Bạn có thể sử dụng Chùa Mây miễn phí và dừng bất cứ lúc nào.” / “Tính năng Bài vị gia đình đang được thử nghiệm theo lời mời và chỉ hiển thị với người đã được mời.”
- 改后：Bạn có thể ghé Vườn Thú Cưng và tạo bia đầu tiên miễn phí. Bia thứ hai và khu mộ riêng chưa mở; hiện không nhận đặt chỗ hay thanh toán cho các mục đó. Người không được mời chỉ có thể đặt hoa hoặc thắp đèn tại bia công khai, không thể để lại bình luận. Tên và lời tưởng niệm phải qua kiểm tra tự động trước khi được đăng. Đừng ghi thông tin liên lạc hoặc thông tin riêng của người khác lên bia. Nếu trong một năm không có lượt đặt hoa hoặc thắp đèn hợp lệ từ khách, bia công khai được chuyển sang Tường Tưởng Niệm. Việc chuyển chỗ không xóa bia; bia trên tường vẫn có thể được xem công khai. Chúng tôi có thể ẩn bia hoặc giới hạn quyền sử dụng khi có vi phạm; hãy liên hệ hello@chuamay.org để hỏi về quyết định. Quy tắc của Bài vị gia đình không thay đổi.
- 【内部门槛】确认一年作业和墙展示，确认什么算合格来访、普通用户申诉、收费占位和正式开放状态；别把普通浏览说成重置时钟。

**5. Người chưa thành niên**

- 原文（`dieu-khoan.html:1`）：“Các quyền của bạn theo luật áp dụng không bị loại bỏ bởi các điều khoản này.”（无专门年龄条款，拟在此前插入。）
- 改后：Nếu bạn chưa thành niên, hãy nhờ cha mẹ hoặc người giám hộ xem các điều khoản này cùng bạn. Khi cần sự đồng ý của cha mẹ hoặc người giám hộ, đừng tạo bia, liên kết tài khoản hoặc gửi thông tin cá nhân trước khi có sự đồng ý đó. Cha mẹ hoặc người giám hộ có thể liên hệ hello@chuamay.org để hỏi về dữ liệu hoặc yêu cầu xử lý thông tin của trẻ.
- 【内部门槛】年龄门槛、核验与同意方式待律师确认；现有萌宠园路由未见年龄或监护同意控制。

### English · Privacy

**1. Browser numbers and Telegram**

- 原文（`quyen-rieng-tu.html:9`）：“If you create an account, we store sign-in identity, session, memorial tablets, family membership, offerings, invitations and reminder preferences.”（该句属家族功能；其后新设 Pet Garden 小节。）
- [已验证事实] 改后：You can visit the Pet Garden without signing in. When you open a public memorial, your browser stores a random number so we can avoid counting the same flower or light more than once. When you create your first memorial, your browser stores a separate number that lets us recognize you as its owner. These numbers can remain in your browser for up to 365 days. They are generated at random and do not come from device fingerprinting. `server/pet-api.mjs:67-75,138-142,206-214`。
- [已验证事实] 改后：While a memorial is not linked, you can view its claim code again in the personal area in the same browser. If you clear cookies or switch browsers, the memorial remains on our server but you cannot view the code there again. After the memorial is linked, the claim code is no longer shown again. `server/pet-api.mjs:149-158`；`server/pet-store.mjs:92-100`；`server/pet-api.test.mjs:254-283`。
- [已验证事实] 改后：When you open the Telegram Mini App, Telegram sends signed data so we can verify you. We use a code derived from your Telegram user ID to recognize you in the Garden. We do not store the full verification data. `server/security.mjs:15-25`；`server/pet-api.mjs:78-95`。
- [已验证事实] 改后：To link a memorial you created in a browser, verify your Telegram identity and use your memorial claim code. At present, the claim code is not shown again within the same Telegram account. `server/pet-api.mjs:149-158,235-239`；`server/pet-api.test.mjs:254-283`。
- [待律师确认] The release copy still needs review of cookie notice, deletion wording, and backup retention; the implementation facts above are not legal conclusions.
- 【内部门槛】同越文第 1 项。

**2. Who can see a memorial; copies and deletion**

- 原文（`quyen-rieng-tu.html:9`）：“Non-members cannot view a memorial.” / “Account controls export or delete active data.”（仅适用于家族小节，不能作为园区规则。）
- 改后：Family memorial privacy remains unchanged. If you make a Pet Garden memorial public, anyone can see the pet’s name, species, birth and death years where provided, and the memorial text. Only you and people you invite can see private details such as full dates. You can revoke invitations. To get a copy or delete your memorial, open its management controls using the browser that still recognizes you or your linked identity. If those controls are unavailable, contact hello@chuamay.org for help verifying ownership. Clearing cookies does not delete a memorial from our servers. We will explain what may remain in backups or must be kept, and for how long.
- 【内部门槛】同越文第 2 项。

**3. Optional statistics, abuse prevention and reports**

- 原文（`quyen-rieng-tu.html:9`）：“Analytics starts only after consent.” / “Withdraw via More → Analytics preferences → Decline.”
- 改后：To limit abuse and avoid repeat counts, our server uses a random code or a code derived from a verified identity. If no suitable code is available, it may derive a temporary code from an IP address. We check pet names and memorial text with automated rules. You can report a memorial by selecting a reason. The report does not include your name. Authorized reviewers can see reports and record their decisions so they can respond to appeals.
- 改后（续）：Pet Garden statistics are optional and are recorded only if you agree. When enabled, they use a separate random statistics code and broad categories such as the activity type. We do not include your name, memorial text or account ID in these events. Reports show anonymous totals. To stop sending new events, choose More → Analytics preferences → Decline. Google Analytics for other features and referral records are described separately.
- 【内部门槛】同越文第 3 项；只把合计称为匿名，当前英语页缺少与越文同等的推荐、基础登记、Cloudflare 说明，定稿时两语补齐。

### English · Terms

**4. Visiting, moderation and the Memorial Wall**

- 原文（`dieu-khoan.html:1`）：“This free online space may be used or left at any time.” / “Family memorials are in an invitation-only pilot and are visible only to invited people.”
- 改后：You can visit the Pet Garden and create your first memorial for free. Second memorials and private plots are coming later. We are not taking reservations or payments for them now. Visitors who are not invited can leave a flower or light at a public memorial but cannot post comments. Automated rules check the pet’s name and memorial text before they appear. Please do not put someone else’s contact or private information on a memorial. If a public memorial receives no qualifying flower or light from a visitor for one year, it moves to the Memorial Wall. Moving it does not delete it, and the memorial can still be viewed publicly on the Wall. We may hide a memorial or restrict access for a rule violation. Contact hello@chuamay.org if you want us to review a decision. The family memorial rules remain unchanged.
- 【内部门槛】同越文第 4 项。

**5. Minors**

- 原文（`dieu-khoan.html:1`）：“These terms do not remove rights provided by applicable law.”（无专门年龄条款，拟在此前插入。）
- 改后：If you are a minor, ask a parent or guardian to read these terms with you. Where a parent’s or guardian’s consent is required, wait for it before creating a memorial, linking an account or sending personal information. Parents and guardians can contact hello@chuamay.org with questions or requests about a child’s data.
- 【内部门槛】同越文第 5 项。

## 3. 给律师的问题（均待律师确认）

供律师定位原文：[越南《个人数据保护法》91/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=)、[实施法令 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?classid=1&docid=216387&orggroupid=2&pageid=27160)。这里只定位官方文本，不判断适用或合规结果。

1. **主体和适用范围：** 哪个实体应列为运营者、控制者/处理者？越南用户、境外运营和 Telegram Mini App 分别适用哪些规则？需要什么联系方式、语言及投诉渠道？
2. **告知和同意：** 进入园区、自动 Telegram 验证、签发必要 Cookie、限速、公开碑和推荐/可选分析应如何分别告知？哪些需主动选择、单独同意或同意留痕？撤回后已有统计和推荐关系如何处理？
3. **数据分类：** 随机号、按日或分钟派生的 IP HMAC、Telegram/管理员 HMAC、分组设备信息、碑文和家庭纪念内容分别如何分类？哪些条件下合计可称匿名，推荐绑定和 GA 是否需要另作披露？
4. **公开和来访：** 公共碑文中若含可识别的在世者资料，谁可以授权公开？移墙后可公开多久、如何告知主人、如何提出下架？需要屏蔽搜索引擎或第三方索引吗？
5. **未成年人：** 访客和建碑者分别适用什么年龄门槛？如何最少收集地验证年龄和监护同意、如何撤回和验证监护人？是否应在流程具备前限制未成年人建碑？
6. **存放地和跨境：** 主库、备份、Cloudflare、Telegram、Google Analytics/OAuth、Resend 或 SES 实际国家/区域和供应商角色是什么？需哪些合同、告知、影响评估、备案或跨境安排？
7. **期限：** 对立碑身份、邀请/成员、献礼和去重、限速、审核和举报、禁令、仅追加审计、备份分别定多长？审计如何落实到期删除或去标识化，避免因为触发器而无限留存？如何核对旧登记和备份的删除周期？
8. **权利行使：** 对无账号浏览器如何安全核验所有权、处理凭证丢失、导出、访问、更正、删除、异议？处理时限和格式是什么？删除后哪些数据可因安全、争议或备份保留，如何告知？
9. **审查及申诉：** 如何告知机器审核、拒绝、下架、封禁及人工复核？通知、申诉时限、记录最小化和权限如何设定？
10. **上线前材料：** 需要什么数据流记录、供应商协议、安全/泄露通知流程与审阅签字？旧家族日历实体预登记停用后，历史资料的处理和双语告知如何衔接？

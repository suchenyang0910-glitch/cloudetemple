# A-20261123-03 正式站准备方案（代码候选，不是上线许可）

基线：`ef467c007436ede167fcbe4680a025c70292f803`；分支 `codexb/town-production-prep-a20261123-03`。范围按补充1：**每房**小镇20、主殿16，满房继续开房，只有全服硬上限才拒绝。staging 40，正式候选120。新代码没有部署，不改变R4已审提交；不能用本候选替换R4的代码/数据库步骤直接执行。

## 1. 数据库方案与代价

已知事实：旧版实时与API共用主库、DELETE日志模式；实时同步等待锁可阻塞事件循环2秒。旧town表关联users，不能把文件直接搬走后仍假定跨库外键有效。

假设：正式第一次启用没有需要从staging带入的真实town资料；staging合成/试用数据保留原处供回退。若需要保留旧试用称呼及改名冷却记录，必须先明确导入范围，不能假装本版已经完成数据导入。

反对独立库的三个主要理由：账号删除不再能靠单库外键即时传播；需要管理第二份备份和恢复链；API同步SQLite写入仍可能短暂占用主API事件循环。未知：真实120连接内存、CPU、存储延迟及代理拓扑，均非本地功能测试能证明。

支持独立库的三个主要理由：实时不打开主库，两个文件的写锁独立；API只在既有登录验证之后向town库签发票据，身份源仍是原users/identities；旧表保留且候选默认关闭，代码回退无需破坏数据。推断：这能消除跨库文件锁互相阻塞，不能消除同机CPU/磁盘竞争。

### Verdict
采用**独立town.sqlite + WAL**，不ATTACH主库，不复制users/identities或登录密钥。API账号读取完成后才写town库。实时只读写town.sqlite。
### Confidence
85%（架构与本地功能依据；不是线上容量置信度）。
### Why
文件锁隔离可用两个真实SQLite文件验证；原账号接口保留，候选默认不启用。API的town连接等锁仅50ms，超时按已有503处理；实时连接等待2000ms，定时器仅SQLITE_BUSY跳过本轮。
### Key Variables
主库账号校验延迟、town写入竞争、120连接的实际资源占用。
### Largest Unknown
真实环境下120连接与现有正式服务并行时的资源余量。
### Reversal Condition
若经批准的staging测量显示API延迟仍因town操作明显升高，或30秒账号失效窗口不可接受，需改为异步隔离进程/可靠撤销事件，不放宽超时或删除校验来通过。

最小验证实验：合成本机两文件分别持锁，验证另一文件仍可写、票据可消费；账号投影过期后拒绝；120个内存连接按20/16分房，第121个拒绝。成功指标是全部断言通过且旧主库结构/数据不变；任一不成立即失败。局部功能验证几分钟，容量实验另需staging许可；本地通过只允许交A审，不允许上线。

### 实现与账号失效

- `town-isolated.mjs`只接受环境目录下名为`town.sqlite`的绝对路径，拒绝链接、硬链接、多链接路径、主库users表或缺少独立schema v3标记；启动必须已有文件、WAL，不自动建库/迁移。
- 推荐正式独立库：`/var/lib/chuamay/production/town/town.sqlite`；staging新候选：`/var/lib/chuamay/staging/town/town.sqlite`。API及实时指向同一份，各用自己的连接；原主库路径不改。
- 独立库只有town表，不建users表。`town_names.user_id`为原账号不透明ID，不是新账号系统；不复制身份资料、邮箱、Telegram ID或会话凭据。
- API沿现有账号读取器确认身份，发票据时刷新该账号30秒有效期。API每10秒先读主库确认活动账号，再在短town事务内刷新有效期或删除已删除账号的投影。主库锁定时不持town写事务；刷新失败不延长有效期，实时最多约30秒加下一次1秒tick后失效。已登录用户遇到API长期故障会退出多人，游客不依赖账号刷新。
- 这相对旧版每秒直接查询主库有明确变化：账号撤销不是即时跨库事务；正常约10秒传播，故障下30秒有效期限制。需要A/Claude接受，不能称为零窗口。
- `openTownStore`的旧共享库模式仅留给历史测试与旧版兼容；新API入口和实时进程均走独立库，没有运行时回退到主库的分支。
- 账号刷新目前遍历town库中有账号的记录；长期历史量增长后需评估批处理。它在API进程执行，既有主库查询等待仍可能延迟API，独立库不是CPU/事件循环完全隔离。

### 初始化、旧表与回退

只在执行日获批后，停止相应实时/新API写入，创建归属chuamay的受控目录，再运行：`CHUAMAY_ENV=production node server/town-isolated.mjs --initialize-empty /var/lib/chuamay/production/town/town.sqlite`。目标已存在立即失败，不覆盖、不删除重试；初始化失败留下的候选文件需核对后另行处理。原主库、旧town表和users.town_name一律不改、不DROP。

本版迁移是**新库结构初始化，旧staging数据保留、不跨环境复制**。正式从空town库开始；身份仍是正式users/identities，称呼首次使用由审核池产生。未提供把真实旧town资料导入新库的工具；如果该前提不成立，上线闸门不通过。

WAL文件不能在写入中只cp主文件来备份。候选停写后用SQLite备份API生成独立副本，或确认所有连接关闭、完整checkpoint后再做受控文件副本；保存SHA/权限/退出码，不展示数据。原DELETE主库如需部署前留底，仍按R4的停API、BEGIN EXCLUSIVE持锁cp流程执行，不运行prune。

回退：入口/实时开关关闭，停候选实时进程，恢复经核准的旧API release与本次专属drop-in，保留新town库及其备份供后续核对。旧API使用旧主库内原town表；**新库产生的新称呼不会自动回流**，禁止用旧库覆盖或自动双写，需另行决定数据合并。正式首版此前无多人服务时，回到单人即可，无需启用旧共享库实时实现。

## 2. 正式Nginx候选

默认`node deploy/render-nginx.mjs <输出目录>`四文件逐字节与基线相同，包检查固定记录基线SHA并验证。仅显式`--production-town`时h5/miniapp增加各自WSS CSP和精确`/town-ws`路由，api/staging输出不变；不改默认generated-nginx或活动配置。

候选路由回环8794，按`CF-Connecting-IP`全站共享计数，每来源最多4条并发，超限429；h5.conf在http include层定义唯一1MB zone，miniapp复用，两份必须成组审核/应用。空来源头拒绝。**前提**：外层Caddy仅允许Cloudflare来源且不会把未经验证的客户端头当来源；本机8800/8801只回环。不能用Cloudflare节点地址给所有人计同一个桶，也不能在公网可直达上游时信任这个头。执行日无法证明链路就停，不以此模板声称已防伪。共享公网IP/NAT家庭可能触发4条限制，首发需观察，不在这里私自提高限制。

仅提供`deploy/town-worker-connections.PROPOSED.patch`：256→1024，未改deploy/nginx.conf。120条代理WS约占240个Nginx连接；加staging最多80个约320，1024留下约704个给普通访问，但TCP文件描述符、瞬时普通请求和进程CPU仍有限，不是704个用户承诺。执行日还须核对Nginx进程实际RLIMIT_NOFILE≥1024、nginx -t与正式健康码；不足就停止，不能暗改系统限制。

## 3. 正式运行方式

候选unit：`deploy/chuamay-town-production.service`，默认实时关闭，回环8794，独立进程，无Requires/PartOf API依赖。资源：MemoryMax 300000000字节、Swap 0、Node堆160MiB、CPUQuota50%、TasksMax64、LimitNOFILE1024。全服120连接包含未验票据连接，未认证约5秒超时；以上是硬限制和建议，不是已通过120真连接负载测试。

实时目录`/opt/chuamay/production/town-realtime/releases/<approved-sha>/server`，unit路径在上线清单中固定为审核后的不可变目录（模板current占位必须覆盖）；node_modules只一级指向本次API release中标准部署安装的真实依赖，所指release在实时服务存续期间保留。ws仍在实时自己的server/town-realtime目录按lock安装。未新增依赖声明或安装系统软件。

专属非敏感配置`/etc/chuamay/production-town.conf`含TOWN_ENTRY_ENABLED、TOWN_REALTIME_ENABLED、TOWN_DB_PATH、TOWN_SEATS_PATH、TOWN_NAME_POOL_PATH、TOWN_NAME_POOL_SHA256、TOWN_PORT；不复制既有env、不放HASH_SECRET/Telegram/cookie密钥。API通过专属新增EnvironmentFile追加同文件；实时无需读取API env。unit隐藏主库和原API env，只允许写独立town目录。API读取账号的权限不扩大。

实时日志只输出固定code（town_alive、cleanup、store_busy、socket、startup等），不输出连接列表/房间人数、名称、ID、IP、票据、快照或错误对象。候选WS路由关闭access_log，error_log指向/dev/null；可用性由状态码与固定分类结果核对，不能以全量日志排查代替边界。

## 4. 两个开关及用户行为

`GET /api/pet-garden/town/config`返回entryEnabled/realtimeEnabled，只含非敏感布尔值，默认均false。API独立库初始化失败时realtimeEnabled回false，现有API继续运行。`town-access.js`是给下一次场景接线用的纯适配器，**本卡不接页面**。

| 入口 | 实时 | 页面适配器状态/行为 |
|---|---|---|
| 关 | 关/开 | mode=hidden，不提供入口，适配器不连接；这是入口控制，不是账号权限边界。 |
| 开 | 关 | mode=single，进入单人场景，无票据/WS请求。 |
| 开 | 开 | 连接期间仍single，收到snapshot才shared；断线/拒绝立即回single，不弹错误；重试耗尽只回调offline代码。 |

开关分别改本次专属配置并重启对应API/实时进程才生效；关闭实时必须先通知页面适配器/关闭连接并停实时服务，不能只重启API却假设已存在WS自动停止。关闭入口只隐藏新入口，不强制踢出既有在线者；关实时才统一回单人。页面下一次读取config后重建适配器；本候选没有在既有首页偷偷加入轮询或DOM逻辑。

正式票据URL使用`https://api.chuamay.org/api/pet-garden/town/ticket`，CSRF为同级csrf接口（实际路径`/api/pet-garden/town/csrf`）；h5/miniapp WS各用本站wss。经用户本对话授权，新分支的客户端两处fetch改为credentials:include，复用既有生产Domain=.chuamay.org登录cookie及严格CORS允许列表，不修改家族cookie设置、身份验证或白名单。浏览器跨域实测仍须接线后完成。

## 5. 只能选择称呼

HTTP name接口只接受整数candidateId；带name字段即拒绝，哪怕同时带合法candidateId也拒绝。服务端从池映射出文本，实时消息仍不能传任意名字。独立store在读取历史名称时再次确认池内，池外旧名只以稳定池内fallback公开；不让旧cookie自由文本绕过。

staging允许标记为未审的现有草稿；正式必须配置一个UTF-8严格JSON文件：`{version:1,reviewed:true,names:[{id:整数,vi:称呼},...]}`，至少7个唯一ID及唯一规范化名称，逐项通过现有字符/禁词检查，并匹配TOWN_NAME_POOL_SHA256。当前915草稿不改为reviewed，不作为正式审核结果。文件真实文化/母语审核需A/Claude关联审核记录，哈希只是锁定审核字节，不能代替审读。

审核结果回来后：保留旧池，准备新不可变池文件，核对审核记录/新SHA/ID稳定性，停止实时并按清单同时重启API与实时，使两者加载同一版本；服务端不热加载也不向客户端下发自行输入入口。旧名不在新池时公开fallback，不自动改写账号主库。

## 6. 隐私事实（供后续文案，不是法律文案）

| 数据/位置 | 内容 | 失效与清理 |
|---|---|---|
| town_names | 内部访客ref或账号不透明user_id、池内称呼/稳定fallback、版本、锁定时间、最近使用、账号30秒有效期 | 游客365天未用清理；账号记录无固定自动年限，API发现账号删除时删投影。旧staging表原处保留，需另定退役清理。 |
| town_tickets | 一次性随机票据SHA-256、ref、Origin、到期时间；不存明文票据 | 30秒失效，消费即删；60秒清理周期使已过期行通常最多额外约60秒存留。 |
| town_presence | 每次进场随机actor、内部ref、房间、称呼版本、到期时间 | 约20秒续期，45秒失效；退出/断线删除，进程启动清空；过期行清理周期60秒。 |
| 进程内房间/位置/座位 | actor、服务器称呼、当前点/目的地/状态、占座阶段及计时 | 不写位置历史；预留15秒，断线留座60秒，后台90秒；计时到后120秒；随意30分钟询问再2分钟释放；进程停止清空。 |
| town_changes / rates | 改名时间；限速键为哈希/IP或内部ref相关值、次数/期限 | 改名记录7天；限速到期删除及周期清理。 |
| town_reports / reviews | 举报人内部ref、被举报人ref/版本、时间；待审称呼、次数、状态 | 举报30天；已结案review30天；pending没有自动期限。 |
| town_audit | 操作者哈希、review/request ID、动作结果/时间 | 90天清理，不是完全匿名数据。 |
| 浏览器cookie | 签名的随机游客ID、称呼、过期时间；原登录cookie复用 | 游客cookie 365天，HttpOnly/Secure/SameSite=Strict；不在WebSocket消息载荷附加cookie。握手可能由浏览器自动携带既有cookie，实时服务不以它验票、不记录它；不新增共享密钥。 |

别人只看到同房的临时actor、池内称呼、位置/目标、状态和座位，不看到内部账号ID、Telegram ID、头像、邮箱、票据或其他房间名单。临时actor每次进场改变；不显示在线总人数、不做聊天/排行榜、不传声音。称呼和位置仍可关联某次在场活动，不能声称完全匿名。

备份的实际保留周期/销毁政策尚未定；备份不自动继承表行TTL。需用户/Claude在上线前明确，并在后续隐私文案如实表述；本卡不写文案、不自行删除旧数据。

## 7. 验证边界与交付

测试范围包括独立文件锁、WAL与超时、旧主库不变、账号删除/过期、审核池/纯选项、跨域CORS头、双开关、分房及120硬上限、真实本机WS、既有33项协议/抢锁测试及14项客户端测试。本次相关测试60/60通过（旧协议/锁33、客户端14、新生产准备13），现有API回归85/85通过；日志以ops本次回执为准。

真实浏览器、iPhone/Telegram、页面接线、Nginx运行时语法、systemd运行时、线上数据库与120连接负载均NOT_RUN。执行清单见`docs/town-production-execution-DRAFT.md`；R4测试站尚未执行，不能填入虚构经验。两份本地依赖junction仅复用已安装模块跑测试，不是服务器部署做法，不进提交。

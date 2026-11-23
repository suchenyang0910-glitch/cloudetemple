# 正式站执行清单初稿 — 不可执行

本稿基于R4的核对/独占上传/检查/重载/分支回退方式，目标改为正式h5+miniapp两份配置及共用主配置。**用户#162/#163和本卡只授权准备，不是以下服务器操作许可**。B不执行；A在最终代码、v43a/座位、称呼审核、staging结果、最终版清单均经Claude放行且用户逐项批准后才执行。R4目前未执行，其真实故障/处理/结果本稿全部待补，禁止把本稿标为最终版。

批准编号使用占位：P1=正式合并/打包/标准发布与API重启；P2=正式独立库初始化、主库停写留底与专属配置；P3=实时目录/依赖安装/unit及启停；P4=h5/miniapp配置+CSP、来源限流和共用worker_connections修改、Nginx检查/条件reload；P5=合成验证产生的正式短时数据及明确的回退。上线前由A关联用户原话，缺任何一项停止。不能把对staging的#156/#157当成正式许可。

1. 【闸门】记录最终批准代码SHA、清单SHA、席位SHA、审核池SHA和审核记录；确认第一版仅town/chuamay，每房20/16，全服120，所有未解决风险有明确结论；缺项不连接服务器。
2. 【staging事实待填】填入R4真正执行日期、提交、四配置SHA、回环/公网/健康结果、实际问题与处置；再对本独立库候选另做获批staging验证。旧R4共享库通过不代表本候选独立库通过；当前两类服务器证据均NOT_RUN。
3. 【A集成，P1】仅在A干净集成工作树合并最终批准B代码及正式小镇页面候选；冲突停止审查，记录PREVIOUS_INTEGRATION与RELEASE，不在主工作区切分支。不把准备分支独自当作已接好页面的完整发布。
4. 【包/测试】运行相关服务器、客户端、Nginx包检查及A要求的集成检查。普通生成四份必须等于本候选锁定基线；另外生成`node deploy/render-nginx.mjs <本次独占候选目录> --production-town`，只h5/miniapp改变。失败不上传。
5. 【SSH离线门槛】按R4第11b既有可信记录核对root、159.223.92.104、原端口及已确认ED25519指纹；实际scp/ssh必须强制StrictHostKeyChecking=yes，标准脚本没显式参数时要确认既有有效配置，不能只给一次检查命令加参数假装继承。缺记录、ask/accept-new、工具不明则停；不探测、不改known_hosts、不接受新key。
6. 【保密】禁用命令跟踪，不看env、密钥、证书私钥、staging密码、整段journal、完整docker inspect/nginx -T；只记固定结果、路径、SHA、权限、状态码与退出码。
7. 【只读容器定位】只读取目标Nginx容器的`/etc/nginx/chuamay-sites`及`/etc/nginx/nginx.conf`挂载源字段，记录精确容器/宿主路径；主配置若不是可核对的受控挂载，停止补最终清单，不修改容器镜像或猜路径。保持api/staging配置及其他系统不动。
8. 【只读文件基线】记录容器内h5/miniapp/api/staging/main五文件原始SHA，h5/miniapp/main必须与最终审查的旧版一致；第三种版本即停，不覆盖并行修改。核对普通非链接文件、父目录真实路径、权限属主。
9. 【只读链路/限额】确认Caddy实际对两正式域只接受Cloudflare来源、转发的CF-Connecting-IP受信、Nginx只监听回环；确认实际RLIMIT_NOFILE≥1024。不能证明就停，不绕过限流或扩改Caddy/主机资源。
10. 【健康基线】无凭据curl只取状态码：h5首页200、miniapp首页200、api/healthz200、staging匿名首页401、127.0.0.1:8790/healthz200；记录全部退出码，任何异常停止。
11. 【独占备份，P2/P4】在批准目录原子新建700权限批次BK（存在含悬空链接即停）；只复制将改动的三份非敏感配置和必要受控旧unit/drop-in元数据，不复制既有env。备份SHA与旧基线相同，不运行prune，不复用旧目录。
12. 【候选上传，P4】只上传已审h5/miniapp候选、主配置补丁对应完整候选；复用R4第11b严格可信主机与远端open('xb')方式，每个目标独占且上传前后SHA一致。目标已存在、部分传输或失败停止，不覆盖重试；不上传整个sites目录。
13. 【记录回退锚点，P1】读取正式current的精确旧release=PREV，确定新RELEASE/NEW及独立RT不可变目录；记录已尝试部署、API停写、配置新建、RT启动、Nginx替换与reload标记，初始化均0。
14. 【主库留底，P2】明确API实际主库路径且不输出内容。只有相应停写获批后停止API、确认无监听；按R4持BEGIN EXCLUSIVE锁cp普通原文件到独占副本并比较SHA（只适用于确认的DELETE模式）。若实际是WAL或不能确认，停并修订备份步骤，不只复制一个活动WAL主文件；失败恢复旧API健康后停止。
15. 【恢复旧API】留底成功后恢复旧API，确认8790=200；此时town入口与实时开关保持关闭，独立库尚未启用。失败停止，不继续发布。
16. 【标准正式发布，P1】A在同一干净集成树再次确认`git status --porcelain --untracked-files=all`退出0且输出为空、无被忽略敏感/依赖文件混入包，执行一次`./deploy/publish.ps1 -Environment production -ApprovedProduction`。仅最终批准后允许此命令；使用既有安装/测试/切current/重启/自检及自动回退。失败核对真实current/健康，不能仅凭脚本名称宣称回退成功。
17. 【新API关闭态】确认NEW及8790健康，入口/实时关闭。新API不打开town库，旧主库town表未迁移/未删除。代码/版本/开关依据缺失停止，禁止读env找值。
18. 【独立库初始化，P2】在新建受控目录运行`CHUAMAY_ENV=production node server/town-isolated.mjs --initialize-empty /var/lib/chuamay/production/town/town.sqlite`；只接受固定成功码，确认WAL/schema v3/no users。已存在即停，不删库再跑，不从staging复制测试资料。保留旧主库表；需要导入旧真实town资料时先停另定方案。
19. 【实时落点，P3】从核准NEW逐文件复制实时所需普通源码/JSON与依赖清单到RT，逐项核SHA，不复制数据库、env或第二API；RT目标已存在即停。RT/server/node_modules只一级指向NEW/server/node_modules真实目录，禁止指向current或旧release链，NEW在服务存续期间保留。
20. 【依赖，P3】核对锁定ws版本及既有npm路径，只在RT/server/town-realtime按独立lock执行已获批安装命令；API依赖由标准发布安装，不手工另装；失败不启动，不添加系统软件或输出原始敏感诊断。先做模块只加载验证，不能把它当成完整ABI/数据库证明。
21. 【座位/审核池，P3】两份均不在标准包中，按独占上传协议放到RT受控文件；SHA由A执行时与最终批准字节核对。座位非TEST、town20/chuamay16；池version1/reviewed true/至少7个/ID稳定且唯一，SHA正确；缺审读记录或字节不符停止。
22. 【专属配置，P2/P3】独占创建本次非敏感production-town.conf及API专属EnvironmentFile drop-in；先两开关为0，TOWN_DB_PATH只指独立库，池/席位为RT不可变路径；不改既有env或账号配置，不复制密钥。已有文件即停核查，不覆盖。首次新建逐个记标记，失败只撤回本次文件。
23. 【unit，P3】候选unit默认关，覆盖WorkingDirectory/ExecStart为RT不可变目录；确认资源值、回环8794、仅独立库目录可写、主库/原API env不可见，无API Requires/PartOf。已有同名unit或实例停并报审，不覆盖/停止未知进程；daemon-reload失败不继续。
24. 【先开实时后开入口，P2/P3】入口仍0；将专属实时开关设1，按批准步骤重启API及启动RT。分别核对8790/8794=200、systemd资源属性和回环监听；缺审核池/库/配置时必须关闭多人并停止候选，不尝试放宽代码检查。
25. 【本机票据回环，P5】使用一个明确批准的合成访客，经真实API取票据，再以正式合法Origin连接回环RT、enter town/chuamay、收到snapshot；只记录固定PASS/FAIL，绝不记录ticket/cookie/快照正文。失败停RT、关实时、走API回退，不应用Nginx。
26. 【配置替换前复核】五配置原SHA、备份SHA、四站健康码必须仍匹配；候选文件各SHA/属主/路径核对通过，才准备替换。任何第三种SHA视为并行变更，停，不能拿旧备份覆盖别人。
27. 【成组替换，P4】按R4同目录临时普通文件（目标完全不存在、硬链接数1）、保留权限、写候选、验SHA、mv原子替换方式，逐个仅替换h5/miniapp/main三文件；在三份全部就位并验证前绝不reload。任一步失败按已替换列表恢复本轮文件，不继续凑齐其他配置；api/staging全程原字节。
28. 【只检查】`docker exec <已确认NG> nginx -t`；只记录退出码与固定分类结果。不通过：还原本轮已替换文件、再检查，不reload，停RT并关闭实时，进入回退。
29. 【最终reload闸门】三候选SHA正确、api/staging SHA不变、四站健康码等于基线、nginx -t通过，才记录RELOAD_ATTEMPTED=1并执行一次`docker exec <NG> nginx -s reload`；不restart/stop共用容器。
30. 【reload后】立即复查五SHA与四站状态码；任何不符转回退。正常后才让h5/miniapp匿名WS各完成升级、再因无票据拒绝（不能把401/403/429/502当升级通过）；全程不获取访问密码、不改Cloudflare/Caddy/TLS。
31. 【浏览器接线验收，P5】在核准正式候选页面验证跨域CSRF/票据include+CORS、登录/游客、单人→快照多人、两客户端同房、争座、断线/后台恢复；API/WS单独200不能代替。入口flag读取、visibilitychange接线、越南语呈现均须C/A实际验收，本模块准备不证明页面已接。
32. 【限流/容量验收，P5】在批准窗口仅用约定合成数量验证按来源20条限制和全服拒绝回单人；120全量负载未获明确许可不做。不要因拒绝而弹中文、显示原错误或自动改worker_connections/限流。
33. 【入口开放，P2】前面全部通过且用户同意开放时才入口flag=1并按流程重启API/刷新页面配置；首发只外景与主殿。入口隐藏和实时关闭分别验证，页面未接线不得对用户宣称开放完成。
34. 【配置回退准备，P4/P5】停止后续动作；先验证备份旧SHA、当前三文件只可能是本次候选或旧版、api/staging未变。出现第三版本即停止写入并报告，不能覆盖并发变更。
35. 【还原配置】仅恢复本次已替换的h5/miniapp/main普通文件，复用独占临时文件+SHA校验+原子mv；逐项检查退出码。尚未尝试reload时，不管恢复检查是否通过都不reload；已尝试时仅恢复nginx -t通过才执行一次reload。失败停止、报告，禁止循环或重启共用容器。
36. 【停实时/关入口】仅停本轮启动的RT实例并确认8794无监听，恢复本次专属开关至0；页面回单人/隐藏入口。备份、旧/新库、所有release保留；不DROP、不覆盖数据、不清理依赖源。
37. 【API回退，P1/P5】Nginx处理完成或从未替换时，停止本轮API，移出仅本轮创建的专属drop-in/配置到独占备份位置（不读原env），current只能在NEW/PREV间回到PREV；第三目标停止。daemon-reload后重启旧API，复查8790和四站健康码，不把独立库复制覆盖主库。
38. 【失败升级】任一恢复失败则保留当前可用进程、RT停态和证据，报告A/Claude/用户未恢复环节；不自行修改正式账号、白名单、其他系统、主机软件或DNS。shared Nginx继续运行，禁止为修复而stop/restart它。
39. 【完成证据】只有所有获批步骤通过才记录最终提交、审核池/席位SHA、实际依赖版本、配置前后SHA、nginx -t/reload退出码、四站健康、回环与浏览器固定结果，区分本机/服务器/公网/真机。另记录备份保留/清理责任人及日期；没有就不能写隐私清理已落实。
40. 【停止】A提交实际情况给Claude；B不执行本清单。正式版清单必须纳入真实staging结果和本稿所有待核对项后再审批。未放行的一项仍是NOT_RUN，不能用完成代码准备代替上线许可。

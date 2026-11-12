# AI 3D 工具商用授权调研（第二轮停点）

- 核查日期：2026-11-07
- 范围：Tripo Studio、Meshy、Tencent Hunyuan3D 2.1
- 用途：仅为 Cloud Temple 3D 技术小样选择生成工具；尚未生成、下载或使用任何 AI 3D 资产。
- 方法：以官方服务条款、官方定价/帮助中心、官方 GitHub 许可证为准。宣传页和条款冲突时，以条款为控制文件并把冲突列为风险。
- 说明：这是工程侧许可筛查，不是法律意见。正式商用前仍应保存生成当日的条款快照、付费凭证和资产生成记录。

## 先看结论

1. **首选：Tripo 付费方案 + Private 模式。** 官方定价明确把付费私有模型列为可商用、用户拥有输出；条款称付费用户通常拥有输入输出相关权利，且声明不会用输入输出训练 AI。风险是条款使用“generally have all rights”而非无条件转让，且免费层文案互相冲突，所以不能用免费层出正式资产。
2. **备选：Meshy 付费方案 + Private，且生成前书面退出训练。** 付费输出所有权表述比 Tripo 更直接，但当前条款允许使用非 Enterprise 用户的输入和输出训练，除非联系支持退出。另有客户名称/Logo 宣传权，需同时书面退出。
3. **暂不选 Hunyuan3D 2.1。** 本地自托管有隐私优势，腾讯也不主张输出权利；但许可证明确排除欧盟、英国、韩国，并禁止在这些地区使用、复制、分发或展示模型输出。Cloud Temple 是公网产品，无法保证资产不在这些地区展示，除非取得腾讯书面许可。

## 三层许可必须分开

| 工具 | SaaS 生成资产 | 开源代码 | 模型权重 |
|---|---|---|---|
| Tripo | 受 Tripo 用户条款与订阅层级约束；付费且设为 Private 才作为候选 | 未发现 Tripo Studio 服务端生成代码的开源许可；视为闭源服务 | 未发现与 Tripo Studio SaaS 输出对应、可自行部署的官方权重许可；不作开源假设 |
| Meshy | 受 Meshy Terms 与订阅层级约束；免费输出由 Meshy 持有并以 CC BY 4.0 授权，付费输出原则上归用户 | SaaS 本身闭源；条款列出的第三方组件许可不等于开放 Meshy 服务代码 | 未发现 Meshy 生成模型权重的官方开放许可；不作开源假设 |
| Hunyuan3D 2.1 | 本表评估的是官方 GitHub 自托管版本，不把在线 Studio/腾讯云服务条款与开源许可证混用 | 仓库代码被许可证定义为 Materials 的一部分，适用 Tencent Hunyuan 3D 2.1 Community License，并非 MIT/Apache | 权重同样适用 Tencent Hunyuan 3D 2.1 Community License；有地域、规模、用途和分发义务 |

## 详细对照

| 项目 | Tripo Studio | Meshy | Hunyuan3D 2.1（自托管） |
|---|---|---|---|
| 控制文件与日期 | Terms of User Agreement，更新于 2025-07-11；产品定价/许可页核查于 2026-11-07 | Terms of Service，更新于 2026-09-19；定价与免费层帮助页核查于 2026-11-07 | 官方 GitHub `LICENSE`，Hunyuan3D 2.1 Community License；AUP 标注最后修改 2024-11-05，2.1 仓库发布于 2025-06 |
| 生成资产所有权 | 条款：免费用户的输入、输出及相关 IP 权利由 Tripo 保留；付费用户“通常”拥有输入输出及其相关权利，但仍授予 Tripo 为提供服务所需的永久、不可撤销、全球、非独占使用/展示许可 | 条款：免费输出由 Meshy 持有，以 CC BY 4.0 提供；付费用户在法律允许范围内拥有输出。发布到 Community 后，3D 输出改为 CC0，其他上传内容为 CC BY-NC 4.0 | 腾讯明确“不主张用户生成 Output 的权利”；输出本身不被视为 Model Derivative。用户自行承担输出及后续使用风险 |
| 商用许可 | Terms 允许合法商业/非商业使用输出；当前定价页却把 Free 标为 Public Models / Non-Commercial，产品文档又称免费可署名商用，存在冲突。付费 Private 明确标为 Commercial Use | Free 可按 CC BY 4.0 署名商用；付费 Private 可完整商用。用户必须保证参考图和输入素材不侵权 | 在 Territory 内可依社区许可证商用；若在 2.1 发布日所有产品前一个月 MAU 超过 100 万，必须先获腾讯另行许可 |
| 免费层限制 | 200 credits/月；模型公开；当前定价页写 Non-Commercial；Tripo 保留免费输入输出全部权利。**不用于本项目正式资产** | 100 credits/月；仅 10 次 Meshy 6 Lite 下载；无 API；输出 CC BY 4.0，必须署名；模型公开 | 无 SaaS 免费层概念；自行承担 GPU、依赖与运维成本。形状约需 10GB VRAM、纹理约 21GB、合计约 29GB（官方仓库说明） |
| 付费层限制 | Private 才有明确商业使用与用户所有权；Pro 当前页面约 USD 20/月（页面同时显示年付/促销，实际结账价须当日确认）；账号不可共享，API/服务不得转售 | 付费 Private 输出原则上归用户；订阅功能/credits 随计划变化；不得转售服务、共享未授权账号或用输出训练与 Meshy 竞争的 AI | 不属于订阅。地域排除及 AUP 始终适用；若分发 Hunyuan Works/模型衍生物，需要附许可证、修改通知和 Notice；向第三方提供服务还有披露义务 |
| 输入/上传与训练 | 用户保证有权上传；付费用户授予服务所需使用/展示许可。条款明确“不使用 Inputs 和 Outputs 训练、验证、测试或改进任何 AI Technology” | 用户保证输入权利。**非 Enterprise 用户的 Input 和 Output 默认可被用于训练/验证/改进**，可邮件联系 `support@meshy.ai` 退出；Community 发布会产生更广、永久且可再许可的权利 | 本地运行时无需上传原画给第三方，这是隐私优势；但不得用 Hunyuan Materials 或输出改进其他 AI 模型（Hunyuan 派生模型除外） |
| 署名/披露 | 免费层产品文档要求 attribution，但控制文档与定价对免费商用存在冲突；付费 Private 未发现强制署名 | Free 的 CC BY 4.0 强制署名；付费 Private 未发现强制署名。帮助页“kindly ask”不等于条款义务 | 单独发布输出未写强制品牌署名；若分发 Hunyuan Works 必须附指定 Notice。AUP 要求公开发布机器生成信息/内容时明确标识为机器生成 |
| 地域/账号限制 | 至少 13 岁或当地最低数字同意年龄；每个平台同时只能有一个账号；服务可能并非所有地区可用，用户负责当地合规；未发现明确国家排除清单 | 至少 14 岁或当地最低同意年龄；账号限授权用户，禁止共享给未授权人员；本次核查未发现类似 Hunyuan 的明确地域排除 | Territory 为全球但**排除 EU、UK、South Korea**；在排除地区使用、复制、修改、分发或展示 Works、Output 或结果均未获许可 |
| 输出唯一性/侵权担保 | 不保证唯一、准确或不侵权；用户承担验证与第三方权利风险 | 不保证唯一、可版权保护或不侵权；不同用户可能得到相似/相同输出 | 按“原样”提供，不保证权属、不侵权或适用性；用户承担输出使用和分发风险 |
| 对 Cloud Temple 的主要风险 | 免费许可矛盾；付费条款的“generally”措辞及服务许可较宽。必须 Private、保存付费证据，并只上传自有原画 | 非 Enterprise 默认训练条款与原画保密目标冲突；Community 一旦发布会改变许可。必须 Private、退出训练、不要发布 Community | 公网资产会在 EU/UK/Korea 被展示，直接撞上地域限制；即使生成地点在 SEA 也不能解决输出展示限制 |
| 工程建议 | **可进入一次付费 Private 小样。** 在生成前截图计划页和 Private 状态，导出后记录 task ID、日期、输入哈希、文件哈希 | **仅在 Meshy 书面确认退出训练与宣传权后作为备选。** 全程 Private，不进入 Community | **停止在授权确认前使用。** 如仍想选，先向 `hunyuan3d@tencent.com` 说明全球公网用途并取得覆盖 EU/UK/Korea 的书面许可 |

## 条款冲突与未知项

### Tripo

- 当前 Pricing 页把免费层写为 “Public Models · Non-Commercial Use”；产品文档又写免费层可署名商用。控制条款则让 Tripo 保留免费层输入、输出和相关 IP。结论：**免费层不可作为 Cloud Temple 商用资产来源**。
- 付费用户条款使用 “generally have all rights”，不是无保留的权利转让表述。小样风险可接受；正式产品建议向 Tripo 支持确认“付费 Private 输出可永久用于公开网页和 Telegram Mini App，订阅终止后权利不受影响”。
- 未找到 Tripo 生成模型的独立开源代码或权重许可证；不可把 SaaS 输出权误写成模型开源。

### Meshy

- Terms 明确免费输出由 Meshy 拥有并用 CC BY 4.0 授权；部分 Docs 表格写 “User owns output”。以 Terms 为准。
- Pricing FAQ 声称未经同意不会训练；Terms 却允许对非 Enterprise 用户内容训练，除非联系支持退出。以 Terms 为准，生成前必须取得退出确认。
- Terms 默认允许 Meshy 使用客户名称、Logo 做客户展示，用户可书面终止；若使用应同步退出。

### Hunyuan3D 2.1

- 官方 README 称“Fully Open-Source Framework”，但实际代码、训练代码和权重均被许可证定义为 Materials，适用自定义 Community License；不能写成 OSI 意义上的无地域限制开源。
- 输出虽不被腾讯主张权利，但输出本身也受到 Territory 和使用规则约束。
- 本项目目前面向越南、泰国、柬埔寨不等于只在这些地区展示；公网 h5/miniapp 无法阻止 EU、UK、韩国用户访问。

## 进入生成前的最小确认

建议用户只批准下面其中一个选项：

1. **Tripo Pro/更高计划，Private 模式（推荐）**：仅生成一个访客和六类独立物件；大殿框架在本地搭建，不上传含佛像细节的图片；不发布到 Gallery；保存生成时条款与订阅证据。
2. **Meshy 付费 Private（备选）**：先取得客服书面确认：关闭输入/输出训练、关闭客户名称与 Logo 宣传；不发布 Community。
3. **Hunyuan3D 2.1**：仅在腾讯书面扩展 Territory、允许全球网页展示输出后再考虑。

在用户明确选择前，第二轮停止在这里，不生成资产。

## 官方来源

- Tripo Terms of User Agreement（2025-07-11）：https://www.tripo3d.ai/terms
- Tripo Pricing（当前计划与 Private/Commercial 标识）：https://www.tripo3d.ai/pricing
- Tripo Pricing & Credits（输出所有权与训练摘要）：https://www.tripo3d.ai/product-doc/getting-started/pricing-credits
- Meshy Terms of Service（2026-09-19）：https://www.meshy.ai/terms-of-use
- Meshy Pricing：https://www.meshy.ai/pricing
- Meshy Free Plan 官方帮助：https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan
- Tencent Hunyuan3D 2.1 官方仓库：https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- Tencent Hunyuan3D 2.1 Community License：https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE


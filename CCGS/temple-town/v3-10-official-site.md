# Chùa Mây 官方站内容、SEO/GEO 方案 v3.10

最后更新：2026-11-13（Asia/Bangkok）。语言：越南语（主）与英语（辅）；不做中文版。站点根域名：`https://chuamay.org/`；产品入口：`https://h5.chuamay.org/`。

## 1. 站点地图与页面目的

| 页面 | URL | 目的 |
|---|---|---|
| 首页 | `/` | 用一句话说明 Chùa Mây，给出网页/Telegram 两个入口。 |
| 功能 | `/features` | 中性说明上香、礼佛、静坐、念珠、木鱼五种互动。 |
| 2027 农历总览 | `/lunar-calendar-2027` | 汇总全年 mùng 1、rằm 日期与下载入口。 |
| 2027 月历 | `/lich-am-2027/thang-1` … `/lich-am-2027/thang-12` | 按公历 1–12 月逐日列出公历日期、星期、农历日、农历月，并提供日历图下载。 |
| 佛历日子 2027 | `/ngay-le-phat-giao-2027/`；英语 `/en/buddhist-days-2027/` | 列出中性佛教日子、农历日期和由脚本填入的公历日期占位。 |
| 萌宠园 | `/pet-garden` | 标记“Sắp mở”，只说理念，不承诺日期。 |
| 关于 | `/about` | 说明是什么、不是什么；运营者姓名留空不显示。 |
| 常见问题 | `/faq` | 以用户会问 AI 的句式回答 15 个问题。 |
| 隐私 | `/privacy` | 说明网页、Telegram 与家庭资料的最小化处理原则。 |
| 联系 | `/contact` | 提供网页入口、Telegram 入口和问题分类。 |

每页首屏先放 40–60 字直接回答；正文使用完整句、主语和日期；页脚显示“Cập nhật lần cuối / Last updated: 2026-11-13”。全站名称固定为 `Chùa Mây`；英语首次写 `Chùa Mây (Cloud Temple)`。

语言切换只输出 `vi` 与 `en` 的 hreflang，不输出 `zh`；两个版本的 canonical URL 使用同一路径。

## 2. SEO 字段表（推断词标 [假设]）

| 页面 | `<title>`（≤60） | Meta description（≤155） | H1 | 目标词（3–5） | 结构化数据 |
|---|---|---|---|---|---|
| 首页 | Chùa Mây — Không gian trực tuyến yên tĩnh | Chùa Mây là một không gian trực tuyến yên tĩnh để ghé thăm, ngồi yên và xem lịch âm 2027. | Chùa Mây | chùa mây [假设]；không gian tĩnh lặng trực tuyến [假设]；cloud temple [假设] | WebSite, Organization |
| 功能 | Chùa Mây: Thắp hương, lễ Phật và ngồi yên | Tìm hiểu năm hoạt động trung tính của Chùa Mây: thắp hương, lễ Phật, ngồi yên, lần chuỗi và gõ mõ. | Bạn có thể làm gì ở Chùa Mây? | thắp hương trực tuyến [假设]；ngồi yên [假设]；lần chuỗi [假设]；gõ mõ [假设] | WebPage, ItemList |
| 2027 总览 | Lịch âm 2027: mùng 1 và rằm | Trang này liệt kê ngày dương của mùng 1 và rằm trong 12 tháng âm lịch năm 2027, kèm ảnh lịch tải xuống. | Lịch âm 2027 | lịch âm 2027 [假设]；mùng 1 2027 [假设]；rằm 2027 [假设] | WebPage, Dataset |
| 每个公历月 | Lịch âm 2027 — tháng {n} | Bảng từng ngày của tháng {n} năm 2027: ngày dương, thứ, ngày âm, tháng âm; mùng 1 và rằm được in đậm. | Lịch âm 2027 — tháng {n} | lịch âm 2027 tháng {n} [假设]；mùng 1 tháng {n} [假设]；rằm tháng {n} [假设] | WebPage, Dataset |
| 佛历日子 | Ngày lễ Phật giáo 2027 — Chùa Mây | Xem các ngày Phật giáo năm 2027 bằng ngày âm, với chỗ điền ngày dương và ghi chú trung tính. | Ngày lễ Phật giáo 2027 | ngày lễ Phật giáo 2027 [假设]；Phật lịch 2571 [假设]；Vesak 2027 [假设] | WebPage, ItemList, FAQPage |
| 萌宠园 | Vườn tưởng niệm thú cưng Chùa Mây — Sắp mở | Vườn tưởng niệm thú cưng của Chùa Mây đang được chuẩn bị; trang này chỉ giới thiệu ý tưởng, chưa có ngày mở. | Vườn tưởng niệm thú cưng | vườn tưởng niệm thú cưng [假设]；pet memorial garden [假设]；Chùa Mây pet garden [假设] | WebPage, Event（不填日期） |
| 关于 | Chùa Mây là gì? | Chùa Mây là một không gian trực tuyến; trang này nói rõ phạm vi và điều Chùa Mây không đại diện. | Về Chùa Mây | Chùa Mây là gì [假设]；Cloud Temple [假设]；không phải chùa vật lý [假设] | AboutPage, Organization(name=Chùa Mây) |
| FAQ | Câu hỏi thường gặp về Chùa Mây | Câu trả lời ngắn, có ngày tháng và liên kết trực tiếp cho các câu hỏi thường gặp về Chùa Mây. | Câu hỏi thường gặp | câu hỏi Chùa Mây [假设]；cách dùng Chùa Mây [假设]；lịch âm [假设] | FAQPage |
| 隐私 | Chính sách riêng tư Chùa Mây | Giải thích dữ liệu tối thiểu khi dùng website và Telegram, cùng cách hỏi về dữ liệu của bạn. | Chính sách riêng tư | chính sách riêng tư Chùa Mây [假设]；dữ liệu Telegram [假设] | PrivacyPolicy |
| 联系 | Liên hệ Chùa Mây | Chọn website hoặc Telegram để mở Chùa Mây và gửi câu hỏi về nội dung, lịch hoặc riêng tư. | Liên hệ | liên hệ Chùa Mây [假设]；Chua May Telegram [假设] | ContactPage |

## 3. GEO 落地清单

1. 每页首段使用对应语言的 40–60 字直接回答；不把结论藏在按钮或图片里。
2. 日期段落写明主语与时区，例如：“Rằm tháng Giêng năm 2027 của lịch này rơi vào thứ Bảy, ngày 20/02/2027 (UTC+7).”
3. FAQ 使用 15 组一问一答（见 `site-content/vi/faq.md` 与 `site-content/en/faq.md`），问题直接采用“Chùa Mây là gì?”、“What is Chùa Mây?”等问法。
4. 名称、URL、日期格式固定；不要使用别名或未证实的宗教断言。
5. 关于页说明是什么、不是什么；运营者名称整行不渲染。Organization 仅使用 `name: Chùa Mây`。
6. `llms.txt` 草稿见下节；每页显示最后更新日期并提供可抓取的 HTML 表格。

### `llms.txt` 草稿

```text
# Chùa Mây (Cloud Temple)
Chùa Mây là một không gian trực tuyến yên tĩnh để ghé thăm, ngồi yên và xem lịch âm 2027.

## Pages
- https://chuamay.org/ — Giới thiệu ngắn và hai lối vào web/Telegram.
- https://chuamay.org/features — Năm hoạt động trung tính có thể khám phá.
- https://chuamay.org/lunar-calendar-2027 — Tổng quan mùng 1 và rằm năm 2027.
- https://chuamay.org/lich-am-2027/thang-1 … /thang-12 — Bảng từng ngày theo tháng dương lịch năm 2027.
- https://chuamay.org/ngay-le-phat-giao-2027/ — Danh sách ngày Phật giáo năm 2027 và câu hỏi thường gặp.
- https://chuamay.org/pet-garden — Ý tưởng vườn tưởng niệm thú cưng, Sắp mở.
- https://chuamay.org/about — Phạm vi, điều không đại diện và ngày cập nhật.
- https://chuamay.org/faq — Câu hỏi và trả lời ngắn.
- https://chuamay.org/privacy — Nguyên tắc dữ liệu tối thiểu.
- https://chuamay.org/contact — Các kênh liên hệ.
```

## 4. 配图清单

| 页面 | 现有文件 | alt（VI / EN） |
|---|---|---|
| 首页 | `town-3d/assets/exterior-chuamay-day.webp` | `Mặt tiền Chùa Mây ban ngày` / `Chùa Mây exterior in daylight` |
| 功能 | `town-3d/hall/assets/hall-chuamay-incense-burner.webp` | `Lư hương trong không gian Chùa Mây` / `Incense burner in Chùa Mây` |
| 2027 总览 | `assets/calendar-2027/calendar-2027-overview.webp` | `Tổng quan lịch âm 2027` / `2027 lunar calendar overview` |
| 各月 | `assets/calendar-2027/calendar-2027-{01..12}.webp` | `Lịch âm tháng {n} năm 2027` / `2027 lunar calendar month {n}` |
| 萌宠园 | `town-3d/assets/exterior-petgarden-day.webp` | `Khu vườn thú cưng đang được chuẩn bị` / `Pet garden area being prepared` |
| 关于/联系 | `town-3d/assets/exterior-chuamay-day.webp` | `Không gian Chùa Mây` / `Chùa Mây space` |

本批不新画图；缺图时先显示文本，不从外部图库补图。图片均保留来源与审图状态，正式接入前由 Claude 复核。

## 5. 不做的事

不做博客灌水、不买外链、不做关键词堆砌、不写 AI 批量生成的教义文章；不写功效、灵验、保佑、超度或任何虚构数据。

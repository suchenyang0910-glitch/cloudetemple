# Vietnamese lunar conversion source and validation boundary

The implementation in `lunar-hnd.mjs` is a JavaScript adaptation of the astronomical algorithm published by Hồ Ngọc Đức, fixed to UTC+7 for Vietnam. It calculates the new moon, solar longitude, month 11, and leap-month offset at runtime; commemorative dates are not hard-coded.

Reference algorithm: <https://www.informatik.uni-leipzig.de/~duc/amlich/calrules.html>

Automated fixtures cover:

- Tết (lunar 1/1), Vu Lan (lunar 15/7), and the UTC+7 Thanh minh solar term for 2026–2030;
- the review example lunar 12/3 in 2027;
- all 61 lunar-month starts in lunar years 2026–2030, including the leap fifth month of 2028;
- deterministic solar/lunar round trips, including leap-month handling.

The 61 month-start fixtures were independently checked on 6 November 2026 against the GMT+7 year tables published by Licham.edu.vn. Every regular month and the 2028 leap month matched. Round-trip tests remain internal-consistency checks only.

- <https://congan.nghean.gov.vn/van-hoa-giao-duc/202001/tai-sao-tet-viet-nam-va-trung-quoc-lech-nhau-1-ngay-888772/>
- <https://phatgiao.org.vn/trung-uong-giao-hoi-ban-hanh-thong-bach-ve-dai-le-vu-lan--bao-hieu-2023-d76753.html>
- <https://baoxuan.vov.vn/doi-song/tiet-thanh-minh-2026-nen-tao-mo-vao-ngay-nao-nhung-luu-y-khi-di-tao-mo-post1277838.vov>
- <https://licham.edu.vn/lich-van-nien> and the year tables `/lich-am-nam-2026` through `/lich-am-nam-2030`

Implementation boundary: this repository independently implements the public astronomical calculation rules; it does not copy Hồ Ngọc Đức's hosted UI or source code. The product owner reviewed this boundary and accepted the residual licensing risk as low. This is no longer a production blocker.

2030 boundary: the implementation returns 2 February 2030 for Vietnamese lunar New Year. Nhân Dân's report of the State Calendar Board confirms that Vietnam uses UTC+7 and that the Vietnamese New Year in 2030 occurs one day before China's. The date is also independently listed as 2 February by mainstream Vietnamese calendar tables. The former 2030 discrepancy is resolved and is no longer a production blocker.

- Nhân Dân / Ban Lịch Nhà nước: <https://nhandan.vn/chung-quanh-thong-tin-ve-ngay-am-lich-khac-nhau-tren-mot-so-loai-lich-post489744.html>
- Licham.edu.vn 2030 table: <https://licham.edu.vn/lich-am-nam-2030>
- Tuổi Trẻ explanation of the 2030 UTC+7 boundary: <https://tuoitre.vn/viet-nam-8-nam-lien-don-giao-thua-vao-29-tet-chuoi-dai-nhat-trong-3-the-ky-20250124183621189.htm>

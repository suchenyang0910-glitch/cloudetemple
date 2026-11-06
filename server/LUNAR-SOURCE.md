# Vietnamese lunar conversion source and validation boundary

The implementation in `lunar-hnd.mjs` is a JavaScript adaptation of the astronomical algorithm published by Hồ Ngọc Đức, fixed to UTC+7 for Vietnam. It calculates the new moon, solar longitude, month 11, and leap-month offset at runtime; commemorative dates are not hard-coded.

Reference algorithm: <https://www.informatik.uni-leipzig.de/~duc/amlich/calrules.html>

Automated fixtures cover:

- Tết (lunar 1/1), Vu Lan (lunar 15/7), and the UTC+7 Thanh minh solar term for 2026–2030;
- the review example lunar 12/3 in 2027;
- deterministic solar/lunar round trips, including leap-month handling.

External checks used during review are limited to fixed examples: Tết 2026, Vu Lan 2026, Thanh minh 2026, and the reviewed lunar 12/3/2027 example. The 2027–2030 tables in tests are regression forecasts from this implementation, not independent evidence. Round-trip tests prove only internal consistency.

- <https://congan.nghean.gov.vn/van-hoa-giao-duc/202001/tai-sao-tet-viet-nam-va-trung-quoc-lech-nhau-1-ngay-888772/>
- <https://phatgiao.org.vn/trung-uong-giao-hoi-ban-hanh-thong-bach-ve-dai-le-vu-lan--bao-hieu-2023-d76753.html>
- <https://baoxuan.vov.vn/doi-song/tiet-thanh-minh-2026-nen-tao-mo-vao-ngay-nao-nhung-luu-y-khi-di-tao-mo-post1277838.vov>

License boundary: the source page publishes the calculation rules, but this review did not find a clear SPDX-style license grant for the original JavaScript implementation. This repository uses a compact implementation of the published astronomical formulas rather than copying the hosted UI. Legal/license approval is still required before a production release.

2030 boundary: Vietnamese and general-purpose published calendars can differ by one day because some calendars follow the China time-zone result. This implementation returns 2 February 2030 for Vietnam, but the conflict has not been independently resolved to the standard required for real reminders. Both this 2030 discrepancy and the license boundary block production release.

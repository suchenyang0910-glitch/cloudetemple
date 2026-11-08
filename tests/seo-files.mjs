import assert from "node:assert/strict";
import fs from "node:fs/promises";

const sitemap = await fs.readFile(new URL("../static/sitemap.xml", import.meta.url), "utf8");
const robots = await fs.readFile(new URL("../static/robots.txt", import.meta.url), "utf8");
assert(sitemap.includes("https://h5.chuamay.org/") && sitemap.includes("https://h5.chuamay.org/en/"));
assert(!sitemap.includes("huong-dan") && !sitemap.includes("cau-hoi-thuong-gap"));
assert(robots.includes("Sitemap: https://h5.chuamay.org/sitemap.xml"));
assert(!robots.includes("Disallow: /huong-dan") && !robots.includes("Disallow: /cau-hoi-thuong-gap"));
for (const route of ["huong-dan/thap-huong", "huong-dan/le-phat", "huong-dan/lan-chuoi", "huong-dan/go-mo", "huong-dan/ngoi-yen", "cau-hoi-thuong-gap"]) {
  for (const prefix of ["", "en/"]) {
    const html = await fs.readFile(new URL(`../static/${prefix}${route}/index.html`, import.meta.url), "utf8");
    assert(html.includes('name="robots" content="noindex,follow"'), `${prefix}${route} remains noindex`);
  }
}

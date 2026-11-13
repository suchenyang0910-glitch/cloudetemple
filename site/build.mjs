import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const contentDir = path.join(root, 'site-content');
const dist = path.join(site, 'dist');
const base = 'https://chuamay.org';
const updated = '2026-11-13';
// Set false to disallow the named AI crawlers without changing generated pages.
const allowAiCrawlers = true;

const pages = [
  {key: 'home', vi: '/', en: '/en/', viFile: 'vi-home.md', enFile: 'en-home.md', viTitle: 'Chùa Mây | Không gian tưởng niệm trực tuyến', enTitle: 'Chùa Mây | A quiet online memorial space', viDescription: 'Chùa Mây là không gian trực tuyến yên tĩnh để tưởng nhớ và xem lịch âm.', enDescription: 'Chùa Mây is a quiet online space for remembrance and the lunar calendar.', hero: true},
  {key: 'calendar', vi: '/lich-am-2027/', en: '/en/lunar-calendar-2027/', viFile: 'vi-calendar-2027.md', enFile: 'en-calendar-2027.md', viTitle: 'Lịch âm 2027 | Chùa Mây', enTitle: 'Lunar calendar 2027 | Chùa Mây', viDescription: 'Tổng quan lịch âm năm 2027 tại Chùa Mây.', enDescription: 'An overview of the 2027 lunar calendar at Chùa Mây.', lunar: true},
  {key: 'month-01', vi: '/lich-am-2027/thang-01/', en: '/en/lunar-calendar-2027/month-01/', viFile: 'vi-month-01.md', enFile: 'en-month-01.md', viTitle: 'Lịch âm tháng một 2027 | Chùa Mây', enTitle: 'Lunar calendar: month one, 2027 | Chùa Mây', viDescription: 'Trang lịch âm tháng một năm 2027 của Chùa Mây.', enDescription: 'Chùa Mây lunar calendar for month one of 2027.', lunar: true},
  {key: 'faq', vi: '/cau-hoi-thuong-gap/', en: '/en/faq/', viFile: 'vi-faq.md', enFile: 'en-faq.md', viTitle: 'Câu hỏi thường gặp | Chùa Mây', enTitle: 'Frequently asked questions | Chùa Mây', viDescription: 'Các câu hỏi thường gặp về Chùa Mây và cách mở ứng dụng.', enDescription: 'Frequently asked questions about Chùa Mây and opening the app.', faq: true},
  {key: 'about', vi: '/gioi-thieu/', en: '/en/about/', viFile: 'vi-about.md', enFile: 'en-about.md', viTitle: 'Giới thiệu | Chùa Mây', enTitle: 'About | Chùa Mây', viDescription: 'Chùa Mây là gì và không phải là gì.', enDescription: 'What Chùa Mây is, and what it is not.'}
];

const faq = {
  vi: [
    ['Chùa Mây là gì?', 'Đây là một không gian trực tuyến để xem lịch âm và tưởng nhớ một cách yên tĩnh.'],
    ['Tôi có thể mở Chùa Mây ở đâu?', 'Bạn có thể mở trên web hoặc trong Telegram qua các nút trên trang chủ.'],
    ['Trang này có yêu cầu đăng nhập không?', 'Bạn có thể đọc trang giới thiệu này mà không cần đăng nhập. Một số chức năng trong ứng dụng có thể yêu cầu xác minh danh tính.']
  ],
  en: [
    ['What is Chùa Mây?', 'It is an online space for the lunar calendar and quiet remembrance.'],
    ['Where can I open Chùa Mây?', 'You can open it on the web or in Telegram using the home-page links.'],
    ['Does this site require a sign-in?', 'You can read this introduction without signing in. Some app functions may require identity verification.']
  ]
};

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const absolute = pathname => `${base}${pathname}`;
const outputPath = pathname => pathname === '/' ? path.join(dist, 'index.html') : path.join(dist, pathname.replace(/^\//, ''), 'index.html');

function markdown(source) {
  const lines = source.replace(/\r/g, '').trim().split('\n');
  let html = '', list = false;
  const closeList = () => { if (list) { html += '</ul>'; list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line.startsWith('## ')) { closeList(); html += `<h2>${escape(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('### ')) { closeList(); html += `<h3>${escape(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('- ')) { if (!list) { html += '<ul>'; list = true; } html += `<li>${escape(line.slice(2))}</li>`; continue; }
    closeList();
    if (!line.startsWith('# ')) html += `<p>${escape(line)}</p>`;
  }
  closeList();
  return html;
}

async function content(file) {
  try { return markdown(await readFile(path.join(contentDir, file), 'utf8')); }
  catch { return '<p>Content is being prepared.</p>'; }
}

function breadcrumb(page, lang) {
  const current = lang === 'vi' ? page.vi : page.en;
  const home = lang === 'vi' ? '/' : '/en/';
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Chùa Mây', item: absolute(home)},
      {'@type': 'ListItem', position: 2, name: lang === 'vi' ? page.viTitle : page.enTitle, item: absolute(current)}
    ]
  };
}

function structuredData(page, lang) {
  const language = lang === 'vi' ? 'vi' : 'en';
  const pathname = lang === 'vi' ? page.vi : page.en;
  const data = [
    {'@context': 'https://schema.org', '@type': 'Organization', name: 'Chùa Mây', url: base},
    {'@context': 'https://schema.org', '@type': 'WebSite', name: 'Chùa Mây', url: base, inLanguage: ['vi', 'en'], dateModified: updated}
  ];
  if (page.key === 'home') data.push({'@context': 'https://schema.org', '@type': 'WebApplication', name: 'Chùa Mây', url: absolute(pathname), applicationCategory: 'LifestyleApplication', operatingSystem: 'Web', inLanguage: language, dateModified: updated});
  if (page.lunar) data.push(breadcrumb(page, lang));
  if (page.faq) data.push({'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq[lang].map(([name, text]) => ({'@type': 'Question', name, acceptedAnswer: {'@type': 'Answer', text}}))});
  return data;
}

function nav(lang, page) {
  const labels = lang === 'vi'
    ? [['/', 'Trang chủ'], ['/lich-am-2027/', 'Lịch âm 2027'], ['/cau-hoi-thuong-gap/', 'Hỏi đáp'], ['/gioi-thieu/', 'Giới thiệu']]
    : [['/en/', 'Home'], ['/en/lunar-calendar-2027/', 'Lunar calendar'], ['/en/faq/', 'FAQ'], ['/en/about/', 'About']];
  const here = lang === 'vi' ? page.vi : page.en;
  const other = lang === 'vi' ? page.en : page.vi;
  return `<header class="site-header"><a class="brand" href="${lang === 'vi' ? '/' : '/en/'}">Chùa Mây</a><nav aria-label="${lang === 'vi' ? 'Điều hướng chính' : 'Primary navigation'}">${labels.map(([href, label]) => `<a${href === here ? ' aria-current="page"' : ''} href="${href}">${label}</a>`).join('')}</nav><a class="language" lang="${lang === 'vi' ? 'en' : 'vi'}" href="${other}">${lang === 'vi' ? 'English' : 'Tiếng Việt'}</a></header>`;
}

function visibleCalendar(lang, page) {
  if (!page.lunar) return '';
  const home = lang === 'vi' ? '/lich-am-2027/' : '/en/lunar-calendar-2027/';
  const title = lang === 'vi' ? 'Các mốc cần xem' : 'Dates to consult';
  const first = lang === 'vi' ? 'Mùng một âm lịch' : 'First day of the lunar month';
  const fifteenth = lang === 'vi' ? 'Ngày rằm âm lịch' : 'Fifteenth day of the lunar month';
  const note = lang === 'vi' ? 'Xem lịch trong ứng dụng để biết ngày dương tương ứng.' : 'Open the app to see the corresponding Gregorian dates.';
  return `<section class="calendar-note" aria-labelledby="calendar-notes"><h2 id="calendar-notes">${title}</h2><table><thead><tr><th>${lang === 'vi' ? 'Mốc' : 'Date'}</th><th>${lang === 'vi' ? 'Ghi chú' : 'Note'}</th></tr></thead><tbody><tr><td>${first}</td><td>${note}</td></tr><tr><td>${fifteenth}</td><td>${note}</td></tr></tbody></table>${page.key === 'month-01' ? `<p><a href="${home}">${lang === 'vi' ? 'Xem tổng quan lịch âm 2027' : 'View the 2027 lunar-calendar overview'}</a></p>` : ''}</section>`;
}

function visibleFaq(lang, page) {
  if (!page.faq) return '';
  return `<section class="faq" aria-label="${lang === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently asked questions'}">${faq[lang].map(([question, answer]) => `<details open><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join('')}</section>`;
}

function hero(lang, page) {
  if (!page.hero) return '';
  const heading = lang === 'vi' ? 'Một nơi bình yên để trở về với ký ức.' : 'A quiet place to return to memory.';
  const text = lang === 'vi' ? 'Xem lịch âm, bước vào không gian tưởng niệm, hoặc mở Chùa Mây trong Telegram.' : 'View the lunar calendar, enter the remembrance space, or open Chùa Mây in Telegram.';
  return `<section class="hero"><div><p class="eyebrow">Chùa Mây</p><h1>${heading}</h1><p>${text}</p><div class="actions"><a class="button primary" href="https://h5.chuamay.org/">${lang === 'vi' ? 'Mở trên web' : 'Open on the web'}</a><a class="button" href="https://t.me/ChuaMayBot">${lang === 'vi' ? 'Mở trong Telegram' : 'Open in Telegram'}</a></div></div><img src="/assets/hero.webp" width="960" height="540" alt="${lang === 'vi' ? 'Sân chùa Việt Nam trong ánh sớm màu nước' : 'A Vietnamese temple courtyard in a watercolor dawn'}"></section>`;
}

function pageHtml(page, lang, body) {
  const other = lang === 'vi' ? 'en' : 'vi';
  const pathname = lang === 'vi' ? page.vi : page.en;
  const alternate = lang === 'vi' ? page.en : page.vi;
  const title = lang === 'vi' ? page.viTitle : page.enTitle;
  const description = lang === 'vi' ? page.viDescription : page.enDescription;
  const og = lang === 'vi' ? '/assets/og-vi.webp' : '/assets/og-en.webp';
  const h1 = page.hero ? '' : `<h1>${escape(title.replace(' | Chùa Mây', ''))}</h1>`;
  const schema = structuredData(page, lang).map(item => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="date" content="${updated}"><link rel="canonical" href="${absolute(pathname)}"><link rel="alternate" hreflang="vi" href="${absolute(page.vi)}"><link rel="alternate" hreflang="en" href="${absolute(page.en)}"><link rel="alternate" hreflang="x-default" href="${absolute(page.vi)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${absolute(pathname)}"><meta property="og:image" content="${absolute(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="${lang === 'vi' ? 'vi_VN' : 'en_US'}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${absolute(og)}"><link rel="stylesheet" href="/assets/site.css">${schema}</head><body>${nav(lang, page)}<main>${hero(lang, page)}<article${page.hero ? ' class="home-copy"' : ''}>${h1}${body}${visibleCalendar(lang, page)}${visibleFaq(lang, page)}</article></main><footer><p>Chùa Mây · <time datetime="${updated}">${lang === 'vi' ? 'Cập nhật lần cuối' : 'Last updated'}: ${updated}</time></p><a href="${alternate}" lang="${other}">${lang === 'vi' ? 'Read in English' : 'Đọc bằng tiếng Việt'}</a></footer></body></html>`;
}

async function write(relative, value) { const target = path.join(dist, relative); await mkdir(path.dirname(target), {recursive: true}); await writeFile(target, value); }
async function main() {
  await rm(dist, {recursive: true, force: true});
  await mkdir(path.join(dist, 'assets'), {recursive: true});
  await Promise.all([
    cp(path.join(site, 'site.css'), path.join(dist, 'assets', 'site.css')),
    cp(path.join(root, 'assets', 'fonts', 'BeVietnamPro-Regular.ttf'), path.join(dist, 'assets', 'BeVietnamPro-Regular.ttf')),
    cp(path.join(root, 'assets', 'processed-v1', 'mobile', 'scene-vn-courtyard-dawn.webp'), path.join(dist, 'assets', 'hero.webp')),
    cp(path.join(root, 'assets', 'share', 'og-share-vi.webp'), path.join(dist, 'assets', 'og-vi.webp')),
    cp(path.join(root, 'assets', 'share', 'og-share-en.webp'), path.join(dist, 'assets', 'og-en.webp'))
  ]);
  for (const page of pages) for (const lang of ['vi', 'en']) {
    const file = lang === 'vi' ? page.viFile : page.enFile;
    await write(outputPath(lang === 'vi' ? page.vi : page.en).replace(`${dist}${path.sep}`, ''), pageHtml(page, lang, await content(file)));
  }
  await write('404.html', `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Không tìm thấy trang | Chùa Mây</title><meta name="description" content="Trang được yêu cầu không có tại Chùa Mây."><meta name="robots" content="noindex"><link rel="canonical" href="${base}/404.html"><link rel="alternate" hreflang="vi" href="${base}/404.html"><link rel="alternate" hreflang="en" href="${base}/404.html"><link rel="alternate" hreflang="x-default" href="${base}/404.html"><meta property="og:type" content="website"><meta property="og:title" content="Không tìm thấy trang | Chùa Mây"><meta property="og:description" content="Trang được yêu cầu không có tại Chùa Mây."><meta property="og:image" content="${base}/assets/og-vi.webp"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/site.css"></head><body><main class="not-found"><h1>Không tìm thấy trang</h1><p>Trang bạn tìm không có ở đây.</p><p><a class="button primary" href="/">Về trang chủ</a></p><hr><h2 lang="en">Page not found</h2><p lang="en">The page you requested is not here.</p><p><a href="/en/">Go to the English home page</a></p></main></body></html>`);
  const ai = allowAiCrawlers ? 'GPTBot\nClaudeBot\nPerplexityBot\nGoogle-Extended' : 'GPTBot\nClaudeBot\nPerplexityBot\nGoogle-Extended';
  await write('robots.txt', `User-agent: *\nAllow: /\n\n${ai.split('\n').map(name => `User-agent: ${name}\n${allowAiCrawlers ? 'Allow' : 'Disallow'}: /`).join('\n\n')}\n\nSitemap: ${base}/sitemap.xml\n`);
  const urls = pages.flatMap(page => [['vi', page.vi], ['en', page.en]].map(([lang, pathname]) => `<url><loc>${absolute(pathname)}</loc><lastmod>${updated}</lastmod><xhtml:link rel="alternate" hreflang="vi" href="${absolute(page.vi)}"/><xhtml:link rel="alternate" hreflang="en" href="${absolute(page.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${absolute(page.vi)}"/></url>`));
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`);
  await write('llms.txt', `# Chùa Mây\n\nChùa Mây is a Vietnamese- and English-language static introduction to a quiet online space for remembrance and the lunar calendar.\n\n- Home: ${base}/\n- Lunar calendar 2027: ${base}/lich-am-2027/\n- FAQ: ${base}/cau-hoi-thuong-gap/\n- About: ${base}/gioi-thieu/\n\nThe site is readable without JavaScript. It links visitors to the Chùa Mây web application and Telegram bot for interactive features.\n`);
}
main();

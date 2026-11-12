import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url),html=await fs.readFile(new URL('lich-2027.html',root),'utf8'),app=await fs.readFile(new URL('calendar-2027.js',root),'utf8'),mainApp=await fs.readFile(new URL('app.js',root),'utf8'),preload=await fs.readFile(new URL('preload.js',root),'utf8');
assert(html.includes('Lịch 2027')&&html.includes('Cả năm')&&html.includes('Lưu ảnh')&&html.includes('Chia sẻ'));
assert(app.includes("now.getFullYear()<2027?1:now.getMonth()+1"),'before 2027 starts at January');
assert(app.includes("open(new URL(path(),location.href),'_blank','noopener')")&&app.includes('Nhấn giữ ảnh để lưu'),'Telegram opens original with long-press help');
assert(mainApp.includes('class="calendar-entry"')&&mainApp.includes('href="/lich-2027.html"'),'home calendar entry');
assert(!preload.includes('calendar-2027'),'home does not preload calendar images');
for(let month=1;month<=12;month++)await fs.access(new URL(`assets/calendar-2027/calendar-2027-${String(month).padStart(2,'0')}.webp`,root));
await fs.access(new URL('assets/calendar-2027/calendar-2027-overview.webp',root));
console.log(JSON.stringify({passed:true,assets:13}));

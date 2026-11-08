import assert from 'node:assert/strict';
import {getFestivalPeriod,createNewYearBell,hasForbiddenWord,readFlower,vnDay} from '../festival.js';

// 1. vnDay converts a UTC timestamp to Vietnam local date string (UTC+7)
{
  // 2027-01-30 00:00 UTC+7 = 2027-01-29 17:00:00 UTC
  const ts = Date.UTC(2027, 0, 29, 17, 0, 0);
  assert.equal(vnDay(ts), '2027-01-30');
}
{
  // 2027-02-05 23:59 UTC+7 = 2027-02-05 16:59:00 UTC — still Tất niên
  const ts = Date.UTC(2027, 1, 5, 16, 59, 0);
  assert.equal(vnDay(ts), '2027-02-05');
}
{
  // 2027-02-06 00:00 UTC+7 = 2027-02-05 17:00:00 UTC — Mùng 1
  const ts = Date.UTC(2027, 1, 5, 17, 0, 0);
  assert.equal(vnDay(ts), '2027-02-06');
}

// 2. getFestivalPeriod returns correct period or null
{
  const ongTao = Date.UTC(2027, 0, 29, 20, 0); // 2027-01-30 03:00 VN
  assert.equal(getFestivalPeriod(ongTao)?.id, 'ong-tao');
}
{
  const tatNien = Date.UTC(2027, 1, 5, 10, 0); // 2027-02-05 17:00 VN
  assert.equal(getFestivalPeriod(tatNien)?.id, 'tat-nien');
}
{
  const mung1 = Date.UTC(2027, 1, 5, 20, 0); // 2027-02-06 03:00 VN
  assert.equal(getFestivalPeriod(mung1)?.id, 'mung1');
}
{
  const ram = Date.UTC(2027, 1, 19, 20, 0); // 2027-02-20 03:00 VN
  assert.equal(getFestivalPeriod(ram)?.id, 'ram');
}
{
  const off = Date.UTC(2027, 0, 1, 10, 0); // 2027-01-01 — no festival
  assert.equal(getFestivalPeriod(off), null);
}

// 3. New Year bell — onBell fires for pre-midnight minutes, onNewYear at 00:00
{
  const bells = [], newYears = [];
  const nb = createNewYearBell({ onBell: c => bells.push(c), onNewYear: c => newYears.push(c) });
  assert.equal(nb.isArmed(), false);
  // arm() with no interaction does nothing
  nb.arm(false); assert.equal(nb.isArmed(), false);
  // arm() with interaction arms (timers won't fire since targets are ~2027; just verify arming)
  nb.arm(true); assert.equal(nb.isArmed(), true);
  // second arm() is a no-op
  nb.arm(true); assert.equal(nb.isArmed(), true);
  nb.disarm(); assert.equal(nb.isArmed(), false);
  assert.equal(bells.length, 0, 'no immediate bells (future timestamps)');
  assert.equal(newYears.length, 0, 'no immediate newYear (future timestamps)');
}

// 4. hasForbiddenWord detects all prohibited patterns
for (const [text, expected] of [
  ['Bình an cả năm', false],
  ['phù hộ cho gia đình', true],
  ['tích phước mỗi ngày', true],
  ['giải hạn đầu năm', true],
  ['保佑平安', true],
  ['积功德', true],
  ['消灾', true],
  ['祈福有效', true],
  ['Chùa Mây đồng hành', false],
  ['bảo hộ trọn đời', true],
  ['công đức', true],
  ['hòm công đức', true],
  ['功德箱', true],
  ['功德圆满', true],
]) {
  assert.equal(hasForbiddenWord(text), expected, `hasForbiddenWord('${text}')`);
}

// 5. readFlower returns 'hoa-mai' by default (no localStorage in Node)
assert.equal(readFlower(), 'hoa-mai', 'default flower');

// 6. Query preview is staging/local only; production hosts ignore it.
globalThis.location={hostname:'staging.chuamay.org',search:'?festival-date=2027-02-06'};
assert.equal(getFestivalPeriod()?.id,'mung1');
globalThis.location={hostname:'localhost',search:'?festival-date=2027-02-20'};
assert.equal(getFestivalPeriod()?.id,'ram');
for(const hostname of ['h5.chuamay.org','miniapp.chuamay.org']){
  globalThis.location={hostname,search:'?festival-date=2027-02-06'};
  assert.notEqual(getFestivalPeriod()?.id,'mung1',`${hostname} ignores preview override`);
}
delete globalThis.location;

console.log('Festival Tết 2027: all assertions passed');

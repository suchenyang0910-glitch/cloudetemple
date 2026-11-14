import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {solarToLunar} from '../server/lunar-hnd.mjs';

export const range={start:'2026-11-01',end:'2028-02-29'};
const festivals=new Map([
  ['1/1',['Tết Nguyên Đán','Lunar New Year (Tết)']],['15/1',['Rằm tháng Giêng','First full moon of the year']],['8/2',['Ngày Phật xuất gia',"The Buddha's renunciation"]],['15/2',['Ngày Phật nhập Niết-bàn',"The Buddha's Parinirvana"]],['19/2',['Vía Bồ-tát Quán Thế Âm (19/2)','Avalokiteshvara observance (2nd month)']],['15/4',['Đại lễ Phật Đản',"Vesak (Buddha's birthday)"]],['19/6',['Vía Bồ-tát Quán Thế Âm (19/6)','Avalokiteshvara observance (6th month)']],['15/7',['Lễ Vu Lan','Vu Lan (Ullambana)']],['19/9',['Vía Bồ-tát Quán Thế Âm (19/9)','Avalokiteshvara observance (9th month)']],['15/10',['Rằm tháng Mười','Full moon of the 10th month']],['17/11',['Vía Phật A-di-đà','Amitabha observance']],['8/12',['Ngày Phật thành đạo',"The Buddha's enlightenment"]]
]);
const iso=date=>date.toISOString().slice(0,10);
const yearName=year=>{const stems=['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý'],branches=['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];return `${stems[(year+6)%10]} ${branches[(year+8)%12]}`;};
const ordinary=(date,lunar)=>({date,lunarDay:lunar.day,lunarMonth:lunar.month,leap:lunar.leap,type:'ordinary',nameVi:lunar.day===1?`Mùng 1 tháng ${lunar.month}`:`Rằm tháng ${lunar.month}`,nameEn:lunar.day===1?`1st day of lunar month ${lunar.month}`:`Full moon of lunar month ${lunar.month}`});
const festival=(date,lunar,names)=>({date,lunarDay:lunar.day,lunarMonth:lunar.month,leap:false,type:'festival',nameVi:names[0],nameEn:names[1]});

export function officialBuddhistData(){const start=new Date(`${range.start}T00:00:00Z`),end=new Date(`${range.end}T00:00:00Z`),days=[],lunarDates={};for(let date=new Date(start);date<=end;date.setUTCDate(date.getUTCDate()+1)){const value=iso(date),lunar=solarToLunar({day:date.getUTCDate(),month:date.getUTCMonth()+1,year:date.getUTCFullYear()}),key=`${lunar.day}/${lunar.month}`;lunarDates[value]={day:lunar.day,month:lunar.month,leap:lunar.leap,yearName:yearName(lunar.year)};if(lunar.day===1||lunar.day===15)days.push(ordinary(value,lunar));const names=!lunar.leap&&festivals.get(key);if(names)days.push(festival(value,lunar,names));}return {days,lunarDates};}
export function officialBuddhistDays(){return officialBuddhistData().days;}
export async function generateOfficialBuddhistDays(output){const data=officialBuddhistData();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(data,null,2)+'\n');return data;}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await generateOfficialBuddhistDays(path.join(root,'site','dist','assets','days.json'));}

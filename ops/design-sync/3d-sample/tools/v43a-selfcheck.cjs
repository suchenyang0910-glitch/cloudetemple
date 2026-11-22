// v43a 主殿自检（Claude 2026-11-21；11-22 加 5b 一人一座；11-22 下午改为直接量场景里的真实物体，不再信汇报钩子，需要同目录的 v43-measure.js；11-22 14:40 改为按 2 倍屏测、加坐下后的镜头、称呼牌统一 20 像素、改窗口尺寸后复测、主殿示意人物）。作者交付前自己跑，A 预核、D 验收也跑同一份。
// 用法：node v43a-selfcheck.cjs <src-v43 目录> <输出目录> [playwright 路径]
//   例：node v43a-selfcheck.cjs E:\cloudtemple-worktrees\codexc-town-nine\ops\design-sync\3d-sample\src-v43 E:\cloudtemple\ops\receipts\A-20261121-01\selfcheck C:/Users/Administrator/node_modules/playwright
// 自己起一个只监听 127.0.0.1 的静态服务，不联网、不改任何文件（只往输出目录写截图和 result.json）。
// 全部通过才退出码 0。任何一条 FAIL 都不要交付。
const http=require('http'),fs=require('fs'),path=require('path');
const src=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'./selfcheck-out');
const {chromium,devices}=require(process.argv[4]||'playwright');
const EXTRA=(process.env.SELFCHECK_ARGS||'').split(' ').filter(Boolean);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.css':'text/css'};
fs.mkdirSync(out,{recursive:true});
const R=[];const add=(name,ok,detail)=>{R.push({name,ok:!!ok,detail});console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''))};
(async()=>{
  const srv=http.createServer((q,s)=>{const f=path.join(src,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(src)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);s.end();return}s.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({args:EXTRA});
  const ctx=await b.newContext({...devices['iPhone 13'],deviceScaleFactor:2,viewport:{width:390,height:780}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto(base+'/test.html?tod=day');await p.waitForTimeout(5000);
  const S='window.__v43SeatData';
  const has=await p.evaluate(()=>!!(window.__ct&&window.__v43SeatData&&__v43SeatData.seatHooks));
  await p.evaluate(fs.readFileSync(path.join(__dirname,'v43-measure.js'),'utf8'));
  add('页面起来了，有 __ct 和座位钩子',has);if(!has){await b.close();srv.close();finish();return}
  await p.evaluate(()=>{__ct.enter(__ct.TEMPLE)});await p.waitForTimeout(2500);
  const shot=n=>p.screenshot({path:path.join(out,n+'.png')});
  const seats=()=>p.evaluate(()=>__v43SeatData.seatHooks.list(__ct.TEMPLE).map(s=>({id:s.id,kind:s.kind,x:s.x,z:s.z,yaw:s.yaw,occ:s.occupant?(s.occupant.name||s.occupant.id||String(s.occupant)):null})));
  const info=()=>p.evaluate(()=>{const i=__ct.renderer.info.render;return {tris:i.triangles,calls:i.calls}});
  const st=()=>p.evaluate(()=>({state:__ct.state(),x:+__ct.pos.x.toFixed(2),z:+__ct.pos.z.toFixed(2)}));
  const visText=()=>p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.children.length===0&&e.textContent.trim()).map(e=>e.textContent.trim()));
  const proj=(x,y,z)=>p.evaluate(([x,y,z])=>{const V=__ct.camera.position.constructor;const v=new V(x,y,z).project(__ct.camera);const r=__ct.renderer.domElement.getBoundingClientRect();return [(v.x+1)/2*r.width+r.left,(1-v.y)/2*r.height+r.top]},[x,y,z]);
  // 1 座位数量
  let L=await seats();const cnt=k=>L.filter(s=>s.kind===k).length;
  add('主殿座位 12 sit / 4 bow / 4 mo / 4 incense',cnt('sit')===12&&cnt('bow')===4&&cnt('mo')===4&&cnt('incense')===4,`sit ${cnt('sit')} bow ${cnt('bow')} mo ${cnt('mo')} incense ${cnt('incense')}`);
  add('默认没有任何占用者',L.every(s=>!s.occ),L.filter(s=>s.occ).map(s=>s.id).join(','));
  {const bad=L.filter(s=>['sit','bow','mo'].includes(s.kind)&&Math.cos(s.yaw)>-.7);add('所有可坐的位置都面朝佛像（yaw 在 π 左右，不能背对佛）',bad.length===0,bad.length?`背对或侧对的：${bad.slice(0,6).map(s=>s.id+'='+s.yaw).join(', ')}${bad.length>6?' …共 '+bad.length+' 个':''}`:'');
   const out=L.filter(s=>['sit','bow','mo'].includes(s.kind)&&!(s.z<=-2.6&&Math.abs(s.x)<=7.2));add('所有可坐的位置都在殿内（z ≤ −2.6 且 |x| ≤ 7.2；殿门格扇在 z=−2.2 一线）',out.length===0,out.map(s=>`${s.id}(${s.x},${s.z})`).join(' '));
   const cu=await p.evaluate(()=>__measure.cushions(__ct.TEMPLE,__v43SeatData.seats.temple));const off=cu.filter(c=>c.kind!=='incense'&&(c.modelY-c.floor<0||c.modelY-c.floor>.3));
   add('蒲团和木鱼放在所在位置的地面上（高出地面 0–0.3 米；注意 floorY 的参数顺序是 (z,x)）',cu.length>0&&off.length===0,cu.length?(off.length?`${off.length} 个不在地面上，例：${off.slice(0,4).map(c=>`${c.id} 模型高 ${c.modelY} 地面 ${c.floor}`).join('；')}`:''):'座位上没有 model')}
  // 2 殿内中央：界面文字
  await p.evaluate(()=>{__ct.tp(0,-1.2)});await p.waitForTimeout(2500);await shot('1-hall-center');
  let T=await visText();const cjk=T.filter(t=>/[\u4e00-\u9fff]/.test(t));
  add('界面上没有中文',cjk.length===0,cjk.slice(0,5).join(' / '));
  const spots=await p.evaluate(()=>[...document.querySelectorAll('.spot')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()));
  add('殿内同时出现的文字按钮不超过 2 个',spots.length<=2,spots.join(' / '));
  add('旧按钮 Thiền định / Lần tràng hạt 已去掉',!spots.some(t=>/Thiền định|Lần tràng hạt/.test(t)),spots.join(' / '));
  const empty=await info();
  // 3 自己的称呼牌：站着时也要有，贴在头顶，屏幕高 12–20 像素
  {const own=await p.evaluate(()=>__v43SeatData.ownName());const tg=(await p.evaluate(()=>__measure.tags())).filter(t=>t.self&&t.inFront);const me=await st();const head=await proj(me.x,(await p.evaluate(()=>__ct.pos.y))+1.75,me.z);
   if(tg.length!==1)add('站着时自己头顶有一块称呼牌（Sprite，userData.nameTag 和 userData.self 都为 true）',false,`找到 ${tg.length} 块`);
   else{const t=tg[0];add('站着时自己头顶有一块称呼牌，文字是自己的称呼，位置在头顶上方，屏幕高 20 像素（19–21，按 CSS 像素算，和屏幕倍率无关）',t.text===own&&Math.abs(t.cx-head[0])<=40&&head[1]-t.cy>=0&&head[1]-t.cy<=80&&t.px>=19&&t.px<=21,`文字 ${t.text}（应为 ${own}）；牌中心 (${t.cx},${t.cy}) 头顶 (${head[0].toFixed(0)},${head[1].toFixed(0)})；高 ${t.px}px`)}}
  // 4 点空蒲团 → 坐下 → 占用
  await p.evaluate(()=>{__ct.tp(4.2,-0.9)});await p.waitForTimeout(2500);await shot('2-right-wing');
  {const t=await visText();const c=t.filter(x=>/[\u4e00-\u9fff]/.test(x));add('靠近座位时界面上没有中文（按钮文字要越南语）',c.length===0,c.slice(0,5).join(' / '));const sp=await p.evaluate(()=>[...document.querySelectorAll('.spot')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()));add('靠近座位时文字按钮不超过 2 个',sp.length<=2,sp.join(' / '))}
  const target=(L.find(s=>s.id==='sit-L11')||L.filter(s=>s.kind==='sit')[0]);
  const xy=await proj(target.x,await p.evaluate(()=>__ct.pos.y)+.15,target.z);await p.touchscreen.tap(xy[0],xy[1]);
  let sat=null;for(let i=0;i<12&&!sat;i++){await p.waitForTimeout(1000);const s=await st();const l=await seats();if(s.state!=='free'&&l.find(q=>q.id===target.id).occ)sat={s,i}}
  await shot('3-seated');
  if(sat){const stags=(await p.evaluate(()=>__measure.tags())).filter(t=>t.self&&t.inFront);add('坐下后本人称呼牌实际可见且贴近头顶',stags.length===1&&stags[0].px>=19&&stags[0].px<=21&&stags[0].cy<600,stags.length?`牌 ${stags[0].text}；${stags[0].px}px；y=${stags[0].cy}`:'未找到可见本人牌')}
  add('点空蒲团 '+target.id+' → 12 秒内坐下且座位表出现占用',!!sat,sat?`第 ${sat.i+1} 秒，位置 (${sat.s.x},${sat.s.z})`:JSON.stringify(await st())+' 占用 '+((await seats()).find(q=>q.id===target.id).occ));
  if(sat){const s=sat.s;add('坐下的位置在该蒲团上（偏差≤0.5 米）',Math.hypot(s.x-target.x,s.z-target.z)<=.5,`人 (${s.x},${s.z}) 座位 (${target.x},${target.z})`)}
  if(sat){const av=await p.evaluate(()=>__measure.avatar());const dup=(await p.evaluate(()=>__measure.people(__ct.TEMPLE))).filter(q=>Math.hypot(q.x-target.x,q.z-target.z)<.5);
    add('自己坐下后看到的还是自己的形象（原来的人物模型保持可见、摆成坐姿），座位上不再另放一个替身',!!av&&av.visible&&dup.length===0,`自己的模型 ${av?(av.visible?'可见':'被隐藏'):'找不到'}；座位上的替身 ${dup.length} 个`)}
  if(sat){const c=await p.evaluate(()=>{const cam=__ct.camera,P=__ct.pos,r=__ct.renderer.domElement.getBoundingClientRect(),V=P.constructor;const pr=(x,y,z)=>{const v=new V(x,y,z).project(cam);return {x:(v.x+1)/2*r.width,y:(1-v.y)/2*r.height,front:v.z<1}};const fl=__ct.TEMPLE.floorY(P.z,P.x);return {dist:+cam.position.distanceTo(new V(P.x,fl+.8,P.z)).toFixed(2),up:+(cam.position.y-fl).toFixed(2),head:pr(P.x,fl+1.0,P.z),buddha:pr(0,fl+3.0,-9.6),W:r.width,H:r.height}});
    const okD=c.dist>=2.5&&c.dist<=5,okU=c.up>=1.5&&c.up<=3.2,okH=c.head.front&&c.head.y>=.45*c.H&&c.head.y<=.8*c.H&&c.head.x>=.1*c.W&&c.head.x<=.9*c.W,okB=c.buddha.front&&c.buddha.x>=0&&c.buddha.x<=c.W&&c.buddha.y>=0&&c.buddha.y<=.6*c.H;
    add('坐下后的镜头在殿内、贴近自己：离自己 2.5–5 米、高出地面 1.5–3.2 米，自己在画面中下部，佛像在画面上半部（不能退到殿外让屋顶挡住半个屏幕）',okD&&okU&&okH&&okB,`距离 ${c.dist}${okD?'':'✗'}；高 ${c.up}${okU?'':'✗'}；自己的头在屏幕 (${c.head.x.toFixed(0)},${c.head.y.toFixed(0)})${okH?'':'✗'}；佛像在屏幕 (${c.buddha.x.toFixed(0)},${c.buddha.y.toFixed(0)})${okB?'':'✗'}；屏幕 ${c.W}×${c.H}`)}
  // 5 起身 → 释放
  const up=await p.evaluate(()=>{const e=[...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e=>/Đứng/.test(e.textContent));if(e){e.click();return e.textContent.trim()}return null});await p.waitForTimeout(1500);
  const after=await st();L=await seats();
  add('点 "Đứng dậy" → 状态回到 free 且占用清空',!!up&&after.state==='free'&&L.every(s=>!s.occ),`按钮 ${up}；状态 ${after.state}；仍占用 ${L.filter(s=>s.occ).map(s=>s.id).join(',')}`);
  // 5b 一个人只能占一个座位（2026-11-22 加：用户真机上坐过的每个位置都留下一个自己）
  {const near=L.filter(s=>s.kind==='sit').sort((a,b)=>Math.hypot(a.x-4.2,a.z+.9)-Math.hypot(b.x-4.2,b.z+.9));
   const tapS=async s=>{const q=await proj(s.x,await p.evaluate(()=>__ct.pos.y)+.15,s.z);await p.touchscreen.tap(q[0],q[1]);await p.waitForTimeout(5000)};
   await p.evaluate(()=>{__ct.tp(4.2,-0.9)});await p.waitForTimeout(2000);
   await tapS(near[0]);const a1=(await seats()).filter(s=>s.occ);
   await tapS(near[1]);const a2=(await seats()).filter(s=>s.occ);await shot('3b-after-second-seat');
   add('坐着时再点另一个空座 → 自己最多只占一个座位（换座或不动都行，不能两个都占）',a1.length===1&&a2.length<=1,`第一次后占 ${a1.map(s=>s.id).join(',')}；第二次后占 ${a2.map(s=>s.id).join(',')}`);
   const ex=await p.evaluate(()=>{const e=[...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e=>/Ra ngoài/.test(e.textContent));if(e){e.click();return true}return false});await p.waitForTimeout(3000);
   await p.evaluate(()=>{if(__ct.world()!==__ct.TEMPLE)__ct.enter(__ct.TEMPLE)});await p.waitForTimeout(2500);
   const a3=(await seats()).filter(s=>s.occ);
   add('坐着时点 "Ra ngoài" 离开再回来 → 殿里没有留下自己',ex&&a3.length===0,`离开按钮 ${ex}；回来后仍占 ${a3.map(s=>s.id).join(',')}`);
   await p.evaluate(()=>{__v43SeatData.seatHooks.list(__ct.TEMPLE).filter(s=>s.occupant).forEach(s=>__v43SeatData.seatHooks.release(__ct.TEMPLE,s.id))});L=await seats()}
  // 6 放 15 个测试占用者
  const N=['Tâm An','Từ Hòa','Minh Đức','Diệu Liên','Quảng Tâm','Thiện Như','An Nhiên','Viên Thanh','Hải Minh','Phổ Tịnh','Giác Hạnh','Nhật Tâm','Vân Hòa','Bảo Liên','Khánh An'];
  await p.evaluate(N=>{const l=__v43SeatData.seatHooks.list(__ct.TEMPLE).filter(s=>['sit','bow','mo'].includes(s.kind));l.slice(0,15).forEach((s,i)=>__v43SeatData.seatHooks.occupy(__ct.TEMPLE,s.id,N[i]))},N);
  await p.evaluate(()=>{__ct.tp(0,-1.2)});await p.waitForTimeout(2600);await shot('4-full-center');
  const full=await info();L=await seats();const occ=L.filter(s=>s.occ);
  add('15 个测试占用者都记进座位表，称呼是传入的那个',occ.length===15&&occ.every(s=>N.includes(s.occ)),`占用 ${occ.length}；称呼样例 ${occ.slice(0,3).map(s=>s.occ).join(', ')}`);
  const dt=full.tris-empty.tris,dc=full.calls-empty.calls;
  const ppl=(await p.evaluate(()=>__measure.people(__ct.TEMPLE))).filter(q=>q.visible);
  add('15 个占用者各有一个坐姿人形（最外层物体 userData.seatedPerson），都在自己的座位附近',ppl.length===15&&occ.every(s=>ppl.some(q=>Math.hypot(q.x-s.x,q.z-s.z)<=.9)),`人形 ${ppl.length} 个`);
  add('每个人形 3000–12000 个三角形、不超过 3 个 Mesh（和自己的人物同一套模型；低于 3000 说明不是同一套）',ppl.length>0&&ppl.every(q=>q.tris>=3000&&q.tris<=12000&&q.meshes<=3),ppl.length?`三角形 ${Math.min(...ppl.map(q=>q.tris))}–${Math.max(...ppl.map(q=>q.tris))}；Mesh 数最多 ${Math.max(...ppl.map(q=>q.meshes))}`:'没有人形');
  add('人形坐在所在位置的地面上（不陷进地板、不悬空：高出地面 0–0.4 米）',ppl.length>0&&ppl.every(q=>q.y-q.floor>=-.01&&q.y-q.floor<=.4),ppl.filter(q=>q.y-q.floor<-.01||q.y-q.floor>.4).slice(0,3).map(q=>`(${q.x},${q.z}) 人形高 ${q.y} 地面 ${q.floor}`).join('；'));
  add('15 人增加的绘制指令不超过 62 条（每人：人形 3 条 + 称呼牌 1 条）',dc<=62,`实际 +${dc}；三角形 +${dt}`);
  const tg2=(await p.evaluate(()=>__measure.tags())).filter(t=>!t.self);const vis=tg2.filter(t=>t.inFront);
  add('15 个占用者各有一块称呼牌，文字是各自的称呼',tg2.length===15&&tg2.every(t=>N.includes(t.text))&&new Set(tg2.map(t=>t.text)).size===15,`称呼牌 ${tg2.length} 块；例 ${tg2.slice(0,3).map(t=>t.text).join(', ')}`);
  add('别人的称呼牌和自己的一样：屏幕高 20 像素（19–21，CSS 像素；用画布的 clientHeight 算，不要用 height）',vis.length>0&&vis.every(t=>t.px>=19&&t.px<=21),vis.length?`最小 ${Math.min(...vis.map(t=>t.px))}px 最大 ${Math.max(...vis.map(t=>t.px))}px`:'没有可见的牌');
  // 7 被占的座位点不了
  await p.evaluate(()=>{__ct.tp(-1.2,-2.2)});await p.waitForTimeout(2500);await shot('5-full-closeup');
  const taken=occ.find(s=>s.kind==='bow')||occ[0];const xy2=await proj(taken.x,await p.evaluate(()=>__ct.pos.y)+.15,taken.z);await p.touchscreen.tap(xy2[0],xy2[1]);await p.waitForTimeout(6000);
  const s2=await st();const l2=await seats();
  add('点被占的座位 '+taken.id+' → 不会坐上去，占用者不变',s2.state==='free'&&l2.find(q=>q.id===taken.id).occ===taken.occ,`状态 ${s2.state}；占用者 ${l2.find(q=>q.id===taken.id).occ}`);
  await p.evaluate(()=>{__ct.tp(-4.5,-0.9)});await p.waitForTimeout(2500);await shot('6-full-left-wing');
  await p.evaluate(()=>{__ct.tp(0,7)});await p.waitForTimeout(2500);await shot('7-yard-incense');
  T=await visText();const cjk2=T.filter(t=>/[\u4e00-\u9fff]/.test(t));add('院子里界面上没有中文',cjk2.length===0,cjk2.slice(0,5).join(' / '));
  // 8 改窗口尺寸后称呼牌仍是 20 像素
  await p.evaluate(()=>{__ct.tp(0,-1.2)});await p.setViewportSize({width:390,height:600});await p.waitForTimeout(2500);
  {const t=(await p.evaluate(()=>__measure.tags())).filter(t=>t.inFront);add('窗口高度从 780 改成 600 后，所有称呼牌仍是 20 像素（19–21）',t.length>0&&t.every(q=>q.px>=19&&q.px<=21),t.length?`最小 ${Math.min(...t.map(q=>q.px))}px 最大 ${Math.max(...t.map(q=>q.px))}px；${t.length} 块`:'没有牌')}
  await p.setViewportSize({width:390,height:780});await p.waitForTimeout(800);
  // 9 示意人物（"Xem thử"）：默认关；在小镇打开后，进主殿能看到带标注的示意人物；关掉后消失
  await p.evaluate(()=>{__v43SeatData.seatHooks.list(__ct.TEMPLE).filter(s=>s.occupant).forEach(s=>__v43SeatData.seatHooks.release(__ct.TEMPLE,s.id))});
  const demoClick=()=>p.evaluate(()=>{const e=[...document.querySelectorAll('button')].filter(e=>e.offsetParent).find(e=>/Xem thử|Tắt mô phỏng/.test(e.textContent));if(e){e.click();return e.textContent.trim()}return null});
  await p.evaluate(()=>{__ct.enter(__ct.TOWN)});await p.waitForTimeout(2500);const d1=await demoClick();await p.waitForTimeout(800);
  await p.evaluate(()=>{__ct.enter(__ct.TEMPLE)});await p.waitForTimeout(2500);await p.evaluate(()=>{__ct.tp(0,-1.2)});await p.waitForTimeout(1500);await shot('8-demo-hall');
  {const n=(await p.evaluate(()=>__measure.people(__ct.TEMPLE))).filter(q=>q.visible).length;const lab=await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.offsetParent&&e.children.length===0&&/không phải người thật/.test(e.textContent)).length);
   add('在小镇点 "Xem thử" 后进主殿：有 12–15 个示意人物坐在座位上，屏幕上有"không phải người thật"的标注',!!d1&&n>=12&&n<=15&&lab>=1,`按钮 ${d1}；示意人物 ${n} 个；标注 ${lab} 处`)}
  await p.evaluate(()=>{__ct.enter(__ct.TOWN)});await p.waitForTimeout(2000);const d2=await demoClick();await p.waitForTimeout(800);
  await p.evaluate(()=>{__ct.enter(__ct.TEMPLE)});await p.waitForTimeout(2500);
  {const n=(await p.evaluate(()=>__measure.people(__ct.TEMPLE))).filter(q=>q.visible).length;add('关掉示意后再进主殿：没有任何示意人物',!!d2&&n===0,`按钮 ${d2}；人形 ${n} 个`)}
  add('全程没有脚本报错',errs.length===0,errs.slice(0,3).join(' || '));
  await b.close();srv.close();finish();
  function finish(){const ok=R.every(r=>r.ok);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({when:new Date().toISOString(),src,ok,results:R},null,1));console.log('\n'+(ok?'全部通过':'未通过：'+R.filter(r=>!r.ok).length+' 条 FAIL')+'；截图和 result.json 在 '+out);process.exit(ok?0:1)}
})().catch(e=>{console.error('自检脚本自身出错：',e);process.exit(2)});

export const incenseConfig={startDelay:600,walkMs:1800,walkStartX:1060,standX:500,bowX:610,footY:1270,lightMs:2000,igniteAt:600,vaiCount:3,vaiCycleMs:2400,vaiStrikeAt:900,plantMs:1800,plantAt:700,autoGap:900,burnMs:60000,earlyMs:20000,standMinMs:3000,reducedHoldMs:800,reducedVaiMs:600};

export function incenseVisual(now,journey,reduced=false){
 const c=incenseConfig,elapsed=Math.max(0,now-journey.phaseStarted),phase=journey.phase;
 if(phase==='waiting')return {pose:'inc-walk-1',footX:c.walkStartX,footY:c.footY};
 if(phase==='walking'){
  const p=reduced?1:Math.min(1,elapsed/c.walkMs);
  return {pose:`inc-walk-${Math.floor(elapsed/260)%2+1}`,footX:c.walkStartX+(c.standX-c.walkStartX)*p,footY:c.footY};
 }
 if(phase==='lighting')return {pose:'inc-light',footX:c.standX,footY:c.footY};
 if(phase==='bowing'){
  const within=elapsed%(reduced?c.reducedVaiMs:c.vaiCycleMs),strike=reduced?c.reducedVaiMs*.45:c.vaiStrikeAt;
  return {pose:within>=strike&&within<strike+(reduced?180:650)?'inc-vai-2':'inc-vai-1',footX:c.bowX,footY:c.footY};
 }
 if(phase==='planting')return {pose:'inc-plant-1',footX:489,footY:1280};
 if(phase==='ready-vai')return {pose:'inc-hold',footX:c.bowX,footY:c.footY};
 return {pose:phase==='ready-light'||phase==='ready-plant'?'inc-hold':'inc-end',footX:c.standX,footY:c.footY};
}

export function incensePhaseDone(now,journey,reduced=false){
 const elapsed=now-journey.phaseStarted,c=incenseConfig;
 return journey.phase==='waiting'?elapsed>=c.startDelay:
  journey.phase==='walking'?elapsed>=(reduced?150:c.walkMs):
  journey.phase==='lighting'?elapsed>=(reduced?c.reducedHoldMs:c.lightMs):
  journey.phase==='bowing'?elapsed>=c.vaiCount*(reduced?c.reducedVaiMs:c.vaiCycleMs):
  journey.phase==='planting'?elapsed>=(reduced?c.reducedHoldMs:c.plantMs):false;
}

// Measure consecutive one-second windows; a hidden-tab gap must never count.
export function createFrameMonitor(onSlow){
  let start=null,frames=0,slowMs=0,prompted=false;
  return {
    reset(){start=null;frames=0;slowMs=0;},
    frame(now){
      if(start===null){start=now;return;}
      frames++;
      const elapsed=now-start;
      if(elapsed>=1000){
        slowMs=frames*1000/elapsed<20?slowMs+elapsed:0;
        if(!prompted&&slowMs>=5000){prompted=true;onSlow();}
        start=now;frames=0;
      }
    }
  };
}

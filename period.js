// Vietnam time (UTC+7) is independent of the visitor device timezone.
export function periodNow(date=new Date(),periods={dawn:"05:00-07:59",day:"08:00-16:59",dusk:"17:00-18:59",night:"19:00-04:59"}){
  const vietnam=new Date(date.getTime()+7*60*60*1000);
  const minute=vietnam.getUTCHours()*60+vietnam.getUTCMinutes();
  for(const [name,range] of Object.entries(periods)){
    const [start,end]=range.split('-').map(x=>{const [h,m]=x.split(':').map(Number);return h*60+m;});
    if(start<=end ? minute>=start&&minute<=end : minute>=start||minute<=end)return name;
  }
  return 'day';
}

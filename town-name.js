const prefix='/api/pet-garden/town';
export async function mountTownNames(root,{headers={}}={}){
  let csrf=null,candidateId=null,request=0;
  const status=root.querySelector('#name-status'),input=root.querySelector('input'),choices=root.querySelector('#name-choices'),form=root.querySelector('form'),refresh=root.querySelector('#name-refresh');
  const errors={name_rate:'Bạn chỉ có thể đổi tên 1 lần trong 7 ngày.',name_locked:'Tạm thời chỉ có thể chọn tên gợi ý.',name_characters:'Hãy dùng 2–20 chữ cái và dấu cách.',name_filtered:'Tên này chưa phù hợp. Vui lòng chọn tên khác.'};
  async function call(action,body={}){const r=await fetch(prefix+'/'+action,{method:'POST',credentials:'same-origin',headers:{...headers,'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(errors[data.error]||'Chưa lưu được. Vui lòng thử lại.');return data;}
  function render(data){choices.replaceChildren();for(const [i,row] of [data.preferred,...data.alternatives].entries()){const b=document.createElement('button');b.type='button';b.textContent=(i===0?'★ ':'')+row.name;b.onclick=()=>{candidateId=row.id;input.value=row.name;status.textContent='Chọn Lưu tên để xác nhận.';};choices.append(b);}}
  input.oninput=()=>{candidateId=null;};
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;try{const data=await call('name',candidateId===null?{name:input.value}:{candidateId});input.value=data.name;status.textContent='Đã lưu tên.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
  refresh.onclick=async()=>{const id=++request;refresh.disabled=true;try{const data=await call('choices');if(id===request)render(data);}catch(e){status.textContent=e.message;}finally{refresh.disabled=false;}};
  try{const r=await fetch(prefix+'/csrf',{credentials:'same-origin',headers});if(!r.ok)throw Error('Chưa mở được phần tên gọi.');csrf=(await r.json()).csrf;const data=await call('profile');input.value=data.name;render(data);status.textContent='Tên của bạn đã được lưu. Có thể chọn gợi ý hoặc tự nhập.';}catch(e){status.textContent=e.message;}
}
const root=document.getElementById('town-name');if(root)void mountTownNames(root);

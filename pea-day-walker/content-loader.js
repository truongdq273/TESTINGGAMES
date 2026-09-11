const LIMITS={questions:50,prompt:500,options:6,optionText:200};
export async function loadQuestionBank(sourceConfig={type:'json',url:'content.json'},{signal}={}){
  if((sourceConfig.type||'json')!=='json') throw new Error('Demo hiện chỉ hỗ trợ nguồn JSON.');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  if(signal) signal.addEventListener('abort',()=>controller.abort(),{once:true});
  try{
    const response=await fetch(sourceConfig.url,{signal:controller.signal,cache:'no-store'});
    if(!response.ok) throw new Error(`Không tải được dữ liệu (${response.status}).`);
    const raw=await response.json(); const questions=validate(raw);
    const canonical=JSON.stringify(questions); const bytes=new TextEncoder().encode(canonical);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const contentVersion=[...new Uint8Array(digest)].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
    return {schemaVersion:1,name:raw.name||'Bộ câu hỏi',contentVersion,fetchedAt:new Date().toISOString(),questions};
  }catch(e){ if(e.name==='AbortError') throw new Error('Nguồn dữ liệu phản hồi quá chậm.'); throw e; }
  finally{clearTimeout(timer)}
}
function validate(raw){
  if(raw?.schemaVersion!==1) throw new Error('schemaVersion phải bằng 1.');
  if(!Array.isArray(raw.questions)||!raw.questions.length) throw new Error('Danh sách câu hỏi đang trống.');
  if(raw.questions.length>LIMITS.questions) throw new Error(`Tối đa ${LIMITS.questions} câu hỏi.`);
  const ids=new Set();
  return raw.questions.map((q,i)=>{
    const pos=`Câu ${i+1}`;
    if(!q||typeof q.id!=='string'||!q.id.trim()||ids.has(q.id)) throw new Error(`${pos}: id thiếu hoặc bị trùng.`); ids.add(q.id);
    if(q.type!=='single-choice') throw new Error(`${pos}: chỉ hỗ trợ single-choice.`);
    if(typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>LIMITS.prompt) throw new Error(`${pos}: prompt không hợp lệ.`);
    if(!Array.isArray(q.options)||q.options.length<2||q.options.length>LIMITS.options) throw new Error(`${pos}: cần 2–${LIMITS.options} lựa chọn.`);
    const optionIds=new Set(); q.options.forEach(o=>{if(!o||typeof o.id!=='string'||optionIds.has(o.id)||typeof o.text!=='string'||!o.text.trim()||o.text.length>LIMITS.optionText) throw new Error(`${pos}: lựa chọn không hợp lệ.`); optionIds.add(o.id)});
    if(!optionIds.has(q.correctOptionId)) throw new Error(`${pos}: đáp án không khớp lựa chọn.`);
    const points=q.points??10; if(!Number.isFinite(points)||points<0) throw new Error(`${pos}: điểm không hợp lệ.`);
    return {...q,points};
  });
}
export function learnerQuestions(questions){return questions.map(({correctOptionId,...q})=>q)}

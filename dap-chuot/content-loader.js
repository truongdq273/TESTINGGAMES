const CONFIG='dap-chuot-source-v2';
const DOCUMENT='https://docs.google.com/document/d/17PWP2to6pRQjXNXLPh8nEitZeHh2T3GPxqJCHW7qwS4/edit';
export const sourceConfig=()=>JSON.parse(localStorage.getItem(CONFIG)||JSON.stringify({url:DOCUMENT,editUrl:DOCUMENT}));
export function saveSource(config){localStorage.setItem(CONFIG,JSON.stringify(config));}
export async function validateBank(raw){
 if(raw.schemaVersion!==1)throw Error('Phiên bản dữ liệu phải là 1.');
 if(!Array.isArray(raw.questions)||!raw.questions.length)throw Error('Chưa có bộ câu hỏi. Chủ nội dung cần thêm câu hỏi và đáp án trong trang quản trị.');
 if(raw.questions.length>100)throw Error('Tối đa 100 câu hỏi.');
 const ids=new Set();
 const questions=raw.questions.map((q,i)=>{
  const fail=t=>{throw Error(`Câu ${i+1}: ${t}`)};
  if(typeof q.id!=='string'||!q.id.trim()||ids.has(q.id))fail('ID trống hoặc trùng.');ids.add(q.id);
  if(q.type!=='single-choice')fail('chỉ hỗ trợ MCQ một đáp án.');
  if(typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>600)fail('nội dung phải có 1–600 ký tự.');
  if(!Array.isArray(q.options)||q.options.length<2||q.options.length>4)fail('cần 2–4 lựa chọn.');
  const opts=new Set();q.options.forEach(o=>{if(typeof o.id!=='string'||!o.id||opts.has(o.id)||typeof o.text!=='string'||!o.text.trim()||o.text.length>240)fail('lựa chọn trống, trùng ID hoặc quá dài.');opts.add(o.id)});
  if(!opts.has(q.correctOptionId))fail('đáp án không khớp lựa chọn.');
  if(q.points!==10)fail('game dùng 10 điểm mỗi câu đúng.');
  return {id:q.id,type:q.type,prompt:q.prompt,options:q.options.map(o=>({id:o.id,text:o.text})),correctOptionId:q.correctOptionId,points:10};
 });
 const normalized=JSON.stringify(questions);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
 return {schemaVersion:1,title:String(raw.title||'Đập chuột MCQ').slice(0,100),questions,contentVersion:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,12),fetchedAt:Number.isFinite(raw.sourceFetchedAt)?raw.sourceFetchedAt:Date.now()};
}
export async function loadQuestionBank(config,{signal}={}){
 const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),10000);
 const stop=()=>abort.abort();signal?.addEventListener('abort',stop,{once:true});
 try{
  if(config.url==='local-editor')return await validateBank(JSON.parse(localStorage.getItem('dap-chuot-bank-v1')||'{}'));
  let url=new URL(config.url,location.href);
  if(url.hostname==='docs.google.com'){
   const match=url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
   if(!match)throw Error('Cần link Google Docs dạng /document/d/MÃ_TÀI_LIỆU/edit.');
   url=new URL(`/api/google-doc?documentId=${encodeURIComponent(match[1])}`,location.origin);
  }
  if(url.protocol!=='https:'&&url.origin!==location.origin)throw Error('Nguồn ngoài phải dùng HTTPS.');
  let response;try{response=await fetch(url,{signal:abort.signal,cache:'no-cache'})}catch(e){throw Error(e.name==='AbortError'?'Hết thời gian tải dữ liệu.':'Không tải được nguồn: kiểm tra mạng, quyền đọc và CORS.')}
  if(!response.ok){let reason;try{reason=(await response.json()).error}catch{}throw Error(reason||(response.status===404?'Cần chạy python serve.py để đọc Google Docs. Có thể chọn bản đã tải để chơi offline.':`Nguồn trả về lỗi HTTP ${response.status}.`))}
  const body=await response.text();if(body.length>1000000)throw Error('Dữ liệu quá 1 MB.');
  let raw;try{raw=JSON.parse(body)}catch{throw Error('Nguồn cần trả về JSON hợp lệ, không phải trang xem tài liệu.')}
  return await validateBank(raw);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop)}
}

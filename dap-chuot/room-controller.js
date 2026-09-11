import {createTransport} from './transport.js';
const key=code=>`dap-chuot-authority-${code}`;
export function ranks(players){const sorted=[...players].sort((a,b)=>b.score-a.score||a.playerId.localeCompare(b.playerId));return sorted.map((p,i)=>({playerId:p.playerId,name:p.name,score:p.score,rank:sorted.findIndex(x=>x.score===p.score)+1}))}
export class TeacherRoom{
 constructor(code,id,onChange){this.code=code;this.id=id;this.onChange=onChange;this.bus=createTransport();this.bus.join(code,{playerId:id});this.state=JSON.parse(localStorage.getItem(key(code))||'null')||{roomCode:code,revision:0,roundId:crypto.randomUUID(),status:'lobby',players:[],bank:null};this.bus.onEvent(e=>this.receive(e));this.pulse=setInterval(()=>this.publish(false),1000);this.publish();}
 snapshot(playerId){const s=this.state;const me=s.players.find(p=>p.playerId===playerId);return {roomCode:s.roomCode,revision:s.revision,roundId:s.roundId,status:s.status,players:s.players.map(p=>({playerId:p.playerId,name:p.name,score:p.score,done:p.index,correct:p.correct,incorrect:p.incorrect})),leaderboard:ranks(s.players),total:s.bank?.questions.length||0,title:s.bank?.title||'',me:me?{...me}:null,question:s.status==='playing'&&me&&s.bank.questions[me.index]?(({id,type,prompt,options})=>({id,type,prompt,options}))(s.bank.questions[me.index]):null};}
 publish(save=true){if(save){this.state.revision++;localStorage.setItem(key(this.code),JSON.stringify(this.state));}this.state.players.forEach(p=>this.bus.send({type:'snapshot',roundId:this.state.roundId,recipientId:p.playerId,payload:this.snapshot(p.playerId)}));this.bus.send({type:'heartbeat',roundId:this.state.roundId,payload:{status:this.state.status}});this.onChange(this.state);}
 receive(e){const s=this.state;if(e.senderId===this.id)return;
  if(e.type==='join'){
   const existing=s.players.find(p=>p.playerId===e.senderId);
   if(!existing){if(s.players.length>=4||s.status==='ended'){this.bus.send({type:'joinError',recipientId:e.senderId,payload:{message:s.status==='ended'?'Vòng chơi đã kết thúc.':'Phòng đã đủ 4 bạn.'}});return}const name=String(e.payload.name||'').trim().slice(0,24);if(!name)return;s.players.push({playerId:e.senderId,name,score:0,index:0,correct:0,incorrect:0,results:{},pending:null})}this.publish();return;
  }
  const p=s.players.find(p=>p.playerId===e.senderId);if(!p||s.status!=='playing'||e.roundId!==s.roundId)return;
  if(e.type==='answerAttempt'){
   const q=s.bank.questions[p.index];if(!q||q.id!==e.payload.questionId)return;
   if(p.results[q.id]){this.publish(false);return}
   if(!q.options.some(o=>o.id===e.payload.answer))return;
   const correct=e.payload.answer===q.correctOptionId;p.score+=correct?10:0;p.correct+=correct?1:0;p.incorrect+=correct?0:1;
   const result={questionId:q.id,answer:e.payload.answer,isCorrect:correct,correctOptionId:q.correctOptionId,correctText:q.options.find(o=>o.id===q.correctOptionId).text,timeMs:Math.max(0,Math.min(Number(e.payload.timeMs)||0,86400000)),score:p.score,delta:correct?10:0};p.results[q.id]=result;p.pending=result;this.publish();
  }
  if(e.type==='advance'&&p.pending&&p.pending.questionId===e.payload.questionId){p.index++;p.pending=null;if(s.players.every(x=>x.index>=s.bank.questions.length))s.status='ended';this.publish();}
 }
 start(bank){if(!this.state.players.length)throw Error('Cần ít nhất 1 học sinh.');this.state.bank=structuredClone(bank);this.state.roundId=crypto.randomUUID();this.state.status='playing';this.state.players.forEach(p=>Object.assign(p,{score:0,index:0,correct:0,incorrect:0,results:{},pending:null}));this.publish();}
 end(){this.state.status='ended';this.publish()}
 lobby(){this.state.status='lobby';this.publish()}
 destroy(){clearInterval(this.pulse);this.bus.leave()}
}
export class StudentRoom{
 constructor(code,player,onSnapshot,onError,onPresence){this.code=code;this.player=player;this.onSnapshot=onSnapshot;this.onPresence=onPresence;this.bus=createTransport();this.bus.join(code,player);this.last=0;this.pendingAttempt=null;this.revision=-1;this.state=null;this.bus.onEvent(e=>{if(e.type==='joinError')onError(e.payload.message);if(e.type==='heartbeat'||e.type==='snapshot'){this.last=Date.now();onPresence(true)}if(e.type==='snapshot'&&e.payload.revision>=this.revision){this.revision=e.payload.revision;this.state=e.payload;if(this.pendingAttempt&&(this.state.status!=='playing'||this.state.roundId!==this.pendingAttempt.roundId||this.state.me?.pending||this.state.question?.id!==this.pendingAttempt.payload.questionId))this.pendingAttempt=null;onSnapshot(this.state)}});this.tick=setInterval(()=>{onPresence(Date.now()-this.last<3500);if(Date.now()-this.last>2000)this.join();else if(this.pendingAttempt)this.bus.send({type:'answerAttempt',...this.pendingAttempt})},1200);this.join();this.timeout=setTimeout(()=>{if(!this.state)onError('Chưa tìm thấy phòng. Kiểm tra mã và mở tab giáo viên trên cùng trình duyệt, cùng máy.')},5000);}
 join(){this.bus.send({type:'join',payload:{name:this.player.name}})}
 send(type,payload){if(Date.now()-this.last>=3500)return;if(type==='answerAttempt')this.pendingAttempt={roundId:this.state.roundId,payload};this.bus.send({type,roundId:this.state.roundId,payload})}
 destroy(){clearInterval(this.tick);clearTimeout(this.timeout);this.bus.leave()}
}

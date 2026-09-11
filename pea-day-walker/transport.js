const seen=new Set();
export function createTransport(){let roomCode='',handler=()=>{},bc=null,storageHandler=null;
  function join(code){leave();roomCode=code.toUpperCase();if('BroadcastChannel'in window){bc=new BroadcastChannel(`pea-room-${roomCode}`);bc.onmessage=e=>receive(e.data)}else{storageHandler=e=>{if(e.key===`pea-room-${roomCode}`&&e.newValue)receive(JSON.parse(e.newValue))};addEventListener('storage',storageHandler)}return api}
  function receive(event){if(!event||event.roomCode!==roomCode||seen.has(event.eventId))return;seen.add(event.eventId);if(seen.size>1000)seen.clear();handler(event)}
  function send(partial){const event={eventId:crypto.randomUUID(),roomCode,createdAt:Date.now(),roundId:null,senderId:null,recipientId:null,...partial};receive(event);if(bc)bc.postMessage(event);else localStorage.setItem(`pea-room-${roomCode}`,JSON.stringify(event));return event}
  function onEvent(fn){
    handler=fn;
    return function unsubscribe(){
      if(handler===fn) handler=function noop(){};
    };
  }
  function leave(){bc?.close();bc=null;if(storageHandler)removeEventListener('storage',storageHandler);storageHandler=null}
  const api={join,send,onEvent,leave};return api}
export function roomExists(code){const item=localStorage.getItem(`pea-snapshot-${code.toUpperCase()}`);if(!item)return false;try{const s=JSON.parse(item);return Date.now()-s.updatedAt<6*60*60*1000}catch{return false}}

// Same-browser demo transport. IT replaces this API with authenticated server transport.
export function createTransport(){
 let roomCode,player,channel,storageHandler;const listeners=new Set(),seen=new Set();
 const deliver=event=>{if(!event||event.roomCode!==roomCode||(event.recipientId&&event.recipientId!==player.playerId)||seen.has(event.eventId))return;seen.add(event.eventId);if(seen.size>3000)seen.delete(seen.values().next().value);listeners.forEach(h=>h(event))};
 return {
  join(code,p){this.leave();roomCode=code;player=p;const key=`dap-chuot-room-${code}`;if('BroadcastChannel' in window){channel=new BroadcastChannel(key);channel.onmessage=e=>deliver(e.data)}else{storageHandler=e=>{if(e.key===key&&e.newValue)deliver(JSON.parse(e.newValue))};addEventListener('storage',storageHandler)}},
  send(event){const envelope={...event,eventId:crypto.randomUUID(),roomCode,senderId:player.playerId};if(channel)channel.postMessage(envelope);else localStorage.setItem(`dap-chuot-room-${roomCode}`,JSON.stringify(envelope));deliver(envelope)},
  onEvent(handler){listeners.add(handler);return()=>listeners.delete(handler)},
  leave(){channel?.close();channel=null;if(storageHandler)removeEventListener('storage',storageHandler);storageHandler=null;seen.clear()}
 };
}

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_PLAYERS = 8;
const puzzles = [
  {title:'The Signal Array', desc:'Activate all four signal nodes. Each node must be held by a different explorer at the same time.', type:'nodes', required:4},
  {title:'The Cipher Vault', desc:'Work together: each explorer gets a piece of the secret sequence. Enter the complete four-digit code.', type:'cipher', required:4},
  {title:'The Final Lock', desc:'Charge the portal together. Every explorer must press READY to escape!', type:'ready'}
];
const send = (ws, msg) => { if(ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
const clean = v => String(v || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0,18) || 'Explorer';
const code = () => {let c;do {c=crypto.randomBytes(3).toString('hex').toUpperCase()} while(rooms.has(c));return c;};
function snapshot(room,viewer){const connected=[...room.players.values()].filter(p=>p.ws&&p.ws.readyState===WebSocket.OPEN);const viewerIndex=connected.findIndex(p=>p.id===viewer.id);const clue=[...room.secret].map((digit,i)=>i%Math.max(connected.length,1)===viewerIndex?`${i+1}: ${digit}`:null).filter(Boolean);return {type:'state',clue,needed:Math.min(4,connected.length),code:room.code,phase:room.phase,stage:room.stage,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,online:!!p.ws&&p.ws.readyState===WebSocket.OPEN,ready:room.ready.has(p.id)})),nodes:room.nodes,submitted:room.submitted,feedback:room.feedback,startedAt:room.startedAt,finishedAt:room.finishedAt,puzzle:puzzles[room.stage]||null};}
function broadcast(room){for(const p of room.players.values())send(p.ws,snapshot(room,p));}
function reset(room){room.phase='lobby';room.stage=0;room.nodes=[null,null,null,null];room.submitted=false;room.feedback='';room.ready.clear();room.startedAt=null;room.finishedAt=null;room.secret=String(1000+crypto.randomInt(9000));broadcast(room);}
function advance(room){room.feedback='';room.submitted=false;room.nodes=[null,null,null,null];room.ready.clear();room.stage++;if(room.stage>=puzzles.length){room.phase='won';room.finishedAt=Date.now();}broadcast(room);}
function detach(ws){const {roomCode,playerId}=ws; const room=rooms.get(roomCode);if(!room)return;const p=room.players.get(playerId);if(p&&p.ws===ws){p.ws=null;for(let i=0;i<4;i++)if(room.nodes[i]===playerId)room.nodes[i]=null;room.ready.delete(playerId);if(room.phase==='lobby')room.players.delete(playerId);if(room.players.size===0){rooms.delete(roomCode);return;}broadcast(room);}}
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost');}catch{return res.writeHead(400).end();}const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!['index.html','app.js','style.css'].includes(file))return res.writeHead(404).end('Not found');fs.readFile(path.join(__dirname,'public',file),(err,data)=>{if(err)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{ws.on('message',raw=>{if(raw.length>2048)return;let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m.type!=='string')return;
if(m.type==='join'){if(ws.roomCode)return;const target=String(m.code||'').trim().toUpperCase();let room;if(target){room=rooms.get(target);if(!room)return send(ws,{type:'error',message:'Room not found. Check the code.'});}else{const c=code();room={code:c,phase:'lobby',stage:0,players:new Map(),nodes:[null,null,null,null],ready:new Set(),submitted:false,feedback:'',secret:String(1000+crypto.randomInt(9000)),startedAt:null,finishedAt:null};rooms.set(c,room);}let p;const resume=String(m.token||'');if(resume){p=[...room.players.values()].find(p=>p.token===resume);}if(!p){if(room.phase!=='lobby')return send(ws,{type:'error',message:'Game already started. Ask the host to play again.'});if(room.players.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'Room is full.'});p={id:crypto.randomUUID(),token:crypto.randomBytes(16).toString('hex'),name:clean(m.name),ws:null};room.players.set(p.id,p);}if(p.ws&&p.ws!==ws){p.ws.roomCode=null;p.ws.close();}p.ws=ws;ws.roomCode=room.code;ws.playerId=p.id;send(ws,{type:'joined',code:room.code,id:p.id,token:p.token});broadcast(room);return;}
const room=rooms.get(ws.roomCode),p=room?.players.get(ws.playerId);if(!room||!p||p.ws!==ws)return;
if(m.type==='start'&&room.phase==='lobby'){if(room.players.size<2)return send(ws,{type:'error',message:'At least two explorers are required.'});room.phase='playing';room.startedAt=Date.now();broadcast(room);return;}
if(m.type==='restart'&&room.phase==='won'){reset(room);return;}
if(room.phase!=='playing')return;
if(m.type==='node'&&room.stage===0){const i=Number(m.index);if(!Number.isInteger(i)||i<0||i>3)return;const owner=room.nodes[i];if(owner===p.id)room.nodes[i]=null;else if(owner===null&&!room.nodes.includes(p.id))room.nodes[i]=p.id;broadcast(room);if(room.nodes.filter(Boolean).length>=Math.min(4,[...room.players.values()].filter(p=>p.ws&&p.ws.readyState===WebSocket.OPEN).length))advance(room);return;}
if(m.type==='cipher'&&room.stage===1){if(String(m.value||'').replace(/\D/g,'').slice(0,4)===room.secret){advance(room);}else{room.feedback='Not quite. Gather all four digit clues from your teammates.';broadcast(room);}return;}
if(m.type==='ready'&&room.stage===2){if(room.ready.has(p.id))room.ready.delete(p.id);else room.ready.add(p.id);broadcast(room);if([...room.players.values()].filter(p=>p.ws&&p.ws.readyState===WebSocket.OPEN).length>=2&&[...room.players.values()].every(p=>room.ready.has(p.id)))advance(room);return;}
});ws.on('close',()=>detach(ws));ws.on('error',()=>{});});
setInterval(()=>{for(const [c,r] of rooms){if(r.players.size===0||(r.finishedAt&&Date.now()-r.finishedAt>3600000))rooms.delete(c);}},600000).unref();
server.listen(PORT,()=>console.log(`Sync Escape listening on ${PORT}`));

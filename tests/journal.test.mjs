import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {journalAPI,validateJournal} from '../local/journal-api.mjs';
test('local journal: a saved entry survives a fresh read, conflicts and cross-site writes keep it intact',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-records-'));const dir=path.join(temp,'public'),file=path.join(dir,'journal.json');await fs.mkdir(dir);await fs.writeFile(file,'{"games":[],"cinema":[]}');
  const server=http.createServer((req,res)=>journalAPI(req,res,file,req.socket.localPort));
  try{await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
    const before=await fetch(origin),etag=before.headers.get('etag');await before.text();
    const data={games:[{id:'test',title:'Test',hours:'0'}],cinema:[]};
    const save=(data,originHeader,version)=>fetch(origin,{method:'PUT',headers:{Origin:originHeader,'Content-Type':'application/json','If-Match':version},body:JSON.stringify(data)});
    assert.equal((await save(data,'https://outside.example',etag)).status,403);
    const result=await save(data,origin,etag);assert.equal(result.status,200);assert.notEqual(result.headers.get('etag'),etag);
    assert.equal((await save({games:[],cinema:[]},origin,etag)).status,409);
    assert.deepEqual(await(await fetch(origin)).json(),data);assert.deepEqual(JSON.parse(await fs.readFile(file)),data);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith('portfolio-records-'))await fs.rm(temp,{recursive:true,force:true})}
});
test('journal allows title-only records, rejects invalid dates and unsafe image paths',()=>{
  const entry={id:'t',title:'Test'};
  const ok=e=>validateJournal({games:[],cinema:[e]});
  assert.equal(ok(entry),true);assert.equal(ok({...entry,date:'2025-02-29'}),false);
  assert.equal(ok({...entry,cover:'./assets/media/../../private.png'}),false);
  assert.equal(ok({...entry,cover:'https://other.example/poster.jpg'}),false);
  assert.equal(ok({...entry,rating:'6'}),false);
  assert.equal(ok({...entry,cover:'./assets/media/光影 01.webp',rating:'4'}),true);
});

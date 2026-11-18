import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPortfolioServer} from '../local/http-server.mjs';
import {localRequest} from '../local/access.mjs';
import {validateDocument} from '../local/manage-schema.mjs';
import {build} from '../scripts/build.mjs';
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-manager-'));const servers=[];try{await fs.cp(path.join(project,'public'),path.join(root,'public'),{recursive:true});const start=async publicOnly=>{const s=createPortfolioServer({root,publicOnly});servers.push(s);await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port};await run({root,start})}finally{for(const s of servers){s.closeAllConnections();await new Promise(r=>s.close(r))}if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('portfolio-manager-'))await fs.rm(root,{recursive:true,force:true})}}
test('local access rejects remote peers, proxy forwarding, rebinding hosts and cross-site requests',()=>{
  const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:4175'}};
  assert.equal(localRequest(req,4175),true);
  for(const change of [{socket:{remoteAddress:'192.168.1.2'}},{headers:{host:'evil.example:4175'}},{headers:{...req.headers,'x-forwarded-for':'127.0.0.1'}},{headers:{...req.headers,origin:'https://outside.example'}},{headers:{...req.headers,'sec-fetch-site':'same-site'}}])assert.equal(localRequest({...req,...change},4175),false);
});
test('manager persists every document, rejects forged writes, detects stale versions and restores backups',()=>fixture(async({root,start})=>{
  const origin=await start(false),boot=await(await fetch(origin+'/api/manage/bootstrap')).json();
  for(const [file,type] of [['magazine-editor.js','javascript'],['magazine-editor.css','text/css']]){const asset=await fetch(origin+'/manage/'+file,{redirect:'manual'});assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),new RegExp(type));await asset.text()}
  const headers={'Content-Type':'application/json',Origin:origin,'X-Local-Token':boot.token};
  const put=(k,doc,extra={})=>fetch(origin+'/api/manage/'+k,{method:'PUT',headers:{...headers,'If-Match':boot.versions[k],...extra},body:JSON.stringify(doc)});
  assert.equal((await put('site',boot.documents.site,{'X-Local-Token':'wrong'})).status,403);
  assert.equal((await put('site',boot.documents.site,{Origin:'https://outside.example'})).status,403);
  assert.equal((await fetch(origin+'/manage/',{headers:{'X-Forwarded-For':'127.0.0.1'}})).status,403);
  const revised={...boot.documents.site,heroTitle:'本地保存验证'};const saved=await put('site',revised);assert.equal(saved.status,200);const result=await saved.json();
  assert.equal((await put('site',boot.documents.site)).status,409);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'public/site.json'))).heroTitle,'本地保存验证');
  const restored=await fetch(origin+'/api/manage/site/restore',{method:'POST',headers:{...headers,'If-Match':result.version},body:'{}'});assert.equal(restored.status,200);assert.deepEqual((await restored.json()).document,boot.documents.site);
  boot.documents.journal.games.push({id:'rich-test',title:'Rich test',magazine:{version:1,preset:'folio',blocks:[{type:'textbox',width:45,wrap:'right',runs:[{text:'A formatted note',bold:true,color:'#53604a',size:24}]}]}});
  for(const kind of ['content','journal','writing']){const response=await put(kind,boot.documents[kind]);assert.equal(response.status,200);boot.versions[kind]=(await response.json()).version}
  assert.deepEqual((await(await fetch(origin+'/api/manage/bootstrap')).json()).documents.journal,boot.documents.journal);
  assert.equal((await put('content',{...boot.documents.content,photographs:[{id:'bad',title:'bad',src:'javascript:alert(1)'}]})).status,422);
  const edit=await(await fetch(origin+'/?edit=1')).text();assert.match(edit,/manage\/overlay.js/);assert.doesNotMatch(await(await fetch(origin+'/')).text(),/manage\/overlay.js/);
}));
test('binary uploads survive restart, reject disguised HTML and work in read-only deployment',()=>fixture(async({root,start})=>{
  const origin=await start(false),boot=await(await fetch(origin+'/api/manage/bootstrap')).json();const headers={'Content-Type':'application/octet-stream',Origin:origin,'X-Local-Token':boot.token};
  const upload=(name,body)=>fetch(origin+'/api/manage/upload?name='+encodeURIComponent(name),{method:'POST',headers,body});
  assert.equal((await upload('fake.png','<html><script>alert(1)</script></html>')).status,415);
  assert.equal((await upload('evil.svg','<svg/>')).status,415);
  assert.equal((await upload('../escape.jpg','fake')).status,415);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  const u=await upload('test.png',png);assert.equal(u.status,201);const asset=await u.json();assert.match(asset.src,/^\.\/assets\/media\/[-\w]+\.png$/);assert.deepEqual(await fs.readFile(path.join(root,'public',asset.src)),png);
  const content={...boot.documents.content,photographs:[{id:'uploaded',title:'测试图片',description:'<script>literal</script>',src:asset.src,category:'portrait',position:0}]};
  assert.equal((await fetch(origin+'/api/manage/content',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json','X-Local-Token':boot.token,'If-Match':boot.versions.content},body:JSON.stringify(content)})).status,200);
  await fs.writeFile(path.join(root,'public/writing.json'),JSON.stringify({articles:[{id:'private',title:'SECRET DRAFT',published:false,blocks:[],tags:[]}]}));
  await fs.mkdir(path.join(root,'dist/manage'),{recursive:true});await fs.writeFile(path.join(root,'dist/manage/leftover.js'),'private');await build(root);
  await assert.rejects(fs.access(path.join(root,'dist/manage/leftover.js')));await assert.rejects(fs.access(path.join(root,'dist/editor.html')));
  const publicOrigin=await start(true);
  for(const route of ['/manage/','/manage/manage.js','/manage/magazine-editor.js','/manage/magazine-editor.css','/api/manage/bootstrap','/api/journal','/editor.html','/journal-editor.js'])assert.equal((await fetch(publicOrigin+route)).status,404,route);
  assert.equal((await fetch(publicOrigin+'/content.json',{method:'PUT',body:'{}'})).status,405);
  assert.deepEqual(await(await fetch(publicOrigin+'/content.json')).json(),content);
  assert.doesNotMatch(await(await fetch(publicOrigin+'/?edit=1')).text(),/manage\/overlay.js/);
  assert.deepEqual(await(await fetch(publicOrigin+'/writing.json')).json(),{articles:[]});
  assert.equal((await fetch(publicOrigin+'/'+asset.src.slice(2))).status,200);
  const restarted=await start(false);assert.equal((await(await fetch(restarted+'/api/manage/bootstrap')).json()).documents.content.photographs[0].title,'测试图片');
}));
test('article image paths and site fields are constrained',()=>{
  const article={id:'a',title:'a',tags:[],blocks:[{type:'image',src:'https://outside.example/a.png'}]};assert.equal(validateDocument('writing',{articles:[article]}),false);
  article.blocks[0].src='./assets/media/test.png';assert.equal(validateDocument('writing',{articles:[article]}),true);
  assert.equal(validateDocument('site',{email:'x\n@evil'}),false);assert.equal(validateDocument('site',{portrait:'./assets/media/../../private.png'}),false);
});

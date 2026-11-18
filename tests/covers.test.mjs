import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCoverService} from '../local/cover-service.mjs';
import {allowedRemote,publicAddress,readRemote,CoverError} from '../local/cover-remote.mjs';
import {createPortfolioServer} from '../local/http-server.mjs';
import {validateJournal} from '../local/journal-api.mjs';
import {build} from '../scripts/build.mjs';
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const steamImage='https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/capsule.jpg';
const bgmImage='https://lain.bgm.tv/pic/cover/l/a/test.png';
const imdbImage='https://m.media-amazon.com/images/M/test.png';
function mockRead({fail,invalidImage=false,large=false}={}){
  const calls=[];
  const read=async(url,options)=>{
    calls.push({url,options});
    if(options.provider===fail)throw new CoverError('来源暂时限制访问。');
    if(options.image)return {bytes:large?Buffer.alloc(8*1024*1024+1):invalidImage?Buffer.from('<html>denied</html>'):png,type:'image/png',url};
    let value;
    if(options.provider==='steam')value=url.includes('appdetails')?{'620':{success:true,data:{header_image:steamImage.replace('capsule','header')}}}:{items:[{type:'app',id:620,name:'Portal 2',tiny_image:steamImage},{type:'bundle',id:1,name:'Bundle',tiny_image:steamImage},{type:'app',id:2,name:'Unsafe',tiny_image:'http://127.0.0.1/private.png'}]};
    if(options.provider==='bangumi')value={data:[{id:10038,type:4,name:'Portal',name_cn:'传送门',date:'2007-10-10',images:{large:bgmImage,common:bgmImage}},{id:12,type:2,name:'Animation',images:{large:bgmImage,common:bgmImage}}]};
    if(options.provider==='douban')value=[{id:'3541415',type:'movie',title:'盗梦空间',sub_title:'Inception',year:'2010',img:'https://img9.doubanio.com/view/photo/s_ratio_poster/public/test.png'},{id:'1',type:'book',title:'Book',img:'https://img9.doubanio.com/view/photo/s_ratio_poster/public/test.png'}];
    if(options.provider==='imdb')value={d:[{id:'tt1375666',qid:'movie',l:'Inception',y:2010,i:{imageUrl:imdbImage}},{id:'nm0000123',qid:'name',l:'Person',i:{imageUrl:imdbImage}},{id:'tt999',qid:'tvSeries',l:'TV',i:{imageUrl:imdbImage}}]};
    return {bytes:Buffer.from(JSON.stringify(value)),type:'application/json',url};
  };return {read,calls};
}
async function fixture(run){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-cover-'));const servers=[];
  try{await fs.cp(path.join(project,'public'),path.join(root,'public'),{recursive:true});const start=async(publicOnly=false,read=mockRead().read)=>{const server=createPortfolioServer({root,publicOnly,managementOptions:{covers:{read}}});servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port};await run({root,start})}
  finally{for(const server of servers){server.closeAllConnections();await new Promise(r=>server.close(r))}if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('portfolio-cover-'))await fs.rm(root,{recursive:true,force:true})}
}
test('remote covers only accept known HTTPS sources and public direct addresses',async()=>{
  assert.equal(allowedRemote(steamImage,'steam',true),true);
  for(const url of ['http://127.0.0.1/cover.png','https://m.media-amazon.com.evil.test/images/a.jpg','https://user:pass@m.media-amazon.com/images/a.jpg','https://m.media-amazon.com:444/images/a.jpg','https://169.254.169.254/latest/meta-data/']){
    assert.equal(allowedRemote(url,'imdb',true),false);
    await assert.rejects(readRemote(url,{provider:'imdb',image:true}),CoverError);
  }
  for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','100.64.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2002:7f00:1::','2001:db8::1','2001:0::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('search parses all providers, filters unrelated types and caches successful queries',()=>fixture(async({root})=>{
  const mock=mockRead(),service=createCoverService(root,{read:mock.read});
  const games=await service.search({kind:'games',query:'传送门'});assert.deepEqual(games.items.map(e=>e.provider),['steam','bangumi']);assert.equal(games.items[1].year,'2007');assert.match(games.items[0].preview,/^\/api\/manage\/covers\/preview\//);
  const before=mock.calls.length;assert.deepEqual(await service.search({kind:'games',query:'传送门'}),games);assert.equal(mock.calls.length,before);
  const films=await service.search({kind:'cinema',query:'盗梦空间'});assert.deepEqual(films.items.map(e=>e.provider),['douban','imdb']);assert.equal(films.items[0].year,'2010');
  assert.deepEqual(mock.calls.find(c=>c.options.provider==='bangumi').options.body.filter,{type:[4],nsfw:false});
}));
test('provider failure preserves other results and invalid queries never request a source',()=>fixture(async({root})=>{
  const mock=mockRead({fail:'douban'}),service=createCoverService(root,{read:mock.read});
  const result=await service.search({kind:'cinema',query:'Inception'});assert.equal(result.items.length,1);assert.equal(result.items[0].provider,'imdb');assert.equal(result.sources[0].ok,false);
  const before=mock.calls.length;
  for(const input of [{kind:'constructor',query:'x'},{kind:'__proto__',query:'x'},{kind:'games',query:''},{kind:'games',query:'a'.repeat(121)},{kind:'games',query:'x',provider:'imdb'}])await assert.rejects(service.search(input),e=>e.status===400);
  assert.equal(mock.calls.length,before);
}));
test('import writes local bytes and provenance, deduplicates and leaves journal unchanged',()=>fixture(async({root})=>{
  const mock=mockRead(),service=createCoverService(root,{read:mock.read});const before=await fs.readFile(path.join(root,'public/journal.json'));
  const result=await service.search({kind:'games',query:'Portal',provider:'steam'});const saved=await service.importCover({id:result.items[0].id});
  assert.match(saved.src,/^\.\/assets\/media\/cover-[a-f0-9]{64}\.png$/);assert.deepEqual(await fs.readFile(path.join(root,'public',saved.src)),png);assert.equal(saved.coverSource.url,'https://store.steampowered.com/app/620/');
  assert.equal((await service.importCover({id:result.items[0].id})).src,saved.src);assert.ok(mock.calls.some(c=>c.options.image&&c.url.includes('library_600x900')));
  assert.deepEqual(await fs.readFile(path.join(root,'public/journal.json')),before);
  assert.equal(validateJournal({games:[{id:'g',title:'Portal',cover:saved.src,coverSource:saved.coverSource}],cinema:[]}),true);
  for(const source of [{...saved.coverSource,url:'javascript:alert(1)'},{...saved.coverSource,provider:'constructor'},{...saved.coverSource,downloadedAt:'bad'}])assert.equal(validateJournal({games:[{id:'g',title:'g',cover:saved.src,coverSource:source}],cinema:[]}),false);
}));
test('Steam covers fall back to a store image when a portrait is unavailable',()=>fixture(async({root})=>{
  const mock=mockRead(),service=createCoverService(root,{read:async(url,options)=>{if(url.includes('library_600x900'))throw new CoverError('No portrait',404);return mock.read(url,options)}});
  const found=await service.search({kind:'games',query:'Portal',provider:'steam'});
  assert.deepEqual((await service.preview(found.items[0].id)).bytes,png);
  const saved=await service.importCover({id:found.items[0].id});assert.deepEqual(await fs.readFile(path.join(root,'public',saved.src)),png);
  assert.ok(mock.calls.some(c=>c.options.image&&c.url.includes('header')));
}));

test('invalid or oversized images fail without altering existing files',()=>fixture(async({root})=>{
  const before=await fs.readFile(path.join(root,'public/journal.json'));
  for(const settings of [{invalidImage:true},{large:true}]){
    const service=createCoverService(root,{read:mockRead(settings).read});const result=await service.search({kind:'cinema',query:'x',provider:'imdb'});
    await assert.rejects(service.importCover({id:result.items[0].id}),e=>[413,415].includes(e.status));
  }
  assert.deepEqual(await fs.readFile(path.join(root,'public/journal.json')),before);
}));
test('expired and evicted candidates recover through a fresh search',()=>fixture(async({root})=>{
  let now=Date.now(),partial=false;const mock=mockRead();const service=createCoverService(root,{now:()=>now,read:async(u,o)=>{if(partial&&o.provider==='steam')throw new CoverError('offline');return mock.read(u,o)}});
  const first=await service.search({kind:'games',query:'first'});now+=16*60*1000;await assert.rejects(service.preview(first.items[0].id),e=>e.status===410);
  const cached=await service.search({kind:'games',query:'cached'});partial=true;for(let i=0;i<202;i++)await service.search({kind:'games',query:'other'+i});partial=false;
  const refreshed=await service.search({kind:'games',query:'cached'});assert.notEqual(refreshed.items[0].id,cached.items[0].id);assert.deepEqual((await service.preview(refreshed.items[0].id)).bytes,png);
}));
test('HTTP cover operations require local token and origin; saved covers survive build and public mode is read-only',()=>fixture(async({root,start})=>{
  const origin=await start(),boot=await(await fetch(origin+'/api/manage/bootstrap')).json();
  const headers={Origin:origin,'Content-Type':'application/json','X-Local-Token':boot.token};
  const post=(operation,body,extra={})=>fetch(origin+'/api/manage/covers/'+operation,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
  const input={kind:'cinema',query:'盗梦空间'};
  assert.equal((await post('search',input,{'X-Local-Token':'invalid'})).status,403);assert.equal((await post('search',input,{Origin:'https://evil.example'})).status,403);assert.equal((await post('search',{kind:'constructor',query:'x'})).status,400);
  const result=await(await post('search',input)).json();assert.equal((await fetch(origin+result.items[0].preview)).status,200);assert.equal((await fetch(origin+result.items[0].preview,{headers:{'X-Forwarded-For':'127.0.0.1'}})).status,403);
  assert.equal((await post('import',{id:'unknown',url:'http://127.0.0.1/secret'})).status,410);
  const response=await post('import',{id:result.items[0].id});assert.equal(response.status,201);const saved=await response.json();
  const doc={...boot.documents.journal,cinema:[{id:'cover-test',title:'盗梦空间',cover:saved.src,coverSource:saved.coverSource}]};
  assert.equal((await fetch(origin+'/api/manage/journal',{method:'PUT',headers:{...headers,'If-Match':boot.versions.journal},body:JSON.stringify(doc)})).status,200);
  await build(root);const publicOrigin=await start(true);
  for(const route of ['/manage/cover-search.js','/api/manage/covers/search',result.items[0].preview])assert.equal((await fetch(publicOrigin+route)).status,404);
  assert.deepEqual(Buffer.from(await(await fetch(publicOrigin+'/'+saved.src.slice(2))).arrayBuffer()),png);
  assert.deepEqual(await(await fetch(publicOrigin+'/journal.json')).json(),doc);
}));

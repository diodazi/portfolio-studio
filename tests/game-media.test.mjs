import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGameMediaService,parseImageIndex,filteredIndexItems,mediaImageInfo} from '../local/game-media-service.mjs';
import {allowedGameMediaRemote,readGameMedia} from '../local/game-media-remote.mjs';
import {createPortfolioServer} from '../local/http-server.mjs';
import {validateShortReview,validateGameBook,createBookPage} from '../public/game-review-model.js';
import {validMediaSource} from '../public/media-source.js';
import sharp from 'sharp';
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const png=await sharp({create:{width:1,height:1,channels:4,background:{r:100,g:20,b:80,alpha:.5}}}).png().toBuffer();
const image='https://i0.hdslb.com/bfs/article/meme.png',page='https://www.bilibili.com/opus/123';
const index=items=>items.map(i=>'<a m="'+JSON.stringify({t:i.title,murl:i.image,purl:i.page}).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></a>').join('');
function mockRead({fail=false,badImage=false}={}){return async(url,options)=>{if(fail)throw Error('测试来源不可用');if(options.image)return {type:badImage?'text/html':'image/png',bytes:badImage?Buffer.from('<html>no</html>'):png};if(options.provider==='steam')return {bytes:Buffer.from(JSON.stringify({items:[{type:'app',id:620,name:'Portal 2'},{type:'bundle',id:1,name:'bundle'}]})),type:'application/json'};return {bytes:Buffer.from(url.includes('image.so.com')?'{"list":[]}':index([{title:'Portal 2 梗图 & 表情包',image,page},{title:'不相关表情包',image:image+'?bad=1',page},{title:'Portal 2 攻略',image:image+'?bad=2',page}])),type:'text/html'}}}
async function fixture(run){const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-game-media-'));const servers=[];try{await fs.cp(path.join(project,'public'),path.join(root,'public'),{recursive:true});const start=async(publicOnly=false)=>{const server=createPortfolioServer({root,publicOnly,managementOptions:{gameMedia:{read:mockRead()}}});servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port};await run({root,start})}finally{for(const s of servers){s.closeAllConnections();await new Promise(r=>s.close(r))}if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('portfolio-game-media-'))await fs.rm(root,{recursive:true,force:true})}}

test('game media extracts metadata without accepting unrelated, guide, mixed-host or private images',()=>{
 const parsed=parseImageIndex(index([{title:'Portal 2 梗图 & 表情包',image,page}]));assert.equal(parsed[0].title,'Portal 2 梗图 & 表情包');
 const opts={kind:'memes',query:'Portal 2',provider:'all'};
 assert.equal(filteredIndexItems(parsed,opts).length,1);
 for(const patch of [{title:'Other game 梗图'},{title:'Portal 2 全流程攻略'},{image:'https://127.0.0.1/a.png'},{page:'https://evil.test/'},{image:'https://cdn.max-c.com/meme.png'},{page:'https://www.bilibili.com.evil.test/'}])assert.equal(filteredIndexItems([{...parsed[0],...patch}],opts).length,0);
 assert.equal(filteredIndexItems(parsed,{...opts,provider:'heybox'}).length,0);
 assert.equal(allowedGameMediaRemote(image,'bilibili',true),true);
 for(const url of ['http://i0.hdslb.com/a.png','https://127.0.0.1/a.png','https://user:pass@i0.hdslb.com/a.png','https://i0.hdslb.com:444/a.png'])assert.equal(allowedGameMediaRemote(url,'bilibili',true),false);
 assert.equal(allowedGameMediaRemote('https://cn.bing.com/images/search?q=x','index'),true);
 assert.equal(allowedGameMediaRemote('https://cn.bing.com/private','index'),false);
});
test('remote rejects arbitrary client URLs before any request',async()=>{await assert.rejects(readGameMedia('https://127.0.0.1/a.png',{provider:'bilibili',image:true}));await assert.rejects(readGameMedia('https://evil.test/x',{provider:'index'}))});
test('PNG metadata preserves transparent bytes and rejects unsupported content',()=>{assert.deepEqual(mediaImageInfo(png,'image/png'),{ext:'.png',width:1,height:1,alpha:true});assert.throws(()=>mediaImageInfo(Buffer.from('<svg/>'),'image/png'));assert.throws(()=>mediaImageInfo(Buffer.from('GIF89a'),'image/gif'))});
test('search returns logos and deduplicated memes; imports retain bytes, provenance and deterministic paths',()=>fixture(async({root})=>{
 const before=await fs.readFile(path.join(root,'public/journal.json')),s=createGameMediaService(root,{read:mockRead()});
 const result=await s.search({kind:'memes',query:'Portal 2'});assert.equal(result.items.length,1);assert.equal(result.items[0].source,'哔哩哔哩');assert.equal(result.items[0].image,undefined);
 const asset=await s.importImage({id:result.items[0].id});assert.deepEqual(await fs.readFile(path.join(root,'public',asset.src)),png);assert.equal(asset.source.url,page);assert.equal(asset.source.kind,'meme');assert.ok(asset.tags.includes('游戏梗图'));assert.equal((await s.importImage({id:result.items[0].id})).src,asset.src);
 const logos=await s.search({kind:'logos',query:'Portal 2'});assert.equal(logos.items.length,1);assert.equal(logos.items[0].alpha,true);assert.equal((await s.importImage({id:logos.items[0].id})).source.kind,'logo');
 assert.deepEqual(await fs.readFile(path.join(root,'public/journal.json')),before);
}));
test('errors, invalid inputs, expiry and blocked image types remain explicit',()=>fixture(async({root})=>{
 let time=1000;const s=createGameMediaService(root,{read:mockRead(),now:()=>time});
 for(const input of [{kind:'__proto__',query:'x'},{kind:'memes',query:''},{kind:'logos',query:'x',provider:'heybox'},{kind:'memes',query:'x'.repeat(121)}])await assert.rejects(s.search(input),e=>e.status===400);
 const r=await s.search({kind:'memes',query:'Portal 2'});time+=16*60*1000;await assert.rejects(s.importImage({id:r.items[0].id}),e=>e.status===410);await assert.rejects(s.importImage({id:image}),e=>e.status===410);
 const failed=await createGameMediaService(root,{read:mockRead({fail:true})}).search({kind:'memes',query:'Portal 2'});assert.equal(failed.sources[0].ok,false);
 const bad=createGameMediaService(root,{read:mockRead({badImage:true})}),results=await bad.search({kind:'memes',query:'Portal 2'});assert.equal(results.items.length,0);assert.equal(results.summary.unavailable,1);
 const missing=await s.search({kind:'memes',query:'Portal 2',provider:'heybox'});assert.equal(missing.items.length,0);assert.match(missing.sources[0].message,/公开核实/);
}));
test('source metadata validates in brief reviews and canvas objects, rejecting script links',()=>{
 const source={kind:'meme',name:'哔哩哔哩',title:'Portal 2 梗图',url:page},img={src:'./assets/media/test.png',caption:'',source};
 assert.equal(validMediaSource(source),true);assert.equal(validMediaSource({...source,url:'javascript:alert(1)'}),false);
 assert.equal(validateShortReview({version:1,body:[{text:'短评'}],images:[img]}),true);
 const p=createBookPage();p.blocks=[{type:'image',...img,frame:{x:40,y:40,width:500,height:400}}];assert.equal(validateGameBook({version:1,width:1000,height:1414,pages:[p]}),true);
 p.blocks[0].source.url='javascript:alert(1)';assert.equal(validateGameBook({version:1,width:1000,height:1414,pages:[p]}),false);
});
test('management search requires origin/token, keeps source in library, and stays absent on public server',()=>fixture(async({root,start})=>{
 const base=await start(),bootstrap=await (await fetch(base+'/api/manage/bootstrap')).json(),url=base+'/api/manage/game-media/search',body=JSON.stringify({kind:'memes',query:'Portal 2'});
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,403);
 const headers={'Content-Type':'application/json','X-Local-Token':bootstrap.token,Origin:base};
 const result=await (await fetch(url,{method:'POST',headers,body})).json();assert.equal(result.items.length,1);
 const preview=await fetch(base+result.items[0].preview);assert.equal(preview.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await preview.arrayBuffer()),png);
 const r=await fetch(base+'/api/manage/game-media/import',{method:'POST',headers,body:JSON.stringify({id:result.items[0].id})});assert.equal(r.status,201);const asset=await r.json();
 const library=await (await fetch(base+'/api/manage/library')).json(),saved=library.assets.find(a=>a.src===asset.src);assert.equal(saved.source.url,page);assert.ok(saved.tags.includes('Portal 2'));
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://evil.test'},body})).status,403);
 const pub=await start(true);assert.equal((await fetch(pub+'/api/manage/game-media/search',{method:'POST',headers,body})).status,404);assert.equal((await fetch(pub+'/manage/game-media-search.js')).status,404);
}));

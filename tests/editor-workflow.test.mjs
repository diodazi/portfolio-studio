import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEditorStore,atomicJSON,fingerprint} from '../local/editor-store.mjs';
import {createMediaLibrary} from '../local/media-library.mjs';
import {createPortfolioServer} from '../local/http-server.mjs';
import {build} from '../scripts/build.mjs';
const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function fixture(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-workflow-'));try{fs.mkdirSync(path.join(root,'public/assets/media'),{recursive:true});for(const k of ['site','content','journal','writing'])fs.copyFileSync(path.join(project,'public',k+'.json'),path.join(root,'public',k+'.json'));const store=createEditorStore(root);await fn(root,store)}finally{if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('portfolio-workflow-'))fs.rmSync(root,{recursive:true,force:true})}}
const save=(store,section,id,data,extra={})=>store.saveDraft({section,id,data,baseHash:fingerprint(store.published(section,id)),...extra},store.getDraft(section,id)?.revision||'new');
const selected=d=>({section:d.section,id:d.id,revision:d.revision});
const game=(title='Test')=>({title,magazine:{version:1,preset:'paper',blocks:[{type:'paragraph',runs:[{text:'Test writing'}]}]}});
test('incomplete drafts survive restart without changing public documents; revisions prevent lost edits',()=>fixture((root,s)=>{
 const before=fs.readFileSync(path.join(root,'public/journal.json'),'utf8');const d=save(s,'games','unfinished',{title:'',magazine:{}});
 assert.equal(fs.readFileSync(path.join(root,'public/journal.json'),'utf8'),before);assert.equal(createEditorStore(root).getDraft('games','unfinished').revision,d.revision);
 assert.throws(()=>s.saveDraft({...d,data:{title:'stale'}},'new'),e=>e.status===409);assert.throws(()=>s.publish([selected(d)]),e=>e.status===422);assert.ok(s.getDraft('games','unfinished'));assert.equal(s.snapshot().missingVersion,fingerprint(null));
}));
test('single and batch publication isolate unselected drafts and reject an invalid batch atomically',()=>fixture((root,s)=>{
 const a=save(s,'games','a',game('A')),b=save(s,'cinema','b',game('B')),c=save(s,'writing','c',{title:'',tags:[],blocks:[]});
 const before=s.readDocuments();assert.throws(()=>s.publish([selected(a),selected(c)]),e=>e.status===422);assert.deepEqual(s.readDocuments(),before);
 s.publish([selected(a)]);assert.equal(s.published('games','a').title,'A');assert.ok(s.getDraft('cinema','b'));assert.equal(s.published('cinema','b'),null);
 const fixed=save(s,'writing','c',{title:'C',body:'private editing form',tags:['Test'],blocks:[{type:'paragraph',text:'Public'}]});
 s.publish([selected(b),selected(fixed)]);assert.equal(s.published('cinema','b').title,'B');assert.equal(s.published('writing','c').body,undefined);assert.equal(s.snapshot().drafts.length,0);
}));
test('a changed public base cannot silently overwrite content; history restores only into drafts',()=>fixture((root,s)=>{
 const d=save(s,'games','a',game('One'));s.publish([selected(d)]);const draft=save(s,'games','a',game('Two'),{checkpoint:true});
 const doc=s.readDocuments().journal;doc.games.find(e=>e.id==='a').title='External change';atomicJSON(path.join(root,'public/journal.json'),doc);
 assert.throws(()=>s.publish([selected(draft)]),e=>e.status===409);const version=s.history('games','a').find(v=>v.data.title==='One');
 const restored=s.restore({section:'games',id:'a',versionId:version.id},draft.revision);assert.equal(restored.data.title,'One');assert.equal(s.published('games','a').title,'External change');s.publish([selected(restored)]);assert.equal(s.published('games','a').title,'One');
}));
test('removal is staged, can be discarded, and only removes the selected published record',()=>fixture((root,s)=>{
 s.publish([selected(save(s,'games','a',game('A'))),selected(save(s,'games','b',game('B')))]);
 const removal=save(s,'games','a',game('A'),{operation:'remove'});assert.equal(s.published('games','a').title,'A');s.discard('games','a',removal.revision);assert.equal(s.published('games','a').title,'A');
 s.publish([selected(save(s,'games','a',game('A'),{operation:'remove'}))]);assert.equal(s.published('games','a'),null);assert.equal(s.published('games','b').title,'B');
}));
test('restoring history preserves the most recent unsnapshotted draft first',()=>fixture((root,s)=>{
 save(s,'games','a',game('First'));const old=s.history('games','a')[0];const latest=save(s,'games','a',game('Recent changes'));assert.equal(s.history('games','a').some(v=>v.data.title==='Recent changes'),false);
 s.restore({section:'games',id:'a',versionId:old.id},latest.revision);assert.ok(s.history('games','a').some(v=>v.data.title==='Recent changes'));assert.equal(s.getDraft('games','a').data.title,'First');assert.equal(s.published('games','a'),null);
}));
test('site group publication does not publish drafts from another group',()=>fixture((root,s)=>{
 const top=s.published('site','top'),contact=s.published('site','contact');const a=save(s,'site','top',{...top,heroTitle:'New hero'}),b=save(s,'site','contact',contact);s.publish([selected(a)]);assert.equal(s.readDocuments().site.heroTitle,'New hero');assert.ok(s.getDraft('site','contact'));assert.equal(s.getDraft('site','contact').revision,b.revision);
}));
test('library folders and tags retain file bytes and reusable references across published content and drafts',()=>fixture((root,s)=>{
 const file=path.join(root,'public/assets/media/shared.png'),bytes=Buffer.from('original-png-bytes');fs.writeFileSync(file,bytes);const lib=createMediaLibrary(root,s);let catalog=lib.list();const asset=catalog.assets.find(a=>a.name==='shared.png');
 catalog=lib.update({action:'folder-create',name:'摄影/示例城市'},catalog.revision);catalog=lib.update({action:'assets-update',ids:[asset.id],folder:'摄影/示例城市',tags:['示例城市','街拍'],name:'共享图片'},catalog.revision);
 assert.throws(()=>lib.update({action:'folder-create',name:'stale'},'new'),e=>e.status===409);
 catalog=lib.update({action:'folder-rename',from:'摄影',to:'影像'},catalog.revision);assert.equal(catalog.assets[0].folder,'影像/示例城市');assert.deepEqual(fs.readFileSync(file),bytes);
 const a=save(s,'games','a',{...game('A'),cover:asset.src});s.publish([selected(a)]);save(s,'cinema','b',{...game('B'),cover:asset.src});const usage=lib.list().assets[0].usage;assert.equal(usage.published.length,1);assert.equal(usage.drafts.length,1);assert.throws(()=>lib.update({action:'folder-delete',name:'影像/示例城市'},catalog.revision),e=>e.status===400);
}));
test('publish recovery rolls back an unfinished transaction and completes a committed transaction',()=>fixture((root,s)=>{
 const before=s.readDocuments().journal,d=save(s,'games','a',game('A')),after={...before,games:[...before.games,{id:'a',...game('A')}]};
 atomicJSON(path.join(root,'.local/publish-transaction.json'),{phase:'prepared',before:{journal:before},after:{journal:after},items:[selected(d)]});atomicJSON(path.join(root,'public/journal.json'),after);const restarted=createEditorStore(root);assert.deepEqual(restarted.readDocuments().journal,before);assert.ok(restarted.getDraft('games','a'));
 atomicJSON(path.join(root,'.local/publish-transaction.json'),{phase:'committed',before:{journal:before},after:{journal:after},items:[selected(d)]});atomicJSON(path.join(root,'public/journal.json'),after);const finished=createEditorStore(root);assert.equal(finished.getDraft('games','a'),null);assert.equal(finished.published('games','a').title,'A');
}));
test('public build excludes unpublished media and prunes previously published media after removal',()=>fixture(async(root,s)=>{
 for(const name of ['index.html','app.js','storage.js'])fs.copyFileSync(path.join(project,'public',name),path.join(root,'public',name));
 const media=path.join(root,'public/assets/media');fs.writeFileSync(path.join(media,'published.png'),'A');fs.writeFileSync(path.join(media,'private.png'),'B');
 const d=save(s,'games','a',{...game('A'),cover:'./assets/media/published.png'});s.publish([selected(d)]);save(s,'games','b',{...game('B'),cover:'./assets/media/private.png'});
 await build(root);assert.ok(fs.existsSync(path.join(root,'dist/assets/media/published.png')));assert.equal(fs.existsSync(path.join(root,'dist/assets/media/private.png')),false);assert.equal(fs.existsSync(path.join(root,'dist/.local')),false);
 s.publish([selected(save(s,'games','a',game('A'),{operation:'remove'}))]);await build(root);assert.equal(fs.existsSync(path.join(root,'dist/assets/media/published.png')),false);assert.ok(fs.existsSync(path.join(media,'published.png')));
}));
test('draft and library HTTP endpoints require a local verified mutation and public mode hides all editor APIs',()=>fixture(async(root,s)=>{
 const server=createPortfolioServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const origin='http://127.0.0.1:'+server.address().port,boot=await(await fetch(origin+'/api/manage/bootstrap')).json(),headers={'Content-Type':'application/json',Origin:origin,'X-Local-Token':boot.token,'If-Match':'new'};
 const data={section:'games',id:'http',data:game(),baseHash:boot.editor.missingVersion};const put=extra=>fetch(origin+'/api/manage/drafts',{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(data)});assert.equal((await put({'X-Local-Token':'wrong'})).status,403);assert.equal((await put({Origin:'https://evil.example'})).status,403);assert.equal((await put({})).status,200);assert.equal((await put({})).status,409);assert.equal((await(await fetch(origin+'/journal.json')).json()).games.some(e=>e.id==='http'),false);
 assert.equal((await fetch(origin+'/.local/drafts/anything.json')).status,404);assert.equal((await fetch(origin+'/api/manage/drafts',{headers:{'X-Forwarded-For':'127.0.0.1'}})).status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
 const publicServer=createPortfolioServer({root,publicOnly:true});await new Promise(r=>publicServer.listen(0,'127.0.0.1',r));try{const origin='http://127.0.0.1:'+publicServer.address().port;for(const route of ['/api/manage/drafts','/api/manage/library','/api/manage/history','/api/manage/publish','/manage/media-library.js'])assert.equal((await fetch(origin+route)).status,404)}finally{publicServer.closeAllConnections();await new Promise(r=>publicServer.close(r))}
}));

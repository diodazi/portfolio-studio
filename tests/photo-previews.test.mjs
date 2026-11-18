import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {preparePhotoPreviews} from '../local/photo-previews.mjs';
import {createPortfolioServer} from '../local/http-server.mjs';
import {SITE_DEFAULTS} from '../public/site-config.js';
test('previews respect EXIF orientation, preserve originals and refresh published entries only',async()=>{
 sharp.cache(false);
 const tempBase=fileURLToPath(new URL('../.local/photo-preview-tests/',import.meta.url));await fs.mkdir(tempBase,{recursive:true});
 const root=await fs.mkdtemp(path.join(tempBase,'fixture-'));
 try{
  const dir=path.join(root,'public/assets/media');await fs.mkdir(dir,{recursive:true});
  const src='./assets/media/photo.jpg',file=path.join(dir,'photo.jpg');
  await sharp({create:{width:900,height:600,channels:3,background:'#647a63'}}).jpeg().withMetadata({orientation:8}).toFile(file);
  const original=await fs.readFile(file);await fs.writeFile(path.join(root,'public/content.json'),JSON.stringify({photographs:[{id:'published',src},{id:'draft',src:'./assets/media/draft.jpg',published:false}]}));
  const first=await preparePhotoPreviews(root),record=first.photos[src];assert.equal(record.width,600);assert.equal(record.height,900);
  const preview=await sharp(path.join(root,'public',record.small)).metadata();assert.ok(preview.width<preview.height);assert.equal(preview.height,640);
  assert.deepEqual(await fs.readFile(file),original);assert.equal(Object.keys(first.photos).length,1);
  assert.deepEqual(await preparePhotoPreviews(root),first);
  await fs.writeFile(path.join(root,'public/content.json'),JSON.stringify({photographs:[]}));assert.deepEqual((await preparePhotoPreviews(root)).photos,{});
  assert.equal((await fs.readdir(path.join(root,'public/assets/photo-previews'))).length,0);assert.deepEqual(await fs.readFile(file),original);
 }finally{assert.ok(path.resolve(root).startsWith(path.resolve(tempBase)+path.sep));await fs.rm(root,{recursive:true,force:true})}
});
test('publishing a photograph generates previews; a saved draft does not',async()=>{
 sharp.cache(false);const tempBase=fileURLToPath(new URL('../.local/photo-preview-tests/',import.meta.url));await fs.mkdir(tempBase,{recursive:true});
 const root=await fs.mkdtemp(path.join(tempBase,'api-'));let server;
 try{
  await fs.mkdir(path.join(root,'public/assets/media'),{recursive:true});
  for(const [name,data]of Object.entries({site:SITE_DEFAULTS,content:{photographs:[],videos:[],audio:[],projects:[]},journal:{games:[],cinema:[]},writing:{articles:[]}}))await fs.writeFile(path.join(root,'public',name+'.json'),JSON.stringify(data));
  await sharp({create:{width:120,height:180,channels:3,background:'#63715d'}}).png().toFile(path.join(root,'public/assets/media/new.png'));
  await preparePhotoPreviews(root);
  server=createPortfolioServer({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,boot=await(await fetch(origin+'/api/manage/bootstrap')).json();
  const headers={'Content-Type':'application/json',Origin:origin,'X-Local-Token':boot.token};
  const saved=await fetch(origin+'/api/manage/drafts',{method:'PUT',headers:{...headers,'If-Match':'new'},body:JSON.stringify({section:'photographs',id:'new-photo',data:{title:'New photo',src:'./assets/media/new.png',category:'portrait',description:''},baseHash:boot.editor.missingVersion})});
  assert.equal(saved.status,200);const {draft}=await saved.json();assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'public/photography-index.json'),'utf8')).photos,{});
  const response=await fetch(origin+'/api/manage/publish',{method:'POST',headers,body:JSON.stringify({items:[{section:'photographs',id:'new-photo',revision:draft.revision}]})});assert.equal(response.status,200);await response.json();
  let ready=false;for(let i=0;i<100;i++){const index=JSON.parse(await fs.readFile(path.join(root,'public/photography-index.json'),'utf8'));if(index.photos['./assets/media/new.png']){ready=true;break}await new Promise(resolve=>setTimeout(resolve,20))}
  assert.ok(ready,'Publication did not generate the new photo preview');
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}assert.ok(path.resolve(root).startsWith(path.resolve(tempBase)+path.sep));await fs.rm(root,{recursive:true,force:true})}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {EXHIBITION_PRESETS,EXHIBITION_LAYOUTS,createExhibition,createExhibitionPage,withExhibitionPreset,setExhibitionRuns,exhibitionRuns,setExhibitionImage} from '../public/exhibition-model.js';
import {validateMagazine,magazineFor} from '../public/magazine.js';
import {magazineText} from '../public/editorial-model.js';
import {validateDocument} from '../local/manage-schema.mjs';
import {createEditorStore,fingerprint,mediaReferences} from '../local/editor-store.mjs';
const doc=b=>({version:1,preset:'paper',blocks:[b]});
test('twelve exhibition sequences validate and contain genuinely distinct first layouts',()=>{
 assert.equal(Object.keys(EXHIBITION_PRESETS).length,12);assert.equal(new Set(Object.values(EXHIBITION_PRESETS).map(p=>p.layouts[0])).size,12);
 for(const id of Object.keys(EXHIBITION_PRESETS)){const b=createExhibition(id);assert.equal(b.pages.length,4);assert.ok(validateMagazine(doc(b)));assert.ok(validateDocument('writing',{articles:[{id:'test',title:'Article',tags:[],magazine:doc(b)}]}));for(const p of b.pages)assert.ok(Object.hasOwn(EXHIBITION_LAYOUTS,p.layout))}
});
test('changing exhibition preserves all pages, images, formatting and geometry',()=>{
 const b=createExhibition('spread');b.width=80;b.frame={x:20,y:30,width:800,height:700};b.layer=7;b.pages.push(createExhibitionPage('gallery',4));b.pages[0].images[2].src='./assets/media/alpha.png';b.pages[0].images[2].caption='Hidden media is retained';b.pages[0].body=[{text:'My observation',bold:true,color:'#334455',size:24}];
 for(const id of Object.keys(EXHIBITION_PRESETS)){const changed=withExhibitionPreset(b,id);const restore=structuredClone(changed);restore.preset=b.preset;restore.transition=b.transition;restore.pages.forEach((p,i)=>p.layout=b.pages[i].layout);assert.deepEqual(restore,b);assert.ok(validateMagazine(doc(changed)))}
 assert.deepEqual(magazineFor({magazine:doc(b)}),doc(b));
});
test('exhibitions reject unsafe images, malformed pages and invalid transition parameters',()=>{
 for(const mutate of [b=>b.pages=[],b=>b.pages=Array.from({length:25},()=>createExhibitionPage()),b=>b.pages[0].images[0].src='https://example.com/a.png',b=>b.pages[0].images[0].src='./assets/media/../a.png',b=>b.pages[0].images[0].src='javascript:alert(1)',b=>b.pages[0].images.pop(),b=>b.pages[0].images[0].x=Infinity,b=>b.pages[0].title=[{text:'bad',color:'red;'}],b=>b.transition='constructor',b=>b.preset='__proto__',b=>b.pages[0].layout='unknown',b=>b.motion='true']){const b=createExhibition('spread');mutate(b);assert.equal(validateMagazine(doc(b)),false)}
});
test('nested run and image updates are whitelisted and plain text remains extractable',()=>{
 const b=createExhibition('type');setExhibitionRuns(b,'pages.1.body',[{text:'<script>literal text</script>',italic:true}]);assert.match(magazineText(doc(b)),/literal text/);assert.equal(exhibitionRuns(b,'pages.1.body')[0].italic,true);setExhibitionRuns(b,'__proto__.polluted',[{text:'x'}]);assert.equal({}.polluted,undefined);assert.equal(setExhibitionImage(b,'pages.0.images.2.src','./assets/media/alpha.png'),true);assert.equal(setExhibitionImage(b,'pages.0.images.3.src','./assets/media/alpha.png'),false);assert.equal(setExhibitionImage(b,'pages.0.images.0.src','https://x/a.png'),false);
});
test('exhibition nested assets and private drafts publish in games, cinema and essays',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-exhibition-'));try{
  fs.mkdirSync(path.join(root,'public'),{recursive:true});for(const k of ['content','journal','writing','site'])fs.copyFileSync(new URL('../public/'+k+'.json',import.meta.url),path.join(root,'public',k+'.json'));fs.mkdirSync(path.join(root,'public/assets/media'),{recursive:true});fs.copyFileSync(new URL('./fixtures/qa-test-1.png',import.meta.url),path.join(root,'public/assets/media/alpha.png'));
  const store=createEditorStore(root);for(const section of ['games','cinema','writing']){const b=createExhibition('gallery');b.pages[3].images[2].src='./assets/media/alpha.png';const data={title:'Exhibition',tags:[],magazine:doc(b)},draft=store.saveDraft({section,id:'ex-'+section,data,baseHash:fingerprint(null)},'new');assert.equal(store.published(section,draft.id),null);assert.ok(mediaReferences(draft).has('./assets/media/alpha.png'));store.publish([{section,id:draft.id,revision:draft.revision}]);assert.deepEqual(store.published(section,draft.id).magazine,data.magazine)}
 }finally{const resolved=path.resolve(root);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('portfolio-exhibition-'))fs.rmSync(resolved,{recursive:true,force:true})}
});

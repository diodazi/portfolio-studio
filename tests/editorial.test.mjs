import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {COMPONENTS,ARTICLE_TEMPLATES,createComponent,templateBlocks,componentRuns,setComponentRuns,magazineText} from '../public/editorial-model.js';
import {validateMagazine,magazineFor} from '../public/magazine.js';
import {normalizeArticles} from '../public/writing.js';
import {validateDocument} from '../local/manage-schema.mjs';
import {createEditorStore,fingerprint,mediaReferences} from '../local/editor-store.mjs';
const doc=blocks=>({version:1,preset:'paper',blocks});
test('all editorial components and complete templates work in journals and essays',()=>{
 assert.equal(Object.keys(COMPONENTS).length,32);assert.equal(ARTICLE_TEMPLATES.length,4);
 for(const b of Object.keys(COMPONENTS).map(createComponent)){assert.ok(validateMagazine(doc([b])),b.component);assert.ok(validateDocument('writing',{articles:[{id:'a',title:'Article',tags:[],magazine:doc([b])}]}));}
 for(const t of ARTICLE_TEMPLATES)assert.ok(validateMagazine(doc(templateBlocks(t.id))));
});
test('nested editorial input rejects scripts, remote images, invalid layouts and missing faces',()=>{
 const b=createComponent('comparison');
 for(const mutate of [b=>b.items[0].src='javascript:alert(1)',b=>b.items[0].src='https://example.com/a.png',b=>b.items[0].href='javascript:alert(1)',b=>b.items[0].title=[{text:'a',color:'red;display:none'}],b=>b.options.padding=-1,b=>b.options.css='x',b=>b.items.pop()]){const c=structuredClone(b);mutate(c);assert.equal(validateMagazine(doc([c])),false)}
 const c=createComponent('hotspots');c.src='./assets/media/transparent.png';c.items[0].x=101;assert.equal(validateMagazine(doc([c])),false);
});
test('nested rich text and legacy writing survive conversion without interpreting HTML',()=>{
 const b=createComponent('tabs');setComponentRuns(b,'items.1.body',[{text:'<script>literal</script>',bold:true,color:'#223344',size:24}]);assert.equal(componentRuns(b,'items.1.body')[0].size,24);setComponentRuns(b,'__proto__.polluted',[{text:'unsafe'}]);assert.equal({}.polluted,undefined);
 const m=doc([b]);assert.match(magazineText(m),/literal/);const normalized=normalizeArticles([{id:'a',title:'Essay',tags:[],magazine:m}]);assert.deepEqual(normalized[0].magazine,m);
 const legacy=magazineFor({blocks:[{type:'heading',text:'Title'},{type:'paragraph',text:'<b>literal</b>'},{type:'image',src:'./assets/media/image.png',text:'Caption'}]});assert.ok(validateMagazine(legacy));assert.equal(legacy.blocks[1].runs[0].text,'<b>literal</b>');
});
test('editorial drafts remain private, nested media publishes and invalid publication is atomic',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-editorial-'));try{
  fs.mkdirSync(path.join(root,'public'),{recursive:true});for(const k of ['content','journal','writing','site'])fs.copyFileSync(new URL('../public/'+k+'.json',import.meta.url),path.join(root,'public',k+'.json'));
  fs.mkdirSync(path.join(root,'public/assets/media'),{recursive:true});fs.writeFileSync(path.join(root,'public/assets/media/alpha.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  const store=createEditorStore(root),b=createComponent('triptych');b.items[1].src='./assets/media/alpha.png';const data={title:'Review',tags:[],magazine:doc([b])};
  const draft=store.saveDraft({section:'writing',id:'editorial-test',data,baseHash:fingerprint(null)},'new');assert.equal(store.published('writing','editorial-test'),null);assert.ok(mediaReferences(draft).has('./assets/media/alpha.png'));
  store.publish([{section:'writing',id:draft.id,revision:draft.revision}]);assert.deepEqual(store.published('writing',draft.id).magazine,data.magazine);
  const invalid=structuredClone(data);invalid.magazine.blocks[0].items[0].href='data:text/html,x';const d=store.saveDraft({section:'writing',id:draft.id,data:invalid,baseHash:fingerprint(store.published('writing',draft.id))},'new');assert.throws(()=>store.publish([{section:d.section,id:d.id,revision:d.revision}]),e=>e.status===422);assert.deepEqual(store.published('writing',draft.id).magazine,data.magazine);
 }finally{const resolved=path.resolve(root);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('portfolio-editorial-'))fs.rmSync(resolved,{recursive:true,force:true})}
});

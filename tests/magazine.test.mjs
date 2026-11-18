import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMagazine,magazineFor} from '../public/magazine.js';
import {validateJournal} from '../local/journal-api.mjs';
import {boundedFrame,validFrame,canvasHeight} from '../public/magazine-layout.js';
const doc={version:1,preset:'folio',blocks:[{type:'image',src:'./assets/media/sample.jpg',caption:'现场记录',width:45,wrap:'left',height:250,fit:'cover'},{type:'paragraph',runs:[{text:'带格式的评价',bold:true,color:'#53604a',size:24}]},{type:'textbox',width:40,wrap:'right',runs:[{text:'旁注',italic:true}]}]};
test('rich journal records preserve formatted runs, image geometry and layout',()=>{
  assert.equal(validateMagazine(doc),true);const entry={id:'sample',title:'Example',magazine:doc};assert.equal(validateJournal({games:[entry],cinema:[entry]}),true);assert.deepEqual(magazineFor(entry),doc);
  const copy=magazineFor(entry);copy.blocks[1].runs[0].text='changed';assert.equal(doc.blocks[1].runs[0].text,'带格式的评价');
});
test('legacy notes become editable paragraphs without interpreting HTML',()=>{
  const result=magazineFor({note:'<img src=x onerror=alert(1)>\n\n第二段'});assert.equal(result.blocks.length,2);assert.equal(result.blocks[0].runs[0].text,'<img src=x onerror=alert(1)>');assert.equal(validateMagazine(result),true);
});
test('rich document validation rejects script URLs, CSS injection, unsupported nodes and unbounded dimensions',()=>{
  for(const block of [{type:'image',src:'javascript:alert(1)',caption:''},{type:'image',src:'./assets/media/../x.jpg',caption:''},{type:'image',src:'./assets/media/x.jpg',caption:'',height:9000},{type:'paragraph',runs:[{text:'x',color:'red;background:url(x)'}]},{type:'paragraph',runs:[{text:'x',size:999}]},{type:'iframe',src:'https://evil.test'},{type:'textbox',width:0,runs:[]}])assert.equal(validateMagazine({...doc,blocks:[block]}),false);
  assert.equal(validateJournal({games:[{id:'x',title:'x',magazine:{...doc,preset:'unknown'}}],cinema:[]}),false);
});
test('free positions, independent image transforms and layer order survive document validation',()=>{
  const free={...structuredClone(doc),layout:'free',canvas:{width:1000,height:900}};
  free.blocks.forEach((b,i)=>{b.frame={x:40+i*80,y:70+i*100,width:420,height:240};b.layer=3-i});
  Object.assign(free.blocks[0],{imageScale:145,imageOffsetX:-15,imageOffsetY:20,fit:'fill'});Object.assign(free.blocks[2],{textboxFill:'none',boxHeight:180});
  assert.equal(validateMagazine(free),true);assert.deepEqual(magazineFor({magazine:free}),free);
  for(const change of [{imageScale:0},{imageOffsetX:101},{layer:-1},{boxHeight:5000},{textboxFill:'url(x)'},{frame:{x:900,y:0,width:400,height:200}}])assert.equal(validateMagazine({...free,blocks:[{...free.blocks[0],...change}]}),false);
  assert.equal(validateMagazine({...free,canvas:{width:1200,height:900}}),false);
});
test('drag and resize boundaries keep objects inside the canvas and grow its height for lower objects',()=>{
  const frame=boundedFrame({x:-40,y:11990,width:2000,height:500});assert.equal(validFrame(frame),true);assert.deepEqual(frame,{x:0,y:11500,width:1000,height:500});
  assert.equal(canvasHeight({canvas:{height:900},blocks:[{type:'textbox',frame:{x:0,y:1000,width:400,height:200}}]}),1232);
});

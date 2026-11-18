import test from 'node:test';import assert from 'node:assert/strict';
import {EDITOR_FONTS,validFont,fontStack,uniformFont} from '../public/editor-fonts.js';
import {validRuns,createComponent} from '../public/editorial-model.js';
import {validateMagazine} from '../public/magazine.js';
import {createGameBook,validateGameBook,validateShortReview} from '../public/game-review-model.js';
import {readFile} from 'node:fs/promises';
test('all seven built-in font families survive ordinary, component, book and brief schemas',()=>{
 assert.equal(Object.keys(EDITOR_FONTS).length,8);
 for(const font of Object.keys(EDITOR_FONTS)){const runs=[{text:'在光与现场之间。 Light & scene.',font,bold:true,size:28,color:'#334433'}];assert.ok(validRuns(runs));assert.ok(validateMagazine({version:1,preset:'paper',blocks:[{type:'textbox',font,runs}]}));const c=createComponent('pullquote');c.body=runs;assert.ok(validateMagazine({version:1,preset:'paper',blocks:[c]}));const b=createGameBook();b.pages[0].blocks.push({type:'textbox',font,runs,frame:{x:10,y:10,width:500,height:300}});assert.ok(validateGameBook(b));assert.ok(validateShortReview({version:1,body:runs,images:[]}))}
});
test('unknown font IDs and CSS injection cannot enter saved content',()=>{
 for(const font of ['Arial','__proto__','constructor','url(https://evil.test/font)','notosanssc; color:red',{}]){assert.equal(validFont(font),false);assert.equal(fontStack(font),'');assert.equal(validRuns([{text:'x',font}]),false);assert.equal(validateMagazine({version:1,preset:'paper',blocks:[{type:'paragraph',font,runs:[{text:'x'}]}]}),false)}
});
test('mixed runs and legacy text retain their defaults without migration',()=>{
 const old=[{text:'原有内容',bold:true}];assert.ok(validRuns(old));assert.equal(uniformFont(old),'default');assert.equal(uniformFont([{text:'甲',font:'mashanzheng'},{text:'乙',font:'notosanssc'}]),'mixed');assert.equal(uniformFont([],'notoserifsc'),'notoserifsc');assert.deepEqual(old,[{text:'原有内容',bold:true}]);
});

test('bundled font faces have local WOFF2 files and retained OFL licenses',async()=>{
 const base=new URL('../public/assets/fonts/editorial/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8')),css=await readFile(new URL('fonts.css',base),'utf8');
 assert.equal(manifest.length,7);assert.equal(/url\(["']?https?:/i.test(css),false);
 const urls=[...css.matchAll(/url\(\.\/files\/([^\)]+)\)/g)].map(m=>m[1]);assert.ok(urls.length>7);
 for(const m of manifest){assert.ok(validFont(m.id));assert.equal(m.license,'OFL-1.1');assert.match(await readFile(new URL(m.id+'-OFL.txt',base),'utf8'),/SIL OPEN FONT LICENSE/);for(const file of m.files)assert.ok(urls.includes(file))}
 for(const file of new Set(urls)){const data=await readFile(new URL('files/'+file,base));assert.equal(data.subarray(0,4).toString(),'wOF2')}
});


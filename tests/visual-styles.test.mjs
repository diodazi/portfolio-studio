import test from 'node:test';
import assert from 'node:assert/strict';
import {VISUAL_STYLES,STYLE_GROUPS,withVisualStyle} from '../public/editorial-styles.js';
import {COMPONENTS,ARTICLE_TEMPLATES,createComponent} from '../public/editorial-model.js';
import {validateMagazine} from '../public/magazine.js';
const doc=b=>({version:1,preset:'paper',blocks:[b]});
test('forty appearances are compatible with every original component; original templates stay intact',()=>{
 assert.equal(Object.keys(VISUAL_STYLES).length,40);assert.equal(STYLE_GROUPS.length,8);assert.equal(Object.keys(COMPONENTS).length,32);assert.equal(ARTICLE_TEMPLATES.length,4);
 for(const component of Object.keys(COMPONENTS)){const b=createComponent(component);assert.ok(validateMagazine(doc(b)));for(const style of Object.keys(VISUAL_STYLES))assert.ok(validateMagazine(doc(withVisualStyle(b,style))),`${component}/${style}`)}
});
test('changing and removing appearance preserves every author field, formatting, image and frame',()=>{
 const b=createComponent('tabs');b.title=[{text:'Written title',bold:true,size:32,color:'#234567'}];b.src='./assets/media/alpha.png';b.items[0].src='./assets/media/inside.png';b.items[0].href='https://example.com/';b.width=72;b.frame={x:24,y:100,width:620,height:540};b.layer=9;b.options.tone='sage';b.options.motion=false;
 const before=structuredClone(b);for(const style of Object.keys(VISUAL_STYLES)){const result=withVisualStyle(b,style);assert.equal(result.options.style,style);assert.deepEqual(withVisualStyle(result,'original'),before);assert.deepEqual(b,before)}
});
test('unknown appearance values never become arbitrary styles or active content',()=>{
 for(const style of ['<script>','url(https://example.com)',{},[],7,null,'__proto__','constructor']){const b=createComponent('split');b.options.style=style;assert.equal(validateMagazine(doc(b)),false);assert.throws(()=>withVisualStyle(createComponent('split'),style))}
 assert.throws(()=>withVisualStyle({type:'paragraph'},'swiss'));
});

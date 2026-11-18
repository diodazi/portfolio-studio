import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoDeck,composePhotos,collageGeometry,shuffle,photoRatio} from '../public/photo-layout.js';
const photos=Array.from({length:26},(_,i)=>({id:String(i),width:i%3===0?600:1200,height:900}));
function draw(seed){return max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max)}}
test('shuffle and deck keep originals intact; full first cycle has no repeats',()=>{
 const original=structuredClone(photos);const deck=createPhotoDeck(photos,{draw:draw(40)}),seen=[];
 for(let i=0;i<5;i++){const batch=deck.next();assert.equal(batch.length,6);assert.equal(new Set(batch.map(p=>p.id)).size,6);seen.push(...batch.map(p=>p.id))}
 assert.equal(new Set(seen.slice(0,26)).size,26);assert.deepEqual(photos,original);assert.notDeepEqual(shuffle(photos,draw(20)),photos);
});
test('refresh avoids the previous selection when enough other photos exist',()=>{
 for(let seed=0;seed<200;seed++){
  const previous=photos.slice(0,6).map(p=>p.id),deck=createPhotoDeck(photos,{previous,draw:draw(seed)});
  assert.ok(deck.next().every(p=>!previous.includes(p.id)));
 }
});
test('small, duplicate and empty libraries terminate without duplicate tiles',()=>{
 assert.deepEqual(createPhotoDeck([]).next(),[]);
 assert.equal(createPhotoDeck([photos[0],photos[0]]).next().length,1);
 const deck=createPhotoDeck(photos.slice(0,2),{draw:()=>0});const a=deck.next(),b=deck.next();assert.equal(a.length,2);assert.notDeepEqual(a,b);
});
test('collages retain each source ratio and fit every photo within desktop and mobile stages',()=>{
 const mixed=photos.slice(0,6),before=structuredClone(mixed);
 for(let count=0;count<=6;count++)for(let variant=0;variant<3;variant++)for(const mobile of [false,true]){
  const items=composePhotos(mixed.slice(0,count),variant),width=mobile?280:1200,height=mobile?661:700;
  assert.equal(new Set(items.map(p=>p.id)).size,count);
  const layout=collageGeometry(items,width,height,{mobile,variant});
  layout.forEach((g,i)=>{assert.ok(Math.abs(g.width/g.height-photoRatio(items[i]))<.0001);assert.ok(g.x>=0&&g.y>=0&&g.x+g.width<=width&&g.y+g.height<=height)});
 }
 assert.deepEqual(mixed,before);assert.equal(photoRatio({}),1);assert.equal(photoRatio({width:600,height:900}),2/3);
});

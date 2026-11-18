const number=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>names.includes(k));
export function defaultImageEffects(){return {version:1,enabled:true,frost:{blur:0,grain:0},radial:{mode:'spin',amount:0,centerX:50,centerY:50},regions:[]}}
export function validImageEffects(e){
 if(e===undefined)return true;
 return !!(keys(e,['version','enabled','frost','radial','regions'])&&e.version===1&&typeof e.enabled==='boolean'&&keys(e.frost,['blur','grain'])&&number(e.frost.blur,0,40)&&number(e.frost.grain,0,40)&&keys(e.radial,['mode','amount','centerX','centerY'])&&['spin','zoom'].includes(e.radial.mode)&&number(e.radial.amount,0,100)&&number(e.radial.centerX,0,100)&&number(e.radial.centerY,0,100)&&Array.isArray(e.regions)&&e.regions.length<=8&&new Set(e.regions.map(r=>r?.id)).size===e.regions.length&&e.regions.every(r=>keys(r,['id','shape','x','y','width','height','blur','feather'])&&typeof r.id==='string'&&/^[\w-]{1,80}$/.test(r.id)&&['rect','ellipse'].includes(r.shape)&&number(r.x,0,100)&&number(r.y,0,100)&&number(r.width,2,100)&&number(r.height,2,100)&&r.x+r.width<=100.001&&r.y+r.height<=100.001&&number(r.blur,0,40)&&number(r.feather,0,100)));
}
export const hasImageEffects=e=>validImageEffects(e)&&!!e?.enabled&&!!(e.frost.blur||e.frost.grain||e.radial.amount||e.regions.some(r=>r.blur));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function moveEffectRegion(region,edge,dx,dy){
 const r={...region};if(edge==='move'){r.x=clamp(r.x+dx,0,100-r.width);r.y=clamp(r.y+dy,0,100-r.height)}
 else{if(edge.includes('e'))r.width=clamp(r.width+dx,2,100-r.x);if(edge.includes('s'))r.height=clamp(r.height+dy,2,100-r.y);if(edge.includes('w')){r.x=clamp(r.x+dx,0,region.x+region.width-2);r.width=region.x+region.width-r.x}if(edge.includes('n')){r.y=clamp(r.y+dy,0,region.y+region.height-2);r.height=region.y+region.height-r.y}}return r;
}
// References point to the authored image, including image slots inside presets.
export function effectImageTargets(block){
 if(block?.type==='image'&&block.src)return [{key:'src',label:'当前图片',record:block}];
 if(block?.type==='component')return [...(block.src?[{key:'src',label:'主图',record:block}]:[]),...(block.items||[]).flatMap((item,i)=>item.src?[{key:`items.${i}.src`,label:`组件图片 ${i+1}`,record:item}]:[])];
 if(block?.type==='exhibition')return block.pages.flatMap((p,i)=>p.images.flatMap((im,j)=>im.src?[{key:`pages.${i}.images.${j}.src`,label:`第 ${i+1} 幅 · 图片 ${j+1}`,record:im}]:[]));return [];
}

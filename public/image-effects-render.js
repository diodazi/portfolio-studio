import {hasImageEffects,validImageEffects} from './image-effects-model.js';
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const context=c=>c.getContext('2d',{willReadFrequently:true});
const clone=c=>{const out=canvas(c.width,c.height);context(out).drawImage(c,0,0);return out};
// Three separable box passes approximate a Gaussian; premultiplied RGB prevents
// dark fringes on transparent PNGs and works without Canvas filter support.
export function blurImageCanvas(source,strength){
 if(!strength)return clone(source);const w=source.width,h=source.height,r=Math.max(1,Math.round(strength*Math.max(w,h)/1000*.58)),out=clone(source),ctx=context(out),pixels=ctx.getImageData(0,0,w,h),a=new Float32Array(pixels.data.length),b=new Float32Array(a.length);
 for(let i=0;i<a.length;i+=4){const alpha=pixels.data[i+3]/255;a[i]=pixels.data[i]*alpha;a[i+1]=pixels.data[i+1]*alpha;a[i+2]=pixels.data[i+2]*alpha;a[i+3]=pixels.data[i+3]}
 const pass=(src,dst,horizontal)=>{const outer=horizontal?h:w,inner=horizontal?w:h,stride=horizontal?4:w*4,baseStep=horizontal?w*4:4,div=2*r+1;
  for(let row=0;row<outer;row++)for(let ch=0;ch<4;ch++){const base=row*baseStep+ch;let sum=0;for(let k=-r;k<=r;k++)sum+=src[base+Math.max(0,Math.min(inner-1,k))*stride];for(let col=0;col<inner;col++){dst[base+col*stride]=sum/div;sum+=src[base+Math.min(inner-1,col+r+1)*stride]-src[base+Math.max(0,col-r)*stride]}}
 };for(let i=0;i<3;i++){pass(a,b,true);pass(b,a,false)}
 for(let i=0;i<a.length;i+=4){const alpha=a[i+3];pixels.data[i]=alpha?a[i]*255/alpha:0;pixels.data[i+1]=alpha?a[i+1]*255/alpha:0;pixels.data[i+2]=alpha?a[i+2]*255/alpha:0;pixels.data[i+3]=alpha}ctx.putImageData(pixels,0,0);return out;
}
function radial(source,r){
 if(!r.amount)return clone(source);const out=canvas(source.width,source.height),ctx=context(out),steps=32,cx=out.width*r.centerX/100,cy=out.height*r.centerY/100;
 ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1/steps;
 for(let i=0;i<steps;i++){const t=(i/(steps-1)-.5)*r.amount/100;ctx.save();ctx.translate(cx,cy);if(r.mode==='spin')ctx.rotate(t*Math.PI/3);else ctx.scale(1+t*.75,1+t*.75);ctx.translate(-cx,-cy);ctx.drawImage(source,0,0);ctx.restore()}ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';return out;
}
function mask(w,h,r){
 const c=canvas(w,h),ctx=context(c),data=ctx.createImageData(w,h),x=r.x*w/100,y=r.y*h/100,rw=r.width*w/100,rh=r.height*h/100,rx=rw/2,ry=rh/2,soft=Math.min(rx,ry)*r.feather/100;
 for(let py=Math.max(0,Math.floor(y));py<Math.min(h,Math.ceil(y+rh));py++)for(let px=Math.max(0,Math.floor(x));px<Math.min(w,Math.ceil(x+rw));px++){
  const dx=Math.abs(px+.5-x-rx),dy=Math.abs(py+.5-y-ry),dist=r.shape==='ellipse'?(1-Math.hypot(dx/rx,dy/ry))*Math.min(rx,ry):Math.min(rx-dx,ry-dy);let t=soft?Math.max(0,Math.min(1,dist/soft)):(dist>=0?1:0);t=t*t*(3-2*t);const at=(py*w+px)*4;data.data[at]=data.data[at+1]=data.data[at+2]=255;data.data[at+3]=Math.round(t*255)
 }ctx.putImageData(data,0,0);return c;
}
export function renderImageEffects(source,effects,{maxSize=1400}={}){
 if(!validImageEffects(effects))throw Error('图像效果参数无效。');const scale=Math.min(1,maxSize/Math.max(source.naturalWidth||source.width,source.naturalHeight||source.height)),w=Math.max(1,Math.round((source.naturalWidth||source.width)*scale)),h=Math.max(1,Math.round((source.naturalHeight||source.height)*scale));let base=canvas(w,h);context(base).drawImage(source,0,0,w,h);if(!hasImageEffects(effects))return base;
 base=blurImageCanvas(base,effects.frost.blur);base=radial(base,effects.radial);
 if(effects.frost.grain){const ctx=context(base),im=ctx.getImageData(0,0,w,h);for(let i=0;i<im.data.length;i+=4){if(!im.data[i+3])continue;let seed=(i/4+1)^0x9e3779b9;seed=Math.imul(seed^(seed>>>16),0x21f0aaad);seed=Math.imul(seed^(seed>>>15),0x735a2d97);const noise=(((seed^(seed>>>15))>>>0)/4294967295-.5)*effects.frost.grain;for(let c=0;c<3;c++)im.data[i+c]+=noise}ctx.putImageData(im,0,0)}
 const original=clone(base),ctx=context(base);for(const region of effects.regions){if(!region.blur)continue;const blurred=blurImageCanvas(original,region.blur),dst=ctx.getImageData(0,0,w,h),src=context(blurred).getImageData(0,0,w,h),weights=context(mask(w,h,region)).getImageData(0,0,w,h).data;
  for(let i=0;i<dst.data.length;i+=4){const t=weights[i+3]/255;if(!t)continue;const a=dst.data[i+3]*(1-t),b=src.data[i+3]*t,total=a+b;for(let c=0;c<3;c++)dst.data[i+c]=total?(dst.data[i+c]*a+src.data[i+c]*b)/total:0;dst.data[i+3]=total}ctx.putImageData(dst,0,0)
 }return base;
}
export function loadEffectImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(Error('图片加载失败，请检查原图是否仍在素材库中。'));im.src=src})}
const cache=new Map();
async function processedURL(src,effects){
 const key=src+'|'+JSON.stringify(effects);if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit.promise}
 const entry={url:null,promise:null};entry.promise=(async()=>{const im=await loadEffectImage(src),out=renderImageEffects(im,effects),blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('图片效果生成失败。');entry.url=URL.createObjectURL(blob);return entry.url})();cache.set(key,entry);
 while(cache.size>12){const [oldKey,old]=cache.entries().next().value;cache.delete(oldKey);old.promise.then(url=>setTimeout(()=>URL.revokeObjectURL(url),10000)).catch(()=>{})}
 try{return await entry.promise}catch(e){if(cache.get(key)===entry)cache.delete(key);throw e}
}
export function attachImageEffects(img,effects){
 if(!hasImageEffects(effects))return;const original=img.src,token={};img._effectRequest=token;img.dataset.originalSrc=original;img.dataset.effectsReady='pending';
 processedURL(original,structuredClone(effects)).then(url=>{if(img._effectRequest===token){img.src=url;img.dataset.effectsReady='true'}}).catch(()=>{if(img._effectRequest===token)img.dataset.effectsReady='error'});
}

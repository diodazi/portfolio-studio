import {attachImageEffects} from './image-effects-render.js';
export const CANVAS_WIDTH=1000;
export const MAX_CANVAS_HEIGHT=12000;
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function validFrame(f){return !!f&&['x','y','width','height'].every(k=>Number.isFinite(f[k]))&&f.x>=0&&f.y>=0&&f.width>=16&&f.width<=CANVAS_WIDTH&&f.height>=16&&f.height<=8000&&f.x+f.width<=CANVAS_WIDTH+.01&&f.y+f.height<=MAX_CANVAS_HEIGHT+.01}
export function boundedFrame(frame){const width=clamp(frame.width,16,CANVAS_WIDTH),height=clamp(frame.height,16,8000);return {x:clamp(frame.x,0,CANVAS_WIDTH-width),y:clamp(frame.y,0,MAX_CANVAS_HEIGHT-height),width,height}}
export function canvasHeight(doc){return Math.min(MAX_CANVAS_HEIGHT,Math.ceil(Math.max(doc.canvas?.height||900,...doc.blocks.map(b=>b.frame?b.frame.y+b.frame.height+(b.type==='image'?76:32):0))))}
export function placeFrame(el,block,index){const f=block.frame;el.style.left=f.x+'px';el.style.top=f.y+'px';el.style.width=f.width+'px';el.style.setProperty('--object-width',f.width+'px');el.style.height=f.height+'px';el.style.zIndex=String(block.layer??index);el.dataset.fixed='true'}
const observers=new WeakMap();
export function releaseSurface(root){observers.get(root)?.disconnect();observers.delete(root)}
export function updateSurface(surface,doc){if(doc.layout!=='free')return;const height=canvasHeight(doc);surface.style.height=height+'px';surface.parentElement.style.aspectRatio=CANVAS_WIDTH+'/'+height}
export function createSurface(root,doc,{reading=false}={}){
  releaseSurface(root);root.dataset.layout=doc.layout||'flow';
  if(doc.layout!=='free')return root;
  const viewport=document.createElement('div');viewport.className='mag-canvas-viewport';
  const surface=document.createElement('div');surface.className='mag-free-surface';surface.style.width=CANVAS_WIDTH+'px';viewport.append(surface);root.append(viewport);updateSurface(surface,doc);
  const fit=()=>{const scale=viewport.classList.contains('is-original-size')?1:viewport.clientWidth/CANVAS_WIDTH;surface.style.transform=`scale(${scale})`};
  const observer=new ResizeObserver(fit);observer.observe(viewport);observers.set(root,observer);fit();
  if(reading){const tools=document.createElement('div');tools.className='mag-canvas-viewbar';const toggle=document.createElement('button');toggle.type='button';toggle.textContent='原尺寸阅读';toggle.addEventListener('click',()=>{const full=viewport.classList.toggle('is-original-size');toggle.textContent=full?'适合屏幕':'原尺寸阅读';toggle.setAttribute('aria-pressed',String(full));fit()});tools.append(toggle);root.prepend(tools)}
  return surface;
}
export function styleImage(img,b){img.style.objectFit=b.fit||'contain';img.style.transform=`translate(${b.imageOffsetX||0}%, ${b.imageOffsetY||0}%) scale(${(b.imageScale||100)/100})`}
export function makeImageFrame(b,{editing=false}={}){
  const viewport=document.createElement('div');viewport.className='mag-image-frame';
  const img=document.createElement('img');img.src=editing?'/'+b.src.slice(2):b.src;img.alt=b.caption||'';img.draggable=false;if(!editing)img.loading='lazy';styleImage(img,b);
  attachImageEffects(img,b.effects);if(b.height)viewport.style.height=b.height+'px';viewport.append(img);return viewport;
}

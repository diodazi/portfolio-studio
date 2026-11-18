import {bilibiliVideoSource} from './video-source.js';
const DB='portfolio-portfolio-preview';
export const CATEGORIES={portrait:'人像',street:'街头',stage:'演出现场'};
export function mediaKind(type=''){return type.startsWith('image/')?'photographs':type.startsWith('video/')?'videos':type.startsWith('audio/')?'audio':null;}
export function safeSource(src){if(typeof src!=='string'||!src.trim())return '';try{const url=new URL(src,globalThis.location?.href||'https://example.test/');return ['http:','https:','blob:'].includes(url.protocol)?src:'';}catch{return '';}}
export function normalizedEntry(entry){const position=entry.position==null?50:Number(entry.position);return {...entry,id:String(entry.id||''),title:String(entry.title||'未命名作品').slice(0,120),description:String(entry.description||'').slice(0,1200),category:Object.hasOwn(CATEGORIES,entry.category)?entry.category:'portrait',src:safeSource(entry.src),position:Math.max(0,Math.min(100,Number.isFinite(position)?position:50))};}
export function normalizedVideoEntry(entry){
  const item=normalizedEntry(entry);
  item.poster=safeSource(entry.poster);
  if(entry.provider==='bilibili')return {...item,src:'',bvid:bilibiliVideoSource(entry)?entry.bvid:'',page:entry.page??1};
  if(entry.provider && entry.provider!=='local')return {...item,src:''};
  return {...item,provider:'local'};
}
async function database(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('此浏览器不支持本地作品预览'));return;}const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('works',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('请关闭旧预览标签页后重试'));});}
export async function getLocalWorks(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('works','readonly');const req=tx.objectStore('works').getAll();req.onsuccess=()=>resolve(req.result.sort((a,b)=>a.created-b.created));req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
export async function saveLocalWork(item){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('works','readwrite');tx.objectStore('works').put(item);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function deleteLocalWork(id){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('works','readwrite');tx.objectStore('works').delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}

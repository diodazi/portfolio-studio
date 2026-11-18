import {validateJournal} from './journal-api.mjs';
import {validateMagazine} from '../public/magazine.js';
import {SITE_FIELDS} from '../public/site-config.js';
import {bilibiliVideoSource} from '../public/video-source.js';

const image = /\.(?:jpe?g|png|webp|avif)$/i;
const extensions = {photographs:image,videos:/\.(?:mp4|webm)$/i,audio:/\.(?:mp3|wav|ogg|m4a|flac)$/i};
const validMedia = (kind, e) => kind==='videos'
  ? e.provider==='bilibili' ? !e.src && !!bilibiliVideoSource(e) : (!e.provider || e.provider==='local') && !e.bvid && mediaPath(e.src,extensions.videos)
  : mediaPath(e.src,extensions[kind]);
export const mediaPath = (s, ext=image) => typeof s==='string' && /^\.\/assets\/media\/[\p{L}\p{N}_ .-]+$/u.test(s) && !s.includes('..') && ext.test(s);
const text = (s,n=12000) => typeof s==='string' && s.length<=n;
const id = s => typeof s==='string' && /^[-\w]{1,100}$/.test(s);
function records(a, check) {
  if(!Array.isArray(a)||a.length>4000)return false;
  const ids=new Set();
  return a.every(e=>e&&id(e.id)&&!ids.has(e.id)&&(ids.add(e.id),true)&&text(e.title,180)&&e.title.trim()&&check(e));
}
export function validateDocument(kind, doc) {
  if(!doc || typeof doc!=='object'||Array.isArray(doc))return false;
  if(kind==='site')return Object.keys(doc).every(k=>Object.hasOwn(SITE_FIELDS,k)) && Object.entries(SITE_FIELDS).every(([k,f])=>{
    const value=doc[k];if(value===undefined)return true;
    if(!text(value,f.max||12000))return false;
    if(value&&f.type==='image'&&!mediaPath(value))return false;
    if(value&&f.type==='pdf'&&!mediaPath(value,/\.pdf$/i))return false;
    return f.type!=='email'||/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
  });
  if(kind==='journal')return validateJournal(doc);
  if(kind==='content')return ['photographs','videos','audio'].every(k=>records(doc[k],e=>validMedia(k,e)&&text(e.description||'',1200)&&(!e.poster||mediaPath(e.poster))&&(!e.category||['portrait','street','stage'].includes(e.category))&&(e.position==null||Number.isFinite(e.position)&&e.position>=0&&e.position<=100))) && records(doc.projects,e=>['subtitle','role','period','highlight'].every(k=>text(e[k]||'',500))&&Array.isArray(e.description)&&e.description.length<=100&&e.description.every(t=>text(t))&&(!e.cover||mediaPath(e.cover))&&(!e.images||Array.isArray(e.images)&&e.images.length<=40&&e.images.every(s=>mediaPath(s))));
  if(kind==='writing')return records(doc.articles,e=>text(e.summary||'',1600)&&text(e.date||'',30)&&(!e.cover||mediaPath(e.cover))&&Array.isArray(e.tags)&&e.tags.length<=30&&e.tags.every(t=>text(t,60))&&(e.magazine!==undefined?validateMagazine(e.magazine):Array.isArray(e.blocks)&&e.blocks.length<=2000&&e.blocks.every(b=>b&&(['paragraph','heading','quote'].includes(b.type)?text(b.text):b.type==='image'&&mediaPath(b.src)&&text(b.text||'',500)))));
  return false;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {CoverError} from './cover-remote.mjs';
import {readGameMedia,allowedGameMediaRemote,MEDIA_SOURCES,mediaSourceFor,secureMediaURL} from './game-media-remote.mjs';
import {collectRecentMemes} from './meme-ranking.mjs';
const TTL=15*60*1000;
const clean=(v,max=240)=>String(v??'').replace(/<[^>]*>/g,'').slice(0,max);
const normalized=s=>String(s).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const memeWords=/梗图|表情|沙雕|搞笑|整活|meme|emote|emoji/i;
const groups={memes:['all','heybox','bilibili','steamcommunity','media'],logos:['steam','steamgriddb','all']};
export function decodeIndexText(s){return s.replace(/&(?:quot|#34);/g,'"').replace(/&(?:apos|#39);/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''})}
export function parseImageIndex(html){const items=[];for(const match of html.matchAll(/\bm="([^"]+)"/g)){try{const d=JSON.parse(decodeIndexText(match[1]));if(d.murl&&d.purl)items.push({title:clean(d.t),image:d.murl,page:d.purl})}catch{}}return items}
export function filteredIndexItems(items,{kind,query,provider}){const q=normalized(query);return items.flatMap(item=>{const page=secureMediaURL(item.page),image=secureMediaURL(item.image),source=page&&mediaSourceFor(page.href);if(!q||!source||!image||!allowedGameMediaRemote(image.href,source,true))return [];
 if(kind==='logos'&&(source!=='steamgriddb'||!image.pathname.toLowerCase().endsWith('.png')))return [];
 if(kind==='memes'&&(source==='steamgriddb'||provider!=='all'&&(provider==='media'?['heybox','bilibili','steamcommunity'].includes(source):source!==provider)))return [];
 if(!normalized(item.title).includes(q)||(kind==='memes'&&!memeWords.test(item.title)))return [];
 return [{title:clean(item.title),image:image.href,page:page.href,provider:source,source:MEDIA_SOURCES[source].name,kind}];
 })}
export function mediaImageInfo(bytes,type){const b=bytes;let ext;
 if(type==='image/png'&&b.length>=33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){const width=b.readUInt32BE(16),height=b.readUInt32BE(20);if(!width||!height||width>20000||height>20000)throw new CoverError('图片尺寸无效。',415);let alpha=[4,6].includes(b[25]);for(let at=8;at+12<=b.length;){const size=b.readUInt32BE(at);if(size>b.length-at-12)throw new CoverError('PNG 文件不完整。',415);const chunk=b.toString('ascii',at+4,at+8);if(chunk==='tRNS')alpha=true;at+=size+12;if(chunk==='IEND')break}return {ext:'.png',width,height,alpha}}
 if(type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)ext='.jpg';
 if(type==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')ext='.webp';
 if(type==='image/avif'&&b.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(b.toString('ascii',8,64)))ext='.avif';
 if(!ext)throw new CoverError('这条结果不是可用的 JPG、PNG、WebP 或 AVIF 图片。',415);return {ext,alpha:false};
}
export function createGameMediaService(root,{read=readGameMedia,now=Date.now,fingerprint}={}){
 const candidates=new Map(),cache=new Map(),pending=new Map(),searchCache=new Map();let cachedBytes=0,searching=0,downloading=0;
 function sweep(){for(const [k,v]of candidates)if(v.expires<now())candidates.delete(k);for(const [k,v]of searchCache)if(v.expires<now())searchCache.delete(k)}
 async function download(c,signal){if(!allowedGameMediaRemote(c.image,c.provider,true))throw new CoverError('图片来源不受支持。',400);const hit=cache.get(c.image);if(hit&&hit.expires>now())return hit.data;if(pending.has(c.image))return pending.get(c.image);if(downloading>=12)throw new CoverError('图片加载较多，请稍后重试预览。',429);downloading++;
  const promise=(async()=>{const data=await read(c.image,{provider:c.provider,image:true,signal});if(!data.bytes.length||data.bytes.length>8*1024*1024)throw new CoverError('图片为空或超过 8 MB。',413);Object.assign(data,mediaImageInfo(data.bytes,data.type));if(c.kind==='logos'&&data.ext!=='.png')throw new CoverError('该结果不是 PNG 标题标识，请选择其他结果。',415);const old=cache.get(c.image);if(old){cachedBytes-=old.data.bytes.length;cache.delete(c.image)}while(cache.size&&(cachedBytes+data.bytes.length>48*1024*1024||cache.size>=48)){const key=cache.keys().next().value;cachedBytes-=cache.get(key).data.bytes.length;cache.delete(key)}cache.set(c.image,{data,expires:now()+TTL});cachedBytes+=data.bytes.length;return data})();pending.set(c.image,promise);try{return await promise}finally{downloading--;pending.delete(c.image)}
 }
 async function json(url,options){const r=await read(url,options);try{return JSON.parse(r.bytes.toString('utf8'))}catch{throw new CoverError('搜索来源返回了无法读取的数据。')}}
 async function steamLogos(query){const result=await json('https://store.steampowered.com/api/storesearch/?term='+encodeURIComponent(query)+'&l=schinese&cc=cn',{provider:'steam'});if(!Array.isArray(result.items))throw new CoverError('Steam 搜索暂不可用。');const apps=result.items.filter(x=>x.type==='app'&&/^\d+$/.test(String(x.id))).slice(0,5);const found=await Promise.all(apps.map(async app=>{const c={kind:'logos',provider:'steam',source:'Steam 官方',title:clean(app.name),page:`https://store.steampowered.com/app/${app.id}/`};for(const base of ['https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/','https://cdn.akamai.steamstatic.com/steam/apps/']){try{c.image=base+app.id+'/logo.png';const image=await download(c);return {...c,alpha:image.alpha,width:image.width,height:image.height}}catch{}}return null}));return found.filter(Boolean)}
 function indexQuery(kind,query,provider){return kind==='logos'?query+' logo png site:steamgriddb.com':query+' 梗图'+(provider==='heybox'?' 小黑盒':provider==='bilibili'?' 哔哩哔哩':provider==='steamcommunity'?' meme site:steamcommunity.com':'')}
 async function indexSearch(kind,query,provider,{days=0,signal}={}){const term=indexQuery(kind,query,provider),urls=[`https://cn.bing.com/images/search?q=${encodeURIComponent(term)}&form=HDRSC2`,`https://www.bing.com/images/async?q=${encodeURIComponent(term)}&first=0&count=35&adlt=moderate`];if(days)for(let i=0;i<urls.length;i++)urls[i]+='&qft='+encodeURIComponent('+filterui:age-lt'+days*1440);const found=[],seen=new Set(),errors=[];let available=0;
  const fetchIndex=async url=>{try{const r=await read(url,{provider:'index',limit:4*1024*1024,signal}),html=r.bytes.toString('utf8');if(/b_captcha|verify you are human|captcha-container/i.test(html))throw new CoverError('公开图片检索暂时要求验证，请稍后重试。');available++;for(const c of filteredIndexItems(parseImageIndex(html),{kind,query,provider})){if(!seen.has(c.image)){seen.add(c.image);found.push(c)}}}catch(e){errors.push(e.message)}};
  await Promise.all(urls.map(fetchIndex));
  if(!days&&found.length<20&&kind==='memes'){try{const data=await json(`https://image.so.com/j?q=${encodeURIComponent(term)}&sn=0&pn=30`,{provider:'index',limit:4*1024*1024,signal});if(!Array.isArray(data.list))throw new CoverError('备用图片检索暂不可用。');available++;for(const c of filteredIndexItems(data.list.map(i=>({title:clean(i.title),image:i.img,page:i.link})),{kind,query,provider})){if(!seen.has(c.image)){seen.add(c.image);found.push(c)}}}catch(e){errors.push(e.message)}}
  if(!available)throw new CoverError(errors[0]||'暂时无法连接公开图片检索。');return found.slice(0,60);
 }
 async function search({kind,query,provider=kind==='logos'?'steam':'all'}={}){if(!Object.hasOwn(groups,kind)||typeof query!=='string'||!query.trim()||query.trim().length>120||/[\x00-\x1f]/.test(query)||!groups[kind].includes(provider))throw new CoverError('请输入 1–120 字的游戏名称，并选择对应来源。',400);query=query.trim();sweep();const key=JSON.stringify([kind,query,provider]),hit=searchCache.get(key);if(hit&&hit.result.items.every(i=>candidates.has(i.id)))return hit.result;if(searching>=2)throw new CoverError('正在查询，请稍后再试。',429);searching++;
  try{
   const tasks=kind==='logos'?(provider==='all'?['steam','steamgriddb']:[provider]):[provider];
   const settled=await Promise.allSettled(tasks.map(p=>kind==='memes'?collectRecentMemes({query,provider:p,indexSearch,read,download,now,fingerprint}):p==='steam'?steamLogos(query):indexSearch(kind,query,p))),items=[],sources=[];let summary;
   settled.forEach((r,i)=>{const p=tasks[i],name=p==='steam'?'Steam 官方':p==='all'?'社区与游戏媒体':p==='media'?'游戏媒体':MEDIA_SOURCES[p]?.name||p;
    if(r.status==='rejected'){sources.push({name,ok:false,message:r.reason.message});return}
    const found=kind==='memes'?r.value.items:r.value;if(kind==='memes')summary=r.value.summary;
    sources.push({name,ok:true,count:found.length,message:kind==='memes'&&p==='heybox'&&!found.length?'没有找到可公开核实并读取的相关梗图；未收录和需登录的帖子不在结果中。':''});
    for(const c of found){const id=randomUUID();candidates.set(id,{...c,query,expires:now()+TTL});items.push({id,title:c.title,source:c.source,page:c.page,kind,alpha:c.alpha,width:c.width,height:c.height,preview:'/api/manage/game-media/preview/'+id,...(kind==='memes'?{bucket:c.bucket,publishedAt:c.publishedAt,metrics:c.metrics,ageDays:c.ageDays,evidence:c.evidence}:{} )})}
   });
   while(candidates.size>240)candidates.delete(candidates.keys().next().value);const result={items,sources,...(summary?{summary}:{})};if(sources.every(s=>s.ok)&&items.length){searchCache.set(key,{result,expires:now()+3*60*1000});while(searchCache.size>12)searchCache.delete(searchCache.keys().next().value)}return result;
  }finally{searching--}
 }
 function candidate(id){sweep();const c=candidates.get(id);if(!c)throw new CoverError('这条搜索结果已过期，请重新搜索。',410);return c}
 const preview=id=>download(candidate(id));
 async function importImage({id}={}){const c=candidate(id),image=await download(c),hash=createHash('sha256').update(image.bytes).digest('hex'),filename='game-'+hash+image.ext,dir=path.join(root,'public/assets/media'),temp=path.join(dir,'.'+randomUUID()+'.tmp');await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,image.bytes,{flag:'wx'});await fs.rename(temp,path.join(dir,filename))}finally{await fs.rm(temp,{force:true})}const source={kind:c.kind==='logos'?'logo':'meme',name:c.source,title:c.title,url:c.page,...(c.kind==='memes'?{publishedAt:c.publishedAt,metrics:c.metrics,checkedAt:new Date(now()).toISOString()}:{}),downloadedAt:new Date(now()).toISOString()};return {src:'./assets/media/'+filename,name:clean(c.query+' · '+(c.kind==='logos'?'Logo':'梗图')+' · '+c.source,180),size:image.bytes.length,type:image.type,width:image.width,height:image.height,alpha:image.alpha,source,tags:[c.query.slice(0,50),c.kind==='logos'?'游戏 Logo':'游戏梗图',c.source]}}
 return {search,preview,importImage};
}

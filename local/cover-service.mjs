import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {readRemote,allowedRemote,CoverError} from './cover-remote.mjs';

export const providerNames={steam:'Steam',bangumi:'Bangumi',douban:'豆瓣',imdb:'IMDb'};
const providers={games:['steam','bangumi'],cinema:['douban','imdb']};
const ttl=15*60*1000;
const text=(value,max=180)=>String(value??'').slice(0,max);
const numeric=value=>/^\d+$/.test(String(value));
function imageType(b,type){
  if(type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)return '.jpg';
  if(type==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';
  if(type==='image/webp'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return '.webp';
  if(type==='image/avif'&&b.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(b.toString('ascii',8,64)))return '.avif';
  throw new CoverError('来源返回的不是有效图片，请选择另一张封面。',415);
}
export function createCoverService(root,{read=readRemote,now=Date.now}={}){
  const candidates=new Map(),searchCache=new Map(),imageCache=new Map(),pendingImages=new Map();
  let searches=0,downloads=0,cacheBytes=0;
  const json=async(url,options)=>{const r=await read(url,options);try{return JSON.parse(r.bytes.toString('utf8'))}catch{throw new CoverError('来源返回了无法读取的搜索结果，请更换来源。')}};
  function sweep(){for(const [id,c]of candidates)if(c.expires<now())candidates.delete(id);for(const [k,c]of searchCache)if(c.expires<now())searchCache.delete(k)}
  async function searchProvider(provider,query){
    const q=encodeURIComponent(query);
    if(provider==='steam'){
      const data=await json(`https://store.steampowered.com/api/storesearch/?term=${q}&l=schinese&cc=cn`,{provider});
      if(!Array.isArray(data.items))throw new CoverError('Steam 搜索格式已变化，请更换来源。');
      return data.items.filter(e=>e.type==='app'&&numeric(e.id)).slice(0,8).map(e=>({provider,sourceId:String(e.id),title:text(e.name),subtitle:'Steam',year:'',image:e.tiny_image,thumbnail:e.tiny_image,page:`https://store.steampowered.com/app/${e.id}/`}));
    }
    if(provider==='bangumi'){
      const data=await json('https://api.bgm.tv/v0/search/subjects?limit=8',{provider,body:{keyword:query,sort:'match',filter:{type:[4],nsfw:false}}});
      if(!Array.isArray(data.data))throw new CoverError('Bangumi 搜索格式已变化，请更换来源。');
      return data.data.filter(e=>e.type===4&&numeric(e.id)).map(e=>({provider,sourceId:String(e.id),title:text(e.name_cn||e.name),subtitle:text(e.name_cn?e.name:''),year:text(e.date,4),image:e.images?.large||e.images?.common,thumbnail:e.images?.common||e.images?.large,page:`https://bgm.tv/subject/${e.id}`}));
    }
    if(provider==='douban'){
      const data=await json(`https://movie.douban.com/j/subject_suggest?q=${q}`,{provider});
      if(!Array.isArray(data))throw new CoverError('豆瓣搜索暂不可用，请更换来源。');
      return data.filter(e=>e.type==='movie'&&numeric(e.id)).slice(0,8).map(e=>({provider,sourceId:String(e.id),title:text(e.title),subtitle:text(e.sub_title),year:text(e.year,4),image:e.img,thumbnail:e.img,page:`https://movie.douban.com/subject/${e.id}/`}));
    }
    const data=await json(`https://v3.sg.media-imdb.com/suggestion/x/${q}.json`,{provider});
    if(data.d!==undefined&&!Array.isArray(data.d))throw new CoverError('IMDb 搜索格式已变化，请更换来源。');
    return (data.d||[]).filter(e=>/^tt\d+$/.test(e.id)&&['movie','short','tvMovie'].includes(e.qid)).slice(0,8).map(e=>({provider,sourceId:e.id,title:text(e.l),subtitle:text(e.s),year:text(e.y,4),image:e.i?.imageUrl,thumbnail:e.i?.imageUrl,page:`https://www.imdb.com/title/${e.id}/`}));
  }
  async function search({kind,query,provider='all'}={}){
    if(!Object.hasOwn(providers,kind)||typeof query!=='string'||!query.trim()||query.trim().length>120||/[\x00-\x1f]/.test(query)||!(provider==='all'||providers[kind].includes(provider)))throw new CoverError('请输入 1–120 字的名称，并选择对应来源。',400);
    query=query.trim();sweep();
    const key=JSON.stringify([kind,query.toLowerCase(),provider]);const cached=searchCache.get(key);if(cached&&cached.result.items.every(item=>candidates.has(item.id)))return cached.result;searchCache.delete(key);
    if(searches>=2)throw new CoverError('正在查询，请稍后再试。',429);
    searches++;
    try{
      const chosen=provider==='all'?providers[kind]:[provider];
      const settled=await Promise.allSettled(chosen.map(p=>searchProvider(p,query)));
      const items=[],sources=[];
      settled.forEach((result,index)=>{
        const p=chosen[index];
        if(result.status==='rejected'){sources.push({provider:p,name:providerNames[p],ok:false,message:result.reason instanceof CoverError?result.reason.message:'此来源暂时无法连接。'});return}
        const found=result.value.filter(c=>c.title&&allowedRemote(c.image,p,true)&&allowedRemote(c.thumbnail,p,true));
        sources.push({provider:p,name:providerNames[p],ok:true,count:found.length});
        for(const c of found){const id=randomUUID();candidates.set(id,{...c,expires:now()+ttl});items.push({id,provider:p,source:providerNames[p],title:c.title,subtitle:c.subtitle,year:c.year,page:c.page,preview:`/api/manage/covers/preview/${id}`})}
      });
      while(candidates.size>200)candidates.delete(candidates.keys().next().value);
      const result={items,sources};
      // Do not cache failures; retry should make a real request.
      if(sources.every(s=>s.ok)){searchCache.set(key,{result,expires:now()+3*60*1000});while(searchCache.size>10)searchCache.delete(searchCache.keys().next().value)}
      return result;
    }finally{searches--}
  }
  function candidate(id){sweep();const c=candidates.get(id);if(!c)throw new CoverError('搜索结果已过期，请重新搜索。',410);return c}
  async function download(url,provider){
    if(!allowedRemote(url,provider,true))throw new CoverError('图片来源不受支持。',400);
    const cached=imageCache.get(url);if(cached&&cached.expires>now())return cached.data;
    if(pendingImages.has(url))return pendingImages.get(url);
    if(downloads>=20)throw new CoverError('正在载入封面，请稍后再试。',429);
    downloads++;
    const promise=(async()=>{
      const data=await read(url,{provider,image:true});
      if(!data.bytes.length||data.bytes.length>8*1024*1024)throw new CoverError('图片不能为空或超过 8 MB。',413);
      data.ext=imageType(data.bytes,data.type);
      const old=imageCache.get(url);if(old){cacheBytes-=old.data.bytes.length;imageCache.delete(url)}
      while(cacheBytes+data.bytes.length>24*1024*1024||imageCache.size>=32){const first=imageCache.keys().next().value;if(!first)break;cacheBytes-=imageCache.get(first).data.bytes.length;imageCache.delete(first)}
      imageCache.set(url,{data,expires:now()+ttl});cacheBytes+=data.bytes.length;return data;
    })();
    pendingImages.set(url,promise);try{return await promise}finally{downloads--;pendingImages.delete(url)}
  }
  const portrait=c=>`https://cdn.akamai.steamstatic.com/steam/apps/${c.sourceId}/library_600x900.jpg`;
  async function preview(id){const c=candidate(id);if(c.provider==='steam'){try{return await download(portrait(c),'steam')}catch{}}return download(c.thumbnail,c.provider)}
  async function importCover({id}={}){
    const c=candidate(id);let url=c.image,image;
    if(c.provider==='steam'){try{image=await download(portrait(c),'steam')}catch{}}
    if(c.provider==='steam'&&!image){
      // Use the current store-provided larger capsule; asset paths can change.
      try{const d=await json(`https://store.steampowered.com/api/appdetails?appids=${c.sourceId}&l=schinese`,{provider:'steam'});const item=d[c.sourceId]?.data;const larger=item?.header_image||item?.capsule_image;if(allowedRemote(larger,'steam',true))url=larger}catch{}
    }
    if(!image){try{image=await download(url,c.provider)}catch(error){if(url===c.image)throw error;url=c.image;image=await download(url,c.provider)}}
    const hash=createHash('sha256').update(image.bytes).digest('hex');
    const name='cover-'+hash+image.ext,dir=path.join(root,'public','assets','media');
    await fs.mkdir(dir,{recursive:true});const temp=path.join(dir,'.'+randomUUID()+'.tmp');
    try{await fs.writeFile(temp,image.bytes,{flag:'wx'});await fs.rename(temp,path.join(dir,name))}finally{await fs.rm(temp,{force:true})}
    return {src:'./assets/media/'+name,size:image.bytes.length,type:image.type,coverSource:{provider:c.provider,title:c.title,url:c.page,downloadedAt:new Date(now()).toISOString()}};
  }
  return {search,preview,importCover};
}

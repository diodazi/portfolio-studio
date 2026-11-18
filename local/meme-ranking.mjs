import {createHash} from 'node:crypto';
import sharp from 'sharp';
const DAY=86400000;
export const WINDOWS=[30,90,180,365,0];
const decode=s=>String(s).replace(/&quot;|&#34;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'");
export function validPostDate(value,now=Date.now()){
 if(typeof value!=='string'&&typeof value!=='number')return null;
 if(typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(value))return null;
 const n=typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value);
 return Number.isFinite(n)&&n>=Date.UTC(2000,0,1)&&n<=now+300000?new Date(n).toISOString():null;
}
const count=n=>(typeof n==='number'||typeof n==='string'&&/^\d+$/.test(n))&&Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<1e12?Number(n):null;
const samePage=(a,b)=>{try{const x=new URL(a),y=new URL(b);return x.hostname.replace(/^www\./,'')===y.hostname.replace(/^www\./,'')&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')}catch{return false}};
export function parsePostMetadata(html,url,now=Date.now()){
 let publishedAt=null,metrics={},evidence='';
 // Only the article itself, never related posts, page modification dates or index dates.
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(m[1])}catch{continue}
  const roots=Array.isArray(data)?data:[data],nodes=roots.flatMap(d=>d?.['@graph']||[d]);
  for(const d of nodes){if(!d||!['Article','NewsArticle','BlogPosting','DiscussionForumPosting','SocialMediaPosting'].some(t=>[d['@type']].flat().includes(t)))continue;
   const page=d.url||d.mainEntityOfPage?.['@id']||d.mainEntityOfPage||d['@id'];if(typeof page!=='string'||!samePage(page,url))continue;
   publishedAt=validPostDate(d.datePublished,now);metrics={};
   for(const stat of [d.interactionStatistic||[]].flat()){const action=typeof stat.interactionType==='string'?stat.interactionType:stat.interactionType?.['@type'];const key={LikeAction:'likes',CommentAction:'comments',ShareAction:'shares',ViewAction:'views'}[String(action).split('/').at(-1)],value=count(stat.userInteractionCount);if(key&&value!==null)metrics[key]=value}
   const comments=count(d.commentCount);if(comments!==null)metrics.comments=comments;evidence='原帖结构化数据';break;
  }
  if(evidence)break;
 }
 if(!publishedAt){for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const attrs={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))attrs[a[1].toLowerCase()]=decode(a[2]);if(['article:published_time','datepublished'].includes((attrs.property||attrs.itemprop||'').toLowerCase())){publishedAt=validPostDate(attrs.content,now);if(publishedAt)break}}}
 return {publishedAt,metrics,evidence:evidence|| (publishedAt?'原帖发布时间':'')};
}
export function parseBilibiliPost(data,id,now=Date.now()){
 const item=data?.data?.item;if(data?.code!==0||!item||String(item.id_str)!==id)return null;
 const modules=item.modules||{},stat=modules.module_stat||{},metrics={};for(const [from,to]of [['like','likes'],['comment','comments'],['forward','shares']]){const n=count(stat[from]?.count);if(n!==null)metrics[to]=n}
 return {publishedAt:validPostDate(modules.module_author?.pub_ts,now),metrics,evidence:'原帖公开互动数据'};
}
export function rankMeme(c,now=Date.now()){
 const age=c.publishedAt?Math.max(0,(now-Date.parse(c.publishedAt))/DAY):Infinity,m=c.metrics||{},verified=Number.isFinite(age)&&Object.keys(m).length>0;
 const tier=age<=30?0:age<=90?1:age<=180?2:age<=365?3:4;
 const heat=(m.likes||0)+3*(m.comments||0)+2*(m.shares||0)+.01*(m.views||0);
 return {...c,ageDays:Number.isFinite(age)?Math.floor(age):null,verified,tier,score:heat/(1+age/30),bucket:verified?(age<=180?'recent':'older'):'supplement'};
}
export function compareMemes(a,b){const supplementRank=c=>c.publishedAt?c.tier:WINDOWS.indexOf(c.discoveryWindow??0);return Number(b.verified)-Number(a.verified)||(a.verified?a.tier-b.tier||b.score-a.score:supplementRank(a)-supplementRank(b))||(b.publishedAt||'').localeCompare(a.publishedAt||'')||a.page.localeCompare(b.page)||a.image.localeCompare(b.image)}
export async function imageFingerprint(bytes){
 const {data,info}=await sharp(bytes,{limitInputPixels:40000000,failOn:'error'}).rotate().flatten({background:'#fff'}).resize(64,64,{fit:'fill'}).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
 if(info.width!==64||info.height!==64)throw Error('无法读取图片');return {sha:createHash('sha256').update(bytes).digest('hex'),pixels:data};
}
export function duplicateImage(a,b){if(a.sha===b.sha)return true;if(!a.pixels||!b.pixels||a.pixels.length!==b.pixels.length)return false;let total=0,changed=0;for(let i=0;i<a.pixels.length;i++){const d=Math.abs(a.pixels[i]-b.pixels[i]);total+=d;if(d>12)changed++}return total/a.pixels.length<.65&&changed/a.pixels.length<.002}
export async function mapLimit(items,limit,fn){let at=0;const results=[];await Promise.all(Array.from({length:Math.min(items.length,limit)},async()=>{for(;;){const i=at++;if(i>=items.length)return;results[i]=await fn(items[i],i)}}));return results}

export async function collectRecentMemes({query,provider,indexSearch,read,download,now=Date.now,fingerprint=imageFingerprint}){
 const began=Date.now(),deadline=AbortSignal.timeout(85000),pool=new Map(),posts=new Map(),fingerprints=new Map(),tried=new Set(),issues=new Set(),expanded=[];let duplicates=0,unavailable=0,indexOK=0;
 const withinBudget=()=>Date.now()-began<78000;
 async function metadata(c){if(posts.has(c.page))return posts.get(c.page);if(posts.size>=48)return {publishedAt:null,metrics:{},evidence:''};const task=(async()=>{
  try{const r=await read(c.page,{provider:c.provider,limit:2*1024*1024,signal:AbortSignal.any([deadline,AbortSignal.timeout(5000)])});const html=r.bytes.toString('utf8');if(/risk-captcha|验证码|verify you are human/i.test(html))throw Error('原帖要求验证');const meta=parsePostMetadata(html,c.page,now());if(meta.publishedAt&&Object.keys(meta.metrics).length)return meta;
   const id=c.provider==='bilibili'&&/^\/opus\/(\d+)$/.exec(new URL(c.page).pathname)?.[1];if(id){try{const r=await read('https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id='+id,{provider:'bilibili-stats',limit:1024*1024,signal:AbortSignal.any([deadline,AbortSignal.timeout(5000)])}),data=parseBilibiliPost(JSON.parse(r.bytes),id,now());if(data)return data}catch{}}
   return meta;
  }catch{issues.add(c.source+'：原帖时间或互动数暂不可核实');return {publishedAt:null,metrics:{},evidence:''}}
 })();posts.set(c.page,task);return task}
 async function unique(sorted,limit){const selected=[],prints=[];for(let offset=0;offset<sorted.length&&selected.length<limit;offset+=6){const batch=sorted.slice(offset,offset+6);await mapLimit(batch,4,async c=>{if(tried.has(c.image)||!withinBudget())return;tried.add(c.image);try{const image=await download(c,deadline);fingerprints.set(c.image,await fingerprint(image.bytes))}catch{unavailable++}});for(const c of batch){if(selected.length>=limit)break;const print=fingerprints.get(c.image);if(!print)continue;if(prints.some(p=>duplicateImage(p,print))){continue}selected.push(c);prints.push(print)}}return selected}
 let main=[];
 for(const days of WINDOWS){if(Date.now()-began>55000)break;expanded.push(days);try{const results=await indexSearch('memes',query,provider,{days,signal:deadline});indexOK++;const fresh=results.filter(c=>!pool.has(c.image)).slice(0,45);for(const c of fresh){c.discoveryWindow=days;pool.set(c.image,c)}await mapLimit(fresh,6,async c=>Object.assign(c,await metadata(c)));}catch(e){issues.add(e.message)}
  const verified=[...pool.values()].map(c=>rankMeme(c,now())).filter(c=>c.verified&&(!days||c.ageDays<=days)).sort(compareMemes);main=await unique(verified,20);if(main.length>=20)break;
 }
 const sorted=[...pool.values()].map(c=>rankMeme(c,now())).sort(compareMemes),items=await unique(sorted,20);
 const usable=[...fingerprints.values()];for(let i=0;i<usable.length;i++)if(usable.slice(0,i).some(p=>duplicateImage(p,usable[i])))duplicates++;
 if(!indexOK)throw Error([...issues][0]||'暂时无法连接图片检索。');
 return {items,summary:{target:20,recent:items.filter(c=>c.bucket==='recent').length,older:items.filter(c=>c.bucket==='older').length,supplement:items.filter(c=>c.bucket==='supplement').length,expanded,duplicates,unavailable,checkedPosts:posts.size,checkedImages:tried.size,limited:!withinBudget()||(expanded.at(-1)!==0&&main.length<20),issues:[...issues],checkedAt:new Date(now()).toISOString()}};
}

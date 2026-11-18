import {validateGameBook,validateShortReview} from '../public/game-review-model.js';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateMagazine} from '../public/magazine.js';
const limit=2*1024*1024;
const tag=bytes=>'"'+createHash('sha256').update(bytes).digest('hex')+'"';
export function validateJournal(doc){
  if(!doc || typeof doc!=='object' || Array.isArray(doc))return false;
  for(const k of ['games','cinema']){
    if(!Array.isArray(doc[k])||doc[k].length>4000)return false;
    const ids=new Set();
    for(const e of doc[k]){
      if(!e||typeof e.id!=='string'||!/^[-\w]{1,100}$/.test(e.id)||ids.has(e.id)||typeof e.title!=='string'||!e.title.trim()||e.title.length>180)return false;
      ids.add(e.id);
      if(k==='games'&&((e.reviewType!==undefined&&!['brief','detailed'].includes(e.reviewType))||(e.shortReview!==undefined&&!validateShortReview(e.shortReview))||(e.gameBook!==undefined&&!validateGameBook(e.gameBook))))return false;
      if(e.magazine!==undefined&&!validateMagazine(e.magazine))return false;
      for(const f of ['note','cover','date',...(k==='games'?['status','platform','hours']:['year','director','rating'])]){
        if(e[f]!==undefined&&(typeof e[f]!=='string'||e[f].length>(f==='note'?12000:350)))return false;
      }
      if(e.cover&&!/^\.\/assets\/media\/(?!.*\.\.)[\p{L}\p{N}_ .\/-]+\.(?:jpe?g|webp|png|avif)$/iu.test(e.cover))return false;
      if(e.coverSource!==undefined&&e.coverSource!==null){
        const s=e.coverSource,patterns={steam:/^https:\/\/store\.steampowered\.com\/app\/\d+\/$/,bangumi:/^https:\/\/bgm\.tv\/subject\/\d+$/,douban:/^https:\/\/movie\.douban\.com\/subject\/\d+\/$/,imdb:/^https:\/\/www\.imdb\.com\/title\/tt\d+\/$/};
        if(!e.cover||typeof s!=='object'||Array.isArray(s)||!Object.hasOwn(patterns,s.provider)||!patterns[s.provider].test(s.url)||typeof s.title!=='string'||s.title.length>180||typeof s.downloadedAt!=='string'||s.downloadedAt.length>40||!Number.isFinite(Date.parse(s.downloadedAt)))return false;
      }
      if(e.date && (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date))return false;
      if(k==='games'&&((e.hours&&!/^\d{1,6}(\.\d)?$/.test(e.hours))||(e.status&&!['在玩','已通关','已游玩','搁置'].includes(e.status))))return false;
      if(k==='cinema'&&((e.year&&!/^\d{4}$/.test(e.year))||(e.rating&&!/^[1-5]$/.test(e.rating))))return false;
    }
  }
  return true;
}
export async function journalAPI(req,res,file,port){
  const send=(code,body,headers={})=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(body)};
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return send(403,'{}');
    if(req.method==='GET'){const buf=fs.readFileSync(file);return send(200,buf,{ETag:tag(buf)})}
    if(req.method!=='PUT')return send(405,'{}',{Allow:'GET, PUT'});
    if(req.headers.origin!=='http://'+req.headers.host || req.headers['content-type']!=='application/json')return send(403,'{}');
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)return send(413,'{}');chunks.push(chunk)}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(400,'{}')}
    if(!validateJournal(data))return send(422,'{}');
    // Synchronous compare and rename run together so a second editor cannot overwrite newer work.
    const previous=fs.readFileSync(file);
    if(req.headers['if-match']!==tag(previous))return send(409,'{}');
    const next=Buffer.from(JSON.stringify(data,null,2)+'\n');
    if(next.length>limit)return send(413,'{}');
    const backupDir=path.resolve(path.dirname(file),'../.local');fs.mkdirSync(backupDir,{recursive:true});
    fs.writeFileSync(path.join(backupDir,'journal.previous.json'),previous);
    const tmp=file+'.'+randomUUID()+'.tmp';
    try{fs.writeFileSync(tmp,next);fs.renameSync(tmp,file)}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
    return send(200,'{"ok":true}',{ETag:tag(next)});
  }catch{return send(500,'{}')}
}


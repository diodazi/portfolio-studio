import {applySiteConfig} from './site-config.js';
applySiteConfig();
const kind=document.body.dataset.kind;
const games=kind==='games';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
function row(entry){
  const article=node('article','record-row'), side=node('div','record-side'), body=node('div');
  if(entry.date){const time=node('time','record-when',entry.date);time.dateTime=entry.date;side.append(time)}
  if(entry.cover && /^\.\/assets\/media\/(?!.*\.\.)[^?#\\\\]+$/u.test(entry.cover)){
    const img=node('img','record-cover');img.alt='';img.loading='lazy';img.src=entry.cover;img.addEventListener('error',()=>img.remove(),{once:true});side.append(img);
  }
  const meta=games?[entry.platform,entry.status,entry.hours!==''&&entry.hours!=null?entry.hours+' 小时':'']:[entry.year,entry.director,entry.rating?entry.rating+' / 5 星':''];
  body.append(node('h3','',entry.title));if(meta.filter(Boolean).length)body.append(node('p','record-meta',meta.filter(Boolean).join(' · ')));
  if(entry.note)body.append(node('p','record-note',entry.note));
  article.append(side,body);return article;
}
async function load(){
  const status=document.querySelector('#list-status');
  try{const res=await fetch('./journal.json',{cache:'no-cache'});if(!res.ok)throw Error();const data=await res.json();if(!Array.isArray(data[kind]))throw Error();
    const entries=data[kind].filter(e=>e&&typeof e.title==='string'&&e.title.trim()).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    document.querySelector('#record-list').replaceChildren(...entries.map(row));document.querySelector('#record-count').textContent=entries.length+(games?' 款游戏':' 部电影');
    status.textContent=games?'还没有公开的游戏记录。':'还没有公开的观影记录。';status.hidden=entries.length>0;
  }catch{status.hidden=false;status.textContent='暂时无法载入记录。 ';const retry=node('button','glass-button','重试');retry.addEventListener('click',load,{once:true});status.append(retry)}
}
load();

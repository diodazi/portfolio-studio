import {applySiteConfig} from './site-config.js';
import {imagePath} from './magazine.js';
applySiteConfig();
const kind=document.body.dataset.kind,games=kind==='games',node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e};
let entries=[];
const root=document.querySelector('#record-list'),status=document.querySelector('#list-status');
const tools=node('div','library-tools'),search=node('input','library-search');search.type='search';search.placeholder=games?'搜索游戏名称':'搜索电影名称';search.setAttribute('aria-label',search.placeholder);
const sort=node('select','library-sort');sort.setAttribute('aria-label','排列方式');for(const [value,label]of [['date','最近记录'],['title','按名称排列'],['value',games?'按游玩时长':'按个人评分']]){const o=node('option','',label);o.value=value;sort.append(o)}tools.append(search,sort);root.before(tools);root.className='library-grid';
function tile(e){
  const a=node('a','library-tile');a.href=`./journal-entry.html?kind=${kind}&id=${encodeURIComponent(e.id)}`;a.setAttribute('aria-label','阅读：'+e.title);
  const cover=node('div','library-cover'),fallback=node('span','library-cover-type',e.title);cover.append(fallback);
  if(imagePath(e.cover)){const img=node('img','');img.src=e.cover;img.alt='';img.loading='lazy';img.width=600;img.height=900;img.addEventListener('error',()=>img.remove(),{once:true});cover.append(img)}
  cover.append(node('span','library-open','阅读手记 ↗'));a.append(cover,node('h3','',e.title));
  const meta=games?[e.platform,e.status]:[e.year,e.rating?e.rating+' / 5 星':''];if(meta.some(Boolean))a.append(node('p','library-meta',meta.filter(Boolean).join(' · ')));return a;
}
function render(){
  const q=search.value.trim().toLocaleLowerCase();const shown=entries.filter(e=>e.title.toLocaleLowerCase().includes(q)).sort((a,b)=>sort.value==='title'?a.title.localeCompare(b.title,'zh-CN'):sort.value==='value'?Number(b[games?'hours':'rating']||0)-Number(a[games?'hours':'rating']||0):String(b.date||'').localeCompare(String(a.date||'')));
  root.replaceChildren(...shown.map(tile));document.querySelector('#record-count').textContent=entries.length+(games?' 款游戏':' 部电影');
  status.hidden=shown.length>0;status.textContent=entries.length?'没有找到匹配的作品。':games?'游戏收藏即将展开。':'观影手记正在整理。';
}
search.addEventListener('input',render);sort.addEventListener('change',render);
async function load(){try{const r=await fetch('./journal.json',{cache:'no-cache'});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data[kind]))throw Error();entries=data[kind].filter(e=>e&&typeof e.title==='string'&&e.title.trim()&&typeof e.id==='string');render()}catch{status.hidden=false;status.textContent='暂时无法载入记录。';const retry=node('button','glass-button','重试');retry.addEventListener('click',load);status.append(retry)}}
load();

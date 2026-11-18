import {reviewType,shortReviewFor} from './game-review-model.js';
import {shuffle} from './photo-layout.js';

const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
const localImage=value=>typeof value==='string'&&/^\.\/assets\/media\/(?!.*\.\.)[^?#\\]+\.(?:jpe?g|png|webp|avif)$/iu.test(value);
const articleURL=(kind,entry)=>`./journal-entry.html?kind=${kind}&id=${encodeURIComponent(entry.id)}`;
const published=items=>Array.isArray(items)?items.filter((e,i,all)=>e&&e.id&&e.title&&e.published!==false&&all.findIndex(x=>x?.id===e.id)===i):[];
const written=entry=>shortReviewFor(entry).body.some(run=>run.text?.trim());
const stateOf=entry=>reviewType(entry)==='detailed'?'detailed':written(entry)?'brief':'pending';
const actionLabel={detailed:'翻阅详评',brief:'阅读简评',pending:'待写简评'};
let readerReady;
function loadReader(){
  if(!readerReady){
    const css=new Promise((resolve,reject)=>{const link=node('link');link.rel='stylesheet';link.href='./game-review.css';link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('reader styles'))};document.head.append(link)});
    readerReady=Promise.all([import('./game-book-reader.js'),css]).then(([reader])=>reader).catch(error=>{readerReady=null;throw error});
  }
  return readerReady;
}
function bindShortReview(link,entry){
  if(reviewType(entry)!=='brief')return;
  let opening=false;
  link.addEventListener('click',async event=>{
    if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();if(opening)return;opening=true;link.setAttribute('aria-busy','true');
    try{const {openShortReview}=await loadReader();link.focus({preventScroll:true});openShortReview(entry)}
    catch{location.assign(link.href)}finally{opening=false;link.removeAttribute('aria-busy')}
  });
}
function gameCover(entry,duplicate=false){
  const state=stateOf(entry),link=node('a','game-cover');link.href=articleURL('games',entry);link.dataset.review=state;link.dataset.entryId=entry.id;
  link.title=entry.title+' · '+actionLabel[state];link.setAttribute('aria-label',link.title);if(duplicate)link.tabIndex=-1;
  link.append(node('span','game-cover-fallback',entry.title));
  if(localImage(entry.cover)){const img=node('img');img.src=entry.cover;img.alt='';img.width=600;img.height=900;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});link.append(img)}
  const caption=node('span','game-cover-caption');caption.append(node('span','game-cover-title',entry.title),node('span','game-cover-action',actionLabel[state]));link.append(caption);bindShortReview(link,entry);return link;
}
function bindWallMotion(wall,toggle){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),hover=matchMedia('(hover: hover) and (pointer: fine)');
  let manual=false,visible=false,hovered=false,pressed=false;
  function sync(){
    const globalPaused=document.documentElement.dataset.motion==='paused';
    const focused=wall.contains(document.activeElement),blocked=reduced.matches||globalPaused;
    wall.dataset.running=String(visible&&!manual&&!blocked&&!hovered&&!pressed&&!focused&&!document.hidden&&!document.querySelector('dialog[open]'));
    toggle.disabled=blocked;toggle.setAttribute('aria-pressed',String(manual||blocked));
    toggle.querySelector('.wall-motion-label').textContent=reduced.matches?'静态展示':globalPaused?'动效已暂停':manual?'继续滚动':'暂停滚动';
    toggle.querySelector('.wall-motion-icon').textContent=manual||blocked?'▷':'Ⅱ';
  }
  toggle.addEventListener('click',()=>{manual=!manual;sync()});
  wall.addEventListener('pointerenter',()=>{hovered=hover.matches;sync()});
  wall.addEventListener('pointerleave',()=>{hovered=false;sync()});
  wall.addEventListener('pointerdown',()=>{pressed=true;sync()});
  window.addEventListener('pointerup',()=>{pressed=false;sync()},{passive:true});
  window.addEventListener('pointercancel',()=>{pressed=false;sync()},{passive:true});
  wall.addEventListener('focusin',event=>{
    if(event.target.matches(':focus-visible')){wall.dataset.keyboard='true';requestAnimationFrame(()=>event.target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}))}
    sync();
  });
  wall.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(!wall.contains(document.activeElement)){delete wall.dataset.keyboard;wall.scrollTop=wall.scrollLeft=0}sync()}));
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:0}).observe(wall);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class'],childList:true});
  window.addEventListener('portfolio-motion-change',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
}
function renderGames(games){
  const wall=document.querySelector('#game-wall'),grid=document.querySelector('#game-cover-grid'),status=document.querySelector('#game-wall-status'),toggle=document.querySelector('#wall-motion-toggle');
  const detailed=games.filter(e=>reviewType(e)==='detailed'),brief=games.filter(e=>reviewType(e)==='brief'&&written(e));
  const count=document.querySelector('#home-game-count');count.textContent=`${games.length} 款游戏${detailed.length?' · '+detailed.length+' 篇详评':''}`;count.hidden=false;
  if(!games.length){status.textContent='游戏评价正在整理';return}
  // Sample all published games without replacement once per page load.
  const selected=shuffle(games).slice(0,20);
  const lanes=Array.from({length:5},()=>[]);selected.forEach((entry,i)=>lanes[i%5].push(entry));
  for(let i=0;i<lanes.length;i++){
    const items=lanes[i].length?lanes[i]:[selected[i%selected.length]],lane=node('div','cover-lane');
    // A short library still fills the frame; repeats do not enter the tab order twice.
    const full=Array.from({length:Math.max(4,items.length)},(_,n)=>items[n%items.length]);
    lane.style.setProperty('--drift-duration',`${115+i*9}s`);lane.style.setProperty('--drift-delay',`${-i*3}s`);
    for(let copy=0;copy<2;copy++){
      const set=node('div','cover-set');if(copy)set.setAttribute('aria-hidden','true');
      full.forEach((entry,n)=>{const duplicate=copy>0||n>=items.length||lanes[i].length===0;const card=gameCover(entry,duplicate);if(duplicate)card.setAttribute('aria-hidden','true');set.append(card)});lane.append(set);
    }
    grid.append(lane);
  }
  const featured=[...detailed,...brief].slice(0,2),picks=document.querySelector('#game-reading-picks');
  if(featured.length){picks.hidden=false;for(const entry of featured){const a=node('a');a.href=articleURL('games',entry);a.append(node('span','',entry.title),node('b','','↗'));a.setAttribute('aria-label',actionLabel[stateOf(entry)]+'：'+entry.title);bindShortReview(a,entry);document.querySelector('#game-featured-links').append(a)}}
  status.hidden=true;toggle.hidden=false;bindWallMotion(wall,toggle);
}
function renderCinema(cinema){
  const status=document.querySelector('#home-cinema-status');
  if(!cinema.length){status.textContent='看过的电影，和想留下的片刻。';return}
  const grid=document.querySelector('#home-cinema-posters');grid.hidden=false;document.querySelector('#home-cinema-empty').hidden=true;
  status.textContent=`${cinema.length} 部电影，点击海报阅读观影手记。`;
  for(const entry of cinema.slice(0,3)){
    const a=node('a','cinema-home-poster');a.href=articleURL('cinema',entry);a.setAttribute('aria-label','阅读观影手记：'+entry.title);
    const art=node('span','cinema-poster-art');art.append(node('span','',entry.title));
    if(localImage(entry.cover)){const img=node('img');img.src=entry.cover;img.alt='';img.loading='lazy';img.width=600;img.height=900;img.onerror=()=>img.remove();art.append(img)}
    a.append(art,node('h3','',entry.title),node('p','','阅读手记 ↗'));grid.append(a);
  }
}
export async function mountHomeCollections(){
  try{
    const response=await fetch('./journal.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('collections');
    const data=await response.json();renderGames(published(data.games));renderCinema(published(data.cinema));
  }catch{
    document.querySelector('#game-wall-status').textContent='封面暂未载入，可通过“查看全部游戏”继续浏览。';
    document.querySelector('#home-cinema-status').textContent='片单暂未载入，可通过“查看全部电影”继续浏览。';
    document.querySelector('#home-cinema-empty p').textContent='片单暂未载入';
  }
}

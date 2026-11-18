import {CATEGORIES} from './storage.js';
import {createPhotoDeck,composePhotos,collageGeometry,photoRatio,randomInt} from './photo-layout.js';
import {createPhotoViewer} from './photo-viewer.js';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const previewPath=value=>typeof value==='string'&&/^\.\/assets\/photo-previews\/[a-f0-9]{24}-(640|1600)\.webp$/.test(value);
export async function mountPhotography({works,onRefresh=()=>{},archive=false}){
  const $=s=>document.querySelector(s),grid=$('#photo-grid'),status=$('#collection-status');
  let metadata={};try{const response=await fetch('./photography-index.json',{cache:'no-cache',signal:AbortSignal.timeout(5000)});if(response.ok)metadata=(await response.json()).photos||{}}catch{}
  const photos=works.map(p=>{const m=metadata[p.src];return {...p,width:m?.width||p.width,height:m?.height||p.height,small:previewPath(m?.small)?m.small:p.src,large:previewPath(m?.large)?m.large:p.src}});
  const cache=new Map();let category=null,shown=[],current=null,lastFocus=null,raf=0;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)'),pointer=matchMedia('(pointer:fine)');
  const viewer=createPhotoViewer({dialog:$('#work-dialog'),onClose:()=>updateRoute({work:null},true),onStep:next});
  const reveal=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.add('is-visible');reveal.unobserve(target)}}),{threshold:.08});
  const storageKey=key=>'portfolio-photo-selection-v1:'+key;
  function selection(key){
    if(!cache.has(key)){
      const pool=photos.filter(p=>key==='all'||p.category===key);let previous=[];
      try{previous=JSON.parse(sessionStorage.getItem(storageKey(key))||'[]');if(!Array.isArray(previous))previous=[]}catch{}
      const deck=createPhotoDeck(pool,{previous}),items=deck.next(archive?pool.length:6);
      cache.set(key,{pool,deck,items,limit:12,variant:randomInt(3)});
    }return cache.get(key);
  }
  function remember(items){try{sessionStorage.setItem(storageKey(category),JSON.stringify(items.map(p=>p.id)))}catch{}}
  function updateRoute(values,replace=false){
    const url=new URL(location.href);for(const [k,v]of Object.entries(values)){if(v===null)url.searchParams.delete(k);else url.searchParams.set(k,v)}
    history[replace?'replaceState':'pushState']({portfolio:true},'',url);syncRoute();window.dispatchEvent(new Event('portfolio-route-change'));
  }
  function tile(p,index){
    const card=el('article','photo-card'),button=el('button','photo-button');card.dataset.exhibit='';card.style.setProperty('--reveal-delay',index*65+'ms');
    button.type='button';button.dataset.workId=p.id;button.dataset.fixedFrame='true';button.setAttribute('aria-label','查看摄影作品：'+p.title);
    const image=el('img');image.src=p.small;image.alt=p.description||p.title;image.width=p.width||1000;image.height=p.height||1000;image.loading='lazy';image.decoding='async';
    if(previewPath(p.small)&&previewPath(p.large)&&p.width&&p.height){const ratio=photoRatio(p);image.srcset=`${p.small} ${Math.round(Math.min(p.width,640*Math.min(1,ratio)))}w, ${p.large} ${Math.round(Math.min(p.width,1600*Math.min(1,ratio)))}w`;image.sizes='(max-width:680px) 70vw, 45vw'}
    image.addEventListener('error',()=>{if(image.getAttribute('src')!==p.src){image.removeAttribute('srcset');image.src=p.src}else{button.classList.add('broken-photo');image.alt='图片未能加载：'+p.title}});
    image.addEventListener('load',()=>{if(!p.width||!p.height){p.width=image.naturalWidth;p.height=image.naturalHeight;fit()}});
    const title=el('span','photo-caption',p.title);title.setAttribute('aria-hidden','true');button.append(image,title);
    button.addEventListener('click',()=>{lastFocus=button;updateRoute({work:p.id,project:null})});card.append(button);return card;
  }
  function fit(){
    cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const mobile=innerWidth<=680;
      for(const exhibit of grid.children){
        const width=exhibit.clientWidth,height=mobile?width*2.36:Math.min(width*7/12,Math.max(420,innerHeight*.83),810);
        exhibit.style.height=height+'px';
        const geometry=collageGeometry(exhibit._photos,width,height,{mobile,variant:Number(exhibit.dataset.variant)});
        [...exhibit.querySelectorAll('.photo-card')].forEach((card,i)=>{
          const g=geometry[i];Object.assign(card.style,{left:g.x+'px',top:g.y+'px',width:g.width+'px',height:g.height+'px'});
          card.style.setProperty('--photo-depth',String(g.z));card.style.setProperty('--photo-angle',g.angle+'deg');
        });
      }
    });
  }
  function renderExhibits(){
    reveal.disconnect();grid.replaceChildren();const variant=selection(category).variant;
    for(let i=0;i<shown.length;i+=6){
      const exhibit=el('div','photo-exhibit');exhibit.dataset.variant=(variant+i/6)%3;exhibit._photos=shown.slice(i,i+6);
      const glass=el('div','photo-glass'),contour=el('div','photo-contour');glass.setAttribute('aria-hidden','true');contour.setAttribute('aria-hidden','true');
      exhibit.append(glass,contour,...exhibit._photos.map(tile));grid.append(exhibit);reveal.observe(exhibit);
      exhibit.addEventListener('focusin',()=>exhibit.classList.add('is-visible'));
    }
    fit();onRefresh();animateLight();
  }
  function render(){
    const item=selection(category),items=archive?item.items.slice(0,item.limit):item.items;
    shown=[];for(let i=0;i<items.length;i+=6)shown.push(...composePhotos(items.slice(i,i+6),(item.variant+i/6)%3));
    remember(item.items.slice(0,6));renderExhibits();
    document.querySelectorAll('.filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));
    $('#photo-empty').hidden=shown.length>0;
    status.textContent=shown.length?(archive?`${CATEGORIES[category]||'全部摄影'} · ${shown.length} / ${item.pool.length} 张`:`已更换摄影选展，共 ${shown.length} 张。`):photos.length?'这个分类暂时没有作品。':'摄影作品正在整理。';
    $('#shuffle-photos').disabled=item.pool.length<2;
    const more=$('#load-more-photos');if(more){more.hidden=shown.length>=item.pool.length;more.textContent=`再看 ${Math.min(12,item.pool.length-shown.length)} 张`}
    const all=$('#all-photography');if(all){all.href='./photography.html';all.querySelector('span').textContent='查看全部摄影'+(photos.length?'（'+photos.length+'）':'')}
  }
  function readingList(id){return shown.some(p=>p.id===id)?shown:selection(category).pool}
  function showWork(id){const photo=photos.find(p=>p.id===id),list=readingList(id);current=photo?.id||null;viewer.show(photo,{index:list.findIndex(p=>p.id===id),total:list.length,focus:lastFocus})}
  function next(delta){const list=readingList(current);if(!list.length)return;const i=list.findIndex(p=>p.id===current);updateRoute({work:list[(i+delta+list.length)%list.length].id},true)}
  function syncRoute(){const params=new URLSearchParams(location.search),key=archive&&Object.hasOwn(CATEGORIES,params.get('category'))?params.get('category'):'all';if(key!==category){category=key;render()}showWork(params.get('work'))}
  document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>updateRoute({category:b.dataset.category==='all'?null:b.dataset.category,work:null})));
  $('#shuffle-photos').addEventListener('click',()=>{const item=selection(category);item.items=item.deck.next(archive?item.pool.length:6);item.limit=12;item.variant=(item.variant+1+randomInt(2))%3;render()});
  $('#load-more-photos')?.addEventListener('click',()=>{const oldLength=shown.length;selection(category).limit+=12;render();grid.querySelectorAll('.photo-button')[oldLength]?.focus({preventScroll:true})});
  // Event-driven light and depth: no animation loop when the page is idle.
  let lightFrame=0,mouseX=0,mouseY=0;
  function animateLight(){
    if(lightFrame)return;lightFrame=requestAnimationFrame(()=>{
      lightFrame=0;const enabled=!reduced.matches&&document.documentElement.dataset.motion!=='paused'&&!document.hidden;
      for(const exhibit of grid.children){
        const rect=exhibit.getBoundingClientRect(),progress=enabled?Math.max(-1,Math.min(1,(innerHeight/2-rect.top-rect.height/2)/innerHeight)):0;
        exhibit.style.setProperty('--light-x',(enabled?mouseX*14:0)+'px');exhibit.style.setProperty('--light-y',(enabled?mouseY*10:0)+'px');exhibit.style.setProperty('--scroll-depth',progress*26+'px');
      }
    });
  }
  grid.addEventListener('pointermove',event=>{if(!pointer.matches)return;const rect=grid.getBoundingClientRect();mouseX=(event.clientX-rect.left)/rect.width-.5;mouseY=(event.clientY%innerHeight)/innerHeight-.5;animateLight()},{passive:true});
  grid.addEventListener('pointerleave',()=>{mouseX=mouseY=0;animateLight()});
  window.addEventListener('scroll',animateLight,{passive:true});reduced.addEventListener('change',animateLight);
  new MutationObserver(animateLight).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  window.addEventListener('popstate',syncRoute);window.addEventListener('resize',fit);new ResizeObserver(fit).observe(grid);
  syncRoute();return {syncRoute};
}

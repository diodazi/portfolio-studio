import {getLocalWorks,normalizedEntry,normalizedVideoEntry} from './storage.js';
import {bilibiliVideoSource} from './video-source.js';
import {applySiteConfig} from './site-config.js';
import {mountLightField} from './art.js';
import {mountStageBook} from './stage-book.js';
import {mountMediaExperience} from './media-experience.js';
import {mountPageMotion} from './motion.js';
import {mountHomeCollections} from './home-collections.js';
import {mountPhotography} from './photo-experience.js';
await applySiteConfig();
const pageMotion=mountPageMotion();
const collectionsReady=mountHomeCollections();
const initialHash=location.hash;let anchorCancelled=false;
for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,()=>{anchorCancelled=true},{once:true,passive:true});
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const state={photographs:[],videos:[],audio:[],projects:[],lastFocus:null};const objectURLs=[];let toastTimer;let photoExperience;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function writeRoute(values,replace=false){const url=new URL(location.href);for(const [k,v]of Object.entries(values)){if(v===null)url.searchParams.delete(k);else url.searchParams.set(k,v);}history[replace?'replaceState':'pushState']({portfolio:true},'',url);applyRoute();}
function renderProjects(){mountStageBook($('#project-list'),state.projects,(project,trigger)=>{state.lastFocus=trigger;writeRoute({project:project.id,work:null});});}
function setDialogOpen(dialog,open){if(open&&!dialog.open){dialog.showModal();document.body.classList.add('modal-open');}if(!open&&dialog.open){dialog.close();if(!$$('dialog[open]').length)document.body.classList.remove('modal-open');const focusTarget=state.lastFocus?.isConnected?state.lastFocus:$$('.photo-button').find(b=>b.dataset.workId===state.lastFocus?.dataset.workId);focusTarget?.focus({preventScroll:true});}}
function showProject(id){const p=state.projects.find(x=>x.id===id);const dialog=$('#project-dialog');if(!p){setDialogOpen(dialog,false);return;}$('#project-title').textContent='《'+p.title+'》';$('#project-role').textContent=p.role;$('#project-period').textContent=p.period+' · '+p.highlight;const details=$('#project-description');details.replaceChildren(...(p.description||[]).map(t=>el('p','',t)));const sources=[p.cover,...(p.images||[])].filter(Boolean);if(sources.length){const gallery=el('div','project-gallery');for(const src of [...new Set(sources)]){if(!/^\.\/assets\/media\/(?!.*\.\.)[^?#\\]+\.(?:jpe?g|png|webp|avif)$/iu.test(src))continue;const image=el('img');image.src=src;image.alt=p.title+' · 项目现场';image.loading='lazy';gallery.append(image)}details.append(gallery)}setDialogOpen(dialog,true);}
function applyRoute(){photoExperience?.syncRoute();showProject(new URLSearchParams(location.search).get('project'));}
function closeDialog(dialog){writeRoute({[dialog.id==='work-dialog'?'work':'project']:null},true);}
window.addEventListener('popstate',applyRoute);window.addEventListener('portfolio-route-change',applyRoute);
$$('#project-dialog').forEach(dialog=>{dialog.querySelector('[data-close]').addEventListener('click',()=>closeDialog(dialog));dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog(dialog);});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});});
const menu=$('.menu-toggle');menu.addEventListener('click',()=>{const open=$('#navigation').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'关闭导航':'打开导航');if(open)$('#navigation a').focus();});$$('#navigation a').forEach(a=>a.addEventListener('click',()=>{const wasOpen=$('#navigation').classList.contains('open');$('#navigation').classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','打开导航');if(wasOpen){const heading=$(a.hash)?.querySelector('h2');heading?.setAttribute('tabindex','-1');requestAnimationFrame(()=>heading?.focus({preventScroll:true}));}}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#navigation').classList.contains('open')){menu.click();menu.focus();}});
const observer=new IntersectionObserver(entries=>{const e=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(e)$$('#navigation a').forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});},{rootMargin:'-15% 0px -45% 0px',threshold:0});['photography','stage','media','games','cinema','about'].forEach(id=>observer.observe($('#'+id)));
$('#copy-email').addEventListener('click',async()=>{const email=$('.contact-links>a').getAttribute('href').replace(/^mailto:/,'');try{if(navigator.clipboard&&isSecureContext)await navigator.clipboard.writeText(email);else{const input=el('textarea');input.value=email;input.style.position='fixed';input.style.left='-9999px';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw new Error('copy failed');}notify('邮箱已复制');}catch{notify('请选中邮箱地址复制，或点击邮箱发送邮件');}});
mountLightField($('#light-field'),$('#rotate-art'));$('#year').textContent=new Date().getFullYear();
async function load(){let catalog;try{const res=await fetch('./content.json',{signal:AbortSignal.timeout(7000)});if(!res.ok)throw new Error('catalog');catalog=await res.json();}catch{catalog={};notify('作品目录暂未载入，请刷新重试；个人介绍仍可浏览。');}for(const kind of ['photographs','videos','audio'])state[kind]=(Array.isArray(catalog[kind])?catalog[kind]:[]).map(kind==='videos'?normalizedVideoEntry:normalizedEntry).filter(x=>x.id&&(x.src||kind==='videos'&&bilibiliVideoSource(x)));state.projects=Array.isArray(catalog.projects)?catalog.projects:[];try{const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname)?await getLocalWorks():[];for(const item of local){if(!['photographs','videos','audio'].includes(item.kind)||!item.blob)continue;const src=URL.createObjectURL(item.blob);objectURLs.push(src);state[item.kind].push(normalizedEntry({...item,src,local:true}));}}catch{/* Local previews are optional; the published catalog remains available. */}photoExperience=await mountPhotography({works:state.photographs,onRefresh:()=>pageMotion.refresh()});renderProjects();mountMediaExperience({videoRoot:$('#video-list'),audioRoot:$('#audio-list'),videos:state.videos,audio:state.audio});applyRoute();pageMotion.refresh();}
load().then(async()=>{
  await Promise.all([collectionsReady,document.fonts.ready]);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(initialHash&&!anchorCancelled&&location.hash===initialHash&&!document.querySelector('dialog[open]'))document.getElementById(initialHash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'});
    document.documentElement.dataset.portfolioReady='true';
  }));
});
window.addEventListener('pagehide',event=>{if(!event.persisted)objectURLs.forEach(URL.revokeObjectURL);});

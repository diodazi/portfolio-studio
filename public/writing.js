import {releaseExhibitions} from './exhibition-render.js';
import {applySiteConfig} from './site-config.js';
import {validateMagazine,renderMagazine} from './magazine.js';
import {releaseSurface} from './magazine-layout.js';
import {releaseEditorial} from './editorial-render.js';
import {magazineText} from './editorial-model.js';
const $ = selector => document.querySelector(selector);
const state = { articles: [], loaded: false, error: false };
let toastTimer;
let renderedSearch='';

// All article text is rendered through textContent. HTML from the content file is never executed.
export function normalizeArticles(input) {
  const ids = new Set();
  return (Array.isArray(input) ? input : []).filter(item => item && item.published !== false).map(item => {
    const id = String(item.id || '').trim();
    if (!id || ids.has(id) || !String(item.title || '').trim()) return null;
    ids.add(id);
    const source = Array.isArray(item.blocks) ? item.blocks : (Array.isArray(item.paragraphs) ? item.paragraphs.map(text => ({type:'paragraph',text})) : []);
    const imageSource=s=>typeof s==='string'&&/^\.\/assets\/media\/(?!.*\.\.)[^?#\\]+\.(?:jpe?g|png|webp|avif)$/iu.test(s);
    const blocks = source.filter(block => block && (['paragraph','text','heading','quote'].includes(block.type) && typeof block.text === 'string' || block.type==='image' && imageSource(block.src))).map(block => block.type==='image'?{type:'image',src:block.src,text:typeof block.text==='string'?block.text:''}:{type:block.type === 'text'?'paragraph':block.type,text:block.text});
    return {id,title:String(item.title).trim(),date:typeof item.date === 'string' ? item.date : '',summary:String(item.summary || ''),cover:imageSource(item.cover)?item.cover:'',tags:[...new Set((Array.isArray(item.tags)?item.tags:[]).filter(tag=>typeof tag==='string'&&tag.trim()).map(tag=>tag.trim()))],blocks,...(validateMagazine(item.magazine)?{magazine:structuredClone(item.magazine)}:{})};
  }).filter(Boolean);
}

function node(tag,className,text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function articleUrl(id) {
  const url = new URL('./writing.html',location.href);
  if (id) url.searchParams.set('id',id);
  return url;
}

function dateLabel(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const value = new Date(date+'T00:00:00');
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(value);
}

function route(url, focus = true) {
  history.pushState({},'',url);
  render(focus);
  window.scrollTo({top:0,behavior:'auto'});
}

function interceptLink(link,url) {
  link.href = url;
  link.addEventListener('click',event=>{
    if(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();route(url);
  });
}

function renderIndex(tag,focus) {
  const tags = [...new Set(state.articles.flatMap(article=>article.tags))];
  const selected = tags.includes(tag) ? tag : '';
  const filters = $('#writing-filters');
  filters.replaceChildren();filters.hidden = tags.length < 1;
  ['',...tags].forEach(value=>{
    const button = node('button','',value||'全部');
    button.type='button';button.setAttribute('aria-pressed',String(value===selected));
    button.addEventListener('click',()=>{const url=articleUrl();if(value)url.searchParams.set('tag',value);history.pushState({},'',url);render(false);[...filters.children].find(x=>x.textContent===(value||'全部'))?.focus({preventScroll:true});});
    filters.append(button);
  });
  const articles = state.articles.filter(article=>!selected||article.tags.includes(selected));
  const list = $('#writing-list');list.replaceChildren();
  $('#writing-count').textContent=state.loaded&&state.articles.length?`${selected||'全部文字'} / ${articles.length} 篇`:'';
  $('#writing-empty').hidden=state.error||!state.loaded||articles.length>0;
  $('#writing-error').hidden=!state.error;
  articles.forEach(article=>{
    const row = node('article','writing-row');
    const link = node('a','writing-row-link');interceptLink(link,articleUrl(article.id));
    const meta=node('div','writing-row-meta');
    const date=dateLabel(article.date);if(date){const time=node('time','',date);time.dateTime=article.date;meta.append(time);}
    if(article.tags.length)meta.append(node('span','',article.tags.join(' / ')));
    const body=node('div','writing-row-body');if(article.cover){const image=node('img','writing-cover');image.src=article.cover;image.alt='';image.loading='lazy';body.append(image)}body.append(node('h2','',article.title));if(article.summary)body.append(node('p','',article.summary));
    const arrow=node('span','writing-row-arrow','↗');arrow.setAttribute('aria-hidden','true');
    link.append(meta,body,arrow);row.append(link);list.append(row);
  });
  if(focus)$('#writing-heading').focus({preventScroll:true});
}

function renderArticle(article,focus) {
  document.title=article.title+' — 站点作者 Portfolio';
  $('#reading-title').textContent=article.title;
  const chars=article.magazine?magazineText(article.magazine).length:article.blocks.reduce((sum,block)=>sum+block.text.length,0);
  $('#reading-meta').textContent=[dateLabel(article.date),...article.tags,chars?`约 ${Math.max(1,Math.ceil(chars/450))} 分钟阅读`:null].filter(Boolean).join(' / ');
  $('#reading-summary').textContent=article.summary;$('#reading-summary').hidden=!article.summary;
  const body=$('#reading-body'),toc=$('#reading-toc');releaseExhibitions(body);releaseEditorial(body);releaseSurface(body);body.replaceChildren();toc.replaceChildren();body.classList.remove('magazine-body');delete body.dataset.layout;delete body.dataset.preset;$('#reading-view').classList.toggle('is-editorial',!!article.magazine);
  let headings=0;
  if(article.magazine){renderMagazine(body,article.magazine);body.querySelectorAll('[data-mag-heading]').forEach(h=>{headings++;const a=node('a','',h.dataset.magHeading);a.href='#'+h.id;toc.append(a)})}
  else article.blocks.forEach(block=>{
    if(block.type==='image'){const figure=node('figure','reading-image'),img=node('img');img.src=block.src;img.alt=block.text;img.loading='lazy';figure.append(img);if(block.text)figure.append(node('figcaption','',block.text));body.append(figure);return}
    const element=node(block.type==='heading'?'h2':block.type==='quote'?'blockquote':'p','',block.text);
    if(block.type==='heading'){
      headings++;element.id='section-'+headings;
      const link=node('a','',block.text);link.href='#'+element.id;toc.append(link);
    }
    body.append(element);
  });
  if(!article.blocks.length&&!article.magazine?.blocks.length)body.append(node('p','reading-no-body','正文正在整理。'));
  $('#reading-contents').hidden=headings<2;
  $('.reading-layout').classList.toggle('has-toc',headings>=2);
  if(focus)$('#reading-title').focus({preventScroll:true});
}

function render(focus=false) {
  renderedSearch=location.search;
  const params=new URLSearchParams(location.search),id=params.get('id');
  const article=state.articles.find(item=>item.id===id);
  $('#writing-index').hidden=!!id&&!state.error;
  $('#reading-view').hidden=!article;
  $('#writing-missing').hidden=!id||!!article||!state.loaded||state.error;
  document.title='文字与随笔 — 站点作者 Portfolio';
  if(article)renderArticle(article,focus);
  else if(id&&state.loaded&&!state.error){if(focus)$('#writing-missing h1').focus({preventScroll:true});}
  else renderIndex(params.get('tag'),focus);
}

// Article content arrives after the initial document. Restore a shared section link
// once its heading exists; ordinary in-page history remains native browser behavior.
function restoreInitialArticleFragment(){
  if($('#reading-view').hidden||!location.hash)return;
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const target=document.getElementById(id);
  if(target&&$('#reading-body').contains(target))target.scrollIntoView({block:'start',behavior:'auto'});
}

function toast(text){clearTimeout(toastTimer);$('#writing-toast').textContent=text;$('#writing-toast').classList.add('visible');toastTimer=setTimeout(()=>$('#writing-toast').classList.remove('visible'),3200);}

async function copyLink(){
  const url=new URL(location.href);url.hash='';
  try{
    if(navigator.clipboard&&isSecureContext)await navigator.clipboard.writeText(url.href);
    else{const field=node('textarea');field.value=url.href;field.setAttribute('aria-label','文章链接');field.style.position='fixed';field.style.left='-9999px';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();$('#copy-writing-link').focus({preventScroll:true});if(!copied)throw new Error('copy');}
    toast('文章链接已复制');
  }catch{toast('请从浏览器地址栏复制文章链接');}
}

async function load(){
  state.loaded=false;state.error=false;$('#writing-count').textContent='正在载入文字目录…';
  $('#writing-retry').disabled=true;
  try{const response=await fetch('./writing.json',{signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error('content');const catalog=await response.json();state.articles=normalizeArticles(catalog.articles);}
  catch{state.error=true;state.articles=[];}
  finally{state.loaded=true;$('#writing-retry').disabled=false;render();restoreInitialArticleFragment();}
}

if(typeof document!=='undefined'){
  applySiteConfig();
  ['#back-to-writing','#reading-end-back','#missing-back'].forEach(selector=>interceptLink($(selector),articleUrl()));
  $('#copy-writing-link').addEventListener('click',copyLink);
  $('#writing-retry').addEventListener('click',load);
  $('#writing-year').textContent=new Date().getFullYear();
  window.addEventListener('popstate',()=>{if(location.search!==renderedSearch)render(true);});
  load();
}

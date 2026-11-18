import {attachImageEffects} from './image-effects-render.js';
import {applyRunFont,applyUniformRunFont} from './editor-fonts.js';
import {COMPONENTS,plainRuns,componentRuns,safeLink} from './editorial-model.js';
import {attachVisualStyle} from './editorial-styles.js';
const disposers=new WeakMap();let serial=0;
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
export function releaseEditorial(root){for(const e of root.querySelectorAll('.editorial-component')){disposers.get(e)?.();disposers.delete(e)}}
export function drawRuns(root,runs){applyUniformRunFont(root,runs);for(const r of runs||[]){const s=el('span','',r.text);applyRunFont(s,r.font);if(r.bold)s.style.fontWeight='700';if(r.italic)s.style.fontStyle='italic';if(r.underline)s.style.textDecoration='underline';if(r.color)s.style.color=r.color;if(r.size){s.style.fontSize=r.size+'px';s.style.setProperty('--run-size',r.size+'px')}root.append(s)}}
export function renderComponent(b,{editing=false,preview=false,free=false,thumbnail=false,headings=[],onText,onImage}={}){
 const kind=b.component,o=b.options,root=el('section','editorial-component ec-'+kind),uid='ec-'+(++serial);root.dataset.component=kind;root.dataset.tone=o.tone;root.dataset.side=o.side;root.dataset.motion=String(o.motion);root.dataset.editing=String(editing);root.dataset.contained=String(free||preview);
 root.style.setProperty('--ec-space',o.padding+'px');root.style.setProperty('--ec-gap',o.gap+'px');root.style.setProperty('--ec-cols',o.columns);root.style.setProperty('--ec-fit',o.fit);if(b.color)root.style.setProperty('--ec-ink',b.color);if(b.size)root.style.setProperty('--ec-body-size',b.size+'px');
 const text=(key,cls='ec-body',tag='div')=>{const node=el(tag,cls);drawRuns(node,componentRuns(b,key));node.dataset.componentField=key;if(editing){node.contentEditable='true';node.classList.add('mag-edit-text');node.setAttribute('role','textbox');node.setAttribute('aria-multiline','true');node.setAttribute('aria-label',COMPONENTS[kind].name+' · '+(key==='title'?'标题':key==='body'?'正文':'条目 '+(Number(key.split('.')[1])+1)+' '+(key.endsWith('title')?'标题':'正文')));onText?.(node,key)}return node};
 const button=(name,fn,cls='ec-button')=>{const n=el('button',cls,name);n.type='button';n.addEventListener('click',fn);return n};
 const picture=(src,key,caption='',interactive=false)=>{
  const effectRecord=key==='src'?b:b.items[Number(key.split('.')[1])];
  const figure=el('figure','ec-picture'),media=el('div','ec-media');figure.append(media);
  if(src){const img=el('img');img.src='/'+src.replace(/^\.\//,'');img.alt=caption;img.loading=preview?'eager':'lazy';img.draggable=false;media.append(img)}else{media.classList.add('ec-media-empty');media.append(el('span','ec-placeholder',editing?'选择图片':preview?'图像':''))}
  if(editing&&onImage){const pick=button(src?'替换图片':'从素材库选图',()=>onImage(key),'ec-image-picker');pick.setAttribute('aria-label',COMPONENTS[kind].name+' · '+key+' 选择图片');media.append(pick)}
  if(interactive&&!editing&&src){const zoom=button('查看大图',()=>{const d=el('dialog','ec-lightbox'),img=el('img');img.src='/'+src.slice(2);img.alt=caption;attachImageEffects(img,effectRecord?.effects);img.addEventListener('load',()=>{if(img.naturalHeight>img.naturalWidth*3)d.classList.add('ec-lightbox-tall')},{once:true});d.append(button('关闭',()=>d.close()),img,el('p','',caption));document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal()},'ec-zoom');media.append(zoom)}
  const rendered=media.querySelector('img');if(rendered)attachImageEffects(rendered,effectRecord?.effects);
  if(caption)figure.append(el('figcaption','ec-caption',caption));return figure;
 };
 const title=()=>text('title','ec-title','h3'),body=()=>text('body'),intro=()=>{const wrap=el('div','ec-intro');if(b.label)wrap.append(el('span','ec-label',b.label));wrap.append(title());return wrap};
 const item=(i,{image=false}={})=>{const data=b.items[i],card=el('article','ec-item');if(image)card.append(picture(data.src,'items.'+i+'.src',data.label));card.append(text(`items.${i}.title`,'ec-item-title','h4'),text(`items.${i}.body`));return card};
 const items=(className='ec-items',images=false)=>{const grid=el('div',className);b.items.forEach((_,i)=>grid.append(item(i,{image:images})));return grid};
 const arrows=(previous,next,status)=>{const nav=el('div','ec-controls');const prev=button('←',previous),forward=button('→',next);prev.setAttribute('aria-label','上一张');forward.setAttribute('aria-label','下一张');nav.append(prev,status,forward);return nav};
 if(['poster','caption-overlay','reveal'].includes(kind)){
  root.append(picture(b.src,'src',b.caption));const copy=el('div','ec-overprint');copy.append(intro(),body());root.append(copy);
 }else if(['split','spread'].includes(kind)){
  const copy=el('div','ec-copy');copy.append(intro(),body());root.append(picture(b.src,'src',b.caption),copy);
 }else if(kind==='chapter'){root.append(el('span','ec-chapter-number',b.label||'01'),title(),body());
 }else if(kind==='dropcap'){root.append(title(),body());
 }else if(kind==='pullquote'){root.append(el('span','ec-quote-mark','“'),title(),body());
 }else if(kind==='sidenote'){const main=el('div');main.append(title(),body());root.append(main,items('ec-sidenotes'));
 }else if(kind==='callout'){root.append(intro(),body());
 }else if(kind==='panorama'){root.append(intro(),picture(b.src,'src',b.caption),body());
 }else if(['diptych','triptych','collage','contact-sheet','filmstrip'].includes(kind)){
  root.append(intro());const grid=el('div','ec-gallery');b.items.forEach((v,i)=>{const card=el('article','ec-gallery-item');card.append(picture(v.src,'items.'+i+'.src',v.label,kind==='contact-sheet'),text(`items.${i}.title`,'ec-item-title','h4'),text(`items.${i}.body`));grid.append(card)});root.append(grid);
  if(kind==='filmstrip'){const status=el('span','ec-label','横向浏览'),scroll=direction=>grid.scrollBy({left:direction*grid.clientWidth*.8,behavior:o.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});root.append(arrows(()=>scroll(-1),()=>scroll(1),status))}
 }else if(['interview','timeline','metrics','facts','proscons','rating'].includes(kind)){
  root.append(intro());const list=el('div','ec-items');b.items.forEach((v,i)=>{const card=el('article','ec-item');if(kind==='timeline'){card.append(el('span','ec-timeline-dot'),el('span','ec-label',v.label||String(i+1).padStart(2,'0')));if(v.src||editing)card.append(picture(v.src,'items.'+i+'.src'))}
   if(kind==='interview')card.append(el('span','ec-question-mark','Q'+String(i+1).padStart(2,'0')));
   card.append(text(`items.${i}.title`,'ec-item-title','h4'));if(kind==='metrics')card.append(el('span','ec-label',v.label));
   if(kind==='rating'){const meter=el('div','ec-meter');meter.setAttribute('role','meter');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow',v.value);meter.setAttribute('aria-label',plainRuns(v.title));const fill=el('span');fill.style.width=v.value+'%';meter.append(fill);card.append(el('span','ec-score',v.value+' / 100'),meter)}
   card.append(text(`items.${i}.body`));list.append(card)});root.append(list);
 }else if(kind==='contents'){
  root.append(intro());const list=el('ol','ec-contents-list');for(const h of headings){const li=el('li'),link=el('a','',h.title);link.href='#'+h.id;li.append(link);list.append(li)}root.append(list);if(!headings.length)root.append(body());
 }else if(kind==='accordion'){
  root.append(intro());b.items.forEach((_,i)=>{const d=el('details','ec-disclosure');d.open=editing;const summary=el('summary');summary.append(text(`items.${i}.title`,'ec-item-title','span'));d.append(summary,text(`items.${i}.body`));root.append(d)});
 }else if(kind==='tabs'){
  root.append(intro());const bar=el('div','ec-tab-list'),panels=el('div','ec-tab-panels');bar.setAttribute('role','tablist');bar.setAttribute('aria-label',plainRuns(b.title));let tabs=[];
  const activate=i=>{tabs.forEach((t,j)=>{t.setAttribute('aria-selected',String(i===j));t.tabIndex=i===j?0:-1;panels.children[j].hidden=i!==j})};
  b.items.forEach((v,i)=>{const tab=button(plainRuns(v.title)||'页签 '+(i+1),()=>activate(i),'ec-tab');tab.id=uid+'-tab-'+i;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',uid+'-panel-'+i);const panel=item(i,{image:!!v.src||editing});panel.id=uid+'-panel-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;panels.append(panel);bar.append(tab);tabs.push(tab);tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(next);tabs[next].focus()})});root.append(bar,panels);activate(0);
 }else if(kind==='comparison'){
  root.append(intro());const frame=el('div','ec-compare');const first=b.items[0],second=b.items[1];if(first)frame.append(picture(first.src,'items.0.src'));if(second){const overlay=el('div','ec-compare-overlay');overlay.append(picture(second.src,'items.1.src'));frame.append(overlay)}const line=el('span','ec-compare-line');frame.append(line);const range=el('input','ec-compare-range');range.type='range';range.min='0';range.max='100';range.value=o.start;range.setAttribute('aria-label','图片对比位置');const update=()=>frame.style.setProperty('--ec-split',range.value+'%');range.oninput=update;update();root.append(frame,range);const captions=el('div','ec-compare-labels');b.items.slice(0,2).forEach((_,i)=>captions.append(text(`items.${i}.title`,'ec-item-title')));root.append(captions,body());
 }else if(kind==='hotspots'){
  root.append(intro());const stage=el('div','ec-hotspot-stage');stage.append(picture(b.src,'src',b.caption));const panels=el('div','ec-hotspot-notes');b.items.forEach((v,i)=>{const panel=item(i);panel.id=uid+'-note-'+i;panel.hidden=!editing;panels.append(panel);const dot=button(String(i+1),()=>{const open=panel.hidden;[...panels.children].forEach(n=>n.hidden=true);root.querySelectorAll('.ec-hotspot').forEach(n=>n.setAttribute('aria-expanded','false'));panel.hidden=!open;dot.setAttribute('aria-expanded',String(open))},'ec-hotspot');dot.style.left=v.x+'%';dot.style.top=v.y+'%';dot.setAttribute('aria-label','注释 '+(i+1)+' '+plainRuns(v.title));dot.setAttribute('aria-controls',panel.id);dot.setAttribute('aria-expanded',String(editing));stage.append(dot)});root.append(stage,panels);
 }else if(kind==='carousel'){
  root.append(intro());const slides=el('div','ec-slides'),status=el('span','ec-label');let current=0;b.items.forEach((_,i)=>slides.append(item(i,{image:true})));const show=i=>{current=(i+Math.max(1,b.items.length))%Math.max(1,b.items.length);[...slides.children].forEach((s,j)=>s.hidden=j!==current);status.textContent=(b.items.length?current+1:0)+' / '+b.items.length};root.append(slides,arrows(()=>show(current-1),()=>show(current+1),status));show(0);
 }else if(kind==='flip'){
  const stage=el('div','ec-flip-stage');b.items.slice(0,2).forEach((_,i)=>{const face=item(i);face.classList.add('ec-flip-face');if(i)face.hidden=true;stage.append(face)});const flip=button('翻到背面',()=>{const back=root.classList.toggle('is-flipped');[...stage.children].forEach((f,i)=>f.hidden=(back?1:0)!==i);flip.textContent=back?'回到正面':'翻到背面';flip.setAttribute('aria-pressed',String(back))});flip.setAttribute('aria-pressed','false');root.append(stage,flip);
 }else if(kind==='scrolly'){
  root.append(intro());const layout=el('div','ec-scroll-story'),visual=el('div','ec-sticky-visual'),steps=el('div','ec-story-steps');b.items.forEach((v,i)=>{const image=picture(v.src,'items.'+i+'.src',v.label);image.hidden=i!==0;visual.append(image);const step=item(i);step.dataset.step=i;steps.append(step)});layout.append(visual,steps);root.append(layout);
  if(typeof IntersectionObserver!=='undefined'){const visibility=new Map();const observer=new IntersectionObserver(entries=>{entries.forEach(e=>visibility.set(e.target,e.intersectionRatio));let selected=0,max=-1;for(const [step,ratio]of visibility)if(ratio>max){max=ratio;selected=Number(step.dataset.step)}[...visual.children].forEach((v,i)=>v.hidden=i!==selected);[...steps.children].forEach((v,i)=>v.classList.toggle('is-active',i===selected))},{root:free||preview?layout:null,threshold:[0,.15,.35,.55,.75,1],rootMargin:free||preview?'0px':'-15% 0px -20% 0px'});[...steps.children].forEach(s=>observer.observe(s));disposers.set(root,()=>observer.disconnect())}
 }else if(kind==='footnote'){
  root.append(intro(),body());b.items.forEach((v,i)=>{const d=el('details','ec-footnote-disclosure');d.open=editing;d.append(el('summary','',v.label||'注 '+(i+1)),item(i));root.append(d)});
 }else if(kind==='related'){
  root.append(intro());const list=el('div','ec-related-list');b.items.forEach((v,i)=>{const card=item(i,{image:!!v.src||editing});if(v.href&&safeLink(v.href)){const link=el('a','ec-read-link','继续阅读 ↗');link.href=v.href;if(/^https?:/.test(v.href)){link.target='_blank';link.rel='noopener noreferrer'}if(editing)link.addEventListener('click',e=>e.preventDefault());card.append(link)}list.append(card)});root.append(list);
 }
 root.dataset.style=o.style||'original';
 if(o.style&&o.style!=='original'){const release=disposers.get(root),stopStyle=attachVisualStyle(root,{editing,thumbnail});disposers.set(root,()=>{release?.();stopStyle()})}
 return root;
}

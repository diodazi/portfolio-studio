import {validFrame,createSurface,placeFrame,makeImageFrame} from './magazine-layout.js';
import {validFont,applyRunFont,applyUniformRunFont,fontStack} from './editor-fonts.js';
import {validateComponent,plainRuns} from './editorial-model.js';
import {validMediaSource} from './media-source.js';
import {validImageEffects} from './image-effects-model.js';
import {renderComponent,releaseEditorial} from './editorial-render.js';
import {validateExhibition} from './exhibition-model.js';
import {renderExhibition,releaseExhibitions} from './exhibition-render.js';
export const PRESETS={paper:'纸页随笔',folio:'图文特刊',cinema:'暗场放映',annual:'年度拼贴'};
export const imagePath=s=>typeof s==='string'&&/^\.\/assets\/media\/(?!.*\.\.)[\p{L}\p{N}_ .-]+\.(?:jpe?g|png|webp|avif)$/iu.test(s);
const color=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
export function validateMagazine(doc){
  if(!doc||doc.version!==1||!Object.hasOwn(PRESETS,doc.preset)||!Array.isArray(doc.blocks)||doc.blocks.length>160)return false;
  if(doc.layout!==undefined&&!['flow','free'].includes(doc.layout))return false;
  if(doc.canvas!==undefined&&(!doc.canvas||doc.canvas.width!==1000||!number(doc.canvas.height,200,12000)))return false;
  if(doc.layout==='free'&&!doc.canvas)return false;
  return doc.blocks.every(b=>{
    if(!b||!['paragraph','heading','quote','textbox','image','divider','component','exhibition'].includes(b.type))return false;
    if(b.width!==undefined&&!number(b.width,2,100))return false;
    if(b.frame!==undefined&&!validFrame(b.frame)||doc.layout==='free'&&!validFrame(b.frame))return false;
    if(b.layer!==undefined&&(!Number.isInteger(b.layer)||!number(b.layer,0,1000)))return false;
    if(b.boxHeight!==undefined&&b.boxHeight!==0&&!number(b.boxHeight,24,4000))return false;
    if(b.textboxFill!==undefined&&!['preset','none'].includes(b.textboxFill))return false;
    if(b.imageScale!==undefined&&!number(b.imageScale,10,400))return false;
    if(['imageOffsetX','imageOffsetY'].some(k=>b[k]!==undefined&&!number(b[k],-100,100)))return false;
    if(b.wrap!==undefined&&!['none','left','right'].includes(b.wrap))return false;
    if(b.align!==undefined&&!['left','center','right','justify'].includes(b.align))return false;
    if(b.size!==undefined&&!number(b.size,12,64))return false;
    if(b.font!==undefined&&!validFont(b.font))return false;
    if(b.color!==undefined&&!color(b.color))return false;
    if(!validImageEffects(b.effects))return false;
    if(b.type==='image')return imagePath(b.src)&&typeof b.caption==='string'&&b.caption.length<=1000&&(b.source===undefined||validMediaSource(b.source))&&(b.height===undefined||b.height===0||number(b.height,24,4000))&&(b.fit===undefined||['contain','cover','fill'].includes(b.fit));
    if(b.type==='divider')return true;
    if(b.type==='component')return validateComponent(b);
    if(b.type==='exhibition')return validateExhibition(b);
    return Array.isArray(b.runs)&&b.runs.length<=1000&&b.runs.every(r=>r&&typeof r.text==='string'&&r.text.length<=30000&&['bold','italic','underline'].every(k=>r[k]===undefined||typeof r[k]==='boolean')&&(r.font===undefined||validFont(r.font))&&(r.color===undefined||color(r.color))&&(r.size===undefined||number(r.size,12,64)));
  });
}
export function magazineFor(entry){
  if(validateMagazine(entry.magazine))return structuredClone(entry.magazine);
  if(Array.isArray(entry.blocks)||Array.isArray(entry.paragraphs)){
    const source=entry.blocks||entry.paragraphs.map(text=>({type:'paragraph',text}));
    return {version:1,preset:'paper',blocks:source.filter(b=>b&&(['paragraph','text','heading','quote'].includes(b.type)&&typeof b.text==='string'||b.type==='image'&&imagePath(b.src))).map(b=>b.type==='image'?{type:'image',src:b.src,caption:b.text||'',width:100,fit:'contain'}:{type:b.type==='text'?'paragraph':b.type,runs:[{text:b.text}]})};
  }
  return {version:1,preset:'paper',blocks:(entry.note||'').split(/\n\s*\n/).filter(Boolean).map(text=>({type:'paragraph',runs:[{text}]}))};
}
export function makeText(type='paragraph'){return {type,runs:[{text:''}]};}
export function applyBlockStyle(element,block){
  element.dataset.type=block.type;element.dataset.wrap=block.wrap||'none';
  element.style.width=block.width?`${block.width}%`:['image','textbox','component','exhibition'].includes(block.type)?'100%':'auto';
  if(block.align)element.style.textAlign=block.align;
  if(block.size)element.style.fontSize=block.size+'px';
  if(block.color)element.style.color=block.color;
  if(validFont(block.font)&&block.font!=='default')element.style.fontFamily=fontStack(block.font);
  if(block.boxHeight){element.style.height=block.boxHeight+'px';element.dataset.fixed='true'}
  if(block.textboxFill)element.dataset.fill=block.textboxFill;
}
export function renderRuns(root,runs=[]){
  root.replaceChildren();delete root.dataset.font;root.style.fontFamily='';applyUniformRunFont(root,runs);
  for(const r of runs){const span=document.createElement('span');span.textContent=r.text;applyRunFont(span,r.font);
    if(r.bold)span.style.fontWeight='700';if(r.italic)span.style.fontStyle='italic';if(r.underline)span.style.textDecoration='underline';
    if(r.color)span.style.color=r.color;if(r.size){span.style.fontSize=r.size+'px';span.style.setProperty('--run-size',r.size+'px')}root.append(span);
  }
}
export function renderMagazine(root,doc){
  releaseEditorial(root);releaseExhibitions(root);root.replaceChildren();root.classList.add('magazine-body');root.dataset.preset=doc.preset;
  const headings=magazineHeadings(doc,root.id==='reading-body'?'section':(root.id||'mag-section'));
  const surface=createSurface(root,doc,{reading:true});
  for(const [index,b] of doc.blocks.entries()){
    const e=document.createElement(b.type==='image'?'figure':b.type==='heading'?'h2':b.type==='quote'?'blockquote':b.type==='divider'?'hr':'div');
    e.className='mag-block';applyBlockStyle(e,b);
    const heading=headings.find(h=>h.index===index);if(heading){e.id=heading.id;e.dataset.magHeading=heading.title}
    if(b.type==='component')e.append(renderComponent(b,{free:doc.layout==='free',headings}));
    else if(b.type==='exhibition')e.append(renderExhibition(b));
    else if(b.type==='image'){
      e.append(makeImageFrame(b));
      if(b.caption){const cap=document.createElement('figcaption');cap.textContent=b.caption;e.append(cap)}
    }else if(b.type!=='divider'){const content=document.createElement('div');content.className='mag-text-content';renderRuns(content,b.runs);e.append(content)}
    if(doc.layout==='free')placeFrame(e,b,index);
    surface.append(e);
  }
}
export function magazineHeadings(doc,prefix='mag-section'){let count=0;return doc.blocks.flatMap((b,index)=>b.type==='heading'||b.type==='component'&&b.component==='chapter'?[{index,id:prefix+'-'+(++count),title:plainRuns(b.runs||b.title)}]:[])}

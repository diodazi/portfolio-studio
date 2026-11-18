import {applyBlockStyle,renderRuns} from './magazine.js';
import {applyPaperEffect} from './paper-effects.js';
import {placeFrame,makeImageFrame} from './magazine-layout.js';
import {renderComponent,releaseEditorial} from './editorial-render.js';
import {renderExhibition,releaseExhibitions} from './exhibition-render.js';
import {bookPageWidth} from './game-review-model.js';
import {mediaSourceLink} from './media-source.js';
const observers=new WeakMap();
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n};
export function releaseBookPages(root){for(const p of [root,...root.querySelectorAll('.gb-page')]){observers.get(p)?.disconnect();observers.delete(p)}releaseEditorial(root);releaseExhibitions(root)}
export function renderBookPage(page,{editing=false,thumbnail=false,onText,onImage,onPlaceholder,onChoose}={}){
 const width=bookPageWidth(page),root=el('div','gb-page'),sheet=el('div','gb-sheet magazine-body');root.dataset.paper=page.paper;root.dataset.span=String(page.span||1);root.style.aspectRatio=width+'/1414';sheet.style.width=width+'px';sheet.dataset.preset=page.paper==='ink'?'cinema':'paper';root.append(sheet);
 applyPaperEffect(root,sheet,page);
 page.blocks.forEach((b,i)=>{const box=el('div','gb-object mag-block');box.dataset.object=i;applyBlockStyle(box,b);placeFrame(box,b,i);box.style.fontSize=(b.size||28)+'px';
  const edit=(field,runs)=>{const n=el('div','gb-object-text');renderRuns(n,runs);if(editing){n.contentEditable='true';n.setAttribute('role','textbox');n.setAttribute('aria-multiline','true');n.setAttribute('aria-label','文字对象 '+(i+1));n.dataset.bookField=field;onText?.(n,b,field)}return n};
  if(b.placeholderImage){box.classList.add('gb-image-placeholder');box.append(el('span','',editing?'双击选择图片':''));if(editing)box.ondblclick=e=>{e.preventDefault();onPlaceholder?.(b)}}
  else if(b.type==='image'){box.append(makeImageFrame(b,{editing:true}));if(b.caption)box.append(el('span','gb-image-caption',b.caption));if(b.source?.kind==='meme'){const credit=mediaSourceLink(b.source,'gb-image-source');if(credit)box.append(credit)}}
  else if(b.type==='component')box.append(renderComponent(b,{editing,free:true,thumbnail,onText:(n,key)=>{n.dataset.bookField=key;onText?.(n,b,key)},onImage:key=>onImage?.(b,key)}));
  else if(b.type==='exhibition')box.append(renderExhibition(b,{editing,thumbnail,onText:(n,key)=>{n.dataset.bookField=key;onText?.(n,b,key)},onImage:key=>onImage?.(b,key)}));
  else if(b.type!=='divider')box.append(edit('runs',b.runs));
  if(editing){box.addEventListener('pointerdown',e=>onChoose?.(i,e));box.tabIndex=0;box.setAttribute('aria-label',`对象 ${i+1} · ${b.type==='image'||b.placeholderImage?'图片':'文字或组件'}`)}sheet.append(box);
 });
 const fit=()=>sheet.style.transform=`scale(${root.clientWidth/width})`;const observer=new ResizeObserver(fit);observer.observe(root);observers.set(root,observer);fit();if(editing&&page.span===2){const seam=el('div','gb-spine-guide');seam.setAttribute('aria-hidden','true');root.append(seam)}if(thumbnail){root.inert=true;root.setAttribute('aria-hidden','true')}return root;
}
export function renderBookLeaf(leaf,options={}){if(leaf.page.span!==2)return renderBookPage(leaf.page,options);const crop=el('div','gb-page gb-leaf'),art=el('div','gb-leaf-art'),surface=renderBookPage(leaf.page,options),left=leaf.half*1000;crop.dataset.paper=leaf.page.paper;crop.dataset.half=String(leaf.half);art.style.left=leaf.half?'-100%':'0';surface.querySelectorAll('.gb-object').forEach((n,i)=>{const f=leaf.page.blocks[i].frame;if(f.x>=left+1000||f.x+f.width<=left){n.inert=true;n.setAttribute('aria-hidden','true')}});art.append(surface);crop.append(art);return crop}

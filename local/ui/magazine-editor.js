import {fontOptions,fontIdFromElement,validFont} from '/editor-fonts.js';
import {applySelectedFont,syncFontSelect,prepareFontSelect} from '/manage/font-format.js';
import {exhibitionRuns,setExhibitionRuns,setExhibitionImage,withExhibitionPreset} from '/exhibition-model.js';
import {renderExhibition,releaseExhibitions} from '/exhibition-render.js';
import {openExhibitionLibrary} from '/manage/exhibition-library.js';
import {mountExhibitionInspector} from '/manage/exhibition-inspector.js';
import {PRESETS,magazineFor,makeText,renderRuns,renderMagazine,applyBlockStyle,validateMagazine,magazineHeadings} from '/magazine.js';
import {createSurface,releaseSurface,makeImageFrame} from '/magazine-layout.js';
import {mountObjectTools} from '/manage/magazine-object-tools.js';
import {componentRuns,setComponentRuns} from '/editorial-model.js';
import {renderComponent,releaseEditorial} from '/editorial-render.js';
import {openEditorialLibrary} from '/manage/editorial-library.js';
import {mountEditorialInspector} from '/manage/editorial-inspector.js';
import {openVisualStyleLibrary} from '/manage/visual-style-library.js';
import {withVisualStyle} from '/editorial-styles.js';
const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
const hex=s=>{if(/^#[0-9a-f]{6}$/i.test(s))return s;const m=/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(s);return m?'#'+m.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):undefined};
export function runsFrom(root){
  const runs=[];
  function walk(el,style={}){
    if(el.nodeType===3){if(el.textContent)runs.push({text:el.textContent,...style});return}
    if(el.nodeType!==1)return;
    if(el.tagName==='BR'){runs.push({text:'\n',...style});return}
    const next={...style};if(['B','STRONG'].includes(el.tagName)||el.style.fontWeight==='700')next.bold=true;
    if(el.style.fontWeight==='400')next.bold=false;if(['I','EM'].includes(el.tagName)||el.style.fontStyle==='italic')next.italic=true;if(el.style.fontStyle==='normal')next.italic=false;
    if(el.tagName==='U'||el.style.textDecoration==='underline')next.underline=true;if(el.style.textDecoration==='none')next.underline=false;
    const fontId=fontIdFromElement(el);if(fontId)next.font=fontId;
    const c=hex(el.style.color);if(c)next.color=c;const size=parseFloat(el.style.fontSize);if(size>=12&&size<=64)next.size=size;
    if(['DIV','P'].includes(el.tagName)&&el!==root&&runs.length&&runs.at(-1).text.slice(-1)!=='\n')runs.push({text:'\n'});
    for(const child of el.childNodes)walk(child,next);
  }
  const font=fontIdFromElement(root),initial=font?{font}:{};for(const child of root.childNodes)walk(child,initial);return runs.length?runs:[{text:'',...initial}];
}
export function mountMagazineEditor(parent,{entry={},upload,chooseAsset,onChange,onError,label='经历与评价'}){
  let doc=magazineFor(entry);if(!doc.blocks.length)doc.blocks=[makeText()];
  let selected=0,range=null,activeField=null,closeLibrary=null,dragIndex=null,history=[JSON.stringify(doc)],future=[],previewing=false,disposed=false;
  const pageIndices=new WeakMap();
  const root=node('section','mag-editor'),heading=node('div','mag-editor-heading');heading.append(node('h3','',label),node('span','','可视化排版'));parent.append(root);root.append(heading);
  const controls=node('div','mag-editor-controls');root.append(controls);
  const bar=node('div','mag-toolbar');bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','杂志排版工具');controls.append(bar);
  const buttons=[];
  function button(label,fn,where=bar){const b=node('button','',label);b.type='button';b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',fn);where.append(b);buttons.push(b);return b}
  function select(label,options,fn,where=bar){const wrap=node('label','mag-control'),s=node('select');s.setAttribute('aria-label',label);for(const [v,t]of options){const o=node('option','',t);o.value=v;s.append(o)}wrap.append(node('span','',label),s);where.append(wrap);s.addEventListener('change',()=>fn(s.value));return s}
  function commit(){const snapshot=JSON.stringify(doc);if(history.at(-1)!==snapshot){history.push(snapshot);if(history.length>80)history.shift();future=[];onChange()}updateUndo()}
  function updateUndo(){undo.disabled=history.length<2;redo.disabled=!future.length}
  function change(fn){fn();commit();paint()}
  const undo=button('撤销',()=>{if(history.length<2)return;future.push(history.pop());doc=JSON.parse(history.at(-1));selected=Math.min(selected,doc.blocks.length-1);onChange();paint();updateUndo()});
  const redo=button('重做',()=>{if(!future.length)return;const snapshot=future.pop();history.push(snapshot);doc=JSON.parse(snapshot);onChange();paint();updateUndo()});
  const preset=select('版式',Object.entries(PRESETS),value=>change(()=>doc.preset=value));
  button('组件库',()=>{closeLibrary?.();closeLibrary=openEditorialLibrary({insert:insertMany,onError})});
  button('风格库',showStyles);button('展览预设',showExhibitions);
  button('正文',()=>insert(makeText()));button('标题',()=>insert(makeText('heading')));button('引用',()=>insert(makeText('quote')));button('文本框',()=>insert({...makeText('textbox'),width:45,wrap:'right'}));button('分隔线',()=>insert({type:'divider'}));
  const imageInput=node('input');imageInput.type='file';imageInput.accept='.jpg,.jpeg,.png,.webp,.avif';imageInput.multiple=true;imageInput.hidden=true;imageInput.setAttribute('aria-label','上传正文插图');root.append(imageInput);
  const addImage=button('插入图片',()=>imageInput.click());
  if(chooseAsset)button('从素材库插图',async()=>{try{const assets=await chooseAsset();if(disposed)return;for(const asset of assets)insert({type:'image',src:asset.src,caption:'',width:100,wrap:'none',height:0,fit:'contain'})}catch(e){onError(e.message)}});
  imageInput.addEventListener('change',async()=>{const files=[...imageInput.files];if(!files.length)return;addImage.disabled=true;try{for(const file of files){const saved=await upload(file);if(disposed)return;insert({type:'image',src:saved.src,caption:'',width:100,wrap:'none',height:0,fit:'contain'})}}catch(e){onError(e.message)}finally{imageInput.value='';addImage.disabled=false}});
  button('加粗',()=>format('bold'));button('斜体',()=>format('italic'));button('下划线',()=>format('underline'));
  const family=select('字体',fontOptions(),v=>format('font',v));prepareFontSelect(family,rememberRange);
  const font=select('字号',[12,14,16,18,20,24,28,32,40,48,64].map(n=>[String(n),n+' px']),v=>format('size',Number(v)));
  const colorWrap=node('label','mag-control');colorWrap.append(node('span','','字色'));const color=node('input');color.type='color';color.value='#222521';color.setAttribute('aria-label','文字颜色');colorWrap.append(color);bar.append(colorWrap);color.addEventListener('input',()=>format('color',color.value));
  const align=select('对齐',[['left','左对齐'],['center','居中'],['right','右对齐'],['justify','两端对齐']],v=>set('align',v));
  const previewButton=button('阅读预览',()=>{previewing=!previewing;root.classList.toggle('is-preview',previewing);previewButton.textContent=previewing?'返回编辑':'阅读预览';paint()});
  const expand=button('展开编辑',()=>{const open=root.classList.toggle('is-expanded');document.body.classList.toggle('mag-expanded',open);expand.textContent=open?'收起编辑':'展开编辑'});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('is-expanded')){e.preventDefault();root.classList.remove('is-expanded');document.body.classList.remove('mag-expanded');expand.textContent='展开编辑';expand.focus()}});
  const saveButton=button('保存草稿',()=>{root.closest('form').requestSubmit()});
  const help=node('p','field-help','正文可直接编辑。文档排版支持图文环绕；自由画布支持任意位置与图文叠放。选中对象后拖动角标改变宽高，图片还可独立缩放框内画面。');root.append(help);
  const inspector=node('div','mag-inspector');controls.append(inspector);
  const wrap=select('图文环绕',[['none','独占一行'],['left','靠左 · 文字绕右'],['right','靠右 · 文字绕左']],v=>{change(()=>{const b=doc.blocks[selected];if(!b)return;b.wrap=v;if(v!=='none'&&(b.width||100)>65)b.width=45})},inspector);
  const width=select('宽度',[20,30,40,45,50,60,70,80,90,100].map(n=>[String(n),n+'%']),v=>set('width',Number(v)),inspector);
  const fit=select('图片适配',[['contain','完整显示'],['cover','裁切填满'],['fill','拉伸铺满']],v=>set('fit',v),inspector);
  const hWrap=node('label','mag-control'),height=node('input');height.type='number';height.min='0';height.max='4000';height.step='1';height.setAttribute('aria-label','图片高度');hWrap.append(node('span','','图片框高度（0 为原比例）'),height);inspector.append(hWrap);height.addEventListener('change',()=>set('height',Number(height.value)===0?0:Math.max(24,Math.min(4000,Number(height.value)||24))));
  button('上移',()=>move(-1),inspector);button('下移',()=>move(1),inspector);button('删除选中',()=>change(()=>{doc.blocks.splice(selected,1);if(!doc.blocks.length)doc.blocks.push(makeText());selected=Math.min(selected,doc.blocks.length-1)}),inspector);
  const paper=node('div','mag-edit-paper magazine-body');paper.setAttribute('aria-label','杂志编辑画布');root.append(paper);
  const componentInspector=mountEditorialInspector(root,{getBlock:()=>doc.blocks[selected],change,pickImage,duplicate:()=>insertMany([structuredClone(doc.blocks[selected])]),showStyles,onError});inspector.append(root.lastElementChild);
  const exhibitionInspector=mountExhibitionInspector(inspector,{getBlock:()=>doc.blocks[selected],getPage:()=>pageIndices.get(doc.blocks[selected])||0,setPage:(at,repaint=true)=>{pageIndices.set(doc.blocks[selected],at);activeField='pages.'+at+'.body';if(repaint)paint()},change,pickImage,showLibrary:showExhibitions});
  const toolbarObserver=new ResizeObserver(()=>root.style.setProperty('--mag-toolbar-height',(controls.offsetHeight+32)+'px'));toolbarObserver.observe(controls);
  let surface=paper;
  const objectTools=mountObjectTools({bar,inspector,button,select,getDoc:()=>doc,getSelected:()=>selected,getSurface:()=>surface,getPaper:()=>paper,change,commit,choose});
  function insert(b){if(doc.blocks.length>=160){onError('一篇文章最多 160 个段落或插图。');return}change(()=>{objectTools.insertFrame(b);selected=Math.max(0,selected+1);doc.blocks.splice(selected,0,b)});surface.children[selected]?.querySelector('[contenteditable]')?.focus()}
  function showStyles(){const target=doc.blocks[selected];closeLibrary?.();closeLibrary=openVisualStyleLibrary({block:target,insert:insertMany,onError,apply:style=>{if(disposed)return false;const index=doc.blocks.indexOf(target);if(index<0){onError('选中的组件已变化，请重新选择。');return false}change(()=>{doc.blocks[index]=withVisualStyle(target,style);selected=index});return true}})}
  function showExhibitions(){const target=doc.blocks[selected];closeLibrary?.();closeLibrary=openExhibitionLibrary({block:target,insert:insertMany,onError,apply:id=>{if(disposed)return false;const index=doc.blocks.indexOf(target);if(index<0){onError('选中的展览已变化，请重新选择。');return false}change(()=>{const updated=withExhibitionPreset(target,id);pageIndices.set(updated,pageIndices.get(target)||0);doc.blocks[index]=updated;selected=index});return true}})}
  function insertMany(blocks,append=false){
    if(disposed)return false;if(doc.blocks.length+blocks.length>160){onError('一篇文章最多 160 个段落、插图或组件，请先减少内容。');return false}
    const incoming=structuredClone(blocks),free=doc.layout==='free';
    if(free){let bottom=Math.max(0,...doc.blocks.map(b=>b.frame.y+b.frame.height))+32;for(const b of incoming){const height=['component','exhibition'].includes(b.type)?620:b.type==='image'?420:180;if(bottom+height>12000){onError('画布剩余高度不足，请减少内容或切换到文档排版后插入。');return false}b.frame={x:50,y:bottom,width:900,height};b.layer=Math.min(1000,doc.blocks.length+incoming.indexOf(b));bottom+=height+32}}
    change(()=>{const at=append?doc.blocks.length:Math.max(0,selected+1);doc.blocks.splice(at,0,...incoming);selected=at;activeField=null;if(free)doc.canvas.height=Math.min(12000,Math.max(doc.canvas.height,...incoming.map(b=>b.frame.y+b.frame.height+32)))});return true;
  }
  async function pickImage(key,target=doc.blocks[selected]){try{const [asset]=await chooseAsset();if(disposed||!asset||!doc.blocks.includes(target))return;if(target.type==='exhibition'){change(()=>setExhibitionImage(target,key,asset.src));return}const m=/^items\.(\d+)\.src$/.exec(key);if(key!=='src'&&(!m||!target.items[Number(m[1])]))return;change(()=>{if(key==='src')target.src=asset.src;else target.items[Number(m[1])].src=asset.src})}catch(e){onError(e.message)}}
  function set(k,v){if(!doc.blocks[selected])return;change(()=>doc.blocks[selected][k]=v)}
  function move(delta){const next=selected+delta;if(next<0||next>=doc.blocks.length)return;change(()=>{[doc.blocks[next],doc.blocks[selected]]=[doc.blocks[selected],doc.blocks[next]];selected=next})}
  function syncInspector(){const b=doc.blocks[selected]||{},free=doc.layout==='free';const field=activeField||(b.type==='exhibition'?'pages.'+(pageIndices.get(b)||0)+'.body':'body');syncFontSelect(family,b.type==='component'?componentRuns(b,field):b.type==='exhibition'?exhibitionRuns(b,field):b.runs,b.font||'default');family.disabled=['image','divider'].includes(b.type);wrap.value=b.wrap||'none';width.value=String(b.width||100);fit.value=b.fit||'contain';height.value=b.height||0;hWrap.hidden=b.type!=='image'||free;fit.parentElement.hidden=b.type!=='image';width.parentElement.hidden=wrap.parentElement.hidden=free;width.disabled=wrap.disabled=!['image','textbox','component','exhibition'].includes(b.type);font.value=String(b.size||(b.type==='heading'?32:18));color.value=b.color||(doc.preset==='cinema'?'#e4e8df':'#222521');align.value=b.align||'left';preset.value=doc.preset;objectTools.sync()}
  function choose(i){if(selected!==i)activeField=null;selected=i;[...surface.children].forEach((e,j)=>e.classList.toggle('is-selected',i===j));syncInspector();componentInspector.sync();exhibitionInspector.sync()}
  function format(key,value){
    rememberRange();
    const b=doc.blocks[selected];if(!b)return;const exhibition=b.type==='exhibition',component=b.type==='component'||exhibition,field=activeField||(exhibition?'pages.'+(pageIndices.get(b)||0)+'.body':'body'),getRuns=exhibition?exhibitionRuns:componentRuns,putRuns=exhibition?setExhibitionRuns:setComponentRuns,runs=component?getRuns(b,field):b.runs;if(!runs)return;
    const edit=surface.children[selected]?.querySelector(component?`[data-component-field="${field}"]`:'[contenteditable]');
    if(key==='font'){
      if(!validFont(value))return;
      if(applySelectedFont(edit,range,value)){if(component)putRuns(b,field,runsFrom(edit));else b.runs=runsFrom(edit);commit();syncInspector()}
      else{if(component)putRuns(b,field,runs.map(r=>({...r,font:value})));else{b.font=value;b.runs=runs.map(({font,...r})=>r)}commit();paint()}
      return;
    }
    if(range&&!range.collapsed&&edit?.contains(range.commonAncestorContainer)){
      const span=node('span');const style=range.startContainer.nodeType===1?getComputedStyle(range.startContainer):getComputedStyle(range.startContainer.parentElement);
      if(key==='bold')span.style.fontWeight=Number(style.fontWeight)>=600?'400':'700';if(key==='italic')span.style.fontStyle=style.fontStyle==='italic'?'normal':'italic';if(key==='underline')span.style.textDecoration=style.textDecorationLine.includes('underline')?'none':'underline';if(key==='size')span.style.fontSize=value+'px';if(key==='color')span.style.color=value;
      if(key==='size')span.style.setProperty('--run-size',value+'px');
      const fragment=range.extractContents(),property={bold:'fontWeight',italic:'fontStyle',underline:'textDecoration',size:'fontSize',color:'color'}[key];
      fragment.querySelectorAll('[style]').forEach(child=>{child.style[property]='';if(key==='size')child.style.removeProperty('--run-size')});
      span.append(fragment);range.insertNode(span);const selection=getSelection();range.selectNodeContents(span);selection.removeAllRanges();selection.addRange(range);if(component)putRuns(b,field,runsFrom(edit));else b.runs=runsFrom(edit);commit();
    }else{if(component){const enabled=['size','color'].includes(key)?value:!runs.every(r=>r[key]);putRuns(b,field,runs.map(r=>({...r,[key]:enabled})))}else if(['size','color'].includes(key)){b[key]=value;b.runs=b.runs.map(r=>{const next={...r};delete next[key];return next})}else{const enabled=!b.runs.every(r=>r[key]);b.runs=b.runs.map(r=>({...r,[key]:enabled}))}commit();paint()}
  }
  function rememberRange(){const s=getSelection();if(!s.rangeCount)return;const r=s.getRangeAt(0);const el=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement;const edit=el?.closest?.('.mag-edit-text');if(edit&&paper.contains(edit)){range=r.cloneRange();choose(Number(edit.closest('[data-index]').dataset.index));activeField=edit.dataset.componentField||null;syncInspector()}}
  document.addEventListener('selectionchange',rememberRange);
  function plainPaste(e,edit){e.preventDefault();const selection=getSelection();if(!selection.rangeCount)return;const r=selection.getRangeAt(0);if(!edit.contains(r.commonAncestorContainer))return;const text=document.createTextNode(e.clipboardData.getData('text/plain'));r.deleteContents();r.insertNode(text);r.setStartAfter(text);r.collapse(true);selection.removeAllRanges();selection.addRange(r);edit.dispatchEvent(new Event('input',{bubbles:true}))}
  function paint(){
    range=null;releaseExhibitions(paper);releaseEditorial(paper);releaseSurface(paper);paper.replaceChildren();paper.dataset.preset=doc.preset;root.dataset.layout=doc.layout||'flow';
    for(const control of bar.querySelectorAll('button,input,select')){
      if([previewButton,expand,saveButton,preset].includes(control))continue;
      if(previewing){if(!control.hasAttribute('data-preview-disabled'))control.dataset.previewDisabled=String(control.disabled);control.disabled=true}
      else if(control.hasAttribute('data-preview-disabled')){control.disabled=control.dataset.previewDisabled==='true';delete control.dataset.previewDisabled}
    }
    componentInspector.hide(previewing);exhibitionInspector.hide(previewing);
    if(previewing){renderMagazine(paper,doc);paper.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src');if(src.startsWith('./assets/'))img.src='/'+src.slice(2)});inspector.hidden=true;return}inspector.hidden=false;
    surface=createSurface(paper,doc);
    doc.blocks.forEach((b,i)=>{
      const box=node('div','mag-block mag-edit-block');box.dataset.index=i;applyBlockStyle(box,b);box.classList.toggle('is-selected',i===selected);
      box.addEventListener('pointerdown',()=>choose(i));
      const handle=node('button','mag-drag','⠿');handle.type='button';handle.draggable=true;handle.setAttribute('aria-label','移动段落 '+(i+1));handle.title='拖动改变顺序';box.append(handle);
      handle.addEventListener('dragstart',e=>{dragIndex=i;e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move'});
      box.addEventListener('dragover',e=>{if(dragIndex!==null){e.preventDefault();e.dataTransfer.dropEffect='move'}});
      box.addEventListener('drop',e=>{e.preventDefault();if(dragIndex===null||dragIndex===i)return;const from=dragIndex;dragIndex=null;change(()=>{const [moving]=doc.blocks.splice(from,1);doc.blocks.splice(i,0,moving);selected=i})});handle.addEventListener('dragend',()=>dragIndex=null);
      if(b.type==='component')box.append(renderComponent(b,{editing:true,free:doc.layout==='free',headings:magazineHeadings(doc),onImage:key=>pickImage(key,b),onText:(edit,key)=>{edit.addEventListener('input',()=>{setComponentRuns(b,key,runsFrom(edit));commit()});edit.addEventListener('paste',e=>plainPaste(e,edit));edit.addEventListener('drop',e=>e.preventDefault());edit.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();(e.key.toLowerCase()==='y'||e.shiftKey?redo:undo).click()}})}}));
      else if(b.type==='exhibition')box.append(renderExhibition(b,{editing:true,initialPage:pageIndices.get(b)||0,onPage:at=>{pageIndices.set(b,at);if(doc.blocks[selected]===b){activeField='pages.'+at+'.body';exhibitionInspector.sync(true)}},onImage:key=>pickImage(key,b),onText:(edit,key)=>{edit.addEventListener('input',()=>{setExhibitionRuns(b,key,runsFrom(edit));commit()});edit.addEventListener('paste',e=>plainPaste(e,edit));edit.addEventListener('drop',e=>e.preventDefault());edit.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();(e.key.toLowerCase()==='y'||e.shiftKey?redo:undo).click()}})}}));
      else if(b.type==='image'){
        box.append(makeImageFrame(b,{editing:true}));
        const caption=node('input','mag-caption');caption.value=b.caption;caption.placeholder='输入图片说明';caption.setAttribute('aria-label','图片说明 '+(i+1));caption.addEventListener('input',()=>{b.caption=caption.value;commit()});box.append(caption);
      }else if(b.type!=='divider'){
        const edit=node('div','mag-edit-text');edit.contentEditable='true';edit.setAttribute('role','textbox');edit.setAttribute('aria-multiline','true');edit.setAttribute('aria-label',`正文段落 ${i+1}`);edit.dataset.placeholder=b.type==='heading'?'输入小标题…':b.type==='textbox'?'输入旁注或摘录…':'在这里写下经历与评价…';renderRuns(edit,b.runs);
        edit.addEventListener('input',()=>{b.runs=runsFrom(edit);commit()});edit.addEventListener('paste',e=>plainPaste(e,edit));edit.addEventListener('drop',e=>e.preventDefault());edit.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();(e.key.toLowerCase()==='y'||e.shiftKey?redo:undo).click()}});box.append(edit);
      }
      objectTools.decorate(box,b,i,handle);
      surface.append(box);
    });syncInspector();componentInspector.sync(true);exhibitionInspector.sync(true);updateUndo();
  }
  paint();
  return {append(blocks){return insertMany(blocks,true)},read(){if(!validateMagazine(doc))throw Error('文章内容过长或版式参数不正确，请调整后保存。');return structuredClone(doc)},destroy(){disposed=true;closeLibrary?.();toolbarObserver.disconnect();releaseExhibitions(paper);releaseEditorial(paper);releaseSurface(paper);document.removeEventListener('selectionchange',rememberRange);document.body.classList.remove('mag-expanded');root.remove()}};
}

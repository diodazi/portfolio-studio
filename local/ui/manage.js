import {mountGameReviewEditor} from '/manage/game-review-editor.js';
import {SITE_FIELDS} from '/site-config.js';
import {getLocalWorks,deleteLocalWork} from '/storage.js';
import {mountCoverSearch} from '/manage/cover-search.js';
import {parseBilibiliInput,bilibiliVideoSource} from '/video-source.js';
import {mountMagazineEditor} from '/manage/magazine-editor.js';
import {magazineFor} from '/magazine.js';
import {createMediaLibraryUI} from '/manage/media-library.js';
let magazineEditor=null,gameEditor=null;
const $=s=>document.querySelector(s);
const sections={
  top:{label:'首页与全站',anchor:'top'},photographs:{label:'摄影作品',resource:'content',anchor:'photography'},
  projects:{label:'参与的现场',resource:'content',anchor:'stage'},videos:{label:'影像作品',resource:'content',anchor:'media'},
  audio:{label:'声音展示',resource:'content',anchor:'media'},games:{label:'游戏评价',resource:'journal',anchor:'games',url:'/games.html'},
  cinema:{label:'电影手记',resource:'journal',anchor:'cinema',url:'/cinema.html'},writing:{label:'文字与随笔',resource:'writing',key:'articles',anchor:'about',url:'/writing.html'},
  about:{label:'个人介绍',anchor:'about'},contact:{label:'联系合作',anchor:'contact'}
};
const imageAccept='.jpg,.jpeg,.png,.webp,.avif';
const mediaAccept={photographs:imageAccept,videos:'.mp4,.webm',audio:'.mp3,.wav,.ogg,.m4a,.flac'};
let section=new URLSearchParams(location.search).get('section');if(!sections[section])section='photographs';
let docs,token,selected=null,dirty=false,busy=false,mode='content',fieldReaders={},settingReaders={},legacy=[],coverSearch=null;
let drafts=new Map(),publishedVersions={},missingVersion='',baseRecord={},operation='upsert',position=null,editVersion=0,saveTimer=null,saving=null;
const draftKey=(s,id)=>s+':'+id;
const library=createMediaLibraryUI({getToken:()=>token,upload});
const chooseAsset=options=>library.open(options);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const key=()=>sections[section].key||section;
const publicRecords=()=>docs[sections[section].resource]?.[key()]||[];
function records(){const list=publicRecords().map(e=>drafts.get(draftKey(section,e.id))?.data||e);for(const d of drafts.values())if(d.section===section){const i=list.findIndex(e=>e.id===d.id);if(i<0)list.push(d.data);if(d.position!=null){const at=list.findIndex(e=>e.id===d.id);list.splice(at,1);list.splice(d.position,0,d.data)}}return list}
const identity=()=>mode==='copy'?{section:'site',id:section}:{section,id:selected};
const currentDraft=()=>{const who=identity();return drafts.get(draftKey(who.section,who.id))};
function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error)}
function markDirty(){dirty=true;editVersion++;updateStatus('等待自动保存…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushDraft().catch(e=>{updateStatus('保存失败 · 修改仍在当前页面');message(e.message,true)}),700)}
async function canLeave(){if(busy)return false;try{await flushDraft();return true}catch(e){message(e.message,true);return false}}
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue=''}});
function lock(value){busy=value;document.querySelectorAll('button,input,textarea,select').forEach(e=>{if(value){if(!e.hasAttribute('data-was-disabled'))e.dataset.wasDisabled=String(e.disabled);e.disabled=true}else if(e.hasAttribute('data-was-disabled')){e.disabled=e.dataset.wasDisabled==='true';delete e.dataset.wasDisabled}});document.querySelectorAll('[contenteditable]').forEach(e=>{if(value){e.dataset.wasEditable=e.contentEditable;e.contentEditable='false'}else if(e.dataset.wasEditable){e.contentEditable=e.dataset.wasEditable;delete e.dataset.wasEditable}})}
function label(parent,text,id){const l=node('label','field-label',text);l.htmlFor=id;parent.append(l)}
function inputField(parent,k,title,value='',type='text',options){
  const wrap=node('div');const id='field-'+k;
  label(wrap,title,id);let input;
  if(type==='select'){input=node('select');for(const [val,text]of options){const o=node('option','',text);o.value=val;input.append(o)}}
  else{input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type}
  input.id=id;input.value=value??'';if(type==='select'&&input.selectedIndex<0)input.selectedIndex=0;input.autocomplete='off';input.addEventListener('input',markDirty);
  if(type==='number'){input.min='0';input.max='999999.9';input.step='.1'}
  if(type==='range'){input.min='0';input.max='100';input.step='1'}
  if(type==='text')input.maxLength=350;if(type==='textarea')input.maxLength=12000;
  if(k==='title')input.maxLength=180;
  wrap.append(input);parent.append(wrap);return ()=>input.value.trim();
}
function picker(text,accept,multiple,action){const l=node('label','upload-button',text);const input=node('input');input.type='file';input.accept=accept;input.multiple=multiple;input.setAttribute('aria-label',text);input.addEventListener('change',async()=>{const files=[...input.files];if(!files.length)return;lock(true);try{await action(files)}catch(e){message(e.message,true)}finally{input.value='';lock(false)}});l.append(input);return l}
async function upload(file){
  if(!file.size||file.size>100*1024*1024)throw Error('请选择不超过 100 MB 的非空文件。');
  return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/manage/upload?name='+encodeURIComponent(file.name));xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-Local-Token',token);
    xhr.upload.onprogress=e=>message('正在上传 '+file.name+(e.lengthComputable?' · '+Math.round(e.loaded/e.total*100)+'%':''));
    xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText)}catch{return reject(Error('上传服务未响应，请检查本地服务。'))}if(xhr.status!==201)return reject(Error(data.error||'上传失败。'));resolve(data)};
    xhr.timeout=300000;xhr.ontimeout=()=>reject(Error('上传超时，请重新选择文件后重试。'));xhr.onerror=()=>reject(Error('上传中断，请确认本地服务仍在运行。'));xhr.send(file);
  });
}
function mediaField(parent,k,title,value='',accept=imageAccept){
  let current=value;const wrap=node('div');label(wrap,title,'upload-'+k);const box=node('div','media-field');wrap.append(box);parent.append(wrap);
  const read=()=>current;read.set=value=>{current=value;markDirty();paint()};
  function paint(){box.replaceChildren();if(current){const url='/'+current.replace(/^\.\//,'');let preview;
    if(/\.(png|jpe?g|webp|avif)$/i.test(current)){preview=node('img');preview.alt='已选图片';preview.src=url}
    else if(/\.(mp4|webm)$/i.test(current)){preview=node('video');preview.controls=true;preview.preload='metadata';preview.src=url}
    else if(/\.(mp3|wav|ogg|m4a|flac)$/i.test(current)){preview=node('audio');preview.controls=true;preview.preload='metadata';preview.src=url}
    else {preview=node('a','text-link','查看已上传文件 ↗');preview.href=url;preview.target='_blank';preview.rel='noopener'}box.append(preview);
  }
  const choose=picker(current?'替换文件':'选择并上传文件',accept,false,async files=>{const saved=await upload(files[0]);current=saved.src;read.onChange?.();markDirty();const t=$('#field-title');if(t&&!t.value)t.value=files[0].name.replace(/\.[^.]+$/,'').slice(0,180);paint();message('文件已加入素材库，内容将自动存为草稿。')});choose.querySelector('input').id='upload-'+k;box.append(choose);
  const fromLibrary=node('button','subtle','从素材库选择');fromLibrary.type='button';fromLibrary.onclick=async()=>{const [asset]=await chooseAsset({accept});if(asset){current=asset.src;read.onChange?.();markDirty();paint()}};box.append(fromLibrary);
  if(current){const remove=node('button','subtle','取消使用');remove.type='button';remove.addEventListener('click',()=>{current='';read.onChange?.();markDirty();paint()});box.append(remove)}
  box.append(node('p','','支持 '+accept.replaceAll('.','').toUpperCase()+' · 单个文件 ≤ 100 MB'));
  }paint();return read;
}
function galleryField(parent,initial=[]){let images=[...initial];const wrap=node('div');label(wrap,'项目图片（可多张）','project-images');const box=node('div','media-field');wrap.append(box);parent.append(wrap);
  function paint(){box.replaceChildren();const thumbs=node('div','image-thumbs');images.forEach((src,i)=>{const fig=node('figure'),img=node('img');img.src='/'+src.slice(2);img.alt='项目图片 '+(i+1);const remove=node('button','','移除');remove.type='button';remove.addEventListener('click',()=>{images.splice(i,1);markDirty();paint()});fig.append(img,remove);thumbs.append(fig)});box.append(thumbs,picker('上传项目图片',imageAccept,true,async files=>{for(const file of files){if(images.length>=40)throw Error('一个项目最多使用 40 张图片。');const saved=await upload(file);images.push(saved.src);markDirty();paint()}message('图片已加入草稿。')}));const b=node('button','subtle','从素材库添加');b.type='button';b.onclick=async()=>{const assets=await chooseAsset({accept:imageAccept,multiple:true});if(assets.length){images=[...new Set([...images,...assets.map(a=>a.src)])].slice(0,40);markDirty();paint()}};box.append(b)}paint();return ()=>images;
}
function renderSettings(){settingReaders={};const root=$('#settings-fields');root.replaceChildren();const saved=drafts.get(draftKey('site',section))?.data||{};for(const [k,f]of Object.entries(SITE_FIELDS).filter(([,f])=>f.group===section)){const value=saved[k]??docs.site[k]??f.value;
  settingReaders[k]=['image','pdf'].includes(f.type)?mediaField(root,k,f.label,value,f.type==='pdf'?'.pdf':imageAccept):inputField(root,k,f.label,value,['lines','tags'].includes(f.type)?'textarea':f.type==='email'?'email':'text');
  }
}
function bodyText(entry){return (entry.blocks||entry.paragraphs?.map(text=>({type:'paragraph',text}))||[]).map(b=>b.type==='heading'?'## '+b.text:b.type==='quote'?'> '+b.text:b.type==='image'?`![${b.text||''}](${b.src})`:b.text).join('\n\n')}
function parseBody(value){return value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).map(text=>{const m=/^!\[([^\]]*)\]\((\.\/assets\/media\/[^\s)]+)\)$/.exec(text);return m?{type:'image',text:m[1],src:m[2]}:text.startsWith('## ')?{type:'heading',text:text.slice(3)}:text.startsWith('> ')?{type:'quote',text:text.slice(2)}:{type:'paragraph',text}})}
function renderEntry(entry=null){gameEditor?.destroy();gameEditor=null;magazineEditor?.destroy();magazineEditor=null;coverSearch?.destroy();coverSearch=null;selected=entry?.id||crypto.randomUUID();const draft=drafts.get(draftKey(section,selected));entry=draft?.data||entry;baseRecord=entry||{};operation=draft?.operation||'upsert';position=draft?.position??null;dirty=false;fieldReaders={};const root=$('#entry-fields');root.replaceChildren();$('#entry-heading').textContent=entry?'编辑内容':'新建内容';$('#remove-entry').hidden=!publicRecords().some(e=>e.id===selected);$('#move-up').hidden=$('#move-down').hidden=!entry||['games','cinema'].includes(section);history.replaceState({},'','/manage/?section='+section+'&id='+selected);
  document.body.dataset.section=section;
  const add=(k,label,type='text',options)=>fieldReaders[k]=inputField(root,k,label,entry?.[k]||'',type,options);
  const media=(k,label,accept)=>fieldReaders[k]=mediaField(root,k,label,entry?.[k]||'',accept);
  add('title',section==='games'?'游戏名称':section==='cinema'?'电影名称':section==='writing'?'文章标题':'名称');
  if(mediaAccept[section]){
    if(section==='videos'){
      fieldReaders.provider=inputField(root,'provider','视频来源',entry?.provider||'local','select',[['local','上传视频文件'],['bilibili','哔哩哔哩链接']]);
      const local=node('div'),external=node('div');root.append(local,external);
      fieldReaders.src=mediaField(local,'src','视频文件',entry?.src||'',mediaAccept.videos);
      fieldReaders.bilibiliUrl=inputField(external,'bilibiliUrl','B 站视频链接 / BV 号',entry?.bilibiliUrl??bilibiliVideoSource(entry)?.original??'');
      external.append(node('p','field-help','粘贴完整视频链接或 BV 号。支持链接中的分 P；封面可在下方上传。'));
      const sync=()=>{local.hidden=fieldReaders.provider()!=='local';external.hidden=fieldReaders.provider()!=='bilibili'};
      $('#field-provider').addEventListener('change',sync);sync();
    }else media('src',section==='photographs'?'摄影图片':'声音文件',mediaAccept[section]);
    add('description','内容说明 / 展示文本','textarea');
    if(section==='photographs'){add('category','摄影分类','select',[['portrait','人像'],['street','街头'],['stage','演出现场']]);fieldReaders.position=inputField(root,'position','封面取景（上 — 下）',entry?.position??50,'range')}
    if(section==='videos')media('poster','视频封面（可选）',imageAccept);
  }else if(section==='projects'){
    add('subtitle','项目类型');add('role','担任角色');add('period','参与时间');add('highlight','重点成果');fieldReaders.description=inputField(root,'description','项目详情（每行一段）',(entry?.description||[]).join('\n'),'textarea');media('cover','项目封面（可选）',imageAccept);fieldReaders.images=galleryField(root,entry?.images||[]);
  }else if(section==='games'||section==='cinema'){
    const cover=media('cover','封面 / 海报（可选）',imageAccept);let provenance=entry?.coverSource||null;
    fieldReaders.coverSource=()=>provenance;
    coverSearch=mountCoverSearch(root,{kind:section,getTitle:()=>$('#field-title').value.trim(),getToken:()=>token,source:provenance,runImport:action,onImport:saved=>{cover.set(saved.src);provenance=saved.coverSource;message('封面已加入素材库，将随草稿自动保存。')}});
    cover.onChange=()=>{provenance=null;coverSearch?.clearSource();gameEditor?.syncMeta({coverChanged:true})};
    if(section==='games'){const searchPanel=root.querySelector('.cover-search'),fold=node('details','game-cover-discovery');fold.append(node('summary','','在线搜索封面 · Steam / Bangumi'));searchPanel.before(fold);fold.append(searchPanel)}
    if(section==='games'){
      gameEditor=mountGameReviewEditor(root,{entry:entry||{},getTitle:()=>$('#field-title').value.trim(),getCover:()=>cover(),getToken:()=>token,chooseAsset:options=>chooseAsset({accept:imageAccept,...options}),onChange:markDirty,onError:text=>message(text,true)});
      $('#field-title').addEventListener('input',()=>gameEditor?.syncMeta());
    }else{
      add('director','导演');add('year','上映年份');add('rating','个人评分','select',[['','不评分'],...[1,2,3,4,5].map(x=>[String(x),x+' 星'])]);add('date','观影日期','date');add('note','简短摘要（可选）','textarea');
      magazineEditor=mountMagazineEditor(root,{entry:entry||{},upload,chooseAsset:()=>chooseAsset({accept:imageAccept,multiple:true}),onChange:markDirty,onError:text=>message(text,true)});fieldReaders.magazine=()=>magazineEditor.read();
    }
  }else if(section==='writing'){
    add('date','写作日期','date');add('summary','文章摘要','textarea');fieldReaders.tags=inputField(root,'tags','标签（用逗号分隔）',(entry?.tags||[]).join('，'));media('cover','文章封面（可选）',imageAccept);
    const writingEntry=entry?.body&&!entry.magazine?{...entry,blocks:parseBody(entry.body)}:entry||{};
    magazineEditor=mountMagazineEditor(root,{entry:writingEntry,label:'正文排版',upload,chooseAsset:()=>chooseAsset({accept:imageAccept,multiple:true}),onChange:markDirty,onError:text=>message(text,true)});
    fieldReaders.magazine=()=>magazineEditor.read();
    root.append(picker('追加导入文字文件','.txt,.md',false,async files=>{if(files[0].size>1024*1024)throw Error('文字文件不能超过 1 MB。');const editor=magazineEditor,text=await files[0].text();if(editor!==magazineEditor)return;if(editor.append(magazineFor({blocks:parseBody(text)}).blocks))message('文字已追加到草稿末尾，可撤销；检查后再发布。')}));
  }
  renderList();updateStatus();
}
function setSnapshot(editor){drafts=new Map(editor.drafts.map(d=>[draftKey(d.section,d.id),d]));publishedVersions=editor.publishedVersions;missingVersion=editor.missingVersion}
function updateStatus(text){const d=currentDraft();const state=text||(d?(d.operation==='remove'?'待发布移除 · 访客内容仍保留':'草稿已保存 · '+new Date(d.updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+' · 未发布'):mode==='copy'||publicRecords().some(e=>e.id===selected)?'当前为已发布版本':'开始编辑后自动保存草稿');$('#editing-state').textContent=state;$('#autosave-status').textContent=state;$('#publish-center').textContent='待发布 · '+drafts.size;$('#remove-entry').textContent=d?.operation==='remove'?'撤销移除':'标记移除';document.querySelectorAll('[data-publish-current]').forEach(b=>b.disabled=busy||(!d&&!dirty));document.querySelectorAll('[data-discard]').forEach(b=>b.hidden=!d);}
function readCurrent(){if(mode==='copy')return Object.fromEntries(Object.entries(settingReaders).map(([k,read])=>[k,read()]));const record={...baseRecord,id:selected,...Object.fromEntries(Object.entries(fieldReaders).map(([k,read])=>[k,read()]))};if(section==='games'&&gameEditor)Object.assign(record,gameEditor.read());if(section==='photographs')record.position=Number(record.position);if(section==='projects')record.description=record.description.split('\n').map(x=>x.trim()).filter(Boolean);if(section==='writing'){record.blocks=[];delete record.body;delete record.paragraphs;record.tags=record.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean);record.published=true}return record}
async function api(route,data,revision,method='POST'){const r=await fetch('/api/manage/'+route,{method,headers:{'Content-Type':'application/json','X-Local-Token':token,...(revision?{'If-Match':revision}:{})},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'操作未完成。');return result}
async function saveOne(who,data,options={}){const k=draftKey(who.section,who.id),previous=drafts.get(k);const result=await api('drafts',{...who,data,operation:options.operation||'upsert',position:options.position??null,baseHash:previous?.baseHash||publishedVersions[k]||missingVersion,checkpoint:!!options.checkpoint},previous?.revision||'new','PUT');drafts.set(k,result.draft);return result.draft}
async function flushDraft(checkpoint=false){
  clearTimeout(saveTimer);if(saving){await saving;if(!dirty&&!checkpoint)return;return flushDraft(checkpoint)}
  if(!dirty&&!checkpoint)return;if(!dirty&&!currentDraft())return;
  saving=(async()=>{do{const version=editVersion,who=identity(),data=readCurrent();updateStatus('正在保存草稿…');await saveOne(who,data,{operation:mode==='copy'?'upsert':operation,position:mode==='copy'?null:position,checkpoint});if(version===editVersion)dirty=false;checkpoint=false;updateStatus();renderList()}while(dirty)})();
  try{await saving}finally{saving=null}
}
function renderList(){
 const list=$('#entry-list');list.replaceChildren();if(!sections[section].resource)return;
 $('#record-total').textContent=records().length+' 条内容';
 for(const e of records()){
  const d=drafts.get(draftKey(section,e.id)),b=node('button','entry-choice'),name=e.title||'未命名草稿',state=d?(d.operation==='remove'?'待发布移除':'草稿 · 未发布'):'已发布';
  b.type='button';b.title=name;b.setAttribute('aria-label',name+' · '+state);if(e.id===selected)b.setAttribute('aria-current','true');
  const cover=e.cover||e.poster||(section==='photographs'?e.src:null);
  if(cover){const img=node('img');img.src='/'+cover.replace(/^\.\//,'');img.alt='';b.append(img)}
  const copy=node('span','entry-choice-copy'),title=node('span','entry-choice-title',name);
  copy.append(title,node('small',d?'draft-badge':'',state));b.append(copy);
  b.onclick=async()=>{if(await canLeave()){renderEntry(records().find(x=>x.id===e.id));message('')}};list.append(b);
 }
 if(!records().length)list.append(node('p','list-empty','还没有内容。可新建一条，或上传素材。'));
}
function switchMode(next,entryId){gameEditor?.destroy();gameEditor=null;magazineEditor?.destroy();magazineEditor=null;coverSearch?.destroy();coverSearch=null;mode=next;const collection=!!sections[section].resource;$('#mode-tabs').hidden=!collection;$('#settings-panel').hidden=collection&&mode==='content';$('#collection-panel').hidden=!collection||mode==='copy';$('#content-mode').setAttribute('aria-pressed',String(mode==='content'));$('#copy-mode').setAttribute('aria-pressed',String(mode==='copy'));dirty=false;renderSettings();if(collection&&mode==='content')renderEntry(records().find(e=>e.id===entryId)||null);else{history.replaceState({},'','/manage/?section='+section+'&mode=copy');updateStatus()}}
function renderSection(entryId,initialMode){document.querySelectorAll('#manager-nav button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.section===section)));$('#section-heading').textContent=sections[section].label;$('#section-preview').href=sections[section].url||'/#'+sections[section].anchor;$('#bulk-label').hidden=!mediaAccept[section];$('#bulk-upload').accept=mediaAccept[section]||'';switchMode(sections[section].resource?(initialMode||'content'):'copy',entryId);message('')}
async function action(fn){if(busy)return;lock(true);try{await fn()}catch(e){message(e.message,true)}finally{lock(false);updateStatus(dirty?'修改尚未保存，请重试保存草稿':undefined)}}
function redraw(){if(mode==='copy'){renderSettings();updateStatus()}else renderEntry(records().find(e=>e.id===selected)||null)}
async function publishItems(items){const data=await api('publish',{items});docs=data.documents;setSnapshot(data.editor);dirty=false;redraw();message('已发布 '+data.count+' 条内容，其余草稿继续保留。')}
for(const form of ['entry-form','settings-form'])$('#'+form).addEventListener('submit',e=>{e.preventDefault();action(async()=>{await flushDraft(true);message('草稿已保存在本机，发布后才会对访客生效。')})});
document.querySelectorAll('[data-publish-current]').forEach(b=>b.onclick=()=>action(async()=>{await flushDraft(true);const d=currentDraft();if(d)await publishItems([{section:d.section,id:d.id,revision:d.revision}])}));
document.querySelectorAll('[data-discard]').forEach(b=>b.onclick=()=>action(async()=>{await flushDraft();const d=currentDraft();if(!d||!confirm('丢弃当前草稿，回到已发布内容？丢弃前的版本仍可在历史记录中恢复。'))return;await api('drafts/discard',{section:d.section,id:d.id},d.revision);drafts.delete(draftKey(d.section,d.id));redraw();message('草稿已丢弃，公开内容保持原状。')}));
$('#remove-entry').onclick=()=>action(async()=>{await flushDraft();const pending=currentDraft()?.operation==='remove';if(!pending&&!confirm('将这条内容标记为待移除？只有点击发布后，访客才看不到它。'))return;operation=pending?'upsert':'remove';dirty=true;editVersion++;await flushDraft(true);message(pending?'已撤销待移除标记。':'已标记移除。发布后生效，素材文件会继续保留。')});
for(const [id,delta]of [['move-up',-1],['move-down',1]])$('#'+id).onclick=()=>action(async()=>{await flushDraft();const i=records().findIndex(e=>e.id===selected),j=i+delta;if(j<0||j>=records().length)return;position=j;dirty=true;editVersion++;await flushDraft(true);message('新顺序已存入草稿，发布后生效。')});
$('#new-entry').onclick=async()=>{if(await canLeave()){renderEntry();message('');$('#field-title').focus()}};
$('#content-mode').onclick=async()=>{if(mode!=='content'&&await canLeave())switchMode('content')};$('#copy-mode').onclick=async()=>{if(mode!=='copy'&&await canLeave())switchMode('copy')};
$('#open-library').onclick=async()=>{if(await canLeave())await chooseAsset({manage:true,multiple:true})};
function modal(title){const d=node('dialog','workflow-dialog');d.setAttribute('aria-label',title);const head=node('header','dialog-head'),h=node('h2','',title),close=node('button','subtle','关闭');close.type='button';close.onclick=()=>d.close();head.append(h,close);d.append(head);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d}
$('#publish-center').onclick=async()=>{
  if(!await canLeave())return;const dialog=modal('发布草稿'),intro=node('p','dialog-intro','选中的内容发布后会更新访客页面；未选中的草稿继续保留。'),status=node('p','dialog-status'),list=node('div','publish-list'),footer=node('footer','dialog-footer');status.setAttribute('role','status');dialog.append(intro,status,list,footer);
  const checks=[];for(const d of [...drafts.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){const row=node('label','publish-row'),input=node('input');input.type='checkbox';input.value=draftKey(d.section,d.id);input.setAttribute('aria-label',d.data.title||(d.section==='site'?sections[d.id]?.label:'')||'未命名草稿');const text=node('span','',d.data.title||(d.section==='site'?sections[d.id]?.label:'')||'未命名草稿');text.append(node('small','',(d.section==='site'?'板块文字':sections[d.section].label)+' · '+(d.operation==='remove'?'移除':'更新')+' · '+new Date(d.updatedAt).toLocaleString('zh-CN')));row.append(input,text);list.append(row);checks.push({input,d});input.onchange=()=>sync()}
  if(!checks.length)list.append(node('p','list-empty','所有内容已发布，暂时没有待发布草稿。'));
  const all=node('button','subtle','全选 / 清空'),publish=node('button','primary-button','发布选中');all.type=publish.type='button';all.onclick=()=>{const value=checks.some(v=>!v.input.checked);checks.forEach(v=>v.input.checked=value);sync()};const sync=()=>{const n=checks.filter(v=>v.input.checked).length;publish.textContent='发布选中 · '+n;publish.disabled=!n};
  publish.onclick=async()=>{const chosen=checks.filter(v=>v.input.checked);lock(true);dialog.dataset.working='true';try{await publishItems(chosen.map(({d})=>({section:d.section,id:d.id,revision:d.revision})));dialog.close()}catch(e){status.textContent=e.message;status.classList.add('error')}finally{delete dialog.dataset.working;lock(false);sync();updateStatus()}};dialog.addEventListener('cancel',e=>{if(dialog.dataset.working)e.preventDefault()});footer.append(all,publish);sync();
};
document.querySelectorAll('[data-history]').forEach(b=>b.onclick=async()=>{
  if(!await canLeave())return;const who=identity(),dialog=modal('版本历史'),status=node('p','dialog-status'),list=node('div','history-list');dialog.append(node('p','dialog-intro','保留最近 30 个版本。恢复操作会生成草稿，确认后可单独发布。'),status,list);
  try{const r=await fetch('/api/manage/history?'+new URLSearchParams(who),{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error);for(const version of data.versions.reverse()){const row=node('div','history-row'),text=node('div','',new Date(version.time).toLocaleString('zh-CN'));text.append(node('small','',version.reason+' · '+(version.data.title||'板块内容')),node('p','history-excerpt',JSON.stringify(version.data).slice(0,180)));const restore=node('button','subtle','恢复为草稿');restore.type='button';restore.onclick=async()=>{lock(true);dialog.dataset.working='true';try{const d=drafts.get(draftKey(who.section,who.id));const result=await api('history/restore',{...who,versionId:version.id},d?.revision||'new');drafts.set(draftKey(who.section,who.id),result.draft);redraw();message('旧版本已恢复为草稿，公开内容尚未改变。');dialog.close()}catch(e){status.textContent=e.message;status.classList.add('error')}finally{delete dialog.dataset.working;lock(false);updateStatus()}};row.append(text,restore);list.append(row)}if(!data.versions.length)list.append(node('p','list-empty','尚无历史版本。首次编辑后会开始记录。'))}catch(e){status.textContent=e.message;status.classList.add('error')}
  dialog.addEventListener('cancel',e=>{if(dialog.dataset.working)e.preventDefault()});
});
$('#bulk-upload').onchange=async e=>{const files=[...e.target.files];if(!files.length||!await canLeave())return;await action(async()=>{let last;for(const file of files){const saved=await upload(file),data={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,180),src:saved.src,description:''};if(section==='photographs')Object.assign(data,{category:'street',position:50});if(section==='videos')data.provider='local';last=await saveOne({section,id:data.id},data,{checkpoint:true});renderList()}if(last)renderEntry(last.data);message(files.length+' 个素材已生成草稿，可在待发布列表中批量发布。')});e.target.value=''};
$('#migrate').onclick=async()=>{if(!await canLeave())return;action(async()=>{for(const item of legacy){const saved=await upload(new File([item.blob],item.title+'.'+(item.kind==='photographs'?'jpg':item.kind==='videos'?'mp4':'mp3')));const {blob,kind,created,...meta}=item;const record={...meta,src:saved.src};await saveOne({section:kind,id:record.id},record,{checkpoint:true});await deleteLocalWork(item.id)}legacy=[];$('#migrate').hidden=true;renderSection();message('旧预览素材已迁移为草稿，发布后生效。')})};
try{const r=await fetch('/api/manage/bootstrap',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();({token,documents:docs}=data);setSnapshot(data.editor);const initial=new URLSearchParams(location.search);for(const [k,v]of Object.entries(sections)){const b=node('button','',v.label);b.type='button';b.dataset.section=k;b.onclick=async()=>{if(k!==section&&await canLeave()){section=k;renderSection()}};$('#manager-nav').append(b)}$('#connection').textContent='仅本机 · 已连接';renderSection(initial.get('id'),initial.get('mode')==='copy'?'copy':undefined);try{legacy=await getLocalWorks();$('#migrate').hidden=!legacy.length}catch{}
}catch(error){$('#connection').textContent='未连接';message('无法连接本机管理服务。请重新启动本地服务后再打开管理台。',true);console.error(error);lock(true)}

window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!document.querySelector('dialog[open]'))action(async()=>{await flushDraft(true);message('草稿已保存在本机。')})}});

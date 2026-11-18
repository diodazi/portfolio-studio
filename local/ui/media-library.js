import {mediaSourceLink} from '/media-source.js';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const button=(text,fn,cls='subtle')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b};
const kinds={image:'图片',video:'视频',audio:'音频',document:'PDF'};
const url=src=>'/'+src.replace(/^\.\//,'');
export function createMediaLibraryUI({getToken,upload}){
  return {open({accept='',multiple=false,manage=false}={}){return new Promise(resolve=>{
    const dialog=el('dialog','workflow-dialog library-dialog');dialog.setAttribute('aria-label',manage?'素材库':'选择素材');document.body.append(dialog);
    let catalog={assets:[],folders:[]},selected=new Set(),folder='*',page=0,working=false;
    const head=el('header','dialog-head'),title=el('h2','',manage?'素材库':'选择素材');head.append(title,button('关闭',()=>{if(!working)dialog.close()}));
    const hint=el('p','dialog-intro','文件夹与标签只用于整理；在不同作品中选用同一素材，无需重复上传。');
    const status=el('p','dialog-status');status.setAttribute('role','status');
    const controls=el('div','library-filters'),search=el('input'),folders=el('select'),type=el('select');
    search.type='search';search.placeholder='搜索名称、标签';search.setAttribute('aria-label','搜索素材');folders.setAttribute('aria-label','筛选文件夹');type.setAttribute('aria-label','素材类型');
    for(const [value,text]of [['','全部类型'],...Object.entries(kinds)]){const o=el('option','',text);o.value=value;type.append(o)}
    controls.append(search,folders,type);
    const folderActions=el('div','library-actions');
    folderActions.append(button('新建文件夹',()=>{const name=prompt('文件夹名称（使用 / 创建子文件夹）',folder==='*'?'':folder+'/');if(name)mutate({action:'folder-create',name},()=>folder=name)}),button('重命名文件夹',()=>{if(!folder||folder==='*')return say('请先选择一个文件夹。');const to=prompt('新的文件夹名称',folder);if(to&&to!==folder)mutate({action:'folder-rename',from:folder,to},()=>folder=to)}),button('删除空文件夹',()=>{if(!folder||folder==='*')return say('请先选择一个文件夹。');if(confirm('删除这个空文件夹？'))mutate({action:'folder-delete',name:folder},()=>folder='*')}));
    const uploadLabel=el('label','upload-button','上传素材'),fileInput=el('input');fileInput.type='file';fileInput.multiple=true;fileInput.accept=accept||'.jpg,.jpeg,.png,.webp,.avif,.mp4,.webm,.mp3,.wav,.ogg,.m4a,.flac,.pdf';fileInput.setAttribute('aria-label','上传到素材库');uploadLabel.append(fileInput);folderActions.prepend(uploadLabel);
    const body=el('div','library-body'),grid=el('div','library-grid'),inspector=el('aside','library-inspector');body.append(grid,inspector);
    const pagination=el('div','library-pagination'),foot=el('footer','dialog-footer'),chosen=el('span'),choose=button('使用所选素材',()=>{const assets=catalog.assets.filter(a=>selected.has(a.id)&&!a.missing);if(assets.length){resolve(assets);dialog.close()}},'primary-button');choose.hidden=manage;
    foot.append(chosen,button('清空选择',()=>{selected.clear();paint()}),choose);dialog.append(head,hint,controls,folderActions,status,body,pagination,foot);
    const say=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error)};
    const setWorking=value=>{working=value;dialog.querySelectorAll('button,input,select').forEach(e=>{if(value){if(!e.hasAttribute('data-library-disabled'))e.dataset.libraryDisabled=String(e.disabled);e.disabled=true}else if(e.hasAttribute('data-library-disabled')){e.disabled=e.dataset.libraryDisabled==='true';delete e.dataset.libraryDisabled}});if(!value)choose.disabled=!catalog.assets.some(a=>selected.has(a.id)&&!a.missing)};
    async function load(){const r=await fetch('/api/manage/library',{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error);catalog=data;paint()}
    async function mutate(input,done){if(working)return;setWorking(true);try{const r=await fetch('/api/manage/library',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':getToken(),'If-Match':catalog.revision},body:JSON.stringify(input)}),data=await r.json();if(!r.ok){if(r.status===409)await load();throw Error(data.error)}catalog=data;done?.();say('素材整理已保存。');paint()}catch(e){say(e.message,true)}finally{setWorking(false)}}
    function option(select,value,text){const o=el('option','',text);o.value=value;select.append(o)}
    function paint(){
      folders.replaceChildren();option(folders,'*','所有文件夹');option(folders,'','未分类');catalog.folders.forEach(f=>option(folders,f,f));folders.value=folder;
      let items=catalog.assets.filter(a=>(manage||!accept||accept.toLowerCase().split(',').some(ext=>a.src.toLowerCase().endsWith(ext)))&&(folder==='*'||a.folder===folder||folder&&a.folder.startsWith(folder+'/'))&&(!type.value||a.kind===type.value)&&(!search.value||[a.name,...a.tags].join(' ').toLowerCase().includes(search.value.toLowerCase()))).reverse();
      page=Math.min(page,Math.max(0,Math.ceil(items.length/24)-1));grid.replaceChildren();
      for(const asset of items.slice(page*24,page*24+24)){
        const b=button('',()=>{if(asset.missing)return;if(selected.has(asset.id))selected.delete(asset.id);else{if(!multiple&&!manage)selected.clear();selected.add(asset.id)}paint()},'library-tile');b.setAttribute('aria-label',asset.name);b.setAttribute('aria-pressed',String(selected.has(asset.id)));b.disabled=asset.missing;
        const preview=el('div','library-thumb');if(asset.kind==='image'&&!asset.missing){const img=el('img');img.src=url(asset.src);img.loading='lazy';img.alt='';preview.append(img)}else preview.append(el('span','',asset.missing?'文件缺失':kinds[asset.kind]));
        b.append(preview,el('strong','',asset.name),el('small','',[asset.folder||'未分类',Math.max(.1,asset.size/1024/1024).toFixed(1)+' MB'].join(' · ')));grid.append(b);
      }
      if(!items.length)grid.append(el('p','library-empty','这里还没有匹配的素材。可以上传文件，或调整筛选。'));
      pagination.replaceChildren();const previous=button('上一页',()=>{page--;paint()}),next=button('下一页',()=>{page++;paint()});previous.disabled=page===0;next.disabled=(page+1)*24>=items.length;pagination.append(previous,el('span','',`${items.length} 个素材 · ${page+1} / ${Math.max(1,Math.ceil(items.length/24))}`),next);
      const assets=catalog.assets.filter(a=>selected.has(a.id));chosen.textContent='已选择 '+assets.length+' 个素材';choose.disabled=!assets.length;inspector.replaceChildren();
      if(!assets.length){inspector.append(el('h3','','素材信息'),el('p','','选择素材后，可查看引用位置、调整文件夹与标签。'));if(working)setWorking(true);return}
      inspector.append(el('h3','',assets.length===1?'素材信息':'批量整理 · '+assets.length));
      const field=(text,input)=>{const l=el('label','library-field',text);input.setAttribute('aria-label',text);l.append(input);inspector.append(l)};
      const name=el('input');name.value=assets.length===1?assets[0].name:'';name.maxLength=180;if(assets.length===1)field('显示名称',name);
      const dest=el('select');option(dest,'__keep__','保持原文件夹');option(dest,'','未分类');catalog.folders.forEach(f=>option(dest,f,f));dest.value=assets.length===1?assets[0].folder:'__keep__';field('所属文件夹',dest);
      const tags=el('input');tags.value=assets.length===1?assets[0].tags.join('，'):'';tags.placeholder=assets.length===1?'如：街拍，示例城市':'留空保留原标签';field('标签（逗号分隔）',tags);
      const clearTags=el('input');clearTags.type='checkbox';field('清空所选素材标签',clearTags);
      inspector.append(button('保存素材信息',()=>{const data={action:'assets-update',ids:[...selected]};if(assets.length===1)data.name=name.value;if(dest.value!=='__keep__')data.folder=dest.value;if(clearTags.checked)data.tags=[];else if(tags.value.trim()||assets.length===1)data.tags=tags.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);mutate(data)},'library-save'));
      if(assets.length===1){const a=assets[0],usage=[...a.usage.published.map(v=>'已发布 · '+v.title),...a.usage.drafts.map(v=>'草稿 · '+v.title)];inspector.append(el('p','library-usage',usage.length?'用于 '+usage.length+' 处：\n'+usage.join('\n'):'尚未被作品引用'));
        if(['video','audio'].includes(a.kind)&&!a.missing){const media=el(a.kind);media.src=url(a.src);media.controls=true;media.preload='metadata';inspector.append(media)}
        const aLink=el('a','text-link','查看原文件 ↗');aLink.href=url(a.src);aLink.target='_blank';aLink.rel='noopener';inspector.append(aLink);const credit=mediaSourceLink(a.source,'text-link');if(credit)inspector.append(credit);
      }
      if(working)setWorking(true);
    }
    search.oninput=()=>{page=0;paint()};folders.onchange=()=>{folder=folders.value;page=0;paint()};type.onchange=()=>{page=0;paint()};
    fileInput.onchange=async()=>{if(working)return;const files=[...fileInput.files];if(!files.length)return;setWorking(true);try{for(const file of files){say('上传中 · '+file.name);const saved=await upload(file);await load();const asset=catalog.assets.find(a=>a.src===saved.src);if(asset){if(folder!=='*'){const r=await fetch('/api/manage/library',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':getToken(),'If-Match':catalog.revision},body:JSON.stringify({action:'assets-update',ids:[asset.id],folder})});const data=await r.json();if(!r.ok)throw Error(data.error);catalog=data}if(!multiple&&!manage)selected.clear();selected.add(asset.id)}}say('上传完成。文件已保留在素材库。');paint()}catch(e){say(e.message,true)}finally{fileInput.value='';setWorking(false)}};
    dialog.addEventListener('cancel',e=>{if(working)e.preventDefault()});dialog.addEventListener('close',()=>{dialog.querySelectorAll('audio,video').forEach(m=>m.pause());resolve([]);dialog.remove()},{once:true});
    dialog.showModal();load().catch(e=>say(e.message,true));
  })}};
}

import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {atomicJSON,EditorError,mediaReferences,collections} from './editor-store.mjs';
const extensions=/\.(?:jpe?g|png|webp|avif|mp4|webm|mp3|wav|ogg|m4a|flac|pdf)$/i;
const category=src=>/\.(?:jpe?g|png|webp|avif)$/i.test(src)?'image':/\.(?:mp4|webm)$/i.test(src)?'video':/\.pdf$/i.test(src)?'document':'audio';
const folder=value=>typeof value==='string'&&value.length<=240&&!/[\\\x00-\x1f]/.test(value)&&(!value||value.split('/').every(p=>p.trim()===p&&p.length>0&&p!=='.'&&p!=='..'));
const tags=value=>Array.isArray(value)&&value.length<=30&&value.every(t=>typeof t==='string'&&t.trim()&&t.length<=50);
export function createMediaLibrary(root,store){
  const catalog=path.join(root,'.local','media-library.json'),dir=path.join(root,'public','assets','media');
  function read(){return fs.existsSync(catalog)?JSON.parse(fs.readFileSync(catalog,'utf8')):{revision:'new',folders:[],assets:[]}}
  function save(data){data.revision=randomUUID();atomicJSON(catalog,data);return data}
  function ensureFolder(data,name){if(!name)return;const parts=name.split('/');parts.forEach((_,i)=>{const p=parts.slice(0,i+1).join('/');if(!data.folders.includes(p))data.folders.push(p)});data.folders.sort((a,b)=>a.localeCompare(b,'zh-CN'))}
  function scan(){
    const data=read();let changed=false;if(!fs.existsSync(dir))return data;
    for(const file of fs.readdirSync(dir,{withFileTypes:true})){
      if(!file.isFile()||!extensions.test(file.name)||file.name.startsWith('.'))continue;const src='./assets/media/'+file.name;if(data.assets.some(a=>a.src===src))continue;
      const stat=fs.statSync(path.join(dir,file.name));data.assets.push({id:createHash('sha256').update(src).digest('hex').slice(0,32),src,name:file.name,kind:category(src),size:stat.size,folder:'',tags:[],createdAt:stat.birthtime.toISOString()});changed=true;
    }
    return changed?save(data):data;
  }
  function register(asset){const data=scan(),item=data.assets.find(a=>a.src===asset.src);if(item){item.name=asset.name||item.name;if(asset.coverSource||asset.source)item.source=asset.source||asset.coverSource;if(tags(asset.tags))item.tags=[...new Set([...item.tags,...asset.tags])].slice(0,30);save(data)}return asset}
  function list(){
    const data=scan(),usage=new Map(data.assets.map(a=>[a.src,{published:[],drafts:[]}])) ,docs=store.readDocuments();
    const attach=(item,target)=>{for(const src of mediaReferences(item.data)){const value=usage.get(src);if(value&&!value[target].some(v=>v.section===item.section&&v.id===item.id))value[target].push({section:item.section,id:item.id,title:item.title})}};
    for(const [section,[resource,key]]of Object.entries(collections))for(const e of docs[resource][key])attach({section,id:e.id,title:e.title,data:e},'published');
    for(const [name,value]of Object.entries(docs.site))attach({section:'site',id:name,title:'网站配置 · '+name,data:value},'published');
    for(const d of store.snapshot().drafts)if(d.operation!=='remove')attach({section:d.section,id:d.id,title:d.data.title||d.id,data:d.data},'drafts');
    return {...data,assets:data.assets.map(a=>({...a,missing:!fs.existsSync(path.join(root,'public',a.src)),usage:usage.get(a.src)}))};
  }
  function update(input,revision){
    const data=scan();if(data.revision!==revision)throw new EditorError('素材库已更新，请刷新后再修改。',409);
    if(input.action==='folder-create'){
      if(!input.name||!folder(input.name))throw new EditorError('文件夹名称无效，可用 / 创建子文件夹。');ensureFolder(data,input.name);
    }else if(input.action==='folder-rename'){
      if(!data.folders.includes(input.from)||!input.to||!folder(input.to)||input.to.startsWith(input.from+'/')||data.folders.includes(input.to))throw new EditorError('请选择有效且不重复的文件夹名称。');
      const renamed=p=>p===input.from||p.startsWith(input.from+'/')?input.to+p.slice(input.from.length):p;
      data.folders=data.folders.map(renamed);data.assets.forEach(a=>a.folder=renamed(a.folder));ensureFolder(data,input.to);
    }else if(input.action==='folder-delete'){
      if(!data.folders.includes(input.name)||data.assets.some(a=>a.folder===input.name||a.folder.startsWith(input.name+'/'))||data.folders.some(f=>f.startsWith(input.name+'/')))throw new EditorError('请先移走素材和子文件夹，再删除空文件夹。');data.folders=data.folders.filter(f=>f!==input.name);
    }else if(input.action==='assets-update'){
      if(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>500||input.ids.some(id=>!data.assets.some(a=>a.id===id)))throw new EditorError('请选择有效素材。');
      if(input.folder!==undefined&&!folder(input.folder)||input.tags!==undefined&&!tags(input.tags)||input.name!==undefined&&(input.ids.length!==1||typeof input.name!=='string'||!input.name.trim()||input.name.length>180))throw new EditorError('素材名称、文件夹或标签格式不正确。');
      if(input.folder)ensureFolder(data,input.folder);for(const a of data.assets.filter(a=>input.ids.includes(a.id))){if(input.folder!==undefined)a.folder=input.folder;if(input.tags!==undefined)a.tags=[...new Set(input.tags)];if(input.name!==undefined)a.name=input.name.trim()}
    }else throw new EditorError('未找到素材库操作。');save(data);return list();
  }
  return {list,update,register};
}

import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SITE_FIELDS} from '../public/site-config.js';
import {parseBilibiliInput} from '../public/video-source.js';
import {validateDocument} from './manage-schema.mjs';

export const collections={photographs:['content','photographs'],projects:['content','projects'],videos:['content','videos'],audio:['content','audio'],games:['journal','games'],cinema:['journal','cinema'],writing:['writing','articles']};
const groups=[...new Set(Object.values(SITE_FIELDS).map(f=>f.group))];
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export const draftKey=(section,id)=>section+':'+id;
export class EditorError extends Error{constructor(message,status=400){super(message);this.status=status}}
export function atomicJSON(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file)}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}}
const safeData=(value,depth=0)=>depth<=25&&(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=200000||Array.isArray(value)&&value.length<=16000&&value.every(v=>safeData(v,depth+1))||value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=200&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&safeData(v,depth+1)));
export function mediaReferences(value,found=new Set()){
  if(typeof value==='string'&&/^\.\/assets\/media\/(?!.*\.\.)[\p{L}\p{N}_ .-]+$/u.test(value))found.add(value);
  else if(Array.isArray(value))value.forEach(v=>mediaReferences(v,found));
  else if(value&&typeof value==='object')Object.values(value).forEach(v=>mediaReferences(v,found));return found;
}
export function createEditorStore(root){
  const base=path.join(root,'.local'),draftDir=path.join(base,'drafts'),historyDir=path.join(base,'history'),transaction=path.join(base,'publish-transaction.json');
  const file=k=>path.join(root,'public',k+'.json');
  const readDocuments=()=>Object.fromEntries(['site','content','journal','writing'].map(k=>[k,JSON.parse(fs.readFileSync(file(k),'utf8'))]));
  function identity(section,id){if(!(section==='site'?groups.includes(id):Object.hasOwn(collections,section)&&typeof id==='string'&&/^[-\w]{1,100}$/.test(id)))throw new EditorError('未找到内容类型。');return draftKey(section,id)}
  const recordFile=(dir,section,id)=>path.join(dir,fingerprint(identity(section,id))+'.json');
  function getDraft(section,id){const f=recordFile(draftDir,section,id);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null}
  function published(section,id,docs=readDocuments()){
    identity(section,id);if(section==='site')return Object.fromEntries(Object.entries(SITE_FIELDS).filter(([,f])=>f.group===id).map(([k,f])=>[k,docs.site[k]??f.value]));
    const [resource,key]=collections[section];return docs[resource][key].find(e=>e.id===id)||null;
  }
  function history(section,id){const f=recordFile(historyDir,section,id);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):[]}
  function remember(section,id,data,reason,operation='upsert',position=null){
    if(data===null)return;const list=history(section,id),hash=fingerprint({data,operation,position});if(list.at(-1)?.hash===hash)return;
    list.push({id:randomUUID(),time:new Date().toISOString(),reason,hash,data,operation,position});atomicJSON(recordFile(historyDir,section,id),list.slice(-30));
  }
  function checkRevision(current,revision){if((current?.revision||'new')!==revision)throw new EditorError('另一窗口已更新这份草稿，请先保留当前文字，再刷新读取最新版本。',409)}
  function snapshot(){
    const docs=readDocuments(),drafts=fs.existsSync(draftDir)?fs.readdirSync(draftDir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(draftDir,n),'utf8'))):[];
    const publishedVersions={};for(const [section,[resource,key]]of Object.entries(collections))for(const e of docs[resource][key])publishedVersions[draftKey(section,e.id)]=fingerprint(e);
    for(const id of groups)publishedVersions[draftKey('site',id)]=fingerprint(published('site',id,docs));return {drafts,publishedVersions,missingVersion:fingerprint(null)};
  }
  function saveDraft(input,revision){
    const {section,id}=input;identity(section,id);const previous=getDraft(section,id);checkRevision(previous,revision);
    if(!input.data||typeof input.data!=='object'||Array.isArray(input.data)||!safeData(input.data)||JSON.stringify(input.data).length>3000000)throw new EditorError('草稿内容过大或格式不正确。');
    if(!['upsert','remove'].includes(input.operation||'upsert')||section==='site'&&input.operation==='remove')throw new EditorError('不支持此草稿操作。');
    if(input.position!=null&&(!Number.isInteger(input.position)||input.position<0||input.position>4000))throw new EditorError('展示顺序无效。');
    if(!previous&&typeof input.baseHash!=='string')throw new EditorError('缺少公开版本信息，请刷新后重试。',409);
    const current=published(section,id);if(!previous)remember(section,id,current,'开始编辑前的公开版本');
    const next={section,id,data:input.data,operation:input.operation||'upsert',position:input.position??null,baseHash:previous?.baseHash||input.baseHash,revision:randomUUID(),updatedAt:new Date().toISOString()};
    if(section!=='site')next.data={...next.data,id};
    const last=history(section,id).at(-1);if(input.checkpoint||!previous||!last||Date.now()-Date.parse(last.time)>60000)remember(section,id,next.data,input.checkpoint?'手动保存草稿':'自动草稿快照',next.operation,next.position);
    atomicJSON(recordFile(draftDir,section,id),next);return next;
  }
  function discard(section,id,revision){const current=getDraft(section,id);checkRevision(current,revision);if(current){remember(section,id,current.data,'丢弃前的草稿',current.operation,current.position);fs.unlinkSync(recordFile(draftDir,section,id))}return {ok:true}}
  function restore(input,revision){
    const {section,id,versionId}=input,current=getDraft(section,id);checkRevision(current,revision);const old=history(section,id).find(e=>e.id===versionId);if(!old)throw new EditorError('这个历史版本已不存在。',404);
    if(current)remember(section,id,current.data,'恢复历史前的草稿',current.operation,current.position);
    const next=saveDraft({section,id,data:structuredClone(old.data),operation:old.operation||'upsert',position:old.position,baseHash:fingerprint(published(section,id)),checkpoint:true},revision);
    next.baseHash=fingerprint(published(section,id));atomicJSON(recordFile(draftDir,section,id),next);return next;
  }
  function normalize(draft){
    const e=structuredClone(draft.data);if(draft.section!=='site')e.id=draft.id;
    if(draft.section==='videos'){
      if(e.provider==='bilibili'){if(e.bilibiliUrl){const parsed=parseBilibiliInput(e.bilibiliUrl);if(!parsed)throw new EditorError('视频链接尚未填写完整。',422);Object.assign(e,parsed)}delete e.src}else{delete e.bvid;delete e.page}delete e.bilibiliUrl;
    }
    if(draft.section==='writing'){delete e.body;e.published=true}return e;
  }
  function finishTransaction(t){
    for(const item of t.items){const current=getDraft(item.section,item.id);if(current?.revision===item.revision)fs.unlinkSync(recordFile(draftDir,item.section,item.id))}
    if(fs.existsSync(transaction))fs.unlinkSync(transaction);
  }
  if(fs.existsSync(transaction)){
    const t=JSON.parse(fs.readFileSync(transaction,'utf8'));if(t.phase==='committed')finishTransaction(t);else{for(const [k,doc]of Object.entries(t.before))if(['site','content','journal','writing'].includes(k))atomicJSON(file(k),doc);fs.unlinkSync(transaction)}
  }
  function publish(items){
    if(!Array.isArray(items)||!items.length||items.length>1000)throw new EditorError('请至少选择一份草稿。');
    const before=readDocuments(),after=structuredClone(before),selected=[],seen=new Set(),changed=new Set();
    for(const item of items){
      const key=identity(item.section,item.id);if(seen.has(key))throw new EditorError('发布列表中有重复内容。');seen.add(key);
      const d=getDraft(item.section,item.id);if(!d)throw new EditorError('草稿已变化，请刷新发布列表。',409);checkRevision(d,item.revision);
      if(d.baseHash!==fingerprint(published(d.section,d.id,before)))throw new EditorError('「'+(d.data.title||d.id)+'」的公开版本已更新，请先核对最新内容。草稿已保留。',409);
      const value=normalize(d);
      if(d.section==='site'){
        const keys=Object.entries(SITE_FIELDS).filter(([,f])=>f.group===d.id).map(([k])=>k);if(Object.keys(value).some(k=>!keys.includes(k)))throw new EditorError('板块草稿含有其他板块的字段。',422);Object.assign(after.site,value);changed.add('site');
      }else{
        const [resource,field]=collections[d.section],list=after[resource][field],at=list.findIndex(e=>e.id===d.id);if(at>=0)list.splice(at,1);
        if(d.operation!=='remove')list.splice(d.position??(at<0?list.length:at),0,value);changed.add(resource);
      }
      if(d.operation!=='remove')for(const src of mediaReferences(value)){const asset=path.join(root,'public',src),media=path.resolve(root,'public/assets/media');if(!fs.existsSync(asset)||!fs.statSync(asset).isFile()||!fs.realpathSync(asset).startsWith(fs.realpathSync(media)+path.sep))throw new EditorError('「'+(value.title||d.id)+'」引用的素材不存在，请重新选择。',422)}
      selected.push(d);
    }
    for(const k of changed)if(!validateDocument(k,after[k]))throw new EditorError('所选草稿中有未填完的名称、素材、日期或格式。请检查后再发布；其他内容尚未改变。',422);
    const t={phase:'prepared',before:Object.fromEntries([...changed].map(k=>[k,before[k]])),after:Object.fromEntries([...changed].map(k=>[k,after[k]])),items:selected.map(d=>({section:d.section,id:d.id,revision:d.revision}))};
    for(const d of selected){remember(d.section,d.id,published(d.section,d.id,before),'发布前的公开版本');remember(d.section,d.id,d.data,d.operation==='remove'?'发布移除':'已发布版本',d.operation,d.position)}
    atomicJSON(transaction,t);
    try{for(const k of changed)atomicJSON(file(k),after[k]);t.phase='committed';atomicJSON(transaction,t)}catch(e){for(const k of changed)atomicJSON(file(k),before[k]);if(fs.existsSync(transaction))fs.unlinkSync(transaction);throw e}
    finishTransaction(t);return {documents:after,editor:snapshot(),count:selected.length};
  }
  return {snapshot,getDraft,saveDraft,discard,history,restore,publish,published,readDocuments};
}

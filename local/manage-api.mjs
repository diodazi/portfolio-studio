import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {localRequest,validMutation} from './access.mjs';
import {validateDocument} from './manage-schema.mjs';
import {createCoverService} from './cover-service.mjs';
import {createGameMediaService} from './game-media-service.mjs';
import {CoverError} from './cover-remote.mjs';
import {createEditorStore,EditorError} from './editor-store.mjs';
import {createMediaLibrary} from './media-library.mjs';
import {preparePhotoPreviews} from './photo-previews.mjs';

const tag = bytes => '"'+createHash('sha256').update(bytes).digest('hex')+'"';
const resources = ['site','content','journal','writing'];
const maxJSON = 4*1024*1024;
const maxUpload = 100*1024*1024;
export const uploadTypes = {
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif',
  '.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.flac':'audio/flac','.pdf':'application/pdf'
};
export function validSignature(ext,b) {
  const s=(a,z)=>b.toString('ascii',a,z);
  if(ext==='.jpg'||ext==='.jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
  if(ext==='.png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(ext==='.webp')return s(0,4)==='RIFF'&&s(8,12)==='WEBP';
  if(ext==='.avif')return s(4,8)==='ftyp'&&/avif|avis/.test(s(8,64));
  if(ext==='.mp4'||ext==='.m4a')return s(4,8)==='ftyp';
  if(ext==='.webm')return b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
  if(ext==='.mp3')return s(0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224);
  if(ext==='.wav')return s(0,4)==='RIFF'&&s(8,12)==='WAVE';
  if(ext==='.ogg')return s(0,4)==='OggS';
  if(ext==='.flac')return s(0,4)==='fLaC';
  if(ext==='.pdf')return s(0,5)==='%PDF-';
  return false;
}
export function createManagement(root,options={}) {
  const token=randomBytes(32).toString('hex');
  const covers=createCoverService(root,options.covers);
  const gameMedia=createGameMediaService(root,options.gameMedia);
  const editor=createEditorStore(root),library=createMediaLibrary(root,editor);
  const local=path.join(root,'.local'), uploadDir=path.join(local,'uploads'), backupDir=path.join(local,'backups');
  const file=k=>path.join(root,'public',k+'.json');
  const send=(res,code,data,headers={})=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))};
  function save(k,next) {
    const previous=fs.readFileSync(file(k));
    fs.mkdirSync(backupDir,{recursive:true});
    fs.writeFileSync(path.join(backupDir,k+'.previous.json'),previous);
    const tmp=file(k)+'.'+randomUUID()+'.tmp';
    try{fs.writeFileSync(tmp,next);fs.renameSync(tmp,file(k))}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  }
  return async function manage(req,res,url,port) {
    if(!localRequest(req,port))return send(res,403,{error:'此管理界面仅允许本机直接访问。'});
    const k=url.pathname.split('/')[3];
    try {
      if(req.method==='GET'&&k==='bootstrap') {
        const documents={},versions={},undo={};
        for(const kind of resources){const b=fs.readFileSync(file(kind));documents[kind]=JSON.parse(b);versions[kind]=tag(b);undo[kind]=fs.existsSync(path.join(backupDir,kind+'.previous.json'))}
        return send(res,200,{token,documents,versions,undo,editor:editor.snapshot()});
      }
      if(req.method==='GET'&&k==='library')return send(res,200,library.list());
      if(req.method==='GET'&&k==='history')return send(res,200,{versions:editor.history(url.searchParams.get('section'),url.searchParams.get('id'))});
      if(req.method==='GET'&&k==='drafts')return send(res,200,editor.snapshot());
      if(req.method==='GET'&&/^\/api\/manage\/game-media\/preview\/[-\w]+$/.test(url.pathname)){
        const image=await gameMedia.preview(url.pathname.split('/').at(-1));
        res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);
      }
      if(req.method==='GET'&&/^\/api\/manage\/covers\/preview\/[-\w]+$/.test(url.pathname)){
        const image=await covers.preview(url.pathname.split('/').at(-1));
        res.writeHead(200,{'Content-Type':image.type,'Content-Length':image.bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);
      }
      if(!['PUT','POST'].includes(req.method))return send(res,405,{error:'不支持此操作。'},{Allow:'GET, PUT, POST'});
      if(!validMutation(req,token))return send(res,403,{error:'保存验证已失效，请刷新管理台。'});
      if(['drafts','publish','history','library'].includes(k)){
        if(req.headers['content-type']!=='application/json')return send(res,415,{error:'内容格式不正确。'});
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxJSON)return send(res,413,{error:'草稿内容过大。'});chunks.push(chunk)}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(res,400,{error:'无法读取内容。'})}
        if(!input||typeof input!=='object'||Array.isArray(input))return send(res,400,{error:'内容格式不正确。'});
        if(k==='drafts'&&req.method==='PUT'&&url.pathname==='/api/manage/drafts')return send(res,200,{draft:editor.saveDraft(input,req.headers['if-match'])});
        if(k==='drafts'&&req.method==='POST'&&url.pathname==='/api/manage/drafts/discard')return send(res,200,editor.discard(input.section,input.id,req.headers['if-match']));
        if(k==='publish'&&req.method==='POST'){
          const result=editor.publish(input.items);
          if(input.items.some(item=>item.section==='photographs'))void preparePhotoPreviews(root).catch(error=>console.warn('Photography previews:',error.message));
          return send(res,200,result);
        }
        if(k==='history'&&req.method==='POST'&&url.pathname==='/api/manage/history/restore')return send(res,200,{draft:editor.restore(input,req.headers['if-match'])});
        if(k==='library'&&req.method==='POST')return send(res,200,library.update(input,req.headers['if-match']));
        return send(res,405,{error:'不支持此操作。'});
      }
      if(['covers','game-media'].includes(k)&&req.method==='POST'){
        if(![`/api/manage/${k}/search`,`/api/manage/${k}/import`].includes(url.pathname))return send(res,404,{error:'未找到素材操作。'});
        if(req.headers['content-type']!=='application/json')return send(res,415,{error:'请使用名称查询或选择搜索结果。'});
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)return send(res,413,{error:'查询内容过长。'});chunks.push(chunk)}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(res,400,{error:'无法读取查询内容。'})}
        if(!input||typeof input!=='object'||Array.isArray(input))return send(res,400,{error:'查询内容格式不正确。'});
        const importing=url.pathname.endsWith('/import');
        if(k==='game-media'){
          const result=await (importing?gameMedia.importImage(input):gameMedia.search(input));if(importing)library.register(result);return send(res,importing?201:200,result);
        }
        const result=await (importing?covers.importCover(input):covers.search(input));if(importing)library.register({...result,name:result.coverSource.title});return send(res,importing?201:200,result);
      }
      if(k==='upload'&&req.method==='POST') {
        const name=url.searchParams.get('name')||'',ext=path.extname(name).toLowerCase();
        if(!name||/[\\/\x00]/.test(name)||!uploadTypes[ext]||req.headers['content-type']!=='application/octet-stream')return send(res,415,{error:'请选择支持的图片、音视频或 PDF 文件。'});
        if(Number(req.headers['content-length'])>maxUpload)return send(res,413,{error:'单个文件不能超过 100 MB。'});
        await fsp.mkdir(uploadDir,{recursive:true});
        const temp=path.join(uploadDir,randomUUID()+'.part');let handle,size=0,head=Buffer.alloc(0);
        try {
          handle=await fsp.open(temp,'wx');
          for await(const chunk of req){size+=chunk.length;if(size>maxUpload){return send(res,413,{error:'单个文件不能超过 100 MB。'})}if(head.length<64)head=Buffer.concat([head,chunk.subarray(0,64-head.length)]);await handle.writeFile(chunk)}
          await handle.close();handle=null;
          if(!size||!validSignature(ext,head))return send(res,415,{error:'文件内容与格式不匹配，请重新选择原始文件。'});
          const filename=randomUUID()+ext,dir=path.join(root,'public','assets','media');await fsp.mkdir(dir,{recursive:true});await fsp.rename(temp,path.join(dir,filename));
          return send(res,201,library.register({src:'./assets/media/'+filename,name,size,type:uploadTypes[ext]}));
        }finally{await handle?.close();await fsp.rm(temp,{force:true})}
      }
      if(!resources.includes(k))return send(res,404,{error:'未找到内容类型。'});
      if(req.headers['content-type']!=='application/json')return send(res,415,{error:'内容格式不正确。'});
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>maxJSON)return send(res,413,{error:'文字内容过大。'});chunks.push(chunk)}
      let doc;try{doc=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(res,400,{error:'无法读取提交内容。'})}
      if(req.headers['if-match']!==tag(fs.readFileSync(file(k))))return send(res,409,{error:'另一窗口已更新内容。请先复制未保存的文字，再刷新管理台。'});
      if(req.method==='POST') {
        if(url.pathname!==`/api/manage/${k}/restore`)return send(res,404,{error:'未找到操作。'});
        const backup=path.join(backupDir,k+'.previous.json');if(!fs.existsSync(backup))return send(res,404,{error:'暂无上一版内容。'});doc=JSON.parse(fs.readFileSync(backup));
      }
      if(!validateDocument(k,doc))return send(res,422,{error:'内容格式有误，请检查名称、文件、日期及必填项目。'});
      const next=Buffer.from(JSON.stringify(doc,null,2)+'\n');if(next.length>maxJSON)return send(res,413,{error:'文字内容过大。'});
      save(k,next);return send(res,200,{document:doc,version:tag(next)});
    }catch(error){if(error instanceof CoverError||error instanceof EditorError)return send(res,error.status,{error:error.message});console.error('Local content operation failed:',error.code||error.name);return send(res,500,{error:'未能保存，请检查磁盘空间后重试。'})}
  };
}

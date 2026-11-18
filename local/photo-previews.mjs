import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const jobs=new Map();
export function preparePhotoPreviews(root){
  const task=(jobs.get(root)||Promise.resolve()).catch(()=>{}).then(()=>prepare(root));
  jobs.set(root,task);return task.finally(()=>{if(jobs.get(root)===task)jobs.delete(root)});
}
async function prepare(root){
  const publicRoot=path.resolve(root,'public'),dir=path.join(publicRoot,'assets/photo-previews');
  const catalog=JSON.parse(await fs.readFile(path.join(publicRoot,'content.json'),'utf8'));
  await fs.mkdir(dir,{recursive:true});
  const old=JSON.parse(await fs.readFile(path.join(publicRoot,'photography-index.json'),'utf8').catch(()=>'{}'));
  const photos={},used=new Set();
  for(const entry of catalog.photographs||[]){
    if(entry.published===false||!/^\.\/assets\/media\/(?!.*\.\.)[^?#\\]+\.(?:jpe?g|png|webp|avif)$/iu.test(entry.src||''))continue;
    try{
      const source=path.resolve(publicRoot,entry.src),real=await fs.realpath(source);
      if(!real.startsWith(await fs.realpath(publicRoot)+path.sep))continue;
      const stat=await fs.stat(source),key=createHash('sha256').update(entry.src+':'+stat.size+':'+stat.mtimeMs+':v1').digest('hex').slice(0,24);
      const small=key+'-640.webp',large=key+'-1600.webp';let record=old.photos?.[entry.src];
      if(record?.key!==key||!await fs.stat(path.join(dir,small)).catch(()=>null)||!await fs.stat(path.join(dir,large)).catch(()=>null)){
        const metadata=await sharp(source).metadata(),swapped=[5,6,7,8].includes(metadata.orientation);
        const width=swapped?metadata.height:metadata.width,height=swapped?metadata.width:metadata.height;
        const pipeline=sharp(source).rotate();
        await pipeline.clone().resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(path.join(dir,small));
        await pipeline.clone().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:87}).toFile(path.join(dir,large));
        record={key,width,height,small:'./assets/photo-previews/'+small,large:'./assets/photo-previews/'+large};
      }
      photos[entry.src]=record;used.add(small);used.add(large);
    }catch(error){console.warn('Photo preview unavailable:',entry.id,error.message)}
  }
  const index={version:1,photos},file=path.join(publicRoot,'photography-index.json');
  await fs.writeFile(file+'.tmp',JSON.stringify(index,null,2)+'\n');await fs.rename(file+'.tmp',file);
  // Only this module's generated thumbnails are eligible for cleanup; originals stay intact.
  for(const file of await fs.readdir(dir))if(/^[a-f0-9]{24}-(640|1600)\.webp$/.test(file)&&!used.has(file))await fs.unlink(path.join(dir,file));
  return index;
}

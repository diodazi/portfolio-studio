import {cp,mkdir,readdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mediaReferences} from '../local/editor-store.mjs';
import {preparePhotoPreviews} from '../local/photo-previews.mjs';
import {setup} from './setup.mjs';
const privateName=n=>/(?:^|-)editor\.(?:html|js|css)$/.test(n)||n.startsWith('.')||n.endsWith('.tmp')||n.endsWith('.example.json')||['manage','api','local'].includes(n);
export async function build(root){
  await setup(root);
  const photoIndex=await preparePhotoPreviews(root);
  const source=path.join(root,'public'),dest=path.join(root,'dist');await mkdir(dest,{recursive:true});
  const documents=await Promise.all(['site','content','journal','writing'].map(async k=>[k,JSON.parse(await readFile(path.join(source,k+'.json'),'utf8'))]));
  const writing=documents.find(([k])=>k==='writing')[1];writing.articles=writing.articles.filter(e=>e.published!==false);
  const used=mediaReferences(documents.map(([,doc])=>doc));
  const mediaRoot=path.join(source,'assets','media');
  // Remove stale private files left by older builds before copying the current public site.
  async function clean(dir,privateParent=false){for(const e of await readdir(dir,{withFileTypes:true})){const full=path.resolve(dir,e.name);if(!full.startsWith(path.resolve(dest)+path.sep))throw Error('Invalid build path');const hidden=privateParent||privateName(e.name);if(e.isSymbolicLink())await unlink(full);else if(e.isDirectory())await clean(full,hidden);else if(hidden)await unlink(full)}}
  await clean(dest);
  await cp(source,dest,{recursive:true,filter:p=>!privateName(path.basename(p))&&(!p.startsWith(mediaRoot+path.sep)||used.has('./assets/media/'+path.relative(mediaRoot,p).replaceAll(path.sep,'/')))});
  const distMedia=path.join(dest,'assets','media');
  for(const entry of await readdir(distMedia,{withFileTypes:true}).catch(()=>[]))if(entry.isFile()&&!used.has('./assets/media/'+entry.name))await unlink(path.join(distMedia,entry.name));
  const photoUsed=new Set(Object.values(photoIndex.photos).flatMap(p=>[path.basename(p.small),path.basename(p.large)])),distPreviews=path.join(dest,'assets/photo-previews');
  for(const entry of await readdir(distPreviews,{withFileTypes:true}).catch(()=>[]))if(entry.isFile()&&/^[a-f0-9]{24}-(640|1600)\.webp$/.test(entry.name)&&!photoUsed.has(entry.name))await unlink(path.join(distPreviews,entry.name));
  await writeFile(path.join(dest,'writing.json'),JSON.stringify(writing,null,2)+'\n');
  for(const f of ['index.html','app.js','storage.js','content.json']){const text=await readFile(path.join(dest,f),'utf8');if(/accessKeySecret|SUPABASE_ANON_KEY|LTAI[a-zA-Z0-9]{10}/.test(text))throw new Error('Unexpected legacy credential in public output')}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await build(path.dirname(path.dirname(fileURLToPath(import.meta.url))));console.log('Build complete: dist/ (read-only public site; manager, write APIs and drafts excluded).')}

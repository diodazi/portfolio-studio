import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createManagement,uploadTypes} from './manage-api.mjs';
import {localRequest} from './access.mjs';

const uiDir=path.join(path.dirname(fileURLToPath(import.meta.url)),'ui');
const mime={...uploadTypes,'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
const privateRoute=p=>/^\/(?:manage(?:\/|$)|api(?:\/|$)|(?:[\w-]*editor)\.(?:html|js|css)$)/i.test(p);

export function createPortfolioServer({root,publicOnly=false,managementOptions={}}) {
  const siteRoot=path.join(root,publicOnly?'dist':'public');
  const manage=publicOnly?null:createManagement(root,managementOptions);
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
    let url,p;try{url=new URL(req.url,'http://localhost');p=decodeURIComponent(url.pathname)}catch{res.writeHead(400).end();return}
    const port=req.socket.localPort;
    if(p.includes('\\')||p.includes('\0')||p.split('/').some(x=>x.startsWith('.'))){res.writeHead(404).end();return}
    if(privateRoute(p)){
      if(publicOnly){res.writeHead(404).end();return}
      if(!localRequest(req,port)){res.writeHead(403).end('Local access only');return}
      if(p.startsWith('/api/manage/'))return manage(req,res,url,port);
      if(p.startsWith('/api/')){res.writeHead(404).end();return}
      if(/^\/[\w-]*editor\.(html|js|css)$/.test(p)){res.writeHead(302,{Location:'/manage/','Cache-Control':'no-store'}).end();return}
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
    const isAdmin=p==='/manage'||p.startsWith('/manage/');
    let base=isAdmin?uiDir:siteRoot;
    let relative=isAdmin?p.replace(/^\/manage\/?/,''):p.slice(1);
    if(!relative||relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(base,relative);
    if(!file.startsWith(path.resolve(base)+path.sep)){res.writeHead(404).end();return}
    try{
      const stat=await fs.promises.stat(file);
      if(!stat.isFile()){res.writeHead(404).end();return}
      // Reject symlinks that escape the public or management directory.
      const real=await fs.promises.realpath(file),realBase=await fs.promises.realpath(base);
      if(!real.startsWith(realBase+path.sep)){res.writeHead(404).end();return}
      if(isAdmin)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      const headers={'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':isAdmin?'no-store':'no-cache','Accept-Ranges':'bytes'};
      let transformed;
      if(file===path.join(siteRoot,'writing.json')){const doc=JSON.parse(await fs.promises.readFile(file,'utf8'));doc.articles=doc.articles.filter(e=>e.published!==false);transformed=Buffer.from(JSON.stringify(doc))}
      if(file===path.join(siteRoot,'index.html')&&url.searchParams.get('edit')==='1'&&!publicOnly){
        if(!localRequest(req,port)){res.writeHead(403).end();return}
        transformed=Buffer.from((await fs.promises.readFile(file,'utf8')).replace('</body>','<link rel="stylesheet" href="/manage/overlay.css"><script type="module" src="/manage/overlay.js"></script></body>'));
        headers['Cache-Control']='no-store';
      }
      if(transformed){res.writeHead(200,{...headers,'Content-Length':transformed.length});res.end(req.method==='HEAD'?undefined:transformed);return}
      let start=0,end=stat.size-1,status=200;
      if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return}
        if(m[1]){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end}else start=Math.max(0,stat.size-Number(m[2]));
        if(start>end||start<0||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
      if(req.method==='HEAD'||!stat.size)res.end();else fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
    }catch{if(!res.headersSent)res.writeHead(404);res.end('页面不存在')}
  });
}

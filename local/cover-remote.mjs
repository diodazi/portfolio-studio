import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import {execFileSync} from 'node:child_process';

export class CoverError extends Error {
  constructor(message,status=502){super(message);this.status=status}
}
const steamHosts=new Set(['shared.akamai.steamstatic.com','shared.fastly.steamstatic.com','cdn.akamai.steamstatic.com','cdn.cloudflare.steamstatic.com','cdn.fastly.steamstatic.com','steamcdn-a.akamaihd.net']);
export function allowedRemote(value,provider,image=false){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.href.length>2500)return false;
    if(image){
      if(provider==='steam')return steamHosts.has(u.hostname)&&/^\/(?:store_item_assets\/)?steam\/apps\//.test(u.pathname);
      if(provider==='bangumi')return u.hostname==='lain.bgm.tv'&&/^\/(?:r\/\d+\/)?pic\/cover\//.test(u.pathname);
      if(provider==='douban')return /^img\d*\.doubanio\.com$/.test(u.hostname)&&/^\/view\/photo\//.test(u.pathname);
      if(provider==='imdb')return u.hostname==='m.media-amazon.com'&&u.pathname.startsWith('/images/');
    }else{
      if(provider==='steam')return u.hostname==='store.steampowered.com'&&['/api/storesearch/','/api/appdetails'].includes(u.pathname);
      if(provider==='bangumi')return u.hostname==='api.bgm.tv'&&u.pathname==='/v0/search/subjects';
      if(provider==='douban')return u.hostname==='movie.douban.com'&&u.pathname==='/j/subject_suggest';
      if(provider==='imdb')return u.hostname==='v3.sg.media-imdb.com'&&u.pathname.startsWith('/suggestion/')&&u.pathname.endsWith('.json');
    }
  }catch{}
  return false;
}
const blocked=new net.BlockList();
for(const [ip,bits]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(ip,bits);
blocked.addSubnet('2001:db8::',32,'ipv6');
blocked.addSubnet('2002::',16,'ipv6');blocked.addSubnet('2001::',32,'ipv6');
export function publicAddress(address){
  const family=net.isIP(address);
  return family===4?!blocked.check(address):family===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!blocked.check(address,'ipv6');
}
// Resolve and validate the actual connection destination, including after redirects.
function publicLookup(host,options,callback){
  dns.lookup(host,{all:true},(error,addresses)=>{
    if(error)return callback(error);
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return callback(new CoverError('来源地址不可用。'));
    const sorted=addresses.sort((a,b)=>a.family-b.family);
    if(options?.all)callback(null,sorted);else callback(null,sorted[0].address,sorted[0].family);
  });
}
// Include OS-trusted roots without turning off certificate verification.
const ca=tls.getCACertificates?[...tls.getCACertificates('default'),...tls.getCACertificates('system')]:undefined;
function configuredProxy(){
  const env=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;
  if(env)return env;
  if(process.platform!=='win32')return '';
  try{
    const settings=execFileSync('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],{encoding:'utf8',windowsHide:true,timeout:2000,stdio:['ignore','pipe','ignore']});
    if(!/ProxyEnable\s+REG_DWORD\s+0x1\b/.test(settings))return '';
    const raw=/ProxyServer\s+REG_SZ\s+([^\r\n]+)/.exec(settings)?.[1].trim();
    if(!raw)return '';
    const server=raw.includes('=')?/(?:^|;)https=([^;]+)/i.exec(raw)?.[1]:raw;
    return server?(server.includes('://')?server:'http://'+server):'';
  }catch{return ''}
}
// A proxy is trusted local configuration, never supplied by a search or API caller.
// It resolves destination names itself; direct connections use publicLookup below.
const proxy=configuredProxy();
const proxyAgent=proxy?new https.Agent({proxyEnv:{HTTPS_PROXY:proxy},ca,keepAlive:true,maxSockets:12}):null;
export async function readRemote(value,{provider,image=false,body,limit=image?8*1024*1024:2*1024*1024,signal,policy=allowedRemote}={}){
  const deadline=AbortSignal.timeout(18000);
  const combined=signal?AbortSignal.any([deadline,signal]):deadline;
  async function request(url,hops=0){
    if(!policy(url,provider,image))throw new CoverError('来源返回了不支持的图片地址。');
    return new Promise((resolve,reject)=>{
      const bytes=body?Buffer.from(JSON.stringify(body)):null;
      const req=https.request(url,{method:bytes?'POST':'GET',agent:proxyAgent||false,...(!proxyAgent?{lookup:publicLookup}:{}),ca,signal:combined,headers:{
        'User-Agent':'PortfolioPortfolio/1.0 (https://example.com/)',
        Accept:image?'image/jpeg,image/png,image/webp,image/avif':'application/json',
        ...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length}:{})
      }},res=>{
        if([301,302,303,307,308].includes(res.statusCode)){
          const location=res.headers.location;res.destroy();
          if(!location||hops>=3)return reject(new CoverError('来源重定向过多，请更换来源。'));
          let next;try{next=new URL(location,url).href}catch{return reject(new CoverError('来源重定向无效。'))}
          request(next,hops+1).then(resolve,reject);return;
        }
        if(res.statusCode!==200){res.destroy();return reject(new CoverError([401,403,418,429].includes(res.statusCode)?'来源暂时限制访问，请稍后重试或更换来源。':`来源暂时不可用（${res.statusCode}），请更换来源。`))}
        if(Number(res.headers['content-length'])>limit){res.destroy();return reject(new CoverError('封面或搜索结果过大，请选择另一张。',413))}
        const chunks=[];let size=0;
        res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy(new CoverError('封面或搜索结果过大，请选择另一张。',413));return}chunks.push(chunk)});
        res.on('error',e=>reject(e instanceof CoverError?e:new CoverError('封面下载中断，请重试或更换来源。')));res.on('end',()=>resolve({bytes:Buffer.concat(chunks),type:String(res.headers['content-type']||'').split(';')[0],url}));
      });
      req.on('error',e=>reject(e instanceof CoverError?e:new CoverError(e.name==='AbortError'?'来源响应超时，请重试或更换来源。':'无法连接来源，请检查网络或更换来源。')));
      req.end(bytes);
    });
  }
  return request(value);
}

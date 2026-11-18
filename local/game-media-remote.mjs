import {allowedRemote,readRemote} from './cover-remote.mjs';
export const MEDIA_SOURCES={
 heybox:{name:'小黑盒',pages:h=>h==='xiaoheihe.cn'||h.endsWith('.xiaoheihe.cn'),images:h=>['imgheybox.max-c.com','cdn.max-c.com','media.max-c.com'].includes(h)},
 bilibili:{name:'哔哩哔哩',pages:h=>h==='www.bilibili.com'||h==='bilibili.com',images:h=>/^i[0-9]+\.hdslb\.com$/.test(h)},
 steamcommunity:{name:'Steam 社区',pages:h=>h==='steamcommunity.com',images:h=>['steamuserimages-a.akamaihd.net','images.steamusercontent.com'].includes(h)},
 gamersky:{name:'游民星空',pages:h=>h==='gamersky.com'||h.endsWith('.gamersky.com'),images:h=>/^img[0-9]*\.gamersky\.com$/.test(h)},
 game18183:{name:'18183',pages:h=>h==='18183.com'||h.endsWith('.18183.com'),images:h=>h==='img.18183.com'},
 game52:{name:'52 单机',pages:h=>h==='52danji.com'||h.endsWith('.52danji.com'),images:h=>h==='img.52danji.com'},
 game3dm:{name:'3DM',pages:h=>h==='3dmgame.com'||h.endsWith('.3dmgame.com'),images:h=>h==='img.3dmgame.com'},
 xiaomi:{name:'小米游戏中心',pages:h=>h==='game.xiaomi.com',images:h=>h==='pic.kts.g.mi.com'},
 zhihu:{name:'知乎',pages:h=>h==='www.zhihu.com'||h==='zhuanlan.zhihu.com',images:h=>/^pic[\w-]*\.zhimg\.com$/.test(h)},
 sohu:{name:'搜狐游戏文章',pages:h=>h==='www.sohu.com',images:h=>/^p[0-9]+\.itc\.cn$/.test(h)},
 steamgriddb:{name:'SteamGridDB',pages:h=>h==='www.steamgriddb.com'||h==='steamgriddb.com',images:h=>/^cdn[0-9]*\.steamgriddb\.com$/.test(h)}
};
export function secureMediaURL(value){try{const u=new URL(value);if(u.protocol==='http:')u.protocol='https:';if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.href.length>2500)return null;return u}catch{return null}}
export function mediaSourceFor(page){const u=secureMediaURL(page);return u&&Object.keys(MEDIA_SOURCES).find(k=>MEDIA_SOURCES[k].pages(u.hostname))}
export function allowedGameMediaRemote(value,provider,image=false){const u=secureMediaURL(value);if(!u||!String(value).startsWith('https:'))return false;
 if(provider==='index')return !image&&(['www.bing.com','cn.bing.com'].includes(u.hostname)&&['/images/search','/images/async'].includes(u.pathname)||u.hostname==='image.so.com'&&u.pathname==='/j');
 if(provider==='steam')return allowedRemote(value,'steam',image);
 if(provider==='bilibili-stats')return !image&&u.hostname==='api.bilibili.com'&&u.pathname==='/x/polymer/web-dynamic/v1/detail'&&/^\d+$/.test(u.searchParams.get('id')||'');
 if(!image&&Object.hasOwn(MEDIA_SOURCES,provider))return MEDIA_SOURCES[provider].pages(u.hostname);
 if(!image||!Object.hasOwn(MEDIA_SOURCES,provider)||!MEDIA_SOURCES[provider].images(u.hostname))return false;
 return provider!=='steamgriddb'||/^\/logo\/[\w.-]+\.png$/i.test(u.pathname);
}
export const readGameMedia=(value,options={})=>readRemote(value,{...options,policy:allowedGameMediaRemote});

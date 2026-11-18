// Provenance travels with the image so copies and published pages keep their source.
export function validMediaSource(source){
 if(!source||!['meme','logo'].includes(source.kind)||typeof source.name!=='string'||!source.name||source.name.length>80||typeof source.title!=='string'||source.title.length>240||typeof source.url!=='string'||source.url.length>2500)return false;
 try{const u=new URL(source.url);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')}catch{return false}
}
export function imageProvenance(asset){return validMediaSource(asset?.source)?{source:structuredClone(asset.source)}:{}}
export function mediaSourceLink(source,className=''){
 if(!validMediaSource(source))return null;const a=document.createElement('a');a.className=className;a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='出处 · '+source.name+' ↗';a.title=source.title;return a;
}

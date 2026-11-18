export const PAPER_EFFECTS={
 fine:{name:'细纹纸',group:'纸感',color:'#f1f2eb',description:'细密纤维，轻盈而安静'},
 cotton:{name:'棉纸',group:'纸感',color:'#eeeede',description:'柔软纤维与不均匀的纸浆'},
 linen:{name:'布纹纸',group:'纸感',color:'#e9eddf',description:'交织的经纬，细微压纹'},
 recycled:{name:'再生纸',group:'纸感',color:'#e2e5d8',description:'散落的纤维与纸浆斑点'},
 kraft:{name:'牛皮纸',group:'纸感',color:'#dbcfb3',description:'温和原色，粗粝纤维'},
 aged:{name:'旧书纸',group:'纸感',color:'#e6dfca',description:'温润纸页，边缘微微泛旧'},
 grain:{name:'颗粒印刷',group:'设计',color:'#dfe5da',description:'柔和颗粒与双色印刷层次'},
 grid:{name:'方格纸',group:'设计',color:'#edf0e6',description:'疏密相间的理性格线'},
 dots:{name:'点阵纸',group:'设计',color:'#e9eee2',description:'松弛有序的微小圆点'},
 ruled:{name:'横线手记',group:'设计',color:'#f0eee3',description:'横向细线，留出旁注边界'},
 letterpress:{name:'凸版压印',group:'设计',color:'#e8eadd',description:'错位墨迹与低调压印'},
 collage:{name:'撕纸拼贴',group:'设计',color:'#e4e8db',description:'半透明纸片与不规则剪贴边缘'}
};
export function createPaperEffect(preset='fine'){const p=PAPER_EFFECTS[preset];if(!p)throw Error('未知纸张');return {version:1,preset,color:p.color,intensity:45}}
export function validPaperEffect(v){return v===undefined||!!(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>['version','preset','color','intensity'].includes(k))&&v.version===1&&Object.hasOwn(PAPER_EFFECTS,v.preset)&&/^#[0-9a-f]{6}$/i.test(v.color)&&Number.isFinite(v.intensity)&&v.intensity>=0&&v.intensity<=100)}
const textures=new Map();
export function paperTexture(preset,width=1000){
 if(!Object.hasOwn(PAPER_EFFECTS,preset))return '';width=width===2000?2000:1000;const key=preset+width;if(textures.has(key))return textures.get(key);
 let seed=407;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296},paths=[];let defs='',content='';
 const fibers=(count,long=false)=>{for(let i=0;i<count;i++){const x=rnd()*width,y=rnd()*1414,dx=(rnd()-.5)*(long?56:12),dy=(rnd()-.5)*(long?8:12);paths.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${dx.toFixed(1)} ${dy.toFixed(1)}" stroke="${i%3?'#52604a':'#fff'}" stroke-opacity="${(.12+rnd()*.22).toFixed(2)}" stroke-width="${(.5+rnd()).toFixed(1)}"/>`)}};
 const noise=(freq,opacity=.35)=>{defs+=`<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="14" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`;content+=`<rect width="100%" height="100%" filter="url(#n)" opacity="${opacity}"/>`};
 if(['fine','cotton','kraft','grain','aged'].includes(preset))noise(preset==='cotton'?'.035 .18':preset==='kraft'?'.12 .65':'.65',preset==='grain'?.65:.3);
 if(['fine','cotton','recycled','kraft'].includes(preset))fibers(preset==='fine'?1800:preset==='recycled'?1000:700,preset!=='fine');
 if(preset==='recycled')for(let i=0;i<600;i++)paths.push(`<ellipse cx="${rnd()*width}" cy="${rnd()*1414}" rx="${.5+rnd()*2}" ry="${.3+rnd()}" fill="#536148" opacity="${.08+rnd()*.18}"/>`);
 if(preset==='linen'){defs+='<pattern id="p" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 .5H7M.5 0V7" stroke="#516247" stroke-opacity=".18" stroke-width=".8"/><path d="M0 2H7M2 0V7" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/></pattern>';content+='<rect width="100%" height="100%" fill="url(#p)"/>'}
 if(preset==='aged'){defs+='<radialGradient id="a"><stop offset="55%" stop-color="#a18b4f" stop-opacity="0"/><stop offset="100%" stop-color="#88794e" stop-opacity=".38"/></radialGradient>';content+='<rect width="100%" height="100%" fill="url(#a)"/>';fibers(550)}
 if(preset==='grid'){defs+='<pattern id="p" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M0 0H160V160H0Z" fill="none" stroke="#5c7251" stroke-opacity=".42"/><path d="M40 0V160M80 0V160M120 0V160M0 40H160M0 80H160M0 120H160" stroke="#5c7251" stroke-opacity=".19"/></pattern>';content+='<rect width="100%" height="100%" fill="url(#p)"/>'}
 if(preset==='dots'){defs+='<pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.6" fill="#56694c" opacity=".55"/></pattern>';content+='<rect width="100%" height="100%" fill="url(#p)"/>'}
 if(preset==='ruled'){defs+='<pattern id="p" width="100" height="48" patternUnits="userSpaceOnUse"><path d="M0 47.5H100" stroke="#617556" stroke-opacity=".4"/></pattern>';content+='<rect width="100%" height="100%" fill="url(#p)"/><path d="M94 0V1414" stroke="#a67b64" opacity=".45"/>'}
 if(preset==='letterpress'){noise('.25 .8',.4);content+=`<path d="M48 88H${width-80}V1318H48Z" fill="none" stroke="#66795b" stroke-opacity=".24" stroke-width="2"/><path d="M51 91H${width-77}V1321H51Z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>`;fibers(300)}
 if(preset==='collage'){noise('.5',.25);content+=`<path d="M0 0H${width*.37}L${width*.32} 170 ${width*.35} 355 ${width*.31} 580 ${width*.34} 820 ${width*.3} 1100 ${width*.33} 1414H0Z" fill="#fff" opacity=".35"/><path d="M${width*.66} 0H${width}V1414H${width*.63}L${width*.68} 1120 ${width*.64} 900 ${width*.69} 650 ${width*.65} 360Z" fill="#68795b" opacity=".09"/><path d="M0 1120L${width} 1000V1414H0Z" fill="#fff" opacity=".24"/>`}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1414" viewBox="0 0 ${width} 1414"><defs>${defs}</defs>${content}${paths.join('')}</svg>`;
 // Blob images respect the editor's existing CSP; the finite cache is released
 // with the document. Node-side validation does not allocate browser resources.
 const src=typeof document==='undefined'?'data:image/svg+xml,'+encodeURIComponent(svg):URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),url='url("'+src+'")';textures.set(key,url);return url;
}
export function applyPaperEffect(root,sheet,page){
 const effect=page.paperEffect;if(!effect||!validPaperEffect(effect))return;root.style.backgroundColor=effect.color;root.dataset.paperEffect=effect.preset;
 const layer=document.createElement('div');layer.className='gb-paper-texture';layer.setAttribute('aria-hidden','true');layer.style.backgroundImage=paperTexture(effect.preset,page.span===2?2000:1000);layer.style.opacity=String(effect.intensity/100);sheet.prepend(layer);
}

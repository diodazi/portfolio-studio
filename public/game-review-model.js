import {validateMagazine,magazineFor,imagePath} from './magazine.js';
import {validPaperEffect} from './paper-effects.js';
import {validMediaSource} from './media-source.js';
import {validRuns,textRuns,plainRuns} from './editorial-model.js';
export const BOOK_WIDTH=1000,BOOK_HEIGHT=1414,BOOK_MAX_PAGES=160;
export const BOOK_PAPERS={paper:'#f2f3ed',sage:'#dce2d6',ink:'#262d29'};
export const BOOK_LAYOUTS={cover:'杂志封面',image:'独幅图版',split:'图文对照',columns:'双栏长文',triptych:'三联画格',overlay:'满幅叠字',quote:'留白引言',blank:'空白页面'};
export const BOOK_SPREAD_LAYOUTS={panorama:'跨页全景',diptych:'双页图文',blank:'空白跨页'};
export const bookPageWidth=page=>page?.span===2?2000:1000;
export const bookLeafLabel=index=>index===0?'封面':`第 ${index} 页`;
// A spread is one editable surface. Leaves are its two clipped reading views.
export function bookLeaves(book){const leaves=[];book.pages.forEach((page,unitIndex)=>{if(page.span===2&&leaves.length%2)leaves.push({page:{paper:'paper',blocks:[]},unitIndex:null,before:unitIndex,half:0,blank:true});leaves.push({page,unitIndex,half:0});if(page.span===2)leaves.push({page,unitIndex,half:1})});return leaves}
export function bookFacingIndices(leaves,at,single=false){at=Math.max(0,Math.min(leaves.length-1,at));if(single)return [at];at-=at%2;return [at,at+1<leaves.length?at+1:-1]}
export const reviewType=e=>e?.reviewType||((e?.gameBook||e?.magazine?.blocks?.length)?'detailed':'brief');
export const boundBookFrame=(f,canvasWidth=1000)=>{const width=Math.max(24,Math.min(canvasWidth,Number(f.width)||24)),height=Math.max(24,Math.min(1414,Number(f.height)||24));return {x:Math.max(0,Math.min(canvasWidth-width,Number(f.x)||0)),y:Math.max(0,Math.min(1414-height,Number(f.y)||0)),width,height}};
const text=(value,x,y,width,height,size=28)=>({type:'textbox',runs:textRuns(value),frame:{x,y,width,height},layer:1,textboxFill:'none',size,color:'#262d29'});
const picture=(src,x,y,width,height)=>({type:'image',src,caption:'',fit:'cover',frame:{x,y,width,height},layer:0});
export function createBookPage(layout='blank',{title='在这里写下标题',images=[]}={}){
 const p={paper:'paper',blocks:[]};const img=(i,x,y,w,h)=>{if(imagePath(images[i]))p.blocks.push(picture(images[i],x,y,w,h));else p.blocks.push({...text('双击替换为图片',x,y,w,h,24),placeholderImage:true,textboxFill:'preset'})};
 if(layout==='cover'){img(0,0,0,1000,920);p.blocks.push(text(title,80,990,840,175,60),text('游戏详评',84,1210,760,60,24))}
 if(layout==='image'){img(0,80,90,840,1060);p.blocks.push(text(title,80,1200,840,95,36))}
 if(layout==='split'){p.blocks.push(text(title,80,85,840,150,54));img(0,80,290,400,960);p.blocks.push(text('写下你的观察、经历与评价。',540,290,380,960,28))}
 if(layout==='columns'){p.blocks.push(text(title,80,90,840,160,54),text('在左栏开始写作。',80,310,390,960,28),text('在右栏继续展开。',530,310,390,960,28))}
 if(layout==='triptych'){img(0,80,100,840,530);img(1,80,660,400,330);img(2,520,660,400,330);p.blocks.push(text(title,80,1050,840,90,42),text('让图片与文字共同记录你的体验。',80,1180,840,150,27))}
 if(layout==='overlay'){p.paper='ink';img(0,0,0,1000,1414);p.blocks.push({...text(title,80,970,840,210,60),color:'#f2f3ed',textboxFill:'preset'}, {...text('在这里写下导语。',80,1210,840,130,28),color:'#f2f3ed',textboxFill:'preset'})}
 if(layout==='quote'){p.paper='sage';p.blocks.push(text(title,100,350,800,340,64),text('写下值得留下的一句话。',104,830,680,260,28))}
 p.blocks.forEach((b,i)=>b.layer=i);return p;
}
export function createGameBook(entry={}){return {version:1,width:1000,height:1414,pages:[createBookPage('cover',{title:entry.title||'游戏名称',images:entry.cover?[entry.cover]:[]}),createBookPage('split'),createBookPage('columns')]}}
export function createBookSpread(layout='blank',{title='在两页之间，展开画面。',images=[]}={}){const p={span:2,paper:'paper',blocks:[]},img=(x,y,w,h)=>p.blocks.push(imagePath(images[0])?picture(images[0],x,y,w,h):{...text('双击替换为图片',x,y,w,h,28),placeholderImage:true,textboxFill:'preset'});if(layout==='panorama'){img(0,0,2000,1000);p.blocks.push(text(title,80,1080,1180,220,60),text('写下这幅画面背后的经历与感受。',1380,1090,540,230,28))}if(layout==='diptych'){img(80,80,900,1254);p.blocks.push(text(title,1100,120,800,240,60),text('在这里展开你的评价。',1100,470,800,780,28))}p.blocks.forEach((b,i)=>b.layer=i);return p}
export function validateGameBook(book){return !!book&&book.version===1&&book.width===1000&&book.height===1414&&Array.isArray(book.pages)&&book.pages.length>=1&&book.pages.length<=BOOK_MAX_PAGES&&book.pages.every(p=>p&&validPaperEffect(p.paperEffect)&&Object.hasOwn(BOOK_PAPERS,p.paper)&&(p.span===undefined||p.span===1||p.span===2)&&Array.isArray(p.blocks)&&p.blocks.length<=160&&p.blocks.every(b=>{const f=b?.frame;return f&&['x','y','width','height'].every(k=>Number.isFinite(f[k]))&&f.x>=0&&f.y>=0&&f.width>=16&&f.height>=16&&f.x+f.width<=bookPageWidth(p)+.01&&f.y+f.height<=1414.01&&(b.placeholderImage===undefined||typeof b.placeholderImage==='boolean')})&&validateMagazine({version:1,preset:'paper',blocks:p.blocks.map(({frame,...b})=>b)}))&&bookLeaves(book).length<=BOOK_MAX_PAGES}
export function shortReviewFor(entry={}){if(validateShortReview(entry.shortReview))return structuredClone(entry.shortReview);return {version:1,body:textRuns(entry.note||''),images:[]}}
export function validateShortReview(s){return !!s&&s.version===1&&validRuns(s.body)&&Array.isArray(s.images)&&s.images.length<=12&&s.images.every(i=>i&&imagePath(i.src)&&typeof i.caption==='string'&&i.caption.length<=500&&(i.source===undefined||validMediaSource(i.source)))}
// Each exhibition composition becomes editable paper objects rather than a nested slideshow.
const exhibitionFrames={
 immersive:{paper:'ink',images:[[0,0,1000,960],[80,1090,190,190],[300,1090,190,190]],title:[70,650,860,220,60],body:[540,1030,390,300,26],aside:[70,920,860,100,23]},
 spread:{images:[[0,0,470,1000],[60,1050,190,230],[280,1050,190,230]],title:[530,100,400,260,54],body:[530,400,400,590,28],aside:[530,1090,400,210,23]},
 asymmetric:{images:[[80,70,560,590],[680,210,250,380],[450,720,480,450]],title:[70,720,330,240,50],body:[70,1010,330,300,26],aside:[450,1210,480,110,22]},
 contact:{images:[[70,310,270,430],[365,310,270,430],[660,310,270,430]],title:[70,80,860,170,56],body:[70,840,540,430,28],aside:[680,850,250,350,23]},
 collage:{paper:'sage',images:[[70,70,620,650],[540,470,390,480],[120,850,360,400]],title:[510,1010,420,240,48],body:[70,100,500,230,27],aside:[540,1280,390,100,22]},
 shutter:{paper:'ink',images:[[0,0,250,1080],[750,0,250,1080],[380,1020,240,300]],title:[310,140,380,250,52],body:[310,440,380,490,27],aside:[60,1160,260,190,22]},
 portrait:{images:[[65,70,390,970],[65,1080,180,240],[275,1080,180,240]],title:[520,120,410,260,54],body:[520,430,410,620,28],aside:[520,1130,410,190,23]},
 gallery:{images:[[180,200,640,700],[180,970,200,230],[420,970,200,230]],title:[80,60,840,110,42],body:[660,960,270,370,25],aside:[180,1250,440,100,22]},
 type:{paper:'sage',images:[[490,500,440,530],[80,990,170,250],[280,990,170,250]],title:[70,100,860,310,64],body:[70,480,350,450,29],aside:[490,1110,440,190,23]},
 columns:{images:[[70,320,260,290],[370,320,260,290],[670,320,260,290]],title:[70,70,860,190,54],body:[70,680,540,650,28],aside:[670,680,260,650,25]},
 sequence:{images:[[80,90,390,360],[80,500,390,360],[80,910,390,360]],title:[540,100,390,240,52],body:[540,410,390,570,28],aside:[540,1090,390,230,23]},
 panorama:{images:[[0,340,1000,510],[80,1090,200,230],[310,1090,200,230]],title:[80,80,840,190,56],body:[550,940,380,390,27],aside:[80,910,430,130,22]}
};
export function exhibitionBookPages(b){return b.pages.map(p=>{
 const spec=exhibitionFrames[p.layout]||exhibitionFrames.contact,page={paper:spec.paper||'paper',blocks:[]};
 p.images.forEach((img,i)=>{const [x,y,w,h]=spec.images[i];page.blocks.push(imagePath(img.src)?{...picture(img.src,x,y,w,h),caption:img.caption,fit:img.fit,...(img.effects?{effects:structuredClone(img.effects)}:{})}:{...text('双击替换为图片',x,y,w,h,24),placeholderImage:true,textboxFill:'preset'})});
 for(const field of ['title','body','aside']){const block=text('',...spec[field]);block.runs=structuredClone(p[field]);if(page.paper==='ink')block.color='#f2f3ed';if((p.layout==='immersive'&&field==='title')||(p.layout==='collage'&&field==='body'))block.textboxFill='preset';page.blocks.push(block)}
 page.blocks.forEach((o,i)=>o.layer=i);return page;
})}
// Migration keeps the source magazine in the record; no saved document is rewritten on load.
export function gameBookFor(entry={}){if(validateGameBook(entry.gameBook))return structuredClone(entry.gameBook);const old=magazineFor(entry);if(!old.blocks.length)return createGameBook(entry);const pages=[];let page=createBookPage(),y=80;
 function flush(){if(page.blocks.length)pages.push(page);page=createBookPage();y=80}
 for(const original of old.blocks){const b=structuredClone(original);if(b.type==='exhibition'){flush();pages.push(...exhibitionBookPages(b));continue}if(b.frame&&b.frame.height<=1334){const index=Math.floor(b.frame.y/1414);while(pages.length<=index)pages.push(createBookPage());b.frame=boundBookFrame({...b.frame,y:b.frame.y%1414});pages[index].blocks.push(b);continue}
  if(b.runs&&plainRuns(b.runs).length>650){let parts=[],length=0;for(const run of b.runs){let remaining=run.text;while(remaining.length){const piece=remaining.slice(0,650-length);parts.push({...run,text:piece});length+=piece.length;remaining=remaining.slice(piece.length);if(length===650){flush();pages.push({paper:'paper',blocks:[{...b,frame:{x:80,y:90,width:840,height:1230},runs:parts,size:b.size||28,textboxFill:'none'}]});parts=[];length=0}}}if(parts.length){flush();pages.push({paper:'paper',blocks:[{...b,frame:{x:80,y:90,width:840,height:1230},runs:parts,size:b.size||28,textboxFill:'none'}]})}continue}
  const h=b.type==='component'?1050:b.type==='image'?700:b.type==='heading'?150:b.type==='divider'?24:Math.min(850,Math.max(180,Math.ceil(plainRuns(b.runs).length/26)*54));if(y+h>1334)flush();b.frame={x:80,y,width:840,height:h};if(b.runs)b.size||=28;b.layer=page.blocks.length;page.blocks.push(b);y+=h+35;
 }flush();return {version:1,width:1000,height:1414,pages:pages.length?pages:[createBookPage()]}}

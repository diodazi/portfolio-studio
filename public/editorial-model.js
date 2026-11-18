import {validImageEffects} from './image-effects-model.js';
import {validFont} from './editor-fonts.js';
import {validVisualStyle} from './editorial-styles.js';
const definitions=[
 ['poster','海报扉页','开篇与文字','图片上的大标题与开篇引言',0,true],['split','分栏扉页','开篇与文字','竖幅主视觉与独立文字对页',0,true],
 ['chapter','章节页','开篇与文字','留白、章节数字与衬线标题',0,false],['dropcap','首字下沉','开篇与文字','放大的首字融入正文行列',0,false],
 ['pullquote','大字引言','开篇与文字','独立摘录与署名，形成阅读停顿',0,false],['sidenote','页边旁注','开篇与文字','正文与边栏补充相互呼应',1,false],
 ['callout','重点摘记','开篇与文字','灰绿底色与细线突出关键文字',0,false],['interview','对话访谈','开篇与文字','逐组编排的问题与回答',3,false],
 ['spread','图文对页','图片与文章','图片与长段文字，可左右互换',0,true],['panorama','横幅插图','图片与文章','舒展的横幅与页边图注',0,true],
 ['caption-overlay','浮层图注','图片与文章','半透明信息层落在照片上',0,true],['diptych','双图对照','图片与文章','两幅图像及各自的说明',2,false],
 ['triptych','三联画','图片与文章','三幅图像形成有主次的画面',3,false],['collage','剪贴拼图','图片与文章','轻微旋转、错落层叠的照片页',3,false],
 ['contact-sheet','接触印样','图片与文章','有序图集，可打开单张大图',6,false],['filmstrip','胶片序列','图片与文章','横向浏览的连续画面',4,false],
 ['timeline','经历时间线','经历与评价','按节点串联经历与图片',3,false],['metrics','关键数字','经历与评价','数字、单位与简短说明',3,false],
 ['facts','作品资料页','经历与评价','清晰排列的字段与资料',4,false],['proscons','双向观点','经历与评价','两组并列观点及解释',2,false],
 ['rating','维度评价','经历与评价','分项评分、进度刻度与评价',4,false],['contents','章节目录','经历与评价','自动读取文章标题并跳转',0,false],
 ['accordion','折叠补充／剧透','互动阅读','点击展开额外细节，保留主线阅读',3,false],['tabs','观点页签','互动阅读','切换不同角度的文字与图片',3,false],
 ['comparison','图片滑杆对比','互动阅读','拖动分界线查看两幅画面',2,false],['hotspots','图片热点注释','互动阅读','图像上的可点击注释点',3,true],
 ['carousel','图文轮播','互动阅读','逐幅切换画面与说明',3,false],['flip','双面卡片','互动阅读','点击翻面阅读另一段文字',2,false],
 ['scrolly','滚动分镜','互动阅读','文字推进时切换固定画面',3,false],['reveal','图片展开章节','互动阅读','随阅读进度揭示宽幅画面',0,true],
 ['footnote','行内注脚','互动阅读','正文旁可点击的补充注释',1,false],['related','延伸阅读','互动阅读','文章结尾的作品与链接',2,false]
];
export const COMPONENTS=Object.fromEntries(definitions.map(([id,name,group,description,count,image])=>[id,{id,name,group,description,count,image}]));
export const COMPONENT_GROUPS=[...new Set(definitions.map(d=>d[2]))];
export const textRuns=text=>[{text}];
export const plainRuns=runs=>(runs||[]).map(r=>r.text).join('');
export const validRuns=r=>Array.isArray(r)&&r.length<=1000&&r.every(v=>v&&typeof v.text==='string'&&v.text.length<=30000&&['bold','italic','underline'].every(k=>v[k]===undefined||typeof v[k]==='boolean')&&(v.size===undefined||Number.isFinite(v.size)&&v.size>=12&&v.size<=64)&&(v.font===undefined||validFont(v.font))&&(v.color===undefined||/^#[a-f0-9]{6}$/i.test(v.color)));
const imagePath=s=>typeof s==='string'&&(!s||/^\.\/assets\/media\/(?!.*\.\.)[\p{L}\p{N}_ .-]+\.(?:jpe?g|png|webp|avif)$/iu.test(s));
export const safeLink=s=>typeof s==='string'&&s.length<=2000&&(!s||/^(?:https?:\/\/[^\s<>]+|\.\/(?!\/|.*(?:\.\.|[<>\\]))[^\s]+|#[\w-]+)$/.test(s));
const short=s=>typeof s==='string'&&s.length<=500;
const num=(v,a,z)=>Number.isFinite(v)&&v>=a&&v<=z;
export function createComponent(id){
 const def=COMPONENTS[id];if(!def)throw Error('未知组件');
 const b={type:'component',component:id,title:textRuns(def.name),body:textRuns('在这里写下你的文字。让值得记住的画面与感受，在这一页相遇。'),label:id==='chapter'?'01':'',caption:'',src:'',items:[],options:{tone:'paper',side:'left',motion:true,fit:'cover',columns:3,start:50,padding:40,gap:24}};
 for(let i=0;i<def.count;i++)b.items.push(createComponentItem(id,i));
 if(['callout','sidenote','metrics','facts'].includes(id))b.options.tone='sage';
 if(['poster','caption-overlay','flip','reveal'].includes(id))b.options.tone='ink';
 if(id==='poster')b.title=textRuns('把这一刻，\n留在纸上。');
 if(id==='pullquote'){b.title=textRuns('总有一些片刻，\n值得再看一次。');b.body=textRuns('在这里填写引言来源或署名。')}
 if(id==='dropcap')b.body=textRuns('记得第一次进入这个世界时，画面、声音与那些尚未发生的故事，一起停在眼前。你可以在这里继续写下自己的观察、经历与想法。');
 if(id==='contents')b.body=textRuns('文章中的标题和章节会显示在这里。');
 return b;
}
export function createComponentItem(id,index=0){return {title:textRuns(id==='metrics'?['24','06','12'][index%3]:id==='interview'?'在这里输入问题':'片段 '+String(index+1).padStart(2,'0')),body:textRuns(id==='interview'?'在这里写下回答。':'写下这一部分的经历、观察或补充说明。'),label:id==='timeline'?'时间 / 地点':id==='metrics'?'单位与说明':'',src:'',href:'',value:75,x:20+(index%3)*30,y:30+(index%2)*30}}
export function validateComponent(b){
 if(!validImageEffects(b?.effects)||(Array.isArray(b?.items)&&b.items.some(i=>!validImageEffects(i?.effects))))return false;
 if(!b||!Object.hasOwn(COMPONENTS,b.component)||!validRuns(b.title)||!validRuns(b.body)||!short(b.label)||!short(b.caption)||!imagePath(b.src)||!Array.isArray(b.items)||b.items.length>24)return false;
 const fixed={diptych:2,triptych:3,comparison:2,flip:2,proscons:2};if(fixed[b.component]&&b.items.length!==fixed[b.component]||COMPONENTS[b.component].count&&b.items.length<1)return false;
 if(!b.items.every(i=>i&&validRuns(i.title)&&validRuns(i.body)&&short(i.label)&&imagePath(i.src)&&safeLink(i.href)&&num(i.value,0,100)&&num(i.x,0,100)&&num(i.y,0,100)))return false;
 const o=b.options;if(!o||!['paper','sage','ink','glass'].includes(o.tone)||!['left','right'].includes(o.side)||typeof o.motion!=='boolean'||!['cover','contain'].includes(o.fit)||!Number.isInteger(o.columns)||!num(o.columns,1,6)||!num(o.start,0,100)||!num(o.padding,12,96)||!num(o.gap,0,80))return false;
 return validVisualStyle(o.style)&&Object.keys(o).every(k=>['tone','side','motion','fit','columns','start','padding','gap','style'].includes(k));
}
export function componentRuns(b,key){if(key==='title'||key==='body')return b[key];const m=/^items\.(\d+)\.(title|body)$/.exec(key);return m?b.items[Number(m[1])]?.[m[2]]:undefined}
export function setComponentRuns(b,key,runs){if(!validRuns(runs))return;if(key==='title'||key==='body')b[key]=runs;else{const m=/^items\.(\d+)\.(title|body)$/.exec(key);if(m&&b.items[Number(m[1])])b.items[Number(m[1])][m[2]]=runs}}
export function magazineText(doc){return (doc?.blocks||[]).map(b=>b.type==='exhibition'?b.pages.flatMap(p=>[p.label,plainRuns(p.title),plainRuns(p.body),plainRuns(p.aside),...p.images.map(i=>i.caption)]).join('\n'):b.type==='component'?[plainRuns(b.title),plainRuns(b.body),...b.items.flatMap(i=>[plainRuns(i.title),plainRuns(i.body),i.label])].join('\n'):plainRuns(b.runs)||b.caption||'').join('\n')}
export const ARTICLE_TEMPLATES=[
 {id:'essay',name:'纸页随笔',description:'引言、旁注与图像，适合日常观察与长文。',preset:'paper',components:['split','dropcap','sidenote','panorama','pullquote']},
 {id:'journey',name:'游戏旅程',description:'资料、旅程节点与可展开的评价。',preset:'folio',components:['poster','facts','timeline','triptych','rating','accordion']},
 {id:'cinema-note',name:'电影札记',description:'宽幅画面、胶片、观点与细节对照。',preset:'paper',components:['reveal','facts','filmstrip','pullquote','tabs','related']},
 {id:'photo-essay',name:'图像手记',description:'对页、多图与留白组成的视觉文章。',preset:'folio',components:['split','spread','triptych','caption-overlay','contact-sheet']}
];
export function templateBlocks(id){const template=ARTICLE_TEMPLATES.find(t=>t.id===id);if(!template)throw Error('未知文章预设');return template.components.map(createComponent)}

import {validImageEffects} from './image-effects-model.js';
import {validRuns,textRuns,plainRuns} from './editorial-model.js';

export const EXHIBITION_LAYOUTS={immersive:'满幅叠字',spread:'书脊对页',asymmetric:'错位三联',contact:'接触印样',collage:'剪贴叠层',shutter:'双翼开合',portrait:'长幅侧记',gallery:'留白画廊',type:'字与图',columns:'分栏阅读',sequence:'连续画格',panorama:'宽幅地平线'};
export const EXHIBITION_TRANSITIONS={dissolve:'叠化推近',leaf:'书页翻转',slide:'横向推移',stagger:'逐格展开',stack:'叠片抽取',curtain:'帷幕揭开',rise:'纵向交接',iris:'光圈展开'};
const definitions=[
 ['immersive','银幕序章','画面先行，文字浮现在暗部；宽幅与留白交替，像一段缓慢展开的片头。','dissolve',['immersive','panorama','type','gallery']],
 ['spread','纸间对页','图片占据一侧，正文沿书脊展开；对页、分栏与插页形成杂志的阅读节奏。','leaf',['spread','columns','portrait','spread']],
 ['asymmetric','错位网格','三张图片以不同尺度咬合，主文与旁注穿插，形成有张力的编辑版面。','slide',['asymmetric','portrait','asymmetric','type']],
 ['contact','接触印样','从三幅并列小图读到单幅大图；保留图注，让一组图像成为一段记录。','stagger',['contact','gallery','sequence','contact']],
 ['collage','剪贴档案','图片交叠、纸片错位，旁注靠近画面；翻页像从一摞手记中抽出新页。','stack',['collage','spread','collage','columns']],
 ['shutter','双翼放映','两幅纵向画面围出中间的文字；帷幕式揭开，让图文在开合之间交接。','curtain',['shutter','immersive','shutter','gallery']],
 ['portrait','长幅侧记','窄幅竖图与宽松正文并置，边缘旁注连接大字插页，适合人物与细节。','rise',['portrait','type','spread','portrait']],
 ['gallery','静室画廊','图像放在大面积灰绿留白中，标题和图注退到边缘；光圈展开下一件作品。','iris',['gallery','panorama','gallery','type']],
 ['type','字像宣言','大字本身参与构图，文字切入小幅图片；节制的正文与强烈的标题交替。','curtain',['type','asymmetric','type','columns']],
 ['columns','页边长文','主文、窄栏和旁注组成可阅读的长页，穿插独幅图版；翻页保留纸张的方向感。','leaf',['columns','spread','columns','gallery']],
 ['sequence','连续画格','三幅画面以横向序列展开，正文与序列共用基线；逐格出现形成视觉停顿。','stagger',['sequence','panorama','contact','sequence']],
 ['panorama','地平漫游','横幅画面贯穿页面，文字分列在上下边缘；左右推移连接远景与细节。','slide',['panorama','asymmetric','portrait','panorama']]
];
export const EXHIBITION_PRESETS=Object.fromEntries(definitions.map(([id,name,description,transition,layouts])=>[id,{id,name,description,transition,layouts}]));
export function createExhibitionPage(layout='spread',index=0){return {layout,label:`第 ${index+1} 章`,title:textRuns(index?'在这里，继续书写。':'从这一页开始。'),body:textRuns('写下这一段的观察、经历与感受。你可以直接编辑文字，也可以从素材库选取图片，让画面与文字共同展开。'),aside:textRuns('写下一则旁注，或留空。'),images:Array.from({length:3},()=>({src:'',caption:'',fit:'cover',x:50,y:50}))}}
export function createExhibition(id){const p=EXHIBITION_PRESETS[id];if(!p)throw Error('未知展览预设');return {type:'exhibition',preset:id,transition:p.transition,motion:true,pages:p.layouts.map(createExhibitionPage)}}
export function withExhibitionPreset(block,id){const p=EXHIBITION_PRESETS[id];if(!p||block?.type!=='exhibition')throw Error('请选择一个展览章节');const copy=structuredClone(block);copy.preset=id;copy.transition=p.transition;copy.pages.forEach((page,i)=>page.layout=p.layouts[i%p.layouts.length]);return copy}
const imagePath=s=>typeof s==='string'&&(!s||/^\.\/assets\/media\/(?!.*\.\.)[\p{L}\p{N}_ .-]+\.(?:jpe?g|png|webp|avif)$/iu.test(s));
const num=n=>Number.isFinite(n)&&n>=0&&n<=100;
export function validateExhibition(b){return !!b&&Object.hasOwn(EXHIBITION_PRESETS,b.preset)&&Object.hasOwn(EXHIBITION_TRANSITIONS,b.transition)&&typeof b.motion==='boolean'&&Array.isArray(b.pages)&&b.pages.length>=1&&b.pages.length<=24&&b.pages.every(p=>p&&Object.hasOwn(EXHIBITION_LAYOUTS,p.layout)&&typeof p.label==='string'&&p.label.length<=100&&validRuns(p.title)&&validRuns(p.body)&&validRuns(p.aside)&&Array.isArray(p.images)&&p.images.length===3&&p.images.every(i=>i&&validImageEffects(i.effects)&&imagePath(i.src)&&typeof i.caption==='string'&&i.caption.length<=500&&['cover','contain'].includes(i.fit)&&num(i.x)&&num(i.y)))}
export function exhibitionRuns(b,key){const m=/^pages\.(\d+)\.(title|body|aside)$/.exec(key);return m?b.pages[Number(m[1])]?.[m[2]]:undefined}
export function setExhibitionRuns(b,key,runs){const m=/^pages\.(\d+)\.(title|body|aside)$/.exec(key);if(m&&b.pages[Number(m[1])]&&validRuns(runs))b.pages[Number(m[1])][m[2]]=runs}
export function setExhibitionImage(b,key,src){const m=/^pages\.(\d+)\.images\.([0-2])\.src$/.exec(key);const img=m&&b.pages[Number(m[1])]?.images[Number(m[2])];if(!img||!imagePath(src))return false;img.src=src;delete img.effects;return true}
export const exhibitionText=b=>b.pages.flatMap(p=>[p.label,plainRuns(p.title),plainRuns(p.body),plainRuns(p.aside),...p.images.map(i=>i.caption)]).join('\n');

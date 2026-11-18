// Appearance is independent of content, geometry and interaction type.
const definitions=[
 ['monument','大字留白','字体构成','舒展留白与超大无衬线标题'],['hairline','细衬线','字体构成','纤细衬线、疏朗字距和安静的正文'],['condensed','紧凑字阵','字体构成','厚重紧排标题与清晰的小字对照'],['outline','轮廓字','字体构成','描边标题与轻薄线条'],['vertical','竖向题签','字体构成','竖排标题，横排正文保留阅读节奏'],
 ['swiss','瑞士网格','网格构成','强左边界、无衬线与规则分割'],['offset','错位编排','网格构成','标题与正文错位，图像向一侧退让'],['rail','侧栏细线','网格构成','纵向细线组织题目与文字'],['blueprint','制图坐标','网格构成','灰绿网格、角标与精确线条'],['modular','模块分格','网格构成','不等宽图文与有主次的分格'],
 ['broadsheet','报刊双栏','印刷语言','双栏正文、厚细双线与衬线标题'],['letterpress','活字压印','印刷语言','柔和字影与纸面压印感'],['risograph','双色套印','印刷语言','灰绿印层与小面积蓝色错版'],['typewriter','打字机','印刷语言','等宽文字、档案边线与打字节奏'],['archive','档案标记','印刷语言','细框、索引式标题与虚线分区'],
 ['torn','撕边纸页','纸张手作','不规则纸边与自然层次'],['taped','胶带手记','纸张手作','半透明胶带与轻微错落'],['polaroid','相纸留边','纸张手作','宽相纸边、图片下方的书写空间'],['folded','折角书页','纸张手作','折角与书页内阴影'],['notebook','横线笔记','纸张手作','横线纸纹、侧边界与手记式标题'],
 ['masthead','时尚刊头','时尚编排','细长大字、紧密字距与大幅图像'],['gallery','画廊留白','时尚编排','小标题、宽留白和独立图注'],['mat','装裱画框','时尚编排','双层细框与图像内衬'],['atelier','工作室拼版','时尚编排','裁切标记、偏置标题和图文交错'],['index','极简索引','时尚编排','小号等宽标题、细线和分明的信息层级'],
 ['frosted','雾面玻璃','空间材质','柔焦玻璃、透光边缘与浅景深'],['vellum','半透明描图纸','空间材质','叠纸边界与透光的文字区域'],['embossed','浮雕纸面','空间材质','柔和高光与浅浮雕边缘'],['metal','拉丝金属','空间材质','灰绿金属细纹与锐利字形'],['contour','等高线','空间材质','安静的曲线纹理与柔和层次'],
 ['terminal','终端排印','数字图形','深灰绿底、等宽字与光标式标记'],['pixel','像素网格','数字图形','阶梯边界、像素点与硬朗留白'],['scanline','扫描纹理','数字图形','暗场扫描线与清晰的浅色文字'],['halftone','半调网点','数字图形','网点印刷纹理与平面图形感'],['wireframe','线框界面','数字图形','空心结构、角标与透明网格'],
 ['spotlight','游光玻璃','交互动效','光晕随指针在灰绿玻璃上移动'],['tilt','悬浮透视','交互动效','指针引导轻微空间倾斜'],['ink-reveal','墨色显影','交互动效','标题进入视野时由淡到实显现'],['lift','悬停展幅','交互动效','指针进入时图像轻轻放大，线条延展'],['shutters','百叶揭幕','交互动效','图像进入视野时分条展开']
];
export const VISUAL_STYLES=Object.fromEntries(definitions.map(([id,name,group,description])=>[id,{id,name,group,description}]));
export const STYLE_GROUPS=[...new Set(definitions.map(s=>s[2]))];
export const validVisualStyle=value=>value===undefined||value==='original'||typeof value==='string'&&Object.hasOwn(VISUAL_STYLES,value);
export function withVisualStyle(block,style){if(block?.type!=='component'||!validVisualStyle(style))throw Error('请选择有效的组件风格。');const copy=structuredClone(block);if(!style||style==='original')delete copy.options.style;else copy.options.style=style;return copy}

// No perpetual animation loops. Events and observers are released on editor repaint.
export function attachVisualStyle(root,{editing=false,thumbnail=false}={}){
 if(thumbnail||!['spotlight','tilt','ink-reveal','shutters'].includes(root.dataset.style))return ()=>{};
 const style=root.dataset.style,media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,observer,active=false;
 const reset=()=>{cancelAnimationFrame(frame);frame=0;root.style.removeProperty('--vs-x');root.style.removeProperty('--vs-y');root.style.removeProperty('--vs-rx');root.style.removeProperty('--vs-ry');root.classList.remove('vs-pointing')};
 const move=event=>{if(!active||event.pointerType==='touch')return;const box=root.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{root.style.setProperty('--vs-x',x*100+'%');root.style.setProperty('--vs-y',y*100+'%');root.style.setProperty('--vs-rx',(0.5-y)*4+'deg');root.style.setProperty('--vs-ry',(x-.5)*4+'deg');root.classList.add('vs-pointing')})};
 const configure=()=>{reset();observer?.disconnect();observer=null;root.classList.remove('vs-ready','vs-entered');active=!editing&&!thumbnail&&root.dataset.motion!=='false'&&!media.matches;if(!active)return;
  if(['ink-reveal','shutters'].includes(style)&&typeof IntersectionObserver!=='undefined'){root.classList.add('vs-ready');observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){root.classList.add('vs-entered');observer.disconnect()}},{threshold:.05});observer.observe(root)}
 };
 if(['spotlight','tilt'].includes(style)){root.addEventListener('pointermove',move);root.addEventListener('pointerleave',reset)}
 media.addEventListener('change',configure);configure();return ()=>{reset();observer?.disconnect();media.removeEventListener('change',configure);root.removeEventListener('pointermove',move);root.removeEventListener('pointerleave',reset)};
}

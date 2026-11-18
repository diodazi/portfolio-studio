// Persist stable identifiers only; arbitrary CSS and remote font URLs are never accepted.
export const EDITOR_FONTS={
 default:{label:'默认字体',css:'inherit'},
 notosanssc:{label:'Noto Sans SC · 清晰黑体',css:'"Portfolio notosanssc", sans-serif'},
 notoserifsc:{label:'Noto Serif SC · 杂志宋体',css:'"Portfolio notoserifsc", serif'},
 zcoolxiaowei:{label:'站酷小薇 · 文艺标题',css:'"Portfolio zcoolxiaowei", "Portfolio notoserifsc", serif'},
 mashanzheng:{label:'马善政 · 毛笔楷体',css:'"Portfolio mashanzheng", "Portfolio notoserifsc", serif'},
 dmsans:{label:'DM Sans · 现代无衬线',css:'"Portfolio dmsans", "Portfolio notosanssc", sans-serif'},
 cormorantgaramond:{label:'Cormorant Garamond · 典雅衬线',css:'"Portfolio cormorantgaramond", "Portfolio notoserifsc", serif'},
 jetbrainsmono:{label:'JetBrains Mono · 等宽字体',css:'"Portfolio jetbrainsmono", "Portfolio notosanssc", monospace'}
};
export const validFont=id=>typeof id==='string'&&Object.hasOwn(EDITOR_FONTS,id);
export const fontStack=id=>validFont(id)?EDITOR_FONTS[id].css:'';
export const fontOptions=()=>Object.entries(EDITOR_FONTS).map(([id,f])=>[id,f.label]);
export function applyRunFont(node,id){if(validFont(id)){node.dataset.font=id;node.style.fontFamily=fontStack(id)}}
export function uniformFont(runs,fallback='default'){const values=new Set((runs||[]).map(r=>r.font||fallback));return values.size>1?'mixed':[...values][0]||fallback}
export function applyUniformRunFont(node,runs){const id=uniformFont(runs,'');if(validFont(id))applyRunFont(node,id)}
export function fontIdFromElement(node){const id=node.dataset?.font;if(validFont(id))return id;const first=node.style?.fontFamily?.split(',')[0].trim().replace(/["']/g,'');if(first==='inherit')return 'default';return Object.keys(EDITOR_FONTS).find(id=>first==='Portfolio '+id)}

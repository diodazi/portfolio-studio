import {COMPONENTS,createComponentItem,plainRuns,safeLink} from '/editorial-model.js';
import {VISUAL_STYLES} from '/editorial-styles.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n};
export function mountEditorialInspector(parent,{getBlock,change,pickImage,duplicate,showStyles,onError}){
 const panel=el('details','editorial-inspector');panel.hidden=true;const summary=el('summary'),body=el('div','ei-body');panel.append(summary,body);parent.append(panel);let last;
 const button=(label,fn,where=body)=>{const b=el('button','',label);b.type='button';b.onclick=fn;where.append(b);return b};
 function input(label,value,fn,{type='text',min,max,options,parent=body}={}){const wrap=el('label','ei-control'),n=el(options?'select':'input');wrap.append(el('span','',label));if(options)for(const [v,title]of options){const o=el('option','',title);o.value=v;n.append(o)}else n.type=type;n.value=value;if(min!==undefined)n.min=min;if(max!==undefined)n.max=max;if(type==='text')n.maxLength=label==='链接地址'?2000:500;n.setAttribute('aria-label',label);n.onchange=()=>{const value=type==='number'?Math.max(min,Math.min(max,Number(n.value)||0)):n.value;fn(value)};wrap.append(n);parent.append(wrap);return n}
 function imageRow(label,key,src,parent=body){const row=el('div','ei-image-row');if(src){const img=el('img');img.src='/'+src.slice(2);img.alt='';row.append(img)}row.append(el('span','',label));button(src?'更换图片':'选择图片',()=>pickImage(key),row);if(src)button('移除图片',()=>change(()=>{const b=getBlock();if(key==='src')b.src='';else b.items[Number(key.split('.')[1])].src=''}),row);parent.append(row)}
 function sync(force=false){const b=getBlock();panel.hidden=b?.type!=='component';if(panel.hidden){last=null;return}if(last===b&&!force)return;last=b;body.replaceChildren();const d=COMPONENTS[b.component];summary.textContent=d.name+' · 组件设置';const options=el('div','ei-options');body.append(options);
 const styleActions=el('div','ei-style-actions');styleActions.append(el('span','mag-style-current','当前风格：'+(VISUAL_STYLES[b.options.style]?.name||'原有外观')));button('选择视觉风格',showStyles,styleActions);if(b.options.style)button('恢复原有外观',()=>change(()=>delete b.options.style),styleActions);options.append(styleActions);
 input('组件底色',b.options.tone,v=>change(()=>b.options.tone=v),{parent:options,options:[['paper','纸白'],['sage','灰绿'],['ink','深墨'],['glass','透光玻璃']]});
 if(['split','spread','caption-overlay'].includes(b.component))input('图文方向',b.options.side,v=>change(()=>b.options.side=v),{parent:options,options:[['left','图左 / 文字左'],['right','图右 / 文字右']]});
 input('组件留白',b.options.padding,v=>change(()=>b.options.padding=v),{parent:options,type:'number',min:12,max:96});input('内容间距',b.options.gap,v=>change(()=>b.options.gap=v),{parent:options,type:'number',min:0,max:80});
 input('组件动效',String(b.options.motion),v=>change(()=>b.options.motion=v==='true'),{parent:options,options:[['true','开启'],['false','关闭']]});
 if(d.image||d.count)input('组件图片适配',b.options.fit,v=>change(()=>b.options.fit=v),{parent:options,options:[['cover','裁切填满'],['contain','完整显示']]});
 if(b.component==='contact-sheet')input('图集列数',b.options.columns,v=>change(()=>b.options.columns=v),{parent:options,type:'number',min:1,max:6});
 if(b.component==='comparison')input('初始对比分界 %',b.options.start,v=>change(()=>b.options.start=v),{parent:options,type:'number',min:0,max:100});
 input('眉题 / 章节编号',b.label,v=>change(()=>b.label=v),{parent:options});
 if(d.image){imageRow('主图','src',b.src);input('主图图注',b.caption,v=>change(()=>b.caption=v))}
 const tools=el('div','ei-actions');body.append(tools);button('复制这个组件',duplicate,tools);body.append(el('p','field-help','正文中的文字可以直接编辑；选中文字后使用上方字号、字色与加粗工具。图片从素材库复用，透明 PNG 保留透明像素。'));
 if(d.count){const rows=el('div','ei-items');body.append(rows);b.items.forEach((item,i)=>{const row=el('details','ei-item'),s=el('summary','',`${String(i+1).padStart(2,'0')} · ${plainRuns(item.title).slice(0,24)||'未命名条目'}`),inside=el('div','ei-item-body');row.append(s,inside);rows.append(row);
 input(`条目 ${i+1} 标注`,item.label,v=>change(()=>item.label=v),{parent:inside});
 if(['diptych','triptych','collage','contact-sheet','filmstrip','timeline','tabs','comparison','carousel','scrolly','related'].includes(b.component))imageRow('条目图片',`items.${i}.src`,item.src,inside);
 if(b.component==='rating')input(`条目 ${i+1} 评分`,item.value,v=>change(()=>item.value=v),{type:'number',min:0,max:100,parent:inside});
 if(b.component==='hotspots'){input(`注释 ${i+1} 横向 %`,item.x,v=>change(()=>item.x=v),{type:'number',min:0,max:100,parent:inside});input(`注释 ${i+1} 纵向 %`,item.y,v=>change(()=>item.y=v),{type:'number',min:0,max:100,parent:inside})}
 if(b.component==='related')input('链接地址',item.href,v=>{if(!safeLink(v)){onError('链接请使用 http://、https://、./ 或 # 开头的地址。');return}change(()=>item.href=v)},{parent:inside});
 const actions=el('div','ei-actions');inside.append(actions);button('向前',()=>change(()=>[b.items[i-1],b.items[i]]=[b.items[i],b.items[i-1]]),actions).disabled=i===0;button('向后',()=>change(()=>[b.items[i+1],b.items[i]]=[b.items[i],b.items[i+1]]),actions).disabled=i===b.items.length-1;
 if(!['diptych','triptych','comparison','flip','proscons'].includes(b.component))button('删除条目',()=>change(()=>b.items.splice(i,1)),actions).disabled=b.items.length<=1;
 });if(!['diptych','triptych','comparison','flip','proscons'].includes(b.component))button('增加一个条目',()=>change(()=>b.items.push(createComponentItem(b.component,b.items.length))),body).disabled=b.items.length>=24;}
 }
 return {sync,hide(value){panel.hidden=value||getBlock()?.type!=='component'}};
}

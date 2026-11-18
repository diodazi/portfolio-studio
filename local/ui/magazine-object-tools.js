import {CANVAS_WIDTH,MAX_CANVAS_HEIGHT,clamp,boundedFrame,placeFrame,updateSurface,canvasHeight} from '/magazine-layout.js';

export function mountObjectTools({bar,inspector,button,select,getDoc,getSelected,getSurface,getPaper,change,commit,choose}){
  const doc=()=>getDoc(),block=()=>doc().blocks[getSelected()],free=()=>doc().layout==='free';
  function numeric(label,min,max,onChange,parent=inspector,step='1'){
    const wrap=document.createElement('label');wrap.className='mag-control';const name=document.createElement('span');name.textContent=label;
    const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.setAttribute('aria-label',label);wrap.append(name,input);parent.append(wrap);
    input.addEventListener('change',()=>{const value=Number(input.value);if(Number.isFinite(value))onChange(clamp(value,Number(input.min),Number(input.max)))});return input;
  }
  const layout=select('排版方式',[['flow','文档排版'],['free','自由画布']],value=>change(()=>{
    if(value==='free'){
      const surface=getSurface(),bounds=surface.getBoundingClientRect(),style=getComputedStyle(surface),left=parseFloat(style.paddingLeft),top=parseFloat(style.paddingTop),scale=CANVAS_WIDTH/(surface.clientWidth-left-parseFloat(style.paddingRight));
      doc().blocks.forEach((b,i)=>{
        if(!b.frame){const element=surface.children[i],r=element.getBoundingClientRect(),image=element.querySelector('.mag-image-frame')?.getBoundingClientRect();b.frame=boundedFrame({x:Math.round((r.left-bounds.left-left)*scale),y:Math.round((r.top-bounds.top-top)*scale),width:Math.round(r.width*scale),height:Math.round((image?.height||r.height||80)*scale)})}
        b.layer??=i;
      });doc().canvas={width:CANVAS_WIDTH,height:Math.min(MAX_CANVAS_HEIGHT,canvasHeight(doc()))};
    }doc().layout=value;
  }),bar);
  bar.insertBefore(layout.parentElement,bar.children[3]||null);
  const panel=document.createElement('div');panel.className='mag-object-controls';inspector.append(panel);
  const objectSelect=select('选择对象',[],v=>choose(Number(v)),panel);
  const x=numeric('横向位置 X',0,1000,v=>setFrame('x',v),panel),y=numeric('纵向位置 Y',0,12000,v=>setFrame('y',v),panel);
  const frameW=numeric('对象宽度',16,1000,v=>setFrame('width',v),panel),frameH=numeric('对象高度',16,8000,v=>setFrame('height',v),panel);
  const pageH=numeric('画布高度',200,12000,v=>change(()=>{doc().canvas.height=v}),panel);
  const layerButtons=[button('上移一层',()=>layer('up'),panel),button('下移一层',()=>layer('down'),panel),button('置于顶层',()=>layer('front'),panel),button('置于底层',()=>layer('back'),panel)];
  const dimensions=document.createElement('div');dimensions.className='mag-object-controls';inspector.append(dimensions);
  const exactWidth=numeric('精确宽度 %',2,100,v=>change(()=>block().width=v),dimensions,'.1');
  const textH=numeric('文本框高度',0,4000,v=>change(()=>block().boxHeight=v===0?0:Math.max(24,v)),dimensions);
  const fill=select('文本框底色',[['preset','跟随预设'],['none','透明']],v=>change(()=>block().textboxFill=v),dimensions);
  const fitText=button('适应文字高度',()=>{const element=getSurface().children[getSelected()],text=element?.querySelector('.editorial-component,.exhibition')||element?.querySelector('.mag-edit-text');if(!text)return;const style=getComputedStyle(element),height=Math.ceil(text.scrollHeight+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2);change(()=>{if(free())block().frame=boundedFrame({...block().frame,height});else block().boxHeight=clamp(height,24,4000)})},dimensions);
  const picture=document.createElement('div');picture.className='mag-object-controls';inspector.append(picture);
  const imageScale=numeric('图片缩放 %',10,400,v=>change(()=>block().imageScale=v),picture);
  const imageX=numeric('图片横向偏移 %',-100,100,v=>change(()=>block().imageOffsetX=v),picture);
  const imageY=numeric('图片纵向偏移 %',-100,100,v=>change(()=>block().imageOffsetY=v),picture);
  button('重置框内图片',()=>change(()=>{block().imageScale=100;block().imageOffsetX=0;block().imageOffsetY=0}),picture);
  const status=document.createElement('p');status.className='mag-object-status';status.setAttribute('role','status');inspector.append(status);
  function setFrame(key,value){if(!block()?.frame)return;change(()=>{block().frame=boundedFrame({...block().frame,[key]:value})})}
  function layer(direction){
    change(()=>{const items=doc().blocks.map((b,i)=>({b,i})).sort((a,b)=>(a.b.layer??a.i)-(b.b.layer??b.i)),at=items.findIndex(e=>e.i===getSelected());const [item]=items.splice(at,1);let to=direction==='front'?items.length:direction==='back'?0:clamp(at+(direction==='up'?1:-1),0,items.length);items.splice(to,0,item);items.forEach((e,i)=>e.b.layer=i)});
  }
  function sync(){
    const b=block()||{},isFree=free(),image=b.type==='image',text=!!b.runs||['component','exhibition'].includes(b.type);
    layout.value=isFree?'free':'flow';panel.hidden=!isFree;picture.hidden=!image;
    exactWidth.parentElement.hidden=isFree||!['image','textbox','component','exhibition'].includes(b.type);textH.parentElement.hidden=isFree||!['textbox','component','exhibition'].includes(b.type);fill.parentElement.hidden=b.type!=='textbox';fitText.hidden=!text||(!isFree&&!['textbox','component','exhibition'].includes(b.type));
    dimensions.hidden=[...dimensions.children].every(e=>e.hidden);
    exactWidth.value=b.width||100;textH.value=b.boxHeight||0;fill.value=b.textboxFill||'preset';imageScale.value=b.imageScale||100;imageX.value=b.imageOffsetX||0;imageY.value=b.imageOffsetY||0;
    if(isFree){objectSelect.replaceChildren(...doc().blocks.map((b,i)=>{const o=document.createElement('option');o.value=i;const name={image:'图片',textbox:'文本框',heading:'标题',paragraph:'正文',quote:'引用',divider:'分隔线',component:'组件',exhibition:'展览章节'}[b.type];o.textContent=`${i+1} · ${name} ${(b.caption||b.runs?.map(r=>r.text).join('')||'').slice(0,16)}`;return o}));objectSelect.value=getSelected();x.value=b.frame?.x||0;y.value=b.frame?.y||0;frameW.value=b.frame?.width||100;frameH.value=b.frame?.height||100;pageH.value=canvasHeight(doc())}
    status.textContent=isFree?'拖动图片或移动手柄自由摆放；层级决定重叠时谁显示在上方。':image?'外框尺寸控制版面占位；图片缩放与偏移只改变框内画面。':'';status.hidden=!status.textContent;
    layerButtons.forEach(e=>e.disabled=!isFree);
  }
  function insertFrame(b){if(!free())return;const previous=block()?.frame;b.frame=boundedFrame({x:previous?Math.min(previous.x+32,600):60,y:previous?Math.min(previous.y+60,11000):60,width:b.type==='image'?440:b.type==='textbox'?360:760,height:b.type==='image'?300:b.type==='divider'?16:160});b.layer=Math.max(-1,...doc().blocks.map((e,i)=>e.layer??i))+1;if(b.type==='textbox')b.textboxFill??='none'}
  function track(e,target,update,finish){e.preventDefault();e.stopPropagation();choose(Number(target.closest('[data-index]').dataset.index));target.setPointerCapture(e.pointerId);const startX=e.clientX,startY=e.clientY;const move=ev=>update(ev.clientX-startX,ev.clientY-startY);const end=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);finish?.();commit();sync()};target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end)}
  function decorate(box,b,i,handle){
    const isFree=free();
    if(isFree){
      placeFrame(box,b,i);handle.draggable=false;handle.title='拖动自由摆放；方向键微调';handle.setAttribute('aria-label','移动对象 '+(i+1));
      const startDrag=e=>{const frame={...b.frame},scale=getSurface().getBoundingClientRect().width/CANVAS_WIDTH;track(e,e.currentTarget,(dx,dy)=>{b.frame=boundedFrame({...frame,x:Math.round(frame.x+dx/scale),y:Math.round(frame.y+dy/scale)});placeFrame(box,b,i);updateSurface(getSurface(),doc())})};
      handle.addEventListener('pointerdown',startDrag);box.querySelector('.mag-image-frame')?.addEventListener('pointerdown',startDrag);
      handle.addEventListener('keydown',e=>{
        const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;
        e.preventDefault();choose(i);change(()=>{b.frame=boundedFrame({...b.frame,x:b.frame.x+d[0]*(e.shiftKey?10:1),y:b.frame.y+d[1]*(e.shiftKey?10:1)})});
      });
    }
    if(!isFree&&!['image','textbox','component','exhibition'].includes(b.type))return;
    const grip=document.createElement('button');grip.className='mag-resize';grip.type='button';grip.textContent=!isFree&&b.wrap==='right'?'↙':'↘';grip.setAttribute('aria-label','调整大小 '+(i+1));box.append(grip);
    grip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();choose(i);change(()=>{if(isFree){const key=e.key==='ArrowLeft'||e.key==='ArrowRight'?'width':'height';b.frame=boundedFrame({...b.frame,[key]:b.frame[key]+(['ArrowLeft','ArrowUp'].includes(e.key)?-5:5)})}else if(['ArrowLeft','ArrowRight'].includes(e.key))b.width=clamp((b.width||100)+(e.key==='ArrowRight'?5:-5),2,100);else{const key=b.type==='image'?'height':'boxHeight';b[key]=clamp((b[key]||box.getBoundingClientRect().height)+(e.key==='ArrowDown'?5:-5),24,4000)}})});
    grip.addEventListener('pointerdown',e=>{
      const frame=b.frame?{...b.frame}:null,surface=getSurface(),style=getComputedStyle(surface),total=surface.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),initial=box.getBoundingClientRect(),image=box.querySelector('.mag-image-frame'),startHeight=image?.getBoundingClientRect().height||initial.height,scale=isFree?surface.getBoundingClientRect().width/CANVAS_WIDTH:1;
      track(e,grip,(dx,dy)=>{
        if(isFree){b.frame=boundedFrame({...frame,width:clamp(Math.round(frame.width+dx/scale),16,CANVAS_WIDTH-frame.x),height:clamp(Math.round(frame.height+dy/scale),16,Math.min(8000,MAX_CANVAS_HEIGHT-frame.y))});placeFrame(box,b,i);updateSurface(surface,doc())}
        else{b.width=clamp(Math.round((initial.width+dx*(b.wrap==='right'?-1:1))/total*1000)/10,2,100);box.style.width=b.width+'%';if(Math.abs(dy)>1){const key=b.type==='image'?'height':'boxHeight';b[key]=clamp(Math.round(startHeight+dy),24,4000);if(image)image.style.height=b[key]+'px';else{box.style.height=b[key]+'px';box.dataset.fixed='true'}}}
      })
    });
  }
  return {sync,decorate,insertFrame};
}

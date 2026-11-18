// A fixed, scroll-free viewport. The source image never changes the stage geometry.
export function createPhotoViewer({dialog,onClose,onStep}){
  const $=s=>dialog.querySelector(s),stage=$('#work-stage'),zoom=$('#zoom-work');
  const ambience=document.createElement('div');ambience.className='work-ambience';ambience.setAttribute('aria-hidden','true');
  const backdrop=document.createElement('img');backdrop.className='work-backdrop';backdrop.alt='';ambience.append(backdrop);dialog.prepend(ambience);
  const controls=document.createElement('div');controls.className='work-zoom-controls';
  const minus=document.createElement('button'),plus=document.createElement('button'),meter=document.createElement('output');
  minus.type=plus.type='button';minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label','缩小照片');plus.setAttribute('aria-label','放大照片');meter.setAttribute('aria-label','照片缩放比例');controls.append(minus,meter,plus);zoom.before(controls);
  const notice=document.createElement('span');notice.className='work-load-status';notice.setAttribute('role','status');$('.dialog-top').insertBefore(notice,$('[data-close]'));
  stage.setAttribute('tabindex','0');stage.setAttribute('aria-label','摄影作品，可拖动放大后的画面');
  let photo=null,image=null,scale=1,x=0,y=0,fitW=0,fitH=0,lastFocus=null,originalRequested=false,revision=0;
  let oldOverflow='',oldPadding='',oldScrollBehavior='',scrollY=0;
  const pointers=new Map();let gesture=null,swipe=null;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function paint(){
    const maxX=Math.max(0,(fitW*scale-stage.clientWidth)/2),maxY=Math.max(0,(fitH*scale-stage.clientHeight)/2);
    x=clamp(x,-maxX,maxX);y=clamp(y,-maxY,maxY);
    if(image){image.style.width=fitW+'px';image.style.height=fitH+'px';image.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale})`}
    stage.classList.toggle('zoomed',scale>1.01);stage.dataset.scale=String(scale);meter.value=meter.textContent=Math.round(scale*100)+'%';
    minus.disabled=scale<=1;plus.disabled=scale>=8;zoom.textContent=scale>1.01?'适应画面':'查看原图';
  }
  function fit(){
    if(!photo||!dialog.open)return;
    const ratio=(photo.width||image?.naturalWidth||1)/(photo.height||image?.naturalHeight||1);
    fitW=Math.min(stage.clientWidth,stage.clientHeight*ratio);fitH=fitW/ratio;paint();
  }
  function original(){
    if(originalRequested||!photo||!image)return;originalRequested=true;
    const active=revision,loader=new Image();notice.textContent='正在载入原图…';
    loader.onload=()=>{if(active!==revision)return;image.src=photo.src;notice.textContent='';};
    loader.onerror=()=>{if(active!==revision)return;originalRequested=false;notice.textContent='原图暂未载入，仍可查看预览';};loader.src=photo.src;
  }
  function setZoom(next,clientX,clientY){
    next=clamp(next,1,8);const rect=stage.getBoundingClientRect();
    const cx=clientX===undefined?0:clientX-rect.left-rect.width/2,cy=clientY===undefined?0:clientY-rect.top-rect.height/2;
    const factor=next/scale;x=cx-(cx-x)*factor;y=cy-(cy-y)*factor;scale=next;if(scale>1.01)original();paint();
  }
  function lock(){
    scrollY=window.scrollY;const html=document.documentElement;
    oldOverflow=html.style.overflow;oldPadding=document.body.style.paddingRight;oldScrollBehavior=html.style.scrollBehavior;
    const gutter=innerWidth-html.clientWidth;html.style.overflow='hidden';html.style.scrollBehavior='auto';
    if(gutter)document.body.style.paddingRight=(parseFloat(getComputedStyle(document.body).paddingRight)+gutter)+'px';
    document.body.classList.add('modal-open');
  }
  function unlock(){
    const html=document.documentElement;html.style.overflow=oldOverflow;document.body.style.paddingRight=oldPadding;
    if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');
    window.scrollTo({top:scrollY,behavior:'instant'});html.style.scrollBehavior=oldScrollBehavior;
  }
  function close(){
    if(!dialog.open)return;revision++;dialog.close();unlock();photo=null;pointers.clear();gesture=swipe=null;
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  }
  function show(next,{index,total,focus}={}){
    if(!next){close();return}
    const opening=!dialog.open;
    if(opening){lastFocus=focus||document.activeElement;lock();dialog.showModal()}
    if(photo?.id!==next.id||opening){
      photo=next;revision++;scale=1;x=y=0;originalRequested=false;pointers.clear();gesture=swipe=null;notice.textContent='';
      backdrop.src=photo.small;image=document.createElement('img');image.alt=photo.description||photo.title;image.draggable=false;image.decoding='async';image.src=photo.large;
      image.onload=fit;image.onerror=()=>{if(image.getAttribute('src')!==photo.src){image.src=photo.src}else{notice.textContent='图片暂未载入，请关闭后重试。'}};
      stage.replaceChildren(image);fit();
    }
    $('#work-title').textContent=next.title;$('#work-description').textContent=next.description||'';
    $('#work-counter').textContent=`${index+1} / ${total}`;$('#prev-work').disabled=$('#next-work').disabled=total<2;
  }
  function resetGesture(){
    const values=[...pointers.values()];
    if(values.length===2){const [a,b]=values;gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),scale,x,y,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};swipe=null}
    else if(values.length===1)gesture={point:values[0],x,y};else gesture=null;
  }
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();stage.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1&&scale<=1.01)swipe={x:event.clientX,y:event.clientY};resetGesture();stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const values=[...pointers.values()];
    if(values.length===2&&gesture.distance){
      const [a,b]=values,rect=stage.getBoundingClientRect(),nextScale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance),1,8);
      const cx=gesture.cx-rect.left-rect.width/2,cy=gesture.cy-rect.top-rect.height/2;
      x=(a.x+b.x)/2-gesture.cx+cx-(cx-gesture.x)*nextScale/gesture.scale;
      y=(a.y+b.y)/2-gesture.cy+cy-(cy-gesture.y)*nextScale/gesture.scale;scale=nextScale;if(scale>1.01)original();paint();
    }else if(values.length===1&&gesture.point){x=gesture.x+event.clientX-gesture.point.x;y=gesture.y+event.clientY-gesture.point.y;paint()}
  });
  function release(event){
    if(!pointers.has(event.pointerId))return;const start=swipe;
    pointers.delete(event.pointerId);if(!pointers.size){stage.classList.remove('is-dragging');swipe=null}
    resetGesture();
    if(event.type==='pointerup'&&start&&scale<=1.01){const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)onStep(dx<0?1:-1)}
  }
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
  stage.addEventListener('wheel',event=>{event.preventDefault();setZoom(scale*Math.exp(-event.deltaY*.002),event.clientX,event.clientY)},{passive:false});
  stage.addEventListener('dblclick',event=>setZoom(scale>1.01?1:2.5,event.clientX,event.clientY));
  zoom.onclick=()=>setZoom(scale>1.01?1:2.5);minus.onclick=()=>setZoom(scale/1.4);plus.onclick=()=>setZoom(scale*1.4);
  $('#prev-work').onclick=()=>onStep(-1);$('#next-work').onclick=()=>onStep(1);
  $('[data-close]').onclick=onClose;dialog.addEventListener('cancel',event=>{event.preventDefault();onClose()});
  dialog.addEventListener('click',event=>{if(event.target===dialog)onClose()});
  dialog.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();if(scale<=1.01)onStep(event.key==='ArrowRight'?1:-1);else{x+=event.key==='ArrowRight'?-80:80;paint()}}
    if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(scale*1.4)}
    if(event.key==='-'){event.preventDefault();setZoom(scale/1.4)}
    if(event.key==='0'){event.preventDefault();setZoom(1)}
  });
  new ResizeObserver(fit).observe(stage);return {show,close};
}

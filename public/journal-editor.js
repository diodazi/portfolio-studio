const $=id=>document.getElementById(id),form=$('entry-form'),box=form.querySelector('fieldset');
let catalog,version,kind='games',selected=null,busy=false,dirty=false;
const extra={games:['platform','status','hours'],cinema:['director','year','rating']};
const fields=()=>['title','date','cover','note',...extra[kind]];
const games=()=>kind==='games';
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error)}
function lock(on){busy=on;box.disabled=on;$('kind').disabled=on;$('new-entry').disabled=on;document.querySelectorAll('.j-record').forEach(b=>b.disabled=on)}
function safeToLeave(){return !dirty||window.confirm('放弃此条记录未保存的修改？')}
function render(entry){
  selected=entry?.id||null;dirty=false;form.reset();
  const type=games()?'游戏':'观影';$('form-heading').textContent=(selected?'编辑':'添加')+type+'记录';
  $('title-label').textContent=games()?'游戏名称（必填）':'电影名称（必填）';$('date-label').textContent=games()?'游玩日期':'观看日期';$('note-label').textContent=games()?'游玩经历与感想':'观影短评';
  for(const [id,active] of [['game-fields',games()],['film-fields',!games()]]){
    $(id).hidden=!active;$(id).querySelectorAll('input,select').forEach(n=>n.disabled=!active);
  }
  for(const f of fields())$(f).value=entry?.[f]??'';
  $('remove').hidden=!selected;$('preview').href='./'+kind+'.html';$('preview').textContent=games()?'预览游戏履历 ↗':'预览观影片单 ↗';
  const list=$('saved-list');list.replaceChildren();
  for(const record of catalog[kind]){
    const b=document.createElement('button');b.type='button';b.className='j-record';b.textContent=record.title;if(selected===record.id)b.setAttribute('aria-current','true');
    b.addEventListener('click',()=>{if(safeToLeave()){render(record);message('');$('title').focus()}});list.append(b);
  }
  if(!list.children.length)list.textContent='暂无记录';
}
form.addEventListener('input',()=>{dirty=true});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
$('kind').addEventListener('change',()=>{if(!safeToLeave()){$('kind').value=kind;return}kind=$('kind').value;render(null);message('')});
$('new-entry').addEventListener('click',()=>{if(safeToLeave()){render(null);message('');$('title').focus()}});
async function persist(remove=false){
  if(busy||!catalog)return;
  const record={id:selected||crypto.randomUUID(),...Object.fromEntries(fields().map(k=>[k,$(k).value.trim()]))};
  if(!remove&&!record.title){message('请输入名称。',true);$('title').focus();return}
  if(remove&&!window.confirm('从当前网站删除《'+record.title+'》的记录？'))return;
  const next={...catalog,[kind]:remove?catalog[kind].filter(e=>e.id!==selected):selected?catalog[kind].map(e=>e.id===selected?record:e):[record,...catalog[kind]]};
  lock(true);message('正在保存…');
  try{const r=await fetch('./api/journal',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':version},body:JSON.stringify(next)});
    if(!r.ok)throw Error(r.status===409?'记录已在其他窗口更新。请先复制未保存的文字，刷新页面再编辑。':r.status===422?'内容格式有误，请检查日期、时长、年份或封面路径。':r.status===413?'记录内容过大，请缩短文字。':'保存失败，请确认本地预览服务正在运行。');
    version=r.headers.get('ETag');catalog=next;render(remove?null:record);message(remove?'已删除。':'已保存，可打开预览查看。');
  }catch(e){message(e.message,true)}finally{lock(false)}
}
form.addEventListener('submit',e=>{e.preventDefault();persist()});$('remove').addEventListener('click',()=>persist(true));
try{const res=await fetch('./api/journal',{cache:'no-store'});if(!res.ok)throw Error();catalog=await res.json();version=res.headers.get('ETag');if(!version||!Array.isArray(catalog.games)||!Array.isArray(catalog.cinema))throw Error();
  lock(false);render(null);message('');
}catch{message('无法读取记录。请通过本机预览服务打开工作台，再刷新此页。',true)}


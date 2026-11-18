const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
export function mountCoverSearch(parent,{kind,getTitle,getToken,onImport,runImport,source}){
  const root=el('section','cover-search');root.setAttribute('aria-label','在线查找封面');
  const head=el('div','cover-search-head');head.append(el('h3','','在线查找封面'),el('span','',kind==='games'?'Steam / Bangumi':'豆瓣 / IMDb'));root.append(head);
  const controls=el('div','cover-search-controls'),queryWrap=el('div'),providerWrap=el('div');
  const query=el('input');query.id='cover-query';query.maxLength=120;query.placeholder=kind==='games'?'输入游戏名称':'输入电影名称';query.value=getTitle();query.autocomplete='off';
  const label=el('label','field-label','搜索名称');label.htmlFor=query.id;queryWrap.append(label,query);
  const select=el('select');select.id='cover-provider';const options=kind==='games'?[['steam','Steam'],['bangumi','Bangumi']]:[['douban','豆瓣'],['imdb','IMDb']];
  for(const [value,name]of [['all','全部来源'],...options]){const o=el('option','',name);o.value=value;select.append(o)}
  const providerLabel=el('label','field-label','封面来源');providerLabel.htmlFor=select.id;providerWrap.append(providerLabel,select);
  const button=el('button','cover-search-button','查找封面');button.type='button';controls.append(queryWrap,providerWrap,button);root.append(controls);
  const hint=el('p','field-help','选用的封面会转存到素材库，随草稿保存，发布后展示。');
  const status=el('p','cover-search-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const sources=el('div','cover-source-status'),results=el('div','cover-results'),credit=el('p','cover-credit');
  root.append(hint,status,sources,results,credit);parent.append(root);
  let disposed=false,controller=null,selected=null,lastTitle=getTitle();
  function setSource(value){credit.replaceChildren();if(value){credit.append(document.createTextNode('已转存 · '+value.title+' · '));const a=el('a','','查看来源 ↗');a.href=value.url;a.target='_blank';a.rel='noopener noreferrer';credit.append(a)}}
  setSource(source);
  function say(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
  async function request(action,data,signal){
    const response=await fetch('/api/manage/covers/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':getToken()},body:JSON.stringify(data),signal});
    let result;try{result=await response.json()}catch{throw Error('本机服务未响应，请确认网站仍在运行。')}
    if(!response.ok)throw Error(result.error||'查询失败，请重试。');return result;
  }
  function render(items){
    results.replaceChildren();
    for(const item of items){
      const card=el('article','cover-candidate');const frame=el('div','cover-candidate-image');
      const image=el('img');image.src=item.preview;image.alt=item.title+'封面';image.loading='lazy';image.addEventListener('error',()=>{image.remove();frame.append(el('span','','预览暂不可用'))},{once:true});frame.append(image);
      const body=el('div','cover-candidate-body');body.append(el('small','',item.source+(item.year?' · '+item.year:'')),el('h4','',item.title));if(item.subtitle)body.append(el('p','',item.subtitle));
      const actions=el('div','cover-candidate-actions'),use=el('button','','转存并使用');use.type='button';use.setAttribute('aria-label','转存并使用 '+item.title+'（'+item.source+'）');
      const link=el('a','','来源 ↗');link.href=item.page;link.target='_blank';link.rel='noopener noreferrer';
      use.addEventListener('click',()=>runImport(async()=>{
        say('正在转存「'+item.title+'」…');
        try{
          const saved=await request('import',{id:item.id});if(disposed)return;
          onImport(saved);setSource(saved.coverSource);
          if(selected){selected.card.classList.remove('is-selected');selected.use.textContent='转存并使用'}
          selected={card,use};card.classList.add('is-selected');use.textContent='已选用';say('封面已转存到素材库，发布这条内容后对访客生效。');
        }catch(e){if(!disposed)say(e.message+' 当前封面未更改。',true)}
      }));
      actions.append(use,link);body.append(actions);card.append(frame,body);results.append(card);
    }
  }
  async function search(){
    const title=getTitle();if(!query.value.trim()||(title!==lastTitle&&query.value===lastTitle))query.value=title;lastTitle=title;
    if(!query.value.trim()){say('先输入游戏或电影名称。',true);query.focus();return}
    controller?.abort();controller=new AbortController();button.disabled=true;root.setAttribute('aria-busy','true');say('正在查询封面…');sources.replaceChildren();results.replaceChildren();selected=null;
    try{
      const data=await request('search',{kind,query:query.value.trim(),provider:select.value},controller.signal);if(disposed)return;
      for(const s of data.sources){const p=el('p',s.ok?'':'error',s.name+'：'+(s.ok?s.count+' 张封面':s.message));sources.append(p)}
      render(data.items);
      say(data.items.length?'找到 '+data.items.length+' 张封面，请核对名称'+(kind==='cinema'?'和年份':'')+'后选择。':data.sources.some(s=>s.ok)?'没有找到封面。试试原名、英文名或更短的关键词，也可手动上传。':'暂时无法连接这些来源，请重试或手动上传。',!data.items.length);
    }catch(e){if(!disposed&&e.name!=='AbortError')say(e.message,true)}
    finally{if(!disposed){button.disabled=false;root.removeAttribute('aria-busy')}}
  }
  button.addEventListener('click',search);query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!button.disabled)search()}});
  return {destroy(){disposed=true;controller?.abort()},clearSource(){setSource(null);if(selected){selected.card.classList.remove('is-selected');selected.use.textContent='转存并使用';selected=null}say('')}};
}

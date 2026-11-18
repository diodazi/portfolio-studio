import {magazineFor,renderMagazine,imagePath} from './magazine.js';
import {reviewType} from './game-review-model.js';
import {renderGameBook,renderShortReview} from './game-book-reader.js';
const params=new URLSearchParams(location.search),kind=params.get('kind')==='cinema'?'cinema':'games';
const back=document.querySelector('#library-back');back.href=kind==='games'?'./games.html':'./cinema.html';back.textContent=kind==='games'?'← 返回游戏库':'← 返回片库';
const root=document.querySelector('#article'),make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text||'';return e};
try{
 const res=await fetch('./journal.json',{cache:'no-cache'});if(!res.ok)throw Error();const data=await res.json(),entry=data[kind]?.find(e=>e.id===params.get('id'));
 if(!entry)document.querySelector('#article-status').textContent='这条记录不存在或已移除。请返回收藏查看其他作品。';
 else{
  document.title=entry.title+' — Portfolio';root.replaceChildren();
  if(kind==='games'){
   if(reviewType(entry)==='detailed'){root.className='game-book-page';root.append(renderGameBook(entry));back.href='./games.html#detailed'}
   else{root.className='magazine-page';root.append(renderShortReview(entry));back.href='./games.html#brief'}
  }else{
   const doc=magazineFor(entry);root.dataset.preset=doc.preset;const hero=make('header','magazine-hero'),intro=make('div','');intro.append(make('p','magazine-kicker','观影手记'),make('h1','',entry.title));intro.append(make('p','magazine-meta',[entry.year,entry.director,entry.rating?entry.rating+' / 5 星':'',entry.date].filter(Boolean).join(' · ')));hero.append(intro);
   if(imagePath(entry.cover)){const img=make('img','magazine-cover');img.src=entry.cover;img.alt=entry.title+' 封面';hero.append(img)}
   const body=make('article','magazine-body');body.setAttribute('aria-label',entry.title+'的经历与评价');renderMagazine(body,doc);root.append(hero,body);if(!doc.blocks.length)body.append(make('p','magazine-empty','这段经历，留待慢慢写下。'));
  }
  const end=make('a','magazine-back',back.textContent);end.href=back.href;root.append(end);
 }
}catch{root.replaceChildren(make('p','magazine-empty','暂时无法载入，请刷新重试。'))}

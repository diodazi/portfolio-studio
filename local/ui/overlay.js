const res=await fetch('/api/manage/bootstrap',{cache:'no-store'});
if(res.ok){
  const bar=document.createElement('div');bar.className='local-edit-bar';bar.append(document.createTextNode('本机编辑预览'));
  for(const [label,href] of [['内容管理','/manage/'],['退出编辑','/']]){const a=document.createElement('a');a.textContent=label;a.href=href;bar.append(a)}document.body.append(bar);
  const sections={top:[['首页文字','top']],photography:[['上传 / 编辑摄影','photographs']],stage:[['编辑现场项目','projects']],media:[['上传 / 编辑视频','videos'],['上传 / 编辑声音','audio']],games:[['编辑游戏评价','games']],cinema:[['编辑电影手记','cinema']],about:[['编辑个人介绍','about'],['撰写 / 编辑随笔','writing']],contact:[['编辑联系方式','contact']]};
  for(const [id,entries] of Object.entries(sections)){const section=document.getElementById(id);if(!section)continue;section.classList.add('local-edit-section');const controls=document.createElement('div');controls.className='local-section-controls';for(const [label,key]of entries){const a=document.createElement('a');a.href='/manage/?section='+key;a.textContent=label+' ↗';controls.append(a)}section.append(controls)}
}

const fields = [
  [
    "name",
    "top",
    "姓名",
    ".wordmark small",
    "站点作者",
    "text"
  ],
  [
    "siteTitle",
    "top",
    "网站标题",
    "title",
    "Portfolio Studio · 创作档案",
    "text"
  ],
  [
    "metaDescription",
    "top",
    "搜索摘要",
    "meta[name=\"description\"]",
    "支持摄影、视频、声音、游戏杂志、电影手记与随笔的个人网站框架。",
    "meta"
  ],
  [
    "heroIntro",
    "top",
    "首页小标题",
    ".intro-line",
    "摄影 · 影像 · 文字",
    "text"
  ],
  [
    "heroTitle",
    "top",
    "首页主标题",
    "#hero-heading",
    "记录，\n与创造。",
    "lines"
  ],
  [
    "heroDescription",
    "top",
    "首页介绍",
    ".hero-description",
    "在这里展示作品，\n记录创作与观察。",
    "lines"
  ],
  [
    "location",
    "top",
    "所在地英文",
    ".hero-bottom>span:first-child",
    "Your city",
    "text"
  ],
  [
    "archive",
    "top",
    "档案标注",
    ".hero-bottom>span:last-child",
    "Personal archive",
    "text"
  ],
  [
    "photoLabel",
    "photographs",
    "板块名称",
    "#photography .section-label",
    "摄影作品",
    "text"
  ],
  [
    "photoTitle",
    "photographs",
    "摄影标题",
    "#photography-heading",
    "把目光，\n留给画面。",
    "lines"
  ],
  [
    "photoIntro",
    "photographs",
    "摄影说明",
    "#photography .section-intro",
    "人、城市和舞台。\n每一次按下快门，都是一次观看。",
    "lines"
  ],
  [
    "stageLabel",
    "projects",
    "板块名称",
    "#stage .section-label",
    "项目档案",
    "text"
  ],
  [
    "stageTitle",
    "projects",
    "现场标题",
    "#stage-heading",
    "从想法，\n到现场。",
    "lines"
  ],
  [
    "stageIntro",
    "projects",
    "现场介绍",
    ".stage-intro>p:not(.section-label)",
    "记录项目过程，\n展示协作与实践。",
    "lines"
  ],
  [
    "stageCount",
    "projects",
    "参与场次",
    ".experience-note>strong",
    "0",
    "stat"
  ],
  [
    "stageCountLabel",
    "projects",
    "场次说明",
    ".experience-note>span",
    "已收录项目",
    "firstText"
  ],
  [
    "stageCountNote",
    "projects",
    "场次补充",
    ".experience-note small",
    "通过本地管理台添加项目",
    "text"
  ],
  [
    "stageFooter",
    "projects",
    "现场页脚",
    ".stage-footnote",
    "策划 / 创作 / 执行",
    "text"
  ],
  [
    "mediaTitle",
    "videos",
    "影像与声音标题",
    "#media-heading",
    "画面之外，\n还有回响。",
    "lines"
  ],
  [
    "mediaIntro",
    "videos",
    "影像与声音介绍",
    "#media .section-intro",
    "从创意、拍摄到后期。\n也让声音，成为表达的一部分。",
    "lines"
  ],
  [
    "videoLabel",
    "videos",
    "影像栏目名称",
    ".film-column>h3",
    "影像制作 ",
    "firstText"
  ],
  [
    "audioLabel",
    "audio",
    "声音栏目名称",
    ".audio-column>h3",
    "声音表达 ",
    "firstText"
  ],
  [
    "gamesTitle",
    "games",
    "入口标题",
    "#games-heading",
    "游戏评价",
    "text"
  ],
  [
    "gamesLink",
    "games",
    "入口链接文字",
    ".game-all-link .collection-link-label",
    "查看全部游戏",
    "text"
  ],
  [
    "cinemaTitle",
    "cinema",
    "入口标题",
    "#cinema-heading",
    "电影手记",
    "text"
  ],
  [
    "cinemaLink",
    "cinema",
    "入口链接文字",
    ".cinema-all-link .collection-link-label",
    "查看全部电影",
    "text"
  ],
  [
    "writingTitle",
    "writing",
    "随笔入口标题",
    ".writing-tile h3",
    "纸页之间。",
    "text"
  ],
  [
    "aboutLabel",
    "about",
    "板块名称",
    "#about .section-label",
    "关于作者",
    "text"
  ],
  [
    "aboutTitle",
    "about",
    "介绍标题",
    "#about-heading",
    "关于，\n创作的人。",
    "lines"
  ],
  [
    "aboutEnglish",
    "about",
    "英文介绍",
    ".about-en",
    "A personal creative archive.",
    "text"
  ],
  [
    "aboutLead",
    "about",
    "介绍导语",
    ".about-lead",
    "在这里介绍自己。",
    "lines"
  ],
  [
    "aboutBio",
    "about",
    "个人介绍",
    ".about-copy>p:nth-of-type(2)",
    "写下你的背景、关注的领域和创作方式。",
    "lines"
  ],
  [
    "aboutMore",
    "about",
    "能力与创作",
    ".about-copy>p:nth-of-type(3)",
    "可以从本地管理台编辑介绍、技能与联系方式。",
    "lines"
  ],
  [
    "skills",
    "about",
    "能力标签（每行一项）",
    ".about-skills",
    "摄影\n影像\n写作\n设计",
    "tags"
  ],
  [
    "portrait",
    "about",
    "个人照片",
    "#about-portrait",
    "",
    "image"
  ],
  [
    "resume",
    "about",
    "简历 PDF",
    ".about-copy>.text-link",
    "",
    "pdf"
  ],
  [
    "contactLabel",
    "contact",
    "合作说明",
    "#contact .section-label",
    "保持联系",
    "text"
  ],
  [
    "contactTitle",
    "contact",
    "联系标题",
    "#contact h2",
    "一起，创造。",
    "text"
  ],
  [
    "email",
    "contact",
    "联系邮箱",
    ".contact-links>a",
    "hello@example.com",
    "email"
  ],
  [
    "contactLocation",
    "contact",
    "地点与合作方式",
    ".contact-location",
    "通过本地管理台填写联系方式",
    "text"
  ]
];
export const SITE_FIELDS=Object.fromEntries(fields.map(([key,group,label,selector,value,type='text'])=>[key,{group,label,selector,value,type,max:type==='lines'?4000:600}]));
export const SITE_DEFAULTS=Object.fromEntries(Object.entries(SITE_FIELDS).map(([k,v])=>[k,v.value]));
export async function applySiteConfig(){
  let config;try{const res=await fetch('./site.json',{cache:'no-cache'});if(!res.ok)return;config=await res.json()}catch{return}
  for(const [key,f] of Object.entries(SITE_FIELDS)){
    const value=config[key];if(typeof value!=='string')continue;
    // Secondary pages keep their own page titles and metadata.
    if(!document.querySelector('#hero-heading')&&['siteTitle','metaDescription'].includes(key))continue;
    for(const target of document.querySelectorAll(f.selector)){
      if(f.type==='meta'){target.content=value;continue}
      if(f.type==='pdf'){target.hidden=!value;if(/^\.\/assets\/(?!.*\.\.)[^?#\\]+\.pdf$/iu.test(value))target.href=value;continue}
      if(f.type==='image'){target.hidden=!value;if(/^\.\/assets\/media\/(?!.*\.\.)[^?#\\]+\.(?:jpe?g|png|webp|avif)$/iu.test(value))target.src=value;continue}
      if(f.type==='email'){target.href='mailto:'+value;target.firstChild.textContent=value+' ';continue}
      if(f.type==='firstText'){if(target.firstChild?.nodeType===3)target.firstChild.textContent=value;continue}
      if(f.type==='stat'){target.textContent=value.replace(/\+$/,'');if(value.endsWith('+')){const s=document.createElement('span');s.textContent='+';target.append(s)}continue}
      if(f.type==='lines'||f.type==='tags'){target.replaceChildren();value.split('\n').forEach((line,i)=>{if(f.type==='tags'){const s=document.createElement('span');s.textContent=line;target.append(s)}else{if(i)target.append(document.createElement('br'));target.append(document.createTextNode(line))}});continue}
      target.textContent=value;
    }
  }
  const kind=document.body.dataset.kind;
  if(kind==='games'||kind==='cinema'){const h=document.querySelector('.shelf-headline h1');if(h)h.textContent=config[kind+'Title']||h.textContent}
  if(document.querySelector('#writing-heading')&&config.writingTitle)document.querySelector('#writing-heading').textContent=config.writingTitle;
}

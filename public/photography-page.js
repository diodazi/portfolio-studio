import {applySiteConfig} from './site-config.js';
import {normalizedEntry} from './storage.js';
import {mountPhotography} from './photo-experience.js';
applySiteConfig();
try{if(localStorage.getItem('portfolio-motion-paused')==='true')document.documentElement.dataset.motion='paused'}catch{}
try{
  const response=await fetch('./content.json',{cache:'no-cache',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('catalog');
  const data=await response.json();await mountPhotography({works:(data.photographs||[]).map(normalizedEntry).filter(p=>p.id&&p.src),archive:true});
}catch{document.querySelector('#collection-status').textContent='摄影作品暂未载入，请刷新重试。'}

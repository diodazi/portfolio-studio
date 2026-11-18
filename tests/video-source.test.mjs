import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBilibiliInput,bilibiliVideoSource} from '../public/video-source.js';
import {normalizedVideoEntry} from '../public/storage.js';
import {validateDocument} from '../local/manage-schema.mjs';

test('Bilibili links keep video and part but discard tracking parameters',()=>{
  assert.deepEqual(parseBilibiliInput(' BV1111111111 '),{bvid:'BV1111111111',page:1});
  assert.deepEqual(parseBilibiliInput('https://www.bilibili.com/video/BV2222222222/?p=2&spm_id_from=tracking&vd_source=tracking'),{bvid:'BV2222222222',page:2});
  for(const value of ['https://www.bilibili.com.evil.test/video/BV1111111111/','https://user@www.bilibili.com/video/BV1111111111/','javascript:alert(1)','<iframe src="x"></iframe>','https://www.bilibili.com/video/BV1111111111/?p=-1','https://www.bilibili.com/video/BV1111111111/?p=1.5','https://www.bilibili.com/video/BV1111111111/?p=1001','BVinvalid',null])assert.equal(parseBilibiliInput(value),null,String(value));
});

test('embed sources are built only on the official player and start without autoplay',()=>{
  const source=bilibiliVideoSource({provider:'bilibili',bvid:'BV1111111111',page:2,embed:'https://evil.test/'});
  const url=new URL(source.embed);
  assert.equal(url.origin,'https://player.bilibili.com');assert.equal(url.pathname,'/player.html');
  assert.equal(url.searchParams.get('autoplay'),'0');assert.equal(url.searchParams.get('p'),'2');
  assert.equal(source.original,'https://www.bilibili.com/video/BV1111111111/?p=2');
  for(const entry of [{provider:'arbitrary',bvid:'BV1111111111'},{provider:'bilibili',bvid:'BV1111111111&autoplay=1'},{provider:'bilibili',bvid:'BV1111111111',page:'1'},null])assert.equal(bilibiliVideoSource(entry),null);
});

test('local and Bilibili entries remain distinct through public normalization and manager validation',()=>{
  const local={id:'local',title:'Local video',src:'./assets/media/movie.mp4',description:''};
  const external={id:'bili',title:'Bilibili video',provider:'bilibili',bvid:'BV1111111111',page:1,poster:'./assets/media/cover.jpg'};
  const doc={photographs:[],videos:[local,external],audio:[],projects:[]};
  assert.equal(validateDocument('content',doc),true);
  assert.equal(normalizedVideoEntry(local).src,local.src);
  assert.ok(bilibiliVideoSource(normalizedVideoEntry(external)));
  assert.equal(normalizedVideoEntry({...external,src:'https://evil.test/video.mp4'}).src,'');
  assert.equal(normalizedVideoEntry({...local,provider:'unknown'}).src,'');
  assert.equal(normalizedVideoEntry({...external,poster:'javascript:alert(1)'}).poster,'');
  for(const invalid of [{...external,bvid:'bad'},{...external,page:0},{...external,src:local.src},{...local,provider:'unknown'},{...local,src:'https://outside.test/a.mp4'},{...external,poster:'https://outside.test/a.jpg'}]){
    assert.equal(validateDocument('content',{...doc,videos:[invalid]}),false,JSON.stringify(invalid));
  }
});

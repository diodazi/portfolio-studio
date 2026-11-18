import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {parsePostMetadata,parseBilibiliPost,rankMeme,compareMemes,imageFingerprint,duplicateImage,collectRecentMemes,validPostDate} from '../local/meme-ranking.mjs';
const now=Date.parse('2026-11-13T08:00:00Z'),day=86400000;
const post=(age,likes,url='https://www.bilibili.com/opus/123')=>`<script type="application/ld+json">${JSON.stringify({'@type':'SocialMediaPosting',url,datePublished:new Date(now-age*day).toISOString(),interactionStatistic:{'@type':'InteractionCounter',interactionType:'https://schema.org/LikeAction',userInteractionCount:likes}})}</script>`;
test('only verified publication dates and counters belonging to the matching post are used',()=>{
 const url='https://www.bilibili.com/opus/123',m=parsePostMetadata(post(3,100),url,now);assert.equal(m.metrics.likes,100);assert.equal(m.publishedAt,'2026-11-10T08:00:00.000Z');
 assert.equal(parsePostMetadata(post(3,999,'https://www.bilibili.com/opus/999'),url,now).publishedAt,null);
 assert.equal(parsePostMetadata('<meta property="article:modified_time" content="2026-11-12">',url,now).publishedAt,null);
 assert.equal(validPostDate('2027-01-01',now),null);assert.equal(validPostDate('yesterday',now),null);
 assert.equal(parseBilibiliPost({code:-352},'123',now),null);
 assert.equal(parseBilibiliPost({code:0,data:{item:{id_str:'123',modules:{module_author:{pub_ts:(now-day)/1000},module_stat:{like:{count:2},comment:{count:0}}}}}},'123',now).metrics.comments,0);
});
test('recency bands precede heat; heat orders within a band and unknown facts stay supplementary',()=>{
 const item=(age,likes)=>rankMeme({page:'p',image:'i',publishedAt:new Date(now-age*day).toISOString(),metrics:{likes}},now);
 const recent=item(2,2),hot=item(10,1000),old=item(500,1000000),unknown=rankMeme({page:'p',image:'i',publishedAt:null,metrics:{likes:99999999}},now);
 assert.deepEqual([old,recent,unknown,hot].sort(compareMemes).map(i=>i.bucket),['recent','recent','older','supplement']);assert.equal([recent,hot].sort(compareMemes)[0],hot);
 assert.equal(rankMeme({publishedAt:new Date(now-day).toISOString(),metrics:{}},now).bucket,'supplement');
});
test('content dedup removes re-encoded and resized images but retains different meme text',async()=>{
 const svg=t=>Buffer.from(`<svg width="600" height="400"><rect width="600" height="400" fill="#334c38"/><circle cx="160" cy="150" r="100" fill="#eee"/><text x="80" y="340" font-size="60" fill="white">${t}</text></svg>`);
 const a=await sharp(svg('MEME ONE')).png().toBuffer(),b=await sharp(a).resize(900,600).png().toBuffer(),c=await sharp(svg('MEME TWO')).png().toBuffer();
 assert.equal(duplicateImage(await imageFingerprint(a),await imageFingerprint(a)),true);assert.equal(duplicateImage(await imageFingerprint(a),await imageFingerprint(b)),true);assert.equal(duplicateImage(await imageFingerprint(a),await imageFingerprint(c)),false);
});
test('search expands through 30/90/180 days, replaces duplicates, fills 20 and preserves source facts',async()=>{
 const visits=[],items=Array.from({length:25},(_,i)=>({title:'Game 梗图',kind:'memes',source:'测试社区',provider:'bilibili',image:'https://i0.hdslb.com/'+i+'.png',page:'https://www.bilibili.com/opus/'+i}));
 const result=await collectRecentMemes({query:'Game',provider:'all',now:()=>now,indexSearch:async(k,q,p,{days})=>{visits.push(days);return days===30?items.slice(0,9):days===90?items.slice(0,15):items},read:async url=>{const n=Number(new URL(url).pathname.split('/').at(-1));return {bytes:Buffer.from(post(n<9?4:n<15?50:100,1000-n,url))}},download:async c=>({bytes:Buffer.from(c.image)}),fingerprint:async bytes=>({sha:bytes.toString().endsWith('/1.png')?'https://i0.hdslb.com/0.png':bytes.toString()})});
 assert.deepEqual(visits,[30,90,180]);assert.equal(result.items.length,20);assert.equal(new Set(result.items.map(c=>c.image)).size,20);assert.equal(result.summary.duplicates,1);assert.equal(result.summary.supplement,0);
});
test('unknown metadata remains separate; unavailable images do not consume result slots',async()=>{
 const result=await collectRecentMemes({query:'Game',provider:'all',now:()=>now,indexSearch:async()=>[0,1,2].map(i=>({title:'Game 梗图',source:'测试',provider:'bilibili',kind:'memes',page:'https://www.bilibili.com/opus/'+i,image:'https://i0.hdslb.com/'+i+'.png'})),read:async()=>{throw Error('restricted')},download:async c=>{if(c.image.endsWith('0.png'))throw Error('missing');return {bytes:Buffer.from(c.image)}},fingerprint:async b=>({sha:b.toString()})});
 assert.equal(result.items.length,2);assert.ok(result.items.every(c=>c.bucket==='supplement'));assert.equal(result.summary.unavailable,1);assert.deepEqual(result.summary.expanded,[30,90,180,365,0]);assert.equal(result.summary.issues.length,1);
});

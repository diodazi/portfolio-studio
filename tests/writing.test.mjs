import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeArticles} from '../public/writing.js';

test('article links resolve to one published record and drafts do not displace it',()=>{
  const articles=normalizeArticles([
    {id:'shared-id',title:'Private draft',published:false},
    {id:'shared-id',title:'Public essay',blocks:[{type:'paragraph',text:'Public text'}]},
    {id:'shared-id',title:'Accidental duplicate'},
    {id:'second',title:'Second essay'},
  ]);
  assert.deepEqual(articles.map(({id,title})=>({id,title})),[
    {id:'shared-id',title:'Public essay'},
    {id:'second',title:'Second essay'},
  ]);
});

test('HTML-looking author text stays literal data for the text-only renderer',()=>{
  const text='<img src=x onerror=alert(1)> & <script>bad()</script>';
  const [article]=normalizeArticles([{id:'literal-text',title:text,summary:text,blocks:[{type:'paragraph',text},{type:'quote',text}]}]);
  assert.equal(article.title,text);
  assert.equal(article.summary,text);
  assert.deepEqual(article.blocks.map(block=>block.text),[text,text]);
});

test('malformed or unsupported blocks cannot become executable rich content',()=>{
  const [article]=normalizeArticles([{id:'mixed',title:'Mixed content',blocks:[
    null,7,'raw string',{type:'html',text:'<iframe src="https://example.test"></iframe>'},
    {type:'paragraph',text:{html:'not text'}},{type:'heading',text:'A valid heading'},
    {type:'paragraph',text:'A valid paragraph'},{type:'quote',text:'A valid quotation'},
  ]}]);
  assert.deepEqual(article.blocks,[
    {type:'heading',text:'A valid heading'},
    {type:'paragraph',text:'A valid paragraph'},
    {type:'quote',text:'A valid quotation'},
  ]);
});

test('incomplete catalog data remains readable without a runtime failure',()=>{
  for(const input of [null,undefined,{},'invalid'])assert.deepEqual(normalizeArticles(input),[]);
  const articles=normalizeArticles([null,{}, {id:'',title:'No stable URL'},{id:'missing-title'},
    {id:'valid',title:'Plain paragraphs',paragraphs:['First',null,123,'Second']},
  ]);
  assert.equal(articles.length,1);
  assert.deepEqual(articles[0].blocks,[{type:'paragraph',text:'First'},{type:'paragraph',text:'Second'}]);
});

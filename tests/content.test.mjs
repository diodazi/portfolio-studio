import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{normalizedEntry,safeSource,mediaKind}from'../public/storage.js';
test('untrusted URLs cannot become executable media sources',()=>{for(const value of ['javascript:alert(1)','data:text/html,<script>bad</script>','file:///etc/passwd'])assert.equal(safeSource(value),'');assert.equal(safeSource('./assets/test.jpg'),'./assets/test.jpg');});
test('media metadata handles empty names and out-of-range crop',()=>{const item=normalizedEntry({id:12,title:'',position:200,category:'unknown',src:'https://example.test/a.jpg'});assert.equal(item.title,'未命名作品');assert.equal(item.position,100);assert.equal(item.category,'portrait');assert.equal(mediaKind('audio/wav'),'audio');});
test('top-edge crop and missing crop remain distinct',()=>{assert.equal(normalizedEntry({position:0}).position,0);assert.equal(normalizedEntry({}).position,50);assert.equal(normalizedEntry({position:'invalid'}).position,50);});
test('the framework example starts with empty content collections', async () => {
  const content = JSON.parse(await readFile(new URL('../public/content.example.json', import.meta.url)));
  for (const collection of ['projects', 'photographs', 'videos', 'audio']) {
    assert.deepEqual(content[collection], []);
  }
});

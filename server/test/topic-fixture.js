'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function topicFixture(dir,atlas,code,topic='test-topic'){
  const dest=path.join(dir,'topics',atlas);fs.mkdirSync(dest,{recursive:true});
  fs.writeFileSync(path.join(dest,topic+'.js'),code);
  let m={policy:'topic-delivery-v1',topics:{}};const p=path.join(dest,'manifest.json');
  if(fs.existsSync(p))m=JSON.parse(fs.readFileSync(p));
  m.topics[topic]={sha256:crypto.createHash('sha256').update(code).digest('hex'),bytes:Buffer.byteLength(code)};
  fs.writeFileSync(p,JSON.stringify(m));
}
module.exports={topicFixture};

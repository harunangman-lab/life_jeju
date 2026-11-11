'use strict';
window.jejuBookModel=(()=>{
  const uuid=()=>crypto.randomUUID();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const text=(value,max)=>typeof value==='string'&&value.length<=max;
  const id=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  function create(){return {id:uuid(),revision:0,meta:{title:'',subtitle:'',author:'',description:''},document:{version:1,sections:[{id:uuid(),kind:'intro',title:'들어가며',body:'',articles:[]},{id:uuid(),kind:'chapter',title:'첫 번째 장',body:'',articles:[]},{id:uuid(),kind:'outro',title:'마치며',body:'',articles:[]}]}};}
  function validate(book){
    if(!book||!id(book.id)||!Number.isSafeInteger(book.revision)||book.revision<0)throw Error('책 형식이 올바르지 않습니다.');
    const meta=book.meta,doc=book.document;
    if(!meta||!text(meta.title,200)||!text(meta.subtitle,300)||!text(meta.author,100)||!text(meta.description,4000))throw Error('책 정보의 형식이나 길이를 확인해 주세요.');
    if(!doc||doc.version!==1||!Array.isArray(doc.sections)||doc.sections.length<3||doc.sections[0].kind!=='intro'||doc.sections.at(-1).kind!=='outro'||doc.sections.slice(1,-1).some(s=>s.kind!=='chapter'))throw Error('들어가며·장·마치며 구성을 확인해 주세요.');
    const ids=new Set();
    for(const section of doc.sections){
      if(!id(section.id)||ids.has(section.id)||!text(section.title,200)||!text(section.body,100000)||!Array.isArray(section.articles))throw Error('장 형식이 올바르지 않습니다.');ids.add(section.id);
      for(const article of section.articles){
        if(!id(article.id)||ids.has(article.id)||!text(article.title,200)||!text(article.body,100000)||!text(article.sourceId,200)||!text(article.sourceDate,200)||!text(article.sourceType,20)||!text(article.place,200)||!Array.isArray(article.tags)||article.tags.length>20||article.tags.some(t=>!text(t,40)))throw Error('수록 글 형식이 올바르지 않습니다.');
        if(article.photoData!=null)window.jejuPhotos.validate(article.photoData);
        ids.add(article.id);
      }
    }
    if(new Blob([JSON.stringify(book)]).size>20*1024*1024)throw Error('사진 포함 원고 저장 용량은 20MB까지입니다. 책을 나누거나 사진 수를 줄여 주세요.');
    return clone(book);
  }
  function chapter(){return {id:uuid(),kind:'chapter',title:'새로운 장',body:'',articles:[]};}
  function article(){return {id:uuid(),sourceId:'',sourceDate:'',sourceType:'',title:'',body:'',place:'',tags:[]};}
  function snapshot(entry,photoData=null){
    return {id:uuid(),sourceId:entry.id,sourceDate:entry.date||entry.legacyDate||'',sourceType:entry.type||'',sourceUpdatedAt:entry.updatedAt||null,title:entry.title,body:entry.body,place:entry.place||'',tags:[...(entry.tags||[])],...(photoData?{photoData}: {})};
  }
  function stats(book){let count=0,characters=0;for(const s of book.document.sections){characters+=[...s.title,...s.body].length;for(const a of s.articles){count++;characters+=[...a.title,...a.body].length;}}return {count,characters};}
  function move(list,index,direction){const next=index+direction;if(index<0||next<0||next>=list.length)return false;[list[index],list[next]]=[list[next],list[index]];return true;}
  return {uuid,clone,create,chapter,article,validate,snapshot,stats,move};
})();

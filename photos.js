'use strict';
window.jejuPhotos=(()=>{
  const database='jeju-one-book.photos.v1',storeName='photos',cache=new Map();
  const maxDataLength=800000;
  let connection;
  function validId(id){return typeof id==='string'&&/^photo-[A-Za-z0-9-]{1,100}$/.test(id);}
  function validate(data){
    if(typeof data!=='string'||data.length>maxDataLength||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('사진 데이터 형식이 올바르지 않습니다.');
    return data;
  }
  function open(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(Error('이 브라우저에서는 사진을 보관할 수 없어요.'));return;}
      const request=indexedDB.open(database,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(storeName,{keyPath:'id'});
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
      request.onerror=()=>{connection=null;reject(Error('사진 저장소를 열지 못했어요. 브라우저 저장 설정을 확인해 주세요.'));};
      request.onblocked=()=>{connection=null;reject(Error('다른 창을 닫은 뒤 사진 첨부를 다시 시도해 주세요.'));};
    });
    return connection;
  }
  async function get(id){
    if(!validId(id))throw Error('사진 ID가 올바르지 않습니다.');
    if(cache.has(id))return cache.get(id);
    const db=await open();
    const data=await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).get(id);
      request.onsuccess=()=>resolve(request.result?.data||null);request.onerror=()=>reject(Error('사진을 읽지 못했어요.'));
    });
    if(!data)throw Error('저장된 사진을 찾지 못했어요.');
    validate(data);cache.set(id,data);return data;
  }
  async function preload(records){
    const ids=[...new Set(records.map(p=>p?.photoId).filter(Boolean))];
    const results=await Promise.allSettled(ids.map(get));
    return results.filter(r=>r.status==='rejected').length;
  }
  async function importMany(photos){
    const rows=Object.entries(photos).map(([original,data])=>({original,id:'photo-'+crypto.randomUUID(),data:validate(data)}));
    if(!rows.length)return {};
    const db=await open();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readwrite');
      for(const {id,data} of rows)tx.objectStore(storeName).put({id,data});
      tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('사진을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'));
    });
    for(const row of rows)cache.set(row.id,row.data);
    return Object.fromEntries(rows.map(row=>[row.original,row.id]));
  }
  async function saveFile(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WEBP 사진을 선택해 주세요.');
    if(file.size>20*1024*1024)throw Error('20MB 이하의 사진을 선택해 주세요.');
    const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>{throw Error('사진을 읽지 못했어요. 다른 JPG, PNG, WEBP 파일을 선택해 주세요.');});
    try{
      if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>64000000)throw Error('사진 해상도가 너무 큽니다. 크기를 줄인 사진을 선택해 주세요.');
      const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#fffefa';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      let quality=.82,data=canvas.toDataURL('image/jpeg',quality);
      while(data.length>maxDataLength&&quality>.3){quality-=.15;data=canvas.toDataURL('image/jpeg',quality);}
      if(data.length>maxDataLength)throw Error('사진 용량을 충분히 줄이지 못했어요. 크기를 줄인 사진을 선택해 주세요.');
      validate(data);const ids=await importMany({selected:data});return ids.selected;
    }finally{bitmap.close();}
  }
  function markup(id,className='entry-photo'){
    const data=cache.get(id);
    return data?`<img class="${className}" src="${data}" alt="이 기록에 선택한 한 장의 사진" loading="lazy" decoding="async">`:'';
  }
  document.addEventListener('error',event=>{
    if(event.target instanceof HTMLImageElement&&event.target.classList.contains('entry-photo'))event.target.remove();
  },true);
  return {validId,validate,get,preload,importMany,saveFile,markup};
})();

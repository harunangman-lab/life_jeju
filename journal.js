'use strict';
window.jejuJournal = (() => {
  const key='jeju-one-book.entries.v1';
  const draftKey='jeju-one-book.draft.v1';
  const photos=window.jejuPhotos;
  const photoInput=document.querySelector('#entry-photo-input');
  const photoPreview=document.querySelector('#entry-photo-preview');
  const photoStatus=document.querySelector('#entry-photo-status');
  let photoBusy=false,photoTask=0,photoWarning='';
  const migrationKey='jeju-one-book.entries.legacy-backup.v1';
  const types=['산책','독서','배움','일','일상'];
  const writer=document.querySelector('#write-dialog');
  const form=document.querySelector('#entry-form');
  const status=document.querySelector('#draft-status');
  const error=document.querySelector('#save-error');
  const importer=document.querySelector('#import-dialog');
  const actionDialog=document.querySelector('#journal-action-dialog');
  const fileInput=document.querySelector('#journal-import-file');
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let entries=[],rawSnapshot=null,readError='',draft=null,draftError='',draftDirty=false,editor=null,timer=null;
  let notify=()=>{},onChange=()=>{},showDetail=()=>{},initialized=false,pendingImport=null,pendingAction=null;
  let search='',filter='전체',listMessage='',listError=false;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function dateValue(value){
    if(validDate(value))return value;
    const match=typeof value==='string'&&value.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if(!match)return '';
    const result=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
    return validDate(result)?result:'';
  }
  const dateLabel=entry=>validDate(entry.date)?entry.date.replaceAll('-','. '):entry.legacyDate||entry.date||'날짜 확인 필요';
  function parseTags(value){
    const tags=Array.isArray(value)?value:String(value||'').split(/[,，\n]/);
    if(tags.some(t=>typeof t!=='string'))throw Error('태그는 글자로 입력해 주세요.');
    const cleaned=[...new Set(tags.map(t=>t.trim().replace(/^#+/,'')).filter(Boolean))];
    if(cleaned.length>20||cleaned.some(t=>t.length>40))throw Error('태그는 최대 20개, 태그당 40자까지 입력할 수 있어요.');
    return cleaned;
  }
  function normalize(value,{legacy=false}={}){
    if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.id!=='string'||!value.id||value.id.length>200||!types.includes(value.type)||typeof value.title!=='string'||!value.title.trim()||value.title.length>100||typeof value.body!=='string'||!value.body.trim()||value.body.length>20000)throw Error('기록 형식이나 제목·본문 길이가 올바르지 않습니다.');
    const date=dateValue(value.date);
    if(!date&&!legacy&&!(value.date===''&&typeof value.legacyDate==='string'&&value.legacyDate.length<=200))throw Error('기록 날짜는 유효한 YYYY-MM-DD 형식이어야 합니다.');
    if(value.place!==undefined&&(typeof value.place!=='string'||value.place.length>200))throw Error('장소는 200자 이하로 입력해 주세요.');
    if(value.tags!==undefined&&!Array.isArray(value.tags)&&typeof value.tags!=='string')throw Error('태그 형식이 올바르지 않습니다.');
    if(value.photoId!=null&&!photos.validId(value.photoId))throw Error('사진 참조 형식이 올바르지 않습니다.');
    const iso=field=>typeof value[field]==='string'&&!Number.isNaN(Date.parse(value[field]))?new Date(value[field]).toISOString():null;
    return {id:value.id,...(value.photoId?{photoId:value.photoId}:{}),type:value.type,date,title:value.title,body:value.body,place:value.place||'',tags:parseTags(value.tags||[]),createdAt:iso('createdAt'),updatedAt:iso('updatedAt'),...(!date?{legacyDate:String(value.legacyDate||value.date||'날짜 확인 필요')}: {})};
  }
  const sorted=list=>[...list].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  function normalizeList(list,legacy=false){
    if(!Array.isArray(list)||list.length>10000)throw Error('올바른 기록 배열이 아니거나 기록 수가 너무 많습니다.');
    const result=list.map(value=>normalize(value,{legacy}));
    if(new Set(result.map(e=>e.id)).size!==result.length)throw Error('파일 안에 같은 ID의 기록이 중복돼 있습니다.');
    return sorted(result);
  }
  function readEntries(){
    try{rawSnapshot=localStorage.getItem(key);entries=normalizeList(JSON.parse(rawSnapshot||'[]'),true);readError='';}
    catch{entries=[];readError='기존 기록을 안전하게 읽지 못했습니다. 원본을 덮어쓰지 않도록 저장·가져오기를 중단했어요. 브라우저 저장 설정과 기존 데이터를 확인해 주세요.';}
    return entries;
  }
  function publish(){entries=sorted(entries);onChange([...entries]);}
  function commit(next){
    if(readError)throw Error(readError);
    if(localStorage.getItem(key)!==rawSnapshot){readEntries();publish();throw Error('다른 창에서 기록이 바뀌었어요. 최근 기록을 불러왔습니다. 작성 중인 글을 보관하고 다시 확인해 주세요.');}
    const normalized=normalizeList(next,true);
    // Keep the original v1 storage before its first mutation; never migrate by dropping records.
    if(rawSnapshot&&localStorage.getItem(migrationKey)===null){
      const original=JSON.parse(rawSnapshot);
      if(original.some(e=>!Object.hasOwn(e,'place')||!Object.hasOwn(e,'tags')||!validDate(e.date)))localStorage.setItem(migrationKey,rawSnapshot);
    }
    const serialized=JSON.stringify(normalized);
    localStorage.setItem(key,serialized);
    rawSnapshot=serialized;entries=normalized;publish();
  }
  function readDraft(){
    try{
      const raw=localStorage.getItem(draftKey);
      if(!raw){draft=null;draftError='';return;}
      const value=JSON.parse(raw);
      if(!value||typeof value.title!=='string'||value.title.length>100||typeof value.body!=='string'||value.body.length>20000||!types.includes(value.type)||typeof value.place!=='string'||value.place.length>200||typeof value.tags!=='string'||value.tags.length>600||typeof value.date!=='string')throw Error('draft');
      if(value.photoId!=null&&!photos.validId(value.photoId))throw Error('draft photo');
      draft={photoId:value.photoId||null,editingId:typeof value.editingId==='string'?value.editingId:null,baseUpdatedAt:typeof value.baseUpdatedAt==='string'?value.baseUpdatedAt:null,type:value.type,date:value.date,title:value.title,body:value.body,place:value.place,tags:value.tags,savedAt:typeof value.savedAt==='string'?value.savedAt:null};draftError='';
    }catch{draft=null;draftError='임시 글을 읽지 못했어요. 기존 임시 데이터는 지우지 않았습니다.';}
  }
  function formValue(){
    return {...editor,type:form.elements.type.value,date:form.elements.date.value,title:form.elements.title.value,body:form.elements.body.value,place:form.elements.place.value,tags:form.elements.tags.value};
  }
  function flushDraft(){
    clearTimeout(timer);
    if(!editor||!draftDirty)return true;
    try{
      if(draftError)throw Error('draft');
      const value={...formValue(),savedAt:new Date().toISOString()};
      localStorage.setItem(draftKey,JSON.stringify(value));draft=value;draftDirty=false;
      status.textContent=`임시 저장됨 · ${new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value.savedAt))}`;
      return true;
    }catch{status.textContent='임시 저장 실패 · 글을 복사해 보관한 뒤 저장 공간을 확인해 주세요.';return false;}
  }
  function confirmAction({title,message,label,action}){
    document.querySelector('#journal-action-title').textContent=title;
    document.querySelector('#journal-action-message').textContent=message;
    document.querySelector('#journal-action-confirm').textContent=label;
    pendingAction=action;actionDialog.showModal();
  }
  function open({prompt='',type='일상',place='',entry=null}={}){
    if(writer.open)return;
    readDraft();
    if(draftError){notify(draftError);return;}
    let value={photoId:entry?.photoId||null,editingId:entry?.id||null,baseUpdatedAt:entry?.updatedAt||entry?.createdAt||null,type:entry?.type||type,date:entry?.date||today(),title:entry?.title||'',body:entry?.body||(prompt?prompt+'\n\n':''),place:entry?.place||place,tags:entry?.tags?.join(', ')||''};
    const contextual=Boolean(prompt||place||entry);
    let restored=false;
    if(draft){
      if(!contextual||(entry&&draft.editingId===entry.id)){value={...draft};restored=true;}
      else{
        confirmAction({title:'임시 글을 바꿀까요?',message:'저장하지 않은 임시 글이 있습니다. 선택한 글을 시작하면 현재 임시 글은 지워집니다. 취소하면 기존 임시 글을 유지합니다.',label:'임시 글 지우고 시작',action:()=>{
          try{localStorage.removeItem(draftKey);draft=null;open({prompt,type,place,entry});}catch{notify('임시 글을 정리하지 못했어요. 기존 글을 보관한 뒤 다시 시도해 주세요.');}
        }});return;
      }
    }
    if(value.editingId&&!entries.some(e=>e.id===value.editingId)){value.editingId=null;notify('원래 기록을 찾지 못해 임시 글을 새 기록으로 열었어요.');}
    editor={editingId:value.editingId,baseUpdatedAt:value.baseUpdatedAt,photoId:value.photoId||null};draftDirty=false;photoTask++;setPhotoBusy(false);photoInput.value='';photoStatus.textContent='';renderEditorPhoto();
    if(editor.photoId){const currentEditor=editor;photos.preload([editor]).then(()=>{if(editor===currentEditor)renderEditorPhoto();});}
    form.reset();
    for(const field of ['type','date','title','body','place','tags'])form.elements[field].value=value[field]||'';
    document.querySelector('#writer-title').textContent=value.editingId?'기록 다듬기':'오늘을 한 페이지로';
    document.querySelector('#entry-save').textContent=value.editingId?'수정 저장하기':'기록 저장하기';
    error.textContent='';status.textContent=restored?'임시 저장한 글을 이어서 쓰고 있어요.':'작성하면 이 브라우저에 자동으로 임시 저장합니다.';
    writer.showModal();
  }
  function save(event){
    event.preventDefault();error.textContent='';
    if(!editor)return;
    if(photoBusy){error.textContent='사진을 준비하고 있어요. 잠시 후 저장해 주세요.';return;}
    try{
      const value=formValue();
      if(!validDate(value.date))throw Error('올바른 날짜를 입력해 주세요.');
      const now=new Date().toISOString();
      const previous=value.editingId?entries.find(e=>e.id===value.editingId):null;
      if(value.editingId&&(!previous||(previous.updatedAt||previous.createdAt||null)!==value.baseUpdatedAt))throw Error('원래 기록이 삭제되거나 다른 창에서 변경됐어요. 작성 중인 글을 보관하고 최근 기록을 다시 확인해 주세요.');
      const record=normalize({photoId:value.photoId,id:previous?.id||(crypto.randomUUID?crypto.randomUUID():`record-${Date.now()}-${Math.random().toString(36).slice(2)}`),type:value.type,date:value.date,title:value.title.trim(),body:value.body.trim(),place:value.place.trim(),tags:parseTags(value.tags),createdAt:previous?.createdAt||now,updatedAt:now});
      commit(previous?entries.map(e=>e.id===previous.id?record:e):[record,...entries]);
      clearTimeout(timer);editor=null;draftDirty=false;
      try{localStorage.removeItem(draftKey);draft=null;}catch{notify('기록은 저장했지만 임시 글 정리에 실패했어요.');}
      writer.close();notify(previous?'기록을 수정했어요.':'오늘의 이야기를 저장했어요.');
    }catch(reason){error.textContent=reason?.name==='QuotaExceededError'?'저장 공간이 부족해 기록을 저장하지 못했어요. JSON 백업 후 불필요한 기록을 정리해 주세요.':reason?.message||'저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.';flushDraft();}
  }
  function card(item){
    const content=`<button class="entry-card" data-entry="${safe(item.id)}"><div class="entry-meta"><span>${safe(item.type)}</span><span>${safe(dateLabel(item))}</span>${item.sample?'<span class="sample-badge">예시 데이터</span>':''}</div><h3>${safe(item.title)}</h3>${photos.markup(item.photoId)}${item.place?`<p class="entry-place">${safe(item.place)}</p>`:''}<p>${safe(item.body)}</p>${item.tags?.length?`<div class="entry-tags">${item.tags.map(tag=>`<span>#${safe(tag)}</span>`).join('')}</div>`:''}</button>`;
    return item.sample?content:`<div class="entry-with-book">${content}<button type="button" class="text-button" data-book-entry="${safe(item.id)}">내 책에 추가 ↗</button></div>`;
  }
  function details(item){
    return `<p class="eyebrow">${safe(item.type)} · ${safe(dateLabel(item))}</p>${item.sample?'<span class="sample-badge">예시 데이터</span>':''}<h2>${safe(item.title)}</h2>${photos.markup(item.photoId)}${item.place?`<p class="entry-place">장소: ${safe(item.place)}</p>`:''}<p class="record-body">${safe(item.body)}</p>${item.tags?.length?`<div class="entry-tags">${item.tags.map(tag=>`<span>#${safe(tag)}</span>`).join('')}</div>`:''}${!item.sample?`<div class="dialog-actions"><button type="button" class="primary" data-book-entry="${safe(item.id)}">내 책에 추가</button><button class="outline" data-edit-entry="${safe(item.id)}">기록 수정</button><button class="danger-button" data-delete-entry="${safe(item.id)}">기록 삭제</button></div>`:''}`;
  }
  function renderList(samples=[]){
    const needle=search.toLocaleLowerCase();
    const visible=entries.filter(e=>(filter==='전체'||e.type===filter)&&(!needle||[e.title,e.body,e.place,...e.tags].join(' ').toLocaleLowerCase().includes(needle)));
    return `<div class="intro"><p class="eyebrow">COLLECT YOUR DAYS</p><h1>소중한 날들의 작은 조각</h1><p>잘 쓴 글보다, 내 마음이 담긴 글이면 충분해요.</p></div><div class="journal-toolbar"><button class="primary" data-write="">＋ 새 기록 쓰기</button>${draft?'<button class="outline" id="journal-resume">임시 글 이어쓰기</button>':''}<button class="outline" id="journal-export">JSON 백업</button><button class="outline" id="journal-import">백업 불러오기</button></div><p class="notice">이 기기에만 저장되는 체험 기록입니다. 같은 브라우저에서만 볼 수 있으며, 브라우저 데이터 삭제 시 사라집니다. 중요한 글은 JSON으로 백업해 주세요.</p><p class="caption">백업에는 저장한 기록만 포함됩니다. 임시 글은 먼저 기록으로 저장해 주세요. 사진도 백업에 포함됩니다. 불러올 JSON 파일은 100MB 이하로 선택해 주세요.</p>${readError?`<p class="journal-error" role="alert">${safe(readError)}</p>`:''}${draftError?`<p class="journal-error" role="alert">${safe(draftError)}</p>`:''}${photoWarning?`<p class="journal-error" role="status">${safe(photoWarning)}</p>`:''}${listMessage?`<p class="${listError?'journal-error':'notice'}" role="${listError?'alert':'status'}">${safe(listMessage)}</p>`:''}<form id="journal-search" class="search-form"><label for="journal-query">내 기록 검색</label><div><input id="journal-query" name="query" value="${safe(search)}" maxlength="200" type="search" placeholder="제목, 본문, 장소, 태그로 찾아보세요"><button class="primary" type="submit">검색</button></div></form><div class="filters" aria-label="기록 종류">${['전체',...types].map(type=>`<button class="chip ${filter===type?'active':''}" aria-pressed="${filter===type}" data-journal-filter="${safe(type)}">${safe(type)}</button>`).join('')}</div><div class="walk-result-bar"><p class="source-note" role="status">나의 기록 ${entries.length}편 중 ${visible.length}편 · 기록 날짜 최신순</p><button class="text-button" id="journal-reset">검색·필터 초기화</button></div><div class="entry-grid">${visible.length?visible.map(card).join(''):`<div class="empty walk-empty"><h2>${entries.length?'조건에 맞는 기록이 없어요':'아직 비어 있는 첫 페이지'}</h2><p>${entries.length?'다른 검색어나 기록 종류로 찾아보세요.':'오늘의 작은 발견을 첫 기록으로 남겨보세요.'}</p></div>`}</div>${samples.length?`<details class="sample-entries"><summary>어떤 글을 쓸지 궁금하다면 · 예시 기록 보기</summary><p class="caption">예시 기록은 내 기록 수·검색·백업·책 원고에 포함하지 않습니다.</p><div class="entry-grid">${samples.map(card).join('')}</div></details>`:''}`;
  }
  function showListMessage(text,isError=false){listMessage=text;listError=isError;publish();}
  async function exportBackup(){
    if(readError){showListMessage('기존 기록을 읽지 못해 일반 백업을 만들 수 없어요. 원본 저장 데이터를 먼저 확인해 주세요.',true);return;}
    try{
    const backupEntries=[...entries],imageData={};
    for(const id of new Set(backupEntries.map(e=>e.photoId).filter(Boolean)))imageData[id]=await photos.get(id);
    const payload={app:'jeju-one-book',version:3,exportedAt:new Date().toISOString(),entries:backupEntries,photos:imageData};
    if(new Blob([JSON.stringify(payload)]).size>100*1024*1024)throw Error('Backup exceeds size limit');
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`jeju-one-book-records-${today()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('저장한 기록의 JSON 백업 다운로드를 요청했어요.');
    }catch{showListMessage('사진을 포함한 백업을 만들지 못했습니다. 사진 저장소와 브라우저 저장 공간을 확인해 주세요. 백업 한도는 100MB입니다.',true);}
  }
  async function prepareImport(file){
    if(!file)return;
    try{
      if(readError)throw Error(readError);
      if(file.size>100*1024*1024)throw Error('100MB 이하의 JSON 백업 파일을 선택해 주세요.');
      const payload=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
      const legacy=Array.isArray(payload);
      if(!legacy&&(!payload||payload.app!=='jeju-one-book'||![1,2,3].includes(payload.version)))throw Error('제주 한 권의 JSON 백업 형식이 아닙니다.');
      const imported=normalizeList(legacy?payload:payload.entries,legacy||payload.version===1);
      const existing=new Set(entries.map(e=>e.id));
      const additions=imported.filter(e=>!existing.has(e.id));
      const imageData={};
      for(const id of new Set(imported.map(e=>e.photoId).filter(Boolean))){
        if(payload.version!==3||!payload.photos||!Object.hasOwn(payload.photos,id))throw Error('Missing backup photo');
        photos.validate(payload.photos[id]);
        if(additions.some(e=>e.photoId===id))imageData[id]=payload.photos[id];
      }
      pendingImport={additions,photos:imageData,skipped:imported.length-additions.length};
      document.querySelector('#import-summary').textContent=`총 ${imported.length}편 중 ${additions.length}편을 추가합니다. 같은 ID의 기존 기록 ${pendingImport.skipped}편은 덮어쓰지 않습니다.`;
      document.querySelector('#import-error').textContent='';document.querySelector('#import-confirm').disabled=additions.length===0;importer.showModal();
    }catch{pendingImport=null;showListMessage('백업을 읽지 못했습니다. 제주 한 권 JSON 형식·날짜·글 길이를 확인해 주세요. 기존 기록은 변경하지 않았습니다.',true);}
    finally{fileInput.value='';}
  }
  async function init(callbacks){
    if(initialized)return;
    initialized=true;({notify,onChange,showDetail}=callbacks);readEntries();readDraft();publish();
    const missing=await photos.preload([...entries,draft]);photoWarning=missing?'일부 사진을 불러오지 못했습니다. 글은 그대로 보관되어 있습니다. 사진을 삭제하거나 교체하기 전에 백업을 확인해 주세요.':'';publish();
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='entry-photo-add'){photoInput.click();return;}
    if(button.id==='entry-photo-remove'){if(editor&&!photoBusy){editor.photoId=null;photoInput.value='';photoStatus.textContent='사진을 제외했어요. 글만 저장할 수 있습니다.';renderEditorPhoto();scheduleDraft();flushDraft();}return;}
    if(button.dataset.editEntry){const entry=entries.find(e=>e.id===button.dataset.editEntry);if(entry){document.querySelector('#detail-dialog').close();open({entry});}}
    if(button.dataset.deleteEntry){
      const entry=entries.find(e=>e.id===button.dataset.deleteEntry);if(!entry)return;
      confirmAction({title:'기록을 삭제할까요?',message:`「${entry.title}」\n삭제 후에는 되돌릴 수 없습니다. 필요하면 먼저 JSON으로 백업해 주세요.`,label:'기록 삭제하기',action:()=>{
        try{commit(entries.filter(e=>e.id!==entry.id));document.querySelector('#detail-dialog').close();notify('기록을 삭제했어요.');}
        catch{showListMessage('삭제하지 못했습니다. 다른 창의 변경이나 저장 공간을 확인해 주세요.',true);notify('기록을 삭제하지 못했어요. 저장 설정과 최근 변경을 확인해 주세요.');}
      }});
    }
    if(button.id==='journal-action-cancel')actionDialog.close();
    if(button.id==='journal-action-confirm'&&pendingAction){const action=pendingAction;pendingAction=null;actionDialog.close();action();}
    if(button.dataset.journalFilter){search=document.querySelector('#journal-query')?.value.trim().slice(0,200)||'';filter=button.dataset.journalFilter;publish();document.querySelector(`[data-journal-filter="${filter}"]`).focus();}
    if(button.id==='journal-reset'){search='';filter='전체';publish();document.querySelector('#journal-query').focus();}
    if(button.id==='journal-resume')open();
    if(button.id==='journal-export')await exportBackup();
    if(button.id==='journal-import')fileInput.click();
    if(button.id==='import-cancel')importer.close();
    if(button.id==='import-confirm'&&pendingImport){
      try{const pending=pendingImport;const current=new Set(entries.map(e=>e.id));const additions=pending.additions.filter(e=>!current.has(e.id));const remap=await photos.importMany(pending.photos);commit([...entries,...additions.map(e=>e.photoId?{...e,photoId:remap[e.photoId]}:e)]);importer.close();pendingImport=null;search='';filter='전체';showListMessage(`${additions.length}편을 불러왔어요. 기존 기록은 유지했습니다.`);}
      catch{document.querySelector('#import-error').textContent='가져오기를 완료하지 못했어요. 기존 기록은 그대로입니다. 저장 공간이나 다른 창의 변경을 확인해 주세요.';}
    }
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='journal-search')return;
    event.preventDefault();search=String(new FormData(event.target).get('query')||'').trim().slice(0,200);publish();document.querySelector('#journal-query').focus();
  });
  function setPhotoBusy(busy){
    photoBusy=busy;
    for(const id of ['entry-photo-add','entry-photo-remove','entry-save'])document.querySelector('#'+id).disabled=busy;
  }
  function renderEditorPhoto(){
    const id=editor?.photoId;
    photoPreview.hidden=!id;
    photoPreview.innerHTML=id?(photos.markup(id,'entry-photo editor-photo')||'<p class="caption">기존 사진을 불러오지 못했어요. 글과 사진 참조는 유지됩니다.</p>'):'';
    document.querySelector('#entry-photo-remove').hidden=!id;
    document.querySelector('#entry-photo-add').textContent=id?'다른 사진 한 장으로 교체':'사진 한 장 추가 (선택)';
  }
  photoInput.addEventListener('change',async()=>{
    const file=photoInput.files?.[0];photoInput.value='';
    if(!file||!editor)return;
    const current=editor,task=++photoTask;setPhotoBusy(true);photoStatus.textContent='사진을 준비하고 있어요…';
    try{
      const id=await photos.saveFile(file);
      if(editor!==current||task!==photoTask||!writer.open)return;
      editor.photoId=id;renderEditorPhoto();scheduleDraft();flushDraft();photoStatus.textContent='이 글에 사진 한 장을 골랐어요. 사진은 이 브라우저에만 보관됩니다.';
    }catch(reason){if(editor===current&&task===photoTask)photoStatus.textContent=reason.message||'사진을 추가하지 못했어요. 기존 글과 사진은 유지됩니다.';}
    finally{if(task===photoTask)setPhotoBusy(false);}
  });
  form.addEventListener('submit',save);
  const scheduleDraft=()=>{if(!editor)return;draftDirty=true;status.textContent='임시 저장 중…';clearTimeout(timer);timer=setTimeout(flushDraft,400);};
  form.addEventListener('input',scheduleDraft);form.addEventListener('change',scheduleDraft);
  writer.addEventListener('close',()=>{flushDraft();editor=null;if(initialized)publish();});
  writer.addEventListener('cancel',event=>{if(!flushDraft())event.preventDefault();});
  document.querySelector('#write-dialog .dialog-close').addEventListener('click',event=>{
    if(flushDraft())return;
    event.stopPropagation();error.textContent='임시 저장에 실패해 작성 창을 유지했습니다. 글을 복사해 보관한 뒤 다시 시도해 주세요.';
  });
  window.addEventListener('pagehide',flushDraft);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushDraft();});
  window.addEventListener('storage',event=>{if(event.key===key){readEntries();publish();photos.preload(entries).then(publish);}if(event.key===draftKey&&!writer.open){readDraft();publish();}});
  fileInput.addEventListener('change',()=>prepareImport(fileInput.files[0]));
  importer.addEventListener('close',()=>{pendingImport=null;});
  actionDialog.addEventListener('close',()=>{pendingAction=null;});
  return {init,open,card,details,renderList};
})();

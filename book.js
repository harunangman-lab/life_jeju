'use strict';
window.jejuBook=(()=>{
  const M=window.jejuBookModel,cloud=window.jejuBookCloud;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let book=M.create(),scope='guest',token=null,dbPromise,initialized=false,loading=true,localDirty=false,cloudDirty=false,hasLocal=false;
  let serial=0,epoch=0,localSaving=null,cloudSaving=null,localTimer,cloudTimer,localError='',cloudError='',conflict=false,savedAt='',authMessage='',recovery=null;
  let onChange=()=>{},getEntries=()=>[],notify=()=>{},pendingAction=null,switching=Promise.resolve(),localBlocked=false;
  const unsavedScopes=new Map();
  const picker=()=>document.querySelector('#book-picker-dialog');
  function db(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open('jeju-one-book.manuscripts.v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'scope'});
      r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();dbPromise=null;};resolve(r.result);};r.onerror=()=>{dbPromise=null;reject(Error('이 기기 저장소를 열지 못했어요.'));};r.onblocked=()=>reject(Error('다른 창을 닫은 뒤 다시 열어 주세요.'));
    });return dbPromise;
  }
  async function readLocal(key){const database=await db();return new Promise((resolve,reject)=>{const r=database.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(Error('기기의 원고를 읽지 못했어요.'));});}
  async function writeLocal(key,expected,value){
    const database=await db();return new Promise((resolve,reject)=>{
      const tx=database.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.get(key);let nextToken,collision=false;
      r.onsuccess=()=>{if((r.result?.token||null)!==expected){collision=true;tx.abort();return;}nextToken=M.uuid();store.put({...value,scope:key,token:nextToken});};
      tx.oncomplete=()=>resolve(nextToken);tx.onabort=tx.onerror=()=>{const reason=Error(collision?'다른 창에서 원고가 바뀌었어요. 현재 글을 JSON으로 백업한 뒤 새로고침해 주세요.':'이 기기에 저장하지 못했어요. 원고를 JSON으로 백업하고 브라우저 저장 공간을 확인해 주세요.');reason.blocked=collision;reject(reason);};
    });
  }
  function setStatus(){
    const element=document.querySelector('#book-save-status'),stats=document.querySelector('#book-stats');
    if(element){element.textContent=localError||cloudError||(loading?'원고를 불러오는 중…':localDirty?'이 기기에 임시 저장 중…':scope==='guest'?savedAt?`이 기기에 임시 저장됨 · ${savedAt}`:hasLocal?'이 기기에 임시 저장된 원고입니다.':'작성하면 이 기기에 자동으로 임시 저장합니다.':cloudDirty?'이 기기에 보관됨 · 계정에 저장 중…':book.revision?`계정에 저장됨${savedAt?' · '+savedAt:''}`:'작성하면 계정에 자동 저장합니다.');element.classList.toggle('journal-error',Boolean(localError||cloudError));}
    if(stats){const value=M.stats(book);stats.textContent=`수록 글 ${value.count}편 · 원고 ${value.characters.toLocaleString('ko-KR')}자 (공백 포함)`;}
  }
  async function flushLocal(){
    clearTimeout(localTimer);if(localSaving)return localSaving;
    localSaving=(async()=>{
      try{
        if(localError)return false;
        while(localDirty){
          const version=serial,activeEpoch=epoch,key=scope,value={book:M.validate(book),cloudDirty,recovery};
          const next=await writeLocal(key,token,value);
          if(epoch!==activeEpoch)return true;
          token=next;hasLocal=true;if(serial===version)localDirty=false;
          savedAt=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());setStatus();
        }return true;
      }catch(reason){localBlocked=Boolean(reason.blocked);localError=reason.message||'이 기기에 저장하지 못했어요.';setStatus();return false;}
    })();try{return await localSaving;}finally{localSaving=null;}
  }
  async function syncCloud(){
    clearTimeout(cloudTimer);if(cloudSaving)return cloudSaving;
    if(scope==='guest'||loading||conflict||cloud.user?.id!==scope)return;
    cloudSaving=(async()=>{
      while(cloudDirty&&!conflict&&scope!=='guest'){
        const activeEpoch=epoch,owner=scope;if(!await flushLocal())return;
        if(epoch!==activeEpoch||cloud.user?.id!==owner)return;
        const snapshot=M.validate(book),version=serial;
        try{
          const revision=await cloud.save(owner,snapshot);
          if(epoch!==activeEpoch||book.id!==snapshot.id)return;
          book.revision=revision;cloudDirty=serial!==version;serial++;localDirty=true;cloudError='';
          await flushLocal();setStatus();
        }catch(reason){if(epoch===activeEpoch){cloudError=reason.message;conflict=Boolean(reason.conflict);setStatus();renderConnection();}return;}
      }
    })();try{await cloudSaving;}finally{cloudSaving=null;}
  }
  function changed(){serial++;localDirty=true;cloudDirty=true;if(!localBlocked)localError='';cloudError=conflict?cloudError:'';clearTimeout(localTimer);clearTimeout(cloudTimer);localTimer=setTimeout(flushLocal,400);cloudTimer=setTimeout(syncCloud,1400);setStatus();}
  function redraw(focusSelector){onChange();if(focusSelector)document.querySelector(focusSelector)?.focus();}
  async function loadScope(owner){
    const next=owner?.id||'guest';if(next===scope&&!loading){renderConnection();return;}
    if(localDirty&&!await flushLocal())unsavedScopes.set(scope,{book:M.clone(book),recovery,token,cloudDirty,localError,localBlocked});
    picker()?.close();document.querySelector('#book-action-dialog')?.close();pendingAction=null;
    epoch++;scope=next;token=null;book=M.create();recovery=null;serial=0;localError='';localBlocked=false;cloudError='';conflict=false;localDirty=false;cloudDirty=false;hasLocal=false;savedAt='';loading=true;redraw();
    try{const local=await readLocal(scope);if(local){book=M.validate(local.book);token=local.token;cloudDirty=Boolean(local.cloudDirty);recovery=local.recovery||null;hasLocal=true;}}
    catch{localBlocked=true;localError='기존 원고를 읽지 못해 덮어쓰기를 중단했습니다. 브라우저 데이터를 삭제하지 말고 저장 설정을 확인해 주세요.';}
    if(unsavedScopes.has(scope)){const held=unsavedScopes.get(scope);({book,recovery,token,cloudDirty,localError,localBlocked}=held);localDirty=true;unsavedScopes.delete(scope);}
    if(owner&&!localError){
      try{
        const remote=await cloud.load(owner.id);
        if(remote){const valid=M.validate(remote);if(cloudDirty){if(book.id!==valid.id||book.revision!==valid.revision){conflict=true;cloudError='계정의 원고가 다른 기기에서 바뀌었습니다. 이 기기 원고를 유지하고 계정 저장을 멈췄어요.';}}else{book=valid;localDirty=true;}}
        else if(book.revision>0){conflict=true;cloudError='계정 원고를 찾지 못했어요. 이 기기의 원고는 유지합니다.';}
      }catch(reason){cloudError=reason.message;conflict=true;}
    }
    loading=false;redraw();setStatus();if(localDirty)await flushLocal();if(cloudSaving)await cloudSaving;if(cloudDirty&&!conflict)syncCloud();
  }
  async function init(callbacks){
    if(initialized)return;initialized=true;({onChange,getEntries,notify}=callbacks);
    await loadScope(null);cloud.init(user=>{if((user?.id||'guest')!==scope){loading=true;redraw();}switching=switching.then(()=>loadScope(user)).catch(()=>{authMessage='계정 변경을 처리하지 못했습니다. 원고를 백업한 뒤 다시 열어 주세요.';renderConnection();});});
  }
  function connection(){
    if(!cloud.configured())return '<p class="notice">현재 이 기기에 원고를 보관합니다. 계정 저장은 연결 준비 중입니다.</p>';
    if(cloud.user&&cloud.user.id===scope)return `<div class="book-account"><p>${safe(cloud.user.email||'내 계정')} · 이 계정의 책과 원고만 저장합니다.</p><div class="dialog-actions"><button class="outline" type="button" id="book-cloud-retry">계정 저장 다시 시도</button><button class="outline" type="button" id="book-cloud-reload">계정 원고 다시 불러오기</button><button class="outline" type="button" id="book-copy-device">이 기기 원고를 계정으로 복사</button><button class="text-button" type="button" id="book-logout">로그아웃</button></div></div>${authMessage?`<p role="status">${safe(authMessage)}</p>`:''}`;
    return `<details class="book-account"><summary>내 계정에 책 저장하기</summary><p>이메일로 로그인하면 책과 원고 복사본을 내 계정에 저장합니다. 기존 ‘내 기록’은 이 브라우저에 남습니다.</p><form id="book-auth-form"><label for="book-email">이메일</label><input id="book-email" name="email" type="email" autocomplete="email" required><label for="book-password">비밀번호</label><input id="book-password" name="password" type="password" autocomplete="current-password" minlength="8" required><div class="dialog-actions"><button class="primary" type="submit">로그인</button><button class="outline" id="book-signup" type="submit">회원가입</button></div></form><p role="status">${safe(authMessage||cloud.problem)}</p></details>`;
  }
  function renderConnection(){const el=document.querySelector('#book-connection');if(el)el.innerHTML=connection();}
  function arrows(kind,section,article,index,length){return `<div class="manuscript-order"><button type="button" class="outline small" data-book-move="${kind}" data-section="${section}" ${article?`data-article="${article}"`:''} data-direction="-1" ${index===0?'disabled':''} aria-label="${kind==='section'?'장':'글'} 위로 이동">↑ 위로</button><button type="button" class="outline small" data-book-move="${kind}" data-section="${section}" ${article?`data-article="${article}"`:''} data-direction="1" ${index===length-1?'disabled':''} aria-label="${kind==='section'?'장':'글'} 아래로 이동">↓ 아래로</button></div>`;}
  function articleMarkup(section,article,index){return `<article class="manuscript-article"><div class="manuscript-item-head"><p class="caption">${index+1}번째 꼭지 · ${article.sourceId?`${safe(article.sourceType)} 기록의 복사본 · ${safe(article.sourceDate)}`:'직접 쓰는 원고'}</p>${arrows('article',section.id,article.id,index,section.articles.length)}</div><label for="article-title-${article.id}">꼭지 제목</label><input id="article-title-${article.id}" data-book-field="title" data-section="${section.id}" data-article="${article.id}" value="${safe(article.title)}" maxlength="200">${article.photoData?`<img class="entry-photo" src="${safe(article.photoData)}" alt="원고에 복사한 사진 한 장" loading="lazy">`:''}<label for="article-body-${article.id}">꼭지 본문</label><textarea id="article-body-${article.id}" data-book-field="body" data-section="${section.id}" data-article="${article.id}" rows="7" maxlength="100000">${safe(article.body)}</textarea><div class="manuscript-item-foot"><label>옮길 장 <select data-book-transfer="${article.id}" data-section="${section.id}">${book.document.sections.map(s=>`<option value="${s.id}" ${s.id===section.id?'selected':''}>${safe(s.title||'제목 없는 장')}</option>`).join('')}</select></label><button class="text-button" type="button" data-book-remove-article="${article.id}" data-section="${section.id}">원고에서 빼기</button></div></article>`;}
  function sectionMarkup(section){const chapters=book.document.sections.filter(s=>s.kind==='chapter'),index=chapters.findIndex(s=>s.id===section.id);return `<section class="manuscript-section" id="section-${section.id}"><div class="manuscript-item-head"><h2>${section.kind==='intro'?'들어가며':section.kind==='outro'?'마치며':`${index+1}장`}</h2>${section.kind==='chapter'?arrows('section',section.id,null,index,chapters.length):''}</div><label for="section-title-${section.id}">장 제목</label><input id="section-title-${section.id}" data-book-field="title" data-section="${section.id}" value="${safe(section.title)}" maxlength="200"><label for="section-body-${section.id}">${section.kind==='chapter'?'장을 여는 글':'본문'}</label><textarea id="section-body-${section.id}" data-book-field="body" data-section="${section.id}" rows="4" maxlength="100000">${safe(section.body)}</textarea>${section.articles.map((a,i)=>articleMarkup(section,a,i)).join('')}<div class="dialog-actions"><button class="primary" type="button" data-book-add-article="${section.id}">＋ 꼭지 추가</button><button class="outline" type="button" data-book-pick="${section.id}">내 기록에서 글 고르기</button>${section.kind==='chapter'?`<button class="text-button" type="button" data-book-remove-section="${section.id}">이 장 삭제</button>`:''}</div></section>`;}
  function render(){
    if(loading||(cloud.user?.id||'guest')!==scope)return '<div class="intro"><h1>내 책</h1><p role="status">원고를 불러오는 중…</p></div>';
    return `<div class="intro"><p class="eyebrow">MY OWN MANUSCRIPT</p><h1>나의 사계절이, 한 권으로</h1><p>기록을 골라 나만의 순서로 엮어보세요. 원고를 고쳐도 원본 기록은 바뀌지 않습니다.</p></div><div id="book-connection">${connection()}</div><div class="book-metadata"><div><label for="book-title">책 제목</label><input id="book-title" data-book-meta="title" value="${safe(book.meta.title)}" maxlength="200" placeholder="내 책의 제목"></div><div><label for="book-subtitle">부제</label><input id="book-subtitle" data-book-meta="subtitle" value="${safe(book.meta.subtitle)}" maxlength="300"></div><div><label for="book-author">저자명</label><input id="book-author" data-book-meta="author" value="${safe(book.meta.author)}" maxlength="100"></div><div class="book-description"><label for="book-description">책 소개</label><textarea id="book-description" data-book-meta="description" rows="3" maxlength="4000">${safe(book.meta.description)}</textarea></div></div><p id="book-save-status" class="draft-status" role="status" aria-live="polite"></p><div class="manuscript-toolbar"><p id="book-stats"></p><button class="primary" type="button" id="book-add-chapter">＋ 장 추가</button><button class="outline" type="button" id="book-export">원고 JSON 백업</button>${recovery?'<button class="outline" type="button" id="book-restore-recovery">이 기기 복구본 열기</button>':''}</div><p class="caption">글자 수는 장 제목·본문·수록 글 기준이며 공백을 포함합니다. 각 장에서 꼭지를 필요한 만큼 추가하세요. 장·꼭지 개수 제한 없이 글과 사진을 합쳐 20MB까지 보관할 수 있어요. 원본을 삭제해도 원고 복사본은 남습니다.</p>${loading?'<p>원고를 불러오는 중…</p>':book.document.sections.map(sectionMarkup).join('')}<div class="dialog-actions"><button type="button" class="primary" data-book-add-chapter>＋ 다음 장 추가</button></div>`;
  }
  function confirm(title,message,action){pendingAction=action;document.querySelector('#book-action-title').textContent=title;document.querySelector('#book-action-message').textContent=message;document.querySelector('#book-action-dialog').showModal();}
  function exportBook(){const data={app:'jeju-one-book-manuscript',version:1,exportedAt:new Date().toISOString(),book:M.validate(book)};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jeju-one-book-manuscript.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function openPicker(sectionId){
    const entries=getEntries().filter(e=>!e.sample),selected=book.document.sections.find(s=>s.id===sectionId)||book.document.sections[1];
    document.querySelector('#book-pick-target').innerHTML=book.document.sections.map(s=>`<option value="${s.id}" ${s.id===selected.id?'selected':''}>${safe(s.title||'제목 없는 장')}</option>`).join('');
    document.querySelector('#book-pick-list').innerHTML=entries.length?entries.map((e,index)=>`<label class="book-pick-item"><input type="checkbox" name="source" value="${index}"><span><strong>${safe(e.title)}</strong><small>${safe(e.type)} · ${safe(e.date||e.legacyDate||'')}</small><span>${safe(e.body.slice(0,100))}</span></span></label>`).join(''):'<p>아직 내 기록이 없습니다. 먼저 기록을 작성해 주세요.</p>';
    picker().sources=entries.map(M.clone);document.querySelector('#book-pick-error').textContent='';picker().showModal();
  }
  async function copySelected(){
    const activeEpoch=epoch;
    const selected=[...document.querySelectorAll('#book-pick-list input:checked')].map(el=>picker().sources[Number(el.value)]),section=book.document.sections.find(s=>s.id===document.querySelector('#book-pick-target').value),button=document.querySelector('#book-pick-confirm');
    if(!selected.length||!section){document.querySelector('#book-pick-error').textContent='넣을 글과 장을 선택해 주세요.';return;}
    button.disabled=true;
    try{const copies=[];for(const entry of selected)copies.push(M.snapshot(entry,entry.photoId?await window.jejuPhotos.get(entry.photoId):null));if(epoch!==activeEpoch||loading)return;const candidate=M.clone(book);candidate.document.sections.find(s=>s.id===section.id).articles.push(...copies);book=M.validate(candidate);changed();await flushLocal();picker().close();redraw();setStatus();notify(`${copies.length}편을 원고에 복사했어요.`);}
    catch(reason){document.querySelector('#book-pick-error').textContent=reason.message||'글과 사진을 복사하지 못했습니다. 원본은 그대로입니다.';}finally{button.disabled=false;}
  }
  document.addEventListener('input',event=>{
    const el=event.target;if(loading)return;
    if(el.dataset.bookMeta){book.meta[el.dataset.bookMeta]=el.value;changed();}
    if(el.dataset.bookField){const section=book.document.sections.find(s=>s.id===el.dataset.section),target=el.dataset.article?section?.articles.find(a=>a.id===el.dataset.article):section;if(target){target[el.dataset.bookField]=el.value;changed();}}
  });
  document.addEventListener('change',event=>{
    const el=event.target;if(!el.dataset.bookTransfer)return;const from=book.document.sections.find(s=>s.id===el.dataset.section),to=book.document.sections.find(s=>s.id===el.value);if(!from||!to||from===to)return;const index=from.articles.findIndex(a=>a.id===el.dataset.bookTransfer);if(index<0)return;to.articles.push(from.articles.splice(index,1)[0]);changed();redraw();setStatus();
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='book-auth-form')return;event.preventDefault();const form=event.target,button=event.submitter||form.querySelector('button[type="submit"]');button.disabled=true;
    try{authMessage=await cloud.login(form.elements.email.value.trim(),form.elements.password.value,button.id==='book-signup');form.elements.password.value='';}catch(reason){authMessage=reason.message;}finally{button.disabled=false;renderConnection();}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.id==='book-pick-cancel'){picker().close();return;}
      if(button.id==='book-pick-confirm'){await copySelected();return;}
      if(button.id==='book-action-cancel'){document.querySelector('#book-action-dialog').close();return;}
      if(button.id==='book-action-confirm'&&pendingAction){const action=pendingAction;pendingAction=null;document.querySelector('#book-action-dialog').close();await action();return;}
      if(button.id==='book-export'){exportBook();return;}
      if(button.id==='book-logout'){if(!await flushLocal())throw Error('먼저 원고를 JSON으로 백업하고 기기 저장 문제를 해결해 주세요.');await syncCloud();await cloud.logout();return;}
      if(button.id==='book-cloud-retry'){if(conflict){notify('계정 원고를 다시 불러오거나 현재 원고를 먼저 백업해 주세요.');return;}cloudError='';await syncCloud();return;}
      if(button.id==='book-cloud-reload'){confirm('계정 원고를 다시 불러올까요?','현재 이 기기 원고는 복구본으로 보관합니다.',async()=>{const remote=await cloud.load(scope);recovery=M.clone(book);book=remote?M.validate(remote):M.create();cloudDirty=false;conflict=false;cloudError='';serial++;localDirty=true;await flushLocal();redraw();setStatus();});return;}
      if(button.id==='book-copy-device'){confirm('이 기기 원고를 계정으로 복사할까요?','이 브라우저에서 로그인 없이 작성한 원고를 새 책으로 복사합니다. 기존 계정 책은 덮어쓰지 않습니다.',async()=>{const guest=await readLocal('guest');if(!guest)throw Error('로그인 없이 작성한 원고가 없습니다.');recovery=M.clone(book);book=M.validate(guest.book);book.id=M.uuid();book.revision=0;conflict=false;cloudError='';changed();redraw();setStatus();});return;}
      if(button.id==='book-restore-recovery'&&recovery){confirm('복구본을 새 책으로 열까요?','현재 원고를 복구본으로 보관하고 이전 원고를 새 책으로 엽니다.',()=>{const previous=M.clone(book);book=M.validate(recovery);book.id=M.uuid();book.revision=0;recovery=previous;conflict=false;cloudError='';changed();redraw();setStatus();});return;}
      if(loading)return;
      if(button.id==='book-add-chapter'||button.hasAttribute('data-book-add-chapter')){const candidate=M.clone(book),section=M.chapter();candidate.document.sections.splice(-1,0,section);book=M.validate(candidate);changed();redraw(`#section-title-${section.id}`);setStatus();}
      if(button.dataset.bookAddArticle){const candidate=M.clone(book),section=candidate.document.sections.find(s=>s.id===button.dataset.bookAddArticle);if(!section)return;const article=M.article();section.articles.push(article);book=M.validate(candidate);changed();redraw(`#article-title-${article.id}`);setStatus();}
      if(button.dataset.bookPick)openPicker(button.dataset.bookPick);
      if(button.dataset.bookMove){const section=book.document.sections.find(s=>s.id===button.dataset.section),direction=Number(button.dataset.direction);if(![-1,1].includes(direction))return;if(button.dataset.bookMove==='article'){const index=section.articles.findIndex(a=>a.id===button.dataset.article);M.move(section.articles,index,direction);}else{const chapters=book.document.sections.filter(s=>s.kind==='chapter');M.move(chapters,chapters.findIndex(s=>s.id===section.id),direction);book.document.sections=[book.document.sections[0],...chapters,book.document.sections.at(-1)];}changed();redraw();setStatus();}
      if(button.dataset.bookRemoveArticle)confirm('이 글을 원고에서 뺄까요?','원본 기록은 그대로 남습니다.',()=>{const section=book.document.sections.find(s=>s.id===button.dataset.section);section.articles=section.articles.filter(a=>a.id!==button.dataset.bookRemoveArticle);changed();redraw();setStatus();});
      if(button.dataset.bookRemoveSection)confirm('이 장을 삭제할까요?','이 장의 원고 복사본도 함께 빠집니다. 원본 기록은 그대로 남습니다.',()=>{if(book.document.sections.filter(s=>s.kind==='chapter').length===1)throw Error('장은 최소 한 개 남겨 주세요.');book.document.sections=book.document.sections.filter(s=>s.id!==button.dataset.bookRemoveSection);changed();redraw();setStatus();});
    }catch(reason){notify(reason.message||'처리하지 못했어요. 원고는 유지됩니다.');}
  });
  window.addEventListener('pagehide',()=>{flushLocal();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushLocal();});
  return {init,render,refreshStatus:setStatus,flush:flushLocal};
})();

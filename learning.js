'use strict';
window.jejuLearning=(()=>{
  const topics=['글쓰기','독서','자연관찰','사진','공예','디지털 활용'];
  const days=['월','화','수','목','금','토','일'];
  const key='jeju-one-book.saved-programs.v1';
  const unknown='정보 확인 필요';
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot=null,programs=[],saved=new Set(),storageError='',dataError='',activeId=null;
  let onChange=()=>{},notify=()=>{};
  const state={query:'',region:'전체',topic:'전체',weekday:'전체',cost:'전체',source:'actual',onlySaved:false};
  function link(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!/[?&](?:serviceKey|apiKey)=/i.test(url.search)?url.href:'';}catch{return '';}}
  function date(value,withTime=false){
    if(!value||Number.isNaN(Date.parse(value)))return unknown;
    return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(value));
  }
  function range(start,end,withTime=false){return start||end?`${date(start,withTime)} ~ ${date(end,withTime)}`:unknown;}
  const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  function fee(p){
    const tuition=amount(p.tuition),materials=amount(p.materials);
    return `${tuition===null?'수강료 확인 필요':tuition===0?'수강료 무료':`수강료 ${tuition.toLocaleString('ko-KR')}원`}${materials===null?' · 재료비 확인 필요':materials>0?` · 재료비 ${materials.toLocaleString('ko-KR')}원`:' · 재료비 0원(자료 기준)'}`;
  }
  function application(p,now=Date.now()){
    if(p.sample)return {label:'예시 · 신청 불가',canApply:false};
    if(p.sourceState==='COS100')return {label:'교육 취소(수집 기준)',canApply:false};
    const start=Date.parse(p.applyStartsAt),end=Date.parse(p.applyEndsAt);
    if(!Number.isFinite(start)||!Number.isFinite(end))return {label:'신청 정보 확인 필요',canApply:false};
    if(now<start)return {label:'접수 예정',canApply:false};
    if(now>end)return {label:'접수기간 종료',canApply:false};
    if(p.sourceState==='COS003'||p.sourceState==='COS005')return {label:'접수 마감(수집 기준)',canApply:false};
    return {label:'접수기간 내 · 원문 확인',canApply:Boolean(link(p.applicationUrl))};
  }
  function readSaved(){
    try{
      const value=JSON.parse(localStorage.getItem(key)||'[]');
      if(!Array.isArray(value)||value.length>2000||value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))throw Error('storage');
      saved=new Set(value);storageError='';
    }catch{storageError='관심 목록을 읽지 못했습니다. 기존 저장 값을 덮어쓰지 않도록 변경을 중단했어요.';}
  }
  function init(callbacks){({onChange,notify}=callbacks);readSaved();}
  async function load(){
    try{
      const response=await fetch('learning-data.json');if(!response.ok)throw Error('snapshot');
      const value=await response.json();
      if(!Array.isArray(value.programs)||!value.programs.length)throw Error('schema');
      programs=value.programs.filter(p=>p&&/^[A-Za-z0-9_-]{1,100}$/.test(p.id)&&typeof p.title==='string'&&Array.isArray(p.subjects)&&p.subjects.some(s=>topics.includes(s))).map(p=>({...p,subjects:p.subjects.filter(s=>topics.includes(s)),weekdays:Array.isArray(p.weekdays)?p.weekdays.filter(d=>days.includes(d)):[],sample:p.sample===true,sourceUrl:link(p.sourceUrl),applicationUrl:link(p.applicationUrl)}));
      if(!programs.length||new Set(programs.map(p=>p.id)).size!==programs.length)throw Error('empty');
      snapshot=value;dataError='';
    }catch{
      programs=topics.map((topic,i)=>({id:`sample-learning-${i+1}`,title:`${topic} 프로그램 예시`,subjects:[topic],weekdays:[],sample:true,sourceKind:'sample',description:'화면 체험을 위한 예시이며 실제 운영·모집 프로그램이 아닙니다.'}));
      state.source='sample';dataError='실제 자료를 불러오지 못해 예시 프로그램을 보여드립니다. 신청할 수 없습니다.';
    }
    return programs;
  }
  const options=(pairs,selected)=>pairs.map(([value,label])=>`<option value="${safe(value)}" ${value===selected?'selected':''}>${safe(label)}</option>`).join('');
  function saveButton(p){const selected=saved.has(p.id);return `<button type="button" class="program-save ${selected?'is-saved':''}" data-save-program="${safe(p.id)}" aria-pressed="${selected}"><span aria-hidden="true">${selected?'★':'☆'}</span> ${selected?'관심 프로그램 해제':'관심 프로그램'}</button>`;}
  function sourceLabel(p){return p.sample?'예시 데이터':`${p.sourceGroupLabel||'실제 자료'} · ${p.sourceKind==='catalog'?'모집 미확인':'강좌 정보'}`;}
  function groupedCards(items){
    return [['jeju','제주시 평생교육 자료'],['seogwipo','서귀포시 평생학습관 자료'],['other','기타 실제 자료'],['sample','예시 프로그램']].map(([group,label])=>{
      const entries=items.filter(p=>p.sample?group==='sample':(p.sourceGroup||'other')===group);
      if(!entries.length)return '';
      const note=group==='jeju'?'첨부 텍스트 자료 · 자료 구분은 제주시이며, 개별 교육 장소는 정보 확인 필요입니다.':group==='seogwipo'?'첨부 HWP 자료 · 서귀포시 평생학습관에서 제공한 강좌입니다.':'';
      return `<section class="learning-source-section"><h2>${safe(label)} <span class="caption">${entries.length}건</span></h2>${note?`<p class="source-note">${safe(note)}</p>`:''}<div class="cards">${entries.map(card).join('')}</div></section>`;
    }).join('');
  }
  function card(p){
    const status=application(p);
    return `<article class="card program-card" data-learning-id="${safe(p.id)}"><div class="program-banner"><span>${safe(p.subjects.join(' · '))}</span><span class="${p.sample?'sample-badge':'program-source'}">${sourceLabel(p)}</span></div><div class="card-body"><button type="button" class="program-open" data-learn="${safe(p.id)}"><h3>${safe(p.title)}</h3><span class="caption">상세 정보 보기 ↗</span></button><dl class="program-facts"><dt>자료 구분</dt><dd>${safe(p.sourceGroupLabel||'예시 데이터')}</dd><dt>기관</dt><dd>${safe(p.institution||unknown)}</dd><dt>장소</dt><dd>${safe(p.place||unknown)}</dd><dt>일정</dt><dd>${safe(range(p.startsAt,p.endsAt))}<br>${safe(p.plan||unknown)}</dd><dt>비용</dt><dd>${safe(fee(p))}</dd><dt>신청</dt><dd><span class="program-status">${safe(status.label)}</span></dd></dl>${saveButton(p)}</div></article>`;
  }
  function matches(p){
    const query=state.query.toLocaleLowerCase();const tuition=amount(p.tuition);
    return (state.source==='all'||(state.source==='sample'?p.sample:!p.sample&&(state.source==='actual'||p.sourceGroup===state.source)))&&(!state.onlySaved||saved.has(p.id))&&(state.region==='전체'||(state.region==='unknown'?!p.region:p.region===state.region))&&(state.topic==='전체'||p.subjects.includes(state.topic))&&(state.weekday==='전체'||(state.weekday==='unknown'?!p.weekdays.length:p.weekdays.includes(state.weekday)))&&(state.cost==='전체'||(state.cost==='free'?tuition===0:state.cost==='paid'?tuition!==null&&tuition>0:tuition===null))&&(!query||[p.title,p.institution,p.place,p.description,...p.subjects].join(' ').toLocaleLowerCase().includes(query));
  }
  function list(){
    const visible=programs.filter(matches);
    const regions=[...new Set(programs.map(p=>p.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    const actual=programs.filter(p=>!p.sample).length;
    return `<div class="intro"><p class="eyebrow">LEARN & GROW</p><h1>새롭게 좋아할 일을 찾아서</h1><p>관심 있는 배움을 고르고, 배운 것을 나만의 이야기로 남겨보세요.</p></div><p class="notice">실제 강좌·과목 정보 ${actual}건과 예시를 구분했습니다. 신청 상태는 날짜와 수집 자료 기준입니다. 장기체류자의 신청 가능 여부는 기관에 확인해 주세요. 수강료가 무료여도 재료비 등이 별도일 수 있습니다.</p><p class="source-note">정보 확인일: ${safe(snapshot?.checkedAt||unknown)} · 주제는 제목을 기준으로 앱에서 분류했습니다.<br>제주시 자료(첨부 텍스트)와 서귀포시 자료(첨부 HWP)를 별도로 표시합니다.<br>제주시 자료의 공식 제공기관은 제주특별자치도교육청입니다. 개별 교육 장소가 없어 지역 필터에서는 ‘정보 확인 필요’에 포함하며, 현재 모집 여부를 추정하지 않습니다.</p>${dataError?`<p class="journal-error" role="status">${safe(dataError)}</p>`:''}${storageError?`<p class="journal-error" role="alert">${safe(storageError)}</p>`:''}<form id="learning-search" class="search-form walk-search-panel"><label for="learning-query">프로그램 검색</label><div><input id="learning-query" name="query" type="search" maxlength="100" value="${safe(state.query)}" placeholder="프로그램명, 기관, 관심 주제로 찾아보세요"><button class="primary" type="submit">검색</button></div><fieldset class="walk-filter-set"><legend>나에게 맞는 배움 찾기</legend><div class="learning-filter-grid"><div><label for="learning-region">지역</label><select id="learning-region" name="region">${options([['전체','전체 지역'],...regions.map(r=>[r,r]),['unknown',unknown]],state.region)}</select></div><div><label for="learning-topic">주제</label><select id="learning-topic" name="topic">${options([['전체','전체 주제'],...topics.map(t=>[t,t])],state.topic)}</select></div><div><label for="learning-weekday">요일</label><select id="learning-weekday" name="weekday">${options([['전체','전체 요일'],...days.map(d=>[d,d+'요일']),['unknown',unknown]],state.weekday)}</select></div><div><label for="learning-cost">비용 구분</label><select id="learning-cost" name="cost">${options([['전체','전체 비용'],['free','수강료 무료'],['paid','수강료 유료'],['unknown',unknown]],state.cost)}</select></div><div><label for="learning-source">자료 구분</label><select id="learning-source" name="source">${options([['actual','실제 정보 전체'],['jeju','제주시 평생교육 자료'],['seogwipo','서귀포시 평생학습관 자료'],['sample','예시 프로그램'],['all','실제 정보와 예시 모두']],state.source)}</select></div></div></fieldset><div class="learning-view-options"><label><input id="learning-saved-only" name="onlySaved" type="checkbox" ${state.onlySaved?'checked':''}>관심 프로그램만 보기 (${saved.size})</label></div></form><div class="walk-result-bar"><p class="source-note" role="status">${visible.length}개 프로그램을 찾았어요.</p><button class="text-button" id="learning-reset">검색·필터 초기화</button></div>${visible.length?groupedCards(visible):`<div class="empty walk-empty"><h2>조건에 맞는 프로그램이 없어요</h2><p>다른 주제·요일을 선택하거나 필터를 초기화해 보세요.<br>확인된 실제 자료가 없는 주제는 예시로 체험할 수 있어요.</p><button type="button" id="learning-show-examples" class="outline">예시 프로그램 보기</button></div>`}<p class="source-note">관심 목록은 이 브라우저에만 저장됩니다. 이 앱에서 수강 신청이나 결제는 진행하지 않습니다.</p>`;
  }
  function details(p){
    activeId=p.id;const status=application(p);
    return `<p class="eyebrow">LEARN & GROW</p><span class="${p.sample?'sample-badge':'program-source'}">${sourceLabel(p)}</span><h2>${safe(p.title)}</h2><p class="meta">${safe(p.subjects.join(' · '))}</p><h3>프로그램 소개</h3><p class="record-body">${safe(p.description||unknown)}</p><dl class="place-facts walk-detail-facts"><dt>자료 구분</dt><dd>${safe(p.sourceGroupLabel||'예시 데이터')}</dd><dt>기관</dt><dd>${safe(p.institution||unknown)}</dd><dt>장소</dt><dd>${safe(p.place||unknown)}</dd><dt>교육 일정</dt><dd>${safe(range(p.startsAt,p.endsAt))}<br>${safe(p.plan||unknown)}</dd><dt>비용</dt><dd>${safe(fee(p))}</dd><dt>신청 자격</dt><dd>${safe(p.eligibility||unknown)}</dd><dt>신청 기간</dt><dd>${safe(range(p.applyStartsAt,p.applyEndsAt,true))}</dd><dt>신청 상태</dt><dd>${safe(status.label)}</dd><dt>문의</dt><dd>${safe(p.phone||unknown)}</dd><dt>정보 확인일</dt><dd>${safe(p.checkedAt||'예시 데이터 · 확인일 없음')}</dd></dl>${p.sourceGroupNote?`<p class="source-note">${safe(p.sourceGroupNote)}</p>`:''}${p.costNote?`<h3>준비물·추가 비용 안내</h3><p class="record-body">${safe(p.costNote)}</p>`:''}<p class="notice">${p.sample?'실제 프로그램이 아닌 예시입니다. 수강 신청할 수 없습니다.':'거주·나이 등 신청 요건은 각 자료의 원문 표현을 그대로 표시합니다. 제주 장기체류만으로 신청 자격이 충족된다고 판단하지 않습니다. 접수 가능 여부와 재료비·교재비 등 총비용은 운영 기관에 재확인해 주세요.'}</p><div class="dialog-actions">${saveButton(p)}${p.sourceUrl&&!p.sample?`<a class="outline source-link" href="${safe(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>`:'<button type="button" class="outline" disabled>원문 정보 없음</button>'}${status.canApply&&!p.sample?`<a class="outline source-link" href="${safe(p.applicationUrl)}" target="_blank" rel="noopener noreferrer">공식 페이지에서 신청 확인 ↗</a>`:`<button type="button" class="outline" disabled>${p.sample?'예시 · 신청 불가':status.label}</button>`}</div><p class="source-note">출처: ${safe(p.source||'앱 체험 예시')} · 방문 시점의 접수·정원 상태를 보장하지 않습니다.</p><button class="primary" data-start-learn="${safe(p.id)}">참여 후 기록하기 ↗</button>`;
  }
  function refresh(focusId){onChange();if(focusId)document.getElementById(focusId)?.focus();}
  function readFilters(form){
    const values=new FormData(form);
    state.query=String(values.get('query')||'').trim().slice(0,100);
    for(const name of ['region','topic','weekday','cost','source'])state[name]=String(values.get(name)||'전체');
    state.onlySaved=values.get('onlySaved')!==null;
  }
  function reset(){Object.assign(state,{query:'',region:'전체',topic:'전체',weekday:'전체',cost:'전체',source:snapshot?'actual':'sample',onlySaved:false});}
  function toggle(id){
    if(!programs.some(p=>p.id===id))return;
    readSaved();if(storageError){notify(storageError);refresh();return;}
    const next=new Set(saved);if(next.has(id))next.delete(id);else next.add(id);
    try{localStorage.setItem(key,JSON.stringify([...next]));saved=next;notify(saved.has(id)?'관심 프로그램에 저장했어요.':'관심 프로그램에서 해제했어요.');refresh();
      const popup=document.querySelector('#detail-dialog');
      const button=popup.querySelector(`[data-save-program="${id}"]`);
      if(popup.open&&activeId===id&&button){button.outerHTML=saveButton(programs.find(p=>p.id===id));popup.querySelector(`[data-save-program="${id}"]`).focus();}
      else (document.querySelector(`[data-save-program="${id}"]`)||document.querySelector('#learning-saved-only'))?.focus();
    }catch{notify('관심 목록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');}
  }
  function featured(){const actual=programs.filter(p=>!p.sample);const result=[];for(const topic of topics){const candidate=actual.find(p=>p.sourceKind==='course'&&p.subjects.includes(topic)&&!result.includes(p))||actual.find(p=>p.subjects.includes(topic)&&!result.includes(p));if(candidate)result.push(candidate);if(result.length===3)break;}return result.length?result:programs.slice(0,3);}
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(button?.dataset.saveProgram){toggle(button.dataset.saveProgram);return;}
    if(button?.id==='learning-reset'){reset();refresh('learning-query');return;}
    if(button?.id==='learning-show-examples'){Object.assign(state,{source:'sample',region:'전체',weekday:'전체',cost:'전체',onlySaved:false,query:''});refresh('learning-source');return;}
    if(!button){const card=event.target.closest('article[data-learning-id]');card?.querySelector('[data-learn]')?.click();}
  });
  document.addEventListener('submit',event=>{if(event.target.id!=='learning-search')return;event.preventDefault();readFilters(event.target);refresh('learning-query');});
  document.addEventListener('input',event=>{if(event.target.id==='learning-query')state.query=event.target.value.trim().slice(0,100);});
  document.addEventListener('change',event=>{
    if(!event.target.closest('#learning-search'))return;
    const id=event.target.id;readFilters(event.target.form);
    if(id==='learning-saved-only'&&state.onlySaved)state.source='all';
    refresh(id);
  });
  window.addEventListener('storage',event=>{if(event.key===key){readSaved();refresh();}});
  return {init,load,card,list,details,featured};
})();

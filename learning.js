'use strict';
window.jejuLearning=(()=>{
  const topics=['글쓰기','독서','자연관찰','사진','공예','디지털 활용','기타 배움'];
  const courseCategories=[{"id":"rcou-01","group":"regular","name":"본원","path":"/ko/rcou/01"},{"id":"rcou-08","group":"regular","name":"동부캠퍼스","path":"/ko/rcou/08"},{"id":"rcou-03","group":"regular","name":"서귀포캠퍼스","path":"/ko/rcou/03"},{"id":"rcou-04","group":"regular","name":"서부캠퍼스","path":"/ko/rcou/04"},{"id":"rcou-05","group":"regular","name":"장년층 생애재설계","path":"/ko/rcou/05"},{"id":"scou-01","group":"special","name":"나도 도민대학강사","path":"/ko/scou/01"},{"id":"scou-02","group":"special","name":"동네캠퍼스","path":"/ko/scou/02"},{"id":"scou-03","group":"special","name":"열린강의실","path":"/ko/scou/03"},{"id":"scou-04","group":"special","name":"특별과정","path":"/ko/scou/04"},{"id":"scou-05","group":"special","name":"메이커 양성","path":"/ko/scou/05"},{"id":"scou-06","group":"special","name":"도민외국어","path":"/ko/scou/06"},{"id":"scou-07","group":"special","name":"장비이용신청","path":"/ko/scou/07"},{"id":"scou-08","group":"special","name":"배움터","path":"/ko/scou/08"}];
  const days=['월','화','수','목','금','토','일'];
  const key='jeju-one-book.saved-programs.v1';
  const unknown='정보 확인 필요';
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot=null,programs=[],saved=new Set(),storageError='',dataError='',activeId=null;
  let onChange=()=>{},notify=()=>{};
  const state={query:'',region:'전체',topic:'전체',weekday:'전체',cost:'전체',courseType:'전체',category:'전체',onlySaved:false};
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
  function application(p){
    const now=Date.now(),start=Date.parse(p.applyStartsAt),end=Date.parse(p.applyEndsAt);
    if(Number.isFinite(end)&&now>end)return {label:'접수기간 종료',canApply:false};
    if(Number.isFinite(start)&&now<start)return {label:'접수 예정',canApply:false};
    return {label:p.sourceState==='대기접수가능'?'대기접수 가능 · 원문 확인':'접수 상태 원문 확인',canApply:false};
  }
  function applicationLink(p){return p.applicationUrl?`<a class="outline source-link" href="${safe(p.applicationUrl)}" target="_blank" rel="noopener noreferrer">제주도민대학에서 신청 확인 ↗</a>`:'<span class="source-note">공식 링크 확인 필요</span>';}

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
      programs=value.programs.filter(p=>p&&p.sourceKind==='domin'&&p.sample!==true&&/^domin-[A-Za-z0-9_-]{1,94}$/.test(p.id)&&typeof p.title==='string'&&Array.isArray(p.subjects)&&p.subjects.some(s=>topics.includes(s))).map(p=>({...p,subjects:p.subjects.filter(s=>topics.includes(s)),weekdays:Array.isArray(p.weekdays)?p.weekdays.filter(d=>days.includes(d)):[],sample:p.sample===true,sourceUrl:link(p.sourceUrl),applicationUrl:link(p.applicationUrl)}));
      if(!programs.length||new Set(programs.map(p=>p.id)).size!==programs.length)throw Error('empty');
      snapshot=value;dataError='';
    }catch{
      programs=[];snapshot=null;
      dataError='교육 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
    }
    return programs;
  }
  const options=(pairs,selected)=>pairs.map(([value,label])=>`<option value="${safe(value)}" ${value===selected?'selected':''}>${safe(label)}</option>`).join('');
  function saveButton(p){const selected=saved.has(p.id);return `<button type="button" class="program-save ${selected?'is-saved':''}" data-save-program="${safe(p.id)}" aria-pressed="${selected}"><span aria-hidden="true">${selected?'★':'☆'}</span> ${selected?'관심 프로그램 해제':'관심 프로그램'}</button>`;}
  const regionOf=p=>p.region||'';
  function sourceLabel(){return '제주도민대학';}
  function categoriesOf(p){
    if(Array.isArray(p.categoryIds))return courseCategories.filter(c=>p.categoryIds.includes(c.id));
    return courseCategories.filter(c=>p.sourceUrl?.startsWith('https://www.jejudomin.kr'+c.path+'/view/'));
  }
  function courseLabel(p){return categoriesOf(p).map(c=>`${c.group==='regular'?'정규과정':'특별과정'} · ${c.name}`).join(' / ')||unknown;}
  function courseNavigation(){
    const groups=[['regular','정규과정'],['special','특별과정']];
    return `<section class="course-browser" aria-labelledby="course-browser-title"><div class="section-head"><h2 id="course-browser-title">과정별로 찾아보기</h2><button type="button" class="chip ${state.courseType==='전체'?'active':''}" data-course-type="전체" aria-pressed="${state.courseType==='전체'}">전체 과정 (${programs.length})</button></div><div class="course-groups">${groups.map(([group,name])=>`<div class="course-group"><h3><button type="button" class="course-group-button ${state.courseType===group&&state.category==='전체'?'active':''}" data-course-type="${group}" aria-pressed="${state.courseType===group&&state.category==='전체'}">${name} 전체 (${programs.filter(p=>categoriesOf(p).some(c=>c.group===group)).length})</button></h3><div class="course-category-buttons" role="group" aria-label="${name} 세부 분류">${courseCategories.filter(c=>c.group===group).map(c=>`<button type="button" class="chip ${state.category===c.id?'active':''}" data-course-category="${c.id}" aria-pressed="${state.category===c.id}">${safe(c.name)} (${programs.filter(p=>categoriesOf(p).some(category=>category.id===c.id)).length})</button>`).join('')}</div></div>`).join('')}</div><p class="caption">숫자는 현재 보관된 강좌 수입니다. 목록이 없는 항목도 공식 페이지에서 확인할 수 있어요.</p></section>`;
  }
  function updateCourseButtons(){
    document.querySelectorAll('[data-course-type], [data-course-category]').forEach(button=>{
      const active=button.dataset.courseCategory?button.dataset.courseCategory===state.category:button.dataset.courseType===state.courseType&&state.category==='전체';
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
  }
  function courseContext(){
    const category=courseCategories.find(c=>c.id===state.category);
    const label=category?`${category.group==='regular'?'정규과정':'특별과정'} / ${category.name}`:state.courseType==='regular'?'정규과정 전체':state.courseType==='special'?'특별과정 전체':'전체 과정';
    const path=category?.path||(state.courseType==='special'?'/ko/scou/01':'/ko/rcou/01');
    return `<p class="source-note course-context"><strong>${safe(label)}</strong> · <a href="https://www.jejudomin.kr${path}" target="_blank" rel="noopener noreferrer">${category?safe(category.name):'제주도민대학'} 공식 페이지 ↗</a></p>`;
  }
  function card(p){
    const status=application(p);
    return `<article class="card program-card" data-learning-id="${safe(p.id)}"><div class="program-banner"><span>${safe(p.subjects.join(' · '))}</span><span class="${p.sample?'sample-badge':'program-source'}">${sourceLabel(p)}</span></div><div class="card-body"><button type="button" class="program-open" data-learn="${safe(p.id)}"><h3>${safe(p.title)}</h3><span class="caption">상세 정보 보기 ↗</span></button><dl class="program-facts"><dt>과정</dt><dd>${safe(courseLabel(p))}</dd><dt>지역</dt><dd>${safe(regionOf(p)||unknown)}</dd><dt>기관</dt><dd>${safe(p.institution||unknown)}${p.campus?` · ${safe(p.campus)}`:''}</dd><dt>장소</dt><dd>${safe(p.place||unknown)}</dd><dt>일정</dt><dd>${safe(range(p.startsAt,p.endsAt))}<br>${safe(p.plan||unknown)}</dd><dt>비용</dt><dd>${safe(fee(p))}</dd><dt>신청</dt><dd><span class="program-status">${safe(status.label)}</span></dd></dl>${saveButton(p)}<div class="program-apply-link">${applicationLink(p)}</div></div></article>`;
  }
  function matches(p){
    const query=state.query.toLocaleLowerCase();const tuition=amount(p.tuition);
    return !p.sample&&p.sourceKind==='domin'&&(state.courseType==='전체'||categoriesOf(p).some(c=>c.group===state.courseType))&&(state.category==='전체'||categoriesOf(p).some(c=>c.id===state.category))&&(!state.onlySaved||saved.has(p.id))&&(state.region==='전체'||(state.region==='unknown'?!regionOf(p):regionOf(p)===state.region))&&(state.topic==='전체'||p.subjects.includes(state.topic))&&(state.weekday==='전체'||(state.weekday==='unknown'?!p.weekdays.length:p.weekdays.includes(state.weekday)))&&(state.cost==='전체'||(state.cost==='free'?tuition===0:state.cost==='paid'?tuition!==null&&tuition>0:tuition===null))&&(!query||[p.title,p.institution,p.campus,p.place,p.description,...p.subjects].join(' ').toLocaleLowerCase().includes(query));
  }
  function list(){
    const visible=programs.filter(matches);
    return `<div class="intro"><p class="eyebrow">LEARN & GROW</p><h1>새롭게 좋아할 일을 찾아서</h1><p>관심 있는 배움을 고르고, 배운 것을 나만의 이야기로 남겨보세요.</p></div><p class="notice">제주도민대학 강좌를 접수·교육 기간과 상관없이 살펴보세요. 지난 강좌도 검색됩니다. 신청은 강좌별 링크로 제주도민대학에 접속해 로그인한 뒤 진행해 주세요. 장기체류자의 신청 가능 여부는 기관에 확인해 주세요. 수강료가 무료여도 재료비 등이 별도일 수 있습니다.</p><p class="source-note">정보 확인일: ${safe(snapshot?.checkedAt||unknown)} · 주제는 제목을 기준으로 앱에서 분류했습니다.<br>공개 과정 메뉴별 첫 페이지에서 확인한 강좌입니다. 전체 강좌와 최신 접수·대기 상태는 <a href="https://www.jejudomin.kr/ko/rcou/01" target="_blank" rel="noopener noreferrer">제주도민대학 공식 사이트 ↗</a>에서 확인해 주세요.</p>${dataError?`<p class="journal-error" role="status">${safe(dataError)}</p>`:''}${storageError?`<p class="journal-error" role="alert">${safe(storageError)}</p>`:''}${courseNavigation()}<form id="learning-search" class="search-form walk-search-panel"><label for="learning-query">프로그램 검색</label><div><input id="learning-query" name="query" type="search" maxlength="100" value="${safe(state.query)}" placeholder="프로그램명, 기관, 관심 주제로 찾아보세요"><button class="primary" type="submit">검색</button></div><fieldset class="walk-filter-set"><legend>나에게 맞는 배움 찾기</legend><div class="learning-filter-grid"><div><label for="learning-region">지역</label><select id="learning-region" name="region">${options([['전체','전체 지역'],['제주시','제주시'],['서귀포시','서귀포시'],['unknown','정보 확인 필요']],state.region)}</select></div><div><label for="learning-topic">주제</label><select id="learning-topic" name="topic">${options([['전체','전체 주제'],...topics.map(t=>[t,t])],state.topic)}</select></div><div><label for="learning-weekday">요일</label><select id="learning-weekday" name="weekday">${options([['전체','전체 요일'],...days.map(d=>[d,d+'요일']),['unknown',unknown]],state.weekday)}</select></div><div><label for="learning-cost">비용 구분</label><select id="learning-cost" name="cost">${options([['전체','전체 비용'],['free','수강료 무료'],['paid','수강료 유료'],['unknown',unknown]],state.cost)}</select></div></div></fieldset><div class="learning-view-options"><label><input id="learning-saved-only" name="onlySaved" type="checkbox" ${state.onlySaved?'checked':''}>관심 프로그램만 보기 (${programs.filter(p=>saved.has(p.id)).length})</label></div></form><div id="learning-results">${courseContext()}<div class="walk-result-bar"><p class="source-note" role="status">${visible.length}개 프로그램을 찾았어요.</p><button class="text-button" id="learning-reset">검색·필터 초기화</button></div>${visible.length?`<div class="cards">${visible.map(card).join('')}</div>`:`<div class="empty walk-empty"><h2>조건에 맞는 강좌가 없어요</h2><p>현재 보관된 목록에 선택한 조건의 강좌가 없습니다. 위 공식 페이지에서 전체 목록을 확인해 주세요.<br>다른 지역·주제·요일로 검색하거나 필터를 초기화해 보세요.</p></div>`}</div><p class="source-note">관심 목록은 이 브라우저에만 저장됩니다. 이 앱에서 수강 신청이나 결제는 진행하지 않습니다.</p>`;
  }
  function details(p){
    activeId=p.id;const status=application(p);
    return `<p class="eyebrow">LEARN & GROW</p><span class="${p.sample?'sample-badge':'program-source'}">${sourceLabel(p)}</span><h2>${safe(p.title)}</h2><p class="meta">${safe(p.subjects.join(' · '))}</p><h3>프로그램 소개</h3><p class="record-body">${safe(p.description||unknown)}</p><dl class="place-facts walk-detail-facts"><dt>과정</dt><dd>${safe(courseLabel(p))}</dd><dt>지역</dt><dd>${safe(regionOf(p)||unknown)}</dd><dt>기관</dt><dd>${safe(p.institution||unknown)}${p.campus?` · ${safe(p.campus)}`:''}</dd><dt>장소</dt><dd>${safe(p.place||unknown)}</dd><dt>교육 일정</dt><dd>${safe(range(p.startsAt,p.endsAt))}<br>${safe(p.plan||unknown)}</dd><dt>비용</dt><dd>${safe(fee(p))}</dd><dt>신청 자격</dt><dd>${safe(p.eligibility||unknown)}</dd><dt>신청 기간</dt><dd>${safe(range(p.applyStartsAt,p.applyEndsAt,true))}</dd><dt>신청 상태</dt><dd>${safe(status.label)}</dd><dt>문의</dt><dd>${safe(p.phone||unknown)}</dd><dt>정보 확인일</dt><dd>${safe(p.checkedAt||'예시 데이터 · 확인일 없음')}</dd></dl>${p.costNote?`<h3>준비물·추가 비용 안내</h3><p class="record-body">${safe(p.costNote)}</p>`:''}<p class="notice">${p.sample?'실제 프로그램이 아닌 예시입니다. 수강 신청할 수 없습니다.':'신청은 제주도민대학 공식 사이트에서 로그인 후 진행합니다. 접수가 종료된 강좌는 현재 신청할 수 없으며, 다음 개설 여부는 운영기관에 확인해 주세요. 거주·나이 등 신청 요건은 원문 표현을 그대로 표시합니다. 제주 장기체류만으로 신청 자격이 충족된다고 판단하지 않습니다. 접수 가능 여부와 재료비·교재비 등 총비용은 운영 기관에 재확인해 주세요.'}</p><div class="dialog-actions">${saveButton(p)}${applicationLink(p)}</div><p class="source-note">출처: ${safe(p.source||'앱 체험 예시')} · 방문 시점의 접수·정원 상태를 보장하지 않습니다.</p><button class="primary" data-start-learn="${safe(p.id)}">참여 후 기록하기 ↗</button>`;
  }
  function refresh(focusId){onChange();if(focusId)document.getElementById(focusId)?.focus();}
  function updateResults(){
    // Update only results so native select focus and open menus survive blur.
    const current=document.getElementById('learning-results');
    if(!current)return;
    const template=document.createElement('template');
    template.innerHTML=list();
    current.replaceChildren(...template.content.querySelector('#learning-results').childNodes);
  }
  function readFilters(form){
    const values=new FormData(form);
    state.query=String(values.get('query')||'').trim().slice(0,100);
    for(const name of ['region','topic','weekday','cost'])state[name]=String(values.get(name)||'전체');
    state.onlySaved=values.get('onlySaved')!==null;
  }
  function reset(){Object.assign(state,{query:'',region:'전체',topic:'전체',weekday:'전체',cost:'전체',courseType:'전체',category:'전체',onlySaved:false});}
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
  function featured(){const selected=[];for(const topic of topics){const candidate=programs.find(p=>p.subjects.includes(topic)&&!selected.includes(p));if(candidate)selected.push(candidate);if(selected.length===3)break;}return selected.length?selected:programs.slice(0,3);}
  document.addEventListener('click',event=>{
    if(event.target.closest('a'))return;
    const button=event.target.closest('button');
    if(button?.dataset.courseCategory){
      const category=courseCategories.find(c=>c.id===button.dataset.courseCategory);if(!category)return;
      state.courseType=category.group;state.category=category.id;updateResults();updateCourseButtons();return;
    }
    if(button?.dataset.courseType){
      if(!['전체','regular','special'].includes(button.dataset.courseType))return;
      state.courseType=button.dataset.courseType;state.category='전체';updateResults();updateCourseButtons();return;
    }
    if(button?.dataset.saveProgram){toggle(button.dataset.saveProgram);return;}
    if(button?.id==='learning-reset'){reset();refresh('learning-query');return;}
    if(!button){const card=event.target.closest('article[data-learning-id]');card?.querySelector('[data-learn]')?.click();}
  });
  document.addEventListener('submit',event=>{if(event.target.id!=='learning-search')return;event.preventDefault();readFilters(event.target);updateResults();});
  document.addEventListener('input',event=>{if(event.target.id==='learning-query')state.query=event.target.value.trim().slice(0,100);});
  document.addEventListener('change',event=>{
    if(!event.target.closest('#learning-search'))return;
    readFilters(event.target.form);
    updateResults();
  });
  window.addEventListener('storage',event=>{if(event.key===key){readSaved();refresh();}});
  return {init,load,card,list,details,featured};
})();

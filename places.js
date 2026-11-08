'use strict';
// Public snapshot only: no API key, paid service, runtime function, or live API call.
window.jejuPlaces = (() => {
  let snapshot = null;
  let theme = '전체';
  let query = '';
  let region = '전체';
  let duration = '전체';
  let difficulty = '전체';
  const unknown = '정보 확인 필요';
  const durationOptions = [['전체','전체 시간'],['short','30분 이내'],['hour','30분 초과~1시간'],['two-hours','1시간 초과~2시간'],['long','2시간 초과'],['unknown',unknown]];
  const difficultyOptions = [['전체','전체 난이도'],['쉬움','쉬움'],['보통','보통'],['어려움','어려움'],['unknown',unknown]];
  const sourceUrl = value => {
    try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''; } catch { return ''; }
  };
  function walkingInfo(p) {
    const info=p.walkInfo||{};
    const source=sourceUrl(info.sourceUrl);
    const verified=Boolean(source&&/^\d{4}-\d{2}-\d{2}$/.test(info.checkedAt||''));
    const minutes=verified&&typeof info.durationMinutes==='number'&&Number.isFinite(info.durationMinutes)&&info.durationMinutes>0?info.durationMinutes:null;
    const level=verified&&['쉬움','보통','어려움'].includes(info.difficulty)?info.difficulty:null;
    const text=key=>verified&&typeof info[key]==='string'&&info[key].trim()?info[key].trim():unknown;
    return {minutes,level,slope:text('slope'),toilet:text('toilet'),bench:text('bench'),transit:text('transit'),route:text('route'),source:verified?source:'',checkedAt:verified?info.checkedAt:''};
  }
  const durationLabel = info => info.minutes===null?unknown:`약 ${info.minutes}분`;
  function durationMatches(minutes, selected) {
    if(selected==='전체')return true;
    if(selected==='unknown')return minutes===null;
    if(minutes===null)return false;
    return {short:minutes<=30,hour:minutes>30&&minutes<=60,'two-hours':minutes>60&&minutes<=120,long:minutes>120}[selected]===true;
  }
  function options(items,selected) {
    return items.map(([value,label])=>`<option value="${safe(value)}" ${value===selected?'selected':''}>${safe(label)}</option>`).join('');
  }
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const question = p => `‘${p.title}’에서 오늘 오래 바라본 장면은 무엇인가요?`;
  const sourceNote = () => snapshot ? `비짓제주 장소 정보 · ${safe(snapshot.fetchedAt.slice(0,10))} 수집` : '장소 정보를 불러오지 못해 예시 코스를 보여드려요.';
  const photoUrl = value => {
    try { const url=new URL(value);return url.protocol==='https:'&&url.hostname==='api.cdn.visitjeju.net'&&!url.search&&!url.hash?url.href:''; } catch { return ''; }
  };
  const illustration = (p, full=false) => {
    const url=photoUrl(full?(p.photoUrl||p.thumbnailUrl):(p.thumbnailUrl||p.photoUrl));
    return `<div class="art ${safe(p.art)} ${url?'art-photo':''}"><img src="${safe(url||'assets/jeju-landscape.svg')}" alt="${safe(url?`${p.title} · 비짓제주 제공 사진`:'제주 풍경 일러스트 · 실제 장소 사진이 아닙니다')}" ${url?'data-place-photo="true"':''} loading="lazy" decoding="async"><span class="tag">${url?'사진: 비짓제주 제공':'장소: 비짓제주 · 그림: 일러스트'}</span></div>`;
  };
  document.addEventListener('error',event=>{
    const image=event.target;
    if(!(image instanceof HTMLImageElement)||!image.hasAttribute('data-place-photo'))return;
    image.removeAttribute('data-place-photo');
    image.src='assets/jeju-landscape.svg';
    image.alt='사진을 불러오지 못해 표시한 제주 풍경 일러스트 · 실제 장소 사진이 아닙니다';
    const container=image.closest('.art');
    if(container){container.classList.remove('art-photo');container.querySelector('.tag').textContent='사진 대신 일러스트';}
  },true);
  const card = p => {
    const info=walkingInfo(p);
    return `<button class="card place-card" data-walk="${safe(p.id)}">${illustration(p)}<div class="card-body"><p class="meta">${safe(p.region)} · ${safe(p.theme)}</p><h3>${safe(p.title)}</h3><p class="walk-card-facts">예상 소요시간: ${safe(durationLabel(info))}<br>걷기 난이도: ${safe(info.level||unknown)}</p><p>${safe(p.description||'상세 화면에서 주소와 원문을 확인해 보세요.')}</p></div></button>`;
  };
  async function load() {
    try {
      const response = await fetch('places-data.json');
      if (!response.ok) throw Error('snapshot');
      const value = await response.json();
      if (!value || !Array.isArray(value.places) || !value.places.length || typeof value.fetchedAt !== 'string') throw Error('schema');
      const places = value.places.filter(p => p && /^[A-Za-z0-9_]+$/.test(p.id) && typeof p.title==='string' && typeof p.region==='string' && typeof p.description==='string' && ['숲','바다','공원·길','오름'].includes(p.theme) && ['sea','forest','village'].includes(p.art));
      if (!places.length) throw Error('empty');
      snapshot = {...value,places:places.map(p=>({...p,sample:false,question:question(p),sourceUrl:`https://www.visitjeju.net/kr/detail/view?contentsid=${encodeURIComponent(p.id)}`}))};
      return snapshot.places;
    } catch {
      return null; // The original, visibly labelled sample cards remain available.
    }
  }
  function list(selected=theme) {
    theme=selected;
    const needle=query.toLocaleLowerCase();
    const matches=snapshot.places.filter(p=>{
      const info=walkingInfo(p);
      return (theme==='전체'||p.theme===theme)&&(region==='전체'||p.region===region)&&durationMatches(info.minutes,duration)&&(difficulty==='전체'||(difficulty==='unknown'?info.level===null:info.level===difficulty))&&(!needle||[p.title,p.region,p.address,...(p.tags||[])].join(' ').toLocaleLowerCase().includes(needle));
    });
    const regions=['전체',...new Set(snapshot.places.map(p=>p.region))].sort((a,b)=>a==='전체'?-1:b==='전체'?1:a.localeCompare(b,'ko'));
    const knownTimes=snapshot.places.filter(p=>walkingInfo(p).minutes!==null).length;
    const knownLevels=snapshot.places.filter(p=>walkingInfo(p).level!==null).length;
    return `<div class="intro"><p class="eyebrow">WALK & NOTICE</p><h1>천천히 걸어도 좋아요</h1><p>머물고 있는 동네에서, 마음에 남을 풍경을 찾아보세요.</p></div><p class="notice">${safe(snapshot.notice)}</p><p class="source-note">출처: <a href="https://www.visitjeju.net/kr/visitjejuapi" target="_blank" rel="noopener noreferrer">제주관광공사 비짓제주</a> · ${safe(snapshot.fetchedAt.slice(0,10))} 수집 · 장소 후보 ${snapshot.places.length}곳<br>테마는 이름·태그로 분류했습니다. 쉬운 코스나 연령별 적합성을 검증한 목록은 아닙니다.</p><form id="walk-search" class="search-form walk-search-panel"><label for="walk-query">장소·지역 검색</label><div><input id="walk-query" name="query" maxlength="100" value="${safe(query)}" placeholder="예: 애월, 해안, 공원" type="search"><button class="primary" type="submit">검색</button></div><fieldset class="walk-filter-set"><legend>나에게 맞는 산책 찾기</legend><div class="walk-filter-grid"><label for="walk-region">지역<select id="walk-region" name="region">${options(regions.map(r=>[r,r==='전체'?'전체 지역':r]),region)}</select></label><label for="walk-duration">예상 소요시간<select id="walk-duration" name="duration">${options(durationOptions,duration)}</select></label><label for="walk-difficulty">걷기 난이도<select id="walk-difficulty" name="difficulty">${options(difficultyOptions,difficulty)}</select></label></div><p class="caption">소요시간 확인 ${knownTimes}/${snapshot.places.length}곳 · 난이도 확인 ${knownLevels}/${snapshot.places.length}곳<br>미확인 장소는 특정 시간대·난이도 결과에 포함하지 않습니다. ‘정보 확인 필요’로 따로 볼 수 있어요.</p></fieldset></form><div class="filters" aria-label="산책 테마">${['전체',...new Set(snapshot.places.map(p=>p.theme))].map(t=>`<button class="chip ${t===theme?'active':''}" aria-pressed="${t===theme}" data-walk-filter="${safe(t)}">${safe(t)}</button>`).join('')}</div><div class="walk-result-bar"><p class="source-note" role="status">${matches.length}곳을 찾았어요.</p><button type="button" id="walk-reset" class="text-button">검색·필터 초기화</button></div><div class="cards">${matches.length?matches.map(card).join(''):`<div class="empty walk-empty"><h2>조건에 맞는 장소가 없어요</h2><p>지역·검색어를 바꾸거나 소요시간·난이도를 ‘전체’로 선택해 보세요.<br>아직 확인하지 못한 항목이 있는 장소는 일부 조건에서 제외됩니다.</p><button type="button" class="outline" data-reset-walk>모든 장소 보기</button></div>`}</div>`;
  }
  function details(p) {
    const info=walkingInfo(p);
    return `${illustration(p,true)}<p class="eyebrow">WALK & NOTICE</p><h2>${safe(p.title)}</h2><p class="meta">${safe(p.region)} · ${safe(p.theme)}</p><h3>산책 장소 소개</h3><p>${safe(p.description||'소개가 제공되지 않았습니다. 원문에서 확인해 주세요.')}</p><dl class="place-facts walk-detail-facts"><dt>예상 소요시간</dt><dd>${safe(durationLabel(info))}</dd><dt>걷기 난이도</dt><dd>${safe(info.level||unknown)}</dd><dt>경사</dt><dd>${safe(info.slope)}</dd><dt>화장실</dt><dd>${safe(info.toilet)}</dd><dt>벤치</dt><dd>${safe(info.bench)}</dd><dt>대중교통</dt><dd>${safe(info.transit)}</dd><dt>기준 경로</dt><dd>${safe(info.route)}</dd><dt>주소</dt><dd>${safe(p.address||unknown)}</dd><dt>문의</dt><dd>${safe(p.phone||unknown)}</dd></dl>${info.source?`<p class="source-note">산책 정보 확인일: ${safe(info.checkedAt)} · <a href="${safe(info.source)}" target="_blank" rel="noopener noreferrer">산책 정보 출처 ↗</a></p>`:''}<p class="notice">시설·교통 정보가 미확인인 경우 운영처에 확인해 주세요. 입장료가 있는 장소가 포함될 수 있으며, 방문 비용과 운영 여부는 앱 이용과 별개입니다.</p><a class="outline source-link" href="${safe(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">비짓제주에서 원문 확인 ↗</a><p class="source-note">${sourceNote()}<br>사진 출처: 제주관광공사 비짓제주. 사진이 없거나 표시되지 않으면 일러스트로 대체합니다.</p><h3>산책 뒤, 나에게 묻기</h3><p>${safe(p.question)}</p><p class="source-note">글감 질문은 ‘제주 한 권’에서 만들었습니다.</p><button class="primary" data-start-walk="${safe(p.id)}">여기서 기록하기 ↗</button>`;
  }
  function info() {
    return `<p class="eyebrow">ABOUT THIS EDITION</p><h2>무료 체험판 안내</h2><p>산책하고 배우며 글을 쌓는 무료 체험 공간입니다.</p><p>${snapshot?`산책 장소는 제주관광공사 비짓제주에서 ${safe(snapshot.fetchedAt.slice(0,10))}에 수집한 실제 정보입니다. 자연 관련 이름·태그로 추린 후보이며 경로와 보행 편의는 검증하지 않았습니다.`:'산책 코스는 예시 데이터입니다.'} 배움 메뉴는 제주도민대학 공개 강좌의 장소·기간과 공식 신청 페이지를 안내합니다. 기간이 지난 강좌도 포함하며 최신 접수 상태와 자격은 공식 사이트에서 확인해 주세요. 체험 기록·오늘의 글감은 예시입니다.</p><p>산책 장소 사진은 비짓제주 제공 이미지입니다. 사진이 없거나 불러오지 못하면 일러스트를 표시합니다. 첫 화면의 배경은 일러스트입니다. 장소 정보의 원문은 상세 화면에서 확인할 수 있습니다.</p><p>직접 쓴 기록은 이 브라우저에만 저장됩니다. 운영자나 다른 이용자에게 전송하지 않습니다. 중요한 글은 별도로 보관해 주세요.</p><p>로그인·결제·유료 AI 기능은 연결하지 않았습니다. 방문 장소의 입장료와 프로그램 비용은 앱 이용과 별개입니다.</p>`;
  }
  document.addEventListener('submit', event => {
    if (event.target.id!=='walk-search') return;
    event.preventDefault();
    query = new FormData(event.target).get('query').trim().slice(0,100);
    document.querySelector('#main').innerHTML=list();
    document.querySelector('#walk-query').focus();
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='walk-query')query=event.target.value.trim().slice(0,100);
  });
  document.addEventListener('change',event=>{
    const id=event.target.id;
    if(!['walk-region','walk-duration','walk-difficulty'].includes(id))return;
    const values=new FormData(event.target.form);
    query=String(values.get('query')||'').trim().slice(0,100);
    region=String(values.get('region')||'전체');
    duration=String(values.get('duration')||'전체');
    difficulty=String(values.get('difficulty')||'전체');
    document.querySelector('#main').innerHTML=list();
    document.getElementById(id).focus();
  });
  document.addEventListener('click',event=>{
    const reset=event.target.closest('#walk-reset, [data-reset-walk]');
    if(!reset)return;
    query='';theme='전체';region='전체';duration='전체';difficulty='전체';
    document.querySelector('#main').innerHTML=list();
    document.querySelector('#walk-query').focus();
  });
  return {load,card,list,details,info,sourceNote,isLoaded:()=>Boolean(snapshot)};
})();

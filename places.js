'use strict';
// Public snapshot only: no API key, paid service, runtime function, or live API call.
window.jejuPlaces = (() => {
  let snapshot = null;
  let theme = '전체';
  let query = '';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const question = p => `‘${p.title}’에서 오늘 오래 바라본 장면은 무엇인가요?`;
  const sourceNote = () => snapshot ? `비짓제주 장소 정보 · ${safe(snapshot.fetchedAt.slice(0,10))} 수집` : '장소 정보를 불러오지 못해 예시 코스를 보여드려요.';
  const illustration = p => `<div class="art ${safe(p.art)}"><img src="assets/jeju-landscape.svg" alt="제주 풍경 일러스트 · 실제 장소 사진이 아닙니다" loading="lazy"><span class="tag">장소: 비짓제주 · 그림: 일러스트</span></div>`;
  const card = p => `<button class="card place-card" data-walk="${safe(p.id)}">${illustration(p)}<div class="card-body"><p class="meta">${safe(p.region)} · ${safe(p.theme)}</p><h3>${safe(p.title)}</h3><p>${safe(p.description||'상세 화면에서 주소와 원문을 확인해 보세요.')}</p></div></button>`;
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
    const matches=snapshot.places.filter(p=>(theme==='전체'||p.theme===theme)&&(!needle||[p.title,p.region,p.address,...(p.tags||[])].join(' ').toLocaleLowerCase().includes(needle)));
    return `<div class="intro"><p class="eyebrow">WALK & NOTICE</p><h1>천천히 걸어도 좋아요</h1><p>머물고 있는 동네에서, 마음에 남을 풍경을 찾아보세요.</p></div><p class="notice">${safe(snapshot.notice)}</p><p class="source-note">출처: <a href="https://www.visitjeju.net/kr/visitjejuapi" target="_blank" rel="noopener noreferrer">제주관광공사 비짓제주</a> · ${safe(snapshot.fetchedAt.slice(0,10))} 수집 · 장소 후보 ${snapshot.places.length}곳<br>테마는 이름·태그로 분류했습니다. 쉬운 코스나 연령별 적합성을 검증한 목록은 아닙니다.</p><form id="walk-search" class="search-form"><label for="walk-query">장소·지역 검색</label><div><input id="walk-query" name="query" maxlength="100" value="${safe(query)}" placeholder="예: 애월, 해안, 공원" type="search"><button class="primary" type="submit">검색</button></div></form><div class="filters" aria-label="산책 테마">${['전체',...new Set(snapshot.places.map(p=>p.theme))].map(t=>`<button class="chip ${t===theme?'active':''}" aria-pressed="${t===theme}" data-walk-filter="${safe(t)}">${safe(t)}</button>`).join('')}</div><p class="source-note" role="status">${matches.length}곳을 찾았어요.</p><div class="cards">${matches.length?matches.map(card).join(''):'<div class="empty"><p>조건에 맞는 장소가 없어요.<br>다른 지역이나 검색어로 찾아보세요.</p></div>'}</div>`;
  }
  function details(p) {
    return `${illustration(p)}<p class="eyebrow">WALK & NOTICE</p><h2>${safe(p.title)}</h2><p class="meta">${safe(p.region)} · ${safe(p.theme)}</p><p>${safe(p.description||'소개가 제공되지 않았습니다. 원문에서 확인해 주세요.')}</p><dl class="place-facts"><dt>주소</dt><dd>${safe(p.address||'정보 확인 필요')}</dd><dt>문의</dt><dd>${safe(p.phone||'정보 확인 필요')}</dd><dt>보행 정보</dt><dd>소요시간·경사·화장실·벤치·교통편 확인 필요</dd></dl><p class="notice">입장료가 있는 장소가 포함될 수 있어요. 앱은 무료이며, 방문 비용과 운영 여부는 원문·운영처에 확인해 주세요.</p><a class="outline source-link" href="${safe(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">비짓제주에서 원문 확인 ↗</a><p class="source-note">${sourceNote()}<br>이미지는 실제 장소 사진이 아닌 일러스트입니다.</p><h3>산책 뒤, 나에게 묻기</h3><p>${safe(p.question)}</p><p class="source-note">글감 질문은 ‘제주 한 권’에서 만들었습니다.</p><button class="primary" data-start-walk="${safe(p.id)}">이 장소에서 기록하기 ↗</button>`;
  }
  function info() {
    return `<p class="eyebrow">ABOUT THIS EDITION</p><h2>무료 체험판 안내</h2><p>산책하고 배우며 글을 쌓는 무료 체험 공간입니다.</p><p>${snapshot?`산책 장소는 제주관광공사 비짓제주에서 ${safe(snapshot.fetchedAt.slice(0,10))}에 수집한 실제 정보입니다. 자연 관련 이름·태그로 추린 후보이며 경로와 보행 편의는 검증하지 않았습니다.`:'산책 코스는 예시 데이터입니다.'} 배움 프로그램·체험 기록·오늘의 글감은 앱을 설명하기 위한 예시입니다.</p><p>풍경 그림은 일러스트입니다. 장소 정보의 원문은 상세 화면에서 확인할 수 있습니다.</p><p>직접 쓴 기록은 이 브라우저에만 저장됩니다. 운영자나 다른 이용자에게 전송하지 않습니다. 중요한 글은 별도로 보관해 주세요.</p><p>로그인·결제·유료 AI 기능은 연결하지 않았습니다. 방문 장소의 입장료와 프로그램 비용은 앱 이용과 별개입니다.</p>`;
  }
  document.addEventListener('submit', event => {
    if (event.target.id!=='walk-search') return;
    event.preventDefault();
    query = new FormData(event.target).get('query').trim().slice(0,100);
    document.querySelector('#main').innerHTML=list();
    document.querySelector('#walk-query').focus();
  });
  return {load,card,list,details,info,sourceNote,isLoaded:()=>Boolean(snapshot)};
})();

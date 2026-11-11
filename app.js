'use strict';
let data;
let entries = [];
let currentPage = 'today';
const storageKey = 'jeju-one-book.entries.v1';
const main = document.querySelector('#main');
const detail = document.querySelector('#detail-dialog');
const writer = document.querySelector('#write-dialog');
const form = document.querySelector('#entry-form');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const badge = '<span class="sample-badge">예시 데이터</span>';
const dateText = new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date());
document.querySelector('#today-date').textContent = dateText;
const pageNames = {today:'오늘의 제주, 오늘의 나',walk:'걸으며 발견하는 나의 속도',reading:'책 속에서 만나는 나의 이야기',learn:'새로운 나를 만나는 배움',work:'나의 경험이 새로운 일이 되는 시간',journal:'작은 일상이 이야기가 되는 곳',book:'내 이름으로 완성할 한 권'};
function toast(message) { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3000); }
function art(item) { return `<div class="art ${esc(item.art)}">${['sea','forest','village'].includes(item.art)?'<img src="assets/jeju-landscape.svg" alt="제주 바다와 초록 언덕을 표현한 일러스트" loading="lazy">':`<span class="art-symbol" aria-hidden="true">${{writing:'✎',reading:'▤',nature:'❧'}[item.art] || '❧'}</span>`}<span class="tag">예시 데이터</span></div>`; }
function walkCard(item) { if(item.sample===false)return window.jejuPlaces.card(item); return `<button class="card" data-walk="${esc(item.id)}">${art(item)}<div class="card-body"><p class="meta">${esc(item.region)} · ${esc(item.duration)}</p><h3>${esc(item.title)}</h3><p>${esc(item.theme)}에서 나를 돌아보는 시간</p></div></button>`; }
function learnCard(item){return window.jejuLearning.card(item);}
function entryCard(item) { return window.jejuJournal.card(item); }
function heading(eyebrow,title,subtitle) {return `<div class="intro"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>`;}
function section(title,content,page,sample=false) {return `<section class="section"><div class="section-head"><h2>${title} ${sample?badge:''}</h2><a class="text-button" href="#${page}">모두 보기 ↗</a></div>${content}</section>`;}
function allEntries(){return [...entries,...data.entries];}
function renderToday(){
 const month=new Date().getMonth();const seasons=['겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'];
 const prompt=data.prompts[new Date().getDate()%data.prompts.length];
 return `<div class="welcome"><div><p class="eyebrow">A YEAR OF YOUR OWN</p><h1>오늘도, 나에게 한 걸음</h1><p>걷고 읽고 배우며, 나만의 이야기를 쌓아보세요.</p></div><span class="season">제주의 ${seasons[month]}을 기록하는 중</span></div>
 <section class="hero"><div class="hero-copy"><p class="eyebrow">JEJU, ONE BOOK</p><h2>제주에서 보낸 사계절,<br>내 이름의 책 한 권</h2><p>바람 따라 걷고, 마음 따라 쓰는 시간.<br>당신의 새로운 이야기가 여기서 시작됩니다.</p><button class="primary" data-write="">오늘의 이야기 남기기 <span aria-hidden="true">↗</span></button></div><img src="assets/jeju-landscape.svg" alt="바다와 초록 언덕 사이 오솔길을 걷는 사람의 일러스트"></section>
 <div class="dashboard-grid"><section class="prompt-card"><span class="leaf-decoration" aria-hidden="true">❧</span><p class="eyebrow">A QUESTION FOR YOU</p><h2>오늘의 글감 ${badge}</h2><blockquote>${esc(prompt)}</blockquote><button class="text-button" data-prompt="${esc(prompt)}">이 질문으로 써보기 ↗</button></section><section class="overview"><p class="eyebrow">SMALL STEPS, YOUR STORY</p><h2>한 권의 시작은, 한 편의 기록</h2><p>나의 속도로 차곡차곡 채워가요.</p><div class="stats"><div><strong>${entries.length}</strong><span>내가 남긴 기록</span></div><div><strong>${new Set(entries.map(e=>e.type)).size}</strong><span>기록한 일상의 종류</span></div></div><div class="progress-track"><i style="width:${Math.min(entries.length/12*100,100)}%"></i></div><p class="caption">첫 12편 모아보기 · ${entries.length} / 12편</p></section></div>
 ${section('산책하며 만나는 제주',`<div class="cards">${data.walks.slice(0,3).map(walkCard).join('')}</div><p class="source-note">${window.jejuPlaces.sourceNote()}</p>`,'walk',!window.jejuPlaces.isLoaded())}
 ${section('나를 넓히는 배움',window.jejuLearning.featured().length?`<div class="cards">${window.jejuLearning.featured().map(learnCard).join('')}</div>`:'<div class="empty"><p>현재 표시할 제주도민대학 강좌가 없어요.</p><a class="text-button" href="#learn">배움 검색하기 ↗</a></div>','learn')}
 ${section('최근 기록',`<div class="entry-grid">${allEntries().slice(0,2).map(entryCard).join('')}</div>`,'journal')}`;
}
function renderWalkPlaces(filter){if(window.jejuPlaces.isLoaded())return window.jejuPlaces.list(filter);filter=filter||'전체';return `${heading('WALK & NOTICE','천천히 걸어도 좋아요','풍경을 만나고, 마음에 남은 한 장면을 기록해보세요.')}<p class="notice">아래 코스와 시간은 예시입니다. 실제 경로·시설·운영 정보는 제공하지 않습니다.</p><div class="filters" aria-label="산책 테마">${['전체','바다','숲','마을'].map(t=>`<button class="chip ${filter===t?'active':''}" aria-pressed="${filter===t}" data-walk-filter="${t}">${t}</button>`).join('')}</div><div class="cards">${data.walks.filter(w=>filter==='전체'||w.theme===filter).map(walkCard).join('')}</div>`;}
function menuRecords(type){const mine=entries.filter(e=>e.type===type);return `<section class="section"><div class="section-head"><h2>내 ${esc(type)} 기록 <span class="caption">${mine.length}편</span></h2><button type="button" class="text-button" data-book-browse="${esc(type)}">내 글 골라 책에 추가 ↗</button></div><p class="caption">저장해 둔 내 글을 이곳에서 바로 책의 원하는 장에 넣을 수 있어요.</p>${mine.length?`<div class="entry-grid">${mine.map(entryCard).join('')}</div>`:'<div class="empty"><p>아직 저장한 기록이 없어요. 이 메뉴에서 남긴 기록이 여기에 모입니다.</p></div>'}</section>`;}
function renderWalk(filter){return renderWalkPlaces(filter)+menuRecords('산책');}
function renderReading(){const readingEntries=entries.filter(entry=>entry.type==='독서');return `${heading('READ & REFLECT','책 속에서, 나를 만나는 시간','마음에 남은 문장과 나의 생각을 한 편의 기록으로 남겨보세요.')}<section class="prompt-card reading-prompt"><p class="eyebrow">MY READING NOTE</p><h2>오늘 읽은 책, 오늘의 나</h2><p>읽은 책의 제목과 마음에 남은 부분, 내 삶에 연결되는 생각을 적어보세요.</p><button class="primary" data-start-reading>독서 기록 남기기 ↗</button></section><section class="section"><div class="section-head"><h2>내 독서 기록 <span class="caption">${readingEntries.length}편</span></h2><a class="text-button" href="#journal">내 기록 모두 보기 ↗</a></div>${readingEntries.length?`<div class="entry-grid">${readingEntries.map(entryCard).join('')}</div>`:'<div class="empty"><p>아직 독서 기록이 없어요.<br>오늘 읽은 책에서 첫 이야기를 시작해 보세요.</p></div>'}</section>`;}
function renderWork(){const workEntries=entries.filter(entry=>entry.type==='일');return `${heading('WORK & POSSIBILITY','내가 좋아하는 일, 내가 할 수 있는 일','지금까지의 경험과 새로 배운 것을 나의 다음 일로 연결해 보세요.')}<section class="prompt-card reading-prompt"><p class="eyebrow">MY NEXT CHAPTER</p><h2>새로운 일의 작은 시작</h2><p>내가 잘하는 일, 해보고 싶은 일, 이번 주에 시도할 작은 한 가지를 적어보세요.</p><button class="primary" data-start-work>일 기록 남기기 ↗</button></section><section class="section"><div class="section-head"><h2>내 일 기록 <span class="caption">${workEntries.length}편</span></h2><a class="text-button" href="#journal">내 기록 모두 보기 ↗</a></div>${workEntries.length?`<div class="entry-grid">${workEntries.map(entryCard).join('')}</div>`:'<div class="empty"><p>아직 일 기록이 없어요.<br>해보고 싶은 일과 오늘의 작은 시도부터 남겨보세요.</p></div>'}</section>`;}
function renderLearn(){return window.jejuLearning.list()+menuRecords('배움');}
function renderJournal(){return window.jejuJournal.renderList(data.entries);}
function renderBook(){return window.jejuBook.render();}
function render(){currentPage=location.hash.slice(1)||'today';if(!pageNames[currentPage])currentPage='today';document.querySelector('#header-label').textContent=pageNames[currentPage];document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===currentPage);if(a.dataset.page===currentPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});main.innerHTML=({today:renderToday,walk:renderWalk,reading:renderReading,learn:renderLearn,work:renderWork,journal:renderJournal,book:renderBook}[currentPage])();if(currentPage==='book')window.jejuBook.refreshStatus();document.title=`${{today:'오늘',walk:'산책',reading:'독서',learn:'배움',work:'일',journal:'내 기록',book:'내 책'}[currentPage]} · 제주 한 권`;}
function showDetail(html){document.querySelector('#dialog-content').innerHTML=html;detail.showModal();}
function openWriter(prompt='',type='일상',place=''){window.jejuJournal.open({prompt,type,place});}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.classList.contains('dialog-close'))button.closest('dialog').close();
 if(button.hasAttribute('data-write')||button.id==='top-write')openWriter();
 if(button.hasAttribute('data-start-work'))openWriter('내가 잘하는 일, 해보고 싶은 일, 이번 주에 시도할 작은 한 가지를 적어보세요.','일');
 if(button.hasAttribute('data-start-reading'))openWriter('읽은 책의 제목과 마음에 남은 부분, 내 삶에 연결되는 생각을 적어보세요.','독서');
 if(button.dataset.prompt!==undefined)openWriter(button.dataset.prompt);
 if(button.dataset.walkFilter){main.innerHTML=renderWalk(button.dataset.walkFilter);main.querySelector(`[data-walk-filter="${button.dataset.walkFilter}"]`).focus();}
 if(button.dataset.learnFilter){main.innerHTML=renderLearn(button.dataset.learnFilter);main.querySelector(`[data-learn-filter="${button.dataset.learnFilter}"]`).focus();}
 if(button.dataset.walk){const w=data.walks.find(w=>w.id===button.dataset.walk);if(w)showDetail(w.sample===false?window.jejuPlaces.details(w):`${badge}${art(w)}<p class="eyebrow">WALK & NOTICE</p><h2>${esc(w.title)}</h2><p class="meta">${esc(w.region)} · ${esc(w.duration)}</p><p>${esc(w.description)}</p><p class="notice">코스 기획 예시입니다. 실제 위치와 경로, 교통·화장실·벤치 정보는 확인이 필요합니다.</p><h3>산책 뒤, 나에게 묻기</h3><p>${esc(w.question)}</p><button class="primary" data-start-walk="${esc(w.id)}">산책 이야기 써보기 ↗</button>`);}
 if(button.dataset.startWalk){const w=data.walks.find(w=>w.id===button.dataset.startWalk);if(w){detail.close();openWriter(w.question,'산책',w.title);}}
 if(button.dataset.learn){const l=data.programs.find(l=>l.id===button.dataset.learn);if(l)showDetail(window.jejuLearning.details(l));}
 if(button.dataset.startLearn){const l=data.programs.find(l=>l.id===button.dataset.startLearn);if(l){detail.close();openWriter(`‘${l.title}’${l.sample?'(프로그램 예시)':''}에서 기억에 남는 배움과 앞으로 해보고 싶은 일은 무엇인가요?`,'배움',[l.institution,l.place].filter(Boolean).join(' · '));}}
 if(button.dataset.entry){const e=allEntries().find(e=>e.id===button.dataset.entry);if(e)showDetail(window.jejuJournal.details(e));}
 if(button.id==='data-info')showDetail(window.jejuPlaces.info());
});
window.addEventListener('hashchange',()=>{if(data){render();window.scrollTo(0,0);main.focus({preventScroll:true});}});
async function init(){await window.jejuJournal.init({onChange:list=>{entries=list;if(data&&currentPage!=='book')render();},notify:toast,showDetail});await window.jejuBook.init({getEntries:()=>entries,notify:toast,onChange:()=>{if(data&&currentPage==='book')render();}});window.jejuLearning.init({onChange:()=>{if(data&&currentPage!=='book')render();},notify:toast});try{const response=await fetch('sample-data.json');if(!response.ok)throw Error('data');data=await response.json();const places=await window.jejuPlaces.load();if(places)data.walks=places;data.programs=await window.jejuLearning.load();render();}catch{main.innerHTML='<div class="empty"><h1>첫 페이지를 불러오지 못했어요.</h1><p>start.ps1로 로컬 서버를 실행한 뒤<br>http://localhost:8000 에 접속해 주세요.</p><button class="outline" onclick="location.reload()">다시 불러오기</button></div>';document.querySelector('#top-write').disabled=true;document.querySelector('#data-info').disabled=true;}}
init();

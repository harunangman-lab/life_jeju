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
const pageNames = {today:'오늘의 제주, 오늘의 나',walk:'걸으며 발견하는 나의 속도',reading:'책 속에서 만나는 나의 이야기',learn:'새로운 나를 만나는 배움',journal:'작은 일상이 이야기가 되는 곳',book:'내 이름으로 완성할 한 권'};
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
function renderWalk(filter){if(window.jejuPlaces.isLoaded())return window.jejuPlaces.list(filter);filter=filter||'전체';return `${heading('WALK & NOTICE','천천히 걸어도 좋아요','풍경을 만나고, 마음에 남은 한 장면을 기록해보세요.')}<p class="notice">아래 코스와 시간은 예시입니다. 실제 경로·시설·운영 정보는 제공하지 않습니다.</p><div class="filters" aria-label="산책 테마">${['전체','바다','숲','마을'].map(t=>`<button class="chip ${filter===t?'active':''}" aria-pressed="${filter===t}" data-walk-filter="${t}">${t}</button>`).join('')}</div><div class="cards">${data.walks.filter(w=>filter==='전체'||w.theme===filter).map(walkCard).join('')}</div>`;}
function renderReading(){const readingEntries=entries.filter(entry=>entry.type==='독서');return `${heading('READ & REFLECT','책 속에서, 나를 만나는 시간','마음에 남은 문장과 나의 생각을 한 편의 기록으로 남겨보세요.')}<section class="prompt-card reading-prompt"><p class="eyebrow">MY READING NOTE</p><h2>오늘 읽은 책, 오늘의 나</h2><p>읽은 책의 제목과 마음에 남은 부분, 내 삶에 연결되는 생각을 적어보세요.</p><button class="primary" data-start-reading>독서 기록 남기기 ↗</button></section><section class="section"><div class="section-head"><h2>내 독서 기록 <span class="caption">${readingEntries.length}편</span></h2><a class="text-button" href="#journal">내 기록 모두 보기 ↗</a></div>${readingEntries.length?`<div class="entry-grid">${readingEntries.map(entryCard).join('')}</div>`:'<div class="empty"><p>아직 독서 기록이 없어요.<br>오늘 읽은 책에서 첫 이야기를 시작해 보세요.</p></div>'}</section>`;}
function renderLearn(){return window.jejuLearning.list();}
function renderJournal(){return window.jejuJournal.renderList(data.entries);}
function renderBook(){return `${heading('YOUR VERY OWN BOOK','나의 사계절이, 한 권으로','오늘의 작은 기록이 모여 나만의 이야기가 됩니다.')}<p class="notice">책 미리보기 화면입니다. 직접 쓴 기록만 아래에 모입니다. 목차 편집·EPUB 생성·서점 출간 기능은 다음 단계에서 연결할 수 있어요.</p><div class="book-layout"><div class="book-cover"><p>제주에서 쓰는 나의 이야기</p><h2>나를 만나는<br>사계절</h2><span class="cover-leaf" aria-hidden="true">❧</span><p>나의 첫 번째 책 · 표지 예시</p></div><div><p class="eyebrow">MY MANUSCRIPT</p><h2>나의 원고 모아보기</h2><p class="muted">직접 남긴 기록 ${entries.length}편</p>${entries.length?entries.map((e,i)=>`<article class="chapter"><p class="eyebrow">${String(i+1).padStart(2,'0')} · ${esc(e.type)}</p><h3>${esc(e.title)}</h3>${window.jejuPhotos.markup(e.photoId)}<p>${esc(e.body)}</p></article>`).join(''):'<div class="empty" style="margin-top:25px"><p>아직 비어 있는 첫 페이지.<br>오늘의 이야기로 시작해볼까요?</p><button class="primary" data-write="">첫 기록 남기기</button></div>'}</div></div>`;}
function render(){currentPage=location.hash.slice(1)||'today';if(!pageNames[currentPage])currentPage='today';document.querySelector('#header-label').textContent=pageNames[currentPage];document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===currentPage);if(a.dataset.page===currentPage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});main.innerHTML=({today:renderToday,walk:renderWalk,reading:renderReading,learn:renderLearn,journal:renderJournal,book:renderBook}[currentPage])();document.title=`${{today:'오늘',walk:'산책',reading:'독서',learn:'배움',journal:'내 기록',book:'내 책'}[currentPage]} · 제주 한 권`;}
function showDetail(html){document.querySelector('#dialog-content').innerHTML=html;detail.showModal();}
function openWriter(prompt='',type='일상',place=''){window.jejuJournal.open({prompt,type,place});}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.classList.contains('dialog-close'))button.closest('dialog').close();
 if(button.hasAttribute('data-write')||button.id==='top-write')openWriter();
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
async function init(){await window.jejuJournal.init({onChange:list=>{entries=list;if(data)render();},notify:toast,showDetail});window.jejuLearning.init({onChange:()=>{if(data)render();},notify:toast});try{const response=await fetch('sample-data.json');if(!response.ok)throw Error('data');data=await response.json();const places=await window.jejuPlaces.load();if(places)data.walks=places;data.programs=await window.jejuLearning.load();render();}catch{main.innerHTML='<div class="empty"><h1>첫 페이지를 불러오지 못했어요.</h1><p>start.ps1로 로컬 서버를 실행한 뒤<br>http://localhost:8000 에 접속해 주세요.</p><button class="outline" onclick="location.reload()">다시 불러오기</button></div>';document.querySelector('#top-write').disabled=true;document.querySelector('#data-info').disabled=true;}}
init();

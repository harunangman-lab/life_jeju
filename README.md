# 제주 한 권

HTML·CSS·JavaScript로 만든 제주 1년살기 앱 첫 버전입니다. 로그인 및 외부 서비스 연결 없이 동작합니다.

## 실행

이 폴더에서 PowerShell로 `powershell -ExecutionPolicy Bypass -File .\start.ps1`을 실행한 뒤 브라우저에서 http://localhost:8000 을 엽니다. 종료는 Ctrl+C입니다. 실행 정책 변경은 해당 프로세스에만 적용됩니다.

HTML을 직접 더블클릭하면 JSON을 읽지 못할 수 있으므로 로컬 서버를 사용하세요.

## 구성

- index.html: 화면 기본 구조와 팝업
- styles.css: 아이보리·숲색 반응형 디자인
- app.js: 메뉴, 필터, 상세 팝업, 기록 작성, 책 미리보기
- sample-data.json: 글감·가상 산책·가상 배움·체험 기록
- assets/jeju-landscape.svg: 로컬 일러스트

기존 CSV는 기준연월·지역·방문 집계 또는 소비 집계 중심이며 자료별 지역 코드가 다릅니다. 첫 버전에서는 원본 CSV·PDF를 수정하거나 직접 연결하지 않았습니다. 실제 강좌·운영시간·가격 정보는 생성하지 않았습니다.

## 확인

1. 다섯 메뉴를 이동하고 모바일 폭에서 가로 스크롤이 없는지 확인합니다.
2. 산책·배움의 필터, 상세 팝업과 Esc 닫기를 확인합니다.
3. 기록을 저장하고 새로고침 후에도 남는지 확인합니다.
4. 내 책에서 직접 쓴 기록만 보이는지 확인합니다.
5. 예시 데이터 표시와 데이터 안내를 확인합니다.

직접 작성한 글은 이 브라우저의 localStorage에만 저장됩니다. 브라우저 데이터 삭제 시 사라지고 다른 기기로 동기화되지 않습니다. 중요한 원고는 별도로 보관하세요. 예시 기록은 개인 기록 통계나 책 원고에 포함되지 않습니다. EPUB 생성·출간·강좌 신청은 이번 버전의 기능이 아닙니다.

## GitHub와 Vercel 배포

1. GitHub에서 새 저장소를 만들고 앱 소스를 올립니다. `.gitignore`는 허용된 앱 파일만 추적하도록 구성되어 있습니다. 브라우저에서 수동 업로드할 때는 이 규칙이 적용되지 않으므로 CSV·PDF·XLSX·HWP·tmp 폴더를 직접 업로드하지 마세요.
2. 저장소 루트에 index.html, styles.css, app.js, sample-data.json, assets/jeju-landscape.svg, build.mjs, vercel.json이 있어야 합니다. README.md, start.ps1, .gitignore, .vercelignore도 함께 보관합니다.
3. Vercel에서 Add New → Project → 해당 GitHub 저장소를 Import합니다.
4. Framework Preset은 Other, Root Directory는 저장소 루트(./), Build Command는 node build.mjs, Output Directory는 dist입니다. vercel.json에 이 설정을 담았습니다. 별도 패키지 설치나 환경변수는 필요하지 않습니다.
5. Deploy 후 첫 화면, 산책·배움 카드, 기록 저장과 새로고침, 내 책을 확인합니다.

Node.js가 설치된 환경에서는 `node build.mjs`로 배포 파일만 dist에 생성할 수 있습니다. dist에는 웹앱용 5개 파일만 들어갑니다. 원본 데이터와 로컬 실행 스크립트는 서비스되지 않습니다.

첫 배포 주소와 localhost는 서로 다른 저장 공간입니다. 로컬에서 쓴 기록은 배포 주소로 자동 이전되지 않습니다. 배포 후에도 기록은 접속한 브라우저에만 저장됩니다.

공식 설정 참고: https://vercel.com/docs/builds/configure-a-build

---
title: Finder의 이력서 PDF와 그림을 미리보기 앱으로 열기
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: Finder 문서 아래에 이력서·포트폴리오·자격증 폴더를 두고, PDF와 그림은 macOS처럼 따로 뜨는 미리보기 앱에서 연다. 파일은 저장소가 아니라 Cloudflare R2에 두고 사이트 Worker가 같은 주소(/files/)로 내준다. 관리자는 끌어다 놓아 R2에 바로 올린다.
---

Finder는 사이트에 있는 것(저장소 문서, 프로젝트, 블로그 글, 앱)을 파일처럼 보여 준다. 그런데 포트폴리오 사이트에서 가장 먼저 찾을 파일인 이력서는 없었다. 빈 이력서 폴더에 "준비하고 있습니다"라는 안내만 있었다. 이번에 PDF와 그림을 열 수 있는 길을 만들었다. PR은 [#255](https://github.com/hyeoniverse/MacFolio/pull/255)이고, 커밋 18개, 파일 60개, +4,897/−111이다.

## 파일을 어디에 두나

저장소는 공개다. `public/`에 이력서를 넣으면 누구나 받을 수 있고, 나중에 정리한 파일로 바꿔도 옛 파일이 git 기록에 남는다. 그래서 파일은 Cloudflare R2 버킷에 두고, 저장소에는 "어느 폴더에 무엇을 보일지"만 적는다(`finder/documents.ts`).

| 무엇         | 어디에                             |
| ------------ | ---------------------------------- |
| 파일 내용    | R2 버킷 `macfolio-files`           |
| 폴더·이름·키 | `documents.ts` (저장소)            |
| 주소         | `/files/<키>` (사이트와 같은 주소) |

## 같은 주소로 내주기

PDF를 iframe에 띄우려면 CSP의 `frame-src`가 그 주소를 허용해야 한다. R2의 공개 주소(`*.r2.dev`)를 쓰면 출처를 하나 더 열어야 한다. 대신 사이트 Worker가 `/files/<키>`를 R2에서 읽어 내주게 했다. 같은 출처라 `frame-src 'self'`를 그대로 쓴다.

Worker는 다음을 지킨다.

- 확장자는 pdf·png·jpg·jpeg·webp만 받는다. `..`, 빈 경로 조각, 백슬래시, 제어 문자가 든 키는 버킷을 읽기 전에 404로 끝낸다
- GET·HEAD가 아니면 405
- `ETag`와 `If-None-Match`로 304를 주고, `Cache-Control: public, max-age=300`으로 짧게 캐시한다
- `Content-Disposition`은 기본이 `inline`이고 `?download=1`이면 `attachment`다. 한글 이름은 `filename*`에 넣는다
- 파일 응답에는 따로 좁은 CSP(`default-src 'none'; frame-ancestors 'self'`)를 붙여 이 사이트 안의 iframe에만 들어가게 한다. `sandbox`는 Chrome의 PDF 보기를 막아서 쓰지 않았다
- 바인딩이 없는 곳(로컬 개발)에서는 오류 대신 404

![/files/<키> 요청이 Worker에서 거르는 순서: 메서드 → 키 모양 → 버킷 → ETag → Range](./images/finder-files-worker-checks.svg '키가 이상하면 버킷을 읽기 전에 끝낸다')

```ts
// apps/react/worker/files.ts (키 거르기 일부)
if (!key || key.length > 512) return null;
if (/[\u0000-\u001f\u007f\\]/.test(key)) return null; // 제어 문자·백슬래시
if (parts.some((part) => part === '' || part === '.' || part === '..')) return null; // 경로 바꾸기
return key.slice(dot + 1).toLowerCase() in FILE_TYPES ? key : null; // 허용한 확장자만
```

## Finder에서 열면 미리보기 앱이 뜬다

문서 폴더 아래에 이력서·포트폴리오·자격증 폴더를 따로 두었다. 빈 폴더는 폴더마다 다른 안내를 보인다. 파일 종류에는 `pdf`와 `image`를 더했다.

처음에는 Finder 창 안에서 파일을 보여 줬다. 그런데 진짜 Mac에서는 Finder에서 PDF를 두 번 누르면 **미리보기** 앱이 따로 뜬다. 이 사이트는 macOS를 흉내 내는 것이 목적이라, 같은 흐름으로 바꿨다.

- 미리보기 앱(`apps/preview`)을 새로 두었다. Launchpad에 있고, Finder에서 PDF·그림을 열면 창이 뜬다. Finder는 보던 폴더에 그대로 있다
- PDF는 pdf.js로 쪽을 직접 그린다. 처음에는 브라우저 PDF 보기를 iframe에 띄웠는데, 창 안에 Chrome의 검은 도구 막대가 보여 미리보기 같지 않았다
  - 쪽이 회색 바탕에 세로로 이어지고, 화면 가까이 온 쪽만 그린다
  - 왼쪽 사이드바에 쪽 그림, 위 막대에 "1/3페이지"
  - 보이지 않는 글자 층을 겹쳐 글자를 고르고 복사할 수 있다. ⌘F로 찾으면 찾은 말이 노랗게, 고른 결과는 주황으로 칠해진다
  - ←→로 쪽 넘기기, 메뉴 막대의 보기·이동에 실제 크기(⌘0)·맞추기·확대·축소·쪽 이동
  - pdf.js 6의 기본 빌드는 `Map.getOrInsertComputed` 같은 아주 새 문법을 써서 Safari에서 깨진다. legacy 빌드를 쓰고, 미리보기 창을 처음 열 때만 불러온다
- 그림은 창에 맞춰 보이고, 도구 막대의 배율로 실제 크기(100%)와 확대·축소를 오간다. 배율은 파일마다 기억한다
- 파일을 둘 이상 열면 사이드바에서 파일마다 묶인다. 눌러서 바꾸고 ×로 닫는다
- 도구 막대에 다운로드(`?download=1`)와 새 창에서 열기가 있다
- 모양은 macOS 26 미리보기의 화면을 옆에 두고 맞췄다
  - 창 위부터 아래까지 떠 있는 둥근 사이드바, 고른 쪽은 파란 칸에 흰 번호
  - 버튼은 둥근 유리 칸으로 묶고(배율 / 회전 / 정보·공유), 아이콘은 SF Symbols처럼 가는 선(lucide)으로 그렸다
  - 파일 없이 열면 창 전체가 열기 창이 된다: 둥근 사이드바, 뒤로·앞으로·보기·위치·검색 막대, 아래 오른쪽에 취소·열기. 처음 고른 곳은 최근 항목이 아니라 macOS처럼 "미리보기 — iCloud" 폴더(모든 문서). 사이드바의 즐겨찾기와 폴더는 Finder와 같은 트리(`useLocations`)라 문서·블로그·응용 프로그램을 두 번 눌러 들어가고 뒤로·앞으로로 오간다. 미리보기가 열 수 없는 Markdown·글·앱은 macOS처럼 흐리게 보인다
  - 빨간 버튼으로 닫거나 앱을 끄면 열린 파일을 비운다. 다시 열면 이전 파일이 아니라 열기 창부터
  - 응용 프로그램 위치 아이콘은 격자 대신 macOS Finder처럼 막대 세 개가 엇갈린 "A"(`AppsGlyph`)
- 프로젝트도 실제 OS처럼 프로젝트마다 폴더다. 프로젝트 폴더들은 따로 된 위치 없이 **문서 › 포트폴리오** 안에 있다(폴더가 위에 이름순, 그다음 포트폴리오 파일). **문서 › 포트폴리오 › MacFolio**를 열면 **사진** 폴더와 올린 파일(발표 자료 PDF 등)이 보인다. 실행하는 앱은 실제 Mac처럼 응용 프로그램에만 두고 프로젝트 폴더에는 넣지 않는다
  - 사진 앱의 사진은 따로 된 위치 없이 이 사진 폴더에만 있다. 그림은 미리보기에서 열고, R2 파일이 아니라 사이트에 있는 파일이라 키가 주소(`/imgs/…`)면 `fileUrl`이 그대로 돌려준다
  - 관리자가 프로젝트 폴더(또는 그 아이콘 위)에 파일을 놓으면 폴더 값 `project:<id>`로 올라가고, R2 키는 `projects/<id>/<무작위>.<확장자>`다. DB의 CHECK 제약이 폴더와 키 앞부분이 맞는지 본다
- 블로그 폴더는 메모의 정리 내용(옮긴 글·옮긴 폴더·만든 폴더)을 그대로 따른다. 글이 없는 빈 폴더도 메모 사이드바처럼 보인다
- 미리보기는 실제 macOS처럼 Markdown을 열지 않는다(텍스트 편집기·훑어보기가 맡는다). 그래서 열기 창에서 흐리게 둔다
  - 휴대폰 파일 앱의 둘러보기도 같은 구조다: 위치에 iCloud 미리보기 폴더(PDF·그림 전부, `previewFolder`), 즐겨찾기에 Finder 위치
  - 앱 아이콘도 macOS 26처럼 파란 둥근 네모 위의 보석 감정용 루페로 다시 그렸다. 다른 앱 아이콘처럼 그림을 꽉 채운다
- Finder와 미리보기는 작은 저장소(`previewStore`) 하나로 이어진다. 창이 아직 한 번도 뜨지 않았어도 연 파일이 남아 있다가 창이 뜨면 보인다

![macOS 미리보기에서 PDF를 연 화면. 왼쪽 사이드바에 쪽 썸네일, 위에 둥근 도구 막대](./images/finder-files-macos-preview.jpg '참고한 macOS 미리보기 화면. 둥근 사이드바의 쪽 썸네일과 위쪽 도구 막대 묶음을 이 화면에 맞췄다')

![macOS 미리보기를 켜면 뜨는 열기 창. 사이드바와 미리보기 — iCloud 폴더의 파일](./images/finder-files-macos-open-panel.jpg '참고한 macOS 화면. 미리보기를 파일 없이 켜면 최근 파일이 아니라 이 열기 창이 뜬다(개인 폴더 이름은 가렸다)')

![파일 없이 연 미리보기: 사이드바에 미리보기·최근 항목·즐겨찾기, 아래에 취소·열기](./images/finder-files-preview-open-panel.jpg '파일 없이 열면 창 전체가 열기 창이 된다. 서버 없이 띄운 화면이라 파일 목록은 비어 있다')

휴대폰에는 미리보기 앱이 없다. iOS의 파일 앱은 앱 안에서 바로 훑어보기를 띄우므로, 휴대폰에서는 파일 앱 안에서 화면을 채워 보여 준다.

## 관리자는 끌어다 놓아 올린다

처음에는 파일을 올릴 때마다 `wrangler r2 object put`으로 올리고, `documents.ts`에 한 줄을 더해 PR을 열어야 했다. 이력서 한 장 바꾸는 데 배포가 한 번 필요했다. 그래서 관리자로 로그인하면 Finder의 이력서·포트폴리오·자격증 폴더에 파일을 끌어다 놓아 올리게 했다.

어디에 둘지 두 가지를 따졌다.

| 방식                    | 좋은 점                                   | 아쉬운 점                                                    |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| API 서버의 DB에 파일째  | 이미 있는 업로드 기능을 쓴다              | PDF가 DB와 매일 백업을 키운다. 받을 때마다 1GB 서버를 거친다 |
| R2에 바로, API는 서명만 | 서버는 확인만 하고 파일은 지나가지 않는다 | R2 키와 버킷 CORS를 설정해야 한다                            |

뒤쪽을 골랐다. 흐름은 이렇다.

1. 브라우저가 API에 "이 폴더에 이 이름, 이 크기"를 묻는다. API는 관리자 세션, 종류, 20MB 이하를 확인하고 R2에 바로 PUT할 **서명 주소**를 5분짜리로 준다
2. 브라우저가 그 주소로 R2에 올린다. `XMLHttpRequest`의 `upload.onprogress`로 Finder 아래에 진행률을 보인다 (fetch는 올리는 진행률을 주지 않는다)
3. 다 올리면 API가 R2에 HEAD로 물어 정말 있는지, 크기가 같은지 확인하고 목록(DB의 `Document` 표)에 더한다

![서명 주소로 R2에 바로 올리는 흐름](./images/finder-files-upload.svg 'API는 확인과 서명만, 파일은 브라우저에서 R2로 바로 간다')

서명 주소는 AWS 서명 버전 4를 `node:crypto`로 직접 만들었다. SDK를 들이기엔 쓰는 곳이 서명 하나뿐이다. AWS 문서의 예시 값으로 같은 서명이 나오는지 시험해 두었다. 서명에 `content-length`를 넣어서, 말한 크기와 다른 파일은 R2가 받지 않는다. 키는 서버가 `resume/<무작위>.pdf`처럼 짓기 때문에 브라우저가 경로를 고를 수 없다.

목록도 코드에서 서버로 옮겼다. Finder는 `GET /documents`를 읽고, 시험에서는 전처럼 가짜 목록을 넣는다. 이름 바꾸기와 지우기는 파일을 고르고 메뉴 막대의 파일 메뉴(⌘⌫)에서 한다. 지우면 R2에서도 지운다.

## 실제로 만들며 바뀐 것

10월 18일 오전, 이력서 PDF를 Finder 안에서 보여 주는 첫 안을 보고 진짜 Mac처럼 미리보기 앱을 따로 두기로 했다. 파일은 R2에 두는 방식으로 정했다. 그날 밤까지 고친 순서는 이렇다.

1. 로컬에서 PDF를 올렸더니 미리보기가 "열 수 없습니다"를 띄웠다. `curl -v http://localhost:4000/documents`로 보니 목록에는 파일(`portfolio/….pdf`, 약 11.7MB)이 있었다. 목록이 아니라 파일을 내주는 쪽을 봐야 했다.
2. 첫 미리보기 화면은 macOS와 전혀 비슷하지 않았고 아이콘도 달랐다. 내 Mac의 미리보기 화면(위 사진)을 옆에 두고 다시 맞췄다.
3. 파일 없이 켜면 최근에 연 파일을 보여 줬다. macOS처럼 열기 창을 띄우게 바꿨다.
4. 열기 창에 폴더가 3개만 보였다. Finder와 같은 트리를 쓰게 했고, 휴대폰 파일 앱도 같은 구조로 맞췄다. 미리보기 아이콘만 작아 보여서 그림을 꽉 채웠다.
5. 파일을 열었다가 닫고 다시 켜면 이전 파일이 그대로 열렸다. 닫을 때 열린 파일을 비우게 했다.

## 따라 하기: R2 버킷 붙이기

전체 절차는 저장소의 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md) "문서 파일(R2)" 절에 있다. R2 자체는 [Cloudflare R2 문서](https://developers.cloudflare.com/r2/), PDF를 그리는 라이브러리는 [PDF.js](https://mozilla.github.io/pdf.js/)를 본다. 준비물은 Cloudflare 계정, API 서버에 SSH로 들어갈 수 있는 권한이다.

1. 버킷을 만든다. 이름이 이미 쓰이고 있다고 나오면 예전에 만든 버킷이 있는지 R2 목록부터 본다(내 경우가 그랬다).

```bash
npx wrangler r2 bucket create macfolio-files
```

2. R2 → Manage R2 API Tokens에서 Object Read & Write 토큰을 만들고, 서버의 `~/deploy/api.env`에 네 줄을 넣은 뒤 API를 다시 띄운다.

```bash
R2_ACCOUNT_ID=<계정 ID>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET=macfolio-files
```

3. 버킷 Settings → CORS Policy에 사이트 주소의 PUT을 허용하고, 서버에서 미리 요청(preflight)을 보내 확인한다. `api.env`를 `source`로 읽으면 공백이 든 값(`CONTACT_FROM=MacFolio <…>`)에서 문법 오류가 나므로 `grep`으로 꺼낸다.

```bash
cd ~/deploy
A=$(grep '^R2_ACCOUNT_ID=' api.env | cut -d= -f2-)
B=$(grep '^R2_BUCKET=' api.env | cut -d= -f2-)
curl -si -X OPTIONS "https://$A.r2.cloudflarestorage.com/$B/desktop/test.gif" \
  -H "Origin: https://macfolio.hyeoniverse.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" | head -8
```

기대 출력은 `HTTP/1.1 204 No Content`와 `Access-Control-Allow-Origin: https://macfolio.hyeoniverse.com`, `Access-Control-Allow-Methods: PUT`이다. 내 서버에서도 이렇게 나왔다.

4. 그래도 올리기가 실패하면 키를 의심한다. `curl --aws-sigv4 "aws:amz:auto:s3" --user "$KEY:$SECRET" -T 파일 "$주소"`로 직접 올려 보고, `SignatureDoesNotMatch`가 나오면 키를 다시 만들어 넣는다. 키 길이는 보통 32자와 64자다.

되돌리려면 `api.env`에서 네 줄을 지우고 API를 다시 띄운다. 목록은 그대로 보이고 올리기·지우기만 "서버에 파일 저장소(R2)가 설정되지 않았습니다"로 막힌다.

## 시험

- 파일 목록 → 폴더 변환은 시험용 목록을 함수 인자로 넣어 확인한다
- Worker는 메모리 버킷으로 헤더, 304, 405, 경로 막기, 바인딩 없음을 확인한다
- 화면 시험은 Finder에서 열면 미리보기 창이 뜨는지, 배율과 사이드바가 맞는지 본다. `window.__MACFOLIO_DOCUMENTS__`로 시험용 목록을 넣고, `page.route`로 `/files/*`에 시험 중에 만든 작은 PDF·PNG를 준다
- 올리기 시험은 가짜 API(`/documents`)와 가짜 R2 주소를 두고, Finder에 파일을 놓으면 R2에 PUT이 한 번 가고 목록에 생기는지, 받지 않는 종류는 막는지, 방문자는 올라가지 않는지 본다
- 서버는 서명 주소(AWS 예시 값), 키 모양, HEAD 확인, 확장자 지키기, 지울 때 R2 오류를 시험한다

- Worker 단위 시험(`apps/react/worker/files.test.ts`)는 지금 17개다. "허용한 확장자의 키만", "경로 바꾸기를 막는다", "PDF를 그 종류·캐시·ETag와 inline으로 준다", "사이트 안 iframe에만 들어가고, 그 밖은 막는다", "?download=1이면 attachment, 한글 이름은 filename*에", "If-None-Match가 맞으면 304", "없는 파일, 허용하지 않는 키는 404 (버킷을 읽지 않는다)", "GET·HEAD가 아니면 405", "바인딩이 없으면(로컬·미리보기) 404" 등이다. Range(206·416) 시험은 뒤에 동영상을 위해 더해졌다.

## 숫자

| 항목                                       | 줄 수           |
| ------------------------------------------ | --------------- |
| 미리보기 앱 `Preview.tsx`·`Preview.css`    | 514 · 666       |
| PDF 보기 `PdfView.tsx`                     | 324             |
| 열기 창 `OpenPanel.tsx`                    | 223             |
| Worker `files.ts` (지금)                   | 179             |
| API `documents/` (서비스·컨트롤러·R2 서명) | 151 · 109 · 104 |

## 남은 것과 배운 것

- 미리보기는 PDF·그림만 연다. Markdown·글은 macOS처럼 열지 않고 흐리게 둔다. 동영상은 뒤에 QuickTime Player 앱이 맡았다.
- R2 공개 주소를 쓰지 않으니 파일 응답이 모두 Worker를 거친다. 지금은 파일이 적고 캐시(`max-age=300`, ETag 304)가 있어 문제가 없다. 큰 파일이 늘면 R2 사용자 지정 도메인을 따로 두는 것도 생각할 수 있다. 그러면 CSP에 출처를 하나 더 열어야 한다.
- 서명 주소는 5분짜리다. 아주 느린 연결에서 20MB를 올리면 시간이 모자랄 수 있다. 아직 그런 경우는 없었다.

배운 것: "공개 저장소에 무엇을 두지 않을 것인가"를 먼저 정하니 파일 위치(R2)와 주소(같은 출처)가 따라 정해졌다. 같은 출처로 내주면 CSP를 넓히지 않아도 된다. 그리고 큰 파일은 API 서버를 거치지 않게 하는 것이 1GB 서버에 맞는 방식이었다. 서버는 "누가, 어디에, 얼마나"만 확인하고 서명해 준다.

관련 글: [Finder 앱](/memo/finder-app), [Finder 폴더를 데스크톱처럼](/memo/finder-filesystem), [올린 파일 규칙을 둘로 나누기](/memo/contracts-files).

올릴 때는 전화번호, 주소, 생년월일, 신분 번호를 지운 공개용 파일만 올린다.

#MacFolio #프론트엔드 #Finder #미리보기 #pdfjs #CloudflareR2 #CSP #업로드

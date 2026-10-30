---
title: Cloudflare R2 파일을 Worker가 같은 출처 /files/로 제공하기
date: 2026-10-18
category: 개발 기록/MacFolio/기능 구현
series: Finder
seriesOrder: 2
summary: Finder 문서 아래에 이력서·포트폴리오·자격증 폴더를 만들고, PDF와 그림은 macOS처럼 별도 창의 미리보기 앱에서 연다. 파일은 저장소가 아니라 Cloudflare R2에 보관하고 사이트 Worker가 같은 출처(/files/)로 제공한다. 관리자는 끌어다 놓아 R2에 바로 업로드한다.
---

Finder는 사이트의 데이터(저장소 문서, 프로젝트, 블로그 글, 앱)를 파일 형태로 표시한다. 그런데 포트폴리오 사이트에서 가장 먼저 찾는 파일인 이력서가 없었다. 빈 이력서 폴더에 "준비하고 있습니다"라는 안내만 있었다. 이번에 PDF와 그림을 여는 기능을 만들었다. PR은 [#255](https://github.com/hyeoniverse/MacFolio/pull/255)이고, 커밋 18개, 파일 60개, +4,897/−111이다.

## 파일 보관 위치

저장소는 공개다. `public/`에 이력서를 넣으면 누구나 내려받을 수 있고, 나중에 파일을 교체해도 이전 파일이 git 기록에 남는다. 그래서 파일은 [Cloudflare R2](https://developers.cloudflare.com/r2/) 버킷에 보관하고, 저장소에는 "어느 폴더에 어떤 파일을 표시할지"만 기록한다(`finder/documents.ts`).

| 항목         | 보관 위치                          |
| ------------ | ---------------------------------- |
| 파일 내용    | R2 버킷 `macfolio-files`           |
| 폴더·이름·키 | `documents.ts` (저장소)            |
| 주소         | `/files/<키>` (사이트와 같은 출처) |

## 같은 출처로 제공하기

PDF를 iframe에 표시하려면 [CSP](https://developer.mozilla.org/ko/docs/Web/HTTP/CSP)의 [`frame-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-src)가 그 주소를 허용해야 한다. R2의 공개 주소(`*.r2.dev`)를 쓰면 허용할 출처가 하나 늘어난다. 대신 사이트 Worker가 `/files/<키>` 요청을 받아 R2에서 읽어 응답하게 했다. 같은 출처라 `frame-src 'self'`를 그대로 쓴다.

Worker의 검사 규칙은 다음과 같다.

| 항목                  | 규칙                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 확장자                | pdf·png·jpg·jpeg·webp만 허용. `..`, 빈 경로 조각, 백슬래시, 제어 문자가 포함된 키는 버킷을 읽기 전에 404                                                  |
| 메서드                | GET·HEAD 외에는 405                                                                                                                                       |
| 캐시                  | `ETag`와 `If-None-Match`로 304 응답, `Cache-Control: public, max-age=300`으로 5분 캐시                                                                    |
| `Content-Disposition` | 기본은 `inline`, `?download=1`이면 `attachment`. 한글 이름은 `filename*`에 넣는다                                                                         |
| 파일 응답의 CSP       | 별도의 좁은 CSP(`default-src 'none'; frame-ancestors 'self'`)로 이 사이트 안의 iframe에만 삽입 가능. `sandbox`는 Chrome의 PDF 뷰어를 차단해서 쓰지 않았다 |
| 바인딩 없음           | R2 바인딩이 없는 환경(로컬 개발)에서는 오류 대신 404                                                                                                      |

![/files/<키> 요청을 Worker가 검사하는 순서: 메서드 → 키 형식 → 버킷 → ETag → Range](./images/finder-files-worker-checks.svg '키 형식이 잘못되면 버킷을 읽기 전에 응답을 끝낸다')

```ts
// apps/react/worker/files.ts (키 검사 일부)
if (!key || key.length > 512) return null;
if (/[\u0000-\u001f\u007f\\]/.test(key)) return null; // 제어 문자·백슬래시
if (parts.some((part) => part === '' || part === '.' || part === '..')) return null; // 경로 조작
return key.slice(dot + 1).toLowerCase() in FILE_TYPES ? key : null; // 허용한 확장자만
```

## Finder에서 열면 미리보기 앱 실행

문서 폴더 아래에 이력서·포트폴리오·자격증 폴더를 만들었다. 빈 폴더는 폴더마다 다른 안내를 표시한다. 파일 종류에는 `pdf`와 `image`를 추가했다.

처음에는 Finder 창 안에서 파일을 표시했다. 그런데 실제 Mac에서는 Finder에서 PDF를 더블 클릭하면 **미리보기** 앱이 별도 창으로 실행된다. 이 사이트의 목적은 macOS 재현이라 같은 흐름으로 바꿨다.

- 미리보기 앱(`apps/preview`)을 새로 추가했다. Launchpad에 있고, Finder에서 PDF·그림을 열면 창이 열린다. Finder는 보던 폴더를 그대로 유지한다
- Finder와 미리보기는 작은 store(`previewStore`) 하나로 연결된다. 창이 아직 한 번도 열리지 않았어도 연 파일 정보가 store에 남아 있다가 창이 열리면 표시된다
- 휴대폰에는 미리보기 앱이 없다. iOS 파일 앱은 앱 안에서 훑어보기를 표시하므로, 휴대폰에서는 파일 앱 안에서 전체 화면으로 표시한다

### PDF 렌더링

PDF는 [PDF.js](https://mozilla.github.io/pdf.js/)로 페이지를 직접 렌더링한다. 처음에는 브라우저 PDF 뷰어를 iframe에 표시했는데, 창 안에 Chrome의 검은 도구 막대가 보여 macOS 미리보기와 달랐다.

| 기능        | 동작                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 페이지 표시 | 회색 배경에 세로로 이어 배치하고, 화면 근처에 들어온 페이지만 렌더링                                                                                   |
| 사이드바    | 왼쪽에 페이지 썸네일, 위 막대에 "1/3페이지"                                                                                                            |
| 텍스트 선택 | 투명한 텍스트 레이어를 겹쳐 글자를 선택·복사할 수 있다. ⌘F로 검색하면 일치 항목은 노란색, 선택한 결과는 주황색                                         |
| 이동·배율   | ←→로 페이지 이동, 메뉴 막대의 보기·이동에 실제 크기(⌘0)·맞추기·확대·축소·페이지 이동                                                                   |
| 호환성      | pdf.js 6의 기본 빌드는 `Map.getOrInsertComputed` 같은 최신 문법을 써서 Safari에서 오류가 난다. legacy 빌드를 쓰고, 미리보기 창을 처음 열 때만 불러온다 |

그림은 창 크기에 맞춰 표시하고, 도구 막대의 배율로 실제 크기(100%)와 확대·축소를 전환한다. 배율은 파일마다 저장한다. 파일을 두 개 이상 열면 사이드바에 파일별로 묶여 표시되고, 클릭으로 전환하고 ×로 닫는다. 도구 막대에는 다운로드(`?download=1`)와 새 창에서 열기 버튼이 있다.

### macOS 26 미리보기와 같은 외형

외형은 macOS 26 미리보기 화면을 옆에 두고 맞췄다.

![macOS 미리보기에서 PDF를 연 화면. 왼쪽 사이드바에 페이지 썸네일, 위에 둥근 도구 막대](./images/finder-files-macos-preview.jpg '참고한 macOS 미리보기 화면. 둥근 사이드바의 페이지 썸네일과 위쪽 도구 막대 묶음을 이 화면에 맞췄다')

<details>
<summary>외형과 열기 창 세부 사항</summary>

- 창 위부터 아래까지 이어지는 둥근 사이드바, 선택한 페이지는 파란 칸에 흰 번호
- 버튼은 둥근 유리 칸으로 묶고(배율 / 회전 / 정보·공유), 아이콘은 SF Symbols와 비슷한 가는 선 아이콘([lucide](https://lucide.dev/))을 썼다
- 파일 없이 실행하면 창 전체가 열기 창이 된다: 둥근 사이드바, 뒤로·앞으로·보기·위치·검색 막대, 오른쪽 아래에 취소·열기. 처음 선택된 위치는 최근 항목이 아니라 macOS처럼 "미리보기 — iCloud" 폴더(모든 문서)다
- 열기 창 사이드바의 즐겨찾기와 폴더는 Finder와 같은 트리(`useLocations`)라, 문서·블로그·응용 프로그램을 더블 클릭해 들어가고 뒤로·앞으로로 이동한다. 미리보기가 열 수 없는 Markdown·글·앱은 macOS처럼 비활성 색으로 표시한다
- 빨간 버튼으로 창을 닫거나 앱을 종료하면 열린 파일 목록을 비운다. 다시 실행하면 이전 파일이 아니라 열기 창부터 표시한다
- 응용 프로그램 위치 아이콘은 격자 대신 macOS Finder처럼 막대 세 개가 교차한 "A"(`AppsGlyph`)
- 앱 아이콘도 macOS 26처럼 파란 둥근 사각형 위의 보석 감정용 루페로 다시 그렸다. 다른 앱 아이콘처럼 그림이 아이콘 영역을 가득 채운다
- 미리보기는 실제 macOS처럼 Markdown을 열지 않는다(텍스트 편집기·훑어보기의 역할이다). 휴대폰 파일 앱의 둘러보기도 같은 구조다: 위치에 iCloud 미리보기 폴더(PDF·그림 전체, `previewFolder`), 즐겨찾기에 Finder 위치

</details>

![macOS 미리보기를 실행하면 표시되는 열기 창. 사이드바와 미리보기 — iCloud 폴더의 파일](./images/finder-files-macos-open-panel.jpg '참고한 macOS 화면. 미리보기를 파일 없이 실행하면 최근 파일이 아니라 이 열기 창이 표시된다(개인 폴더 이름은 가렸다)')

![파일 없이 실행한 미리보기: 사이드바에 미리보기·최근 항목·즐겨찾기, 아래에 취소·열기](./images/finder-files-preview-open-panel.jpg '파일 없이 실행하면 창 전체가 열기 창이 된다. 서버 없이 실행한 화면이라 파일 목록은 비어 있다')

### 프로젝트 폴더와 블로그 폴더

- 프로젝트도 실제 OS처럼 프로젝트마다 폴더가 있다([#261](https://github.com/hyeoniverse/MacFolio/pull/261)). 프로젝트 폴더는 별도 위치 없이 **문서 › 포트폴리오** 안에 있다(폴더가 위에 이름순, 그다음 포트폴리오 파일). **문서 › 포트폴리오 › MacFolio**를 열면 **사진** 폴더와 업로드한 파일(발표 자료 PDF 등)이 표시된다. 실행하는 앱은 실제 Mac처럼 응용 프로그램에만 두고 프로젝트 폴더에는 넣지 않는다
- 사진 앱의 사진은 별도 위치 없이 이 사진 폴더에만 있다. 그림은 미리보기에서 열고, R2 파일이 아니라 사이트의 정적 파일이라 키가 주소(`/imgs/…`)면 `fileUrl`이 그 주소를 그대로 반환한다
- 관리자가 프로젝트 폴더(또는 그 아이콘 위)에 파일을 놓으면 폴더 값 `project:<id>`로 업로드되고, R2 키는 `projects/<id>/<무작위>.<확장자>`다. DB의 CHECK 제약이 폴더 값과 키 접두사가 일치하는지 검사한다
- 블로그 폴더는 메모의 정리 내용(옮긴 글·옮긴 폴더·만든 폴더)을 그대로 따른다. 글이 없는 빈 폴더도 메모 사이드바처럼 표시한다([#260](https://github.com/hyeoniverse/MacFolio/pull/260))

## 관리자 업로드: 끌어다 놓기

처음에는 파일을 올릴 때마다 `wrangler r2 object put`으로 업로드하고, `documents.ts`에 한 줄을 추가해 PR을 열어야 했다. 이력서 한 장을 교체하는 데 배포가 한 번 필요했다. 그래서 관리자로 로그인하면 Finder의 이력서·포트폴리오·자격증 폴더에 파일을 끌어다 놓아 업로드하게 했다.

업로드 경로는 두 방식을 비교했다.

| 방식                        | 장점                                           | 단점                                                                         |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| API 서버의 DB에 파일째 저장 | 기존 업로드 기능을 쓴다                        | PDF가 DB와 일일 백업 크기를 늘린다. 내려받을 때마다 1GB 메모리 서버를 거친다 |
| R2에 직접, API는 서명만     | 서버는 검사만 하고 파일 데이터는 거치지 않는다 | R2 키와 버킷 CORS를 설정해야 한다                                            |

뒤쪽을 선택했다. 흐름은 다음과 같다.

1. 브라우저가 API에 "이 폴더, 이 이름, 이 크기"로 업로드를 요청한다. API는 관리자 세션, 파일 종류, 20MB 이하를 확인하고 R2에 직접 PUT할 **서명 URL**(presigned URL)을 유효 시간 5분으로 발급한다
2. 브라우저가 그 URL로 R2에 업로드한다. `XMLHttpRequest`의 [`upload.onprogress`](https://developer.mozilla.org/ko/docs/Web/API/XMLHttpRequest/upload)로 Finder 아래에 진행률을 표시한다 (fetch는 업로드 진행률을 제공하지 않는다)
3. 업로드가 끝나면 API가 R2에 HEAD 요청을 보내 파일이 실제로 있는지, 크기가 일치하는지 확인하고 목록(DB의 `Document` 테이블)에 추가한다

![서명 URL로 R2에 직접 업로드하는 흐름](./images/finder-files-upload.svg 'API는 검사와 서명만 하고, 파일은 브라우저에서 R2로 직접 전송된다')

서명 URL은 [AWS 서명 버전 4](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html)를 `node:crypto`로 직접 구현했다. 서명 하나 때문에 SDK를 의존성에 추가하지 않았다. AWS 문서의 예시 값으로 같은 서명이 나오는지 시험으로 확인했다. 서명에 `content-length`를 포함해서, 요청한 크기와 다른 파일은 R2가 거부한다. 키는 서버가 `resume/<무작위>.pdf`처럼 생성하므로 브라우저가 경로를 지정할 수 없다.

파일 목록도 코드에서 서버로 옮겼다. Finder는 `GET /documents`를 조회하고, 시험에서는 기존처럼 가짜 목록을 넣는다. 이름 변경과 삭제는 파일을 선택하고 메뉴 막대의 파일 메뉴(⌘⌫)에서 한다. 삭제하면 R2 객체도 삭제한다.

## 개발 과정에서 바뀐 것

10월 18일 오전, 이력서 PDF를 Finder 안에서 표시하는 첫 구현을 확인하고 실제 Mac처럼 미리보기 앱을 별도로 두기로 했다. 파일은 R2에 보관하기로 정했다. 같은 날 밤까지 수정한 순서는 다음과 같다.

| 순서 | 증상                                                       | 조치                                                                                                                                         |
| ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 로컬에서 PDF를 업로드하자 미리보기가 "열 수 없습니다" 표시 | `curl -v http://localhost:4000/documents`로 목록에 파일(`portfolio/….pdf`, 약 11.7MB)이 있음을 확인. 원인은 목록이 아니라 파일 응답 쪽이었다 |
| 2    | 첫 미리보기 화면과 아이콘이 macOS와 다름                   | 실제 Mac의 미리보기 화면(위 캡처)을 옆에 두고 다시 맞춤                                                                                      |
| 3    | 파일 없이 실행하면 최근 파일을 표시                        | macOS처럼 열기 창 표시                                                                                                                       |
| 4    | 열기 창에 폴더가 3개만 표시                                | Finder와 같은 트리 사용, 휴대폰 파일 앱도 같은 구조로 맞춤. 미리보기 아이콘만 작아 보여 그림을 가득 채움                                     |
| 5    | 닫았다가 다시 실행하면 이전 파일이 열림                    | 창을 닫을 때 열린 파일 목록을 비움                                                                                                           |

## 따라 하기: R2 버킷 연결

전체 절차는 저장소의 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md) "문서 파일(R2)" 절에 있다. R2 자체는 [Cloudflare R2 문서](https://developers.cloudflare.com/r2/), PDF 렌더링 라이브러리는 [PDF.js](https://mozilla.github.io/pdf.js/)를 참고한다. 준비물은 Cloudflare 계정, API 서버에 SSH로 접속할 수 있는 권한이다.

1. 버킷을 생성한다. 이름이 이미 사용 중이라는 오류가 나오면 이전에 만든 버킷이 있는지 R2 목록부터 확인한다(이 경우가 그랬다).

```bash
npx wrangler r2 bucket create macfolio-files
```

2. R2 → Manage R2 API Tokens에서 Object Read & Write 토큰을 발급하고, 서버의 `~/deploy/api.env`에 네 줄을 추가한 뒤 API를 재시작한다.

```bash
R2_ACCOUNT_ID=<계정 ID>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET=macfolio-files
```

3. 버킷 Settings → CORS Policy에서 사이트 출처의 PUT을 허용하고, 서버에서 사전 요청([preflight](https://developer.mozilla.org/ko/docs/Glossary/Preflight_request))을 보내 확인한다. `api.env`를 `source`로 읽으면 공백이 포함된 값(`CONTACT_FROM=MacFolio <…>`)에서 문법 오류가 나므로 `grep`으로 값을 추출한다.

```bash
cd ~/deploy
A=$(grep '^R2_ACCOUNT_ID=' api.env | cut -d= -f2-)
B=$(grep '^R2_BUCKET=' api.env | cut -d= -f2-)
curl -si -X OPTIONS "https://$A.r2.cloudflarestorage.com/$B/desktop/test.gif" \
  -H "Origin: https://macfolio.hyeoniverse.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" | head -8
```

기대 출력은 `HTTP/1.1 204 No Content`와 `Access-Control-Allow-Origin: https://macfolio.hyeoniverse.com`, `Access-Control-Allow-Methods: PUT`이다. 이 서버에서도 같은 결과가 나왔다.

4. 그래도 업로드가 실패하면 키를 확인한다. `curl --aws-sigv4 "aws:amz:auto:s3" --user "$KEY:$SECRET" -T 파일 "$주소"`로 직접 업로드해 보고, `SignatureDoesNotMatch`가 나오면 키를 다시 발급해 넣는다. 키 길이는 보통 32자와 64자다.

되돌리려면 `api.env`에서 네 줄을 삭제하고 API를 재시작한다. 목록은 그대로 표시되고 업로드·삭제만 "서버에 파일 저장소(R2)가 설정되지 않았습니다" 오류로 차단된다.

## 시험

| 대상             | 확인 내용                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 목록 → 폴더 변환 | 시험용 목록을 함수 인자로 넣어 확인                                                                                                                                                                                                    |
| Worker           | 메모리 버킷으로 헤더, 304, 405, 경로 차단, 바인딩 없음                                                                                                                                                                                 |
| 화면(E2E)        | Finder에서 열면 미리보기 창이 열리는지, 배율과 사이드바. `window.__MACFOLIO_DOCUMENTS__`로 시험용 목록을 넣고, [`page.route`](https://playwright.dev/docs/api/class-page#page-route)로 `/files/*`에 시험 중 생성한 작은 PDF·PNG를 응답 |
| 업로드(E2E)      | 가짜 API(`/documents`)와 가짜 R2 주소로, Finder에 파일을 놓으면 R2에 PUT이 한 번 전송되고 목록에 추가되는지, 허용하지 않는 종류 차단, 방문자 업로드 차단                                                                               |
| 서버             | 서명 URL(AWS 예시 값), 키 형식, HEAD 확인, 확장자 검사, 삭제 시 R2 오류                                                                                                                                                                |

<details>
<summary>Worker 단위 시험 이름 (현재 17개)</summary>

`apps/react/worker/files.test.ts`: "허용한 확장자의 키만", "경로 바꾸기를 막는다", "PDF를 그 종류·캐시·ETag와 inline으로 준다", "사이트 안 iframe에만 들어가고, 그 밖은 막는다", "?download=1이면 attachment, 한글 이름은 filename*에", "If-None-Match가 맞으면 304", "없는 파일, 허용하지 않는 키는 404 (버킷을 읽지 않는다)", "GET·HEAD가 아니면 405", "바인딩이 없으면(로컬·미리보기) 404" 등이다. Range(206·416) 시험은 이후 동영상 지원을 위해 추가했다.

</details>

## 코드 규모

| 항목                                       | 줄 수           |
| ------------------------------------------ | --------------- |
| 미리보기 앱 `Preview.tsx`·`Preview.css`    | 514 · 666       |
| PDF 뷰어 `PdfView.tsx`                     | 324             |
| 열기 창 `OpenPanel.tsx`                    | 223             |
| Worker `files.ts` (현재)                   | 179             |
| API `documents/` (서비스·컨트롤러·R2 서명) | 151 · 109 · 104 |

## 남은 것과 배운 것

- 미리보기는 PDF·그림만 연다. Markdown·글은 macOS처럼 열지 않고 비활성으로 표시한다. 동영상은 이후 [QuickTime Player 앱](/memo/finder-wallpaper-persist)이 담당한다.
- R2 공개 주소를 쓰지 않으므로 파일 응답은 모두 Worker를 거친다. 현재는 파일 수가 적고 캐시(`max-age=300`, ETag 304)가 있어 문제가 없다. 큰 파일이 늘어나면 R2 사용자 지정 도메인을 별도로 두는 방법도 있다. 그 경우 CSP에 출처를 하나 추가해야 한다.
- 서명 URL의 유효 시간은 5분이다. 매우 느린 연결에서 20MB를 업로드하면 시간이 부족할 수 있다. 아직 그런 사례는 없었다.

배운 것: "공개 저장소에 무엇을 넣지 않을 것인가"를 먼저 정하자 파일 위치(R2)와 주소(같은 출처)가 함께 결정됐다. 같은 출처로 제공하면 CSP 허용 범위를 넓히지 않아도 된다. 그리고 큰 파일이 API 서버를 거치지 않게 하는 것이 메모리 1GB 서버에 맞는 방식이었다. 서버는 "누가, 어디에, 얼마나"만 검사하고 서명한다.

업로드할 때는 전화번호, 주소, 생년월일, 신분 번호를 삭제한 공개용 파일만 올린다.

## 관련 글

- [openRequest store로 Finder에서 고른 항목을 다른 앱에서 열기](/memo/finder-app): Finder의 트리 구조
- [R2 키는 두고 JSON 한 행에 표시 위치만 기록하는 Finder 파일 시스템](/memo/finder-filesystem): 업로드한 파일을 폴더로 정리하기
- [화면이 알아야 하는가를 기준으로 파일 검사 규칙을 contracts와 서버로 나누기](/memo/contracts-files): 업로드 규칙을 contracts로 옮긴 작업
- [id 접두어 상수로 서버 배경화면 검사에서 Finder 파일 제외하기](/memo/finder-wallpaper-persist): 동영상과 QuickTime 열기 창

#MacFolio #프론트엔드 #Finder #미리보기 #pdfjs #CloudflareR2 #CSP #업로드

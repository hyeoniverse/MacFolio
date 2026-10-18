---
title: Finder에서 이력서 PDF와 그림을 미리 보기
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: Finder의 문서 아래에 이력서·포트폴리오·자격증 폴더를 두고, PDF와 그림을 Finder 안에서 미리 보게 했다. 파일은 저장소가 아니라 Cloudflare R2에 두고, 사이트 Worker가 같은 주소(/files/)로 내준다.
---

Finder는 사이트에 있는 것(저장소 문서, 프로젝트, 블로그 글, 앱)을 파일처럼 보여 준다. 그런데 포트폴리오 사이트에서 가장 먼저 찾을 파일인 이력서는 없었다. 빈 이력서 폴더에 "준비하고 있습니다"라는 안내만 있었다. 이번에 PDF와 그림을 열 수 있는 길을 만들었다.

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

## Finder에서 보기

문서 폴더 아래에 이력서·포트폴리오·자격증 폴더를 따로 두었다. 빈 폴더는 폴더마다 다른 안내를 보인다. 파일 종류에는 `pdf`와 `image`를 더했다.

- PDF는 Finder 안의 미리 보기 칸에서 브라우저의 PDF 보기로 연다
- 그림은 사진 앱이 아니라 Finder 미리 보기에서 칸에 맞춰 보이고, 버튼으로 원래 크기와 오간다
- 위 막대에 다운로드(`?download=1`)와 새 창에서 열기가 있다
- 휴대폰의 파일 앱에서는 같은 미리 보기가 화면을 채운다

## 시험

- 파일 목록 → 폴더 변환은 시험용 목록을 함수 인자로 넣어 확인한다
- Worker는 메모리 버킷으로 헤더, 304, 405, 경로 막기, 바인딩 없음을 확인한다
- 화면 시험은 `window.__MACFOLIO_DOCUMENTS__`로 시험용 목록을 넣고, `page.route`로 `/files/*`에 시험 중에 만든 작은 PDF·PNG를 준다

실제 파일은 아직 없다. 올릴 때는 전화번호, 주소, 생년월일, 신분 번호를 지운 공개용 파일만 올린다.

#MacFolio #프론트엔드 #Finder #CloudflareR2 #CSP

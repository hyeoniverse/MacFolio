---
title: PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기
date: 2026-10-10
category: 인프라/배포·운영
summary: CORS 허용 목록의 와일드카드(https://*-macfolio…workers.dev)는 PR 미리보기를 위한 것인데, 쿠키 포함(credentials)까지 같이 열려 있었다. 미리보기 주소는 브랜치만 올리면 누구나 생기므로, *로 맞은 주소에는 credentials를 끄고 관리자 API는 그런 Origin을 403으로 거절하게 했다. SameSite=Lax가 이미 막고 있던 것을 서버에서도 한 번 더 막는 것이다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "CORS 와일드카드 범위 점검".

## 무엇이 걸렸나

API의 `CORS_ORIGINS`는 `https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev`다. 두 번째가 PR 미리보기 주소(브랜치 이름이 `*` 자리에 온다)다. 그런데 `enableCors`에 `credentials: true`를 한 번에 걸어 두어서, 미리보기 주소에서 온 요청도 쿠키를 주고받을 수 있다고 브라우저에 답하고 있었다. 미리보기는 저장소에 브랜치를 올릴 수 있는 사람이면 누구나 만들 수 있는 주소다. 혼자 하는 저장소라 당장 위험하지는 않지만, "관리자 세션을 붙여도 되는 주소"의 범위가 필요보다 넓었다.

## 용어

- **CORS**: 다른 주소(origin)의 자바스크립트가 API를 부를 수 있게 서버가 허락하는 규칙. 서버가 `Access-Control-Allow-Origin` 헤더로 "이 주소는 돼"라고 답해야 브라우저가 응답을 넘겨준다
- **credentials**: CORS 요청에 쿠키를 붙이는 것. 서버가 `Access-Control-Allow-Credentials: true`를 같이 보내야 하고, 안 보내면 브라우저가 쿠키 붙은 요청의 응답을 버린다
- **SameSite=Lax**: 쿠키의 속성. 다른 사이트에서 시작된 요청에는 쿠키를 붙이지 않는다(주소창에 쳐서 들어가는 이동은 예외). `macfolio.hyeoniverse.com`과 `macfolio-api.hyeoniverse.com`은 같은 사이트(`hyeoniverse.com`)라 쿠키가 가지만, `*.workers.dev`에서 부르면 가지 않는다
- **Origin 헤더**: 브라우저가 다른 주소로 요청할 때 "어디서 보낸 요청인지"를 적어 보내는 헤더. 자바스크립트가 바꿀 수 없다

## 실제로는 이미 막혀 있었다

세션 쿠키가 `SameSite=Lax`라, 미리보기(`*.workers.dev`)에서 API(`hyeoniverse.com`)로 보내는 fetch에는 쿠키가 애초에 붙지 않는다. 그래서 미리보기에서는 로그인해도 관리자로 보이지 않는다. 즉 와일드카드가 credentials까지 열어 두었어도, 브라우저 쪽 규칙이 먼저 막고 있었다.

그래도 고쳤다. 한 겹이 "브라우저가 알아서 안 붙인다"뿐이면, 쿠키 속성을 바꾸거나 API 주소를 옮기는 날 조용히 열린다. 서버가 스스로 "이 주소에는 쿠키를 안 받는다"고 알고 있어야 한다.

## 바꾼 것

허용 목록 검사가 "맞다/아니다"만 돌려주던 것을 **어떻게 맞았는지**(`exact`: 그대로 적은 주소, `pattern`: `*`에 맞은 주소)로 바꿨다. 그리고 두 군데서 쓴다.

1. **CORS 응답**: `exact`에만 `Access-Control-Allow-Credentials: true`. `pattern`은 `Allow-Origin`만 주고 credentials는 주지 않는다. NestJS의 `enableCors`는 요청마다 옵션을 정하는 함수를 받을 수 있어서, Origin을 보고 `{ origin, credentials }`를 그때 정한다
2. **관리자 가드**: 요청에 `Origin` 헤더가 있는데 `exact`가 아니면 세션이 맞아도 403. Origin이 없는 요청(같은 사이트 이동, curl)은 CORS 밖이라 그대로 둔다. 브라우저가 어떤 이유로 쿠키를 붙여 보내더라도 관리자 기능은 열리지 않는다

미리보기에서 바뀌는 것은 없다. 원래 읽기만 됐고 지금도 읽기만 된다. 관리자 기능을 미리보기에서 확인하려면 로컬에서 한다.

## 확인

- 단위: `exact`·`pattern`·거절 분류, 쿠키 허용 판단
- e2e: 사이트 주소에는 `Allow-Credentials: true`, 미리보기 주소에는 헤더 없음, 관리자 API에 미리보기·다른 사이트 Origin을 붙이면 403

#MacFolio #보안 #CORS #NestJS

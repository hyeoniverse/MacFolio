---
title: 프로젝트 앱의 iframe에 sandbox 걸기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 프로젝트 앱의 iframe에 제한이 없어, 안에 띄운 사이트의 target="_top" 링크 하나로 MacFolio 전체가 다른 주소로 바뀔 수 있었다. sandbox로 맨 위 창을 옮기는 권한만 빼고, 빠뜨리면 실패하는 E2E를 더했다.
---

프로젝트 앱([프로젝트를 앱으로](/memo/project-apps))은 NewPick, QRU 같은 배포한 사이트를 창 안의 iframe으로 띄운다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 보다가, 이 iframe에 `sandbox`가 없다는 것을 알았다. 당시 iframe 부분은 프로젝트 앱과 API 문서 앱이 함께 쓰는 `shared/ui/web-frame/WebFrame.tsx`에 있었고, 속성은 `src`·`title`·`allow`·`allowFullScreen`뿐이었다.

## 무엇이 열려 있었나

`sandbox`가 없는 iframe 안의 페이지는 맨 위 창(MacFolio)을 다른 주소로 옮길 수 있다. 내가 만든 사이트들이라 일부러 그럴 일은 없지만, 그 사이트들도 바깥 라이브러리를 쓰고 언젠가 도메인이 넘어갈 수도 있다. 그러면 이 사이트를 보던 방문자가 엉뚱한 곳으로 옮겨진다.

먼저 맨 위 창을 옮기는 스크립트를 가짜 사이트에 넣고 시험을 짰는데, `sandbox`가 없어도 시험이 통과했다. Chrome은 사용자의 클릭 없이 다른 출처의 iframe이 맨 위 창을 옮기는 것을 이미 막는다. 막히지 않는 것은 **사용자가 클릭한 경우**였다. iframe 안의 `<a target="_top">`을 누르면 맨 위 창이 그 주소로 바뀐다. 시험을 이 경우로 바꾸자 `sandbox` 없이는 실패하고, 있으면 통과했다.

![맨 위 창을 옮기는 두 길](./images/iframe-sandbox-top-nav.svg '클릭 없는 이동은 Chrome이 이미 막고, 클릭한 링크는 sandbox가 막는다')

재현에 쓴 E2E는 `e2e/project-apps.spec.ts`의 "안에 띄운 사이트의 링크가 이 사이트를 다른 주소로 바꾸지 못한다"다. NewPick 주소를 가짜 페이지로 바꿔 치우고, 그 안에 `target="_top"` 링크를 넣어 누른다.

```ts
await page.route('https://newpick-tan.vercel.app/**', (route) =>
	route.fulfill({
		contentType: 'text/html; charset=utf-8',
		body: '<h1>NewPick 첫 화면</h1><a href="https://evil.example/" target="_top">바깥으로</a>',
	})
);
// …Dock에서 NewPick을 열고 링크를 누른 뒤
await page.waitForTimeout(500);
expect(new URL(page.url()).hostname).toBe('localhost');
await expect(appWindow(page, 'newpick')).toBeVisible();
```

`evil.example`도 가짜 응답으로 막아 두어, 시험이 실패할 때 바깥으로 실제 요청이 나가지 않는다. 바뀌지 않았음을 보는 시험이라 기다릴 조건이 없어서 0.5초를 기다린 뒤 주소를 본다. 이 부분은 고정된 기다림이라 마음에 들지 않지만, "일어나지 않은 일"을 기다릴 다른 방법이 없었다.

## 고른 방법과 버린 방법

| 방법                                          | 맨 위 창 이동          | 사이트 동작                                             | 판단                                      |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------- | ----------------------------------------- |
| 그대로 둔다 (브라우저의 기본 막기에 기댄다)   | 클릭한 링크는 옮겨진다 | 그대로                                                  | 버림                                      |
| `sandbox=""` (값 없이)                        | 막힘                   | 스크립트가 안 돌아 사이트가 비어 보인다                 | 버림                                      |
| `allow-same-origin` 없이                      | 막힘                   | 쿠키·`localStorage`를 못 써 로그인과 설정 저장이 깨진다 | 버림                                      |
| `allow-top-navigation-by-user-activation`까지 | 클릭한 링크는 옮겨진다 | 그대로                                                  | 이번에 막으려는 경우가 바로 이것이라 버림 |
| **필요한 것만 주고 top-navigation은 빼기**    | 막힘                   | 그대로, 새 탭 링크도 된다                               | 고름                                      |

## 준 권한과 뺀 권한

`sandbox` 속성은 아무 값 없이 쓰면 모든 권한을 막고, 값으로 필요한 것만 하나씩 연다.

| 권한                               | 이유                                              |
| ---------------------------------- | ------------------------------------------------- |
| `allow-scripts`                    | 사이트가 동작하려면 필요하다                      |
| `allow-same-origin`                | 사이트가 자기 쿠키·저장소를 쓴다 (로그인 상태 등) |
| `allow-forms`                      | 로그인·검색 폼                                    |
| `allow-popups`, `…-escape-sandbox` | 새 탭으로 여는 링크. 새 탭은 sandbox 밖에서 연다  |
| `allow-downloads`, `allow-modals`  | 내려받기, `alert`·`confirm`                       |
| ~~`allow-top-navigation`~~         | **주지 않는다.** 맨 위 창을 옮기는 권한           |

`allow-scripts`와 `allow-same-origin`을 같이 주면, 같은 출처의 페이지는 스크립트로 자기 `sandbox`를 지울 수 있다. 하지만 프로젝트 사이트는 모두 다른 출처라 MacFolio의 DOM에 손댈 수 없어서 문제가 되지 않는다. 같은 출처인 API 문서 앱은 내 코드다.

새 탭으로 여는 링크와 게임의 전체 화면(`allow="fullscreen"`)은 그대로 된다. 안의 사이트가 바깥으로 보내고 싶으면 새 탭으로 열면 된다.

## 구현

`WebFrame.tsx`에 권한 목록을 상수로 두고 iframe에 붙였다. 15줄을 더했다.

```tsx
/**
 * 안에 띄운 페이지에 주는 권한 (iframe sandbox). 바깥 사이트가 이 사이트를 다른 주소로 바꾸지 못하게
 * allow-top-navigation은 주지 않는다. 그 밖에 사이트가 보통 쓰는 것은 준다
 */
const FRAME_SANDBOX = [
	'allow-scripts',
	'allow-same-origin',
	'allow-forms',
	'allow-popups',
	'allow-popups-to-escape-sandbox',
	'allow-downloads',
	'allow-modals',
].join(' ');
```

공통 틀 한 곳에만 붙이면 되어서, 프로젝트 앱 다섯 개(HYEONIVERSE·NewPick·QRU·WTD·새싹 농장)와 API 문서 앱이 한 번에 같은 권한을 갖는다. [창 안에 게임을 넣을 때](/memo/game-in-iframe) iframe 코드를 공통 틀로 모아 둔 덕을 봤다.

`sandbox`는 다른 방어와 겹쳐 있다. 어떤 주소를 iframe에 넣을 수 있는지는 CSP `frame-src`가 정하고(프로젝트 데모 주소만), 넣은 사이트가 할 수 있는 일은 `sandbox`와 `allow`가 정한다.

![세 겹의 방어](./images/iframe-sandbox-layers.svg '주소는 CSP가, 할 수 있는 일은 sandbox와 allow가 정한다')

## 확인

- 앞의 E2E가 `sandbox` 없이는 실패하고, 넣은 뒤에는 통과했다.
- 같은 파일의 "Dock에서 연 프로젝트 앱" 시험에 `sandbox` 속성 확인을 더했다. `allow-scripts`·`allow-same-origin`이 들어 있고 `allow-top-navigation`이 없어야 한다. 누가 권한 목록을 고치다 빠뜨리거나 더하면 여기서 걸린다.

## 남은 것·배운 것

- 보안 시험은 "막혔는가"를 먼저 실패시켜 보아야 한다. 처음 짠 시험은 `sandbox`가 없어도 통과했다. 그대로 두었으면 아무것도 지키지 않는 시험이 초록으로 남았을 것이다.
- `allow-same-origin`은 안의 사이트가 같은 출처일 때 위험해진다. 지금은 프로젝트 사이트가 모두 다른 도메인이지만, 언젠가 같은 도메인 아래로 옮기면 이 목록을 다시 봐야 한다.
- 고정된 0.5초 기다림은 느린 CI에서 이동이 늦게 일어나면 놓칠 수 있다. 실패를 놓치는 쪽이라 시험이 흔들리지는 않지만, 그만큼 덜 엄격하다.

## 관련 글

- 계획: [리팩터링 계획 #150](https://github.com/hyeoniverse/MacFolio/issues/150), [7단계 보안](/memo/refactor-step7-security)
- [배포한 프로젝트 사이트를 띄우는 앱](/memo/project-apps)
- [Unity WebGL 게임을 창 안에 넣기](/memo/game-in-iframe)
- [보안 헤더와 CSP](/memo/security-headers)

#MacFolio #보안 #iframe #sandbox

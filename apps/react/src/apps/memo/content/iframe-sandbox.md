---
title: iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기
date: 2026-10-09
category: 개발 기록/MacFolio/품질
series: 보안 점검
seriesOrder: 3
summary: 프로젝트 앱의 iframe에 제한이 없어, 내장한 사이트의 target="_top" 링크 하나로 MacFolio 전체가 다른 주소로 이동할 수 있었다. sandbox로 최상위 창 이동 권한만 제외하고, 이 설정이 누락되면 실패하는 E2E를 추가했다.
---

프로젝트 앱([PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps))은 NewPick, QRU 같은 배포한 사이트를 창 안의 iframe으로 표시한다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 점검하다가 이 iframe에 `sandbox` 속성이 없다는 것을 확인했다. 당시 iframe은 프로젝트 앱과 API 문서 앱이 공유하는 `shared/ui/web-frame/WebFrame.tsx`에 있었고, 속성은 `src`·`title`·`allow`·`allowFullScreen`뿐이었다. 이 글은 이를 수정한 [#157](https://github.com/hyeoniverse/MacFolio/pull/157)의 기록이다.

## 허용되어 있던 동작

`sandbox`가 없는 iframe 안의 페이지는 최상위 창(top-level browsing context, 여기서는 MacFolio)을 다른 주소로 이동시킬 수 있다. 내장한 사이트는 모두 직접 만든 사이트라 의도적으로 이동시킬 일은 없지만, 그 사이트들도 외부 라이브러리를 사용하고, 도메인 소유권이 바뀔 가능성도 있다. 그 경우 MacFolio를 보던 방문자가 의도하지 않은 주소로 이동된다.

먼저 최상위 창을 이동시키는 스크립트(`top.location = …`)를 가짜 사이트에 넣고 시험을 작성했는데, `sandbox`가 없어도 시험이 통과했다. Chrome은 사용자 활성화(클릭 등) 없이 다른 출처의 iframe이 최상위 창을 이동시키는 것을 기본으로 차단한다. 차단되지 않는 것은 **사용자가 클릭한 경우**였다. iframe 안의 `<a target="_top">`을 클릭하면 최상위 창이 그 주소로 이동한다. 시험을 이 경우로 바꾸자 `sandbox`가 없으면 실패하고, 있으면 통과했다.

| 이동 방식                                | `sandbox` 없음     | `sandbox` 적용 (top-navigation 제외) |
| ---------------------------------------- | ------------------ | ------------------------------------ |
| 클릭 없이 스크립트로 `top.location` 변경 | Chrome이 기본 차단 | 차단                                 |
| 사용자가 `<a target="_top">` 클릭        | **이동됨**         | 차단                                 |

![최상위 창을 이동시키는 두 경로](./images/iframe-sandbox-top-nav.svg '클릭 없는 이동은 Chrome이 기본으로 차단하고, 클릭한 링크는 sandbox가 차단한다')

재현에 사용한 E2E는 `e2e/project-apps.spec.ts`의 "안에 띄운 사이트의 링크가 이 사이트를 다른 주소로 바꾸지 못한다"다. NewPick 주소의 응답을 가짜 페이지로 대체하고, 그 안의 `target="_top"` 링크를 클릭한다.

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

`evil.example`도 가짜 응답으로 대체해, 시험이 실패하는 경우에도 외부로 실제 요청이 전송되지 않는다. 변경이 없음을 확인하는 시험이라 대기할 조건이 없으므로, 0.5초 대기 후 주소를 확인한다. 고정 시간 대기는 피해야 하는 방식이지만, 발생하지 않는 이벤트를 기다리는 다른 방법이 없었다.

## 검토한 방법

| 방법                                          | 최상위 창 이동       | 사이트 동작                                                        | 판단                                 |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| 그대로 둔다 (브라우저 기본 차단에 의존)       | 클릭한 링크는 이동됨 | 변화 없음                                                          | 제외                                 |
| `sandbox=""` (값 없이)                        | 차단                 | 스크립트가 실행되지 않아 사이트가 빈 화면이 된다                   | 제외                                 |
| `allow-same-origin` 없이                      | 차단                 | 쿠키·`localStorage`를 사용할 수 없어 로그인과 설정 저장이 실패한다 | 제외                                 |
| `allow-top-navigation-by-user-activation`까지 | 클릭한 링크는 이동됨 | 변화 없음                                                          | 차단하려는 경우가 바로 이것이라 제외 |
| **필요한 권한만 부여, top-navigation 제외**   | 차단                 | 변화 없음, 새 탭 링크도 동작                                       | 선택                                 |

## 부여한 권한과 제외한 권한

`sandbox` 속성은 값 없이 지정하면 모든 권한을 차단하고, 값에 토큰을 나열해 필요한 권한만 허용한다([MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox)).

| 권한                               | 이유                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `allow-scripts`                    | 사이트의 JavaScript 실행                                 |
| `allow-same-origin`                | 사이트가 자기 출처의 쿠키·저장소 사용 (로그인 상태 등)   |
| `allow-forms`                      | 로그인·검색 폼                                           |
| `allow-popups`, `…-escape-sandbox` | 새 탭으로 여는 링크. 새 탭에는 sandbox를 적용하지 않는다 |
| `allow-downloads`, `allow-modals`  | 내려받기, `alert`·`confirm`                              |
| ~~`allow-top-navigation`~~         | **부여하지 않는다.** 최상위 창 이동 권한                 |

`allow-scripts`와 `allow-same-origin`을 함께 부여하면, 부모와 같은 출처의 페이지는 스크립트로 iframe의 `sandbox` 속성을 제거할 수 있다. 하지만 프로젝트 사이트는 모두 다른 출처라 MacFolio의 DOM에 접근할 수 없으므로 해당되지 않는다. 같은 출처인 API 문서 앱은 MacFolio 저장소의 코드다.

새 탭으로 여는 링크와 게임의 전체 화면(`allow="fullscreen"`)은 그대로 동작한다. 내장 사이트가 외부 주소로 안내하려면 새 탭으로 열면 된다.

## 구현

`WebFrame.tsx`에 권한 목록을 상수로 선언하고 iframe에 적용했다. 추가한 코드는 15줄이다.

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

공통 컴포넌트 한 곳에만 적용하면 되므로, 프로젝트 앱 5개(HYEONIVERSE·NewPick·QRU·WTD·새싹 농장)와 API 문서 앱이 동시에 같은 권한을 갖는다. [iframe 안 클릭을 window blur 이벤트로 감지해 창을 맨 앞으로 가져오기](/memo/game-in-iframe) 작업에서 iframe 코드를 공통 컴포넌트로 통합해 두었기 때문이다.

`sandbox`는 다른 방어 수단과 함께 동작한다. iframe에 넣을 수 있는 주소는 CSP `frame-src`[^frame-src]가 결정하고(프로젝트 데모 주소만 허용), 내장된 사이트가 할 수 있는 동작은 `sandbox`와 `allow`(권한 정책)가 결정한다.

![세 겹의 방어](./images/iframe-sandbox-layers.svg '주소는 CSP가, 허용 동작은 sandbox와 allow가 결정한다')

## 확인

- 앞의 E2E가 `sandbox` 없이는 실패하고, 적용 후에는 통과했다.
- 같은 파일의 "Dock에서 연 프로젝트 앱" 시험에 `sandbox` 속성 검사를 추가했다. `allow-scripts`·`allow-same-origin`이 포함되고 `allow-top-navigation`이 없어야 한다. 권한 목록을 수정하다 누락하거나 잘못 추가하면 이 시험이 실패한다.

## 남은 과제와 정리

- 보안 시험은 방어를 제거한 상태에서 먼저 실패하는지 확인해야 한다. 처음 작성한 시험은 `sandbox`가 없어도 통과했다. 그대로 두었다면 아무것도 검증하지 않는 시험이 통과 상태로 남았을 것이다.
- `allow-same-origin`은 내장 사이트가 부모와 같은 출처일 때 위험하다. 현재 프로젝트 사이트는 모두 다른 도메인이지만, 같은 도메인 아래로 옮기면 이 목록을 다시 검토해야 한다.
- 고정 0.5초 대기는 느린 CI에서 이동이 늦게 발생하면 검출하지 못할 수 있다. 실패를 놓치는 방향의 오차라 시험이 불안정해지지는 않지만, 그만큼 검증이 느슨하다.

## 직접 확인하기

프로젝트 앱을 열고 개발자 도구 Elements 패널에서 `iframe`을 선택하면 `sandbox` 속성을 확인할 수 있다. 콘솔에서도 확인할 수 있다.

```js
[...document.querySelectorAll('iframe')].map((f) => f.getAttribute('sandbox'));
```

출력에 `allow-top-navigation`이 없어야 한다. 내장 사이트의 `target="_top"` 링크를 클릭해도 MacFolio가 다른 주소로 이동하지 않는지는 E2E가 검증한다.

```bash
cd apps/react
npx playwright test e2e/project-apps.spec.ts --project=desktop-chromium
```

권한을 추가하거나 제거하려면 `apps/react/src/shared/ui/web-frame/WebFrame.tsx` 한 곳을 수정한다. 각 토큰의 의미는 [MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox)에 있다.

## 관련 글

- 계획: [리팩터링 계획 #150](https://github.com/hyeoniverse/MacFolio/issues/150), [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-step7-security)
- [PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps)
- [iframe 안 클릭을 window blur 이벤트로 감지해 창을 맨 앞으로 가져오기](/memo/game-in-iframe)
- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)
- [react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests)

[^frame-src]: 페이지가 iframe으로 불러올 수 있는 출처를 제한하는 Content-Security-Policy 지시어. [MDN: CSP frame-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-src)

#MacFolio #보안 #iframe #sandbox

---
title: Unity WebGL 게임을 창 안에 넣기
date: 2026-09-29
category: 개발기/MacFolio/프론트엔드
summary: 별도로 배포한 Unity WebGL 게임 새싹 농장을 데스크톱의 앱으로 추가했다. iframe 삽입을 차단하는 헤더 확인, iframe 안을 클릭해도 창이 앞으로 오지 않던 문제와 blur 이벤트로 해결한 방법, 외부 사이트에 의존하지 않는 E2E, 그 코드가 프로젝트 앱 공통 컴포넌트가 된 과정.
---

이전에 Unity로 만든 탑다운 게임 SproutFarm(새싹 농장)은 WebGL로 빌드해 Vercel에 별도로 배포되어 있다. Safari 포트폴리오에서 링크로 연결하는 대신, 이 데스크톱 안에서 바로 플레이할 수 있게 앱으로 추가했다([#33](https://github.com/hyeoniverse/MacFolio/pull/33)). 링크는 새 탭을 열어 이 사이트를 벗어나게 한다. 창으로 열면 게임을 플레이하고 창을 닫으면 원래 화면으로 돌아온다.

세 가지 방법을 비교했다.

| 방법                                           | 장점                                  | 단점                                                                                    |
| ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| Safari 페이지에서 새 탭 링크                   | 구현할 것이 없다                      | 사이트를 벗어난다                                                                       |
| WebGL 빌드 파일을 이 저장소에 넣어 직접 실행   | 같은 출처라 iframe 제약이 없다        | 빌드 파일이 저장소와 배포에 포함되고, 게임을 수정할 때마다 두 곳에 배포해야 한다        |
| **배포한 게임 주소를 iframe으로**              | 게임 저장소와 배포를 그대로 사용한다  | 그 사이트가 iframe 삽입을 허용해야 하고, iframe 안의 이벤트가 바깥 문서로 전달되지 않는다 |

세 번째를 선택했다. 아래는 그 단점 두 가지를 해결한 기록이다.

![데스크톱 안에서 연 새싹 농장 앱](./images/sproutfarm-window.jpg '새싹 농장 앱. 배포한 게임을 창 안에 그대로 표시하고, PLAY를 누른 시각에 게임을 불러온다')

## iframe 삽입 허용 여부 확인

다른 사이트를 iframe에 넣으려면 그 사이트가 삽입을 허용해야 한다. 응답 헤더에 [`X-Frame-Options`](https://developer.mozilla.org/ko/docs/Web/HTTP/Headers/X-Frame-Options)나 CSP의 [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors)가 있으면 브라우저가 표시하지 않는다.

```bash
curl -sI https://sprout-farm-beta.vercel.app/ | grep -iE "x-frame|content-security"
```

출력이 없으므로 삽입할 수 있다. 게임의 첫 화면이 **PLAY를 눌러야 게임을 불러오는** 구조라는 점도 유리했다. 창을 열기만 해서는 용량이 큰 WebGL 빌드를 내려받지 않는다.

## 앱 추가

앱 목록은 `manifest.ts` 한 곳에 있다. 창 크기는 게임 화면(1280×720)과 같은 16:9 비율에 제목 막대 높이를 더했다.

```ts
sproutfarm: {
	label: '새싹 농장',
	icon: 'projects/sproutfarm/icon.png',
	inDock: true,
	windowSize: { width: 960, height: 569 },
},
```

처음에는 키보드로 조작하는 PC 게임이라 `desktopOnly` 속성을 새로 만들어 모바일 홈 화면과 단축어에서 제외했다. 이후 게임에 모바일 모드가 추가되어 이 속성을 제거하고 휴대폰에서도 열 수 있게 했다. 이 속성을 쓰는 앱이 새싹 농장 하나뿐이어서 속성 정의 자체도 삭제했다.

처음 작성한 `apps/sproutfarm/SproutFarm.tsx`는 41줄이었다. `AppWindow` 안에 iframe 하나를 두고, [`allow`](https://developer.mozilla.org/ko/docs/Web/HTML/Element/iframe#allow)`="autoplay; fullscreen; gamepad"`로 자동 재생·전체 화면·게임패드 권한을 부여했다.

## iframe 안을 클릭해도 창이 앞으로 오지 않던 문제

창은 클릭하는 시각에 맨 앞으로 온다. 창 프레임에 `onPointerDownCapture` 핸들러가 있기 때문이다. 그런데 iframe 안을 클릭하면 그 이벤트는 iframe 내부 문서에서만 처리되고, 바깥 문서로 전달되지 않는다. 다른 창 뒤에 있는 게임을 클릭해도 게임 창이 앞으로 오지 않았다.

대신 바깥 문서가 감지할 수 있는 이벤트가 하나 있다. iframe 안을 클릭하면 포커스가 iframe으로 이동하면서 바깥 `window`에 [`blur`](https://developer.mozilla.org/ko/docs/Web/API/Window/blur_event) 이벤트가 발생한다. 그 시각에 [`document.activeElement`](https://developer.mozilla.org/ko/docs/Web/API/Document/activeElement)가 이 iframe인지 확인한다.

```tsx
useEffect(() => {
	const onBlur = () => {
		if (document.activeElement === frame.current) bringAppToFront('sproutfarm');
	};
	window.addEventListener('blur', onBlur);
	return () => window.removeEventListener('blur', onBlur);
}, [bringAppToFront]);
```

![iframe 안을 눌렀을 때의 이벤트](./images/game-in-iframe-focus.svg '클릭 이벤트는 바깥 문서로 전달되지 않지만, 바깥 문서의 포커스 상실은 감지할 수 있다')

| 방법                                                  | 문제                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| iframe 위에 투명 레이어를 덮고 첫 클릭 후 제거        | 첫 클릭이 게임에 전달되지 않아 한 번 더 클릭해야 한다            |
| 게임이 [`postMessage`](https://developer.mozilla.org/ko/docs/Web/API/Window/postMessage)로 클릭을 알림 | 게임 코드를 수정해야 하고, 다른 사이트에는 적용할 수 없다        |
| **바깥 `window`의 `blur`**                            | 어느 사이트를 삽입해도 같게 동작한다                             |

한계도 있다. 포커스가 iframe 안에 있는 상태에서 다른 창을 클릭했다가 다시 iframe을 클릭하면, 그 사이 바깥 문서가 포커스를 가져갔으므로 `blur`가 다시 발생한다. 반면 iframe 안을 연속으로 두 번 클릭할 때는 포커스가 이미 iframe 안에 있어서 `blur`가 발생하지 않는다. 이 경우에는 창이 이미 맨 앞이라 문제가 없다.

## 창 끌기는 이미 정상 동작

iframe 위로 마우스가 지나가면 `pointermove`가 iframe 문서로 전달되어, 창을 끄는 도중에 멈추는 문제가 흔하다. 이 데스크톱은 창 끌기를 시작하는 시각에 [`setPointerCapture`](https://developer.mozilla.org/ko/docs/Web/API/Element/setPointerCapture)를 호출하므로, 마우스가 iframe 위를 지나가도 이벤트가 끌기 영역으로 계속 전달된다. 별도 수정이 필요 없었다.

## 외부 사이트에 의존하지 않는 시험

E2E가 실제 게임 사이트를 불러오면, 그 사이트가 느리거나 변경될 때 시험이 실패한다. Playwright의 [`page.route`](https://playwright.dev/docs/api/class-page#page-route)로 그 주소의 요청을 가짜 페이지 응답으로 대체했다.

```ts
await page.route('https://sprout-farm-beta.vercel.app/**', (route) =>
	route.fulfill({ contentType: 'text/html', body: '<button>START</button>' })
);

await expect(
	page.frameLocator('iframe[title="SproutFarm 새싹 농장"]').getByRole('button', { name: 'START' })
).toBeVisible();
```

iframe에 올바른 주소가 지정되고 내부가 렌더링되는지까지만 확인한다. 게임 자체의 시험은 게임 저장소의 범위다. 현재 `e2e/sproutfarm.spec.ts`에는 시험이 두 개 있다. "Dock(넘치면 Launchpad)에서 열면 배포한 게임을 창 안에 띄운다"와 "Safari 프로젝트 페이지에서 바로 플레이한다"다. 둘 다 같은 가짜 페이지를 쓴다.

## 이후: 게임 앱 코드가 프로젝트 앱의 공통 컴포넌트가 되었다

새싹 농장을 추가한 코드는 다른 프로젝트에도 그대로 적용할 수 있었다. 10월 5일 [#87](https://github.com/hyeoniverse/MacFolio/pull/87)에서 `SproutFarm.tsx`를 삭제하고, 프로젝트 목록(`shared/profile/projects/*.ts`)에 `app` 필드가 있는 프로젝트를 모두 같은 `ProjectApp`으로 실행하게 했다. HYEONIVERSE·NewPick·QRU·WTD도 함께 앱이 됐다. 새싹 농장의 현재 설정은 다음과 같다.

```ts
app: {
	label: '새싹 농장',
	icon: 'projects/sproutfarm/icon.png',
	play: true,
	tone: 'dark',
	barColor: '#231f20',
	// 게임 화면(16:9) + 제목 막대
	windowSize: { width: 960, height: 569 },
},
```

같은 날 API 문서 앱도 iframe으로 표시하게 되면서, iframe 부분은 `shared/ui/web-frame/WebFrame.tsx`로 분리했다. 위의 `blur` 코드도 이 파일로 옮기고 `bringAppToFront(appName)`로 일반화했다. 로딩 중에는 앱 아이콘을 표시하고, 8초(`SLOW_MS`)가 지나도 로딩이 끝나지 않으면 새 탭에서 여는 링크를 표시한다. 사이트가 iframe 삽입을 차단하면 빈 화면만 남기 때문이다. 10월 9일에는 [`sandbox`](https://developer.mozilla.org/ko/docs/Web/HTML/Element/iframe#sandbox) 속성으로 내부 사이트가 최상위 창의 주소를 변경하지 못하게 했다. 자세한 내용은 [iframe sandbox](/memo/iframe-sandbox) 글에 있다.

![새싹 농장 앱 코드의 변화 과정](./images/game-in-iframe-history.svg '앱 하나를 위해 작성한 iframe 코드가 프로젝트 앱과 API 문서 앱의 공통 컴포넌트가 되었다')

## 남은 것·배운 것

- 교차 출처 iframe 내부의 상태는 바깥 문서에서 대부분 알 수 없다. 감지 가능한 신호(포커스 이동, `load`, `postMessage`)만으로 필요한 동작을 구현한다.
- 외부 사이트를 표시하는 기능의 시험은 그 사이트를 가짜 응답으로 대체해야 안정적이다. 실제 사이트의 응답 여부는 별도로 모니터링할 대상이다.
- 게임은 지금도 PLAY를 눌러야 용량이 큰 빌드를 내려받는다. 이 앱이 빠르게 열리는 것은 게임 쪽 구조 덕분이다. 다른 프로젝트 사이트는 열자마자 모든 리소스를 불러오므로, 창을 열 때의 전송량을 줄이는 일은 각 사이트의 과제로 남았다.

## 관련 글

- PR: [#33](https://github.com/hyeoniverse/MacFolio/pull/33) (새싹 농장 앱), [#87](https://github.com/hyeoniverse/MacFolio/pull/87) (프로젝트 앱)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [프로젝트 앱의 iframe에 sandbox 걸기](/memo/iframe-sandbox)
- [새싹 농장 아이콘 - 32픽셀 캐릭터로 다시 그린 풀밭](/memo/sproutfarm-icon)
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)

#MacFolio #Safari #새싹농장 #iframe

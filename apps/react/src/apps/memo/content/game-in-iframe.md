---
title: Unity WebGL 게임을 창 안에 넣기
date: 2026-09-29
category: 개발기/MacFolio/프론트엔드
summary: 따로 배포한 Unity WebGL 게임 새싹 농장을 데스크톱의 앱으로 넣었다. iframe을 막는 헤더 확인, iframe 안을 눌러도 창이 앞으로 오지 않던 문제와 blur로 푼 방법, 바깥 사이트에 기대지 않는 E2E, 그 코드가 프로젝트 앱 공통 틀이 된 과정.
---

예전에 Unity로 만든 탑다운 게임 SproutFarm(새싹 농장)은 WebGL로 빌드해 Vercel에 따로 배포해 두었다. Safari 포트폴리오에서 링크로만 보내기보다, 이 데스크톱 안에서 바로 해 볼 수 있게 앱으로 넣었다. 링크로 보내면 새 탭으로 이 사이트를 떠나게 된다. 창 하나로 열리면 게임을 해 보고 창을 닫는 것으로 끝난다.

방법은 몇 가지를 놓고 골랐다.

| 방법                                           | 좋은 점                          | 걸리는 점                                                                        |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Safari 페이지에서 새 탭 링크                   | 할 일이 없다                     | 사이트 밖으로 나간다                                                             |
| WebGL 빌드 파일을 이 저장소에 넣어 직접 띄우기 | 같은 사이트라 iframe 제약이 없다 | 빌드 파일이 저장소와 배포에 함께 실리고, 게임을 고칠 때마다 두 곳에 올려야 한다  |
| **배포한 게임 주소를 iframe으로**              | 게임 저장소와 배포를 그대로 쓴다 | 그 사이트가 iframe을 막지 않아야 하고, iframe 안의 이벤트가 바깥으로 오지 않는다 |

세 번째를 골랐다. 아래는 그 "걸리는 점" 둘을 푼 기록이다.

![데스크톱 안에서 연 새싹 농장 앱](./images/sproutfarm-window.jpg '새싹 농장 앱. 배포한 게임을 창 안에 그대로 띄우고, PLAY를 누를 때 게임을 불러온다')

## 넣어도 되는지 먼저 확인

다른 사이트를 iframe에 넣으려면 그 사이트가 막지 않아야 한다. 응답 헤더에 `X-Frame-Options`나 CSP의 `frame-ancestors`가 있으면 브라우저가 띄우지 않는다.

```bash
curl -sI https://sprout-farm-beta.vercel.app/ | grep -iE "x-frame|content-security"
```

아무것도 나오지 않았으니 넣을 수 있다. 게임 쪽 첫 화면이 **PLAY를 눌러야 게임을 불러오는** 구조라는 것도 좋았다. 창을 열기만 해서는 무거운 WebGL 빌드를 받지 않는다.

## 앱 하나 추가하기

앱 목록은 `manifest.ts` 한 곳에 있다. 창 크기는 게임 화면(1280×720)과 같은 16:9에 제목 표시줄 높이를 더했다.

```ts
sproutfarm: {
	label: '새싹 농장',
	icon: 'projects/sproutfarm/icon.png',
	inDock: true,
	windowSize: { width: 960, height: 569 },
},
```

처음에는 키보드로 하는 PC 게임이라 `desktopOnly`라는 표시를 새로 만들어 모바일 홈 화면과 단축어에서는 뺐다. 그 뒤 게임에 모바일 모드가 생겨서 표시를 지우고 휴대폰에서도 열게 했다. 이 표시를 쓰는 앱이 새싹 농장 하나뿐이어서 표시 자체도 없앴다.

처음 만든 `apps/sproutfarm/SproutFarm.tsx`는 41줄이었다. `AppWindow` 안에 iframe 하나를 두고, `allow="autoplay; fullscreen; gamepad"`로 소리·전체 화면·게임패드를 허락했다.

## iframe 안을 눌러도 창이 앞으로 오지 않았다

창은 누르는 순간 맨 앞으로 온다. 창 틀에 `onPointerDownCapture`를 걸어 두었기 때문이다. 그런데 iframe 안을 누르면 그 이벤트는 iframe 안의 문서에서 끝나고, 바깥 창까지 오지 않는다. 다른 창 뒤에 있는 게임을 눌러도 게임이 앞으로 나오지 않았다.

대신 바깥 문서에서 알 수 있는 것이 하나 있다. iframe 안을 누르면 포커스가 iframe으로 넘어가면서 바깥 `window`에 `blur`가 온다. 그때 포커스를 가진 요소가 이 iframe인지 본다.

```tsx
useEffect(() => {
	const onBlur = () => {
		if (document.activeElement === frame.current) bringAppToFront('sproutfarm');
	};
	window.addEventListener('blur', onBlur);
	return () => window.removeEventListener('blur', onBlur);
}, [bringAppToFront]);
```

![iframe 안을 눌렀을 때의 이벤트](./images/game-in-iframe-focus.svg '누르는 이벤트는 바깥으로 오지 않지만, 바깥 문서가 포커스를 잃는 것은 알 수 있다')

다른 방법과 견주어 보면 이렇다. iframe 위에 투명한 막을 덮어 첫 누르기를 바깥에서 받고 막을 치우는 방법은, 그 누르기가 게임에는 전달되지 않아 한 번 더 눌러야 한다. 게임 쪽에서 `postMessage`로 "눌렸다"를 알려 주게 하는 방법은 게임 코드를 고쳐야 하고, 다른 사이트에는 쓸 수 없다. `blur`는 어느 사이트를 넣어도 같이 동작한다.

한계도 있다. 이미 포커스가 iframe 안에 있는 상태에서 다른 창을 눌렀다가 다시 iframe을 누르면, 그 사이 바깥 문서가 포커스를 가져갔으니 `blur`가 다시 온다. 그런데 iframe 안을 연달아 두 번 누를 때는 포커스가 이미 안에 있어서 `blur`가 오지 않는다. 그때는 창이 이미 맨 앞이라 문제가 되지 않는다.

## 창 끌기는 이미 괜찮았다

iframe 위로 마우스가 지나가면 `pointermove`가 iframe 문서로 가 버려서, 창을 끌다가 멈추는 문제가 흔하다. 이 데스크톱은 창을 끌기 시작할 때 `setPointerCapture`를 부르기 때문에, 마우스가 iframe 위를 지나가도 이벤트가 끌기 영역으로 계속 온다. 따로 고칠 것이 없었다.

## 테스트는 바깥 사이트에 기대지 않게

E2E가 실제 게임 사이트를 불러오면, 그 사이트가 느리거나 바뀔 때 테스트가 깨진다. Playwright에서 그 주소로 가는 요청을 가짜 페이지로 바꿔 치웠다.

```ts
await page.route('https://sprout-farm-beta.vercel.app/**', (route) =>
	route.fulfill({ contentType: 'text/html', body: '<button>START</button>' })
);

await expect(
	page.frameLocator('iframe[title="SproutFarm 새싹 농장"]').getByRole('button', { name: 'START' })
).toBeVisible();
```

iframe에 올바른 주소가 들어가고 그 안이 그려지는지까지만 확인한다. 게임 자체는 게임 저장소에서 테스트할 일이다. 지금 `e2e/sproutfarm.spec.ts`에는 시험이 둘 있다. "Dock(넘치면 Launchpad)에서 열면 배포한 게임을 창 안에 띄운다"와 "Safari 프로젝트 페이지에서 바로 플레이한다"다. 둘 다 같은 가짜 페이지를 쓴다.

## 그 뒤: 게임 하나가 프로젝트 앱의 틀이 되었다

새싹 농장을 넣은 코드는 다른 프로젝트에도 그대로 쓸 수 있었다. 10월 5일 [#87](https://github.com/hyeoniverse/MacFolio/pull/87)에서 `SproutFarm.tsx`를 지우고, 프로젝트 목록(`shared/profile/projects/*.ts`)에 `app` 칸이 있는 프로젝트를 모두 같은 `ProjectApp`으로 띄우게 했다. HYEONIVERSE·NewPick·QRU·WTD가 함께 앱이 됐다. 새싹 농장의 설정은 지금 이렇다.

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

같은 날 API 문서 앱도 iframe으로 띄우게 되면서, iframe 부분은 `shared/ui/web-frame/WebFrame.tsx`로 옮겼다. 위의 `blur` 코드도 여기로 와서 `bringAppToFront(appName)`로 바뀌었다. 불러오는 동안 앱 아이콘을 보여 주고, 8초(`SLOW_MS`)가 지나도 다 불러오지 못하면 새 탭에서 여는 링크를 띄운다. 사이트가 iframe을 막아 두면 빈 화면만 남기 때문이다. 10월 9일에는 `sandbox`를 걸어 안에 띄운 사이트가 이 사이트 주소를 바꾸지 못하게 했다. 그 이야기는 [iframe sandbox](/memo/iframe-sandbox)에 있다.

![새싹 농장 앱이 걸어온 길](./images/game-in-iframe-history.svg '앱 하나를 위해 쓴 iframe 코드가 프로젝트 앱과 API 문서 앱이 함께 쓰는 틀이 되었다')

## 남은 것·배운 것

- iframe 안의 일은 바깥에서 거의 알 수 없다. 알 수 있는 것(포커스 이동, `load`, `postMessage`)만으로 필요한 동작을 만든다.
- 바깥 사이트를 띄우는 기능의 시험은 그 사이트를 가짜로 바꿔야 오래 간다. 실제 사이트가 응답하는지는 따로 지켜볼 일이다.
- 게임은 지금도 PLAY를 눌러야 무거운 빌드를 받는다. 이 앱이 빠르게 열리는 것은 게임 쪽 구조 덕분이다. 다른 프로젝트 사이트는 열자마자 전부 불러오니, 창을 열 때 미리 받는 양을 줄이는 것은 각 사이트의 일로 남았다.

## 관련 글

- PR: [#33](https://github.com/hyeoniverse/MacFolio/pull/33) (새싹 농장 앱), [#87](https://github.com/hyeoniverse/MacFolio/pull/87) (프로젝트 앱)
- [배포한 프로젝트 사이트를 띄우는 앱](/memo/project-apps)
- [iframe sandbox로 맨 위 창 지키기](/memo/iframe-sandbox)
- [새싹 농장 아이콘 다시 그리기](/memo/sproutfarm-icon)
- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion)

#MacFolio #Safari #새싹농장 #iframe

---
title: Unity WebGL 게임을 창 안에 넣기
date: 2026-09-29
category: 프론트엔드/기능
summary: 따로 배포한 새싹 농장 게임을 이 데스크톱의 앱으로 넣었다. iframe으로 넣을 때 확인한 것과 창 포커스 문제.
---

예전에 Unity로 만든 탑다운 게임 SproutFarm(새싹 농장)은 WebGL로 빌드해 Vercel에 따로 배포해 두었다. Safari 포트폴리오에서 링크로만 보내기보다, 이 데스크톱 안에서 바로 해 볼 수 있게 앱으로 넣었다.

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

iframe에 올바른 주소가 들어가고 그 안이 그려지는지까지만 확인한다. 게임 자체는 게임 저장소에서 테스트할 일이다.

#MacFolio #Safari #새싹농장 #iframe

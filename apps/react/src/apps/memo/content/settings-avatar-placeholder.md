---
title: 프로필 사진이 늦게 올 때 비어 보이지 않게 - 시스템 설정의 계정
date: 2026-10-02
category: 개발 기록/MacFolio/프론트엔드/앱
summary: 시스템 설정의 계정 화면은 GitHub 프로필 사진을 github.com에서 내려받는데, 응답이 늦으면 사진 영역 전체가 비어 있었다. 로드 중에는 회색 사람 아이콘을 표시하고 로드가 끝나면 그 위에 사진을 표시한다. CSS 적용 순서 때문에 데스크톱에도 보이던 사이드바의 ›도 행 끝으로 옮겼다.
---

시스템 설정의 계정 화면은 관리자로 로그인하면 GitHub 프로필 사진(`https://github.com/<아이디>.png`)을 표시한다. 이 사진은 github.com에서 내려받으므로 가끔 몇 초씩 걸린다. 10월 2일 오후 시스템 설정을 열었을 때, 그동안 사진 영역에는 아무것도 표시되지 않았다. `<img>`는 로드 전에는 아무것도 렌더링하지 않아서, 56px 영역이 빈 공간으로 남았다.

![데스크톱 전후](./images/settings-avatar-desktop.jpg '전: 사진 자리가 비어 있음 / 후: 받는 동안 회색 사람 아이콘')

## 채택한 방법과 제외한 방법

| 방법                                       | 장점                                                   | 단점                                                                       |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 서버가 사진을 캐시해 같은 출처에서 제공    | github.com이 느려도 빠르다                             | 서버에 이미지 프록시가 생기고, 사진이 바뀌면 다시 내려받아야 한다          |
| 로드 중 회색 원 배경만 지정                | CSS 한 줄                                              | 로드에 실패하면 빈 원이 남고, 브라우저의 깨진 이미지 아이콘이 겹칠 수 있다 |
| 기존 사람 아이콘 위에 사진을 겹치기 (채택) | 로그인 전 모양을 그대로 쓴다. 실패해도 영역이 채워진다 | `load` 이벤트를 놓치는 경우를 별도로 처리해야 한다                         |

사진은 관리자 한 명의 것이라, 한 번 내려받으면 이후에는 브라우저 캐시에서 로드된다. 지연은 대개 첫 요청에서만 발생하므로 화면에서 그 시간을 대체 표시로 채우는 방법을 선택했다.

## 로드 중 대체 표시

로그인하지 않았을 때 쓰던 회색 원과 사람 아이콘이 이미 있었다. 이것을 사진 아래 레이어에 배치하고, 사진은 로드가 끝난 뒤에 위에 표시한다.

```tsx
<span className="github-avatar" data-loaded={loaded || undefined}>
	<i className="fa-solid fa-user" aria-hidden="true" />
	<img src={avatarUrl(login)} alt="" onLoad={() => setLoaded(true)} />
</span>
```

사진은 처음에 투명하고, [`load`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event) 이벤트가 발생하면 페이드인된다. 로드에 실패하면(GitHub 접근이 차단되거나 아이디가 바뀌면) 깨진 이미지 아이콘 대신 사람 아이콘이 그대로 남는다.

캐시에 있던 사진은 React가 이벤트 핸들러를 연결하기 전에 이미 로드가 끝나 `load` 이벤트를 놓칠 수 있다. 그래서 첫 렌더링 직후([`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect))에 [`complete`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete)와 [`naturalWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)를 한 번 확인한다.

```tsx
// apps/react/src/shared/auth/GitHubAvatar.tsx
const image = useRef<HTMLImageElement>(null);
const [loaded, setLoaded] = useState(false);
// 캐시에 있어 그리기 전에 이미 받은 사진은 load 이벤트를 놓칠 수 있다
useLayoutEffect(() => {
	if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
}, []);
```

`complete`만으로는 판단할 수 없다. 로드에 실패한 이미지도 `complete`는 `true`이고, 그때 `naturalWidth`가 0이다.

| 상태                  | `complete` | `naturalWidth` | 판단    |
| --------------------- | ---------- | -------------- | ------- |
| 로드 중               | `false`    | 0              | 로드 중 |
| 로드 완료 (캐시 포함) | `true`     | > 0            | 로드됨  |
| 로드 실패             | `true`     | 0              | 실패    |

![GitHubAvatar의 세 상태](./images/settings-avatar-placeholder-states.svg '받는 중, 다 받음, 받지 못함. 아래 층은 늘 같다')

CSS는 두 레이어를 같은 원 안에 겹친다. 사진은 `position: absolute; inset: 0`으로 원 전체를 채우고, 처음에는 `opacity: 0`이다.

```css
/* apps/react/src/shared/auth/GitHubAvatar.css */
.github-avatar {
	display: grid;
	place-items: center;
	position: relative;
	overflow: hidden;
	border-radius: 50%;
	background: linear-gradient(#b8b8be, var(--color-gray));
}
.github-avatar > img {
	position: absolute;
	inset: 0;
	opacity: 0;
	transition: opacity var(--duration-fast) var(--ease-out);
}
.github-avatar[data-loaded] > img {
	opacity: 1;
}
```

아이콘 크기는 원 크기에 비례하도록 `0.42em`으로 지정한다. 원의 `font-size`만 지정하면 56px(설정)이든 64px(로그인 결과 창)이든 같은 비율이다. 로그인 결과 창도 같은 사진을 사용하므로 같은 컴포넌트(`GitHubAvatar`)로 교체했다.

## 사이드바의 ›

![휴대폰 전후](./images/settings-avatar-mobile.jpg '설정 목록의 ›와 계정 화면의 사진 자리')

데스크톱 사이드바의 ›는 항목 이름 바로 뒤에 붙어 있었다. 이 ›는 휴대폰 목록에만 표시되도록 `display: none`을 지정했는데, Font Awesome의 `.fa-solid { display: inline-block }`이 나중에 로드되어 데스크톱에도 표시되고 있었다. 둘 다 클래스 선택자 하나로 [명시도](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)가 같으므로 나중에 선언된 규칙이 적용된 것이다.

| 규칙                                         | 명시도  | 선언 순서 | 결과           |
| -------------------------------------------- | ------- | --------- | -------------- |
| `.settings-nav-chevron { display: none }`    | (0,1,0) | 먼저      | 무시           |
| `.fa-solid { display: inline-block }`        | (0,1,0) | 나중      | 적용           |
| `.settings-nav-item > .settings-nav-chevron` | (0,2,0) | 무관      | 적용 (수정 후) |

수정할 때는 선택자를 하나 더 붙여 명시도를 높였다. 선언 순서에 의존하면 CSS 파일의 로드 순서가 바뀌는 시각에 다시 잘못 적용된다.

```css
/* apps/react/src/apps/settings/Settings.css */
/* .settings-nav-item을 붙여 Font Awesome의 display(inline-block)보다 앞서게 한다 */
.settings-nav-item > .settings-nav-chevron {
	width: auto;
	margin-left: auto;
	font-size: 11px;
}
```

›는 행 오른쪽 끝에 배치했다(`margin-left: auto`). 휴대폰 목록의 ›와 같은 위치다. 아이콘 칸에 지정한 너비(`1rem`)는 ›에 적용하지 않는다. 그 너비 안에서 글자가 왼쪽 정렬되어 끝에서 몇 px 떨어져 보였기 때문이다. 창이 좁아 항목이 상단 탭으로 바뀌면 ›를 숨긴다.

## 확인

E2E 시험에서 항목마다 ›의 오른쪽 끝과 행의 콘텐츠 영역 오른쪽 끝이 같은지, 사진 응답을 보류하는 동안 사람 아이콘이 표시되고 응답을 보내면 사진이 표시되는지 확인한다.

```ts
// apps/react/e2e/settings.spec.ts '사이드바 항목의 ›는 줄 오른쪽 끝에 붙는다'
const gaps = await items.evaluateAll((rows) =>
	rows.map((row) => {
		const chevron = row.querySelector('.settings-nav-chevron')!.getBoundingClientRect();
		const right = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
		return Math.abs(Math.round(right - chevron.right));
	})
);
expect(gaps).toEqual([0, 0, 0, 0]);
```

"응답 보류"는 시험에서 `github.com/*.png` 요청을 가로채([`page.route`](https://playwright.dev/docs/network)) 즉시 응답하지 않는 방식이다(`e2e/admin-login.spec.ts`의 "GitHub 사진을 받는 동안에는 자리에 사람 아이콘이 보이고, 받으면 사진으로 바뀐다"). 느린 네트워크를 에뮬레이션하지 않아도 "로드 중" 상태를 원하는 만큼 유지할 수 있다.

```ts
let release = () => {};
const held = new Promise<void>((resolve) => (release = resolve));
await page.route('https://github.com/*.png*', async (route) => {
	await held; // 손으로 풀 때까지 답하지 않는다
	await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgo…', 'base64') }); // 1×1 PNG
});
// … 아이콘이 보이고 사진은 opacity 0
release();
await expect(avatar).toHaveAttribute('data-loaded', 'true');
await expect(avatar.locator('img')).toHaveCSS('opacity', '1');
```

## 배운 것

- **로드 중인 시간도 화면의 일부다.** 로드에 몇 초 걸리는 것은 버그가 아니지만, 그동안 영역이 비어 있으면 화면이 깨진 것처럼 보인다.
- **`complete`만으로는 판단할 수 없다.** 실패한 이미지도 `complete`다. `naturalWidth`까지 확인해야 로드 완료로 판단할 수 있다.
- **명시도가 같으면 나중 규칙이 적용된다.** 외부 라이브러리 CSS(Font Awesome)와 같은 명시도로 경쟁하면 로드 순서가 결과를 결정한다. 우선해야 하는 규칙은 명시도로 우선하게 했다.

이 수정은 [#74](https://github.com/hyeoniverse/MacFolio/pull/74)로 병합했다.

## 관련 글

- [언제 로그인했고 언제 끝나는지 - 시스템 설정의 계정](/memo/settings-signed-in-at)
- [블로그 스크린샷을 테스트 코드로 찍기](/memo/screenshots-with-playwright)
- [정적 사이트에 관리자 로그인 붙이기](/memo/admin-login-github-oauth)
- [시스템 설정의 스크롤이 두 번 되던 것](/memo/settings-double-scroll)

#MacFolio #시스템설정

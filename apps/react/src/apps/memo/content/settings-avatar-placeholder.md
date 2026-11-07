---
title: img 로드 전까지 대체 아이콘을 깔아 두는 외부 프로필 사진 표시
date: 2026-10-02
category: 개발 기록/MacFolio/화면·스타일
summary: 시스템 설정의 계정 화면은 GitHub 프로필 사진을 github.com에서 내려받는데, 응답이 늦으면 사진 영역 전체가 비어 있었다. 로드 중에는 회색 사람 아이콘을 표시하고 로드가 끝나면 그 위에 사진을 표시한다. CSS 적용 순서 때문에 데스크톱에도 보이던 사이드바의 ›도 행 끝으로 옮겼다.
---

시스템 설정의 계정 화면은 관리자로 로그인하면 GitHub 프로필 사진을 표시한다. GitHub은 `https://github.com/<아이디>.png` 주소로 그 계정의 프로필 사진을 제공한다. 예를 들어 아이디가 `octocat`이면 `https://github.com/octocat.png`가 사진 주소다. 이 사진은 MacFolio 서버가 아니라 github.com에서 내려받으므로, 응답이 가끔 몇 초씩 걸린다.

10월 2일 오후 시스템 설정을 열었을 때, 사진을 받는 동안 사진 영역에는 아무것도 표시되지 않았다. HTML의 [`<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img) 요소는 이미지 데이터를 받기 전에는 그릴 내용이 없다. 크기만 지정된 투명한 영역이 남으므로, ==56px 영역이 빈 공간으로 남았다==.

![데스크톱 전후](./images/settings-avatar-desktop.jpg '전: 사진 자리가 비어 있음 / 후: 받는 동안 회색 사람 아이콘')

## 채택한 방법과 제외한 방법

| 방법                                       | 장점                                                   | 단점                                                                       |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 서버가 사진을 캐시해 같은 출처에서 제공    | github.com이 느려도 빠르다                             | 서버에 이미지 프록시가 생기고, 사진이 바뀌면 다시 내려받아야 한다          |
| 로드 중 회색 원 배경만 지정                | CSS 한 줄                                              | 로드에 실패하면 빈 원이 남고, 브라우저의 깨진 이미지 아이콘이 겹칠 수 있다 |
| 기존 사람 아이콘 위에 사진을 겹치기 (채택) | 로그인 전 모양을 그대로 쓴다. 실패해도 영역이 채워진다 | `load` 이벤트를 놓치는 경우를 별도로 처리해야 한다                         |

첫 번째 방법의 이미지 프록시는 서버가 외부 이미지를 대신 받아 보관해 두고, 브라우저에는 자기 주소로 제공하는 구성이다. 사진은 관리자 한 명의 것이라, 한 번 내려받으면 이후에는 브라우저 캐시(이미 받은 응답을 브라우저가 디스크·메모리에 보관해 두고 다시 요청하지 않는 기능)에서 로드된다. 지연은 대개 첫 요청에서만 발생하므로 서버에 프록시를 추가하지 않고, 화면에서 그 시간을 대체 표시로 채우는 방법을 선택했다.

## 로드 중 대체 표시

로그인하지 않았을 때 쓰던 회색 원과 사람 아이콘이 이미 있었다. 이것을 사진 아래 레이어에 배치하고, 사진은 로드가 끝난 뒤에 위에 표시한다.

![GitHubAvatar의 두 층 구조](./images/settings-avatar-placeholder-layers.svg '아래 층은 회색 원과 사람 아이콘, 위 층은 사진이다. 사진은 투명하게 시작해 로드가 끝나면 나타난다')

```tsx
<span className="github-avatar" data-loaded={loaded || undefined}>
	<i className="fa-solid fa-user" aria-hidden="true" />
	<img src={avatarUrl(login)} alt="" onLoad={() => setLoaded(true)} />
</span>
```

`data-loaded={loaded || undefined}`는 `loaded`가 `false`이면 속성 자체를 붙이지 않고, `true`이면 `data-loaded="true"`를 붙인다. CSS는 이 속성이 있는지만 확인해 사진을 보인다.

사진은 처음에 투명하고, [`load`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event) 이벤트가 발생하면 페이드인된다. `load` 이벤트는 브라우저가 이미지 데이터를 모두 받아 해석을 마친 시각에 `<img>` 요소에서 발생한다. 로드에 실패하면(GitHub 접근이 차단되거나 아이디가 바뀌면) `load` 대신 `error` 이벤트가 발생하므로 `loaded`는 계속 `false`다. 그래서 ==깨진 이미지 아이콘 대신 사람 아이콘이 그대로 남는다==.

### 캐시에서 온 사진의 load 이벤트

캐시에 있던 사진은 React가 이벤트 핸들러를 연결하기 전에 이미 로드가 끝나 `load` 이벤트를 놓칠 수 있다. 이벤트는 발생한 시각에 연결된 핸들러에게만 전달되고, 나중에 연결한 핸들러에게 다시 전달되지 않기 때문이다.

![load 이벤트를 놓치는 경우와 useLayoutEffect 확인](./images/settings-avatar-placeholder-timeline.svg '네트워크에서 받는 경우에는 onLoad가 먼저 연결되어 이벤트를 받는다. 캐시에서 바로 온 경우에는 이벤트를 놓칠 수 있어, 첫 렌더링 직후 이미지 상태를 직접 확인한다')

그래서 첫 렌더링 직후([`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect))에 [`complete`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete)와 [`naturalWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)를 한 번 확인한다. `useLayoutEffect`는 React가 DOM을 갱신한 뒤, 브라우저가 화면을 그리기 전에 실행되는 훅이다. 여기서 `loaded`를 `true`로 바꾸면 그 상태 변경도 브라우저가 화면을 그리기 전에 반영된다.

```tsx
// apps/react/src/shared/auth/GitHubAvatar.tsx
const image = useRef<HTMLImageElement>(null);
const [loaded, setLoaded] = useState(false);
// 캐시에 있어 그리기 전에 이미 받은 사진은 load 이벤트를 놓칠 수 있다
useLayoutEffect(() => {
	if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
}, []);
```

> [!WARNING] complete만으로는 판단할 수 없다
> 로드에 실패한 이미지도 `complete`는 `true`이고, 그때 `naturalWidth`가 0이다.

`complete`는 브라우저가 이미지 처리를 끝냈는지(성공이든 실패든)를 알려 주고, `naturalWidth`는 받은 이미지 원본의 가로 픽셀 수다. 예를 들어 GitHub이 460×460 사진을 보내면 `naturalWidth`는 460이고, 요청이 404로 실패하면 0이다.

| 상태                  | `complete` | `naturalWidth` | 판단    |
| --------------------- | ---------- | -------------- | ------- |
| 로드 중               | `false`    | 0              | 로드 중 |
| 로드 완료 (캐시 포함) | `true`     | > 0            | 로드됨  |
| 로드 실패             | `true`     | 0              | 실패    |

![GitHubAvatar의 세 상태](./images/settings-avatar-placeholder-states.svg '받는 중, 다 받음, 받지 못함. 아래 층은 늘 같다')

### 두 레이어를 겹치는 CSS

CSS는 두 레이어를 같은 원 안에 겹친다. 사진은 `position: absolute; inset: 0`으로 원 전체를 채우고, 처음에는 `opacity: 0`이다. `inset: 0`은 `top`·`right`·`bottom`·`left`를 모두 0으로 지정하는 단축 속성이라, 사진이 부모(`position: relative`인 원)의 네 변에 붙는다.

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

| 선언                                   | 역할                                    |
| -------------------------------------- | --------------------------------------- |
| `display: grid; place-items: center`   | 사람 아이콘을 원의 가운데에 놓는다      |
| `overflow: hidden; border-radius: 50%` | 사각형 사진을 원 모양으로 자른다        |
| `opacity: 0` → `[data-loaded]`에서 `1` | 로드 전에는 투명, 로드 후 보인다        |
| `transition: opacity …`                | 0에서 1로 바뀌는 동안 짧게 페이드인한다 |

아이콘 크기는 원 크기에 비례하도록 `0.42em`으로 지정한다. `em`은 요소의 글자 크기를 1로 하는 단위다. 원의 `font-size`만 지정하면 56px(설정)이든 64px(로그인 결과 창)이든 같은 비율이다. 56px이면 아이콘은 약 23.5px, 64px이면 약 26.9px이다. 로그인 결과 창도 같은 사진을 사용하므로 같은 컴포넌트(`GitHubAvatar`)로 교체했다.

## 사이드바의 ›

![휴대폰 전후](./images/settings-avatar-mobile.jpg '설정 목록의 ›와 계정 화면의 사진 자리')

데스크톱 사이드바의 ›는 항목 이름 바로 뒤에 붙어 있었다. 이 ›는 휴대폰 목록에만 표시되도록 `display: none`을 지정했는데, Font Awesome의 `.fa-solid { display: inline-block }`이 나중에 로드되어 데스크톱에도 표시되고 있었다. Font Awesome은 아이콘을 글꼴로 제공하는 외부 라이브러리이고, `fa-solid` 클래스를 붙인 요소를 아이콘으로 그린다.

### 명시도와 선언 순서

같은 요소에 같은 속성을 지정하는 CSS 규칙이 여럿이면 브라우저는 캐스케이드(cascade) 규칙으로 하나를 고른다. 먼저 [명시도](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)(specificity)를 비교한다. 명시도는 선택자에 포함된 ID, 클래스·속성·가상 클래스, 요소 이름의 개수를 (ID, 클래스, 요소) 세 자리로 표기한 값이다. 예를 들어 `.a`는 (0,1,0), `.a > .b`는 (0,2,0), `#id .a`는 (1,1,0)이다. 앞자리부터 비교해 큰 쪽이 적용되고, 명시도가 같으면 나중에 선언된 규칙이 적용된다.

두 규칙 모두 클래스 선택자 하나로 명시도가 같으므로 ==나중에 선언된 규칙이 적용된 것==이다.

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

›는 행 오른쪽 끝에 배치했다. flex 행 안에서 `margin-left: auto`는 남은 가로 공간을 모두 왼쪽 여백으로 가져가므로, 요소가 오른쪽 끝으로 밀린다. 휴대폰 목록의 ›와 같은 위치다. 아이콘 칸에 지정한 너비(`1rem`)는 ›에 적용하지 않는다. 그 너비 안에서 글자가 왼쪽 정렬되어 끝에서 몇 px 떨어져 보였기 때문이다. 창이 좁아 항목이 상단 탭으로 바뀌면 ›를 숨긴다.

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

행의 오른쪽 끝에서 오른쪽 안쪽 여백(`paddingRight`)을 뺀 값이 콘텐츠 영역의 오른쪽 끝이다. 예를 들어 행의 `right`가 240px, 안쪽 여백이 8px이면 콘텐츠 끝은 232px이고, ›의 `right`도 232px이어야 차이가 0이다.

"응답 보류"는 시험에서 `github.com/*.png` 요청을 가로채([`page.route`](https://playwright.dev/docs/network)) 즉시 응답하지 않는 방식이다(`e2e/admin-login.spec.ts`의 "GitHub 사진을 받는 동안에는 자리에 사람 아이콘이 보이고, 받으면 사진으로 바뀐다"). ==느린 네트워크를 에뮬레이션하지 않아도 "로드 중" 상태를 원하는 만큼 유지할 수 있다==.

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

| 단계                | 시험이 하는 일                                     | 화면                   |
| ------------------- | -------------------------------------------------- | ---------------------- |
| 1. 요청 가로채기    | `held` 약속이 풀릴 때까지 응답을 보내지 않는다     | 사람 아이콘, 사진 투명 |
| 2. `release()` 호출 | 가로챈 요청에 1×1 PNG를 응답한다                   | `load` 발생            |
| 3. 확인             | `data-loaded="true"`, 사진 `opacity: 1`을 기다린다 | 사진 표시              |

## 배운 것

- **로드 중인 시간도 화면의 일부다.** 로드에 몇 초 걸리는 것은 버그가 아니지만, 그동안 영역이 비어 있으면 화면이 깨진 것처럼 보인다.
- **`complete`만으로는 판단할 수 없다.** 실패한 이미지도 `complete`다. `naturalWidth`까지 확인해야 로드 완료로 판단할 수 있다.
- **명시도가 같으면 나중 규칙이 적용된다.** 외부 라이브러리 CSS(Font Awesome)와 같은 명시도로 경쟁하면 로드 순서가 결과를 결정한다. 우선해야 하는 규칙은 명시도로 우선하게 했다.

이 수정은 [#74](https://github.com/hyeoniverse/MacFolio/pull/74)로 병합했다.

## 관련 글

- [/auth/me의 세션 만료 시각에 맞춰 화면을 로그아웃 상태로 전환하기](/memo/settings-signed-in-at)
- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)
- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [최소 창 크기와 컨테이닝 블록으로 중첩 스크롤의 이중 스크롤 없애기](/memo/settings-double-scroll)

<details>
<summary>참고 문헌</summary>

- [MDN: The Image Embed element (img)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img)
- [MDN: HTMLElement load event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/load_event)
- [MDN: HTMLImageElement.complete](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete)
- [MDN: HTMLImageElement.naturalWidth](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [MDN: Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)
- [MDN: inset](https://developer.mozilla.org/en-US/docs/Web/CSS/inset)
- [React: useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)
- [Playwright: Network](https://playwright.dev/docs/network)

</details>

#MacFolio #시스템설정

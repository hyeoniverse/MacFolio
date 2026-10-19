---
title: 프로필 사진이 늦게 올 때 비어 보이지 않게 - 시스템 설정의 계정
date: 2026-10-02
category: 개발기/MacFolio/프론트엔드
summary: 시스템 설정의 계정 화면은 GitHub 프로필 사진을 github.com에서 받는데, 늦게 올 때는 사진 자리가 통째로 비었다. 받는 동안 회색 사람 아이콘을 두고 다 받으면 그 위에 사진을 띄운다. CSS 순서 탓에 데스크톱에도 보이던 사이드바의 ›도 줄 끝으로 옮겼다.
---

시스템 설정의 계정 화면은 관리자로 로그인하면 GitHub 프로필 사진(`https://github.com/<아이디>.png`)을 보여 준다. 이 사진은 github.com에서 받아서 가끔 몇 초씩 걸린다. 그동안 사진 자리에는 아무것도 없었다. `<img>`는 받기 전에는 아무것도 그리지 않아서, 56px 자리가 뻥 뚫려 보였다.

![데스크톱 전후](./images/settings-avatar-desktop.jpg '전: 사진 자리가 비어 있음 / 후: 받는 동안 회색 사람 아이콘')

## 고른 방법과 버린 방법

| 방법                                            | 좋은 점                                            | 걸린 점                                                              |
| ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 사진을 서버가 받아 두었다가 같은 주소로 주기    | github.com이 느려도 빠르다                         | 서버에 이미지 프록시가 생기고, 사진이 바뀌면 다시 받아야 한다        |
| 받는 동안 회색 원만 칠하기                      | CSS 한 줄                                          | 받지 못하면 빈 원이 남고, 브라우저의 깨진 이미지 표시가 겹칠 수 있다 |
| 이미 있는 사람 아이콘 위에 사진을 겹치기 (고름) | 로그인 전 모양을 그대로 쓴다. 실패해도 자리가 찬다 | `load`를 놓치는 경우를 따로 챙겨야 한다                              |

사진은 관리자 한 사람의 것이라, 한 번 받으면 다음부터는 브라우저 캐시에서 온다. 늦는 것은 대개 처음 한 번이라 화면에서 그 시간을 메우는 쪽을 골랐다.

## 받는 동안 보이는 자리

로그인하지 않았을 때 쓰던 회색 동그라미와 사람 아이콘이 이미 있었다. 이것을 사진 아래에 깔고, 사진은 다 받은 뒤에 위로 띄운다.

```tsx
<span className="github-avatar" data-loaded={loaded || undefined}>
	<i className="fa-solid fa-user" aria-hidden="true" />
	<img src={avatarUrl(login)} alt="" onLoad={() => setLoaded(true)} />
</span>
```

사진은 처음에 투명하고, `onLoad`가 오면 살짝 나타난다. 받지 못하면(GitHub가 막히거나 아이디가 바뀌면) 깨진 이미지 표시 대신 사람 아이콘이 그대로 남는다.

캐시에 있던 사진은 React가 그리기 전에 이미 다 받아서 `load` 이벤트를 놓칠 수 있다. 그래서 처음 그린 직후에 `complete`와 `naturalWidth`를 한 번 본다.

```tsx
// apps/react/src/shared/auth/GitHubAvatar.tsx
const image = useRef<HTMLImageElement>(null);
const [loaded, setLoaded] = useState(false);
// 캐시에 있어 그리기 전에 이미 받은 사진은 load 이벤트를 놓칠 수 있다
useLayoutEffect(() => {
	if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
}, []);
```

`complete`만 보면 안 된다. 받다가 실패한 이미지도 `complete`는 `true`이고, 그때 `naturalWidth`가 0이다.

![GitHubAvatar의 세 상태](./images/settings-avatar-placeholder-states.svg '받는 중, 다 받음, 받지 못함. 아래 층은 늘 같다')

CSS는 두 층을 같은 동그라미 안에 겹친다. 사진은 `position: absolute; inset: 0`으로 동그라미를 꽉 채우고, 처음에는 `opacity: 0`이다.

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

아이콘 크기는 동그라미 크기를 따라 `0.42em`으로 둔다. 동그라미의 `font-size`만 정하면 56px(설정)이든 64px(로그인 결과 창)이든 같은 비율이다. 로그인 결과 창도 같은 사진을 쓰므로 같은 부품(`GitHubAvatar`)으로 바꿨다.

## 사이드바의 ›

![휴대폰 전후](./images/settings-avatar-mobile.jpg '설정 목록의 ›와 계정 화면의 사진 자리')

데스크톱 사이드바의 ›는 항목 이름 바로 뒤에 붙어 있었다. 사실 이 ›는 휴대폰 목록에만 보이도록 `display: none`을 줬는데, Font Awesome의 `.fa-solid { display: inline-block }`이 나중에 읽혀서 데스크톱에도 보이고 있었다. 우선순위가 같은 클래스 하나끼리라 나중 것이 이긴 것이다.

고칠 때는 선택자를 하나 더 붙여 점수를 올렸다. 순서에 기대면 CSS 파일을 불러오는 차례가 바뀌는 날 또 깨진다.

```css
/* apps/react/src/apps/settings/Settings.css */
/* .settings-nav-item을 붙여 Font Awesome의 display(inline-block)보다 앞서게 한다 */
.settings-nav-item > .settings-nav-chevron {
	width: auto;
	margin-left: auto;
	font-size: 11px;
}
```

›를 줄 오른쪽 끝에 붙였다(`margin-left: auto`). 휴대폰 목록의 ›와 같은 자리다. 아이콘 칸에 준 너비(`1rem`)도 ›에는 쓰지 않는다. 그 너비 안에서 글자가 왼쪽에 붙어 끝에서 몇 px 떨어져 보였기 때문이다. 창이 좁아 항목이 위쪽 탭이 될 때는 ›를 숨긴다.

## 확인

E2E 시험에서 항목마다 ›의 오른쪽 끝과 줄의 안쪽 오른쪽 끝이 같은지, 사진을 붙잡아 두는 동안 사람 아이콘이 보이고 놓으면 사진이 나타나는지 확인한다.

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

"사진을 붙잡아 둔다"는 것은 시험에서 `github.com/*.png` 요청을 가로채 바로 답하지 않는 것이다(`e2e/admin-login.spec.ts`의 "GitHub 사진을 받는 동안에는 자리에 사람 아이콘이 보이고, 받으면 사진으로 바뀐다"). 느린 네트워크를 흉내 내지 않아도 "받는 중"을 원하는 만큼 붙잡아 둘 수 있다.

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

- **비어 있는 시간도 화면이다.** 받는 데 몇 초 걸리는 것은 버그가 아니지만, 그동안 자리가 비면 화면이 깨진 것처럼 보인다.
- **`complete`만으로는 모른다.** 실패한 이미지도 `complete`다. `naturalWidth`까지 봐야 "다 받았다"가 된다.
- **같은 점수면 나중 것이 이긴다.** 바깥 라이브러리의 CSS(Font Awesome)와 클래스 하나끼리 겨루면, 불러오는 순서가 결과를 정한다. 이기고 싶은 규칙은 점수로 이기게 했다.

관련 글: [언제 로그인했고 언제 끝나는지 - 시스템 설정의 계정](/memo/settings-signed-in-at) · [블로그 스크린샷을 테스트 코드로 찍기](/memo/screenshots-with-playwright). PR: [#74](https://github.com/hyeoniverse/MacFolio/pull/74).

#MacFolio #시스템설정

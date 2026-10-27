---
title: 휴대폰 음악의 지금 재생 중을 iOS 18 구성으로 — 대기열 화면, ••• 메뉴, 탭 한 번으로 허용받는 배경 음악
date: 2026-10-23
category: 개발 기록/MacFolio/프론트엔드
summary: 휴대폰 음악 앱의 지금 재생 중을 iOS 18 음악 앱의 구성(쓸어내려 닫는 손잡이, 큰 표지와 ••• 버튼, 대기열 화면, 어두운 메뉴)으로 다시 만들었다. 함께 휴대폰에서 배경 음악이 재생되지 않던 원인(요소마다 사용자 제스처를 요구하는 WebKit의 재생 규칙)을 로딩 화면의 탭 처리 안에서 audio 요소를 허용받는 방식으로 해결했다.
---

휴대폰 음악 앱의 '지금 재생 중' 화면을 iOS 18 음악 앱의 구성에 맞춰 다시 만들었다([#366](https://github.com/hyeoniverse/MacFolio/pull/366)). 같은 PR에서 휴대폰에서는 로딩 화면을 눌러도 배경 음악이 재생되지 않던 문제도 수정했다.

![왼쪽부터 이전 지금 재생 중, 새 표지 화면, 새 대기열 화면, 새 ••• 메뉴](./images/music-now-playing-ios18-compare.jpg '왼쪽부터 이전 화면, 새 표지 화면, 대기열 화면, ••• 메뉴. iPhone 13 크기(390×664)에서 Playwright로 캡처')

## iOS 구성과 이 앱의 기능 대응

iOS 화면의 요소를 하나씩 이 앱의 기능과 대응시켰다. 이 앱에 없는 기능(가사, AirPlay, 즐겨찾기, 스테이션, 크레딧, 제안 줄이기)은 버튼을 만들지 않았다. 누르면 아무 일도 하지 않는 버튼은 실제 기능이 있는 것처럼 보이게 하기 때문이다.

| iOS 18 요소                           | 이전                                 | 이후                                                                                               |
| ------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 맨 위 손잡이                          | 없음 (셸의 떠 있는 뒤로 가기로 닫음) | 쓸어내려 닫는다 (120px 이상 또는 빠르게 튕기기). 누르기·Esc로도 닫히고, 떠 있는 뒤로 가기는 감춘다 |
| 큰 표지 (일시 정지하면 작아짐)        | 있음                                 | 남는 높이에 맞춘 정사각형 (컨테이너 쿼리 단위 `min(100cqw, 100cqh)`)                               |
| 왼쪽 정렬 제목·아티스트, 오른쪽 •••   | 제목·아티스트만                      | 오른쪽에 ••• 버튼. 별(즐겨찾기)은 기능이 없어 뺐다                                                 |
| 두꺼운 진행 막대, 경과/남은 시간      | 4px 막대와 손잡이 점                 | 7px 막대, 손잡이 점 없음, 누르는 동안 11px                                                         |
| 가운데 이전·재생·다음                 | 셔플·이전·재생·다음·반복 다섯 개     | 이전·재생·다음 세 개. 셔플·반복은 대기열 화면으로                                                  |
| 음량 막대                             | 있음                                 | 진행 막대와 같은 두께                                                                              |
| 아래 가사·AirPlay·대기열              | 없음 (다음 재생 목록이 시트 맨 아래) | 대기열 버튼만 오른쪽 끝에 두고, 아이콘의 보이는 끝을 진행 막대 끝에 맞춘다                         |
| 대기열 화면: 썸네일·캡슐 버튼·목록    | 없음                                 | 표지가 썸네일로 줄고 셔플·반복 캡슐과 다음 재생 목록, ≡ 손잡이로 순서 바꾸기                       |
| ••• 메뉴: 추가·즐겨찾기·공유, 이동 등 | 없음                                 | 플레이리스트·앨범·아티스트로 이동 (보관함의 그 목록 화면을 연다)                                   |
| 앨범 색 배경                          | 표지를 `blur(40px) brightness(0.55)` | `blur(60px) saturate(1.6)`에 아래로 어두워지는 스크림                                              |

공유는 넣지 않았다. 메모 글(`/memo/<글>`)과 Safari 프로젝트(`/safari/<프로젝트>`)에는 앱 주소가 있지만 음악에는 없어서, 공유할 주소가 사이트 첫 화면뿐이다. 곡 주소를 만들려면 Cloudflare Worker의 404 판정과 검색 엔진용 HTML까지 함께 바꿔야 하므로 별도 작업으로 남겼다([앱 안의 화면에 주소 붙이기](/memo/app-links)).

<details>
<summary>이전 화면의 '다음 재생' 목록이 보이지 않던 문제</summary>

이전 시트는 세로 flex 상자 안에 표지·제목·막대·버튼·음량·다음 재생 목록을 차례로 쌓았다. 목록의 `flex-shrink` 기본값(1) 때문에 화면 높이가 모자라면 목록이 줄어들었고, iPhone 13 크기(664px)에서 목록 높이가 12px로 줄어 제목 한 줄도 보이지 않았다(`getBoundingClientRect().height`로 측정). 새 화면은 목록을 대기열 화면으로 옮기고, 그 칸을 `grid-template-rows`의 `minmax(0, 1fr)`로 두어 남는 높이 안에서 스크롤하게 했다.

</details>

## 표지가 썸네일로 줄어드는 움직임

대기열 버튼을 누르면 큰 표지가 제목 옆 64px 썸네일로 옮겨 간다. 표지·제목·••• 버튼은 한 그리드 안에 있고, 두 화면은 `grid-template-areas`만 다르다.

```css
.music-now-top {
	grid-template-areas:
		'art art art'
		'info info more';
}

.music-now-playing.queue-open .music-now-top {
	grid-template-areas:
		'art info more'
		'modes modes modes'
		'list list list';
}
```

레이아웃이 바뀌는 속성은 CSS 전환(transition)으로 보간되지 않으므로 [FLIP](https://aerotwist.com/blog/flip-your-animations/) 방식을 썼다. 버튼을 누른 시각에 표지의 위치(`getBoundingClientRect`)를 기록하고, 새 레이아웃이 그려진 직후(`useLayoutEffect`) 새 위치를 재서, 옛 위치에서 출발하는 `transform`을 [Web Animations API](https://developer.mozilla.org/ko/docs/Web/API/Web_Animations_API)로 재생한다. 표지는 두 화면 모두 정사각형이라 `scale` 하나로 크기 차이를 맞출 수 있다. 움직임 줄이기 설정이 켜져 있으면 애니메이션을 건너뛴다.

## 쓸어내려 닫기

iOS의 지금 재생 중에는 뒤로 가기 버튼이 없고, 시트를 아래로 쓸어내려 닫는다. 이 화면도 셸의 떠 있는 뒤로 가기를 감추고(`MobileNavigation`에 추가한 `hideBack` 옵션) 손잡이로 닫는다. 손잡이 막대는 iOS 화면(상태 표시줄 59pt 아래 66pt)처럼 상태 표시줄 바로 아래 6px에 두고, 누르는 영역은 막대 아래로 28px까지 넓혔다. 막대에서 표지까지는 21px, 대기열 화면의 썸네일까지는 15px로, iOS 화면에서 잰 간격(29pt·20pt)을 화면 높이 비율로 줄인 값이다.

| 동작                              | 결과                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 손잡이·표지·제목을 아래로 끄는 중 | 시트가 손가락을 따라 내려오고, 처음 40px 동안 네 모서리가 기기 화면의 곡률(`--phone-screen-radius`, 47px)까지 둥글어진다 |
| 120px 넘게 끌고 놓기              | 닫힌다. 닫힘 애니메이션은 놓은 자리에서 이어진다                                                                         |
| 짧게(16px 초과) 빠르게 튕기기     | 놓기 직전 100ms의 속도가 0.5px/ms를 넘으면 닫힌다                                                                        |
| 그보다 짧거나 느리게 놓기         | 제자리로 돌아온다 (CSS 전환)                                                                                             |
| 손잡이 누르기, Enter, Esc         | 닫힌다. 손잡이는 보이는 막대를 감싼 `<button aria-label="지금 재생 중 닫기">`이다                                        |
| 움직임 줄이기 설정                | 따라 내려오지 않고, 기준을 넘기면 닫히기만 한다                                                                          |

거리·속도 판단은 React와 분리해 `swipe.ts`에 두고 단위 시험으로 확인했다. 쓸기를 시작하는 영역은 손잡이와 표지·제목 머리로 정했다. 진행 막대·음량 막대·••• 버튼·셔플·반복 버튼은 각자 누르기나 끌기 동작이 있어 제외했다. 다음 재생 목록도 제외했다. iOS는 목록이 맨 위로 스크롤된 상태에서 아래로 끌면 시트가 내려오지만, 브라우저는 세로 스크롤이 시작되면 그 손가락의 포인터 이벤트를 `pointercancel`로 끊는다. 목록에서도 시트를 끌려면 터치 이벤트에서 스크롤을 직접 막아야 해서, 이번에는 목록을 스크롤 전용으로 두었다.

셸에는 "화면 어디서든 아래로 쓸면 제어 센터가 내려온다"는 동작(`useVerticalSwipe`)이 있다. 쓸기 영역에 `data-swipe-ignore`를 붙여 시트를 끄는 손가락이 제어 센터를 열지 않게 했다. 표지 이미지는 `draggable={false}`로 두었다. 브라우저의 이미지 끌어 옮기기가 시작되면 포인터 이벤트가 끊기기 때문이다.

## 아이콘의 보이는 끝 맞추기

진행 막대·음량 막대·••• 버튼의 오른쪽 끝은 같은 x좌표(390px 화면에서 366px)에 있었지만, 대기열 아이콘의 보이는 끝은 319px로 47px 안쪽에 있었다. 아래 줄을 가사·AirPlay·대기열 세 칸으로 나누고 셋째 칸 가운데에 버튼을 두었기 때문이다. 다음 재생 목록의 ≡ 손잡이도 44px 버튼 가운데에 있어 13px 안쪽이었다.

Font Awesome 6의 글리프 상자는 1.25em이고, 그림은 그 안에서 좌우에 여백을 두고 그려진다. `fa-list-ul`은 좌우 2/15em, `fa-bars`는 0.1875em이다. 그래서 상자의 끝을 맞춰도 보이는 끝은 맞지 않는다. 버튼 상자를 글리프 상자와 같게 두고 그림의 여백만큼 오른쪽으로 내보냈고, 44px 누르는 영역과 켜졌을 때의 원은 의사 요소로 그 둘레에 그렸다. E2E 시험은 상자 좌표 대신 화면을 캡처해 밝은 픽셀의 오른쪽 끝을 찾고, 진행 막대 끝과 1px 이내인지 확인한다.

## 다음 재생 목록의 순서 바꾸기

대기열은 `packages/desktop-core`의 플레이어 store가 관리한다([음악 플레이어를 둘로 나누기](/memo/desktop-core-music)). 여기에 두 동작을 추가했다.

- `jumpTo(trackId)`: 목록의 곡을 누르면 대기열 순서는 그대로 두고 그 위치로 건너뛴다. 이전에는 `playFrom`으로 대기열을 처음부터 다시 만들었다
- `moveUpcoming(from, to)`: '다음 재생' 목록(지금 곡 다음부터, 끝에 닿으면 처음부터 지금 곡 앞까지)에서 한 곡을 옮긴다. 결과 대기열은 지금 곡을 맨 앞(position 0)에 두고 바뀐 순서로 잇는다

≡ 손잡이는 설정 앱의 프로젝트 순서와 같은 `startPointerReorder`를 쓰고, ↑·↓ 키로도 옮길 수 있다.

## 휴대폰에서 배경 음악이 재생되지 않던 원인

데스크톱은 로딩 화면을 누르고 진행 막대가 차면(약 2.5초 뒤) `startMusic` 이벤트로 배경 음악을 재생한다. 그런데 이 이벤트를 받는 코드에 `if (!isMobileViewport(getViewport())) play();` 조건이 있어 휴대폰에서는 재생하지 않았다. 2024년 첫 코드부터 있던 조건이고 이유는 기록되어 있지 않다.

조건만 지우면 iPhone Safari에서는 여전히 재생되지 않는다. WebKit은 소리가 있는 미디어를 **요소마다** 사용자 제스처(탭·클릭) 처리 중에 처음 `play()`해야 재생을 허용하고, 한 번 허용된 요소는 그 뒤로 제스처 없이 `play()`해도 재생한다[^webkit]. 배경 음악의 `play()`는 탭 처리가 끝나고 2.5초 뒤에 호출되므로 거절된다.

| 시각                     | 이전                                    | 이후                                                     |
| ------------------------ | --------------------------------------- | -------------------------------------------------------- |
| 로딩 화면 탭 (제스처 중) | 시작음 재생, 배경 음악 요소는 아직 없음 | 시작음 재생, 배경 음악 요소에 `play()` 후 바로 `pause()` |
| 약 2.5초 뒤 `startMusic` | 휴대폰은 조건문으로 건너뜀              | `play()` 호출. 이미 허용된 요소라 재생된다               |

탭 처리 안에서 허용받으려면 그 시각에 배경 음악 요소가 있어야 한다. 그런데 바탕화면(휴대폰은 홈 화면)은 첫 방문 성능을 위해 로딩 화면을 누른 뒤에 렌더링하고([첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet)), 음악 상태(`MusicProvider`)와 `<audio>`도 그 안에 있었다. 그래서 audio 요소를 React 밖의 모듈(`apps/music/musicAudio.ts`)에서 하나만 만들고, 로딩 화면과 `MusicProvider`가 같은 요소를 쓰게 했다. 이벤트 처리기는 JSX 속성 대신 `addEventListener`로 연결한다.

```ts
/** 탭·클릭 처리 중에 동기적으로 부른다 (await·setTimeout 뒤면 제스처가 지나 허용되지 않는다) */
export function unlockMusicAudio() {
	const audio = musicAudio();
	if (!audio.paused) return;
	audio.play().catch(() => {});
	audio.pause();
}
```

`play()` 직후 `pause()`하므로 데이터가 도착하기 전에 멈춰 소리가 나지 않는다. 이때 `play()`의 약속은 `AbortError`로 거절되지만 허용 여부와는 관계없다.

<details>
<summary>스크립트를 내려받기 전에 첫 화면을 누른 경우</summary>

`index.html`의 첫 화면(`#boot-splash`)은 스크립트를 내려받는 동안 누른 입력을 `window.__macfolioTapped`에 기록하고, 로딩 화면이 렌더링되자마자 진행 막대를 시작한다. 이 경로의 `unlockMusicAudio()`는 탭 처리 밖에서 호출되므로 iPhone Safari에서는 허용되지 않고, 2.5초 뒤의 `play()`도 거절된다. 이때는 기존 처리대로 재생 상태가 꺼진 채로 남아 미니 플레이어와 위젯이 재생 버튼(▶)을 표시하고, 방문자가 그 버튼을 누르면 재생된다.

</details>

### 시험에서 WebKit의 규칙 흉내 내기

Playwright의 모바일 프로젝트(iPhone 13, Pixel 7)는 Chromium으로 실행되고, 시험용 Chromium은 사용자 제스처 없이도 소리 재생을 허용한다. 조건문만 지워도 시험은 통과하므로, 시험이 iPhone의 실패를 재현하도록 `HTMLMediaElement.prototype.play`를 바꿔 WebKit의 규칙을 흉내 냈다.

```ts
const allowed = new WeakSet<HTMLMediaElement>();
let gesture = false;
for (const type of ['click', 'touchend', 'keydown'])
	window.addEventListener(
		type,
		() => {
			gesture = true;
			setTimeout(() => (gesture = false), 0);
		},
		true
	);
HTMLMediaElement.prototype.play = function () {
	if (gesture) allowed.add(this);
	if (!allowed.has(this)) return Promise.reject(new DOMException('사용자 제스처 없음', 'NotAllowedError'));
	return play.call(this);
};
```

이 규칙에서 `unlockMusicAudio()` 호출을 주석 처리하면 "로딩 화면을 탭하면 배경 음악이 재생된다" 시험이 실패하고, 되돌리면 통과하는 것을 확인했다. 흉내일 뿐이므로 실제 iPhone Safari에서도 따로 확인한다.

## 관련 글

- [음악 앱 버그 세 가지 - 꺼진 앱, 누적되는 표지, 반복되는 시트 애니메이션](/memo/music-player-fixes): 이전 지금 재생 중 시트와 배경 음악의 실행 상태
- [음악 플레이어를 둘로 나누기 - 무엇을 재생할지와 어떻게 재생할지](/memo/desktop-core-music): 이 글의 대기열 동작을 추가한 플레이어 store
- [휴대폰 앱들을 메모처럼 - 공통 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style): 휴대폰 음악 보관함의 이전 구성
- [iOS Safari에서만 음악 위젯 모서리가 각지는 문제 — 블러 레이어와 border-radius 클리핑](/memo/music-widget-ios-corners): 같은 표지 블러 배경의 Safari 문제
- [첫 방문 전송량 9MB를 0.8MB로 — 글꼴, 글 원문, 앱 코드, 이미지 최적화 과정](/memo/site-performance-diet): 로딩 화면을 누른 뒤에 바탕화면을 그리게 된 배경

[^webkit]: WebKit 블로그 [New `<video>` Policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/), MDN [자동 재생 가이드](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)

#MacFolio #프론트엔드 #iOS #Safari #React

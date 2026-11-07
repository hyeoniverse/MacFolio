---
title: 앱 목록에 등록하지 않고 데스크톱이 직접 렌더링하는 시스템 창
date: 2026-10-10
category: 개발 기록/MacFolio/구조·상태 관리
summary: Apple 메뉴 맨 위의 '이 Mac에 관하여'를 macOS Sequoia와 같은 작은 창으로 만들고, Mac 사양 대신 만든 사람의 프로필을 넣었다. 앱이 아닌 시스템 창으로 둔 이유, 다른 앱을 여는 요청 저장소, 끌기·초점 처리와 E2E 시험을 정리했다.
---

## 배경: macOS의 '이 Mac에 관하여'

![MacFolio의 Apple 메뉴](./images/about-this-mac-apple-menu.jpg#float-right '현재 Apple 메뉴. 맨 위에 이 Mac에 관하여가 있고, 그 아래에 방문자 수, 시스템 설정, 다크 모드, API 문서 같은 사이트 공용 항목이 이어진다')

macOS 화면 왼쪽 위의 사과 아이콘을 누르면 **Apple 메뉴**가 열린다. 이 메뉴는 어느 앱을 사용하고 있든 항상 같은 항목을 표시하는 운영체제 공용 메뉴이고, 맨 위 항목이 **이 Mac에 관하여**(About This Mac)다. 선택하면 화면 가운데에 작은 창이 표시되고, 다음 정보가 나타난다.

- Mac 제품 이미지와 모델 이름(예: MacBook Pro)
- 칩, 메모리, 일련 번호, macOS 버전
- 시스템 설정으로 이동하는 '추가 정보…' 버튼
- 규제 인증서 링크와 저작권 줄

Apple 지원 문서도 Mac의 기본 정보를 확인하는 방법으로 이 메뉴를 안내한다[^apple-info]. MacFolio의 Apple 메뉴에는 이 항목이 없어서, 메뉴를 열면 macOS와 달리 첫 항목 위치가 비어 있었다.

포트폴리오 사이트에서 "이 Mac"에 해당하는 대상은 사이트를 만든 사람이다. 그래서 macOS와 같은 창 형태를 사용하고, 사양을 표시하는 위치에 프로필을 넣었다. 작업은 PR [#168](https://github.com/hyeoniverse/MacFolio/pull/168)에 포함되어 있다. 첫 커밋에서 창을 구현했고, 같은 날 세 차례 수정했다.

1. 프로필 줄의 '역할'을 '직무'로 변경
2. '추가 정보…'와 링크가 여는 대상 변경
3. 이메일 링크 스타일 변경

## 표시 항목

macOS 창의 각 위치에 사이트의 어떤 값을 넣었는지 정리하면 다음과 같다.

| macOS               | 이 사이트                                   |
| ------------------- | ------------------------------------------- |
| Mac 그림            | GitHub 프로필 사진 (원형)                   |
| MacBook Pro         | 김정현, 아래에 Kim Jeong Hyeon              |
| 칩·메모리·일련 번호 | 직무·학교·위치·이메일·GitHub·주요 기술      |
| 추가 정보…          | 시스템 설정의 '정보'를 연다                 |
| 규제 인증서         | 개인정보 처리 방침                          |
| ™ & © Apple Inc.    | ™ & © 올해 Kim Jeong Hyeon. 모든 권리 보유. |

![이 Mac에 관하여 창](./images/about-this-mac-window.jpg#float-right '미리보기 서버(API 없음)에서 연 창. GitHub 사진을 받지 못해 이름 끝 두 글자를 회색 원에 표시했다')

처음에는 값을 `shared/profile.ts`의 상수 `PROFILE`과 `SKILLS`에서 직접 읽었다. 이후 관리자가 시스템 설정에서 프로필을 수정할 수 있게 되면서([코드를 고치지 않고 프로필 바꾸기](/memo/site-profile-editing)), 현재는 `shared/site/profileStore.ts`의 `useProfile()`로 읽는다. 사양 줄을 생성하는 함수는 시스템 설정의 '정보' 항목과 함께 사용하려고 `desktop/about/profileInfo.ts`로 분리했다.

```ts
export const profileRows = (profile: SiteProfile): ProfileRow[] =>
	[
		{ label: '직무', value: profile.role },
		{ label: '학교', value: profile.school },
		{ label: '위치', value: profile.location },
		{ label: '이메일', value: profile.email, href: `mailto:${profile.email}` },
		{ label: 'GitHub', value: githubLogin(profile), href: profile.github },
		{ label: '주요 기술', value: profile.skills.frontend.slice(0, 3).join(' · ') },
	].filter((row) => row.value);
```

이 함수는 프로필 객체를 받아 `{ 라벨, 값, 링크 }` 형태의 줄 배열을 반환한다. 마지막 `filter`가 값이 빈 문자열인 줄을 제외한다. 입력에 따라 결과가 어떻게 달라지는지 예를 들면 다음과 같다.

| 입력                                                     | 결과                                          |
| -------------------------------------------------------- | --------------------------------------------- |
| 여섯 값이 모두 있다                                      | 줄 6개                                        |
| `school: ''` (학교를 비움)                               | 학교 줄이 빠진 5개. 창 높이도 한 줄만큼 준다  |
| `skills.frontend: ['React', 'Next.js', 'TypeScript', …]` | 주요 기술 줄은 `React · Next.js · TypeScript` |
| `github: 'https://github.com/hyeoniverse'`               | GitHub 줄의 값은 계정 이름 `hyeoniverse`      |

주요 기술은 프론트엔드 기술의 앞 세 개만 표시하고, 나머지는 '추가 정보…'에서 확인한다.

사진 주소는 GitHub 계정 이름으로 생성한다. GitHub는 `https://github.com/<계정>.png` 주소로 해당 계정의 프로필 사진을 제공하므로, 위 예에서는 `https://github.com/hyeoniverse.png?size=280`이 된다. 미리보기 서버처럼 외부 네트워크에 접근할 수 없거나 주소가 잘못되어 이미지를 불러오지 못하면, `<img>`의 `onError`가 실패한 주소를 상태에 저장하고 그 자리에 이름 끝 두 글자(`'김정현'.slice(-2)`, 즉 '정현')를 회색 원 안에 표시한다. 실패한 주소와 현재 주소를 비교하므로, 프로필의 GitHub 주소가 바뀌면 새 주소로 다시 시도한다.

## 앱과 시스템 창 중 구현 방식 선택

이 사이트에서 앱 창은 앱 목록(`apps/manifest.ts`)에 등록된 앱마다 하나씩 생성된다. 창 관리 기능(끌기, 앞으로 가져오기, 최소화)은 모든 앱 창이 함께 사용하는 `Window` 컴포넌트가 제공한다. 따라서 가장 간단한 구현은 앱을 하나 더 등록하는 방법이다. 하지만 macOS에서 이 창은 앱이 아니라 운영체제가 표시하는 창이다. Dock에 아이콘이 생기지 않고, 응용 프로그램 폴더에도 없다. 두 방법을 비교했다.

| 방법                                     | 장점                                                 | 단점                                                                                              |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 앱으로 등록                              | 창 관리, 메뉴 막대의 앱 이름 표시를 그대로 사용      | Dock 아이콘, Finder의 응용 프로그램, 터미널 `open` 목록에 모두 추가된다. 최소화·확대도 활성화된다 |
| 데스크톱이 직접 렌더링하는 창 (**채택**) | macOS처럼 Dock·Finder에 표시되지 않는다. 코드가 작다 | 끌기, 초점, Esc 처리를 직접 구현해야 한다                                                         |

앱 목록에 등록하고 Dock·Finder에서만 숨기는 방법도 검토했다. 하지만 Dock, Launchpad, Finder, 터미널, 휴대폰 홈 화면이 모두 같은 앱 목록을 읽으므로 ==앱 목록을 읽는 모든 위치에 예외 처리가 필요해== 채택하지 않았다. 직접 렌더링하는 방식의 최초 구현은 `AboutThisMac.tsx` 124줄, CSS 163줄, 저장소 9줄이었다.

### 열림 상태를 보관하는 저장소

여기서 **저장소**(store)는 React 컴포넌트 바깥에 값을 하나 보관하고, 값이 바뀌면 등록된 함수(구독자)를 호출하는 작은 객체다. MacFolio는 `@macfolio/desktop-core`의 `createStore`로 저장소를 만들고, React 컴포넌트는 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)로 그 값을 읽는다. 값을 바꾸는 쪽(Apple 메뉴)과 값을 읽는 쪽(창 컴포넌트)이 서로를 import하지 않고 저장소만 공유한다.

![열림 상태와 위치](./images/about-this-mac-state.svg '열림 여부는 저장소가, 이동한 거리는 컴포넌트가 보관한다')

열림 상태는 `aboutStore` 하나가 관리한다. Apple 메뉴는 이 저장소의 `openAbout`만 호출한다. 창 컴포넌트는 `Desktop.tsx`에 항상 배치되어 있고, `open`이 `true`일 때만 내용을 렌더링한다.

```ts
export const aboutStore = createStore<{ open: boolean }>({ open: false });
export const openAbout = () => aboutStore.setState({ open: true });
export const closeAbout = () => aboutStore.setState({ open: false });
```

### 직접 구현한 창 동작

앱 창이 아니므로 다음 동작은 이 컴포넌트에 직접 구현했다.

| 동작        | 구현                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| 창 버튼     | macOS처럼 닫기 버튼만 빨간색이고, 최소화·확대 버튼은 회색 비활성 상태                                          |
| 끌어 옮기기 | 창의 빈 영역을 끌면 이동한다. 시작 위치에서 이동한 거리를 `offset`에 저장하고 CSS `translate`로 적용한다       |
| 끌기 제외   | 버튼·링크·값(`dd`) 위에서는 끌기를 시작하지 않는다. 이메일 주소를 드래그해 선택·복사할 수 있어야 하기 때문이다 |
| 초점·키보드 | 열리면 닫기 버튼에 초점을 두고, 열려 있는 동안에만 Esc 키 입력을 처리한다                                      |
| 휴대폰      | 휴대폰 화면에는 Apple 메뉴가 없으므로 이 창도 없다                                                             |

끌기에는 브라우저의 **포인터 이벤트**를 사용했다. 포인터 이벤트는 마우스, 터치, 펜 입력을 `pointerdown`(누름), `pointermove`(이동), `pointerup`(뗌) 세 이벤트로 통일해 전달한다. 이동 거리 계산은 다음 그림과 같다.

![끌기 좌표 계산](./images/about-this-mac-drag.svg '포인터를 누른 위치와 현재 위치의 차이를 이전 offset에 더한다. 버튼·링크·dd 위에서는 시작하지 않는다')

1. `pointerdown`: 누른 위치 `(700, 300)`과 현재 `offset`(처음에는 `(0, 0)`)을 `drag` ref에 저장한다.
2. `pointermove`: 현재 위치가 `(760, 340)`이면 `offset`은 `(0 + 760 − 700, 0 + 340 − 300) = (60, 40)`이 되고, 창 요소에 `translate: 60px 40px`가 적용된다.
3. `pointerup`: `drag`를 `null`로 비운다. 다시 끌면 시작값이 `(60, 40)`이 되므로 창이 처음 자리로 돌아가지 않는다.

`pointerdown`에서 [`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)를 호출한다. 이 메서드는 이후 해당 포인터의 이벤트를 `pointerup`까지 지정한 요소로 전달하도록 브라우저에 요청한다. 포인터를 빠르게 움직여 커서가 창 밖으로 나가도 `pointermove`가 계속 창에 도착하므로 추적이 끊기지 않는다.

초점과 Esc 처리는 W3C의 대화상자 패턴[^apg-dialog]을 따랐다. 이 패턴은 대화상자가 열리면 초점을 대화상자 안의 요소로 옮기고, Escape 키로 대화상자를 닫도록 권장한다. 키보드 사용자는 창이 열리자마자 Enter로 닫거나 Tab으로 링크를 이동할 수 있다.

## 창에서 다른 앱을 여는 세 경로

창 안의 링크 세 개('추가 정보…', 이메일, 개인정보 처리 방침)는 모두 다른 앱을 연다. 예를 들어 '추가 정보…'는 시스템 설정을 열고 '정보' 항목까지 선택해야 한다. 창이 시스템 설정의 내부 상태(`setSection`)를 직접 변경하면 창 파일이 시스템 설정의 구현에 의존한다. 그래서 세 링크가 같은 방식을 사용한다.

1. 대상 앱 전용 **요청 저장소**에 "이 대상을 열어 달라"는 값을 기록한다.
2. `openApp`으로 대상 앱을 연다.
3. 대상 앱은 그 저장소를 구독하다가 값을 읽고 `null`로 초기화한다.

![요청 저장소 세 개](./images/about-this-mac-requests.svg '추가 정보…, 이메일, 개인정보 처리 방침이 각각 저장소 하나씩을 사용한다')

시스템 설정의 요청 저장소는 `apps/settings/settingsRequest.ts`의 `requestedSection`이고, 시스템 설정은 이렇게 받는다(`apps/settings/Settings.tsx`).

```ts
useEffect(() => {
	const take = ({ section: requested }: { section: string | null }) => {
		const match = SECTIONS.find((item) => item.id === requested);
		if (!match) return;
		setSection(match.id);
		setPhoneOpen(true);
		requestedSection.setState({ section: null });
	};
	take(requestedSection.getState());
	return requestedSection.subscribe(take);
}, []);
```

마운트 시각에 현재 값을 한 번 읽고(`take(getState())`), 이후에는 구독한다. 이 두 줄 덕분에 시스템 설정이 닫혀 있든 이미 열려 있든 정보 항목으로 이동한다. 두 경우의 실행 순서는 다음과 같다.

![요청 전달 순서](./images/about-this-mac-request-timing.svg '닫혀 있으면 마운트 시각의 getState가, 열려 있으면 구독 함수가 요청을 읽는다')

| 경우                     | 동작                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| 대상 앱이 닫혀 있음      | 기록 시각에는 구독자가 없다. `openApp`으로 앱이 마운트되면서 `take(getState())`가 남아 있는 요청을 읽는다 |
| 대상 앱이 이미 열려 있음 | `createStore`의 `setState`는 구독자를 동기적으로 호출하므로, 구독 중인 `take`가 기록 즉시 요청을 읽는다   |
| 요청을 처리한 뒤         | 저장소 값을 `null`로 초기화해 다음 실행에 영향을 주지 않는다                                              |

==값을 읽은 즉시 초기화하므로== 나중에 Dock에서 시스템 설정을 열어도 정보 항목으로 다시 이동하지 않는다. 세 링크의 대상은 다음과 같다.

### 추가 정보…

처음에는 Safari(자기소개가 있는 첫 화면)를 열게 했다. 사용해 보니 작은 창에서 상세한 화면으로 이동한다는 흐름이 드러나지 않았다. macOS에서 이 버튼은 시스템 설정의 **일반 › 정보**를 연다. 그래서 시스템 설정에 **정보** 항목(`AboutPane.tsx`)을 추가하고 그 항목을 열게 했다. 정보 항목에는 작은 창보다 자세한 내용이 그룹별로 있다.

| 그룹                | 내용                              |
| ------------------- | --------------------------------- |
| 프로필              | 이름(한글·영문), 직무, 학교, 위치 |
| 연락처              | 이메일, GitHub                    |
| 기술                | 프론트엔드·백엔드·인터랙션 전부   |
| 이 사이트(MacFolio) | 만든 기술, 저장소                 |

### 이메일

`mailto:`는 링크를 누르면 기기에 설정된 메일 프로그램을 열도록 하는 주소 형식이다[^mailto]. 이 창은 `mailto:`로 기기의 메일 앱을 여는 대신, 이 사이트의 **메일 앱**에서 '새로운 메시지'를 바로 연다(`ProfileLink.tsx`, [Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)). 받는 사람이 사이트 주인으로 고정된 작성 화면이라, 방문자는 사이트를 벗어나지 않고 메일을 보낸다. 휴대폰에서는 아래에서 올라오는 작성 시트가 열린다.

클릭 처리기가 기본 동작을 막고 메일 앱을 열지만, `href`에는 계속 `mailto:`를 지정했다. 그래서 오른쪽 클릭의 '링크 주소 복사'나 새 탭으로 열기 같은 브라우저 기능은 그대로 동작한다. 처음에는 이메일을 검은색 글자로 표시했는데, 클릭할 수 있는 요소로 인식하기 어려웠다. 그래서 GitHub 링크처럼 파란색 글자와 ↗ 표시를 추가했다.

### GitHub

외부 링크라 새 탭으로 연다. `openExternal`로 열어 이탈 링크 클릭으로 집계한다([sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)).

### 개인정보 처리 방침

macOS의 이 창에는 저작권 줄 바로 위에 **규제 인증서** 링크가 있다. 이 사이트에서 그 위치에 해당하는 문서는 개인정보 처리 방침이다. 방문 분석, 방문자 쿠키, 메일 처리를 설명하는 문서다. 같은 위치에 같은 형태의 링크를 배치하고, Apple 메뉴의 '개인정보 처리 방침'처럼 Finder에서 `docs/privacy.md`를 연다.

> [!NOTE]
> 세 링크 모두 클릭하면 먼저 이 창을 닫는다. 이 창은 다른 창보다 위에 표시되므로, 열어 둔 채로 두면 새로 연 앱을 가린다.

## 확인

`apps/react/e2e/about-this-mac.spec.ts`에 E2E 시험 4개를 작성했다. E2E(end-to-end) 시험은 실제 브라우저(Playwright)로 사이트를 열어 사용자처럼 클릭하고 화면을 검사하는 시험이다.

| 시험                                                                                 | 확인 내용                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apple 메뉴 맨 위에서 열면 만든 사람의 프로필이 보이고, 닫기·Esc로 닫는다             | 첫 메뉴 항목, 이름·영문 이름, 사양 줄 6개, GitHub의 ↗와 새 탭, 열면 메뉴가 닫히고 닫기 버튼에 초점                                                                 |
| 빈 곳을 잡아 옮기고, 추가 정보…는 macOS처럼 시스템 설정의 정보를 연다                | 끈 거리만큼 이동하는지, 설정이 이미 열려 있어도 정보 항목으로 이동하는지                                                                                           |
| 저작권 줄 위의 개인정보 처리 방침(macOS의 규제 인증서 자리)은 Finder에서 문서를 연다 | Finder에서 `docs/privacy.md`가 열리는지                                                                                                                            |
| 이메일을 누르면 기기의 메일 앱이 아니라 이 사이트의 메일 앱에서 새로운 메시지를 연다 | 받는 사람 줄에 사이트 주인의 이름과 이메일이 표시되는지. 작성을 취소해 메일 앱을 열어 둔 상태에서 시스템 설정의 정보에서 이메일을 다시 눌러도 작성 화면이 열리는지 |

> [!IMPORTANT] 요청 저장소 구조를 검증하는 시험
> 마지막 시험의 후반부가 요청 저장소 구조의 핵심을 검증한다. 요청 저장소를 마운트 시각에만 읽고 구독하지 않았다면, 이미 열려 있는 메일 앱은 두 번째 요청을 처리하지 못한다.

## 남은 과제와 정리

- 창 위치는 저장하지 않는다. 닫았다 다시 열면 `offset`이 `(0, 0)`으로 초기화되어 화면 가운데에 표시된다. macOS도 같은 방식으로 동작해 그대로 두었다.
- 창을 화면 밖으로 끌어내는 것을 제한하지 않는다. 닫고 다시 열면 가운데로 돌아오므로 현재까지 문제가 되지 않았다.
- "다른 앱을 열어 달라"는 요청은 앱끼리 직접 호출하지 않고 ==작은 저장소에 기록하는 방식==이 적합했다. 대상 앱이 닫혀 있든 열려 있든 같은 코드로 처리하고, 요청하는 쪽은 대상 앱의 내부 구현에 의존하지 않는다. 이후 바탕화면 폴더 아이콘(`finderFolderRequest`)도 같은 방식으로 구현했다.

## 관련 글

- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus)
- [Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)
- [코드를 고치지 않고 프로필 바꾸기](/memo/site-profile-editing)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)

[^apple-info]: Apple 메뉴 › 이 Mac에 관하여에서 기본 정보를 확인하고, 보증 범위·시스템 보고서 같은 세부 정보는 시스템 설정의 일반에서 확인한다. [Apple 지원: Mac의 시스템 정보 확인하기](https://support.apple.com/guide/mac-help/get-system-information-about-your-mac-syspr35536/mac)

[^apg-dialog]: WAI-ARIA Authoring Practices Guide의 Dialog (Modal) 패턴. 대화상자가 열리면 초점을 대화상자 안의 요소로 옮기고, Escape 키로 닫는다. [W3C APG: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

[^mailto]: `mailto:` 주소 형식은 RFC 6068에 정의되어 있다. [RFC 6068: The 'mailto' URI Scheme](https://www.rfc-editor.org/rfc/rfc6068)

<details>
<summary>참고 문헌</summary>

- [Apple 지원: Get system information about your Mac](https://support.apple.com/guide/mac-help/get-system-information-about-your-mac-syspr35536/mac)
- [MDN: Element.setPointerCapture()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [React: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [W3C WAI-ARIA APG: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [RFC 6068: The 'mailto' URI Scheme](https://www.rfc-editor.org/rfc/rfc6068)

</details>

#MacFolio #프론트엔드 #메뉴막대 #macOS

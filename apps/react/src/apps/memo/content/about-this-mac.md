---
title: Apple 메뉴의 '이 Mac에 관하여'에 프로필 넣기
date: 2026-10-10
category: 개발기/MacFolio/프론트엔드
summary: Apple 메뉴 맨 위의 '이 Mac에 관하여'를 macOS Sequoia와 같은 작은 창으로 만들고, Mac 사양 대신 만든 사람의 프로필을 넣었다. 앱이 아닌 시스템 창으로 둔 이유, 다른 앱을 여는 요청 저장소, 끌기·초점 처리와 E2E 시험을 정리했다.
---

macOS의 Apple 메뉴 맨 위에는 늘 **이 Mac에 관하여**가 있다. 누르면 화면 가운데에 작은 창이 뜨고, Mac 그림, 이름(MacBook Pro), 칩·메모리·일련 번호·macOS 버전, '추가 정보…' 버튼이 보인다. 이 사이트의 Apple 메뉴에는 이 항목이 없었다. 메뉴를 열면 맨 위가 비어 있어서, macOS를 흉내 낸 사이트치고는 어색했다.

포트폴리오에서 "이 Mac"은 결국 만든 사람이다. 그래서 같은 창 모양을 그대로 쓰고, 사양 자리에 프로필을 넣었다. 작업은 PR [#168](https://github.com/hyeoniverse/MacFolio/pull/168) 하나에 들어 있다. 첫 커밋이 창을 만들었고, 같은 날 세 번 고쳤다('역할'을 '직무'로, 추가 정보…와 링크의 행선지, 이메일 링크 모양).

## 무엇이 보이나

| macOS               | 이 사이트                                   |
| ------------------- | ------------------------------------------- |
| Mac 그림            | GitHub 프로필 사진 (동그랗게)               |
| MacBook Pro         | 김정현, 아래에 Kim Jeong Hyeon              |
| 칩·메모리·일련 번호 | 직무·학교·위치·이메일·GitHub·주요 기술      |
| 추가 정보…          | 시스템 설정의 '정보'를 연다                 |
| 규제 인증서         | 개인정보 처리 방침                          |
| ™ & © Apple Inc.    | ™ & © 올해 Kim Jeong Hyeon. 모든 권리 보유. |

![이 Mac에 관하여 창](./images/about-this-mac-window.jpg '미리보기 서버(API 없음)에서 연 창. GitHub 사진을 받지 못해 이름 끝 두 글자를 회색 동그라미에 썼다')

처음에는 값을 `shared/profile.ts`의 상수 `PROFILE`과 `SKILLS`에서 바로 읽었다. 지금은 관리자가 시스템 설정에서 프로필을 고칠 수 있게 되어([사이트 프로필 편집](/memo/site-profile-editing)), `shared/site/profileStore.ts`의 `useProfile()`로 읽는다. 사양 줄을 만드는 함수는 시스템 설정의 '정보'와 함께 쓰려고 `desktop/about/profileInfo.ts`로 뺐다.

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

비운 값은 줄째 뺀다. 학교를 지우면 다섯 줄만 남고, 창 높이도 그만큼 줄어든다. 주요 기술은 프론트엔드 기술의 앞 세 개만 보여 준다. 나머지는 '추가 정보…'에서 본다.

사진은 GitHub 주소에서 만든 프로필 사진 주소를 쓴다. 받지 못하면(미리보기 서버처럼 바깥에 못 나가거나 주소가 틀렸을 때) 이름 끝 두 글자를 회색 동그라미에 쓴다. 실패한 주소를 상태로 기억해 두고, 프로필의 GitHub 주소가 바뀌면 그때 다시 시도한다.

## 앱으로 만들까, 시스템 창으로 만들까

이 사이트에서 창을 띄우는 가장 쉬운 방법은 앱을 하나 더 등록하는 것이다. 그러면 창 관리(끌기, 앞으로 가져오기, 최소화)가 공짜로 따라온다. 하지만 macOS에서 이 창은 앱이 아니다. 두 방법을 놓고 비교했다.

| 방법                                  | 좋은 점                                   | 문제                                                                                        |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 앱으로 등록                           | 창 관리, 메뉴 막대 앱 이름이 그대로 된다  | Dock 아이콘, Finder의 응용 프로그램, 터미널 `open` 목록에 모두 생긴다. 최소화·확대도 켜진다 |
| 데스크톱이 직접 그리는 창 (고른 방법) | macOS처럼 Dock·Finder에 없다. 코드가 작다 | 끌기, 초점, Esc를 직접 만들어야 한다                                                        |

앱 목록에 넣고 Dock·Finder에서만 숨기는 방법도 생각했지만, 앱 목록을 읽는 곳마다 예외를 두어야 해서 버렸다. 직접 그리는 쪽은 처음 만들 때 `AboutThisMac.tsx` 124줄, CSS 163줄, 저장소 9줄로 끝났다.

![열림 상태와 위치](./images/about-this-mac-state.svg '열림은 작은 저장소가, 옮긴 거리는 컴포넌트가 갖는다')

열림 상태는 `aboutStore` 하나가 갖는다. Apple 메뉴는 이 저장소의 `openAbout`만 부르고, 창은 `Desktop.tsx`에 늘 놓여 있다가 `open`이 참일 때만 그린다.

```ts
export const aboutStore = createStore<{ open: boolean }>({ open: false });
export const openAbout = () => aboutStore.setState({ open: true });
export const closeAbout = () => aboutStore.setState({ open: false });
```

직접 만든 동작은 다음과 같다.

- macOS처럼 닫기 버튼만 빨갛고, 최소화·확대는 회색으로 꺼져 있다.
- 창의 빈 곳을 잡아 옮긴다. 시작 위치에서 움직인 만큼을 `offset`에 두고 CSS `translate`로 옮긴다. 포인터를 잡아 두어(`setPointerCapture`) 빨리 끌어도 놓치지 않는다.
- 버튼·링크·값(`dd`) 위에서는 끌기를 시작하지 않는다. 이메일 주소를 긁어 복사할 수 있어야 해서다.
- 열리면 닫기 버튼에 초점이 가고, 열려 있는 동안에만 Esc를 듣는다.
- 휴대폰에는 Apple 메뉴가 없으므로 이 창도 없다.

## 창 밖으로 나가는 세 갈래

창 안의 링크 셋은 모두 다른 앱을 연다. 창이 그 앱의 속을 알 필요가 없도록, 모두 같은 방식을 쓴다. 작은 저장소에 "이걸 열어 달라"고 적고 `openApp`만 부른다. 받는 앱은 그 저장소를 구독하다가 값을 읽고 비운다.

![요청 저장소 세 개](./images/about-this-mac-requests.svg '추가 정보…, 이메일, 개인정보 처리 방침이 각각 저장소 하나씩을 쓴다')

시스템 설정은 이렇게 받는다(`apps/settings/Settings.tsx`).

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

마운트할 때 지금 값을 한 번 읽고(`take(getState())`), 그 뒤로는 구독한다. 그래서 시스템 설정이 닫혀 있어도, 이미 열려 있어도 정보로 간다. 읽은 뒤 바로 비우므로 다음에 설정을 열 때 정보로 끌려가지 않는다.

**추가 정보…** 처음에는 Safari(자기소개가 있는 첫 화면)를 열게 했다. 써 보니 작은 창에서 한 단계 더 들어간다는 느낌이 없었다. macOS에서 이 버튼은 시스템 설정의 **일반 › 정보**를 연다. 그래서 시스템 설정에 **정보** 항목(`AboutPane.tsx`)을 만들고 그쪽을 열게 했다. 정보에는 작은 창보다 자세한 내용이 묶음별로 있다.

- 프로필: 이름(한글·영문), 직무, 학교, 위치
- 연락처: 이메일, GitHub
- 기술: 프론트엔드·백엔드·인터랙션 전부
- 이 사이트(MacFolio): 만든 기술, 저장소

**이메일.** `mailto:`로 기기의 메일 앱을 여는 대신, 이 사이트의 **메일 앱**에서 '새로운 메시지'를 바로 연다(`ProfileLink.tsx`). 받는 사람이 늘 사이트 주인으로 정해져 있는 쓰기 화면이라, 방문자는 사이트를 떠나지 않고 메일을 보낸다. 휴대폰에서는 아래에서 올라오는 쓰기 시트가 열린다. `href`에는 여전히 `mailto:`를 두어, 새 탭으로 열기나 주소 복사 같은 브라우저 기능은 그대로 쓴다. 처음에는 이메일을 검은 글자로 두었는데, 누를 수 있는 줄 알기 어려웠다. 그래서 GitHub처럼 파란 글자와 ↗를 붙였다.

**GitHub.** 바깥 링크라 새 탭으로 연다. `openExternal`로 열어 나간 링크로 센다([방문 수집](/memo/analytics-collect)).

**개인정보 처리 방침.** macOS의 이 창에는 저작권 줄 바로 위에 **규제 인증서** 링크가 있다. 이 사이트에서 그 자리에 맞는 문서는 개인정보 처리 방침이다(방문 분석, 방문자 쿠키, 메일을 다룬다). 같은 자리에 같은 모양의 링크를 두고, Apple 메뉴의 '개인정보 처리 방침'처럼 Finder에서 `docs/privacy.md`를 연다.

세 링크 모두 누르면 먼저 이 창을 닫는다. 이 창은 다른 창보다 위에 떠 있어서, 그대로 두면 새로 연 앱을 가린다.

## 확인

`apps/react/e2e/about-this-mac.spec.ts`에 시험 네 개를 두었다.

- **Apple 메뉴 맨 위에서 열면 만든 사람의 프로필이 보이고, 닫기·Esc로 닫는다**: 첫 메뉴 항목, 이름·영문 이름, 사양 줄 여섯 개, GitHub의 ↗와 새 탭, 열면 메뉴가 닫히고 닫기 버튼에 초점.
- **빈 곳을 잡아 옮기고, 추가 정보…는 macOS처럼 시스템 설정의 정보를 연다**: 끈 만큼 옮겨지는지, 설정이 이미 열려 있어도 정보로 가는지.
- **저작권 줄 위의 개인정보 처리 방침(macOS의 규제 인증서 자리)은 Finder에서 문서를 연다**
- **이메일을 누르면 기기의 메일 앱이 아니라 이 사이트의 메일 앱에서 새로운 메시지를 연다**: 받는 사람 줄이 `김정현 <hyeoniverse.dev@gmail.com>`인지 본다. 쓰기를 취소해 메일 앱이 열린 채로 둔 다음, 시스템 설정의 정보에서 이메일을 다시 눌러도 쓰기 화면이 뜨는지도 본다.

마지막 시험의 두 번째 절반이 이 구조의 핵심을 지킨다. 요청 저장소를 마운트할 때만 읽었다면, 이미 열린 메일 앱은 두 번째 요청을 놓친다.

## 남은 것, 배운 것

- 창 위치는 기억하지 않는다. 닫았다 열면 다시 가운데다. macOS도 그렇게 동작해서 그대로 두었다.
- 창이 화면 밖으로 끌려 나가는 것을 막지 않는다. 닫고 다시 열면 돌아오므로 아직은 문제가 되지 않았다.
- "다른 앱을 열어 달라"는 일은 앱끼리 직접 부르지 않고 작은 저장소에 적어 두는 쪽이 낫다. 받는 앱이 닫혀 있든 열려 있든 같은 코드로 받고, 보내는 쪽은 받는 앱의 속을 모른다. 이 뒤로 바탕화면 폴더 아이콘(`finderFolderRequest`)도 같은 방식으로 만들었다.

관련 글: [메뉴 막대의 메뉴들](/memo/menubar-menus), [메일 앱](/memo/contact-mail), [사이트 프로필 편집](/memo/site-profile-editing), [개인정보 보호와 보안 설정](/memo/privacy-security-settings)

#MacFolio #프론트엔드 #메뉴막대 #macOS

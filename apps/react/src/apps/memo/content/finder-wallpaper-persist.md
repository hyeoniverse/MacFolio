---
title: Finder에서 고른 배경화면이 새로고침하면 사라지던 문제와 QuickTime 열기 창
date: 2026-10-19
category: 개발 기록/MacFolio/기능 구현
summary: Finder의 '데스크탑 사진 설정'으로 선택한 배경화면이 서버 목록 검사에서 삭제된 항목으로 판정되어 새로고침마다 기본값으로 돌아가던 문제를 id 접두어 상수 하나로 수정했다. MP4도 배경화면으로 설정할 수 있고, QuickTime은 미리보기와 같은 열기 창을 쓴다.
---

## 배경

Finder에 업로드한 그림을 오른쪽 클릭하면 macOS처럼 '데스크탑 사진 설정' 메뉴가 있다. 누르면 바로 바탕화면이 바뀐다. 그런데 새로고침하면 기본 배경화면으로 돌아왔다. 재현 절차는 다음과 같다.

1. 관리자로 로그인해 Finder에 그림을 업로드한다.
2. 그림을 오른쪽 클릭 › '데스크탑 사진 설정'.
3. 바탕화면이 바뀐 것을 보고 새로고침한다.
4. 배경화면이 기본값으로 돌아가 있다.

같은 날 수정할 문제가 세 가지 더 있었다.

| 문제                              | 증상                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| MP4 배경화면                      | '데스크탑 사진 설정'이 그림에만 표시되어 MP4는 설정할 수 없음 |
| QuickTime Player를 파일 없이 실행 | macOS와 다른 단순 목록을 표시                                 |
| 관리자로 메일 앱 실행             | 환영 메일이 어느 편지함에도 없음                              |

네 가지를 한 PR([#268](https://github.com/hyeoniverse/MacFolio/pull/268))로 묶었다.

이 문제는 10월 19일 새벽 배포 사이트에서 발견했다. 전날 밤 "그림을 오른쪽 클릭해 바탕화면으로 설정" 기능([#263](https://github.com/hyeoniverse/MacFolio/pull/263))을 배포한 뒤 확인하자, MP4는 메뉴가 없어 설정할 수 없었고, 그림은 설정되지만 새로고침하면 원래 배경화면으로 돌아왔다. 같은 시각에 관리자로 메일 앱을 열었는데, 관리자에게는 보낸 편지함에 표시되어야 할 환영 메일이 없어서 함께 수정했다.

## 원인: 서버 배경화면 검사에 함께 포함됨

설정은 브라우저에 정상적으로 저장되어 있었다. 개발자 도구에서 `macfolio:settings`를 확인하면 새로고침 직후에도 `custom:finder-…` id가 들어 있었다. 설정을 기본값으로 바꾼 것은 앱 시작 시각에 실행되는 검사였다.

관리자가 시스템 설정에서 업로드한 배경화면([관리자가 추가한 배경화면](/memo/custom-wallpapers))은 id가 `custom:서버 id`다. 방문자가 이 배경화면을 선택한 뒤 관리자가 삭제할 수 있다. 그래서 `shared/settings/customWallpapers.ts`의 `checkChosenWallpapers()`는 선택한 id가 `custom:`으로 시작하면 서버 목록을 내려받아 대조하고, 없으면 기본값으로 되돌린다.

```ts
// 수정 전
function reconcile(list: CustomWallpaper[]) {
	for (const kind of ['mac', 'ios'] as const) {
		const selected = settings[FIELDS[kind].id];
		if (!isCustomWallpaperId(selected)) continue;
		const found = list.find((wallpaper) => wallpaper.id === selected);
		if (!found) chooseWallpaper(kind, DEFAULT_SETTINGS[FIELDS[kind].id]);
	}
}
```

Finder의 `setDesktopWallpaper()`도 id를 `custom:finder-<해시>`로 생성했다. 접두어가 같아 같은 검사 대상이 되었고, Finder에서 선택한 파일은 서버 배경화면 목록에 없으므로 매번 "삭제된 배경화면"으로 판정됐다. 두 기능을 다른 날 만들면서 같은 id 접두어를 사용한 것이 원인이었다.

![배경화면 id 확인 순서](./images/finder-wallpaper-persist-check.svg 'custom:finder-를 먼저 제외해 서버 목록과 대조하지 않는다')

## 선택한 방법과 제외한 방법

| 방법                                                        | 장점                        | 단점                                                                                     |
| ----------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Finder 배경화면 id를 `finder:…`로 변경                      | 검사 코드를 수정하지 않는다 | 이미 저장된 설정을 마이그레이션해야 하고, `custom:`을 검사하는 다른 코드도 수정해야 한다 |
| 검사 시 서버 배경화면 목록과 함께 파일 목록도 조회          | 삭제된 파일까지 검출한다    | 앱을 열 때마다 요청이 하나 늘고, 방문자 파일(blob:)은 서버에 없다                        |
| **접두어 `custom:finder-`를 상수로 정의하고 검사에서 제외** | 두 줄 수정, 저장된 값 유지  | Finder 파일이 삭제되어도 검사하지 않는다                                                 |

세 번째를 선택했다. Finder 파일이 삭제되는 경우는 관리자가 직접 삭제할 때뿐이라, 앱을 열 때마다 요청을 하나 더 보낼 필요는 없다고 판단했다.

## 구현

### 1. 접두어를 상수로 정의

```ts
/** Finder에서 '데스크탑 사진 설정'으로 고른 배경화면의 id 앞부분. 서버 목록에 없으니 맞춰 보지 않는다 */
export const FINDER_WALLPAPER_PREFIX = 'custom:finder-';

// reconcile 안
if (!isCustomWallpaperId(selected) || selected.startsWith(FINDER_WALLPAPER_PREFIX)) continue;

// checkChosenWallpapers: Finder 것만 골랐으면 서버 목록을 받지도 않는다
const fromServer = (id: string) => isCustomWallpaperId(id) && !id.startsWith(FINDER_WALLPAPER_PREFIX);
```

`apps/finder/setWallpaper.ts`도 문자열 리터럴 대신 이 상수로 id를 생성한다. 두 곳이 같은 상수를 참조하므로 한쪽만 바뀌는 일이 없다.

### 2. MP4도 배경화면으로

동영상 배경화면은 [MP4·GIF 배경화면](/memo/video-wallpaper)([#264](https://github.com/hyeoniverse/MacFolio/pull/264))에서 이미 구현했다. 설정의 `wallpaperVideo`에 주소가 있으면 바탕화면 위에 `<video>`를 렌더링한다. 그래서 `canSetWallpaper()`가 동영상 파일에도 `true`를 반환하게 하고, 동영상이면 `wallpaperVideo`에 주소를 저장하기만 하면 됐다.

![설정에 넣는 값](./images/finder-wallpaper-persist-fields.svg '그림이면 wallpaperVideo를 비우고, 동영상이면 같은 주소를 두 칸에 넣는다')

동영상에는 별도의 포스터 이미지가 없다. 배경 이미지 필드를 비우면 동영상이 로드되기 전에 이전 배경화면이 표시된다. 그래서 그 필드에도 같은 주소를 넣었다. CSS 배경 이미지로는 MP4가 렌더링되지 않으므로 빈 배경이 되고, 곧 동영상이 그 위를 덮는다. 대신 `WallpaperVideo.tsx`에서 동영상 자신을 [`poster`](https://developer.mozilla.org/ko/docs/Web/HTML/Element/video#poster)로 지정하지 않도록 한 줄을 추가했다.

```tsx
poster={poster && poster !== src ? poster : undefined}
```

### 3. QuickTime Player의 열기 창

파일 없이 QuickTime Player를 실행하면 "재생할 파일을 고르세요"라는 제목 아래 동영상·소리 파일 이름을 한 줄씩 나열했다. 실제 macOS에서는 미리보기와 같은 열기 창이 표시되고, 열 수 없는 파일은 비활성으로 표시된다. 미리보기에는 이미 그 열기 창(`apps/preview/OpenPanel.tsx`)이 있었다.

![QuickTime Player의 열기 창](./images/finder-wallpaper-persist-quicktime.jpg '파일 없이 실행한 QuickTime Player. 미리보기와 같은 열기 창이고 맨 위 항목이 QuickTime Player 폴더다 (API 없는 미리보기 서버라 파일이 없다)')

`OpenPanel`이 호출한 앱 정보를 `app` prop으로 받게 했다. 이름·아이콘과 "열 수 있는 파일인가"를 판단하는 함수 하나다. 기본값은 미리보기라서 미리보기 쪽 코드는 변경하지 않았다.

```ts
export interface OpenPanelApp {
	name: string;
	icon: string;
	/** 열 수 있는 파일인지 (그 밖의 파일은 흐리게, 고를 수 없다) */
	canOpen: (item: FileItem) => boolean;
}
```

![열기 창을 공유하는 구조](./images/finder-wallpaper-persist-openpanel.svg '미리보기와 QuickTime이 같은 OpenPanel에 자기 이름과 canOpen만 전달한다')

맨 위 항목은 미리보기에서는 업로드한 PDF·그림이고, QuickTime에서는 업로드한 파일 전체를 폴더를 재귀 순회하며 수집한 뒤 동영상·소리만 남긴다. 같은 파일이 두 폴더에 있으면 한 번만 넣는다. 동영상 썸네일은 Finder처럼 `#t=0.5`로 0.5초 시점의 프레임을 표시한다. 첫 프레임이 검은 화면인 영상이 많기 때문이다. QuickTime 쪽에서는 자체 목록 코드와 CSS 60줄을 삭제했다.

### 4. 관리자에게 환영 메일은 보낸 편지함에

메일 앱의 받은 편지함은 방문자에게는 환영 메일을, 관리자에게는 방문자가 보낸 실제 메일을 표시한다. 그래서 관리자로 로그인하면 환영 메일이 어디에도 없었다. 환영 메일은 사이트 주인이 방문자에게 보낸 메일이므로 관리자에게는 보낸 편지함 맨 아래(가장 오래된 메일)에 배치했다. 관리자 본인이 보낸 메일이라 답장 입력 칸은 표시하지 않는다.

```ts
const outbox = admin ? [...(sent ?? []), ...welcome] : (sent ?? []);
```

## 확인

- 단위 시험 `shared/settings/customWallpapers.test.ts`를 새로 작성했다. "Finder에서 고른 배경화면은 서버 목록에 없어도 그대로 둔다"와 "서버에서 지워진 배경화면은 기본값으로 돌린다" 두 가지다. 빈 서버 목록을 반환하는 가짜 `fetch`로 실행한다.
- E2E `e2e/finder-upload.spec.ts`에 "QuickTime Player를 파일 없이 열면 열기 창이 뜨고, 동영상·소리가 아닌 파일은 고를 수 없다"를 추가했다. PDF와 MP4를 업로드하고 열기 창에서 PDF는 `aria-disabled`, MP4는 선택해 열리는지 확인한다. 같은 파일의 방문자 시험에는 동영상을 '데스크탑 사진 설정'하면 설정의 `wallpaperVideo`가 `blob:` 주소가 되는지를 추가했다. 시험은 움직임 줄이기 설정으로 실행되어 동영상을 렌더링하지 않으므로 설정 값을 확인한다.
- E2E `e2e/mail.spec.ts`에 "관리자: 환영 메일은 자기가 보낸 메일이라 보낸 편지함에 보인다"를 추가했다.
- 변경 파일 12개, +209/−138이다.

## 남은 것·배운 것

- Finder에서 선택한 파일을 나중에 삭제하면 설정에는 주소가 남는다. 삭제 시각에 그 파일을 참조하는 설정을 함께 비우는 것이 바람직하다. 다만 다른 방문자의 브라우저 설정은 서버가 수정할 수 없으므로, 결국 그림을 불러오지 못하면 기본값으로 되돌리는 처리가 필요하다.
- 방문자가 끌어다 놓은 파일은 `blob:` 주소라 새로고침하면 사라진다. 의도한 동작이다. 방문자 파일은 서버에 업로드하지 않는다.
- 문자열 접두어로 종류를 구분하는 id는 다른 기능이 같은 접두어를 사용하는 시점부터 의미가 섞인다. 접두어를 상수로 정의하고 한 곳에서 참조하면 중복 사용을 검색 한 번으로 찾을 수 있다.

## 관련 글

- [관리자가 배경화면을 더하기 - 브라우저에서 줄여 올리고 모두에게](/memo/custom-wallpapers)
- [움직이는 배경화면 - MP4와 GIF를 바탕화면에 깔기](/memo/video-wallpaper)
- [Finder의 이력서 PDF와 그림을 미리보기 앱으로 열기](/memo/finder-files)
- [메일 앱의 보낸 편지함과 관리자 받은 편지함](/memo/mail-mailboxes)
- [Finder 폴더를 진짜 데스크탑처럼: 새 폴더, 이름 변경, 끌어서 옮기기](/memo/finder-filesystem): '데스크탑 사진 설정' 메뉴를 추가한 작업

#MacFolio #프론트엔드 #Finder #배경화면 #QuickTime

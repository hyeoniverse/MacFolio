---
title: Finder에서 고른 배경화면이 새로고침하면 사라지던 문제와 QuickTime 열기 창
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: Finder의 '데스크탑 사진 설정'으로 고른 배경화면이 서버 목록 확인에 걸려 새로고침마다 기본값으로 돌아가던 문제를 접두어 하나로 고쳤다. MP4도 바탕화면이 되고, QuickTime은 미리보기와 같은 열기 창을 쓴다.
---

## 배경

Finder에 올린 그림을 오른쪽 클릭하면 macOS처럼 '데스크탑 사진 설정' 메뉴가 있다. 누르면 바로 바탕화면이 바뀐다. 그런데 새로고침하면 기본 배경화면으로 돌아왔다. 재현은 간단했다.

1. 관리자로 로그인해 Finder에 그림을 올린다.
2. 그림을 오른쪽 클릭 › '데스크탑 사진 설정'.
3. 바탕화면이 바뀐 것을 보고 새로고침한다.
4. 배경화면이 기본값으로 돌아가 있다.

같은 날 손볼 것이 셋 더 있었다. '데스크탑 사진 설정'은 그림에만 보여서 MP4를 깔 수 없었고, 파일 없이 연 QuickTime Player는 macOS와 전혀 다른 목록을 띄웠고, 관리자로 메일 앱을 열면 환영 메일이 보이지 않았다. 넷을 한 PR([#268](https://github.com/hyeoniverse/MacFolio/pull/268))로 묶었다.

이 문제는 10월 19일 새벽 배포 사이트에서 직접 겪었다. 전날 밤 "그림은 오른쪽 클릭으로 바로 바탕화면 설정"을 넣었는데, 배포한 뒤 해 보니 MP4는 메뉴가 없어 깔 수 없었고, 그림은 깔리지만 새로고침하면 원래 배경화면으로 돌아왔다. 같은 시각에 관리자로 메일 앱을 열어 보니, 문의 폼으로 보낸 메일이 관리자에게는 보낸 편지함에 보여야 하는데 없어서 그것도 함께 고쳤다.

## 원인: 서버 배경화면 확인에 같이 걸렸다

설정은 브라우저에 잘 남아 있었다. 개발자 도구에서 `macfolio:settings`를 열어 보면 새로고침 직후에도 `custom:finder-…` id가 들어 있었다. 지운 쪽은 앱을 열 때 도는 확인이었다.

관리자가 시스템 설정에서 올린 배경화면([더한 배경화면](/memo/custom-wallpapers))은 id가 `custom:서버 id`다. 다른 방문자가 이 배경화면을 골라 둔 뒤 관리자가 지울 수 있다. 그래서 `shared/settings/customWallpapers.ts`의 `checkChosenWallpapers()`는 고른 id가 `custom:`으로 시작하면 서버 목록을 받아 맞춰 보고, 없으면 기본값으로 돌린다.

```ts
// 고치기 전
function reconcile(list: CustomWallpaper[]) {
	for (const kind of ['mac', 'ios'] as const) {
		const selected = settings[FIELDS[kind].id];
		if (!isCustomWallpaperId(selected)) continue;
		const found = list.find((wallpaper) => wallpaper.id === selected);
		if (!found) chooseWallpaper(kind, DEFAULT_SETTINGS[FIELDS[kind].id]);
	}
}
```

Finder의 `setDesktopWallpaper()`도 id를 `custom:finder-<해시>`로 지었다. 같은 접두어라 같은 확인을 탔고, Finder에서 고른 파일은 서버 배경화면 목록에 있을 리가 없으니 매번 "지워진 배경화면"으로 판정됐다. 두 기능을 다른 날 만들면서 id 규칙을 겹쳐 쓴 것이 원인이었다.

![배경화면 id 확인 순서](./images/finder-wallpaper-persist-check.svg 'custom:finder-를 먼저 걸러 서버 목록과 맞춰 보지 않는다')

## 고른 방법과 버린 방법

| 방법                                                          | 좋은 점                      | 걸리는 점                                                                     |
| ------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Finder 배경화면 id를 `finder:…`로 바꾸기                      | 확인 코드를 안 건드린다      | 이미 저장된 설정을 옮겨야 하고, `custom:`을 보는 다른 코드도 찾아 고쳐야 한다 |
| 확인할 때 서버 목록 대신 파일 목록도 받아 보기                | 지워진 파일까지 잡는다       | 앱을 열 때마다 요청이 하나 더, 방문자 파일(blob:)은 서버에 없다               |
| **접두어 `custom:finder-`를 이름으로 두고 확인에서 건너뛰기** | 두 줄 고침, 저장된 값 그대로 | Finder 파일이 지워져도 확인하지 않는다                                        |

세 번째를 골랐다. Finder 파일이 지워지는 경우는 관리자가 직접 지울 때뿐이라, 앱을 열 때마다 요청을 하나 더 보낼 만큼의 일이 아니었다.

## 구현

### 1. 접두어를 이름으로

```ts
/** Finder에서 '데스크탑 사진 설정'으로 고른 배경화면의 id 앞부분. 서버 목록에 없으니 맞춰 보지 않는다 */
export const FINDER_WALLPAPER_PREFIX = 'custom:finder-';

// reconcile 안
if (!isCustomWallpaperId(selected) || selected.startsWith(FINDER_WALLPAPER_PREFIX)) continue;

// checkChosenWallpapers: Finder 것만 골랐으면 서버 목록을 받지도 않는다
const fromServer = (id: string) => isCustomWallpaperId(id) && !id.startsWith(FINDER_WALLPAPER_PREFIX);
```

`apps/finder/setWallpaper.ts`도 문자열을 직접 쓰지 않고 이 상수로 id를 짓는다. 두 곳이 같은 이름을 보니 다음에 한쪽만 바뀌는 일이 없다.

### 2. MP4도 바탕화면으로

동영상 배경화면은 [MP4·GIF 배경화면](/memo/video-wallpaper)에서 이미 만들어 두었다. 설정의 `wallpaperVideo`에 주소가 있으면 바탕화면 위에 `<video>`를 깐다. 그래서 `canSetWallpaper()`가 동영상 파일에도 참을 돌려주고, 동영상이면 `wallpaperVideo`를 채우기만 하면 됐다.

![설정에 넣는 값](./images/finder-wallpaper-persist-fields.svg '그림이면 wallpaperVideo를 비우고, 동영상이면 같은 주소를 두 칸에 넣는다')

동영상은 따로 만든 포스터 그림이 없다. 배경 이미지 칸을 비우면 동영상이 뜨기 전에 이전 배경화면이 비친다. 그래서 그 칸에도 같은 주소를 넣었다. CSS 배경으로는 MP4가 그려지지 않으니 그냥 빈 칸이 되고 곧 동영상이 덮는다. 대신 `WallpaperVideo.tsx`에서 자기 자신을 포스터로 걸지 않게 한 줄을 더했다.

```tsx
poster={poster && poster !== src ? poster : undefined}
```

### 3. QuickTime Player의 열기 창

파일 없이 QuickTime Player를 열면 "재생할 파일을 고르세요"라는 제목 아래 동영상·소리 파일 이름을 한 줄씩 늘어놓았다. 실제 macOS에서는 미리보기와 똑같은 열기 창이 뜨고, 열 수 없는 파일은 흐리게 보인다. 미리보기에는 이미 그 열기 창(`apps/preview/OpenPanel.tsx`)이 있었다.

![QuickTime Player의 열기 창](./images/finder-wallpaper-persist-quicktime.jpg '파일 없이 연 QuickTime Player. 미리보기와 같은 열기 창이고 맨 위 자리가 QuickTime Player 폴더다 (API 없는 미리보기 서버라 파일이 없다)')

`OpenPanel`이 어느 앱이 띄웠는지를 `app` 속성으로 받게 했다. 이름·아이콘과 "열 수 있는 파일인가"를 묻는 함수 하나다. 기본값은 미리보기라서 미리보기 쪽 코드는 그대로다.

```ts
export interface OpenPanelApp {
	name: string;
	icon: string;
	/** 열 수 있는 파일인지 (그 밖의 파일은 흐리게, 고를 수 없다) */
	canOpen: (item: FileItem) => boolean;
}
```

![열기 창을 나눠 쓰는 구조](./images/finder-wallpaper-persist-openpanel.svg '미리보기와 QuickTime이 같은 OpenPanel에 자기 이름과 canOpen만 넘긴다')

맨 위 자리는 미리보기에서는 올린 PDF·그림이고, QuickTime에서는 올린 파일 전체를 폴더를 따라 내려가며 모은 뒤 동영상·소리만 남긴다. 같은 파일이 두 폴더에 걸려 있으면 한 번만 넣는다. 동영상 썸네일은 Finder처럼 `#t=0.5`로 0.5초 뒤 장면을 보여 준다. 처음 프레임이 검은 영상이 많아서다. QuickTime 쪽에서는 자기 목록 코드와 CSS 60줄이 빠졌다.

### 4. 관리자에게 환영 메일은 보낸 편지함에

메일 앱의 받은 편지함은 방문자에게는 환영 메일을, 관리자에게는 방문자가 보낸 실제 메일을 보여 준다. 그래서 관리자로 로그인하면 환영 메일이 어디에도 없었다. 환영 메일은 사이트 주인이 방문자에게 보낸 메일이니 관리자에게는 보낸 편지함 맨 아래(가장 오래된 메일)에 두었다. 자기가 보낸 메일이라 답장 칸은 붙지 않는다.

```ts
const outbox = admin ? [...(sent ?? []), ...welcome] : (sent ?? []);
```

## 확인

- 단위 시험 `shared/settings/customWallpapers.test.ts`를 새로 만들었다. "Finder에서 고른 배경화면은 서버 목록에 없어도 그대로 둔다"와 "서버에서 지워진 배경화면은 기본값으로 돌린다" 두 가지다. 빈 서버 목록을 넘기는 가짜 `fetch`로 돌린다.
- E2E `e2e/finder-upload.spec.ts`에 "QuickTime Player를 파일 없이 열면 열기 창이 뜨고, 동영상·소리가 아닌 파일은 고를 수 없다"를 더했다. PDF와 MP4를 올리고 열기 창에서 PDF는 `aria-disabled`, MP4는 골라 열리는지 본다. 같은 파일의 방문자 시험에는 동영상을 '데스크탑 사진 설정'하면 설정의 `wallpaperVideo`가 `blob:` 주소가 되는지를 덧붙였다. 시험은 움직임 줄이기로 돌아서 동영상을 그리지 않으니 설정 값을 본다.
- E2E `e2e/mail.spec.ts`에 "관리자: 환영 메일은 자기가 보낸 메일이라 보낸 편지함에 보인다"를 더했다.
- 바뀐 파일은 12개, 209줄 더하고 138줄 지웠다.

## 남은 것·배운 것

- Finder에서 고른 파일을 나중에 지우면 설정에는 주소가 남는다. 지울 때 그 파일을 고른 설정을 함께 비우는 편이 맞다. 다만 다른 방문자의 브라우저 설정은 서버가 비울 수 없어서, 결국 그림을 못 불러오면 기본값으로 돌리는 처리가 필요하다.
- 방문자가 끌어다 놓은 파일은 `blob:` 주소라 새로고침하면 사라진다. 이건 의도대로다. 방문자 파일은 서버에 올리지 않는다.
- 문자열 접두어로 종류를 가르는 id는 다른 기능이 같은 접두어를 쓰는 순간 뜻이 섞인다. 접두어를 상수로 두고 한 곳에서 불러 쓰면 겹친 것을 검색 한 번으로 찾을 수 있다.

## 관련 글

- [관리자가 더하는 배경화면](/memo/custom-wallpapers)
- [MP4·움직이는 GIF 배경화면](/memo/video-wallpaper)
- [Finder 문서 파일과 미리보기 앱](/memo/finder-files)
- [메일 앱의 받은 편지함과 보낸 편지함](/memo/mail-mailboxes)

#MacFolio #프론트엔드 #Finder #배경화면 #QuickTime

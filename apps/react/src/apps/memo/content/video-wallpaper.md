---
title: 움직이는 배경화면 - MP4와 GIF를 바탕화면에 적용하기
date: 2026-10-20
category: 개발 기록/MacFolio/UI·인터랙션
summary: 관리자가 MP4나 움직이는 GIF를 배경화면으로 올릴 수 있게 했다. 포스터는 서버에 ffmpeg을 설치하지 않고 브라우저가 0.5초 장면을 캔버스에 렌더링해 만들고, 서버는 MP4를 파일 앞부분으로 판별하고 Range 요청에 206으로 응답한다.
---

관리자가 추가하는 배경화면은 지금까지 사진만 지원했다. 사진을 고르면 브라우저가 긴 변 2,560px로 축소해 JPEG로 변환한 뒤 업로드했다. 그래서 움직이는 GIF를 골라도 첫 장면 한 장만 남았다. macOS의 동적 배경화면처럼 움직이는 화면을 바탕화면에 적용할 수 있도록, MP4 동영상과 움직이는 GIF를 배경화면으로 쓸 수 있게 했다([#264](https://github.com/hyeoniverse/MacFolio/pull/264)).

| 항목              | 변경 전                        | 변경 후                                       |
| ----------------- | ------------------------------ | --------------------------------------------- |
| 고를 수 있는 형식 | PNG·JPEG·GIF·WebP              | 여기에 MP4 추가                               |
| GIF 업로드        | 2,560px JPEG로 변환(첫 장면만) | 원본 그대로                                   |
| 썸네일            | 640px JPEG                     | 사진·GIF 640px, MP4 포스터 1,280px            |
| 업로드 크기 한도  | 10MB                           | 사진 10MB, 동영상 30MB                        |
| `/files/:id`      | 항상 200 전체 응답             | `Range` 요청이면 206 부분 응답, 범위 밖은 416 |

## 무엇이 바뀌었나

- 관리자용 항목의 이름이 '사진 추가…'에서 '사진·동영상 추가…'로 바뀌었다. 파일 선택 창에서 MP4도 고를 수 있다.
- GIF는 축소하지 않고 원본 그대로 업로드한다. 캔버스로 축소하면 한 장면만 렌더링되기 때문이다. 썸네일만 첫 장면으로 만든다.
- MP4도 원본 그대로 업로드한다. 썸네일인 포스터[^poster]는 브라우저가 동영상의 0.5초 지점 장면을 캔버스에 렌더링해 JPEG로 만든다.
- 배경화면 선택 목록의 동영상 썸네일 가운데에는 재생 표시(▶)가 있다. 스크린 리더는 이름 뒤에 '(동영상)'을 읽는다.
- 방문자는 다른 배경화면과 같은 방법으로 고른다. 데스크톱과 휴대폰 홈 화면을 모두 지원한다.

## 화면에 배치하는 방법

배경화면은 원래 CSS 변수(`--wallpaper`) 하나로 렌더링한다. 동영상은 CSS `background-image`로 재생할 수 없어서, 고른 배경화면이 동영상이면 [`<video>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) 요소를 하나 더 배치한다.

- 배경 변수에는 포스터 이미지를 넣는다. 동영상을 불러오는 동안이나 재생에 실패한 경우에는 이 정지 장면이 보인다.
- `<video>`는 `muted`, `loop`, `autoplay`, `playsinline` 속성을 갖고 `object-fit: cover`로 화면 전체를 채운다. 브라우저는 [소리가 꺼진 동영상만 자동 재생을 허용](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)하므로 소리는 항상 끈다.
- 데스크톱에서는 `position: fixed`로 화면에 고정하고 창과 아이콘 아래(`z-index: -1`)에 배치한다. 휴대폰에서는 홈 화면 요소 안에 배치해서, 앱을 열면 홈 화면과 함께 축소 애니메이션을 따라간다.
- 시스템의 '동작 줄이기'([`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))를 켜면 `<video>`를 렌더링하지 않는다. 포스터만 남는다.
- 탭이 가려지면([`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)) 일시 정지하고, 다시 보이면 재생을 이어 간다. 보이지 않는 동영상을 계속 디코딩하면 CPU와 배터리만 소모한다.

설정에는 `wallpaperVideo`(휴대폰은 `mobileWallpaperVideo`) 값이 새로 생겼다. 이 값이 브라우저에 저장되어 있어서, 다음에 사이트를 열면 서버에서 배경화면 목록을 조회하기 전에 동영상을 바로 표시한다. 서버에서 그 배경화면이 삭제되었으면 기존과 같이 기본 배경화면으로 되돌린다.

화면 쪽 코드는 `desktop/WallpaperVideo.tsx`(59줄) 하나다. 렌더링 조건과 탭 가림 처리가 핵심이다.

```tsx
const show = src !== null && !reducedMotion && failed !== src;

useEffect(() => {
	const element = video.current;
	if (!show || !element) return;
	// React의 muted 속성은 HTML 속성으로 쓰이지 않아, 자동 재생 규칙에 맞게 직접 켠다
	element.muted = true;
	const sync = () => {
		if (document.hidden) element.pause();
		else void element.play().catch(() => {});
	};
	sync();
	document.addEventListener('visibilitychange', sync);
	return () => document.removeEventListener('visibilitychange', sync);
}, [show, src]);
```

`element.muted = true`를 직접 설정한 이유가 있다. JSX에 `muted`를 써도 React는 이것을 HTML 속성으로 출력하지 않고 DOM 속성으로만 다룬다[^muted]. 브라우저의 자동 재생 규칙은 첫 재생 시각에 소리가 꺼져 있는지를 확인하므로, 효과(`useEffect`) 안에서 한 번 더 명시적으로 끈다. 재생이 실패하면(`onError`) 그 주소를 `failed`에 기록해 다시 렌더링하지 않는다. 그러면 포스터만 남는다.

## 포스터를 브라우저에서 만드는 이유

서버(NestJS)에는 동영상을 디코딩하는 도구([ffmpeg](https://ffmpeg.org/) 등)가 없다. 포스터 하나를 위해 서버 Docker 이미지에 ffmpeg을 설치하기보다, 이미 동영상을 디코딩할 수 있는 브라우저에서 만들기로 했다.

| 방법                                | 장점                                 | 단점                                                   |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| 서버에서 ffmpeg으로 포스터 만들기   | 어떤 코덱이든 같은 결과              | 서버 이미지가 커지고, 업로드마다 프로세스를 실행한다   |
| 포스터 없이 동영상만                | 할 일이 없다                         | 불러오는 동안 빈 화면, 움직임 줄이기에서는 배경이 없다 |
| 관리자가 포스터 그림을 따로 업로드  | 서버·브라우저 모두 단순              | 업로드마다 파일을 두 번 선택한다                       |
| 브라우저가 캔버스에 렌더링해 만들기 | 의존성 없음, 업로드 시각에 자동 생성 | 브라우저가 디코딩하지 못하는 코덱은 대체 그림을 쓴다   |

관리자는 한 명이고, 그 관리자가 업로드하는 동영상은 업로드에 쓰는 브라우저가 이미 재생할 수 있는 형식이다. 따라서 브라우저에서 만드는 방식의 단점이 실제로 드러날 일이 거의 없다. 순서는 다음과 같다(`shared/settings/customWallpapers.ts`).

1. 고른 파일을 [`URL.createObjectURL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)로 `<video>`에 연결한다.
2. 첫 프레임을 수신하면(`loadeddata`) 재생 위치를 0.5초(`POSTER_AT`)로 이동한다. 첫 프레임이 검은 화면인 영상이 많기 때문이다.
3. 이동이 끝나면(`seeked`) 그 장면을 캔버스에 렌더링해 긴 변 1,280px(`POSTER_MAX`) JPEG로 만든다.

동작 줄이기를 켠 방문자에게는 이 포스터가 배경화면 전체이므로 사진 썸네일(640px, `THUMB_MAX`)보다 크게 만든다. 브라우저가 그 코덱을 디코딩하지 못하면 640×400 크기의 어두운 그라데이션 그림을 대신 쓰고, 재생 표시로 동영상임을 알린다.

![포스터를 만들어 올리는 순서와, 화면에서 포스터 위에 video를 까는 층](./images/video-wallpaper-layers.svg '동영상 배경화면을 업로드하고 화면에 배치하는 방법')

## 서버에서 검증하는 것

파일 형식은 파일 이름이나 브라우저가 보낸 `Content-Type`을 신뢰하지 않고 파일 앞부분의 바이트(매직 넘버)로 판별한다. 이미지(PNG·JPEG·GIF·WebP)는 원래 이 방식으로 판별했고, 여기에 MP4를 추가했다.

- MP4는 4~8바이트가 `ftyp`[^ftyp]이고, 그 뒤 4글자(주 브랜드)가 `isom`·`mp42`·`avc1` 같은 MP4 값이어야 한다.
- QuickTime(`qt  `)은 거절한다. 브라우저에 따라 재생 지원 여부가 다르기 때문이다.
- 썸네일은 늘 이미지여야 한다.

```ts
// apps/api/src/files/rules.ts
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4']);
```

크기 한도는 사진 10MB, 동영상 30MB다. 업로드 파일 테이블(`Upload`)의 DB 제약(CHECK)이 10MB였기 때문에, 새 마이그레이션(`20261020100000_wallpaper_video`)을 만들어 30MB(31,457,280바이트)로 늘렸다.

```sql
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_required_fields";
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 200
  AND length("type") > 0
  AND "size" BETWEEN 1 AND 31457280
  AND octet_length("data") = "size"
);
```

이미 배포한 마이그레이션은 수정하지 않는다. 일반 업로드의 10MB 한도는 API 검증이 그대로 적용하고, 30MB까지는 배경화면 동영상만 허용한다.

파일을 전송하는 `/files/:id`는 이제 [`Range` 요청](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)을 처리한다. `<video>`는 파일을 구간별로 나눠 요청하는데, Safari는 서버가 [`206 Partial Content`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206)로 응답하지 않으면 동영상을 재생하지 않는다. 동영상도 이미지처럼 `Content-Disposition: inline`으로 전송한다.

`parseRange`(`apps/api/src/files/rules.ts`)는 `Range` 머리말의 `bytes=시작-끝` 한 구간만 해석한다. 단위 시험의 입력과 결과는 다음과 같다(파일 크기 100바이트).

| `Range` 머리말            | 결과                            | 응답                                                                |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| 없음                      | 전체                            | 200                                                                 |
| `bytes=0-`                | 0~99                            | 206                                                                 |
| `bytes=90-500`            | 90~99(끝을 파일 크기로 자름)    | 206                                                                 |
| `bytes=-10`               | 끝에서 10바이트, 90~99          | 206                                                                 |
| `bytes=0-1,5-6`           | 여러 구간은 해석하지 않음, 전체 | 200                                                                 |
| `bytes=100-`, `bytes=5-2` | 범위 밖                         | [416](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416) |

여러 구간 요청은 `<video>`가 보내지 않으므로 전체 응답으로 처리한다.

![video가 Range 요청을 보내고 서버가 206·200·416으로 답하는 흐름](./images/video-wallpaper-range.svg '/files/:id의 Range 처리')

사이트의 콘텐츠 보안 정책([CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP))은 `apps/react/worker/securityHeaders.ts`의 `media-src`에 이미 API 주소가 들어 있어 수정할 필요가 없었다.

## 확인

- 서버 단위 시험: MP4 판별(브랜드, 상자 크기, QuickTime 거절), Range 머리말 해석
- 서버 e2e 시험(실제 PostgreSQL): MP4 올리기, `video: true`, 206 응답, 416, 크기 한도(이미지 10MB·동영상 30MB)
- 화면 단위 시험: 설정에서 동영상 주소를 읽고, 안전하지 않은 주소는 무시하기
- Playwright: 아래 5개 시험

시험용 Chromium은 H.264를 디코딩하지 못한다. 그래서 시험에서는 브라우저의 [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)로 색이 바뀌는 캔버스를 1초 녹화해 VP9 코덱을 담은 MP4를 생성했다. 시험 파일을 저장소에 커밋하지 않고 시험 안에서 생성하므로, 지원 코덱이 다른 브라우저에서도 그 브라우저가 인코딩할 수 있는 형식으로 시험한다.

<details>
<summary>Playwright 시험 이름 (apps/react/e2e/wallpaper-video.spec.ts, 197줄)</summary>

- 관리자가 MP4를 올리면 원본 그대로 보내고, 포스터를 만들어 썸네일로 쓰며 바로 배경에서 튼다
- 움직이는 GIF는 줄이지 않고 원본 그대로 올린다 (줄이면 첫 장면만 남는다)
- 방문자도 고를 수 있고, 탭이 가려지면 멈췄다가 다시 보이면 이어서 튼다
- 움직임 줄이기를 켜면 동영상 대신 멈춘 포스터만 보인다
- 휴대폰 홈 화면에서도 동영상 배경화면을 아이콘 아래에 깐다

</details>

전체 변경은 28파일, 861줄 추가와 82줄 삭제였다. 가장 많이 바뀐 파일은 업로드를 담당하는 `shared/settings/customWallpapers.ts`(174줄 변경)다.

## 남은 과제와 정리

- 동영상은 축소하지 않고 원본을 업로드한다. 30MB 한도 안의 파일을 그대로 전송하므로, 휴대폰 데이터로 처음 열면 전송량이 크다. 해상도별 변환본을 만드는 일은 서버에 동영상 처리 도구를 도입하는 시각에 다시 검토한다.
- QuickTime(`.mov`)은 거절한다. iPhone으로 촬영한 영상은 MP4로 내보낸 뒤 업로드해야 한다.
- 포스터 생성처럼 브라우저가 이미 지원하는 기능(동영상 디코딩, 캔버스, JPEG 인코딩)이 있으면, 서버에 의존성을 추가하기 전에 브라우저에서 처리할 수 있는지 먼저 검토한다.
- 이미 배포한 마이그레이션은 수정하지 않고 새 마이그레이션으로 제약을 변경한다. 운영 DB의 `_prisma_migrations` 적용 기록과 마이그레이션 파일이 어긋나지 않게 하기 위해서다([Prisma 문서](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)).

## 관련 글

- 관리자가 배경화면을 추가하는 기능: [관리자가 배경화면을 더하기 - 브라우저에서 줄여 올리고 모두에게](/memo/custom-wallpapers)
- 고른 배경화면을 새로고침 뒤에도 유지하는 일: [Finder에서 고른 배경화면이 새로고침하면 사라지던 문제와 QuickTime 열기 창](/memo/finder-wallpaper-persist)
- 업로드한 사진의 EXIF 삭제: [올린 사진의 EXIF를 지우되 방향은 남기기](/memo/upload-strip-exif)
- 바탕화면 `z-index` 계층 정리: [z-index 숫자에 이름 붙이기 — 화면 전체의 겹침 순서를 한 표로](/memo/z-index-layers)
- PR: [#264](https://github.com/hyeoniverse/MacFolio/pull/264)

[^poster]: 동영상을 불러오는 동안이나 재생할 수 없는 경우에 대신 보여 주는 정지 이미지. `<video>`의 `poster` 속성과 같은 역할이다.

[^muted]: React가 `muted`를 HTML 속성으로 출력하지 않는 문제는 [facebook/react#10389](https://github.com/facebook/react/issues/10389)에 정리되어 있다.

[^ftyp]: MP4(ISO Base Media File Format) 파일의 첫 상자(box). 파일 형식을 나타내는 주 브랜드와 호환 브랜드 목록을 담는다.

#MacFolio #프론트엔드 #배경화면 #동영상 #시스템설정

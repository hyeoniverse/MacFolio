---
title: video 요소와 canvas로 만든 포스터로 동영상 배경화면 적용하기
date: 2026-10-20
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 배경화면
seriesOrder: 3
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

## 배경: 동영상 배경화면에 필요한 네 가지

사진 배경화면은 CSS의 `background-image` 한 줄로 렌더링할 수 있다. 동영상은 CSS 배경으로 재생할 수 없으므로, 브라우저의 동영상 요소와 서버의 파일 전송 방식을 함께 바꿔야 했다. 이 글에 나오는 개념은 다음 네 가지다.

| 개념            | 뜻                                                                                                         | 이 글에서 쓰는 곳      |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `<video>` 요소  | 브라우저가 동영상 파일을 내려받아 디코딩(압축된 데이터를 화면 픽셀로 복원)하고 재생하는 HTML 요소          | 바탕화면 뒤에 배치     |
| 자동 재생 정책  | 사용자가 누르지 않아도 재생을 시작해도 되는지 브라우저가 판단하는 규칙. 소리가 꺼진 동영상은 대부분 허용   | `muted` 속성           |
| 컨테이너와 코덱 | MP4는 영상·음성 데이터를 담는 **컨테이너**(파일 형식)이고, H.264·VP9 같은 **코덱**은 그 안의 압축 방식이다 | 서버 판별, 시험용 파일 |
| HTTP Range 요청 | 파일 전체가 아니라 바이트 구간 일부만 요청하는 HTTP 기능. 서버는 `206 Partial Content`로 그 구간만 보낸다  | `/files/:id`           |

예를 들어 "VP9 코덱을 담은 MP4"는 파일 확장자와 앞부분 구조는 MP4이고, 안의 영상 데이터는 VP9 방식으로 압축된 파일이다. 브라우저가 이 파일을 재생하려면 MP4 구조를 해석할 수 있어야 하고, VP9 디코더도 있어야 한다.

## 무엇이 바뀌었나

- 관리자용 항목의 이름이 '사진 추가…'에서 '사진·동영상 추가…'로 바뀌었다. 파일 선택 창에서 MP4도 고를 수 있다.
- GIF는 축소하지 않고 원본 그대로 업로드한다. 캔버스로 축소하면 한 장면만 렌더링되기 때문이다. 썸네일만 첫 장면으로 만든다.
- MP4도 원본 그대로 업로드한다. 썸네일인 포스터[^poster]는 브라우저가 동영상의 0.5초 지점 장면을 캔버스에 렌더링해 JPEG로 만든다.
- 배경화면 선택 목록의 동영상 썸네일 가운데에는 재생 표시(▶)가 있다. 스크린 리더는 이름 뒤에 '(동영상)'을 읽는다.
- 방문자는 다른 배경화면과 같은 방법으로 고른다. 데스크톱과 휴대폰 홈 화면을 모두 지원한다.

### GIF를 원본 그대로 올리는 이유

GIF는 장면(프레임) 여러 개와 장면별 표시 시간을 한 파일에 담는 이미지 형식이다. 기존 업로드는 [`createImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)으로 파일을 읽어 캔버스에 축소해 그렸는데, [HTML 표준](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-createimagebitmap)은 움직이는 이미지에서 기본 장면(없으면 첫 장면) 하나만 가져오도록 정한다. 캔버스는 픽셀 한 장만 보관하므로, 10장면짜리 GIF를 축소하면 1장면짜리 JPEG가 된다.

![움직이는 GIF를 캔버스로 축소하면 한 장면만 남고, 변경 후에는 원본을 올리고 썸네일만 캔버스로 만드는 구조](./images/video-wallpaper-gif-frames.svg '변경 전에는 첫 장면만 JPEG로 남았고, 변경 후에는 원본 GIF를 업로드한다')

## 화면에 배치하는 방법

배경화면은 원래 CSS 변수(`--wallpaper`) 하나로 렌더링한다. 동영상은 CSS `background-image`로 재생할 수 없어서, 고른 배경화면이 동영상이면 [`<video>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) 요소를 하나 더 배치한다.

| 속성·스타일                                | 역할                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `--wallpaper` = 포스터 이미지              | 동영상을 불러오는 동안이나 재생에 실패한 경우 정지 장면을 표시한다     |
| `muted`                                    | 소리를 끈다. 자동 재생 조건이다                                        |
| `loop`, `autoplay`                         | 끝나면 처음부터 반복하고, 불러오는 즉시 재생한다                       |
| `playsinline`                              | iPhone Safari에서 전체 화면으로 전환하지 않고 그 자리에서 재생한다     |
| `object-fit: cover`                        | 화면 비율과 영상 비율이 달라도 빈 곳 없이 채운다(넘치는 부분은 잘린다) |
| 데스크톱: `position: fixed`, `z-index: -1` | 화면에 고정하고 창과 아이콘 아래에 배치한다                            |
| 휴대폰: 홈 화면 요소 안에 배치             | 앱을 열면 홈 화면과 함께 축소 애니메이션을 따라간다                    |

브라우저는 [소리가 꺼진 동영상만 자동 재생을 허용](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)하므로 소리는 항상 끈다. 예를 들어 [Chrome의 자동 재생 정책](https://developer.chrome.com/blog/autoplay)에서는 `muted` 없이 `autoplay`만 지정한 동영상이, 사용자가 그 사이트를 클릭하거나 탭하기 전까지 대개 재생을 시작하지 않는다. 배경화면은 사이트를 여는 즉시 움직여야 하므로 이 조건을 피할 수 없다.

두 가지 조건에서는 재생하지 않는다.

- 시스템의 '동작 줄이기'([`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))를 켜면 `<video>`를 렌더링하지 않는다. 포스터만 남는다. 이 설정은 macOS의 "손쉬운 사용 → 디스플레이 → 동작 줄이기"처럼 화면 움직임을 줄이고 싶은 사용자가 운영체제에서 켜는 값이다.
- 탭이 가려지면([`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)) 일시 정지하고, 다시 보이면 재생을 이어 간다. ==보이지 않는 동영상을 계속 디코딩하면 CPU와 배터리만 소모==한다.

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

`show`는 세 조건을 모두 만족해야 `true`다. 동영상 주소가 있고(`src !== null`), 동작 줄이기가 꺼져 있고, 이 주소의 재생이 실패한 기록이 없어야 한다.

> [!WARNING] JSX의 `muted`만으로는 부족하다
> `element.muted = true`를 직접 설정한 이유가 있다. JSX에 `muted`를 써도 React는 이것을 HTML 속성으로 출력하지 않고 DOM 속성으로만 다룬다[^muted]. 브라우저의 자동 재생 규칙은 첫 재생 시각에 소리가 꺼져 있는지를 확인하므로, 효과(`useEffect`) 안에서 한 번 더 명시적으로 끈다. 재생이 실패하면(`onError`) 그 주소를 `failed`에 기록해 다시 렌더링하지 않는다. 그러면 포스터만 남는다.

## 포스터를 브라우저에서 만드는 이유

서버(NestJS)에는 동영상을 디코딩하는 도구([ffmpeg](https://ffmpeg.org/) 등)가 없다. 포스터 하나를 위해 서버 Docker 이미지에 ffmpeg을 설치하기보다, 이미 동영상을 디코딩할 수 있는 브라우저에서 만들기로 했다.

| 방법                                | 장점                                 | 단점                                                   |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| 서버에서 ffmpeg으로 포스터 만들기   | 어떤 코덱이든 같은 결과              | 서버 이미지가 커지고, 업로드마다 프로세스를 실행한다   |
| 포스터 없이 동영상만                | 할 일이 없다                         | 불러오는 동안 빈 화면, 움직임 줄이기에서는 배경이 없다 |
| 관리자가 포스터 그림을 따로 업로드  | 서버·브라우저 모두 단순              | 업로드마다 파일을 두 번 선택한다                       |
| 브라우저가 캔버스에 렌더링해 만들기 | 의존성 없음, 업로드 시각에 자동 생성 | 브라우저가 디코딩하지 못하는 코덱은 대체 그림을 쓴다   |

관리자는 한 명이고, 그 관리자가 업로드하는 동영상은 업로드에 쓰는 브라우저가 이미 재생할 수 있는 형식이다. 따라서 ==브라우저에서 만드는 방식의 단점이 실제로 드러날 일이 거의 없다.== 순서는 다음과 같다(`shared/settings/customWallpapers.ts`).

1. 고른 파일을 [`URL.createObjectURL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)로 `<video>`에 연결한다. 이 함수는 메모리에 있는 파일에 `blob:https://…` 형식의 임시 주소를 부여해, 업로드 전에도 `<video src>`로 읽을 수 있게 한다.
2. 첫 프레임을 수신하면([`loadeddata`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event)) 재생 위치를 0.5초(`POSTER_AT`)로 이동한다. 첫 프레임이 검은 화면인 영상이 많기 때문이다. 길이가 1초보다 짧은 영상은 길이의 절반 지점으로 이동한다(예: 0.6초 영상은 0.3초).
3. 이동이 끝나면([`seeked`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event)) 그 장면을 캔버스에 `drawImage`로 렌더링해 긴 변 1,280px(`POSTER_MAX`) JPEG로 만든다.

동작 줄이기를 켠 방문자에게는 이 포스터가 배경화면 전체이므로 사진 썸네일(640px, `THUMB_MAX`)보다 크게 만든다. 예를 들어 1920×1080 영상의 포스터는 1280×720 JPEG가 된다. 브라우저가 그 코덱을 디코딩하지 못하면 640×400 크기의 어두운 그라데이션 그림을 대신 쓰고, 재생 표시로 동영상임을 알린다.

![포스터를 만들어 올리는 순서와, 화면에서 포스터 위에 video를 까는 층](./images/video-wallpaper-layers.svg '동영상 배경화면을 업로드하고 화면에 배치하는 방법')

## 서버에서 검증하는 것

### 파일 앞부분으로 형식 판별

파일 형식은 파일 이름이나 브라우저가 보낸 `Content-Type`을 신뢰하지 않고 파일 앞부분의 바이트(매직 넘버[^magic])로 판별한다. `.mp4`로 이름만 바꾼 HTML 파일을 걸러내기 위해서다. 이미지(PNG·JPEG·GIF·WebP)는 원래 이 방식으로 판별했고, 여기에 MP4를 추가했다.

MP4 파일은 **상자(box)**[^ftyp]의 연속이다. 각 상자는 4바이트 크기와 4글자 종류로 시작하고, 첫 상자는 파일 형식을 밝히는 `ftyp`이다. 시험에서 실제로 녹화한 MP4의 앞부분은 다음과 같다.

![Chromium MediaRecorder가 만든 MP4의 앞 44바이트를 상자 크기·종류·주 브랜드·호환 브랜드로 나눈 그림](./images/video-wallpaper-ftyp.svg '4~8바이트의 "ftyp"과 그 뒤 4글자 주 브랜드 "isom"으로 MP4를 판별한다')

- MP4는 4~8바이트가 `ftyp`이고, 그 뒤 4글자(주 브랜드)가 `isom`·`mp42`·`avc1` 같은 MP4 값이어야 한다.
- QuickTime(`qt  `)은 거절한다. 브라우저에 따라 재생 지원 여부가 다르기 때문이다. iPhone으로 촬영한 `.mov` 파일이 이 경우다.
- 썸네일은 늘 이미지여야 한다.

```ts
// apps/api/src/files/rules.ts
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4']);
```

### 크기 한도와 DB 제약

크기 한도는 사진 10MB, 동영상 30MB다. 업로드 파일 테이블(`Upload`)의 DB 제약(CHECK, 행을 저장할 때마다 DB가 검사하는 조건)이 10MB였기 때문에, 새 마이그레이션(`20261020100000_wallpaper_video`)을 만들어 30MB(31,457,280바이트)로 늘렸다.

```sql
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_required_fields";
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 200
  AND length("type") > 0
  AND "size" BETWEEN 1 AND 31457280
  AND octet_length("data") = "size"
);
```

> [!IMPORTANT]
> 이미 배포한 마이그레이션은 수정하지 않는다. 일반 업로드의 10MB 한도는 API 검증이 그대로 적용하고, 30MB까지는 배경화면 동영상만 허용한다.

### Range 요청과 206 응답

> [!WARNING] Safari는 206 응답이 있어야 재생한다
> 파일을 전송하는 `/files/:id`는 이제 [`Range` 요청](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)을 처리한다. `<video>`는 파일을 구간별로 나눠 요청하는데, Safari는 서버가 [`206 Partial Content`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206)로 응답하지 않으면 동영상을 재생하지 않는다. 동영상도 이미지처럼 `Content-Disposition: inline`으로 전송한다.

`<video>`가 구간을 나눠 요청하는 이유는, 재생 시작에 필요한 앞부분만 먼저 받고 사용자가 재생 위치를 옮기면 그 위치의 구간을 바로 받기 위해서다. 100바이트 파일의 끝 10바이트를 요청하면 요청과 응답은 다음과 같다.

```http
GET /files/abc HTTP/1.1
Range: bytes=90-500

HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 90-99/100
Content-Length: 10
```

요청한 끝(500)이 파일 크기를 넘으므로 서버는 마지막 바이트(99)까지 잘라서 보내고, `Content-Range`로 실제 보낸 구간과 전체 크기를 알린다. 파일 밖의 구간을 요청하면 [416](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416)과 함께 `Content-Range: bytes */100`을 보낸다. 모든 응답에는 `Accept-Ranges: bytes`를 붙여 이 서버가 구간 요청을 처리한다고 알린다.

`parseRange`(`apps/api/src/files/rules.ts`)는 `Range` 머리말의 `bytes=시작-끝` 한 구간만 해석한다. 단위 시험의 입력과 결과는 다음과 같다(파일 크기 100바이트).

| `Range` 머리말            | 결과                            | 응답 |
| ------------------------- | ------------------------------- | ---- |
| 없음                      | 전체                            | 200  |
| `bytes=0-`                | 0~99                            | 206  |
| `bytes=90-500`            | 90~99(끝을 파일 크기로 자름)    | 206  |
| `bytes=-10`               | 끝에서 10바이트, 90~99          | 206  |
| `bytes=0-1,5-6`           | 여러 구간은 해석하지 않음, 전체 | 200  |
| `bytes=100-`, `bytes=5-2` | 범위 밖                         | 416  |

여러 구간 요청은 `<video>`가 보내지 않으므로 전체 응답으로 처리한다.

![video가 Range 요청을 보내고 서버가 206·200·416으로 답하는 흐름](./images/video-wallpaper-range.svg '/files/:id의 Range 처리')

사이트의 콘텐츠 보안 정책([CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), 페이지가 어느 주소에서 스크립트·이미지·동영상을 불러올 수 있는지 정하는 응답 머리말)은 `apps/react/worker/securityHeaders.ts`의 `media-src`에 이미 API 주소가 들어 있어 수정할 필요가 없었다.

## 확인

| 종류                           | 확인한 동작                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------- |
| 서버 단위 시험                 | MP4 판별(브랜드, 상자 크기, QuickTime 거절), Range 머리말 해석               |
| 서버 e2e 시험(실제 PostgreSQL) | MP4 올리기, `video: true`, 206 응답, 416, 크기 한도(이미지 10MB·동영상 30MB) |
| 화면 단위 시험                 | 설정에서 동영상 주소를 읽고, 안전하지 않은 주소는 무시하기                   |
| Playwright                     | 아래 5개 시험                                                                |

시험용 Chromium은 H.264를 디코딩하지 못한다. 그래서 시험에서는 브라우저의 [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)로 색이 바뀌는 캔버스를 1초 녹화해 VP9 코덱을 담은 MP4를 생성했다. 위 그림의 바이트가 이 방법으로 만든 파일이다. ==시험 파일을 저장소에 커밋하지 않고 시험 안에서 생성==하므로, 지원 코덱이 다른 브라우저에서도 그 브라우저가 인코딩할 수 있는 형식으로 시험한다.

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

- 관리자가 배경화면을 추가하는 기능: [createImageBitmap과 canvas toBlob으로 브라우저에서 이미지 축소해 업로드하기](/memo/custom-wallpapers)
- 고른 배경화면을 새로고침 뒤에도 유지하는 일: [id 접두어 상수로 서버 배경화면 검사에서 Finder 파일 제외하기](/memo/finder-wallpaper-persist)
- 업로드한 사진의 EXIF 삭제: [JPEG·PNG·WebP 세그먼트를 순회해 EXIF를 지우고 방향 값만 남기기](/memo/upload-strip-exif)
- 바탕화면 `z-index` 계층 정리: [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231)
- PR: [#264](https://github.com/hyeoniverse/MacFolio/pull/264)

<details>
<summary>참고 문헌</summary>

- [MDN: The Video Embed element (`<video>`)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video)
- [MDN: Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)
- [Chrome for Developers: Autoplay policy in Chrome](https://developer.chrome.com/blog/autoplay)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: Document: visibilitychange event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
- [MDN: URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [MDN: HTMLMediaElement: loadeddata event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event), [seeked event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event)
- [MDN: createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
- [HTML Standard: createImageBitmap (animated images)](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-createimagebitmap)
- [MDN: HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests), [206 Partial Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206), [416 Range Not Satisfiable](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416)
- [RFC 9110: HTTP Semantics, 14. Range Requests](https://www.rfc-editor.org/rfc/rfc9110#name-range-requests)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [facebook/react#10389](https://github.com/facebook/react/issues/10389): `muted` 속성이 HTML에 출력되지 않는 문제
- [Prisma: Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)

</details>

[^poster]: 동영상을 불러오는 동안이나 재생할 수 없는 경우에 대신 보여 주는 정지 이미지. `<video>`의 `poster` 속성과 같은 역할이다.

[^muted]: React가 `muted`를 HTML 속성으로 출력하지 않는 문제는 [facebook/react#10389](https://github.com/facebook/react/issues/10389)에 정리되어 있다.

[^magic]: 매직 넘버: 파일 형식마다 정해진 앞부분 바이트. PNG는 `89 50 4E 47`, JPEG는 `FF D8 FF`로 시작한다.

[^ftyp]: MP4(ISO Base Media File Format) 파일을 구성하는 단위. 첫 상자 `ftyp`은 파일 형식을 나타내는 주 브랜드와 호환 브랜드 목록을 담고, 그 뒤 `moov`(영상 정보)·`mdat`(영상 데이터) 같은 상자가 이어진다.

#MacFolio #프론트엔드 #배경화면 #동영상 #시스템설정

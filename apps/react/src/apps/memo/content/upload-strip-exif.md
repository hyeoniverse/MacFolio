---
title: JPEG·PNG·WebP 세그먼트를 순회해 EXIF를 지우고 방향 값만 남기기
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 7
summary: 휴대폰 사진에는 촬영 위치의 위도·경도와 기기 이름이 들어 있어 글에 업로드하면 그대로 공개된다. 의존성 없이 JPEG·PNG·WebP의 세그먼트·청크를 순회하며 메타데이터만 제거하고, 사진이 회전되어 표시되지 않도록 JPEG 방향 값 하나만 남겼다.
---

이 글은 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "업로드 파일 형식을 내용으로 확인하고 이미지 메타데이터 지우기"를 처리한 기록이다([#163](https://github.com/hyeoniverse/MacFolio/pull/163)). 앞 절반(파일 앞부분의 바이트로 형식 확인)은 파일 업로드 기능을 구현할 때 이미 적용했고, 이번 작업은 뒤 절반이다.

## 사진 파일에 포함된 정보

휴대폰으로 촬영한 JPEG에는 이미지 데이터 외에 **EXIF**가 포함된다. 촬영 시각, 기기 제조사와 모델, 렌즈·노출 값, 그리고 위치 서비스가 켜져 있으면 **위도·경도**까지 기록된다. 편집 프로그램을 거치면 **XMP**(Adobe의 XML 메타데이터)와 주석이 추가된다.

글 편집기는 업로드한 파일을 그대로 서버로 전송하고, 서버는 수신한 그대로 저장해 모든 방문자에게 응답한다. 집에서 촬영한 사진 한 장으로 집 주소가 공개될 수 있다. 배경화면은 브라우저에서 캔버스로 축소해 전송하므로 메타데이터가 없지만, 글의 사진은 원본이 그대로 저장된다.

<details>
<summary>용어 정리</summary>

- **EXIF**: 카메라가 사진 파일 안에 기록하는 정보. TIFF 형식의 표(IFD)에 태그 번호별로 값이 있다. GPS 정보는 그 안의 별도 표(GPS IFD)에 있다. 태그 목록은 [ExifTool 태그 문서](https://exiftool.org/TagNames/EXIF.html)에 있다.
- **Orientation(방향)**: EXIF 태그 0x0112. 휴대폰은 이미지 데이터를 회전하지 않고 "이 사진은 90° 회전해 표시하라"는 값을 기록한다. 값이 1이면 회전 없음, 6이면 시계 방향 90°. 브라우저는 이 값에 따라 회전해 렌더링한다([`image-orientation: from-image`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation)가 기본값). **EXIF를 모두 삭제하면 사진이 옆으로 회전된 채 표시된다.**
- **JPEG 세그먼트**: JPEG는 `FF xx` 마커로 시작하는 세그먼트의 나열이다. APP0(JFIF)·APP1(EXIF, XMP)·APP2(ICC 색 프로필) 등이 이어지고, 이미지 데이터(SOS, `FF DA`)부터는 파일 끝까지 이미지 데이터다.
- **PNG 청크, WebP 청크**: PNG는 `길이·이름·내용·CRC`([PNG 명세](https://www.w3.org/TR/png-3/)), WebP는 RIFF `이름·길이·내용`([WebP 컨테이너 명세](https://developers.google.com/speed/webp/docs/riff_container)) 단위의 나열이다. 메타데이터는 각각 `eXIf`·`tEXt`, `EXIF`·`XMP ` 청크에 있다.

</details>

## 검토한 방법

| 방법                                              | 장점                               | 단점                                                                   |
| ------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 브라우저에서 캔버스로 다시 렌더링해 전송          | 서버 작업이 필요 없다              | 재인코딩으로 화질이 바뀐다. API를 직접 호출하면 원본이 그대로 저장된다 |
| 서버에서 `sharp`로 재인코딩                       | 코드 한 줄, 지원 형식이 많다       | 네이티브 바이너리(수십 MB)가 API 이미지에 포함된다. 화질이 바뀐다      |
| EXIF 전용 라이브러리(piexif 등)                   | EXIF를 정확히 처리한다             | 대부분 JPEG만 지원한다. XMP·PNG·WebP는 별도 처리가 필요하다            |
| 형식 구조를 순회하며 메타데이터만 제거 (**채택**) | 의존성 0개, 이미지 바이트는 그대로 | 형식마다 코드를 직접 작성하고 시험해야 한다                            |

제거 위치는 서버여야 했다. 브라우저에서 제거하면 편집기를 거치지 않고 API를 직접 호출하는 요청은 처리하지 못한다. 서버에서 재인코딩하는 방법은 화질과 이미지 크기 측면에서 모두 손해다. 세 형식 모두 세그먼트·청크의 나열이라 **메타데이터 단위만 제외하고 이어 붙이면** 이미지 데이터는 1바이트도 바뀌지 않는다. 그래서 마지막 방법을 채택했다. `apps/api/src/files/metadata.ts`는 158줄이다.

## 라이브러리 없이 구현

| 형식 | 제거                                           | 유지                                      |
| ---- | ---------------------------------------------- | ----------------------------------------- |
| JPEG | APP1(EXIF·XMP), APP3~13·15, COM(주석)          | APP0(JFIF), APP2(ICC), APP14(Adobe), 그림 |
| PNG  | `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`         | `IHDR`, `IDAT`, `iCCP` 등 나머지          |
| WebP | `EXIF`, `XMP ` 청크, VP8X 머리의 EXIF·XMP 깃발 | `VP8X`, `VP8 `/`VP8L`, `ICCP`, `ALPH`     |
| GIF  | (메타데이터 자리가 없다)                       | 전부                                      |

ICC 프로필은 "이 사진의 색은 Display P3 기준"이라는 정보라 삭제하면 채도가 낮아져 표시된다. 개인정보가 아니므로 유지한다.

JPEG 처리의 핵심은 마커를 하나씩 건너뛰며 유지할 세그먼트만 수집하는 반복문이다. 이미지 데이터(SOS)를 만나면 반복을 멈추고 나머지를 그대로 이어 붙인다.

```ts
const JPEG_KEEP = new Set([0xe0, 0xe2, 0xee]); // APP0(JFIF)·APP2(ICC)·APP14(Adobe)

while (offset + 4 <= data.length && data[offset] === 0xff) {
	const marker = data[offset + 1];
	const length = view.getUint16(offset + 2);
	const end = offset + 2 + length;
	if (marker === 0xda || end > data.length) break; // 그림 데이터(SOS)부터는 그대로
	const isMeta = (marker >= 0xe1 && marker <= 0xef && !JPEG_KEEP.has(marker)) || marker === 0xfe;
	if (isMeta) {
		if (marker === 0xe1 && orientation === null) orientation = readOrientation(data, offset + 4, end);
		changed = true;
	} else parts.push(data.subarray(offset, end));
	offset = end;
}
```

(실제 코드에는 이미 방향만 남긴 APP1을 식별하는 분기가 하나 더 있다.)

![올린 JPEG의 세그먼트 중 EXIF·XMP·COM을 빼고 방향만 든 36바이트 APP1을 넣은 모습](./images/upload-strip-exif-segments.svg '빨간 조각만 빼고 이어 붙인다')

## 방향 하나만 남기기

JPEG의 APP1을 제거하기 전에 TIFF 표에서 Orientation 태그 값을 읽는다. 값이 1이 아니면 **그 태그 하나만 담은 APP1**(36바이트)을 생성해 맨 앞에 삽입한다.

| 구성                               | 크기         |
| ---------------------------------- | ------------ |
| APP1 마커(2)·길이(2)·`Exif\0\0`(6) | 10바이트     |
| TIFF 머리                          | 8바이트      |
| 엔트리 수                          | 2바이트      |
| Orientation 엔트리                 | 12바이트     |
| "다음 표 없음"                     | 4바이트      |
| **합계**                           | **36바이트** |

이미 처리한 파일에는 이 36바이트 APP1이 그대로 남아 있고, 같은 파일을 다시 처리해도 결과가 바뀌지 않는다(멱등). PNG와 WebP에는 방향 개념이 없어 메타데이터를 모두 제거한다.

구조가 비정상인 파일(길이가 파일 끝을 넘는 세그먼트 등)은 수정하지 않고 그대로 저장한다. 손상된 파일은 브라우저가 렌더링하지 않으며, 업로드 차단은 이 코드의 역할이 아니다. 그래서 외부 함수는 형식별 함수를 `try`로 감싸고, 실패하면 원본을 반환한다.

```ts
export function stripImageMetadata(data: Uint8Array, type: string): Uint8Array {
	try {
		if (type === 'image/jpeg') return stripJpeg(data);
		if (type === 'image/png') return stripPng(data);
		if (type === 'image/webp') return stripWebp(data);
	} catch {
		// 손상된 파일은 브라우저가 알아서 거른다. 여기서 막지는 않는다
	}
	return data;
}
```

## 호출 위치

업로드한 파일을 저장하는 위치는 두 곳이다. 글의 사진(`files/files.service.ts`)과 배경화면(`wallpapers/wallpapers.service.ts`). 두 곳 모두 저장 직전에 이 함수를 거치게 했고, DB에 기록하는 `size`도 원본 크기가 아니라 메타데이터를 제거한 뒤의 크기로 바꿨다. 파일을 응답할 때 `Content-Length`가 이 값이라, 원본 크기를 그대로 기록하면 응답이 잘린다.

```ts
// 전
size: file.size,
data: new Uint8Array(file.buffer),
// 후: 저장한 크기가 곧 내려줄 크기
const data = new Uint8Array(image ? stripImageMetadata(file.buffer, image) : file.buffer);
size: data.byteLength,
```

배경화면은 브라우저에서 축소해 전송하므로 보통 메타데이터가 없다. 그래도 API를 직접 호출하면 원본이 전송될 수 있어 같은 함수를 거친다.

![글 편집기와 배경화면 설정이 보낸 파일이 형식 확인과 메타데이터 지우기를 거쳐 저장되는 흐름](./images/upload-strip-exif-flow.svg '저장 직전 한 곳에서 지운다')

## 확인

4×2 픽셀 이미지에 Orientation 6, 기기 이름, GPS 37°33′N 126°58′E, XMP, 주석을 넣은 픽스처를 Pillow로 생성해 세 형식으로 저장했다.

| 검증 방법          | 확인 내용                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위 시험          | 처리 후 세그먼트·청크 목록(JPEG `e1 e0 db db c0 c4…`, PNG `IHDR IDAT IEND`, WebP `VP8X VP8 `), RIFF 크기·플래그, "TestCam" 문자열 부재, 이미지 데이터의 바이트 일치 |
| Pillow로 결과 열기 | 픽셀이 같고 EXIF에 `{274: 6}`(Orientation)만 남는지                                                                                                                 |
| E2E                | 사진을 업로드하고 내려받아 기기 이름이 없고 `Content-Length`가 제거 후 크기인지                                                                                     |

<details>
<summary>시험 이름 목록</summary>

- `apps/api/src/files/metadata.test.ts` (5개): "JPEG: EXIF(GPS·기기)·XMP·주석을 빼고 방향(Orientation)만 남긴다", "JPEG: 방향이 1(정방향)이거나 없으면 APP1을 아예 두지 않는다", "PNG: eXIf·tEXt 같은 메타데이터 청크를 빼고 그림 청크는 둔다", "WebP: EXIF·XMP 청크를 빼고, VP8X 깃발과 RIFF 크기를 맞춘다", "GIF와 구조가 이상한 파일은 그대로 둔다"
- `apps/api/test/files.e2e.test.ts`: "사진의 EXIF(찍은 곳·기기)는 지우고 저장한다. 크기도 지운 뒤의 크기"

</details>

아래는 픽스처 세 개를 처리한 뒤의 크기다. 이미지가 4×2 픽셀뿐이라 파일 대부분이 메타데이터였다.

| 픽스처      | 전 (바이트) | 후 (바이트) | 남은 비율 |
| ----------- | ----------- | ----------- | --------- |
| `exif.jpg`  | 1,094       | 667         | 61%       |
| `exif.png`  | 303         | 75          | 25%       |
| `exif.webp` | 500         | 72          | 14%       |

실제 휴대폰 사진은 이미지 데이터가 수 MB라 비율로는 거의 줄지 않는다. 목적은 용량 감소가 아니라 위치 정보 제거다.

## 남은 과제와 정리

- 이 함수는 저장 시각에만 실행된다. 이 작업 이전에 저장된 파일은 별도로 다시 처리하지 않았다.
- 지원 형식은 JPEG·PNG·WebP 세 가지다. 다른 형식을 허용하면 같은 방식(세그먼트·청크 단위)으로 처리를 추가해야 한다.
- 대부분의 이미지 형식은 세그먼트·청크의 나열이다. 재인코딩하지 않고 메타데이터 단위만 필터링하면 의존성도, 화질 손실도 없다. 다만 바이트를 직접 다루는 코드는 시험 픽스처를 직접 생성해 두어야 신뢰할 수 있다.
- 메타데이터를 제거할 때는 "무엇을 유지해야 하는가"를 먼저 정한다. 이번에는 방향과 색 프로필이었다. 둘을 제거하면 사진이 회전되어 표시되거나 색이 달라진다.

## 직접 확인하는 방법

휴대폰으로 촬영한 사진을 업로드한 뒤, 내려받은 파일에 위치 정보가 남았는지 확인한다.

```bash
exiftool 원본.jpg | grep -iE 'gps|model|orientation'     # 위치·기기·방향
curl -s -o 받은.jpg <올린 그림 주소>
exiftool 받은.jpg | grep -iE 'gps|model|orientation'     # Orientation만 남아야 한다
```

시험은 `pnpm --filter @macfolio/api test -- src/files/metadata.test.ts`와 [apps/api/test/files.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/files.e2e.test.ts)다. 코드는 [apps/api/src/files/metadata.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/files/metadata.ts).

참고 문서: [ExifTool](https://exiftool.org/), [MDN image-orientation](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation), [PNG 명세](https://www.w3.org/TR/png-3/), [WebP 컨테이너 명세](https://developers.google.com/speed/webp/docs/riff_container).

## 관련 글

- [참조 위치 API로 쓰는 곳 없는 서버 파일만 골라 지우기](/memo/server-files-cleanup)
- [화면이 알아야 하는가를 기준으로 파일 검사 규칙을 contracts와 서버로 나누기](/memo/contracts-files)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-step7-security)
- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)

PR: [#163](https://github.com/hyeoniverse/MacFolio/pull/163)

#MacFolio #보안 #API #이미지 #EXIF

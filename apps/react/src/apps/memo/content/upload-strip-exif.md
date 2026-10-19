---
title: 올린 사진의 EXIF를 지우되 방향은 남기기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 휴대폰 사진에는 찍은 곳의 위도·경도와 기기 이름이 들어 있어 글에 올리면 그대로 공개된다. 의존성 없이 JPEG·PNG·WebP의 조각을 따라가며 메타데이터만 빼고, 사진이 눕지 않게 JPEG 방향 값 하나만 남겼다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 중 "업로드 파일 형식을 내용으로 확인하고 이미지 메타데이터 지우기". 앞 절반(파일 앞부분으로 형식 확인)은 파일 업로드를 만들 때 이미 했고, 이번에는 뒷 절반이다.

## 사진에 무엇이 들어 있나

휴대폰으로 찍은 JPEG에는 그림 말고도 **EXIF**가 들어 있다. 찍은 시각, 기기 제조사와 모델, 렌즈·노출 값, 그리고 위치 서비스를 켰다면 **위도·경도**. 편집 프로그램을 거치면 **XMP**(Adobe의 XML 메타데이터)와 주석이 더 붙는다. 글 편집기는 올린 파일을 그대로 서버에 보내고, 서버는 받은 그대로 저장해 누구에게나 내려 준다. 집에서 찍은 사진 한 장이면 집 주소가 공개되는 셈이다. 배경화면은 브라우저에서 캔버스로 줄여 보내서 메타데이터가 없지만, 글의 사진은 원본이다.

## 용어

- **EXIF**: 카메라가 사진 파일 안에 적어 두는 정보. TIFF 형식의 표(IFD)에 태그 번호마다 값이 있다. GPS는 그 안의 별도 표(GPS IFD)에
- **Orientation(방향)**: EXIF 태그 0x0112. 휴대폰은 센서를 돌리지 않고 "이 사진은 90° 돌려 보라"고 적는다. 값이 1이면 그대로, 6이면 시계 방향 90°. 브라우저는 이 값을 보고 돌려 그린다 (`image-orientation: from-image`가 기본). **EXIF를 통째로 지우면 사진이 눕는다**
- **JPEG 세그먼트**: JPEG는 `FF xx` 마커로 시작하는 조각의 나열이다. APP0(JFIF)·APP1(EXIF, XMP)·APP2(ICC 색 프로필)… 그림 데이터(SOS, `FF DA`)부터는 끝까지 그림이다
- **PNG 청크, WebP 청크**: PNG는 `길이·이름·내용·CRC`, WebP는 RIFF `이름·길이·내용` 조각의 나열. 메타데이터는 각각 `eXIf`·`tEXt`, `EXIF`·`XMP ` 청크에 있다

## 고른 방법과 버린 방법

| 방법                                   | 장점                             | 단점                                                              |
| -------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| 브라우저에서 캔버스로 다시 그려 보낸다 | 서버는 할 일이 없다              | 다시 인코딩해 화질이 바뀐다. API를 직접 부르면 그대로 통과한다    |
| 서버에서 `sharp`로 다시 인코딩         | 한 줄이면 된다, 형식이 많다      | 네이티브 바이너리(수십 MB)가 API 이미지에 들어간다. 화질이 바뀐다 |
| EXIF 전용 라이브러리(piexif 등)        | EXIF는 정확히 다룬다             | 대개 JPEG만 다룬다. XMP·PNG·WebP는 따로 해야 한다                 |
| 형식 구조를 따라가며 조각만 뺀다       | 의존성 0개, 그림 바이트는 그대로 | 형식마다 코드를 직접 쓰고 시험해야 한다                           |

막는 곳은 서버여야 했다. 브라우저에서 지우면 편집기를 거치지 않고 API를 직접 부르는 요청은 막지 못한다. 서버에서 다시 인코딩하는 길은 화질과 이미지 크기를 함께 잃는다. 세 형식 모두 조각의 나열이라 **메타데이터 조각만 빼고 이어 붙이면** 그림 데이터는 1바이트도 바뀌지 않는다. 그래서 마지막 방법을 골랐다. `apps/api/src/files/metadata.ts`가 158줄이다.

## 라이브러리 없이

| 형식 | 빼는 것                                        | 두는 것                                   |
| ---- | ---------------------------------------------- | ----------------------------------------- |
| JPEG | APP1(EXIF·XMP), APP3~13·15, COM(주석)          | APP0(JFIF), APP2(ICC), APP14(Adobe), 그림 |
| PNG  | `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`         | `IHDR`, `IDAT`, `iCCP` 등 나머지          |
| WebP | `EXIF`, `XMP ` 청크, VP8X 머리의 EXIF·XMP 깃발 | `VP8X`, `VP8 `/`VP8L`, `ICCP`, `ALPH`     |
| GIF  | (메타데이터 자리가 없다)                       | 전부                                      |

ICC 프로필은 "이 사진의 색은 Display P3 기준"이라는 정보라 지우면 색이 바랜다. 개인정보는 아니므로 둔다.

JPEG 쪽 핵심은 마커를 하나씩 건너뛰며 남길 조각만 모으는 반복문이다. 그림 데이터(SOS)를 만나면 거기서 멈추고 나머지를 통째로 붙인다.

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

(실제 코드에는 이미 방향만 남긴 APP1을 알아보는 갈래가 하나 더 있다.)

![올린 JPEG의 세그먼트 중 EXIF·XMP·COM을 빼고 방향만 든 36바이트 APP1을 넣은 모습](./images/upload-strip-exif-segments.svg '빨간 조각만 빼고 이어 붙인다')

## 방향 하나만 남기기

JPEG의 APP1을 빼기 전에 TIFF 표에서 Orientation 태그를 읽어 둔다. 값이 1이 아니면 **그 태그 하나만 든 APP1**(36바이트)을 만들어 맨 앞에 넣는다. 표 머리 8바이트, 엔트리 수 2바이트, 엔트리 12바이트, "다음 표 없음" 4바이트. 전에 거친 파일은 이 36바이트 APP1이 그대로 있고, 같은 파일을 다시 거쳐도 바뀌지 않는다. PNG와 WebP에는 방향이라는 개념이 없어 그냥 뺀다.

구조가 이상한 파일(길이가 파일을 넘는 세그먼트 등)은 손대지 않고 그대로 저장한다. 깨진 파일은 브라우저가 거르고, 올리기를 막는 것은 이 코드의 일이 아니다. 그래서 바깥 함수는 형식별 함수를 `try`로 감싸고, 실패하면 원본을 돌려준다.

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

## 어디서 부르나

올린 파일이 저장되는 곳은 두 군데다. 글의 사진(`files/files.service.ts`)과 배경화면(`wallpapers/wallpapers.service.ts`). 두 곳 모두 저장하기 직전에 이 함수를 거치게 했고, DB에 적는 `size`도 원래 파일 크기가 아니라 지운 뒤의 크기로 바꿨다. 내려줄 때 `Content-Length`가 이 값이라, 원래 크기를 그대로 적으면 응답이 잘린다.

```ts
// 전
size: file.size,
data: new Uint8Array(file.buffer),
// 후: 저장한 크기가 곧 내려줄 크기
const data = new Uint8Array(image ? stripImageMetadata(file.buffer, image) : file.buffer);
size: data.byteLength,
```

배경화면은 브라우저에서 줄여 보내서 보통 메타데이터가 없다. 그래도 API를 직접 부르면 원본이 올 수 있으니 같은 함수를 거친다.

![글 편집기와 배경화면 설정이 보낸 파일이 형식 확인과 메타데이터 지우기를 거쳐 저장되는 흐름](./images/upload-strip-exif-flow.svg '저장 직전 한 곳에서 지운다')

## 확인

4×2 픽셀 그림에 Orientation 6, 기기 이름, GPS 37°33′N 126°58′E, XMP, 주석을 넣은 픽스처를 Pillow로 만들어 세 형식으로 저장했다. 단위 시험은 거친 뒤의 조각 목록(JPEG `e1 e0 db db c0 c4…`, PNG `IHDR IDAT IEND`, WebP `VP8X VP8 `)과 RIFF 크기·깃발, "TestCam"이 없는지, 그림 데이터가 바이트 단위로 같은지를 본다. 따로 Pillow로 결과를 열어 픽셀이 같고 EXIF에 `{274: 6}`만 남는지도 봤다. e2e는 사진을 올리고 내려받아 기기 이름이 없고 `Content-Length`가 지운 뒤의 크기인지 본다.

시험 이름으로 정리하면 이렇다.

- `apps/api/src/files/metadata.test.ts` (5개): "JPEG: EXIF(GPS·기기)·XMP·주석을 빼고 방향(Orientation)만 남긴다", "JPEG: 방향이 1(정방향)이거나 없으면 APP1을 아예 두지 않는다", "PNG: eXIf·tEXt 같은 메타데이터 청크를 빼고 그림 청크는 둔다", "WebP: EXIF·XMP 청크를 빼고, VP8X 깃발과 RIFF 크기를 맞춘다", "GIF와 구조가 이상한 파일은 그대로 둔다"
- `apps/api/test/files.e2e.test.ts`: "사진의 EXIF(찍은 곳·기기)는 지우고 저장한다. 크기도 지운 뒤의 크기"

픽스처 세 장이 함수를 거친 뒤의 크기다. 그림이 4×2 픽셀뿐이라 대부분이 메타데이터였다.

| 픽스처      | 전 (바이트) | 후 (바이트) | 남은 비율 |
| ----------- | ----------- | ----------- | --------- |
| `exif.jpg`  | 1,094       | 667         | 61%       |
| `exif.png`  | 303         | 75          | 25%       |
| `exif.webp` | 500         | 72          | 14%       |

실제 휴대폰 사진은 그림이 수 MB라 비율로는 거의 줄지 않는다. 줄이는 것이 목적이 아니라 위치를 지우는 것이 목적이다.

## 남은 것·배운 것

- 이 함수는 저장하는 순간에만 돈다. 이 일보다 먼저 저장된 파일은 따로 다시 거치게 하지 않았다.
- 다루는 형식은 JPEG·PNG·WebP 셋이다. 다른 형식을 받게 되면 같은 방식(조각 단위)으로 더해야 한다.
- 파일 형식은 대부분 "조각의 나열"이다. 다시 인코딩하지 않고 조각만 걸러 내면 의존성도, 화질 손실도 없다. 다만 바이트를 직접 다루는 코드는 시험 픽스처를 손으로 만들어 두어야 믿을 수 있다.
- 지울 때는 "무엇을 남겨야 하는가"를 먼저 정한다. 이번에는 방향과 색 프로필이었다. 둘을 빼면 사진이 눕거나 색이 바랜다.

## 직접 확인하는 방법

휴대폰으로 찍은 사진을 올린 뒤, 받은 파일에 위치가 남았는지 본다.

```bash
exiftool 원본.jpg | grep -iE 'gps|model|orientation'     # 위치·기기·방향
curl -s -o 받은.jpg <올린 그림 주소>
exiftool 받은.jpg | grep -iE 'gps|model|orientation'     # Orientation만 남아야 한다
```

시험은 `pnpm --filter @macfolio/api test -- src/files/metadata.test.ts`와 [apps/api/test/files.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/files.e2e.test.ts)다. 코드는 [apps/api/src/files/metadata.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/files/metadata.ts).

참고 문서: [ExifTool](https://exiftool.org/), [JPEG·EXIF Orientation(MDN image-orientation)](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation).

## 관련 글

- 쓰는 곳이 없는 올린 파일을 찾는 일: /memo/server-files-cleanup
- 올린 파일 규칙을 화면과 서버로 나눈 일: /memo/contracts-files
- 리팩터링 7단계(보안) 정리: /memo/refactor-step7-security
- PR: https://github.com/hyeoniverse/MacFolio/pull/163

#MacFolio #보안 #API #이미지 #EXIF

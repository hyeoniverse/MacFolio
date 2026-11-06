---
title: JPEG·PNG·WebP 세그먼트를 순회해 EXIF를 지우고 방향 값만 남기기
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 7
summary: 휴대폰 사진에는 촬영 위치의 위도·경도와 기기 이름이 들어 있어 글에 업로드하면 그대로 공개된다. 의존성 없이 JPEG·PNG·WebP의 세그먼트·청크를 순회하며 메타데이터만 제거하고, 사진이 회전되어 표시되지 않도록 JPEG 방향 값 하나만 남겼다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 중 하나가 "업로드 파일 형식을 내용으로 확인하고 이미지 메타데이터 지우기"였다. 앞 절반(파일 앞부분의 바이트로 형식 확인)은 파일 업로드 기능을 구현할 때 이미 적용했고, 뒤 절반인 메타데이터 제거를 [#163](https://github.com/hyeoniverse/MacFolio/pull/163)에서 구현했다. 라이브러리 없이 JPEG·PNG·WebP 파일 구조를 직접 순회해 메타데이터 단위만 제외하고, JPEG의 방향 값 하나만 새로 만든 36바이트 세그먼트에 남긴다.

## 사진 파일에 포함된 정보

### EXIF: 카메라가 기록하는 메타데이터

**메타데이터**는 이미지 픽셀 외에 파일 안에 함께 저장되는 부가 정보다. 디지털카메라와 휴대폰은 사진을 저장할 때 **EXIF**(Exchangeable Image File Format) 형식으로 다음과 같은 값을 기록한다.

| 분류      | 예시 태그                        | 예시 값                       |
| --------- | -------------------------------- | ----------------------------- |
| 촬영 시각 | `DateTimeOriginal`               | `2025:10:03 14:22:51`         |
| 기기      | `Make`, `Model`                  | 제조사 이름, 휴대폰 모델 이름 |
| 촬영 조건 | `ExposureTime`, `FNumber`, `ISO` | `1/120`, `f/1.8`, `64`        |
| 위치      | `GPSLatitude`, `GPSLongitude`    | 위도·경도의 도·분·초          |
| 표시 방향 | `Orientation`                    | `6` (시계 방향 90° 회전)      |

위치 서비스가 켜진 휴대폰은 GPS 수신기로 측정한 위도·경도를 사진마다 기록한다. 아래는 EXIF 보기 프로그램으로 실제 사진의 태그를 연 화면이다.

![EXIF 보기 프로그램 Reveal에서 사진의 Orientation, 해상도 태그와 GPSInfo 아래의 GPSLatitude 43/1 20/1 47/1, GPSLongitude 3/1 41/1 438899/10000 같은 위치 태그를 표시한 화면](./images/upload-strip-exif-gps-tags.png 'EXIF 보기 프로그램이 표시한 실제 사진의 태그. GPSLatitude 43/1 20/1 47/1은 북위 43°20′47″를 뜻한다')

`GPSLatitude` 값 `43/1 20/1 47/1`은 도·분·초를 각각 분수(분자/분모)로 저장한 형태로, 북위 43°20′47″를 뜻한다. 위도 1초는 약 31m에 해당하므로, 초 아래 소수까지 기록된 값은 촬영 지점을 건물 단위로 특정한다. 편집 프로그램을 거친 파일에는 **XMP**(Adobe가 정의한 XML 형식의 메타데이터)와 주석도 추가된다.

### 업로드한 사진이 공개되는 경로

MacFolio의 글 편집기는 업로드한 파일을 그대로 서버로 전송하고, 서버는 수신한 바이트를 그대로 저장해 모든 방문자에게 응답한다. 방문자가 글의 사진을 내려받아 EXIF 보기 프로그램으로 열면 위 화면과 같은 값을 확인할 수 있다. ==집에서 촬영한 사진 한 장으로 집 주소가 공개될 수 있다.== 배경화면은 브라우저에서 캔버스로 축소해 다시 인코딩한 뒤 전송하므로 메타데이터가 없지만, 글의 사진은 원본이 그대로 저장되었다.

### Orientation: 지우면 안 되는 태그

휴대폰의 카메라 센서는 기기를 세워 들어도 픽셀을 항상 센서의 가로 방향으로 기록한다. 사진을 세로로 보여 주기 위해 휴대폰은 픽셀을 회전해 다시 저장하는 대신, EXIF의 **Orientation** 태그(번호 0x0112)에 "표시할 때 시계 방향으로 90° 회전하라"는 값 `6`을 기록한다. 브라우저는 CSS [`image-orientation`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation)의 기본값 `from-image`에 따라 이 값을 읽고 회전해 렌더링한다.

![Orientation 6인 사진은 픽셀이 가로로 저장되어 있고, 방향 값이 있으면 브라우저가 시계 방향 90도 돌려 세로로 표시하며, EXIF를 모두 지우면 옆으로 누운 채 표시되는 모습](./images/upload-strip-exif-orientation.svg '방향 값이 남아 있어야 세로로 찍은 사진이 세로로 표시된다')

따라서 EXIF를 통째로 삭제하면 ==세로로 찍은 사진이 옆으로 누운 채 표시된다.== 메타데이터 제거의 목표는 "위치·기기 정보는 삭제하고, 표시에 필요한 방향 값은 남기기"가 되었다.

## 이미지 파일의 구조

세 형식 모두 파일이 "종류 표시 + 길이 + 내용"으로 된 단위의 나열이다. 이 구조를 이해하면 픽셀 데이터를 다시 인코딩하지 않고 메타데이터 단위만 제외할 수 있다.

### JPEG 세그먼트

JPEG 파일은 `FF D8`(SOI, 이미지 시작)로 시작해 **세그먼트**가 이어지고, 압축된 픽셀 데이터 뒤 `FF D9`(EOI, 이미지 끝)로 끝난다.

![JPEG 비트스트림이 SOI, 세그먼트 1부터 N, 엔트로피 부호화된 데이터, EOI 순서로 이어지고, 그 데이터가 MCU 단위로 나뉘는 구조도](./images/upload-strip-exif-jpeg-structure.jpg 'JPEG 비트스트림 구조. SOI 뒤의 세그먼트 중 메타데이터 세그먼트만 제외하고, Entropy encoded data(픽셀 데이터)는 그대로 둔다')

각 세그먼트는 `FF`와 종류 번호 1바이트(마커), 그 뒤 2바이트 길이, 그리고 내용으로 구성된다. 길이 값은 길이 필드 자신을 포함하고 마커는 포함하지 않는다. 아래는 휴대폰 사진의 세그먼트 배치를 예시로 적은 것이다(길이 값은 설명용). EXIF는 `FF E1`(APP1) 마커로 시작한다.

```text
FF D8                      SOI (이미지 시작)
FF E0 00 10 4A 46 49 46 …  APP0 JFIF, 길이 16
FF E1 2F 6A 45 78 69 66 …  APP1 "Exif", 길이 0x2F6A = 12,138바이트 ← GPS·기기 정보
FF DB …                    DQT (양자화 표)
FF DA …                    SOS 이후 파일 끝까지 압축된 픽셀 데이터
```

APP1 안의 EXIF는 TIFF 형식의 표(**IFD**, Image File Directory)로 저장된다. 표의 각 항목(엔트리)은 12바이트로, 태그 번호 2바이트, 값의 자료형 2바이트, 값 개수 4바이트, 값 또는 값의 위치 4바이트다. GPS 정보는 기본 표에서 가리키는 별도의 표(GPS IFD)에 있다. 태그 목록은 [ExifTool 태그 문서](https://exiftool.org/TagNames/EXIF.html)에 정리되어 있다.

### PNG 청크와 WebP 청크

- **PNG**: 8바이트 서명(`89 50 4E 47 0D 0A 1A 0A`) 뒤에 **청크**가 이어진다. 청크는 길이 4바이트, 이름 4글자, 내용, CRC(오류 검출 값) 4바이트다([PNG 명세](https://www.w3.org/TR/png-3/)). 이미지 정보는 `IHDR`, 픽셀은 `IDAT`, 메타데이터는 `eXIf`(EXIF)·`tEXt`(텍스트)·`tIME`(수정 시각) 같은 청크에 있다.
- **WebP**: RIFF 컨테이너다. `RIFF` + 전체 크기 4바이트 + `WEBP` 뒤에 이름 4글자, 크기 4바이트, 내용으로 된 청크가 이어진다([WebP 컨테이너 명세](https://developers.google.com/speed/webp/docs/riff_container)). 메타데이터를 담을 수 있는 확장 형식은 첫 청크가 `VP8X`이고, 그 안의 플래그 비트가 `EXIF`·`XMP ` 청크의 유무를 표시한다.

## 검토한 방법

| 방법                                              | 장점                               | 단점                                                                   |
| ------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 브라우저에서 캔버스로 다시 렌더링해 전송          | 서버 작업이 필요 없다              | 재인코딩으로 화질이 바뀐다. API를 직접 호출하면 원본이 그대로 저장된다 |
| 서버에서 `sharp`로 재인코딩                       | 코드 한 줄, 지원 형식이 많다       | 네이티브 바이너리(수십 MB)가 API 이미지에 포함된다. 화질이 바뀐다      |
| EXIF 전용 라이브러리(piexif 등)                   | EXIF를 정확히 처리한다             | 대부분 JPEG만 지원한다. XMP·PNG·WebP는 별도 처리가 필요하다            |
| 형식 구조를 순회하며 메타데이터만 제거 (**채택**) | 의존성 0개, 이미지 바이트는 그대로 | 형식마다 코드를 직접 작성하고 시험해야 한다                            |

제거 위치는 서버여야 했다. 브라우저에서 제거하면 편집기를 거치지 않고 API를 직접 호출하는 요청은 처리하지 못한다. 서버에서 재인코딩하는 방법은 JPEG를 한 번 더 손실 압축하므로 화질이 떨어지고, 이미지 처리 라이브러리가 API 컨테이너 이미지를 키운다. 세 형식 모두 세그먼트·청크의 나열이라 **메타데이터 단위만 제외하고 이어 붙이면** ==픽셀 데이터는 1바이트도 바뀌지 않는다.== 그래서 마지막 방법을 채택했다. `apps/api/src/files/metadata.ts`는 158줄이다.

## 형식별 제거 규칙

| 형식 | 제거                                           | 유지                                      |
| ---- | ---------------------------------------------- | ----------------------------------------- |
| JPEG | APP1(EXIF·XMP), APP3~13·15, COM(주석)          | APP0(JFIF), APP2(ICC), APP14(Adobe), 픽셀 |
| PNG  | `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`         | `IHDR`, `IDAT`, `iCCP` 등 나머지          |
| WebP | `EXIF`, `XMP ` 청크, VP8X 머리의 EXIF·XMP 깃발 | `VP8X`, `VP8 `/`VP8L`, `ICCP`, `ALPH`     |
| GIF  | (메타데이터 자리가 없다)                       | 전부                                      |

> [!NOTE] ICC 프로필을 유지하는 이유
> ICC 프로필은 "이 사진의 색은 Display P3 기준"처럼 색 공간을 지정하는 정보다. 삭제하면 브라우저가 sRGB로 해석해 채도가 낮아져 표시된다. 개인정보가 아니므로 유지한다.

### JPEG 반복문

JPEG 처리의 핵심은 마커를 하나씩 건너뛰며 유지할 세그먼트만 수집하는 반복문이다. 길이 필드를 읽어 다음 세그먼트 위치(`end`)를 계산하고, 메타데이터 세그먼트는 수집하지 않는다. 픽셀 데이터(SOS)를 만나면 반복을 멈추고 나머지를 그대로 이어 붙인다.

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

실제 코드에는 이미 방향만 남긴 APP1을 식별하는 분기가 하나 더 있다. `data.subarray`는 바이트를 복사하지 않고 원본 버퍼의 구간만 가리키므로, 큰 사진에서도 복사는 마지막에 이어 붙일 때 한 번만 일어난다.

![올린 JPEG의 세그먼트 중 EXIF·XMP·COM을 빼고 방향만 든 36바이트 APP1을 넣은 모습](./images/upload-strip-exif-segments.svg '빨간 조각만 빼고 이어 붙인다')

### PNG와 WebP

PNG는 청크 이름이 제거 목록(`eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`)에 있으면 건너뛴다. 청크마다 자체 CRC가 있으므로 다른 청크를 수정할 필요가 없다. WebP는 `EXIF`·`XMP ` 청크를 건너뛴 뒤 두 가지를 추가로 수정한다. `VP8X` 청크의 플래그에서 EXIF(0x08)·XMP(0x04) 비트를 끄고, 파일 앞 RIFF 머리의 전체 크기를 줄어든 크기로 다시 기록한다. 명세에서 이 플래그는 해당 청크가 파일에 있다는 표시이므로, 청크를 제거하면 플래그도 함께 끈다.

## 방향 하나만 남기기

JPEG의 APP1을 제거하기 전에 TIFF 표에서 Orientation 태그 값을 읽는다. 값이 1(회전 없음)이 아니면 **그 태그 하나만 담은 APP1**(36바이트)을 생성해 SOI 바로 뒤에 삽입한다.

![Orientation 6만 담은 36바이트 APP1 세그먼트의 바이트 배치. FF E1, 길이 00 22, Exif 머리, TIFF 머리 4D 4D 00 2A 00 00 00 08, 엔트리 수 00 01, 엔트리 01 12 00 03 00 00 00 01 00 06 00 00, 다음 표 00 00 00 00](./images/upload-strip-exif-app1-bytes.svg '방향 값 6일 때 새로 만드는 APP1의 실제 바이트')

| 구성                               | 크기         |
| ---------------------------------- | ------------ |
| APP1 마커(2)·길이(2)·`Exif\0\0`(6) | 10바이트     |
| TIFF 머리                          | 8바이트      |
| 엔트리 수                          | 2바이트      |
| Orientation 엔트리                 | 12바이트     |
| "다음 표 없음"                     | 4바이트      |
| **합계**                           | **36바이트** |

TIFF 머리의 `4D 4D`(`MM`)는 여러 바이트로 된 숫자를 큰 자리부터 적는 빅 엔디언 순서를 뜻한다. 원본 사진이 `II`(리틀 엔디언)로 기록되어 있어도 새 세그먼트는 항상 `MM`으로 만든다. 읽는 쪽(`readOrientation`)은 두 순서를 모두 처리한다.

이미 처리한 파일에는 이 36바이트 APP1이 그대로 남아 있고, 같은 파일을 다시 처리해도 결과가 바뀌지 않는다(멱등). PNG와 WebP에는 방향 개념이 없어 메타데이터를 모두 제거한다.

### 손상된 파일은 그대로 저장

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

업로드한 파일을 저장하는 위치는 두 곳이다. 글의 사진(`files/files.service.ts`)과 배경화면(`wallpapers/wallpapers.service.ts`). 두 곳 모두 저장 직전에 이 함수를 거치게 했고, DB에 기록하는 `size`도 원본 크기가 아니라 메타데이터를 제거한 뒤의 크기로 바꿨다. 파일을 응답할 때 `Content-Length` 헤더(응답 본문의 바이트 수)가 이 값이라, 원본 크기를 그대로 기록하면 선언한 길이가 실제 본문보다 커서 응답이 잘린 것으로 처리된다.

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

4×2 픽셀 이미지에 Orientation 6, 기기 이름, GPS 37°33′N 126°58′E, XMP, 주석을 넣은 픽스처(시험용 입력 파일)를 Pillow로 생성해 세 형식으로 저장했다.

| 검증 방법          | 확인 내용                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위 시험          | 처리 후 세그먼트·청크 목록(JPEG `e1 e0 db db c0 c4…`, PNG `IHDR IDAT IEND`, WebP `VP8X VP8 `), RIFF 크기·플래그, "TestCam" 문자열 부재, 이미지 데이터의 바이트 일치 |
| Pillow로 결과 열기 | 픽셀이 같고 EXIF에 `{274: 6}`(Orientation)만 남는지                                                                                                                 |
| E2E                | 사진을 업로드하고 내려받아 기기 이름이 없고 `Content-Length`가 제거 후 크기인지                                                                                     |

`{274: 6}`의 274는 Orientation 태그 번호 0x0112를 10진수로 적은 값이다.

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

실제 휴대폰 사진은 이미지 데이터가 수 MB라 비율로는 거의 줄지 않는다. ==목적은 용량 감소가 아니라 위치 정보 제거다.==

## 남은 과제

- 이 함수는 저장 시각에만 실행된다. 이 작업 이전에 저장된 파일은 별도로 다시 처리하지 않았다.
- 지원 형식은 JPEG·PNG·WebP 세 가지다. 다른 형식을 허용하면 같은 방식(세그먼트·청크 단위)으로 처리를 추가해야 한다.
- 바이트를 직접 다루는 코드는 시험 픽스처를 직접 생성해 두어야 신뢰할 수 있다. 메타데이터를 제거할 때는 "무엇을 유지해야 하는가"를 먼저 정한다. 이번에는 방향과 색 프로필이었다. 둘을 제거하면 사진이 회전되어 표시되거나 색이 달라진다.

## 직접 확인하는 방법

휴대폰으로 촬영한 사진을 업로드한 뒤, 내려받은 파일에 위치 정보가 남았는지 [ExifTool](https://exiftool.org/)로 확인한다.

```bash
exiftool 원본.jpg | grep -iE 'gps|model|orientation'     # 위치·기기·방향
curl -s -o 받은.jpg <올린 그림 주소>
exiftool 받은.jpg | grep -iE 'gps|model|orientation'     # Orientation만 남아야 한다
```

시험은 `pnpm --filter @macfolio/api test -- src/files/metadata.test.ts`와 [apps/api/test/files.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/files.e2e.test.ts)다. 코드는 [apps/api/src/files/metadata.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/files/metadata.ts).

## 관련 글

- [참조 위치 API로 쓰는 곳 없는 서버 파일만 골라 지우기](/memo/server-files-cleanup)
- [입력 검사 규칙을 contracts·서버·desktop-core로 나누는 기준과 if 문 검사의 zod 이전](/memo/contracts-validation#업로드-파일-화면이-알아야-하는-값만-contracts로-205)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)
- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)

PR: [#163](https://github.com/hyeoniverse/MacFolio/pull/163)

<details>
<summary>참고 문헌</summary>

- CIPA, [Exif 3.0 명세 (CIPA DC-008-2023)](https://www.cipa.jp/std/documents/download_e.html?CIPA_DC-008-2023-E)
- ExifTool, [EXIF Tags](https://exiftool.org/TagNames/EXIF.html), [GPS Tags](https://exiftool.org/TagNames/GPS.html)
- MDN, [image-orientation](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation)
- ITU-T T.81, [JPEG 명세 (Annex B: Compressed data formats)](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)
- W3C, [Portable Network Graphics (PNG) Specification (Third Edition)](https://www.w3.org/TR/png-3/)
- Google, [WebP Container Specification](https://developers.google.com/speed/webp/docs/riff_container)
- MDN, [Content-Length](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length)
- MDN, [TypedArray.prototype.subarray()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray)

</details>

<details>
<summary>사진 출처</summary>

- EXIF 보기 프로그램의 GPS 태그 화면: Emilio Gómez Fernández, Wikimedia Commons, [EXIF Reveal - GPS Info.png](https://commons.wikimedia.org/wiki/File:EXIF_Reveal_-_GPS_Info.png), CC BY-SA 3.0
- JPEG 비트스트림 구조도: Artem2301, Wikimedia Commons, [Structure jpeg bitstream.jpg](https://commons.wikimedia.org/wiki/File:Structure_jpeg_bitstream.jpg), CC BY-SA 4.0

</details>

#MacFolio #보안 #API #이미지 #EXIF

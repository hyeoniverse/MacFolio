---
title: 숫자 40이 세 곳에 — 배경화면 도메인 옮기기
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 배경화면 이름 한도 40자가 DB CHECK 제약, 서버 rules.ts, 화면 WallpaperGroup.tsx에 따로 적혀 있었다. 다듬기 함수·한도·이름 바꾸기 몸통·목록 모양을 contracts로 옮겼다. 올리기는 multipart라 스키마 없이 같은 다듬기 함수만 거친다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 다섯째 PR([#204](https://github.com/hyeoniverse/MacFolio/pull/204))이다. [댓글](/memo/contracts-comments)·[글](/memo/contracts-posts)·[메시지](/memo/contracts-messages)·[연락 메일](/memo/contracts-contact)에 이어 배경화면이다. 작은 도메인이라 금방 끝났지만, 작아서 보이는 것이 있었다.

## 배경: 관리자가 더하는 배경화면

시스템 설정 › 배경화면에는 macOS 기본 배경화면 묶음이 있다. 관리자로 로그인하면 그 아래에 직접 올린 사진 묶음이 하나 더 생긴다. 사진을 고르면 브라우저가 썸네일을 만들고, 원본과 썸네일 두 장과 이름을 서버로 보낸다. 올린 뒤에는 이름을 바꾸거나 지울 수 있다. 이 글은 [직접 올리는 배경화면](/memo/custom-wallpapers)을 만든 뒤, 그 요청·응답의 규칙을 contracts로 모은 기록이다.

![시스템 설정 › 배경화면. 방문자에게는 macOS 묶음만 보이고, 관리자에게는 직접 올린 묶음이 더 보인다](./images/contracts-wallpapers-settings-pane.jpg '방문자가 보는 배경화면 설정. 관리자 묶음은 로그인해야 보인다')

## 40이 세 번

관리자가 더한 배경화면의 이름은 40자까지다. 이 숫자가 세 곳에 있었다.

- DB: `CHECK (char_length(name) <= 40)`
- 서버 `wallpapers/rules.ts`: `NAME_MAX = 40`과 `cleanWallpaperName` (확장자·제어 문자를 빼고 40자까지)
- 화면 `WallpaperGroup.tsx`: `const NAME_MAX = 40` 위에 주석 "이름 칸과 같은 한도 (API의 NAME_MAX)"

주석이 "같다"고 말할 뿐 아무것도 그것을 지키지 않았다. 서버가 50으로 올리면 화면 이름 칸은 40에서 더 못 친다. 반대로 화면이 올리면 서버가 자르는데 사용자는 모른다.

![전: DB·서버·화면에 40이 각각. 후: contracts/wallpapers.ts의 WALLPAPER_NAME_MAX와 cleanWallpaperName을 서버와 화면이 쓴다](./images/contracts-wallpapers-name.svg)

## 고른 방법

| 방법                                          | 좋은 점                        | 나쁜 점                                                         |
| --------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| 주석을 더 자세히 쓴다                         | 바꿀 코드가 없다               | 지금 문제(아무것도 지키지 않는다)가 그대로다                    |
| 화면이 서버 `GET /wallpapers`에서 한도를 받음 | 한 곳(서버)이 정한다           | 이름 칸 하나 그리려고 요청이 하나 더 는다. 서버가 꺼지면 모른다 |
| contracts에 한도·다듬기·모양을 둔다           | 빌드 때 같은 값. 시험으로 고정 | 패키지 한 번 거친다 (앞 네 도메인에서 이미 쓰는 길)             |

셋째를 골랐다. 한도는 바뀌지 않는 상수라 실행 중에 물어볼 이유가 없다.

## 옮긴 것

```ts
// packages/contracts/src/wallpapers.ts
export const WALLPAPER_NAME_MAX = 40;
export function cleanWallpaperName(name: unknown): string | null {
	/* 확장자·제어 문자 제거, 40자 */
}

export const WallpaperRename = requestBody({
	name: z.preprocess(cleanWallpaperName, z.string({ error: '이름을 입력해 주세요.' })),
});
export const Wallpaper = z.object({ id, name, image, thumbnail, createdAt });
```

다듬기 함수는 서버에 있던 것을 그대로 옮겼다. 순서가 중요하다.

```ts
export function cleanWallpaperName(name: unknown): string | null {
	if (typeof name !== 'string') return null;
	const cleaned = name
		.replace(/[\u0000-\u001f\u007f]/g, '') // 제어 문자
		.trim()
		.replace(/\.(jpe?g|png|gif|webp|heic)$/i, '') // "제주 바다.JPG" → "제주 바다"
		.trim();
	return cleaned ? Array.from(cleaned).slice(0, WALLPAPER_NAME_MAX).join('') : null;
}
```

확장자를 빼고 다시 `trim`하는 것은 "사진 .jpg"처럼 확장자 앞에 공백이 있는 이름 때문이다. 40자로 자를 때 `slice`가 아니라 `Array.from`을 쓰는 것은 이모지 같은 글자를 반으로 자르지 않기 위해서다. 문자열의 `slice`는 UTF-16 단위로 잘라서, 40번째 자리에 이모지가 걸리면 깨진 글자가 남는다. DB의 `char_length`도 코드 포인트로 세므로 이쪽과 맞는다.

`WallpaperRename`은 전처리에서 이름을 다듬고, 다듬은 결과가 `null`(빈 이름)이면 `z.string()`이 거절한다. 거절 문구는 서버가 원래 내던 "이름을 입력해 주세요."다. 서버 `rules.ts`와 그 시험은 지우고 contracts로 옮겼다. 화면은 `const NAME_MAX = 40` 대신 `WALLPAPER_NAME_MAX`를 가져온다.

## 구현

서버는 세 곳을 바꿨다.

```ts
// apps/api/src/wallpapers/wallpapers.service.ts
-	async rename(id: string, name: unknown): Promise<WallpaperView> {
-		const cleaned = cleanWallpaperName(name);
-		if (!cleaned) throw new BadRequestException('이름을 입력해 주세요.');
+	async rename(id: string, input: unknown): Promise<WallpaperView> {
+		const parsed = parse(WallpaperRename, input);
+		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
+		const cleaned = parsed.value.name;
```

컨트롤러도 `@Body() body: { name?: unknown }`에서 `body?.name`을 꺼내 넘기던 것을 몸통 전체(`unknown`)를 넘기게 바꿨다. 몸통이 객체가 아닐 때의 처리는 `requestBody`가 맡는다. `WallpaperView` 인터페이스는 contracts `Wallpaper`의 별칭이 됐다.

화면은 두 파일이다. `WallpaperGroup.tsx`의 이름 칸은 `maxLength={WALLPAPER_NAME_MAX}`가 됐고, `shared/settings/customWallpapers.ts`의 `ServerWallpaper` 인터페이스(5줄)는 contracts `Wallpaper`를 가져다 쓴다. 옮기고 보니 화면 쪽 인터페이스에는 `createdAt`이 빠져 있었다. 서버는 늘 보내는데 화면이 몰랐을 뿐이라 동작에는 영향이 없었다.

## 올리기는 스키마가 없다

배경화면 올리기는 JSON이 아니다. 이미지 두 장(원본·썸네일)과 이름이 `FormData`로 오고, 이미지는 확장자가 아니라 매직 바이트로 본다. zod 스키마로 적을 몸통이 없다. 이름만 같은 `cleanWallpaperName`을 거친다. "모든 요청을 스키마로"가 목표가 아니라 "같은 규칙은 한 곳에"가 목표라서, 여기서는 함수 하나를 공유하는 것으로 충분하다.

DB의 CHECK 제약은 그대로 뒀다. 코드가 틀려도 마지막에 막는 줄이고, 그 숫자는 마이그레이션에 박혀 있어 contracts가 가져다 쓸 수 없다. 대신 contracts 시험이 "50자를 넣으면 40자"를 고정하고, API e2e가 그 값으로 저장되는 것을 본다.

## 확인

- `packages/contracts/src/wallpapers.test.ts`에 세 시험을 썼다. "확장자·제어 문자를 빼고 40자까지, 비면 null"(서버 시험을 그대로 옮김: `'  제주 바다.JPG '` → `'제주 바다'`, `'가'.repeat(50)` → 40자, 숫자 `3` → null), "이름 바꾸기 몸통: 다듬은 이름이 비면 이유를 알린다", "목록 항목의 모양".
- 서버 `apps/api/src/wallpapers/rules.ts`(15줄)와 `rules.test.ts`(12줄)는 지웠다.
- E2E `apps/react/e2e/wallpapers.spec.ts`의 6개가 그대로 통과했다.
- 커밋은 파일 11개, +179/−51. 글·그림을 빼면 +82/−51로, 여덟 도메인 가운데 가장 작다.

## 결과

| 항목                                        | 전            | 후                    |
| ------------------------------------------- | ------------- | --------------------- |
| 코드에 적힌 40                              | 2 (서버·화면) | 1                     |
| 서버 `wallpapers/rules.ts`                  | 함수 + 시험   | 없음 (contracts로)    |
| 서버 `WallpaperView`·화면 `ServerWallpaper` | 각자          | contracts `Wallpaper` |
| 동작 변화                                   |               | 없음 (e2e 6개 그대로) |

## 남은 것과 배운 것

하나 남은 어긋남이 있다. 화면 이름 칸의 `maxLength`는 브라우저가 UTF-16 단위로 센다. 서버와 DB는 코드 포인트로 센다. 이모지가 섞인 이름은 화면이 먼저 막아서, 서버는 40자를 받을 수 있는데 화면에서는 그보다 짧게만 칠 수 있다. 덜 받는 쪽으로 어긋나 있어 해롭지는 않지만, 같은 숫자가 같은 뜻은 아니라는 점은 적어 둔다.

[올린 파일 도메인](/memo/contracts-files)에서 쓴 "올리기는 multipart라 스키마가 없다"는 판단을 여기서 먼저 했다. 모든 것을 zod로 바꾸는 것보다 "같은 규칙이 한 곳에 있는가"를 보는 편이 범위를 정하기 쉬웠다. 작은 도메인을 먼저 하면 이런 판단 기준을 싸게 얻는다.

이 PR 뒤에 [배경화면 동영상](/memo/video-wallpaper)이 들어오면서 `Wallpaper`에 `video` 필드가 더해졌고, `cleanWallpaperName`은 `.mp4`도 뺀다. 시험 "동영상 배경화면은 video: true, 이름에서 .mp4를 뺀다"가 그때 같은 파일에 들어왔다.

다음은 [파일](/memo/contracts-files)·[분석](/memo/contracts-analytics) 순으로 같은 방식.

#MacFolio #리팩터링 #zod #TypeScript

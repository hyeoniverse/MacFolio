---
title: 화면도 알아야 하는가 — 올린 파일 규칙을 둘로 나누기
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 서버 files/rules.ts에 섞여 있던 규칙을 "화면도 알아야 하는가"로 나눴다. 10MB 한도·주소 모양·이미지 형식·응답 모양은 contracts로 옮기고, 매직 바이트·EXIF·파일 이름 다듬기는 서버에 남겼다. 같은 숫자가 두 번 적히던 곳 세 군데가 한 곳이 됐다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 여섯째 PR([#205](https://github.com/hyeoniverse/MacFolio/pull/205))이다. [댓글](/memo/contracts-comments)·[글](/memo/contracts-posts)·[메시지](/memo/contracts-messages)·[연락 메일](/memo/contracts-contact)·[배경화면](/memo/contracts-wallpapers)에 이어 올린 파일(`/files`)을 옮겼다. 이번 도메인은 "무엇을 옮길까"보다 "무엇을 옮기지 않을까"가 더 중요했다.

## 배경: 같은 숫자가 두 군데에 있었다

`@macfolio/contracts`는 API 요청·응답의 모양을 zod 스키마로 적어 두는 패키지다. 서버(NestJS)는 이 스키마로 들어오는 몸통을 검사하고, 화면(React)은 같은 스키마에서 타입을 뽑아 쓴다. 앞의 다섯 도메인은 대부분 "요청 몸통 검사"가 중심이었다.

올린 파일은 사정이 다르다. 올리기는 `multipart/form-data`라 zod로 검사할 JSON 몸통이 없다. 대신 서버와 화면이 각자 적어 둔 상수가 있었다. 관리자 글 편집기에서 11MB짜리 사진을 고르면, 화면은 `attachments.ts`의 `10 * 1024 * 1024`를 보고 올리기 전에 막는다. 화면 검사를 지나도 서버는 `rules.ts`의 같은 숫자로 다시 막고 413을 돌려준다. DB에도 `size BETWEEN 1 AND 10485760` CHECK 제약이 있다. 숫자 하나가 세 곳에 적혀 있었고, 그중 코드 두 곳은 서로를 모른 채 같은 값을 유지하고 있었다.

지금은 맞지만, 한도를 20MB로 올리는 날 화면만 고치면 화면은 15MB 파일을 통과시키고 서버는 413을 낸다. 반대로 서버만 고치면 서버는 받을 수 있는데 화면이 먼저 막는다. 어느 쪽이든 증상은 "올라가야 할 파일이 안 올라간다"인데, 원인을 찾으려면 두 저장소 위치를 뒤져야 한다.

## 한 파일에 두 종류가 있었다

서버 `files/rules.ts`에는 이런 것이 있었다.

- `MAX_UPLOAD_BYTES = 10MB`, `UPLOAD_ID = /^[\w-]{16}$/`, `IMAGE_TYPES`, `uploadIdsIn(markdown)`
- `sniffImage(bytes)`, `cleanFileName`, `cleanFileType`, `contentDisposition`, `newUploadId()`

앞 줄은 화면도 안다. 편집기는 올리기 전에 10MB를 보고(`attachments.ts`에 같은 숫자가 또 있었다), 이미지 고르기 창은 `accept="image/png,image/jpeg,…"`를 글자로 적어 두었고, 휴지통의 서버 파일 목록은 응답 모양 `ServerFile`을 손으로 적었다. 뒷줄은 화면이 몰라도 된다. 파일 내용을 읽고(매직 바이트), Node의 `crypto`를 쓰고, HTTP 머리말을 만든다.

![왼쪽 contracts/files.ts: 한도·주소·이미지 형식·uploadIdsIn·응답 모양. 오른쪽 api/files/rules.ts: sniffImage·cleanFileName·contentDisposition·newUploadId. 아래 서버와 화면이 왼쪽을 쓴다](./images/contracts-files-split.svg)

## 기준을 고르기

나누는 방법은 몇 가지가 있었다.

| 방법                                 | 좋은 점                        | 나쁜 점                                                                  |
| ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------ |
| `rules.ts`를 통째로 contracts로      | 한 번에 끝난다                 | `node:crypto`·`Buffer`가 따라와 브라우저 번들이 깨진다                   |
| 화면이 서버 파일을 직접 import       | 새 파일이 없다                 | React가 `apps/api`에 기대게 된다. 서버 의존성(Nest·Prisma)이 번들로 샌다 |
| "화면도 알아야 하는가"로 나눠 앞쪽만 | contracts가 순수 값으로 남는다 | 서버 `rules.ts`가 다시 내보내기를 해야 한다                              |

세 번째를 골랐다. contracts에 넣는 기준을 "서버와 화면이 같이 쓰는 값·모양"으로 잡고, 앞 줄만 옮겼다.

```ts
// packages/contracts/src/files.ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ID = /^[\w-]{16}$/;
export const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export function uploadIdsIn(text: string | null | undefined): string[] {
	/* /files/<16자> */
}

export const Upload = z.object({ id, name, type, size, image, path });
export const UploadUsage = Upload.extend({ createdAt, createdBy, usedBy: { posts, revisions, wallpaper } });
```

전부 순수한 값과 정규식이다. 브라우저에서도 그대로 돈다. `sniffImage`나 `newUploadId`는 옮기지 않았다. 화면이 쓸 일이 없고, Node API에 기대는 것을 contracts에 넣으면 패키지가 브라우저에서 못 돌게 된다.

`IMAGE_TYPES`를 `readonly string[]`로 적은 데도 이유가 있다. `as const`로 두면 `includes(file.type)`처럼 아무 문자열을 넣어 묻는 곳에서 타입이 안 맞는다. 서버는 `sniffImage`가 돌려준 값을 이 배열에 묻고, 화면은 `join(',')`만 하니 넓은 타입이 쓰기 편했다.

`uploadIdsIn`은 정규식 하나지만 화면과 서버가 같은 답을 내야 하는 함수다. 서버는 글을 저장할 때 본문이 가리키는 파일을 찾아 "쓰는 곳" 목록을 만들고, 화면의 휴지통은 저장소 Markdown 글이 가리키는 파일을 같은 방법으로 찾아 "지워도 되는 파일"을 가린다. 둘이 다르게 세면 쓰는 파일을 지워도 된다고 보여 줄 수 있다.

## 서버 쪽은 다시 내보내기

서버 `rules.ts`는 옮긴 네 개를 contracts에서 다시 내보낸다. `files.service.ts`·`wallpapers.service.ts`·컨트롤러의 import는 한 글자도 안 바뀌었다. 시험도 `uploadIdsIn`의 경우만 contracts로 옮기고 나머지는 그대로다.

```ts
// apps/api/src/files/rules.ts (후)
import { randomBytes } from 'node:crypto';
export { IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ID, uploadIdsIn } from '@macfolio/contracts';

export const newUploadId = () => randomBytes(12).toString('base64url');
export function sniffImage(data: Uint8Array): string | null {
	if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	// jpeg ff d8 ff, gif 'GIF8', webp 'RIFF'…'WEBP'
}
```

`sniffImage`가 서버에 남아야 하는 이유는 하나 더 있다. 브라우저가 보내는 `type`은 사용자가 확장자만 바꿔도 바뀐다. 서버는 이름을 믿지 않고 파일 앞 몇 바이트로 형식을 정해 `type`에 적는다. SVG는 스크립트를 담을 수 있어서 일부러 이미지로 보지 않는다. 이 판단은 화면에 둘 이유가 없다.

`files.service.ts`에 있던 `UploadView`·`UploadUsageView` 인터페이스 두 개(23줄)는 contracts 타입의 별칭 두 줄이 됐다.

```ts
// 전: 서버와 화면이 같은 모양을 각자 적었다
export interface UploadUsageView extends UploadView { createdAt: string; createdBy: string; usedBy: {…} }
// 후
export type UploadView = Upload;
export type UploadUsageView = UploadUsage;
```

![contracts/files.ts 하나를 서버 세 곳과 화면 네 곳이 가져다 쓴다](./images/contracts-files-users.svg '같은 파일을 서버와 화면이 함께 읽는다')

화면은 세 곳이 바뀌었다. `attachments.ts`의 `10 * 1024 * 1024`가 contracts 값이 됐고, `ImagePanel.tsx`의 accept 문자열은 `IMAGE_TYPES.join(',')`, 휴지통 `filesApi.ts`의 `ServerFile` 인터페이스는 `UploadUsage`의 별칭이 됐다. 글 편집기가 올린 파일 응답을 읽는 `as Omit<Uploaded, 'url'> & { path: string }`도 `as Upload`로 짧아졌다.

## 결과

| 항목             | 전                        | 후                         |
| ---------------- | ------------------------- | -------------------------- |
| 코드에 적힌 10MB | 2 (서버·화면)             | 1                          |
| 이미지 형식 목록 | 2 (서버 배열·화면 문자열) | 1                          |
| 파일 응답 모양   | 2 (서버·화면)             | 1                          |
| 서버 `rules.ts`  | 9개                       | 5개 (서버만 하는 것)       |
| 동작 변화        |                           | 없음 (e2e 파일 8개 그대로) |
| 변경 크기        |                           | 파일 12개, +212 / −75      |

## 확인

- 단위 시험: `packages/contracts/src/files.test.ts`에 세 개를 새로 썼다. "한도는 10MB, 주소는 16자", "글에서 가리키는 파일 id를 찾는다 (전체 주소든 경로든, 같은 id는 한 번)", "응답 모양: 올린 파일과 쓰는 곳". 마지막 시험은 응답에 `data` 같은 모르는 필드가 섞여 와도 `parse`가 버리는지 본다. 서버 `rules.test.ts`에서는 옮긴 `uploadIdsIn` 경우를 지웠고(18줄을 지웠다), `sniffImage`·`contentDisposition` 시험은 그대로 두었다.
- 타입 검사: 서버·화면 둘 다 import 경로만 바뀌고 쓰는 쪽 코드는 그대로라, `tsc`가 지나가면 모양이 같다는 뜻이다.
- E2E: 동작을 바꾸지 않는 PR이라 새 E2E는 없다. 파일 올리기·휴지통·배경화면을 거치는 기존 E2E 8개가 그대로 통과했다.
- 바뀐 크기: 커밋 전체는 12개 파일, 212줄 더하고 75줄 뺐다. 이 중 글과 그림을 빼면 코드는 +108/−75다.

## 남은 것과 배운 것

이 PR 뒤에 [배경화면 동영상](/memo/video-wallpaper)을 넣으면서 `VIDEO_TYPES`와 `MAX_WALLPAPER_VIDEO_BYTES`(30MB)가 같은 파일에 더해졌다. 기준이 잡혀 있어서 고민 없이 contracts에 들어갔고, MP4의 `ftyp` 상자를 읽는 `sniffVideo`는 서버 `rules.ts`에 들어갔다. 기준을 한 번 글로 적어 두니 다음 결정이 빨랐다.

DB CHECK 제약의 `10485760`은 아직 SQL 이주 파일에 따로 있다. 이주 파일은 한 번 적용하면 고치지 않는 기록이라 contracts에서 읽어 올 수 없다. 한도를 바꾸는 날에는 새 이주를 쓰고 contracts 값을 같이 고쳐야 한다. 이것은 시험으로 묶지 못했다.

배운 것은 "공유 패키지에는 어디서나 도는 것만 넣는다"는 규칙의 값이다. Node API 하나가 섞이면 그 패키지를 쓰는 화면 번들 전체가 깨진다. 무엇을 옮길지보다 무엇을 남길지를 먼저 적으면 경계가 깔끔하다.

다음은 [분석(analytics)](/memo/contracts-analytics)과 [사이트 프로필](/memo/contracts-site). 그러면 손으로 적은 응답 타입이 없어진다.

## 따라 해 보기

계약을 바꿀 때는 `packages/contracts`를 먼저 고치고, 서버와 화면이 둘 다 따라오는지 본다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test -- src/files/rules.test.ts
```

필드 이름을 하나 바꿔 보면 `pnpm typecheck`가 서버와 화면에서 같이 깨진다. 이게 이 작업으로 얻은 것이다. 확인한 뒤 되돌린다. 스키마는 [Zod](https://zod.dev/)로 쓰고, 패키지를 나눈 까닭은 [댓글 계약](/memo/contracts-comments)에 있다.

#MacFolio #리팩터링 #zod #TypeScript

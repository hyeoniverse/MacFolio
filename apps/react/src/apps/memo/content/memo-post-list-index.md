---
title: 빌드 시각에 만든 목록용 색인과 글별 청크로 원문 묶음보다 먼저 메모 목록 그리기
date: 2026-10-31
category: 개발 기록/MacFolio/테스트·보안·성능
series: 성능 최적화
seriesOrder: 6
summary: 배포 사이트에서 메모 목록이 늦게 표시되었다. 목록 하나를 그리려고 글 247편의 원문 3.76MB를 받고 있었다. 빌드 시각에 목록용 색인을 만들고, 연 글의 원문만 글별 청크로 받고, 전체 원문은 뒤에서 받도록 바꿔 목록 표시를 4.6초에서 2.3초로 줄였다.
---

배포 사이트에서 메모 앱을 열면 창은 바로 뜨지만 목록이 비어 있는 시간이 길었다. 원인은 목록을 그리기 전에 글 247편의 원문을 담은 청크(`contentFiles`)를 모두 받는 구조였다. 이 글은 원문 없이 목록을 그리는 색인을 빌드 시각에 만들고, 본문은 연 글만 받도록 바꾼 과정을 정리한다.

## 측정: 네트워크가 느릴수록 목록이 늦다

Playwright로 배포 사이트를 열고, Chrome DevTools Protocol의 `Emulation.setCPUThrottlingRate`와 `Network.emulateNetworkConditions`로 CPU와 네트워크를 제한했다. 측정값은 Dock에서 메모를 누른 시각부터의 경과 시간이다.

| 조건                                          | 창 표시 | 목록 표시 |
| --------------------------------------------- | ------: | --------: |
| 제한 없음                                     |   0.3초 |     0.5초 |
| CPU만 4배 느리게                              |   1.3초 |     1.3초 |
| 네트워크만 10Mbps, 지연 100ms                 |   0.8초 |     3.1초 |
| CPU 6배, 5Mbps, 지연 150ms (중급 휴대폰 가정) |   2.9초 |     8.3초 |

CPU만 제한하면 창과 목록이 같은 시각에 표시되고, 네트워크를 제한하면 창이 뜬 뒤 목록까지 2초 넘게 걸린다. 병목은 처리량이 아니라 전송량이다. API 응답(`/posts`, `/memo/organization`)은 0.2~0.4초로 원인이 아니었다.

## 원인: 목록이 원문 묶음을 기다린다

[성능 최적화 2편](/memo/site-performance-diet)에서 글 원문을 첫 방문 번들에서 빼고, 메모 앱이 목록을 처음 조회하는 시각에 동적 `import()`로 받도록 바꿨다. 첫 화면은 빨라졌지만 메모를 여는 시각에는 여전히 원문 전체가 필요했다. 그사이 글이 199편에서 247편으로 늘어 원문은 2.4MB에서 3.76MB(brotli 압축 805KB, 배포 사이트의 Cloudflare 압축으로는 1.1MB)가 되었다.

목록 화면이 본문을 쓰는 곳은 네 군데다.

| 쓰는 곳                                                     | 본문에서 읽는 것                             |
| ----------------------------------------------------------- | -------------------------------------------- |
| 목록의 미리보기 그림                                        | 첫 번째 그림 주소 (`firstImage`)             |
| 사이드바의 태그 목록, 태그 필터                             | 본문의 `#태그` (`tagsOf`)                    |
| 검색 조건 (체크리스트·표·이미지·코드·첨부 파일이 있는 메모) | 해당 Markdown 문법이 있는지 (`POST_FILTERS`) |
| 본문 검색                                                   | 본문 전체                                    |

요약(`summary`)은 머리말에 있거나 본문 앞부분으로 만들기 때문에, 목록이 원문 전체를 필요로 하는 곳은 본문 검색뿐이다.

## 개선: 색인, 글별 청크, 뒤에서 받는 원문

![개선 전후의 요청 순서](./images/memo-post-list-index-waterfall.svg '개선 전에는 Memo 청크와 contentFiles를 차례로 받은 뒤 목록을 그렸다. 개선 후에는 Memo 청크에 들어 있는 색인으로 목록을 그리고, 연 글의 청크(약 10KB)로 본문을 그린다. 전체 원문은 뒤에서 받는다')

### 1. 빌드 시각에 만드는 목록용 색인

Vite 플러그인의 가상 모듈(virtual module)로 `virtual:post-list`를 만든다. 가상 모듈은 디스크에 파일이 없고, 플러그인의 `load` 훅이 돌려주는 코드가 모듈 내용이 된다. 빌드 시각에 모든 글을 읽어 정렬한 `Post` 배열을 JSON으로 내보낸다. 위젯용 최근 글(`virtual:recent-posts`)을 만드는 플러그인에 같은 방식으로 더했다.

```ts
// apps/react/seo/posts.ts
export async function listPosts(files: Record<string, string>, created: Record<string, string> = {}): Promise<Post[]> {
	return (await createStaticPostRepository(files, undefined, created).list()).map(toListingPost);
}
```

색인의 `body`에는 원문 대신 목록이 읽는 줄만 남긴다. 함수를 바꾸지 않고 같은 답을 내게 하려는 설계다. `firstImage`, `tagsOf`, `POST_FILTERS`는 그대로 두고, 입력만 짧아진다.

```ts
// packages/desktop-core/src/memo/listing.ts
export function listBody(body: string): string {
	const parts: string[] = [];
	const image = firstImage(body);
	if (image) parts.push(`![](${image})`);
	const checklist = /^\s*[-*+] \[[ xX]\]/m.exec(body);
	if (checklist) parts.push(`${checklist[0].trim()} .`);
	// 표 구분 줄, 코드 블록, 첨부 파일 링크도 같은 방식
	const tags = tagsOf(body);
	if (tags.length) parts.push(tags.map((tag) => `#${tag}`).join(' '));
	return parts.join('\n\n');
}

export const toListingPost = (post: Post): Post => ({ ...post, body: listBody(post.body), bodyPending: true });
```

예를 들어 표, 코드, 그림 두 장, 태그 세 개가 있는 글의 색인 본문은 다음과 같다.

````markdown
![](./images/first.jpg)

| --- | ---: |

```

```

#React #상태관리
````

`bodyPending: true`는 이 글의 `body`가 원문이 아니라는 표시다. 단위 시험(`listing.test.ts`)은 같은 글의 원문과 색인 본문에 대해 `firstImage`, `tagsOf`, 다섯 가지 검색 조건이 같은 값을 돌려주는지 확인한다. 색인은 메모 앱 청크에 들어가며, 청크는 압축 전 1,410KB에서 1,642KB로, brotli 압축으로는 224KB에서 269KB로 커졌다. 원문 묶음 805KB를 기다리지 않는 대신 45KB를 더 받는다.

### 2. 연 글만 받는 글별 청크

본문을 그리려면 연 글의 원문이 필요하다. [`import.meta.glob`](https://vite.dev/guide/features.html#glob-import)을 `eager` 없이 쓰면 파일마다 동적 `import()` 함수가 생기고, 번들러는 파일마다 청크를 만든다.

```ts
// apps/react/src/apps/memo/repository/postBody.ts
const sources = import.meta.glob<string>('../content/*.md', { query: '?raw&single', import: 'default' });

export async function loadPostBody(slug: PostSlug): Promise<string | null> {
	const load = sources[`../content/${slug}.md`];
	return load ? (toPost(slug, await load())?.body ?? null) : null;
}
```

쿼리를 `?raw`가 아니라 `?raw&single`로 쓴 이유는 모듈 ID를 나누기 위해서다. 전체 원문 묶음(`contentFiles.ts`)도 같은 파일을 `?raw`로 정적으로 가져온다. 모듈 ID가 같으면 Rollup은 그 모듈을 이미 있는 `contentFiles` 청크에 두고, 동적 `import()`는 그 큰 청크를 가리킨다. 쿼리가 다르면 다른 모듈이 되어 글마다 청크가 생긴다. Vite의 `?raw` 처리는 쿼리에 `raw`가 있는지만 보므로 `&single`을 붙여도 원문 문자열을 돌려준다. 빌드 결과 JS 파일은 325개에서 572개로 늘었고, Flux 글의 청크는 33KB(brotli 10KB)다.

메모 앱은 연 글이 `bodyPending`이면 이 함수로 원문을 받아 그 글만 바꾼다.

```ts
// Memo.tsx
const pendingSlug = selected?.bodyPending ? selected.slug : null;
useEffect(() => {
	if (pendingSlug) loadBody(pendingSlug);
}, [pendingSlug, loadBody]);
```

원문을 받는 동안 읽기 화면은 제목·날짜·목차 자리는 그리고 본문 칸만 비워 둔다. 색인 본문을 Markdown으로 그리면 그림 한 장과 태그 줄이 잠깐 보였다가 바뀌기 때문이다.

### 3. 전체 원문은 뒤에서 받는다

본문 검색과 관리자 편집에는 모든 글의 원문이 필요하다. 메모 앱이 마운트되면 바로 `contentFiles`를 요청하고, 받으면 색인을 원문 글로 바꾼다. 색인이 화면에 있는 동안 본문 검색은 제목·요약·태그로만 찾는다.

예전에는 `useMemoLibrary.ts`가 `contentFiles`를 정적으로 import해 메모 앱 청크의 의존성으로 만들었다. 이 import를 지우고 목록을 그린 뒤 동적 `import()`로 받는다.

## 원문을 받기 전의 글을 다루는 규칙

색인 본문은 원문의 일부만 담으므로, 원문으로 착각하면 글이 손상된다. 세 곳에 규칙을 두었다.

- **편집기:** 관리자 화면에서 `bodyPending`인 글은 편집기(`PostWriter`)에 열지 않는다. 열면 편집기가 색인 본문을 초안으로 읽고, 고친 내용과 함께 서버에 저장할 수 있다. 원문이 오면 편집기를 연다.
- **스크롤 위치 복원:** 뒤로·앞으로 기록으로 돌아온 글은 떠날 시각의 스크롤 위치에서 시작한다([메모 기록](/memo/memo-history-nav)). 본문이 비어 있으면 그 위치로 스크롤할 수 없으므로, 원문이 온 뒤에 위치를 맞춘다.
- **로딩 상태 제거:** 목록이 원문을 기다리는 동안 쓰던 `status`(`loading`·`ready`·`error`)와 "불러오는 중…" 표시를 지웠다. 색인이 앱과 함께 오므로 목록은 처음부터 그려진다. 주소 막대 갱신과 기록 정리가 기다리던 `ready` 값도 함께 지웠다.

## 시행착오: 첫 방문 번들이 4.5KB 늘었다

처음에는 `loadPostBody`를 글 저장소 모듈(`repository/index.ts`)에 두었다. CI의 성능 예산 검사(`pnpm perf:budget`)가 첫 방문 번들 267.8KB로 상한 265KB를 넘었다고 실패했다. 글 저장소는 Finder의 블로그 폴더도 쓰기 때문에 첫 화면 묶음에 들어 있고, 247편의 `import()` 함수 목록이 함께 들어갔다. 이 함수를 메모 앱만 import하는 `postBody.ts`로 옮겨 263.2KB로 되돌렸다.

## 결과

배포와 같은 조건을 만들려고 main과 이 브랜치를 각각 빌드하고, 모든 JS·CSS를 brotli로 미리 압축해 내주는 정적 서버로 측정했다. 조건마다 3회 측정한 중앙값이다.

| 조건                                                               | 개선 전 목록 / 본문 | 개선 후 목록 / 본문 |
| ------------------------------------------------------------------ | ------------------: | ------------------: |
| CPU 6배, 5Mbps, 지연 150ms, Dock에서 열기                          |     4.64초 / 4.70초 |     2.30초 / 2.35초 |
| 네트워크만 10Mbps, 지연 100ms, Dock에서 열기                       |     2.32초 / 2.32초 |     0.81초 / 0.92초 |
| CPU 6배, 5Mbps, 지연 150ms, 글 주소(`/memo/flux-pattern`)로 들어옴 |     2.66초 / 2.72초 |     0.08초 / 0.12초 |

글 주소로 들어오면 로딩 화면을 보는 동안 메모 앱 청크와 그 글의 청크를 받으므로, 로딩 화면이 걷힌 시각에 목록과 본문이 이미 그려져 있다. 로컬 서버는 배포 사이트보다 응답이 빨라 개선 전 수치(4.6초)가 배포 사이트 측정값(8.3초)보다 작다.

## 남은 것

- 색인은 글이 늘수록 커진다. 지금은 247편에 45KB(brotli)다. 글이 지금의 두 배를 넘으면 요약을 줄이거나, 폴더별로 색인을 나누는 방법을 검토한다.
- 본문 검색은 원문 묶음이 오기 전까지 제목·요약·태그만 찾는다. 중급 휴대폰 조건에서 약 2초 동안이다.

## 관련 글

- [글꼴 subset·lazy import·modulepreload·WebP로 첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet): 글 원문을 첫 방문 번들에서 뺀 이전 단계
- [#boot-splash 삭제 시각을 늦춰 휴대폰 LCP 후보를 지키고 CI 성능 예산 걸기](/memo/site-performance-lcp-budget): 이번에 첫 방문 번들 증가를 잡아낸 성능 예산
- [git 첫 커밋 시각을 Vite 가상 모듈로 넣어 같은 날 글 정렬하기](/memo/memo-same-day-order): 색인과 같은 방식의 가상 모듈
- [브라우저 history 대신 sessionStorage에 쌓는 앱 내부 뒤로·앞으로 기록](/memo/memo-history-nav): 원문이 온 뒤로 미룬 스크롤 위치 복원

#MacFolio #성능 #Vite #번들 #메모앱

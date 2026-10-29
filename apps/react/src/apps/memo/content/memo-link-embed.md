---
title: 주소에서 ID를 뽑아 만든 iframe 임베드와 ProseMirror 위젯 장식으로 그리는 바깥 링크 미리 보기
date: 2026-10-30
category: 개발 기록/MacFolio/프론트엔드
summary: 메모 글에 YouTube·Vimeo·CodePen 등의 주소만 한 줄로 적으면 iframe 임베드로 그리게 했다. 원래 주소 대신 주소에서 뽑은 ID로 임베드 주소를 새로 만들고, 같은 출처 목록을 CSP frame-src에 쓴다. 편집기는 글을 바꾸지 않는 위젯 장식으로 같은 임베드를 보인다.
---

메모 글에서 동영상을 소개하려면 지금까지 영상 화면을 캡처해 이미지로 넣어야 했다. [Flux 글](/memo/flux-pattern)의 F8 2014 발표 영상도 YouTube 페이지를 캡처한 JPG였고, 읽는 사람은 캡처 아래의 링크를 눌러 YouTube로 이동해야 영상을 재생할 수 있었다. 이 글은 바깥 링크를 iframe 임베드로 그리는 기능을 더한 과정이다.

![읽기 화면의 YouTube 임베드](./images/memo-link-embed-reader.jpg 'Flux 글에 주소 한 줄로 적은 F8 2014 발표 영상. 본문 폭의 16:9 재생기와 아래의 "YouTube에서 열기" 링크')

## 임베드할 링크를 고르는 규칙

모든 YouTube 링크를 임베드하면, "발표 영상은 [여기](https://youtu.be/…)에 있다"처럼 문장 속에서 출처로 건 링크까지 재생기로 바뀐다. 그래서 **문단에 주소 링크 하나만 있고, 링크 글자가 주소 그대로일 때만** 임베드하기로 했다.

```markdown
https://www.youtube.com/watch?v=nYkdrAPrdcw ← 임베드

발표 영상은 https://youtu.be/nYkdrAPrdcw 에 있다. ← 링크
[발표 영상](https://youtu.be/nYkdrAPrdcw) ← 링크
```

주소만 한 줄로 적는 것은 글쓴이가 그 자리에 콘텐츠를 두겠다는 표시이고, `[글자](주소)`로 글자를 붙인 링크는 링크로 읽히기를 의도한 것이다. 이 규칙이면 기존 글을 바꾸지 않아도 된다. 저장소 글 243편 가운데 지원 사이트의 주소만 한 줄로 적은 문단은 없어서, 기능을 더해도 기존 글의 화면은 바뀌지 않는다.

## 원래 주소 대신 ID로 임베드 주소를 새로 만든다

판별은 프레임워크와 관계없는 로직이라 `packages/desktop-core/src/memo/embeds.ts`에 두었다. `embedOf(href)`는 지원 사이트의 주소에서 ID를 뽑아 각 사이트의 임베드 주소를 **새로 만든다**.

```ts
function youtube(url: ParsedUrl): Embed | null {
	// watch?v=<id>, youtu.be/<id>, shorts/<id>, live/<id>, embed/<id>
	…
	if (!id || !ID.test(id)) return null; // ID는 /^[\w-]+$/ 만 받는다
	const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start')); // t=1m30s → 90
	return {
		provider: 'youtube',
		name: 'YouTube',
		src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`,
		aspectRatio: vertical ? '9 / 16' : '16 / 9',
	};
}
```

원래 주소를 iframe의 `src`에 그대로 넣지 않는 이유는 두 가지다.

1. **글에 적힌 주소를 신뢰하지 않는다.** 서버 글은 관리자만 쓰지만, 주소에 `javascript:`나 다른 출처, 예상하지 못한 검색 인자가 섞여도 iframe에는 들어가지 않아야 한다. ID에 `[\w-]` 밖의 글자가 있으면 임베드하지 않고 링크로 둔다. https가 아닌 주소도 임베드하지 않는다.
2. **사이트마다 임베드 주소가 다르다.** YouTube의 `watch?v=`, Vimeo의 `vimeo.com/<숫자>`, CodePen의 `/pen/` 주소는 iframe에 넣으면 페이지 전체가 열리거나 거부된다. 각 사이트가 안내하는 임베드 전용 주소로 바꿔야 한다.

| 사이트      | 받는 주소                                             | 임베드 주소                                       | 크기                            |
| ----------- | ----------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| YouTube     | `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/` | `www.youtube-nocookie.com/embed/<id>`             | 16:9 (Shorts 9:16)              |
| Vimeo       | `vimeo.com/<숫자>`                                    | `player.vimeo.com/video/<id>`                     | 16:9                            |
| CodePen     | `codepen.io/<user>/pen/<id>`                          | `codepen.io/<user>/embed/<id>?default-tab=result` | 높이 420px                      |
| CodeSandbox | `/s/<id>`, `/p/sandbox/<id>`                          | `codesandbox.io/embed/<id>`                       | 높이 500px                      |
| StackBlitz  | `stackblitz.com/edit/<id>`                            | `stackblitz.com/edit/<id>?embed=1`                | 높이 500px                      |
| Spotify     | `track`·`album`·`playlist`·`episode`·`show`·`artist`  | `open.spotify.com/embed/<종류>/<id>`              | 곡·에피소드 152px, 나머지 352px |
| Loom        | `loom.com/share/<id>`                                 | `www.loom.com/embed/<id>`                         | 16:9                            |
| Figma       | `file`·`design`·`proto`·`board`·`slides`              | `www.figma.com/embed?embed_host=share&url=…`      | 16:10                           |

YouTube는 `youtube-nocookie.com`을 쓴다. YouTube가 제공하는 개인정보 보호 강화 모드의 주소로, 방문자가 재생 버튼을 누르기 전에는 YouTube 쿠키를 남기지 않는다.

desktop-core는 브라우저·Node·Cloudflare Worker 어디서나 돌도록 `lib`을 `ES2022`로만 두어 `URL` 타입이 없다. 세 환경 모두에 있는 `URL` 가운데 쓰는 속성(`protocol`, `hostname`, `pathname`, `search`, `searchParams.get`)만 이 파일 안에 선언했다.

![Vimeo와 Spotify 임베드](./images/memo-link-embed-providers.jpg 'Vimeo 동영상(16:9)과 Spotify 재생 목록(높이 352px). 가운데 문단처럼 문장 속에 적은 같은 Vimeo 주소는 링크로 남는다')

## CSP frame-src와 같은 목록을 쓴다

사이트의 CSP(Content-Security-Policy)는 `frame-src`에 적은 출처만 iframe으로 열 수 있다. iframe 주소를 만드는 코드와 CSP 목록을 따로 관리하면 사이트를 더할 때 한쪽을 빠뜨리기 쉽다. 그래서 `embeds.ts`가 임베드 출처 목록 `EMBED_ORIGINS`를 내보내고, `worker/securityHeaders.ts`가 이 목록을 그대로 `frame-src`에 더한다.

```ts
export const EMBED_ORIGINS: Readonly<Record<EmbedProvider, string>> = {
	youtube: 'https://www.youtube-nocookie.com',
	vimeo: 'https://player.vimeo.com',
	…
};

// worker/securityHeaders.ts
'frame-src': ["'self'", TURNSTILE, ...Object.values(EMBED_ORIGINS).sort(), ...frameOrigins(frameUrls)],
```

`embeds.test.ts`는 만든 iframe 주소가 모두 `EMBED_ORIGINS`의 출처로 시작하는지 확인한다. 새 사이트를 더하면서 출처를 목록에 적지 않으면 이 시험이 실패한다. CSP는 `vite.config.ts`도 읽기 때문에, desktop-core를 빌드하지 않아도 되도록 패키지 이름 대신 `src`의 상대 경로로 가져온다.

## 읽기 화면: 문단을 figure로 바꾼다

읽기 화면은 react-markdown이 Markdown을 HTML 트리(hast)로 바꾼 뒤 요소마다 React 컴포넌트를 고른다. `p`를 바꿔, 자식이 `<a>` 하나뿐이고 링크 글자가 `href`와 같으면 임베드로 그린다.

```tsx
p: ({ node, children, ...rest }) => {
	const block = node ? embedBlockOfParagraph(node) : null; // embedBlock.ts
	return block ? <MemoEmbed block={block} /> : <p {...rest}>{children}</p>;
},
```

`MemoEmbed`는 `<figure class="memo-embed">` 안에 iframe과 "YouTube에서 열기" 링크를 둔다. iframe에는 다음 속성을 준다.

- `loading="lazy"`: 화면에 들어올 때 불러온다. 글 아래쪽의 재생기가 처음 로딩을 늦추지 않는다.
- `referrerPolicy="strict-origin-when-cross-origin"`: 사이트의 Referrer-Policy와 같은 값을 명시했다. YouTube 임베드 재생기는 Referer로 삽입한 사이트를 식별하므로, Referer를 보내지 않는 정책이면 재생 오류가 날 수 있다.
- `allow`: 암호화 미디어, 화면 속 화면, 전체 화면, 코드 예제의 클립보드 복사만 연다.

동영상은 `aspect-ratio`로 본문 폭에 맞춰 16:9를 유지하고, 코드 예제와 음악은 사이트별 고정 높이를 쓴다. 모서리와 테두리는 본문 이미지와 같은 값이다.

## 편집기: 글을 바꾸지 않는 위젯 장식

관리자로 로그인하면 글은 Milkdown(ProseMirror) 편집기로 열린다. 편집기에서도 같은 임베드가 보여야 읽기 화면과 같은 모양으로 글을 쓸 수 있다.

![편집 화면의 YouTube 임베드](./images/memo-link-embed-editor.jpg '편집 화면. 주소 문단은 편집할 수 있는 링크로 남고, 그 아래에 읽기 화면과 같은 재생기가 붙는다')

ProseMirror에서 블록을 다르게 그리는 방법은 두 가지다. 노드 종류를 새로 만들어 노드 뷰로 그리거나, 문서는 그대로 두고 장식(decoration)을 붙이는 것이다. 임베드는 Markdown에서 그냥 링크 문단이므로 노드 종류를 만들면 Markdown 변환 규칙까지 새로 정의해야 한다. 그래서 문서를 바꾸지 않는 **위젯 장식**을 골랐다. 위젯 장식은 문서의 특정 위치에 편집 대상이 아닌 DOM을 끼워 넣는 기능이다.

```ts
state.doc.descendants((node, pos) => {
	if (node.type.name !== 'paragraph') return true;
	const block = embedBlockOfNode(node); // 텍스트 하나에 link 마크, 글자 = href
	if (block)
		decorations.push(
			Decoration.widget(pos + node.nodeSize, () => embedDom(block), {
				side: -1,
				key: `embed:${block.embed.src}`, // 같은 key면 DOM을 다시 만들지 않는다
				ignoreSelection: true,
				stopEvent: () => true, // 재생기 안의 클릭을 편집기가 가로채지 않는다
			})
		);
	return false;
});
```

장식은 문서가 바뀔 때마다 다시 계산된다. 위젯을 매번 새로 만들면 글자 하나를 입력할 때마다 iframe이 다시 불러와져 재생 중인 영상이 처음으로 돌아간다. ProseMirror는 이전 장식과 `key`가 같은 위젯의 DOM을 다시 쓰므로, key를 iframe 주소로 정해 이 문제를 막았다. 주소를 고치면 key가 바뀌어 새 재생기를 불러온다.

### 주소를 입력하거나 바꿀 때

편집기에서 주소를 붙여 넣으면 Milkdown이 붙여 넣은 글자를 Markdown으로 해석해, GFM의 주소 자동 링크 규칙에 따라 링크로 만든다. 그 문단이 주소 하나뿐이면 바로 임베드가 붙는다. 그러나 두 경우에는 링크와 글자가 어긋났다.

| 경우                         | 문서 상태                                   | 저장되는 Markdown      | 읽기 화면               |
| ---------------------------- | ------------------------------------------- | ---------------------- | ----------------------- |
| 주소를 키보드로 직접 입력    | 링크 마크가 없는 글자                       | 링크가 아닌 주소 글자  | 임베드되지 않을 수 있음 |
| 링크 글자만 다른 주소로 고침 | 글자는 새 주소, 링크 대상(href)은 예전 주소 | `[새 주소](예전 주소)` | 링크로 남음             |

그래서 같은 플러그인에 `appendTransaction`을 더했다. ProseMirror는 트랜잭션이 적용된 뒤 플러그인이 덧붙일 트랜잭션을 돌려줄 수 있게 한다. 문서가 바뀔 때마다 공백 없는 https 주소 하나뿐인 문단을 찾아, 링크가 글자와 다르면 문단 전체에 글자 주소로 링크를 다시 건다. 링크가 없는 글자는 지원 사이트의 주소일 때만 링크를 건다. 그 결과 주소를 바꾸려면 주소 글자를 고치거나 새 주소를 붙여 넣기만 하면 되고, 링크·임베드·저장되는 Markdown이 함께 새 주소를 따른다.

## 시험

| 시험                            | 확인하는 것                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `embeds.test.ts` (desktop-core) | 사이트별 주소 해석, 시작 시각 `t=1m30s` → 90초, http·지원하지 않는 사이트·ID에 다른 글자가 섞인 주소는 null, 모든 iframe 주소가 `EMBED_ORIGINS` 안                    |
| `embedBlock.test.ts`            | 주소 링크 하나뿐인 문단만 임베드, 문장 속 링크·글자를 붙인 링크는 제외                                                                                                |
| `securityHeaders.test.ts`       | `frame-src`에 임베드 출처 8개                                                                                                                                         |
| `memo-embed.spec.ts` (E2E)      | 읽기 화면의 iframe 주소·제목·16:9 비율·"YouTube에서 열기" 링크, CSP 위반 메시지 없음. 편집 화면의 같은 임베드, 다른 문단에 입력한 뒤에도 같은 iframe 요소 유지        |
| `memo-embed.spec.ts` (E2E 추가) | 편집기에서 Vimeo 주소를 직접 입력하면 링크와 임베드가 붙고, YouTube 주소 글자를 다른 영상 주소로 바꾸면 링크 대상·임베드·임시 저장한 Markdown이 모두 새 주소를 따른다 |

마지막 시험은 iframe 요소에 표시용 `data-mark`를 붙이고, 다른 문단에 글자를 입력한 뒤에도 그 표시가 남아 있는지로 같은 요소인지 확인한다.

## 관련 글

- [메모에 목차와 이미지 배치 더하기 — 접히는 목차, 떠 있는 목차 버튼, 주소 끝 #float-right](/memo/memo-toc-image-layout): 주소 끝 표기로 이미지를 배치하는 같은 방식의 Markdown 확장
- [Markdown 본문 스타일을 prose.css 하나로 — 텍스트 편집기에서 빠졌던 코드 색](/memo/markdown-prose-css): 읽기·편집 화면이 함께 쓰는 본문 스타일

#MacFolio #메모앱 #React #ProseMirror #CSP

---
title: 주소에서 ID를 뽑아 만든 iframe 임베드와 ProseMirror 위젯 장식으로 그리는 바깥 링크 미리 보기
date: 2026-10-30
category: 개발 기록/MacFolio/프론트엔드
summary: 메모 글에 YouTube·SoundCloud·CodePen 등 21개 사이트의 주소만 한 줄로 적으면 iframe 임베드로, 영상·음악 파일은 브라우저 재생기로 그리게 했다. 원래 주소 대신 주소에서 뽑은 ID로 임베드 주소를 새로 만들고, 같은 출처 목록을 CSP frame-src에 쓴다. 편집기는 글을 바꾸지 않는 위젯 장식으로 같은 임베드를 보인다.
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

| 분류          | 사이트         | 받는 주소                                                                | 크기                                |
| ------------- | -------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| 동영상        | YouTube        | `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/` (`t=`는 시작 초로) | 16:9 (Shorts 9:16, 최대 폭 352px)   |
|               | Vimeo          | `vimeo.com/<숫자>`                                                       | 16:9                                |
|               | Twitch         | 채널(생방송), `videos/<숫자>`, 클립                                      | 16:9                                |
|               | TED            | `ted.com/talks/<slug>`                                                   | 16:9                                |
|               | Streamable     | `streamable.com/<id>`                                                    | 16:9                                |
|               | Loom           | `loom.com/share/<id>`                                                    | 16:9                                |
| SNS           | TikTok         | `tiktok.com/@<사용자>/video/<숫자>`                                      | 높이 760px, 최대 폭 340px           |
|               | Instagram      | `instagram.com/p/<코드>`, `reel/`, `tv/`                                 | 높이 720px, 최대 폭 540px           |
| 음악·팟캐스트 | Spotify        | `track`·`album`·`playlist`·`episode`·`show`·`artist`                     | 곡·에피소드 152px, 나머지 352px     |
|               | SoundCloud     | 사용자, 곡, `sets/<재생 목록>`                                           | 곡 166px, 나머지 450px              |
|               | Apple Music    | `album`·`playlist`·`song`·`music-video`·`station` (`?i=` 곡)             | 곡 175px, 나머지 450px              |
|               | Apple 팟캐스트 | `podcast/<이름>/id<숫자>` (`?i=` 에피소드)                               | 에피소드 175px, 쇼 16:9             |
| 코드          | CodePen        | `codepen.io/<user>/pen/<id>`                                             | 높이 420px                          |
|               | CodeSandbox    | `/s/<id>`, `/p/sandbox/<id>`                                             | 높이 500px                          |
|               | StackBlitz     | `stackblitz.com/edit/<id>`                                               | 높이 500px                          |
|               | JSFiddle       | `jsfiddle.net/<id>`, `/<user>/<id>`                                      | 높이 420px                          |
| 디자인·문서   | Figma          | `file`·`design`·`proto`·`board`·`slides`                                 | 16:10                               |
|               | Miro           | `miro.com/app/board/<id>`                                                | 16:9                                |
|               | Canva          | `canva.com/design/<id>/<공유 토큰>/…`                                    | 16:9                                |
|               | Google 문서    | 문서·프레젠테이션·스프레드시트(공유·게시 주소), 설문지(응답 주소)        | 프레젠테이션 16:9, 나머지 480~800px |
|               | Google Drive   | `drive.google.com/file/d/<id>`                                           | 4:3                                 |

주소만으로 임베드 주소를 만들 수 없는 사이트는 넣지 않았다.

| 사이트                  | 넣지 않은 이유                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| X(Twitter), GitHub Gist | iframe이 아니라 사이트의 스크립트를 페이지에 넣는 방식이다. CSP의 `script-src`를 바깥 출처에 열어야 한다   |
| Bandcamp, SlideShare    | 임베드 주소에 공유 주소에 없는 내부 ID가 들어간다. 알아내려면 사이트의 API(oEmbed)에 요청해야 한다         |
| Dailymotion             | 예전 임베드 주소가 새 재생기(`geo.dailymotion.com`)로 넘어가는데, 사이트에 등록한 Player ID 없이는 403이다 |
| 네이버 TV               | 임베드 주소(`tv.naver.com/embed/<id>`)가 다른 서비스 주소로 넘어가, 주소 체계가 바뀐 것으로 보인다         |

YouTube는 `youtube-nocookie.com`을 쓴다. YouTube가 제공하는 개인정보 보호 강화 모드의 주소로, 방문자가 재생 버튼을 누르기 전에는 YouTube 쿠키를 남기지 않는다.

desktop-core는 브라우저·Node·Cloudflare Worker 어디서나 돌도록 `lib`을 `ES2022`로만 두어 `URL` 타입이 없다. 세 환경 모두에 있는 `URL` 가운데 쓰는 속성(`protocol`, `hostname`, `pathname`, `search`, `searchParams.get`)만 이 파일 안에 선언했다.

![Vimeo와 Spotify 임베드](./images/memo-link-embed-providers.jpg 'Vimeo 동영상(16:9)과 Spotify 재생 목록(높이 352px). 가운데 문단처럼 문장 속에 적은 같은 Vimeo 주소는 링크로 남는다')

## CSP frame-src와 같은 목록을 쓴다

사이트의 CSP(Content-Security-Policy)는 `frame-src`에 적은 출처만 iframe으로 열 수 있다. iframe 주소를 만드는 코드와 CSP 목록을 따로 관리하면 사이트를 더할 때 한쪽을 빠뜨리기 쉽다. 그래서 `embeds.ts`가 임베드 출처 목록 `EMBED_ORIGINS`를 내보내고, `worker/securityHeaders.ts`가 이 목록을 그대로 `frame-src`에 더한다.

```ts
export const EMBED_ORIGINS: Readonly<Record<EmbedProvider, readonly string[]>> = {
	youtube: ['https://www.youtube-nocookie.com'],
	twitch: ['https://player.twitch.tv', 'https://clips.twitch.tv'],
	…
};

// worker/securityHeaders.ts
'frame-src': ["'self'", TURNSTILE, ...Object.values(EMBED_ORIGINS).flat().sort(), ...frameOrigins(frameUrls)],
```

사이트마다 출처를 배열로 둔 것은 iframe 주소의 출처와 재생기가 실제로 여는 출처가 다른 경우가 있어서다. Twitch는 생방송·다시보기는 `player.twitch.tv`, 클립은 `clips.twitch.tv`를 쓴다. CSP의 `frame-src`는 iframe이 리다이렉트로 넘어간 주소에도 적용되므로, 넘어가는 출처까지 적어야 한다.

Twitch 재생기는 삽입한 사이트의 도메인을 `parent` 인자로 받아야 열린다. 그래서 `embedOf(href, { parent })`가 도메인을 받고, 브라우저에서는 `location.hostname`을 넘긴다. 도메인을 모르는 환경(서버, 시험)에서는 Twitch를 임베드하지 않는다.

`embeds.test.ts`는 만든 iframe 주소가 모두 그 사이트의 `EMBED_ORIGINS` 출처로 시작하는지 확인한다. 새 사이트를 더하면서 출처를 목록에 적지 않으면 이 시험이 실패한다. CSP는 `vite.config.ts`도 읽기 때문에, desktop-core를 빌드하지 않아도 되도록 패키지 이름 대신 `src`의 상대 경로로 가져온다.

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

관리자로 로그인하면 글은 Milkdown(ProseMirror) 편집기로 열린다. 편집기에서도 같은 임베드가 보여야 읽기 화면과 같은 모양으로 글을 쓸 수 있다. 다만 편집기는 주소를 고칠 방법도 제공해야 한다.

![편집 화면의 YouTube 임베드](./images/memo-link-embed-editor.jpg '편집 화면에 마우스를 올린 모습. 읽기 화면과 같은 재생기의 제목 줄 아래 왼쪽에 주소 바꾸기·링크로 바꾸기·임베드 삭제 버튼이 보인다')

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

### 주소 문단을 숨기고, 커서가 들어오면 보인다

처음에는 주소 문단을 그대로 두고 그 아래에 재생기를 붙였다. 주소를 고치기는 쉽지만, 편집 화면에만 주소 줄이 한 줄 더 보여 읽기 화면과 모양이 달랐다. 반대로 주소를 완전히 감추고 도구 막대로만 고치게 하면, 키보드로 글을 쓰는 중에 주소를 확인하거나 고치기 어렵다. 그래서 두 방식을 섞었다.

| 상황                              | 화면                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| 평소                              | 주소 문단을 숨기고 재생기와 "YouTube에서 열기"만 보인다        |
| 재생기에 마우스를 올림            | 제목 줄 아래 왼쪽에 주소 바꾸기·링크로 바꾸기·임베드 삭제 버튼 |
| 위·아래 화살표로 그 자리에 들어감 | 주소 문단이 보이고 커서가 주소에 놓인다                        |
| 주소 바꾸기를 누름                | 주소 문단이 보이고 주소 전체가 골라진다                        |

주소 문단을 숨기는 것도 장식이다. `Decoration.node`로 문단에 `memo-embed-source` 클래스를 붙이고, 선택 영역이 그 문단 안에 있을 때만 `data-editing`을 더한다. CSS는 `data-editing`이 없는 주소 문단의 높이와 여백을 0으로 만든다. 문서에서는 문단이 그대로이므로 저장되는 Markdown은 주소 한 줄이다.

![주소를 고치는 편집 화면](./images/memo-link-embed-editing.jpg '주소 바꾸기를 누른 모습. 숨겼던 주소 문단이 재생기 위에 보이고 주소 전체가 골라져, 새 주소를 입력하거나 붙여 넣으면 된다')

높이가 0인 문단에는 브라우저의 위·아래 화살표 이동이 커서를 두지 않고 건너뛴다. 그래서 `handleKeyDown`에서 커서가 문단 끝에 있고(`view.endOfTextblock`) 옆 블록이 주소 문단이면, 직접 그 안에 커서를 둔다. 아래로 들어가면 주소 앞, 위로 들어가면 주소 끝이다.

도구 버튼의 동작은 다음과 같다.

- **주소 바꾸기:** 주소 문단의 글자를 모두 고른다. 선택이 문단 안에 있으므로 주소가 보이고, 새 주소를 입력하거나 붙여 넣으면 된다.
- **링크로 바꾸기:** 링크 글자를 `https://`를 뺀 주소로 바꾼다. 글자와 주소가 달라져 임베드 규칙에서 빠지고, `[youtube.com/watch?v=…](https://www.youtube.com/watch?v=…)` 링크로 저장된다.
- **임베드 삭제:** 주소 문단을 지운다.

버튼은 위젯 안의 DOM이라 ProseMirror의 위치를 직접 알지 못한다. 위젯을 만들 때 받는 `getPos()`로 누른 시각의 위젯 위치(주소 문단 바로 뒤)를 얻고, 그 앞 노드가 여전히 주소 문단인지 확인한 뒤 트랜잭션을 만든다.

### 주소를 입력하거나 바꿀 때

편집기에서 주소를 붙여 넣으면 Milkdown이 붙여 넣은 글자를 Markdown으로 해석해, GFM의 주소 자동 링크 규칙에 따라 링크로 만든다. 그 문단이 주소 하나뿐이면 바로 임베드가 붙는다. 그러나 두 경우에는 링크와 글자가 어긋났다.

| 경우                         | 문서 상태                                   | 저장되는 Markdown      | 읽기 화면               |
| ---------------------------- | ------------------------------------------- | ---------------------- | ----------------------- |
| 주소를 키보드로 직접 입력    | 링크 마크가 없는 글자                       | 링크가 아닌 주소 글자  | 임베드되지 않을 수 있음 |
| 링크 글자만 다른 주소로 고침 | 글자는 새 주소, 링크 대상(href)은 예전 주소 | `[새 주소](예전 주소)` | 링크로 남음             |

그래서 같은 플러그인에 `appendTransaction`을 더했다. ProseMirror는 트랜잭션이 적용된 뒤 플러그인이 덧붙일 트랜잭션을 돌려줄 수 있게 한다. 문서가 바뀔 때마다 공백 없는 https 주소 하나뿐인 문단을 찾아, 링크가 글자와 다르면 문단 전체에 글자 주소로 링크를 다시 건다. 링크가 없는 글자는 지원 사이트의 주소일 때만 링크를 건다. 그 결과 주소를 바꾸려면 주소 글자를 고치거나 새 주소를 붙여 넣기만 하면 되고, 링크·임베드·저장되는 Markdown이 함께 새 주소를 따른다.

## 영상·음악 파일

임베드는 YouTube 같은 사이트의 재생기를 빌려 쓴다. 직접 올린 영상·음악 파일은 사이트 재생기가 없으므로 브라우저 기본 재생기(`<video controls>`, `<audio controls>`)로 그린다.

![영상·음악 재생기](./images/memo-link-embed-media.jpg '읽기 화면. 위는 주소만 적은 MP4 영상(본문 폭, 모서리는 본문 이미지와 같다), 아래는 MP3 음악(본문 폭의 재생 막대). 각 재생기 아래에 파일 이름 링크가 있다. MDN의 CC0 예제 파일')

재생기로 그리는 링크는 두 가지다.

| 링크                          | Markdown                                                   | 판별                                                   |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 주소만 적은 바깥 파일         | `https://example.com/clips/demo.mp4`                       | https 주소 경로의 확장자                               |
| 편집기로 올린 파일(첨부 파일) | `[노래.mp3](https://api…/files/<id> "첨부 파일 · 3.2 MB")` | 링크 제목이 '첨부 파일', 링크 글자(파일 이름)의 확장자 |

올린 파일의 주소(`/files/<id>`)에는 확장자가 없다. 대신 편집기가 파일을 넣을 때 링크 글자를 파일 이름으로, 링크 제목을 '첨부 파일 · 크기'로 적으므로 이 둘로 판별한다. 영상은 `mp4`·`m4v`·`webm`·`mov`·`ogv`, 음악은 `mp3`·`m4a`·`aac`·`wav`·`flac`·`ogg`·`oga`·`opus`이고, 판별은 `packages/desktop-core/src/memo/media.ts`의 `mediaKindOf`가 맡는다.

**API는 바꾸지 않았다.** 파일 API는 이미지와 MP4만 `Content-Disposition: inline`으로, 나머지는 `attachment`(내려받기)로 내준다. 이 헤더는 링크를 눌러 파일을 열 때만 적용되고, `<audio src>`·`<video src>`가 파일을 불러와 재생하는 데는 영향이 없다. 파일 API는 이미 Range 요청(파일의 일부 구간만 받기)을 지원해 영상 중간으로 건너뛸 수 있다. 그래서 서버 배포 없이 화면만 바꿨다.

**CSP의 `media-src`에 `https:`를 더했다.** 지금까지 `media-src`는 사이트와 API 서버만 허용해, 다른 사이트의 영상·음악 주소는 브라우저가 막았다. 바깥 파일 주소는 미리 알 수 없고, 미디어는 스크립트를 실행하지 못하므로 그림(`img-src`)처럼 https 전체를 연다.

편집기에서는 임베드와 같이 원래 링크 문단을 숨기고 재생기를 붙인다. 도구 버튼은 주소 바꾸기와 삭제 둘이다(재생기는 이미 링크로 남길 대상이 아니라 '링크로 바꾸기'는 없다). 재생기 자체의 버튼은 아래 조작 막대에 있고, Safari는 영상 위쪽 줄에도 왼쪽에 전체 화면·PiP 버튼을, 오른쪽에 음량 버튼을 둔다. 그래서 영상은 마우스를 올리면 위쪽 줄의 전체 화면·PiP 버튼 오른쪽에 반투명 어두운 원 바탕의 버튼을 둔다. Safari의 위쪽 줄은 영상 모서리에서 6px 안쪽에 높이 46px이므로, 버튼의 수직 중심을 영상 위에서 29px에 맞춘다. 음악은 재생 막대가 낮아 위에 겹치면 막대를 가리므로 아래 캡션 줄 왼쪽에 옅은 글자색으로 둔다(오른쪽 아래에는 창의 글자 크기 버튼이 떠 있다). 또 파일을 올린 직후처럼 커서가 원래 링크 줄 안에 있으면 그 줄(첨부 파일 배지)이 보이는데, 이때는 아래 캡션을 숨겨 배지가 한 곳에만 보이게 한다. 위젯이 원래 문단 바로 뒤에 붙으므로 CSS의 형제 선택자(`p.memo-embed-source[data-editing] + .memo-media figcaption`)로 고른다.

![편집 화면의 음악 재생기](./images/memo-link-embed-media-editor.jpg '편집 화면에서 음악 재생기에 마우스를 올린 모습. 재생기 폭은 읽기 화면과 같고, 주소 바꾸기·삭제 버튼은 캡션 줄 왼쪽에 있다')

한 파일의 한도는 지금처럼 10MB다. 1080p 영상이면 1분 남짓, 128kbps MP3면 10분 정도라, 긴 영상은 YouTube에 올리고 임베드하는 편이 낫다.

## 시험

| 시험                                  | 확인하는 것                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `embeds.test.ts` (desktop-core)       | 사이트별 주소 해석, 시작 시각 `t=1m30s` → 90초, http·지원하지 않는 사이트·ID에 다른 글자가 섞인 주소는 null, 모든 iframe 주소가 `EMBED_ORIGINS` 안                                                                                                                                    |
| `embedBlock.test.ts`                  | 주소 링크 하나뿐인 문단만 임베드, 문장 속 링크·글자를 붙인 링크는 제외                                                                                                                                                                                                                |
| `securityHeaders.test.ts`             | `frame-src`에 임베드 출처 22개 (21개 사이트)                                                                                                                                                                                                                                          |
| `memo-embed.spec.ts` (E2E)            | 읽기 화면의 iframe 주소·제목·16:9 비율·"YouTube에서 열기" 링크, CSP 위반 메시지 없음. 편집 화면에서 주소 문단의 높이가 0이고 같은 임베드·캡션이 보임, 다른 문단에 입력한 뒤에도 같은 iframe 요소 유지                                                                                 |
| `memo-embed.spec.ts` (E2E 추가)       | 위·아래 화살표로 주소 문단에 들어가면 보이고 나오면 숨음. 주소 바꾸기로 다른 영상 주소를 입력하면 링크 대상·임베드·임시 저장한 Markdown이 새 주소를 따르고, 직접 입력한 Vimeo 주소도 임베드됨. 링크로 바꾸기는 `[vimeo.com/…](https://vimeo.com/…)`로, 임베드 삭제는 주소 문단을 지움 |
| `memo-embed.spec.ts` (영상·음악)      | 읽기·편집 화면에서 주소만 적은 MP4와 올린 MP3(첨부 파일 링크)가 `<video>`·`<audio>`로, 문장 속 파일 링크는 링크로 남음, 캡션 링크에 첨부 파일 제목 유지, CSP 위반 없음. 편집 화면은 원래 문단을 숨기고 버튼이 주소 바꾸기·삭제 둘이며 삭제하면 재생기가 사라짐                        |
| `media.test.ts`, `embedBlock.test.ts` | 확장자로 영상·음악 가르기(대소문자·검색 인자 무시), 바깥 파일은 https만, 올린 파일은 첨부 파일 제목과 파일 이름 확장자                                                                                                                                                                |

iframe을 다시 불러오지 않는지는 iframe 요소에 표시용 `data-mark`를 붙이고, 다른 문단에 글자를 입력한 뒤에도 그 표시가 남아 있는지로 같은 요소인지 확인한다.

## 관련 글

- [메모에 목차와 이미지 배치 더하기 — 접히는 목차, 떠 있는 목차 버튼, 주소 끝 #float-right](/memo/memo-toc-image-layout): 주소 끝 표기로 이미지를 배치하는 같은 방식의 Markdown 확장
- [Markdown 본문 스타일을 prose.css 하나로 — 텍스트 편집기에서 빠졌던 코드 색](/memo/markdown-prose-css): 읽기·편집 화면이 함께 쓰는 본문 스타일

#MacFolio #메모앱 #React #ProseMirror #CSP

---
title: 첫 방문 전송량 9MB를 0.8MB로 — 글꼴, 글 원문, 앱 코드, 이미지 최적화 과정
date: 2026-10-22
category: 개발기/MacFolio/프론트엔드
summary: 성능 측정에서 찾은 병목을 하나씩 줄였다. 항목마다 문제, 근거, 수정한 코드의 전후, 효과, 시행착오를 정리했다. 글꼴 subset, 동적 import, modulepreload, WebP, HTML 첫 렌더링, 누른 뒤에 렌더링하는 홈 화면까지.
---

[성능 측정 리포트](/memo/site-performance-report)에서 원인을 찾았다. 3.8MB 글꼴, 첫 번들에 들어 있던 블로그 원문과 모든 앱의 코드, 큰 이미지와 영상, JS가 렌더링하던 로딩 화면이다. 이 글은 그것들을 하나씩 줄인 기록이다. 항목마다 **문제 → 어떻게 찾았나 → 개선 방법(코드 전후) → 효과 → 시행착오** 순서로 적었다. 순서는 효과가 큰 것부터다.

![느린 휴대폰에서 개선 전·후](./images/site-performance-diet-filmstrip.jpg '느린 4G·4배 느린 CPU의 휴대폰에서 0.5초마다 찍은 화면. 개선 전에는 7초 동안 검은 화면, 개선한 뒤에는 1초에 사과가, 2초에 시작 안내가 뜬다')

Lighthouse 휴대폰 조건(느린 4G, 4배 느린 CPU)으로 첫 화면을 0.5초마다 찍었다. 개선 전에는 7초 동안 검은 화면이다. 개선한 뒤에는 1초에 사과가 뜨고 2초에 "탭하여 로딩을 시작하세요"가 뜬다.

먼저 전체 구성이다. 휴대폰이 로딩 화면을 누르기 전까지 수신하는 리소스가 무엇이었고, 그것이 어디로 갔는지 정리했다.

![휴대폰 첫 방문 전송량의 전후](./images/site-performance-diet-bundles.svg '개선 전 4,893KB는 글꼴, 글 원문, 앱 코드, 이미지가 대부분이었다. 3차 뒤 483KB. 줄인 것은 삭제한 것이 아니라 필요한 시점으로 옮겼다')

줄인 것은 대부분 삭제한 것이 아니라 **필요한 시점으로 옮긴 것**이다. 글 원문은 메모를 열 때, 앱 코드는 그 앱을 열 때, 드문 한글 글꼴은 그 글자가 화면에 나올 때 수신한다.

## 1. 글꼴: 1.7MB → 149KB

**문제.** 본문 글꼴은 TTF 한 벌(`AppleSDGothicNeoR.ttf`)을 그대로 썼다. 원본 3.8MB, 서버가 brotli로 압축해도 1.7MB다. 한글 완성형 11,172자를 다 담고 있어서다. `font-display`도 정하지 않아, 브라우저가 이 파일을 수신하는 동안 텍스트를 렌더링하지 않을 수 있었다.

```css
/* 전 */
@font-face {
	font-family: 'MacSystemFont';
	font-style: normal;
	font-weight: normal;
	src: url('/fonts/AppleSDGothicNeoR.ttf') format('truetype');
}
```

**어떻게 찾았나.** Lighthouse의 네트워크 요청(`network-requests` 감사)을 전송량 순으로 늘어놓으니 1위가 이 파일(1,688KB)이었다. 휴대폰 첫 방문 4,893KB의 1/3이다.

**개선 방법.** 화면에 나오는 한글은 대부분 KS X 1001 완성형 2,350자 안이다. 그래서 fonttools로 글꼴을 두 조각으로 분할했다(`scripts/subset-font.py`).

```python
def encodable(code: int) -> bool:
    """KS X 1001 완성형 2,350자인지. 파이썬의 euc_kr은 나머지 글자도 8바이트 조합형으로 쓰므로 2바이트인 것만 센다"""
    try:
        return len(chr(code).encode('euc_kr')) == 2
    except UnicodeEncodeError:
        return False


COMMON_HANGUL = [c for c in range(0xAC00, 0xD7A4) if encodable(c)]
REST_HANGUL = [c for c in range(0xAC00, 0xD7A4) if not encodable(c)]
CORE = [
    *range(0x0020, 0x0100),  # 영문·숫자·라틴-1
    *range(0x2000, 0x2070),  # 일반 문장 부호
    0x20A9,  # ₩
    *range(0x2190, 0x2200),  # 화살표
    *range(0x3000, 0x3040),  # 한중일 문장 부호
    *range(0x3131, 0x318F),  # 한글 자모
    *COMMON_HANGUL,
]
```

- **core (149KB):** 영문·숫자·문장 부호·화살표·자모와 완성형 2,350자
- **ext (232KB):** 나머지 한글 8,822자 (똠, 햏 같은 글자)

두 파일 모두 woff2로 저장하고, OpenType 기능(`layout_features = ['*']`)은 그대로 유지한다. CSS에는 같은 이름의 `@font-face`를 두 개 정의한다.

```css
/* 후 (index.css) */
@font-face {
	font-family: 'MacSystemFont';
	font-display: swap;
	src: url('/fonts/AppleSDGothicNeoR-ext.woff2') format('woff2');
	unicode-range: U+AC00-D7A3;
}
@font-face {
	font-family: 'MacSystemFont';
	font-display: swap;
	src: url('/fonts/AppleSDGothicNeoR-core.woff2') format('woff2');
	unicode-range: U+0020-00FF, U+2000-206F, U+20A9, U+2190-21FF, U+3000-303F, U+3131-318E, U+AC00-D7A3;
}
```

![글꼴 두 조각을 고르는 순서](./images/site-performance-diet-font.svg '같은 이름의 글꼴은 나중에 적은 core부터 본다. core에 글자가 있으면 거기서 끝나고, 없을 때만 ext를 수신한다')

브라우저는 같은 이름의 `@font-face` 중 나중에 적은 것부터 본다. `unicode-range`에 그 글자가 들고 실제로 글꼴에 글자가 있으면 그 글꼴로 렌더링한다. 범위에는 들었는데 글꼴에 글자가 없으면 다음 글꼴을 찾는다(CSS Fonts 4의 글꼴 고르기). 그래서 두 글꼴 모두 한글 전체(`U+AC00-D7A3`)로 지정하고 core를 나중에 적었다. 흔한 글자는 core에서 찾고 끝나고, core에 없는 글자가 화면에 나올 때만 ext를 수신한다. `font-display: swap`으로 글꼴을 수신하는 동안에는 시스템 글꼴로 먼저 렌더링한다.

**효과.** 첫 방문에 수신하는 글꼴이 1,736KB에서 149KB가 되었다. 측정한 첫 방문(누른 뒤 3초까지)에서 ext는 한 번도 수신하지 않았다. PDF 이력서는 글꼴을 파일에 넣어야 해서 TTF를 그대로 쓴다.

**시행착오.**

- **`euc_kr`의 함정:** 처음에는 "euc_kr로 인코딩되면 완성형"으로 골랐다. 그런데 파이썬의 `euc_kr`은 2,350자 밖의 글자도 8바이트 조합형 문자열로 인코딩한다. 11,172자가 다 골라져 core가 373KB가 되었다. 인코딩한 결과가 2바이트인 것만 집계하도록 수정했다
- **`unicode-range`에 2,350자를 하나씩 적을 뻔했다:** 범위를 글자마다 적으면 CSS가 수십 KB가 된다. 위의 "글꼴에 없으면 다음 글꼴" 규칙을 알고 나서 범위는 넓게 두고 적는 순서로 고르게 했다

## 2. 첫 번들에서 글 원문 2.4MB 빼기

**문제.** 블로그 글은 빌드할 때 원문을 묶는다. 저장소의 글 저장소가 처음 불릴 때 원문을 한꺼번에 읽었다.

```ts
// 전 (memo/repository/index.ts)
export function getPostRepository(): PostRepository {
	if (!repository) {
		const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });
		repository = createStaticPostRepository(files, (path) => {
			if (import.meta.env.DEV) console.warn(`[memo] 머리말(title, date)이 잘못된 글: ${path}`);
		});
	}
	return repository;
}
```

`eager: true`라 이 파일을 import하는 모듈은 글 199편의 원문 2.4MB(압축 739KB)를 정적으로 함께 싣는다. 그리고 이 파일을 **바탕화면 아이콘**이 import했다. 바탕화면 아이콘은 Finder의 폴더 트리로 렌더링하고, 그 트리에 블로그 폴더가 있다.

**어떻게 찾았나.** 요청 목록 2위가 `EmptyState-….js`(739KB)였다. 이름은 빈 상태 컴포넌트인데 그렇게 클 리가 없다. 번들러는 여러 곳이 함께 쓰는 모듈을 하나의 청크로 합치고, 그 청크에 안의 모듈 이름 하나를 붙인다. sourcemap으로 청크마다 모듈별 크기를 집계해 보고서야 안에 든 것이 글 원문이라는 것을 알았다.

**개선 방법.** 세 단계로 개선했다.

① 원문을 `contentFiles.ts`로 떼고, 목록을 처음 조회할 때 동적 `import()`로 로드한다. 글 저장소의 `list()`는 원래 비동기여서 호출하는 쪽은 수정할 것이 없었다.

```ts
// 후 (memo/repository/contentFiles.ts)
export const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });

// 후 (memo/repository/index.ts)
export function getPostRepository(): PostRepository {
	repository ??= {
		async list() {
			loading ??= import('./contentFiles').then(({ files }) =>
				createStaticPostRepository(files, (path) => {
					if (import.meta.env.DEV) console.warn(`[memo] 머리말(title, date)이 잘못된 글: ${path}`);
				})
			);
			return (await loading).list();
		},
	};
	return repository;
}
```

`contentFiles.ts` 안에서는 여전히 `eager`다. 원문 번들이 통째로 하나의 청크가 되고, 그 청크를 `import()`로 호출하는 순간에만 수신한다.

② 이것만으로는 데스크톱이 여전히 수신했다. 바탕화면 아이콘이 첫 화면에서 `list()`를 호출해서다. 글 목록을 트리들이 함께 보는 store로 옮기고, 수신은 블로그 폴더가 필요한 곳(Finder, 열기 창, 휴지통)만 시작하게 했다.

```ts
// 후 (finder/useLocations.ts)
const postsStore = createStore<{ list: Post[] }>({ list: [] });
let postsLoading: Promise<void> | null = null;
const loadPosts = () =>
	(postsLoading ??= getPostRepository()
		.list()
		.then((list) => postsStore.setState({ list }))
		.catch(() => {
			postsLoading = null;
		}));

export function useLocations({ posts = true }: { posts?: boolean } = {}): FolderItem[] {
	return useTree(posts).roots;
}

// 바탕화면 아이콘·Dock 휴지통: 첫 화면에 늘 있어서 받지 않는다 (Finder 등이 받았으면 함께 쓴다)
const locations = useLocations({ posts: false });
```

③ Finder 트리에는 저장소 문서(README, docs/\*.md)도 있다. 트리는 문서의 **경로**만 쓰는데 원문(압축 75KB)이 딸려 왔다. `import.meta.glob`을 `eager` 없이 쓰면 키(경로)는 빌드할 때 정해지고, 값은 호출할 때 로드하는 함수가 된다. 경로만 쓰는 `docPaths.ts`를 따로 만들었다.

```ts
// 후 (finder/docPaths.ts)
const lazySources = import.meta.glob<string>(
	['../../../../../README.md', '../../../../../CONTRIBUTING.md', '../../../../../docs/*.md'],
	{ query: '?raw', import: 'default' }
);

/** 문서 경로 (README, CONTRIBUTING이 먼저) */
export const DOC_PATHS = Object.keys(lazySources).map(repoPath);
```

**효과.** 첫 방문에서 글 원문 739KB와 문서 원문 75KB가 빠졌다. 데스크톱은 바탕화면 아이콘이 받던 600KB가 더 빠졌다.

**시행착오.** 메모를 열면 앱 코드와 글 원문을 차례로 수신하느라 목록이 잠깐 비어 보였다. 메모 앱이 원문 번들을 앱 코드와 함께 로드하도록 해서, 메모가 표시될 때는 목록이 이미 차 있다.

## 3. 앱 코드는 처음 열 때

**문제.** 앱 목록(`apps/registry.ts`)에서 메모·Finder·텍스트 편집기만 `React.lazy`였다. 나머지 열일곱 앱은 정적 import라 첫 번들(`boot`)에 들어 있었다. Safari 프로젝트 페이지의 템플릿들과 시스템 설정의 프로젝트 편집기까지 들어 있었다.

**어떻게 찾았나.** 요청 목록 5위가 `boot-….js`(압축 250KB)였다. 첫 화면에 필요한 것은 바탕화면, Dock, 메뉴 막대뿐이다.

**개선 방법.** 모두 `lazy`로 바꿨다. 앱들은 이미 셸(`Desktop.tsx`)의 `Suspense` 안에서 렌더링되고 있어서, 호출하는 쪽은 수정할 것이 없었다.

```ts
// 전
import Safari from '@/apps/safari/Safari';
import Music from '@/apps/music/Music';
import Settings from '@/apps/settings/Settings';
// … 열일곱 앱

// 후
// 모든 앱은 처음 열 때 불러온다. 첫 화면(로딩·바탕화면)이 앱 코드를 기다리지 않게 하려고
const Safari = lazy(() => import('@/apps/safari/Safari'));
const Music = lazy(() => import('@/apps/music/Music'));
const Settings = lazy(() => import('@/apps/settings/Settings'));
// …
```

**효과.** 첫 번들이 압축 250KB에서 47KB가 되었다. 대신 앱마다 처음 열 때 그 앱의 청크를 수신한다.

**시행착오.** E2E가 16개 깨졌다. 다시 돌려도 같았다. 까닭은 셋이었다.

- **셸이 앱의 CSS를 빌려 쓰고 있었다.** 휴대폰 홈 인디케이터가 투명하게 나오고, 홈 화면에서 쓸어 올려도 앱 전환기가 열리지 않았다. 홈 인디케이터의 모양은 `Window.css`에 있다. 이 CSS를 import하는 것은 창 프레임(`Window.tsx`)이고, 창 프레임은 앱만 import한다. 앱이 첫 번들에 있을 때는 이 CSS가 우연히 항상 로드되어 있었다. 이제 셸(`Desktop.tsx`)이 처음부터 로드한다. 코드 분할이 숨어 있던 의존을 드러낸 셈이다
- **상태 표시줄 색이 잠깐 늦다.** 휴대폰 상태 표시줄은 밑에 깔린 화면을 읽어 글자 색을 정한다. 앱을 연 순간에는 앱 화면이 아직 없어 홈 화면을 읽는다. 0.8초마다 다시 읽으니 곧 맞지만, 열자마자 색을 보던 시험이 깨졌다. 시험은 맞을 때까지 기다리게(`expect.poll`) 수정했다
- **시험이 너무 일찍 읽었다.** 창이 뜨자마자 목록의 항목 수를 확인하거나 단축키(⌥N)를 누르던 시험들이다. 이제 창이 뜬 뒤 앱 코드가 올 때까지 잠깐 빈 창이다. 시험은 앱이 렌더링될 때까지 기다리도록 했다

## 4. 첫 번들을 미리 수신하기 (modulepreload)

**문제.** `main.tsx`는 사이트 콘텐츠를 합친 뒤에 `boot.tsx`를 동적 `import()`로 호출한다. 그래서 브라우저는 `main`을 수신해 **실행하기 전까지** `boot`가 있는 줄 모른다. 3번에서 앱을 떼어 내자 `boot`가 쓰는 작은 청크가 늘어서, 그 청크들도 `boot`를 실행한 뒤에야 수신하기 시작했다. 느린 네트워크에서는 왕복 한 번이 150ms다.

**어떻게 찾았나.** Lighthouse의 요청 목록을 시작 시각 순으로 보면 `main` → `boot` → `boot`의 청크가 계단처럼 이어졌다.

![modulepreload 전후의 요청 순서](./images/site-performance-diet-preload.svg '전에는 main을 실행해야 boot를, boot를 수신해야 그 청크를 알았다. 후에는 index.html에 지정한 modulepreload로 함께 수신한다')

**개선 방법.** 빌드할 때 `boot` 청크와 그 청크가 정적으로 import하는 청크·CSS를 찾아 `index.html`에 `<link rel="modulepreload">`로 적는 Vite 플러그인을 더했다(`vite.config.ts`의 `bootPreloadPlugin`). 실행 순서는 그대로고 수신만 함께 한다.

```ts
function bootPreloadPlugin(): Plugin {
	return {
		name: 'macfolio-boot-preload',
		apply: 'build',
		transformIndexHtml: {
			order: 'post',
			handler(html, ctx) {
				const bundle = ctx.bundle;
				// api-docs.html 같은 다른 페이지에는 넣지 않는다
				if (!bundle || !ctx.filename.endsWith('/index.html')) return;
				const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
				const boot = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/boot.tsx'));
				if (!boot) return;
				const files = new Set<string>();
				const css = new Set<string>();
				const visit = (fileName: string) => {
					if (files.has(fileName)) return;
					files.add(fileName);
					const chunk = chunks.find((item) => item.fileName === fileName);
					chunk?.viteMetadata?.importedCss.forEach((file) => css.add(file));
					chunk?.imports.forEach(visit);
				};
				visit(boot.fileName);
				// main이 바로 쓰는 묶음은 Vite가 이미 적었다
				const fresh = (file: string) => !html.includes(`href="/${file}"`);
				return [
					...[...files].filter(fresh).map((file) => ({
						tag: 'link',
						attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
						injectTo: 'head' as const,
					})),
					...[...css].filter(fresh).map((file) => ({
						tag: 'link',
						attrs: { rel: 'preload', as: 'style', href: `/${file}` },
						injectTo: 'head' as const,
					})),
				];
			},
		},
	};
}
```

`chunk.imports`는 정적 import만 담는다. 그래서 앱(`lazy`)이나 글 원문(`import()`) 청크는 따라 들어오지 않는다. Vite가 이미 적은 `main`의 의존은 빼서 같은 줄이 두 번 들어가지 않게 했다.

**효과.** 첫 화면에 필요한 청크를 `main`과 함께 수신한다. 다만 이 방식은 청크 수(휴대폰 기준 33개)를 줄이지는 않는다. 이 한계는 7번에서 다시 다룬다.

## 5. 이미지와 영상

**문제와 근거.** 요청 목록의 이미지를 크기순으로 보면 이랬다.

| 파일                        | 전송량 | 실제로 보이는 크기   |
| --------------------------- | ------ | -------------------- |
| `highsierra.jpg` (배경화면) | 565KB  | 휴대폰은 쓰지 않는다 |
| `ios-sky-light.jpg`         | 310KB  | 휴대폰 화면 한 장    |
| `messages.png` (아이콘)     | 202KB  | Dock 64px, 홈 60px   |
| `photos.png` (아이콘)       | 184KB  | 원본은 2560px        |

데스크톱은 처음 열린 Safari 프로젝트 페이지가 화면 밖의 영상(1MB)과 이미지 수십 장까지 수신했다. 휴대폰 LCP였던 음악 위젯의 앨범 이미지는 이미지 자체는 작은데, 이 이미지들과 글꼴 뒤에서 대기하느라 수신을 시작하는 데만 21초가 걸렸다.

**개선 방법.**

- **아이콘:** 이름과 형식을 그대로 두고 256px로 줄여 다시 저장했다(`scripts/optimize-icons.py`, Pillow의 `LANCZOS`, `optimize=True`). 다시 압축해서 커지면 원래 파일을 유지한다. 1,171KB → 428KB
- **배경화면:** 넓은 그라데이션이라 WebP가 JPG보다 훨씬 작다. 화질 80, `method=6`으로 바꾸고 JPG는 삭제했다(`scripts/optimize-wallpapers.py`). 휴대폰 기본 배경화면 308KB → 60KB, 전체 7.9MB → 2.3MB. 주소는 `wallpaperUrl` 한 곳과 기본값 CSS에서 만든다
- **휴대폰이 수신하던 데스크톱 배경화면:** `body`가 늘 데스크톱 배경화면을 깔고 있었다. 휴대폰 화면 조건에서는 `body`에도 휴대폰 배경화면을 깐다. 홈 화면과 같은 이미지라 한 번만 수신한다

```css
/* 후 (index.css). 조건은 desktop/layout.ts의 isMobileViewport와 같다 */
@media (max-width: 767px), (max-width: 1023px) and (max-height: 499px) {
	body,
	html {
		background-image: var(--wallpaper-mobile);
	}
}
```

- **Safari 첫 페이지의 영상:** 영상은 화면 가까이(위아래 400px) 오면 그때 `src`와 `poster`를 넣는다. `IntersectionObserver`로 한 번 들어오면 관찰을 끊는다

```ts
// 후 (safari/project/useNearView.ts)
export function useNearView(ref: RefObject<Element | null>, margin = '400px'): boolean {
	const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
	useEffect(() => {
		const node = ref.current;
		if (near || !node) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				setNear(true);
				observer.disconnect();
			},
			{ rootMargin: `${margin} 0px` }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref, margin, near]);
	return near;
}
```

- **음악:** 목록에 곡 길이를 보이려고 앱이 켜질 때 곡마다 `new Audio()`(`preload = 'metadata'`)로 메타데이터를 수신했다. 운영 휴대폰 측정에서 MP3 일곱 개의 앞부분이 560KB였다. 곡 길이를 미리 측정해 코드에 기록하고(`TRACK_SECONDS`), 곡은 재생 전에 수신하지 않는다(`preload="none"`)

**효과.** 휴대폰이 첫 방문에 전송하는 이미지가 1,878KB에서 60KB(휴대폰 배경화면 한 장)가 되었다. 데스크톱은 이미지 5,010KB → 348KB, 영상 1,026KB → 0이다.

**시행착오.** 아이콘 PNG는 삭제하지 않았다. 관리자가 서버에 저장한 프로젝트 내용에는 예전 PNG 주소가 들어 있을 수 있어서다. 배경화면 주소를 보는 E2E(`settings.spec.ts`, `wallpapers.spec.ts`)는 `.webp`로 수정했다.

## 6. 로딩 화면을 HTML로 먼저

**문제.** 로딩 화면은 React가 렌더링했다. 그래서 JS 첫 번들을 모두 수신하고 실행하기 전에는 검은 화면이었다. 사과는 Font Awesome brands 글꼴의 글리프라 그 글꼴(113KB)까지 수신해야 표시되었다.

**어떻게 찾았나.** 데스크톱 LCP 요소가 로딩 화면의 사과였다. Lighthouse의 LCP 분석에서 91%가 "렌더링 지연(render delay)"이었다. 이미지를 수신하는 시간이 아니라, 렌더링할 코드가 오기를 기다리는 시간이다.

![휴대폰 첫 화면이 렌더링되는 순서](./images/site-performance-diet-timeline.svg '개선 전에는 14.3초 동안 아무것도 없었다. 1차에서 HTML로 먼저 렌더링해 FCP 4.0초, 3차에서 가려진 홈 화면을 렌더링하지 않아 FCP와 LCP가 3.2초로 같아졌다')

**개선 방법.**

① 사과를 SVG로 바꿨다. 그리고 `index.html`에 로딩 화면과 같은 자리·크기로 사과와 진행 막대를 렌더링하는 `#boot-splash`를 배치했다. CSS는 `<head>` 안에 인라인으로 넣어 다른 파일을 기다리지 않는다.

```html
<!-- 후 (index.html) -->
<div id="boot-splash" aria-hidden="true">
	<svg viewBox="0 0 384 512"><path fill="currentColor" d="M319.1 268.7c…" /></svg>
	<p><span class="tap">탭</span><span class="click">클릭</span>하여 로딩을 시작하세요</p>
	<div class="track"></div>
</div>
<div id="root"></div>
```

② React가 처음 렌더링하면 제거한다. 로딩 화면이 같은 자리에 이어서 렌더링되어 바뀌는 순간이 보이지 않는다.

```tsx
// 후 (App.tsx)
// 처음 그렸으면 스크립트를 받는 동안의 첫 그림(index.html의 #boot-splash)을 지운다
useEffect(() => {
	document.getElementById('boot-splash')?.remove();
}, []);
```

**효과.** 휴대폰 FCP가 14.3초에서 4.0초가 되었다(1차). 브라우저를 실제로 느리게 해서 측정하면 HTML의 첫 렌더링은 1.2초에 뜬다.

**주의할 곳.** 운영의 Cloudflare Worker는 검색엔진용 본문을 넣으려고 `index.html`의 `<div id="root"></div>`를 글자 그대로 찾아 바꾼다. `#root` 안에 첫 렌더링 요소를 넣으면 이 치환이 맞지 않게 된다. 그래서 `#root` 안에는 아무것도 넣지 않고 그 앞에 따로 배치했다.

## 7. 2차: 아이콘과 앨범 이미지는 WebP, 메뉴 막대의 사과는 SVG

**어떻게 찾았나.** 1차를 머지하고 휴대폰을 다시 들여다봤다. Lighthouse의 "이미지 크기 최적화"와 "차세대 형식" 진단이 300KB를 아낄 수 있다고 짚은 이미지는 거의 앱 아이콘이었다.

**개선 방법.**

- **아이콘:** 같은 스크립트가 PNG 옆에 192px WebP(화질 85)를 만들고, 화면은 WebP를 쓴다. 휴대폰 홈 화면의 아이콘은 60px이라 3배 화면에도 192px면 된다. 아이콘 열일곱 개가 428KB에서 51KB가 되었다
- **앨범 이미지:** 음악 위젯·앱의 앨범 이미지를 512px WebP(화질 80)로. 742KB → 146KB
- **사과:** 1차에서 로딩 화면의 사과는 SVG로 바꿨는데, 메뉴 막대의 사과는 여전히 Font Awesome brands 글꼴이었다. 이 사과 하나 때문에 데스크톱 첫 화면이 brands 글꼴(113KB)을 수신했다. 두 곳이 같은 SVG 컴포넌트(`shared/ui/AppleLogo.tsx`)을 쓰게 했다

**효과.** 휴대폰 첫 방문 1,011KB → 725KB, 데스크톱 2,177KB → 1,848KB.

**시행착오: 청크 수 줄이기는 적용하지 않았다.** 브라우저를 실제로 느리게 하고 보니, 첫 화면이 미리 수신하는 JS 청크 33개가 줄을 서느라 마지막 청크가 5.1초에 끝났다. Rolldown의 `codeSplitting.groups`로 작은 공용 모듈을 하나의 청크로 합쳐 봤다. 그러자 의존 모듈까지 따라 들어와 672KB짜리 청크가 생겼다. 의존을 빼니 이번에는 블로그 글 하나하나(작은 모듈이다)까지 합쳐져 596KB가 되었다. 첫 방문 전송량이 오히려 늘어서 적용하지 않았다. 대기열이 생긴 것은 로컬 측정 서버가 HTTP/1.1이라 동시에 6개씩만 수신해서이기도 하다. 운영(Cloudflare)은 HTTP/2라 한 연결로 함께 수신해 청크 수에 따른 손실이 훨씬 작다.

## 8. 3차: 누르기 전에는 홈 화면을 렌더링하지 않는다

**문제.** 2차를 마치고 휴대폰 LCP를 다시 봤다. 5.8초에 잡힌 "최대 콘텐츠"는 로딩 화면 뒤에 숨어 있던 홈 화면의 "파일" 아이콘이었다. 로딩 화면은 누르기 전까지 화면을 덮는다. 그런데 그 뒤에서 앱은 바탕화면·Dock·위젯을 모두 렌더링하고 아이콘과 배경화면, 날씨를 수신하고 있었다. 크롬은 가려진 요소도 LCP 후보로 집계한다. 아무도 보지 못하는 화면이 첫 방문의 시간과 전송량을 쓰고 있었다.

```tsx
// 전 (App.tsx): 로딩 화면 뒤에서 바탕화면을 늘 그렸다
return (
	<>
		<Desktop />
		{isLoading && <LoadingScreen onLoadingComplete={handleLoadingComplete} />}
	</>
);
```

**개선 방법.**

① **누른 뒤에 렌더링한다.** `LoadingScreen`에 `onStart`를 두고, 누르는 순간에 바탕화면(휴대폰은 홈 화면)을 렌더링하기 시작한다. 진행 막대가 차는 2.5초 동안 받으면 되니, 다 찬 뒤 걷히는 화면은 그대로다. GitHub 로그인에서 돌아와 로딩 화면을 건너뛸 때는 처음부터 렌더링한다.

```tsx
// 후 (App.tsx): 누른 뒤에 바탕화면을 그린다
const [shellStarted, setShellStarted] = useState(() => !isLoadingAtStart());

return (
	<>
		{shellStarted && <Desktop />}
		{isLoading && <LoadingScreen onStart={() => setShellStarted(true)} onLoadingComplete={handleLoadingComplete} />}
	</>
);
```

② **시작 안내도 HTML로.** 1차의 `#boot-splash`에는 사과와 막대만 있었다. 여기에 "탭하여/클릭하여 로딩을 시작하세요"를 넣었다. 탭과 클릭은 앱이 쓰는 휴대폰 기준(`isMobileViewport`)과 같은 미디어 쿼리로 고른다. 이제 HTML의 첫 렌더링이 곧 최대 콘텐츠이다.

③ **스크립트보다 먼저 누르면.** 첫 렌더링에 안내가 보이니, 스크립트를 수신하는 동안 누르는 사람이 생긴다. 그 누름을 잃지 않게, `<head>`에서 먼저 실행되는 `theme-boot.js`가 첫 클릭을 기록해 둔다. 로딩 화면은 표시되자마자 이 값을 보고 바로 시작한다.

```js
// 후 (public/theme-boot.js)
addEventListener(
	'click',
	function () {
		window.__macfolioTapped = true;
	},
	{ once: true }
);
```

```tsx
// 후 (LoadingScreen.tsx)
// 스크립트를 받는 동안 첫 그림을 이미 눌렀으면 바로 시작한다
if (window.__macfolioTapped) startLoading();
```

**효과.** 누르기 전에 전송량이 휴대폰 725KB → 483KB, 데스크톱 1,848KB → 771KB가 되었다. 휴대폰 LCP는 5.8초 → 3.2초로 FCP와 같아졌다. 전송량을 없앤 것이 아니라 누른 뒤로 미룬 것이라, 누르고 들어간 뒤까지 전송량은 휴대폰 768KB로 2차와 같다. 누른 순간부터 홈 화면이 뜨기까지는 0.13초에서 0.17초로 조금 늘었지만, 그 시간은 로딩 화면 뒤다.

**시행착오.**

- **진행 막대가 멈췄다.** `App`이 다시 렌더링될 때마다 `onStart`를 새 함수로 넘기니, 그 함수를 의존성으로 둔 로딩 화면의 효과(`useEffect`)가 다시 돌며 타이머를 해제했다. 콜백은 ref에 담아 항상 최신 값을 호출하게 하고, 효과의 의존성에서 뺐다

```tsx
// 후 (LoadingScreen.tsx)
const callbacks = useRef({ onStart, onLoadingComplete });
useEffect(() => {
	callbacks.current = { onStart, onLoadingComplete };
}, [onStart, onLoadingComplete]);
```

- **E2E 하나가 깨졌다.** 설정을 바꾸고 "지금 새로고침"을 누른 뒤 Safari 탭을 보던 시험인데, 전에는 로딩 화면 뒤에 바탕화면이 이미 렌더링되어 있었다. 로딩 화면을 누르고 기다리도록 수정했다. 누르기 전에는 바탕화면이 없는지, 스크립트를 수신하는 동안 첫 렌더링을 눌러도 들어가는지 보는 시험 두 개를 더했다

## 9. 결과

| 항목            | 휴대폰 전 → 1차 → 2차 → 3차           | 데스크톱 전 → 1차 → 2차 → 3차           |
| --------------- | ------------------------------------- | --------------------------------------- |
| Lighthouse 성능 | 55 → 68 → 69~72 → **78~87**           | 62 → 90 → 93 → **98**                   |
| FCP             | 14.3초 → 4.0초 → 4.0초 → **3.2초**    | 2.5초 → 0.8초 → 0.8초 → **0.7초**       |
| LCP             | 25.7초 → 6.2초 → 5.8초 → **3.2초**    | 5.8초 → 1.9초 → 1.7초 → **1.1초**       |
| 첫 방문 전송량  | 4,893KB → 1,011KB → 725KB → **483KB** | 9,050KB → 2,177KB → 1,848KB → **771KB** |

3차의 전송량은 로딩 화면을 누르기 전까지다. 운영 사이트에서도 1차를 배포한 뒤 휴대폰이 53점에서 73점(LCP 31.5초 → 7.1초), 데스크톱이 60점에서 89점(LCP 5.8초 → 2.1초)이 되었다. 휴대폰을 브라우저에서 실제로 느리게 하면 3차는 92점, FCP·LCP 1.2~2.7초였다. 숫자를 어떻게 읽어야 하는지는 [성능 측정 리포트](/memo/site-performance-report)에 적었다.

휴대폰 점수는 5번 중 87이 셋, 78이 둘로 갈렸다. 78일 때는 React가 다시 렌더링한 시작 안내가 LCP로 집계되었는데, 왜 가끔만 그런지는 아직 모른다. 누른 뒤에 수신하는 리소스 중 큰 것은 Font Awesome solid 글꼴(117KB)이다. 쓰는 모양만 남기면 줄겠지만, 프로젝트 내용(서버)에서 아이콘 이름을 고를 수 있어 어떤 모양을 쓸지 빌드할 때 다 알 수 없다.

재측정 결과는 [성능 재측정 글](/memo/site-performance-remeasure)에 적었다.

## 시험

- **단위 시험:** 배경화면 주소(WebP), 글 저장소, Finder 트리. 860개 통과
- **E2E:** 데스크톱·iPhone·Android 617개 통과, 실패한 1개는 혼자 돌리면 통과했다(부하에 흔들리는 시험). 앱을 처음 실행할 때 로드하는 구조에 맞춰 시험 일곱 곳(2차에서 메모 관리자 시험 하나 더)을 앱이 렌더링될 때까지 기다리도록 수정했고, 배경화면·휴지통 아이콘 주소를 보는 시험은 WebP로, 새로고침 뒤 Safari를 보는 시험은 로딩 화면을 누르도록 수정했다
- **측정:** 전·후를 같은 컴퓨터에서 5번씩, 한 번에 하나씩 돌렸다. 스크립트는 `apps/react/scripts/perf/`에 있고, 다시 재는 방법은 `docs/performance.md`에 적었다

#MacFolio #성능 #웹폰트 #코드분할 #Vite #WebP

# 랜딩 템플릿 (`project/templates/`)

프로젝트 페이지의 모양(look) 가운데 여덟은 **같은 내용을 서로 다른 디자인으로 그리는 랜딩 템플릿**이다. 관리자는 시스템 설정 › 프로젝트에서 칸만 채우고, 어떤 템플릿을 골라도 완성된 랜딩 페이지가 나온다.

| id         | 콘셉트 (참고)         | 한 줄                                                                                                    |
| ---------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `product`  | Apple 제품 페이지     | 흰·검정 단색 바탕, 큰 제품 화면, 짧고 큰 문장, 넉넉한 여백, 큰 숫자                                      |
| `friendly` | Stripe                | 비스듬한 단색 띠와 줄무늬, 창과 겹친 작은 카드, 강조선 숫자, 아이콘 기능 격자, 선으로 이은 단계, 남색 띠 |
| `paper`    | Notion                | 따뜻한 흰 문서, 표지와 걸친 아이콘, 속성 표, 토글, 알림 상자, 표                                         |
| `bento`    | Framer·Raycast 템플릿 | 크기가 다른 타일 격자, 1px 선, 고정폭 작은 글자, 다크에서 가장 또렷하다                                  |
| `keynote`  | Linear·Apple 발표     | 어두운 무대(테마와 상관없이), 한 장면씩 큰 제목과 화면, 세어 올라가는 숫자, 발표자 화면 같은 화면 모음   |
| `magazine` | 잡지 케이스 스터디    | 따뜻한 종이, 명조 제목, 번호 붙은 꼭지와 인용구, 판 위의 큰 사진, 숫자 곁상자, 미주                      |
| `devtool`  | Vercel·GitHub         | 고정폭 라벨, 복사되는 clone 명령, 편집기 창, 커밋 목록, 기여 그래프, 파일 트리                           |
| `playful`  | Figma·Arc             | 크림 바탕의 색 면과 둥근 도형, 스티커, 손글씨 물결 밑줄, 구불구불 이은 단계, 붙임쪽지                    |

`friendly`가 새 프로젝트의 기본 모양이다 (`DEFAULT_LOOK`): 그림이 하나도 없는 처음 상태에서도 첫 화면 창에 프로젝트 내용으로 그린 앱 화면 모형이 들어가 꽉 차 보인다. `product`는 큰 화면이 있어야 빛난다.

이 여덟 말고 `dialogue`(RPG 대화창, `project/DialoguePage.tsx`)는 같은 내용을 선택지와 대사로 읽는 고전 RPG 콘셉트(라이트는 포켓몬, 다크는 언더테일)이고, `custom`은 코드의 일곱 프로젝트를 위해 직접 짠 페이지(`project/custom/`)다. 둘 다 이 계약 밖이다.

## 내용 모델 (`project/landing/content.ts`)

`landingOf(project, { app })`는 어떤 프로젝트든 같은 짜임으로 바꾸는 순수 함수다. 템플릿은 `useLanding(project)`(앱 이름까지 넘긴다)로 받는다. 단위 시험은 `landing/content.test.ts`.

```ts
interface Landing {
	id: string;
	hero: LandingHero; // 언제나 있다
	sections: LandingSection[]; // SECTION_ORDER 차례로, 값이 있는 구역만
	closing: { title: string; lead?: string; links: LandingLink[] }; // 언제나 있다
}
```

**첫 화면 (`hero`)**: `name`, `logo?`, `icon?`, `headline`(tagline, 비면 이름), `subhead?`(description), `meta`(`context`·`role`·`period`, 빈 것은 없다), `image?`(대표 화면, 없으면 화면 모음의 첫 그림, 영상은 건너뛴다), `links`.

**링크 (`LandingLink`)**: `app`(이 사이트 안에서 창으로 열기, 게임이면 '여기서 플레이') → `demo`(앱이 있으면 '새 탭에서 열기', 없으면 '데모 보기') → `repo`('GitHub에서 보기'). 저장소 주소가 비면 저장소 링크가 없다. `<LandingLinks links className />`가 그리고, 첫 링크에 `data-primary`, 링크마다 `data-link={kind}`가 붙는다. 앱 링크는 `<button>`이다.

**그림 (`LandingMedia`)**: `{ kind: 'image' | 'video', src, alt, dark? }`. `<Media media />`가 그린다(영상은 소리 없이 반복, 움직임 줄이기면 자동 재생 대신 컨트롤). `dark`가 있으면 사이트가 다크일 때 그 그림을 보인다.

**항목 (`LandingPoint`)**: `title`, `body`, `detail?`(펼치거나 이어 읽는 긴 설명), `icon?`(Font Awesome), `group?`, `media[]`(영상 → 그림 → 화면 여러 장 차례, 같은 주소는 한 번). `media`가 비면 `<PointArt>`(아이콘과 제목의 차분한 면)나 아이콘으로 대신한다. `iconOf(point, i)`는 아이콘이 없으면 차례에 맞는 기본 아이콘을 준다. `<PointVisual>`은 첫 그림, 없으면 `PointArt`.

### 구역 (`LandingSection`)

구역 이름(`label`)은 화면의 구역(region) 이름이자 시험과 보조 기술이 찾는 이름이다 (`SECTION_LABELS`). 차례는 `SECTION_ORDER` 그대로다.

| kind       | label            | 데이터                                                          | 생기는 때                                         |
| ---------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `stats`    | 한눈에 보는 숫자 | `facts[]` (`value`, `label`)                                    | facts가 있을 때                                   |
| `features` | 주요 기능        | `items: LandingPoint[]`                                         | highlights가 있을 때                              |
| `screens`  | 화면 모음        | `shots[]` (`LandingMedia` + `caption`)                          | gallery가 있을 때 (첫 화면 그림 한 장뿐이면 없음) |
| `steps`    | 쓰는 법          | `items: LandingPoint[]`                                         | usage가 있을 때                                   |
| `built`    | 만든 방식        | `items: LandingPoint[]`                                         | build가 있을 때                                   |
| `stories`  | 더 들려줄 이야기 | `stories[]` (`title`, `lead?`, `facts[]`, `points[]`, `image?`) | chapters가 있을 때                                |
| `controls` | 조작법           | `controls[]` (`keys[]`, `label`) — 게임 키나 앱 단축키          | controls가 있을 때                                |
| `timeline` | 진행 과정        | `entries[]` (`date`, `label`)                                   | timeline이 있을 때                                |
| `tech`     | 기술 사양        | `stack[]`(주 언어가 맨 앞), `specs[]`, `structure?`(폴더 트리)  | 셋 가운데 하나라도 있을 때                        |
| `role`     | 맡은 일          | `role?`, `period?`, `context?`, `contributions[]`               | contributions나 role이 있을 때                    |
| `credits`  | 출처             | `credits[]` (`role`, `name`, `by`, `href?`, `note?`)            | credits가 있을 때                                 |

`sectionTitle(section)`은 구역마다 기본 큰 문장(예: '필요한 것을 한곳에 담았습니다.')을 준다. 템플릿은 써도 되고 자기 문장을 써도 된다.

JSON에서만 고치는 코드 연출(항목의 `demo`·`variants`·`scrollFrames`, 장의 `look`·`palette`·`schema`·`compare`)은 직접 짠 페이지의 것이라 랜딩 내용에 없다. 편집 화면이 고치는 칸은 하나도 버리지 않는다 (`content.test.ts`의 마지막 시험이 확인한다).

## 템플릿이 지킬 계약

1. **모든 구역을 그린다.** `LandingSections`에 넘기는 렌더러 묶음(`SectionRenderers`)은 구역 종류를 빠짐없이 가져야 한다 (타입이 확인한다). 구역 안의 칸도 버리지 않는다: 항목의 `detail`·`media` 전부(화면 여러 장 포함)·`icon`, 이야기의 `lead`·`facts`·`points`·`image`, 기술의 `structure`, 출처의 `href`·`note`.
2. **빈 구역은 없다.** 값이 없는 구역은 `landing.sections`에 없으므로 그대로 그리면 된다. 구역 안에서도 빈 목록·빈 칸의 껍데기(빈 표, 빈 제목)를 그리지 않는다. 첫 화면과 마무리는 언제나 그린다 (이름만 있는 프로젝트도 완성된 페이지).
3. **구역 이름.** `LandingSections`가 구역마다 `<section aria-label={label} data-section={kind}>`로 감싼다. 안에서 `role="region"`이나 이름 붙은 `<section>`을 또 만들지 않는다 (이야기 한 장은 `<article aria-label>`). 첫 화면의 큰 제목은 `<h1>` 하나, 구역 제목은 `<h2>`, 항목은 `<h3>`. 숫자 구역처럼 보이는 제목이 없으면 `visually-hidden` `<h2>`를 둔다.
4. **라이트·다크.** 바탕 요소에 `className="tpl tpl-<id>"`를 달고, 색은 그 위의 변수로 정한 뒤 `:root[data-theme='dark'] .tpl-<id>`에서 바꾼다. 사이트 테마를 따르고, 테마와 상관없이 어두운 바탕을 강제하지 않는다. 바탕은 단색.
5. **강조색 하나.** `useLandingAccent(project.icon)`를 바탕 요소의 `style`에 달고 `var(--tpl-accent)` 하나만 쓴다 (아이콘 색에서 뽑아 흰 바탕 대비 3 이상으로 맞춘 값, 다크에서는 같은 색의 밝은 값). 강조색 위 글자는 흰색.
6. **좁은 창.** `.tpl`이 `container-type: inline-size`라서 안쪽은 `@container (max-width: 600px)`(필요하면 860px)로 한 열로 접는다. Safari 창 폭이 기준이라 `@media` 폭 조건은 쓰지 않는다. 가로 스크롤은 의도한 띠(화면 모음 등) 말고는 없다.
7. **움직임.** 나타나는 연출은 `useReveal`과 `data-reveal`(`ProjectPage.css`)만 쓴다. 움직임 줄이기면 모두 바로 보인다. 다른 애니메이션을 더하면 `@media (prefers-reduced-motion: reduce)`에서 끈다.
8. **절제.** 빛 번짐(glow), 그라데이션 글자, 유리 효과(backdrop blur), 기울기(tilt)·반사, 색 그림자, 떠다니는 카드는 쓰지 않는다. 그림자는 얕은 한 벌까지. 큰 제목 굵기는 600 안팎, 본문은 넉넉한 줄 간격. "번들번들", "무겁고 칙칙함" 둘 다 피한다.
9. **스코프.** CSS 클래스는 템플릿마다의 접두사(`pd-`·`fr-`·`pp-`·`bt-`)를 쓰고, 요소 초기화는 `:where(.tpl-<id>) :where(p)`처럼 특정도 0으로 둔다 (클래스 규칙이 이기게). 템플릿 article에는 `data-template`이 붙어 `ProjectPage.css`의 옛 요소 규칙(`.sp h3`, `.sp li > p`, `.sp a`)을 받지 않는다.
10. **글.** 화면에 넣는 문구는 완결된 존댓말 문장으로 쓰고, 구어체 조각이나 괄호 덧말을 쓰지 않는다.

## 폴더와 조각

```
templates/
├── index.ts            TEMPLATE_PAGES: id → 페이지
├── product/   Page.tsx·Page.css, Gallery.tsx(화면 띠), accent.ts(탁한 강조색이면 파랑)
├── friendly/  Page.tsx·Page.css, Mock.tsx(그림이 없을 때 첫 화면의 앱 화면 모형)
├── paper/     Page.tsx·Page.css
└── bento/     Page.tsx·Page.css, layout.ts(빈칸 없는 타일 배치), Links.tsx(글쇠 표시 링크)
landing/                템플릿이 함께 쓰는 키트
├── content.ts          landingOf, 타입, SECTION_LABELS·SECTION_ORDER, sectionTitle, iconOf
├── useLanding.ts       useLanding(project)
├── Sections.tsx        LandingSections, SectionRenderers
├── LandingLinks.tsx    링크 묶음
├── Media.tsx           Media, PointArt, PointVisual
├── accent.ts           useLandingAccent (아이콘 색 → --lk-accent·--lk-dark-accent)
└── landing.css         .tpl 기본값(--tpl-accent, container), 그림 한 쌍, PointArt
```

템플릿 폴더는 서로를 가져오지 않는다. 한 템플릿만 고칠 때는 그 폴더만 바꾼다. 여럿이 함께 쓸 것이 생기면 `landing/`에 둔다.

## 템플릿을 더하는 법

1. `packages/desktop-core/src/site/projects.ts`의 `PROJECT_LOOKS`에 id를 더하고 주석에 콘셉트를 적는다 (서버와 화면이 함께 쓴다). 예전 이름을 없앨 때는 `LEGACY_LOOKS`에 옮길 곳을 적어 저장해 둔 값이 그대로 보이게 한다 (`projects.test.ts`).
2. `templates/<id>/Page.tsx`와 `Page.css`를 만든다. `useLanding`·`useReveal`·`useLandingAccent`로 시작하고, 첫 화면 → `<LandingSections renderers={…} />` → 마무리 차례로 그린다. 기존 템플릿 하나를 복사해 시작하면 빠르다.
3. `templates/index.ts`의 `TEMPLATE_PAGES`에 넣는다.
4. 편집 화면(`apps/settings/ProjectsPane.tsx`)의 `LOOKS`(이름·짧은 설명)와 `SKETCH`(모양 카드의 작은 도식), `apps/settings/lookSamples.ts`의 `LOOK_SAMPLES`(공통 예시를 모양만 바꿔)와 `LOOK_FIELDS`(`LANDING_FIELDS`)에 더한다.
5. `e2e/looks/<id>.spec.ts`를 만든다. `e2e/looks/landing.ts`의 도우미로 예시의 모든 구역과 차례, 빈 프로젝트, 주요 기능만 있는 프로젝트, 링크, 라이트·다크 바탕색을 본다.

## 예시와 시험

- 예시: `apps/settings/lookSamples.ts`의 `GENERAL_SAMPLE` 하나를 네 템플릿이 함께 쓴다 ('예시로 채우기'). 모든 구역과 항목 칸(아이콘, 다크 짝이 있는 그림, 화면 여러 장, 장의 숫자와 그림, 조작법, 폴더 구조, 출처)을 채운다.
- 단위: `landing/content.test.ts`(빈 구역 빠짐, 차례, 첫 화면 그림, 링크, 칸 보존), `lookSamples.test.ts`, desktop-core의 `projects.test.ts`(예전 이름 옮기기).
- E2E: `e2e/looks/{product,friendly,paper,bento}.spec.ts`.

마무리(`closing`)는 첫 화면의 제목을 되풀이하지 않는다. 써 볼 곳(앱·데모)이 있으면 '지금 바로 써 볼 수 있습니다.', 저장소만 있으면 '코드와 기록을 살펴볼 수 있습니다.'를 제목으로 하고 이름을 덧붙인다.

`keynote`는 무대 콘셉트라 사이트 테마와 상관없이 어두운 바탕을 쓴다. 계약의 '어두운 바탕을 강제하지 않는다'의 유일한 예외다.

예시 아이콘처럼 강조색이 노랑~연두로 탁해지면, 여러 템플릿이 자기 폴더의 `accent.ts`에서 그 템플릿의 기본 강조색으로 돌린다(제품 파랑, 카드 남보라, 키노트 남보라, 매거진 빨강, 개발자 도구 파랑, 놀이 산호).

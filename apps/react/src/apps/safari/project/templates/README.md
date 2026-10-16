# 랜딩 템플릿 (`project/templates/`)

프로젝트 페이지의 모양(look) 가운데 아홉은 **같은 내용을 서로 다른 디자인으로 그리는 랜딩 템플릿**이다. 관리자는 시스템 설정 › 프로젝트에서 칸만 채우고, 어떤 템플릿을 골라도 완성된 랜딩 페이지가 나온다.

| id         | 콘셉트 (참고)         | 한 줄                                                                                                                                |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `product`  | Apple 제품 페이지     | 스크롤 이야기: 화면을 채우는 대표 화면, 숫자 하나에 한 장면, 기능 하나에 한 장면(점으로 고르기), 나머지는 차례 막대가 붙은 사양 장   |
| `friendly` | Stripe                | 붙는 위 막대, 단색 띠 첫 화면, 기능을 고르면 오른쪽 창이 바뀌는 탐색기, 펼치는 트러블슈팅 사례, 로고 벽, 가로 로드맵, 남색 마무리 띠 |
| `paper`    | Notion                | 왼쪽 페이지 트리 사이드바와 이동 경로, 표지·속성 표, 접힌 토글, 표·보드·갤러리로 바꾸는 데이터베이스                                 |
| `bento`    | Framer·Raycast 템플릿 | 한 판의 대시보드: 빈칸 없는 타일 보드, 작은 차트, 줄을 누르면 자세히 보기 창, 더 보기로 모든 내용                                    |
| `keynote`  | Linear·Apple 발표     | 스크롤 없는 16:9 슬라이드 덱: ←→로 넘기기, 진행 줄, 슬라이드 목록(G)·발표자 노트(N), 트러블슈팅 빌드                                 |
| `magazine` | 인쇄 잡지             | 표지(제호·호수·표지 문구), 차례 펼침면, 쪽 번호가 이어지는 두 쪽 펼침면, Q/A 인터뷰 트러블슈팅, 뒤표지                               |
| `devtool`  | Vercel·Next.js 문서   | 문서 사이트: 위 막대와 ⌘K 검색 팔레트, 왼쪽 문서 목차, 구역마다 문서 페이지, 오른쪽 이 페이지에서 목차, 빠른 시작                    |
| `repo`     | GitHub 저장소 화면    | 첫 화면 없이 저장소 머리와 탭, 파일 트리, 문서 탭(README·docs/), 옆 칸, 커밋 그래프, 커밋 규칙, 터미널 서랍                          |
| `playful`  | 스크랩북 게시판       | 점 무늬 판에 붙인 폴라로이드·붙임쪽지·우표, 뒤집는 트러블슈팅 카드, 사진 부스 띠, 입장권 배포 링크                                   |

`friendly`가 새 프로젝트의 기본 모양이다 (`DEFAULT_LOOK`): 그림이 하나도 없는 처음 상태에서도 첫 화면 창에 프로젝트 내용으로 그린 앱 화면 모형이 들어가 꽉 차 보인다. `product`는 큰 화면이 있어야 빛난다.

템플릿마다 색과 글꼴이 아니라 **페이지 구조와 읽는 방식**이 다르다. 한 번에 한 부분만 보이는 템플릿(`keynote` 슬라이드, `devtool` 문서 페이지, `bento` 자세히 보기 창, `repo` 문서 탭)은 열면 보이는 허용 변형이고, 각 E2E가 모든 구역에 차례대로 닿는지 확인한다. 구역 제목 문장은 템플릿마다 자기 말투로 덮어쓰고, 구역 이름(aria-label)은 `SECTION_LABELS` 그대로다.

이 아홉 말고 `dialogue`(RPG 대화창, `project/DialoguePage.tsx`)는 같은 내용을 선택지와 대사로 읽는 언더테일 같은 대화 화면이고, `custom`은 코드의 일곱 프로젝트를 위해 직접 짠 페이지(`project/custom/`)다. 둘 다 이 계약 밖이다. `dialogue`도 같은 예시(`GENERAL_SAMPLE`)를 쓰고, 자기만의 편집 칸은 없다 (폴더 구조만 읽지 않는다).

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

| kind              | label            | 데이터                                                                             | 생기는 때                                         |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| `stats`           | 한눈에 보는 숫자 | `facts[]` (`value`, `label`)                                                       | facts가 있을 때                                   |
| `features`        | 주요 기능        | `items: LandingPoint[]`                                                            | highlights가 있을 때                              |
| `screens`         | 화면 모음        | `shots[]` (`LandingMedia` + `caption`)                                             | gallery가 있을 때 (첫 화면 그림 한 장뿐이면 없음) |
| `steps`           | 쓰는 법          | `items: LandingPoint[]`                                                            | usage가 있을 때                                   |
| `built`           | 구현 방법        | `items: LandingPoint[]`                                                            | build가 있을 때                                   |
| `troubleshooting` | 트러블슈팅       | `items[]` (`title`, `problem`, `cause?`, `solution`, `result?`, `icon?`, `image?`) | troubleshooting이 있을 때                         |
| `stories`         | 더 들려줄 이야기 | `stories[]` (`title`, `lead?`, `facts[]`, `points[]`, `image?`)                    | chapters가 있을 때                                |
| `controls`        | 조작법           | `controls[]` (`keys[]`, `label`) — 게임 키나 앱 단축키                             | controls가 있을 때                                |
| `tech`            | 기술 사양        | `stack[]`(주 언어가 맨 앞), `specs[]`, `structure?`(폴더 트리)                     | 셋 가운데 하나라도 있을 때                        |
| `team`            | 팀원             | `members[]` (`name`, `role`, `url?`, `avatar?`, `initials`, `me`)                  | team이 있을 때                                    |
| `role`            | 내 역할          | `role?`, `period?`, `context?`, `contributions[]`                                  | contributions나 role이 있을 때                    |
| `timeline`        | 진행 과정        | `entries[]` (`date`, `label`)                                                      | timeline이 있을 때                                |
| `deployments`     | 배포 결과물      | `items[]` (`label`, `url?`, `platform?`, `note?`, `icon`, `host?`, `image?`)       | deployments가 있을 때                             |
| `credits`         | 출처             | `credits[]` (`role`, `name`, `by`, `href?`, `note?`)                               | credits가 있을 때                                 |

차례는 포트폴리오를 읽는 순서다. 무엇인지(숫자·기능·화면·쓰는 법) → 어떻게 만들었는지(구현 방법·트러블슈팅·이야기·조작법·기술) → 누가 만들었는지(팀원·내 역할) → 언제(진행 과정) → 어디서 볼 수 있는지(배포 결과물) → 출처.

**트러블슈팅·팀원·배포 결과물**은 짜임을 `landing/Extras.tsx`의 `TroubleList`·`TeamList`·`DeployList` 하나로 함께 쓴다. 템플릿은 자기 구역 머리 아래에 `<TroubleList items prefix="pd" />`처럼 접두사를 넘기고, 공통 클래스(`lk-trouble`…)와 접두사 클래스(`pd-trouble`…)가 함께 붙는다. 모양은 `landing.css`의 공통 짜임 위에 템플릿이 `.tpl-<id>`에서 `--lk-x-ink`·`--lk-x-body`·`--lk-x-muted`·`--lk-x-line`·`--lk-x-card`·`--lk-x-radius`·`--lk-x-gap`·`--lk-x-pad`·`--lk-x-label`(이름표 글꼴)을 정하고 접두사 클래스로 더한다. 그림이 없어도 비지 않게: 트러블슈팅은 아이콘(`troubleIcon`, 기본 fa-bug)과 번호, 문제 → 원인 → 해결 → 결과 단계 띠(`troubleSteps`, 빈 단계는 빠진다), 팀원은 사진이 없으면 이름 첫 글자(`MemberAvatar`, `initialsOf`)와 나의 강조, 배포 결과물은 올린 곳 아이콘(`deploymentIcon`, 브랜드 아이콘은 `faClass`가 fa-brands로)과 공개 상태, 호스트 이름이다. 저장소(`repo`)만 GitHub답게 자기 마크업을 쓴다 (알림 상자, 사진 달린 표, Deployments 목록, 옆 칸의 Deployments·Contributors).

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
├── bento/     Page.tsx·Page.css, layout.ts(빈칸 없는 타일 배치), Links.tsx(글쇠 표시 링크)
└── repo/      Page.tsx·Page.css, Files.tsx(파일 상자), Readme.tsx(구역 렌더러), Terminal.tsx·shell.ts(터미널 서랍), repo.ts(커밋·트리·문서와 그 원문)
landing/                템플릿이 함께 쓰는 키트
├── content.ts          landingOf, 타입, SECTION_LABELS·SECTION_ORDER, sectionTitle, iconOf, troubleSteps, deploymentIcon, faClass
├── useLanding.ts       useLanding(project)
├── Sections.tsx        LandingSections, SectionRenderers
├── LandingLinks.tsx    링크 묶음
├── Media.tsx           Media, PointArt, PointVisual
├── Extras.tsx          TroubleList, TeamList, DeployList, MemberAvatar, FaIcon
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

- 예시: `apps/settings/lookSamples.ts`의 `GENERAL_SAMPLE` 하나를 모든 템플릿과 RPG 대화창이 함께 쓴다 ('예시로 채우기'). 모든 구역과 항목 칸(아이콘, 다크 짝이 있는 그림, 화면 여러 장, 장의 숫자와 그림, 조작법, 폴더 구조, 출처, 트러블슈팅 세 건(그림이 있는 것과 없는 것), 팀원 네 명(나 한 사람), 배포 결과물 세 곳)을 채운다.
- 단위: `landing/content.test.ts`(빈 구역 빠짐, 차례, 첫 화면 그림, 링크, 칸 보존), `lookSamples.test.ts`, desktop-core의 `projects.test.ts`(예전 이름 옮기기).
- E2E: `e2e/looks/{product,friendly,paper,bento,keynote,magazine,devtool,repo,playful,dialogue}.spec.ts`.

마무리(`closing`)는 첫 화면의 제목을 되풀이하지 않는다. 써 볼 곳(앱·데모)이 있으면 '지금 바로 써 볼 수 있습니다.', 저장소만 있으면 '코드와 기록을 살펴볼 수 있습니다.'를 제목으로 하고 이름을 덧붙인다.

`keynote`는 무대 콘셉트라 사이트 테마와 상관없이 어두운 바탕을 쓴다. 계약의 '어두운 바탕을 강제하지 않는다'의 예외다. 계약 밖의 `dialogue`도 게임 화면이라 라이트·다크 모두 검은 무대다(`dialogue.spec.ts`가 두 테마의 바탕이 `rgb(0, 0, 0)`인지 본다). 흰 테두리 대화 상자 하나와 그 위의 그림 액자(원래 모습 그대로, 없으면 프로젝트 아이콘), 이름과 읽음 막대 한 줄뿐이고, 풍경이나 픽셀로 바꾼 그림은 그리지 않는다.

예시 아이콘처럼 강조색이 노랑~연두로 탁해지면, 여러 템플릿이 자기 폴더의 `accent.ts`에서 그 템플릿의 기본 강조색으로 돌린다(제품 파랑, 카드 남보라, 키노트 남보라, 매거진 빨강, 개발자 도구 파랑, 저장소 GitHub 파랑, 놀이 산호).

`repo`는 GitHub 저장소 화면이다. 다른 템플릿과 달리 랜딩식 첫 화면(가운데 놓인 큰 제목, 단추, 창 속 대표 화면)이 없고 저장소 머리(owner / 이름, Public, Watch·Fork·Star 링크)와 탭 줄(Code · Commits · Conventions)로 바로 열린다. 그래서 첫 화면의 칸은 저장소 화면의 제자리로 간다: 큰 제목(`headline`)은 README 첫머리의 `<h1>`, 소개는 그 아래 글, 대표 화면은 README의 첫 그림, 링크 묶음은 옆 칸 About 안의 GitHub 단추이고, 마무리는 맨 아래의 얇은 줄이다. README가 보이지 않는 동안(다른 문서나 Commits 탭)에는 숨긴 `<h1>`이 같은 제목을 지켜 페이지의 h1이 늘 하나다. Code 탭은 가지 줄(main, 가지·태그 수, clone 주소를 복사하는 초록 Code 단추), 마지막 커밋 줄과 파일 상자, README 상자 차례다.

README 상자는 구역을 한 문서에 몰지 않고 **구역마다 문서 하나**로 나눈다. '모든 구역을 그린다'의 허용된 변형으로, 구역은 모두 있되 상자 위의 문서 탭(`nav aria-label="문서"`와 `aria-current` 단추, 구역 차례)으로 한 번에 한 문서만 보인다. README.md(큰 제목·소개·대표 화면·숫자 구역·목차)는 언제나 있고 처음 열린다. 나머지는 내용이 있는 구역만 `docs/FEATURES.md`(주요 기능), `SCREENSHOTS.md`(화면 모음), `USAGE.md`(쓰는 법), `ARCHITECTURE.md`(구현 방법), `TROUBLESHOOTING.md`(트러블슈팅, GitHub 알림 상자), `STORIES.md`(더 들려줄 이야기), `CONTROLS.md`(조작법), `CHANGELOG.md`(진행 과정, 릴리스 목록 v0.1.0 … v1.0.0), `TECH.md`(기술 사양, Built with 주제·표·폴더 구조), `TEAM.md`(팀원, 사진 달린 표), `CONTRIBUTING.md`(내 역할, 할 일 목록), `DEPLOYMENT.md`(배포 결과물), `CREDITS.md`(출처)다. 문서의 구역도 `<section aria-label={구역 이름}>`이고, 상자 머리의 경로 줄이 `이름 / docs / FEATURES.md`와 `blob/main/docs/FEATURES.md`를 보여 준다. 파일 상자의 폴더 구조 트리(DevCourse는 실제 저장소 `repo.json` 탐색기라 문서를 더하지 않는다)에는 README.md 줄과 `docs/` 폴더가 더해져, 문서 파일을 누르면 README 상자가 그 문서를 열고 화면이 상자로 내려간다. 터미널 서랍의 셸도 같은 트리를 돌아보아 `ls docs`, `cat docs/USAGE.md`(문서의 마크다운 원문)가 된다. 그래서 E2E는 공통 도우미 `expectSampleRendered` 대신 문서 탭을 차례로 열며 구역의 차례와 내용을 본다(`repo.spec.ts`).

옆 칸(About·Releases·Deployments·Contributors·Languages)은 첫 화면 내용의 요약이라 구역이 아니다. Commits 탭은 진행 과정을 커밋 그래프로 그리고 타입(커밋 규칙 `conventions`, 없으면 Conventional Commits 기본 타입)으로 거르며, Conventions 탭은 커밋 규칙이 있을 때만 생긴다. 저장소 탭과 문서 탭은 Safari 창의 탭(role=tab)과 섞이지 않게 `nav`와 `aria-current` 단추이고, 터미널 서랍은 구역이 아닌 `aside`(complementary)다.

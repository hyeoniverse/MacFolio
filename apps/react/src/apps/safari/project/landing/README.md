# 랜딩 페이지 키트 (`project/landing/`)

템플릿(`project/*Page.tsx`)이 "브랜드 제품 랜딩 페이지"처럼 보이도록 함께 쓰는 조각. 기본값은 절제: 단색 바탕, 그라데이션 글자·빛 번짐·유리·기울기 없음, 얕은 그림자 한 벌, 강조색 하나. 모두 `@/apps/safari/project/landing`에서 가져온다.
CSS 클래스는 `lk-` 접두사, 장식 조각은 `aria-hidden`, 움직임은 `prefers-reduced-motion`이면 멈춘다.

## 톤 변수

페이지(또는 아무 바깥 요소)에 `--lk-*`를 두면 안쪽 조각이 모두 그 색을 쓴다. 없으면 라이트·다크(`:root[data-theme='dark']`) 기본값.

| 변수                                  | 쓰임                                    |
| ------------------------------------- | --------------------------------------- |
| `--lk-accent`, `--lk-accent-2`        | 강조색 하나와 그 옅은 값 (단추, 그래프) |
| `--lk-surface`, `--lk-surface-2`      | 바탕, 한 단계 진한 바탕(카드·벤토 칸)   |
| `--lk-ink`, `--lk-muted`, `--lk-line` | 글자, 흐린 글자, 선                     |
| `--lk-radius`                         | 카드 모서리 (기본 20px)                 |
| `--lk-dark-*` / `--lk-light-*`        | `data-lk-tone`으로 톤을 고정했을 때     |
| `--lk-bento-row`, `--lk-bento-gap`    | 벤토 한 줄 높이(220px)·틈(16px)         |

- `data-lk-tone="dark" | "light"`: 페이지 테마와 상관없이 그 톤. 아무 요소에나 달면 안쪽 조각 중 톤을 따로 받지 않은 것이 모두 따른다 (어두운 히어로 띠 등).
- 아이콘 색으로 칠하기: `const accent = useLandingAccent(project.icon)` → 페이지 바탕에 `style={accent}` (`--lk-accent`·`--lk-accent-2`를 돌려준다. 못 읽으면 빈 묶음).

## 조각

**`DeviceFrame`** 그림·영상·자식을 기기 틀에. `kind` `'browser' | 'laptop' | 'phone' | 'tablet'`, `src`(.mp4는 영상), `alt`, `url`(주소 막대), `shadow`(얕은 그림자 한 벌, 기본 켬). 폭은 바깥이 정한다. 기본은 똑바로·광택 없이; `tilt`·`glow`·`reflection`은 남아 있지만 기본 끔이고 켜도 옅다 (절제한 화면에는 쓰지 않는다).

```tsx
<DeviceFrame kind="browser" url={project.demo}>{project.image ? <img … /> : <MockScreen project={project} decorative />}</DeviceFrame>
```

**`MockScreen`** 그림이 없을 때 프로젝트 데이터로 그린 제품 화면 (앱 이름·아이콘 상단 바, 주요 기능 사이드바, facts 숫자 카드·그래프, 항목 목록). 보이는 글은 모두 데이터에서 온다. `kind` `'dashboard' | 'list' | 'chat' | 'editor' | 'mobile' | 'game'`(기본 `pickMockKind(project)`), `focus`(본문에 올릴 주요 기능 차례), `tone`, `tint`(아이콘 색, 기본 켬), `decorative`(보조 기술에 숨김). 홀로 쓰면 16:10(mobile 9:19.5), 틀 안에서는 꽉 채운다. 글자 크기가 폭에 비례한다.

```tsx
<MockScreen project={project} kind={pickMockKind(project)} focus={active} />
```

**`FeatureVisual`** 항목(point)에 그림이 없을 때의 비주얼: 큰 아이콘 타일 + 그 항목 제목을 담은 UI 조각. `point`, `index`(변형 `toast · window · orbit · meter`를 돌려 쓴다), `project`(앱 이름·기술 칩), `variant`(직접 고르기), `tone`. 칸을 꽉 채운다(최소 220px).

```tsx
{point.image ? <img … /> : <FeatureVisual point={point} index={i} project={project} />}
```

**`GlowBackdrop`** 히어로 뒤 단색 바탕 + 아주 옅은 격자/점 무늬. `tone` `'dark' | 'light'`, `pattern` `'grid' | 'dots' | 'none'`, `focus` `'top' | 'center' | 'side'`, `glow`(강조색 한 덩어리를 옅게, 기본 끔), `animate`(glow일 때만, 기본 끔). 부모는 `position: relative`, 글은 `z-index: 1`.

```tsx
<header style={{ position: 'relative' }} data-lk-tone="dark">
	<GlowBackdrop tone="dark" focus="side" />
	<div style={{ position: 'relative', zIndex: 1 }}>…</div>
</header>
```

**`SectionHeader`** 구역 머리: `eyebrow`, `title`, `lead`, `align` `'center' | 'start'`, `as` `'h2' | 'h3'`, `tone`, `id`(구역의 aria-labelledby용).

```tsx
<SectionHeader eyebrow="주요 기능" title={project.tagline} lead={project.description} />
```

**`StatBand`** 큰 숫자 띠 (facts, 화면에 들어오면 세어 올라감). `facts`, `tone`, `label`(기본 '한눈에'). 넷까지 한 줄, 좁으면 두 칸씩.

```tsx
<StatBand facts={project.facts} />
```

**`LogoStrip`** 기술 이름을 로고처럼 보이는 글자 줄로. `items`, `marquee`(흐르는 띠), `caption`, `label`(기본 '기술').

```tsx
<LogoStrip items={project.stack} caption="만든 기술" marquee />
```

**`CtaBand`** 마지막 행동 유도 띠: 단색 바탕에 큰 문장 + 링크(parts의 `Links`). `project`, `title`(기본 tagline), `lead`(기본 description), `tone`(기본 dark), `showIcon`, `pattern`(옅은 무늬, 기본 `'none'`).

```tsx
<CtaBand project={project} title="지금 열어 보세요." />
```

**`BentoGrid`** 항목 수에 맞춰 큰 칸(4×2)·작은 칸(2×1)·넓은 칸(6×1, 3×1)을 섞는 6열 격자. 몇 개든 빈 칸이 없다(`bentoLayout(n)`, 덩어리마다 큰 칸이 좌우를 번갈아). `items`, `render(item, cell, index)`(`cell.size` `'lg' | 'wide' | 'sm'`으로 꼴을 고른다), `itemKey`, `label`, `framed`(카드 테두리, 기본 켬). 컨테이너 640px 아래는 한 열.

```tsx
<BentoGrid
	items={project.highlights}
	label="주요 기능"
	render={(point, cell, i) => <Card point={point} size={cell.size} index={i} />}
/>
```

## 도우미 (`mock.ts`, `bento.ts`, `accent.ts`)

`pickMockKind(project)`, `mockSeries(seed, n)`(0~1 오르는 그래프 값), `parseFactNumber('1,800명')`, `shortName(project)`, `iconOf(point, i)`, `bentoLayout(n)`, `accentVars(colors)`, `useLandingAccent(icon)`.

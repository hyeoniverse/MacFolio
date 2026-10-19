---
title: 1,861줄짜리 데모 파일을 데모마다 한 파일로
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: HYEONIVERSE 페이지의 데모 여덟 개와 색 계산이 한 파일(1,861줄)에 있었다. 데모마다 한 파일로 나누고 둘 이상이 쓰는 것만 따로 뽑으니 가장 큰 파일이 401줄이 됐고, 색 계산에는 처음으로 단위 시험 7개가 생겼다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 첫 번째. 가장 큰 파일부터.

## 왜 한 파일이었나

HYEONIVERSE 프로젝트 페이지에는 그 사이트의 관리자 기능을 흉내 내는 데모가 있다. 발표 갤러리, 음성 만들기, 파형 편집, PDF·PPTX 변환, 번역, 요약, 커버, 그리고 테마 미리보기. 하나씩 붙이다 보니 전부 `CreativeDemos.tsx` 한 파일에 쌓였고 1,861줄이 됐다. 데모 하나를 고치려면 다른 데모 사이를 스크롤해야 했고, 어느 상수가 어느 데모 것인지 파일 안에서는 알 수 없었다.

## 고른 방법과 버린 방법

| 방법                                            | 장점                   | 단점                                              |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------- |
| 종류별 폴더 (`components/`, `hooks/`, `utils/`) | 흔한 구조              | 데모 하나를 고치려면 세 폴더를 오간다             |
| 데모마다 폴더 (`voice/Voice.tsx`, `voice/…`)    | 데모가 커져도 넉넉하다 | 지금은 데모마다 파일 한두 개라 폴더가 비어 보인다 |
| 데모마다 파일, 함께 쓰는 것만 따로              | 파일 이름 = 데모 이름  | 데모가 더 커지면 다시 나눠야 한다                 |

지금 크기에는 세 번째가 맞았다. 데모 하나가 400줄을 넘으면 그때 폴더로 바꾼다.

## 나눈 모양

```
safari/project/creative/
├── Demo.tsx        종류 → 데모 (CreativeChapters가 쓴다)
├── Slides.tsx  Voice.tsx  Wave.tsx  Convert.tsx
├── Translate.tsx  Summary.tsx  Cover.tsx  Themes.tsx
├── demoEvent.ts    데모가 페이지(몽이)에 상태를 알리는 이벤트
├── useInView.ts    화면 안에 들어왔는지
├── slideDeck.ts    발표 장 목록 (Slides와 Convert가 함께 쓴다)
├── liveDemo.ts     실제 AI를 부르는 데모의 서버 호출과 남은 횟수
├── QuotaChip.tsx   남은 횟수 칩
└── color.ts        WCAG 대비, OKLab 명도 옮기기 (+ color.test.ts)
```

기준은 하나다. **한 데모만 쓰는 것은 그 데모 파일 안에, 둘 이상이 쓰는 것은 따로.** 그래서 `FISH_SAMPLE`(파형 편집기가 트는 음성 파일)은 음성 데모 쪽에 적혀 있었지만 파형 데모만 쓰기에 그쪽으로 옮겼고, 발표 장 목록은 갤러리와 변환 데모가 같이 써서 `slideDeck.ts`가 됐다.

![CreativeDemos.tsx 한 파일이 데모별 파일 여덟 개와 공유 모듈 여섯 개로 나뉜 모습](./images/split-creative-demos-tree.svg '한 데모만 쓰는 것은 그 안에, 둘 이상이 쓰는 것은 따로')

![나눈 직후 파일별 줄 수 막대](./images/split-creative-demos-lines.svg '1,861줄이 15개 파일로')

## CMS 도식도 같은 방식으로

데모 파일 옆의 `CreativeCms.tsx`(970줄)에는 관리자·CMS 장의 도식 여덟 개(자동 저장, 글의 일생, 댓글, 메일함, 초대, 역할, 주방, 공급자)가 들어 있었다. 서로 아무것도 공유하지 않는 독립 컴포넌트들이라 `creative/cms/`에 하나씩 떼어 놓기만 했다. 가장 큰 공급자 도식이 337줄, 나머지는 50~130줄이다.

## 알게 된 것

- **react-refresh 규칙**: ESLint의 `react-refresh/only-export-components`가 "컴포넌트와 훅을 한 파일에서 같이 export하지 말라"고 했다. 훅(`useLiveDemo`)과 칩 컴포넌트(`QuotaChip`)를 한 파일에 두었다가 둘로 나눴다. 한 파일에 섞여 있을 때는 이 규칙이 걸리지 않았다. export가 없었으니까
- **순수 함수가 드러난다**: 색 계산(`contrast`, `readableAccent`, `textOnAccent`)은 DOM도 React도 필요 없는데 컴포넌트 파일 안에 있어서 시험이 없었다. 따로 나오자마자 단위 시험 7개를 붙였다. "연한 노랑을 흰 바탕 위에 올리면 어두워지되 여전히 노란 계열"처럼 눈으로 확인하던 것이 글로 남는다
  시험은 이런 모양이다. 예전에는 테마 미리보기 화면을 눈으로 보며 확인하던 것이다.

```ts
it('모자라면 바탕 반대쪽으로 명도를 옮겨 4.5를 넘기고, 색상은 비슷하게 둔다', () => {
	const fixed = readableAccent('#ffd27f', '#ffffff'); // 연한 노랑 위 흰 바탕
	expect(fixed).not.toBe('#ffd27f');
	expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
	// 어두워졌지만 여전히 노란 계열 (빨강 성분이 파랑보다 크다)
	const [r, , b] = [1, 3, 5].map((i) => parseInt(fixed.slice(i, i + 2), 16));
	expect(r).toBeGreaterThan(b);
});
```

- 가져오는 쪽은 둘뿐이었다. `CreativeChapters`는 `Demo`를, `CreativePage`는 `Themes`와 데모 이벤트를. 경로만 바꿨고 동작은 그대로다

## 대소문자만 다른 파일 이름

처음에는 발표 장 목록을 `slides.ts`로 두었다. 같은 폴더에 갤러리 데모 `Slides.tsx`가 있다. 리눅스(CI)에서는 두 파일이 따로 보여 시험이 모두 통과했는데, macOS에서는 타입 검사와 빌드가 깨졌다. macOS의 기본 파일 시스템은 대소문자를 구분하지 않아서, `import { Slides } from './Slides'`를 `Slides.ts`부터 찾다가 `slides.ts`를 집었다. 그 파일에는 `Slides`가 없다. 목록 파일 이름을 `slideDeck.ts`로 바꿨다. 대소문자만 다른 이름은 같은 폴더에 두지 않는다.

## 확인

- 데모 파일 나누기는 20파일, 2,007줄 추가와 1,863줄 삭제였다. 늘어난 144줄은 거의 조각마다 생긴 import와 시험 파일이다.
- 새 단위 시험은 `creative/color.test.ts` 7개다. 대비(WCAG) 2개, 읽히는 강조색 3개, 강조색 위 글자색 2개.
- 동작은 바꾸지 않았으므로 Safari 프로젝트 페이지 E2E(`e2e/safari.spec.ts`)를 고치지 않고 그대로 통과시켰다.
- 대소문자 문제는 CI(리눅스)에서는 잡히지 않았고 macOS에서 타입 검사를 돌릴 때 드러났다.

## 남은 것·배운 것

- 큰 파일을 나누면 그 안에 숨어 있던 순수 함수가 보인다. 색 계산은 처음부터 시험할 수 있는 코드였는데, 컴포넌트 파일 안에 있어서 아무도 시험할 생각을 못 했다.
- CI가 리눅스 하나라면 대소문자만 다른 파일 이름은 잡히지 않는다. 규칙(같은 폴더에 두지 않기)으로 막는다.
- 린트 규칙은 파일 경계에서 비로소 작동하는 것이 있다. `only-export-components`는 한 파일일 때는 걸릴 일이 없었다.
- 나누는 기준을 하나("한 데모만 쓰면 그 안에, 둘 이상이면 따로")로 정해 두니 상수 하나하나를 어디 둘지 고민할 일이 줄었다.

## 같은 방식으로 나눌 때

큰 파일을 나눌 때는 동작이 같다는 것을 시험으로 보이면서 한 단계씩 간다.

```bash
pnpm typecheck && pnpm lint
cd apps/react && npx vitest run src/apps/safari
npx playwright test e2e/safari.spec.ts
cd ../.. && pnpm cycles
```

대소문자만 다른 파일 이름은 macOS에서 한 파일로 보이니, 이름을 바꿀 때는 `git mv Slides.tsx tmp && git mv tmp slides.ts`처럼 두 번에 나눈다.

참고 문서: [git mv](https://git-scm.com/docs/git-mv), [React 코드 나누기(lazy)](https://react.dev/reference/react/lazy).

## 관련 글

- 2단계 두 번째, 폴더 사이드바와 휴대폰 사진 앱: /memo/split-sidebar-photos
- 리팩터링 2단계 정리: /memo/refactor-step2-structure
- PR: https://github.com/hyeoniverse/MacFolio/pull/189

#MacFolio #리팩터링 #React

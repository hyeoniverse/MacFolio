---
title: 둘 이상이 쓰는 코드만 공유 모듈로 추출해 큰 데모 파일 분리하기
date: 2026-10-10
category: 개발 기록/MacFolio/아키텍처
series: 모듈 구조
seriesOrder: 2
summary: HYEONIVERSE 페이지의 데모 여덟 개와 색 계산이 한 파일(1,861줄)에 있었다. 데모마다 한 파일로 분리하고 둘 이상이 사용하는 코드만 별도 모듈로 추출하자 가장 큰 파일이 401줄이 됐고, 색 계산에는 처음으로 단위 시험 7개가 생겼다.
---

이 글은 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 첫 작업 기록이다. 가장 큰 파일부터 분리했다.

## 한 파일에 누적된 경위

HYEONIVERSE 프로젝트 페이지에는 그 사이트의 관리자 기능을 재현하는 데모가 있다. 발표 갤러리, 음성 생성, 파형 편집, PDF·PPTX 변환, 번역, 요약, 커버, 테마 미리보기의 여덟 개다. 데모를 하나씩 추가하면서 모두 `CreativeDemos.tsx` 한 파일에 누적됐고 1,861줄이 됐다. 데모 하나를 수정하려면 다른 데모 코드 사이를 스크롤해야 했고, 어느 상수가 어느 데모에 속하는지 파일 안에서는 구분할 수 없었다.

## 검토한 방법

| 방법                                            | 장점                           | 단점                                                |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| 종류별 폴더 (`components/`, `hooks/`, `utils/`) | 일반적인 구조                  | 데모 하나를 수정하려면 세 폴더를 오가야 한다        |
| 데모마다 폴더 (`voice/Voice.tsx`, `voice/…`)    | 데모가 커져도 확장 여유가 있다 | 현재는 데모마다 파일이 한두 개라 폴더 구조가 과하다 |
| 데모마다 파일, 공유 코드만 별도 (**채택**)      | 파일 이름 = 데모 이름          | 데모가 더 커지면 다시 분리해야 한다                 |

현재 규모에는 세 번째 방법이 적합했다. 데모 하나가 400줄을 넘으면 그 시각에 폴더로 전환한다.

## 분리한 구조

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

기준은 하나다. **한 데모만 사용하는 코드는 그 데모 파일 안에, 둘 이상이 사용하는 코드는 별도 모듈로.** 그래서 `FISH_SAMPLE`(파형 편집기가 재생하는 음성 파일)은 음성 데모 쪽에 정의되어 있었지만 파형 데모만 사용하므로 파형 데모로 이동했고, 발표 장 목록은 갤러리와 변환 데모가 함께 사용해서 `slideDeck.ts`로 분리했다.

![CreativeDemos.tsx 한 파일이 데모별 파일 여덟 개와 공유 모듈 여섯 개로 나뉜 모습](./images/split-creative-demos-tree.svg '한 데모만 쓰는 것은 그 안에, 둘 이상이 쓰는 것은 따로')

![나눈 직후 파일별 줄 수 막대](./images/split-creative-demos-lines.svg '1,861줄이 15개 파일로')

## CMS 도식도 같은 방식으로

데모 파일 옆의 `CreativeCms.tsx`(970줄)에는 관리자·CMS 장의 도식 여덟 개(자동 저장, 글의 일생, 댓글, 메일함, 초대, 역할, 주방, 공급자)가 있었다. 서로 공유하는 코드가 없는 독립 컴포넌트라 `creative/cms/`에 하나씩 분리만 했다. 가장 큰 공급자 도식이 337줄, 나머지는 50~130줄이다.

## 분리 과정에서 확인한 사실

- **react-refresh 규칙**: ESLint의 [`react-refresh/only-export-components`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)[^hmr] 규칙이 "컴포넌트와 훅을 한 파일에서 함께 export하지 말라"는 오류를 출력했다. 훅(`useLiveDemo`)과 칩 컴포넌트(`QuotaChip`)를 한 파일에 두었다가 두 파일로 분리했다. 한 파일에 모여 있을 때는 export 자체가 없어서 이 규칙이 적용되지 않았다.
- **순수 함수의 분리**: 색 계산(`contrast`, `readableAccent`, `textOnAccent`)은 DOM도 React도 필요 없지만 컴포넌트 파일 안에 있어서 시험이 없었다. 별도 모듈로 분리한 직후 단위 시험 7개를 작성했다. 이전에는 테마 미리보기 화면에서 육안으로 확인하던 조건이 시험 코드로 남는다. 대비 기준은 [WCAG 2.1 대비(최소)](https://www.w3.org/TR/WCAG21/#contrast-minimum)의 4.5:1이고, 명도 조정은 [OKLab](https://bottosson.github.io/posts/oklab/) 색 공간에서 한다. 아래는 "연한 노랑을 흰 바탕 위에 올리면 어두워지되 여전히 노란 계열"을 확인하는 시험이다.

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

- 이 모듈을 import하는 파일은 두 개뿐이었다. `CreativeChapters`는 `Demo`를, `CreativePage`는 `Themes`와 데모 이벤트를 import한다. 경로만 바꿨고 동작은 그대로다.

## 대소문자만 다른 파일 이름

처음에는 발표 장 목록을 `slides.ts`로 저장했다. 같은 폴더에 갤러리 데모 `Slides.tsx`가 있다.

| 환경              | 파일 시스템               | 결과                                                                                                                                |
| ----------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Linux (CI)        | 대소문자 구분             | 두 파일을 별개로 인식, 시험 모두 통과                                                                                               |
| macOS (개발 환경) | 대소문자 구분 안 함(기본) | `import { Slides } from './Slides'`가 `Slides.ts`를 먼저 찾다가 `slides.ts`를 선택. 그 파일에는 `Slides`가 없어 타입 검사·빌드 실패 |

목록 파일 이름을 `slideDeck.ts`로 바꿨다. 대소문자만 다른 이름은 같은 폴더에 두지 않는다.

## 확인

- 데모 파일 분리는 20개 파일, 2,007줄 추가와 1,863줄 삭제였다. 늘어난 144줄은 대부분 분리한 파일마다 추가된 import와 시험 파일이다.
- 새 단위 시험은 `creative/color.test.ts` 7개다. 대비(WCAG) 2개, 가독성 있는 강조색 3개, 강조색 위 글자색 2개.
- 동작은 바꾸지 않았으므로 Safari 프로젝트 페이지 E2E(`e2e/safari.spec.ts`)는 수정 없이 통과했다.
- 대소문자 문제는 CI(Linux)에서는 검출되지 않았고, macOS에서 타입 검사를 실행할 때 발견됐다.

## 정리

- 큰 파일을 분리하면 그 안의 순수 함수가 드러난다. 색 계산은 처음부터 시험할 수 있는 코드였지만, 컴포넌트 파일 안에 있어서 시험 대상으로 인식되지 않았다.
- CI가 Linux 하나뿐이면 대소문자만 다른 파일 이름은 검출되지 않는다. 같은 폴더에 두지 않는 규칙으로 방지한다.
- 일부 린트 규칙은 파일 경계가 생긴 뒤에야 적용된다. `only-export-components`는 한 파일일 때는 적용될 대상이 없었다.
- 분리 기준을 하나("한 데모만 사용하면 그 안에, 둘 이상이면 별도 모듈")로 정해 두어, 상수마다 위치를 판단하는 작업이 줄었다.

## 같은 방식으로 분리하는 절차

큰 파일을 분리할 때는 동작이 같다는 것을 시험으로 확인하면서 한 단계씩 진행한다.

```bash
pnpm typecheck && pnpm lint
cd apps/react && npx vitest run src/apps/safari
npx playwright test e2e/safari.spec.ts
cd ../.. && pnpm cycles
```

대소문자만 다른 파일 이름은 macOS에서 한 파일로 인식되므로, 이름을 바꿀 때는 `git mv Slides.tsx tmp && git mv tmp slides.ts`처럼 두 단계로 나눈다.

참고 문서: [git mv](https://git-scm.com/docs/git-mv), [eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh).

## 관련 글

- [import를 계산하는 분리 스크립트와 model 파일로 순환 없이 컴포넌트 나누기](/memo/split-sidebar-photos): 2단계 두 번째 작업
- [순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-step2-structure)

PR: [#189](https://github.com/hyeoniverse/MacFolio/pull/189)

[^hmr]: Vite의 React Fast Refresh는 컴포넌트만 export하는 파일에서만 상태를 유지한 채 모듈을 교체한다. 컴포넌트가 아닌 값을 함께 export하면 파일 전체를 다시 불러온다. 이 규칙은 그런 파일을 검출한다.

#MacFolio #리팩터링 #React

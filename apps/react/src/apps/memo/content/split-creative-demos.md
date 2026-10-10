---
title: 1,861줄짜리 데모 파일을 데모마다 한 파일로
date: 2026-10-10
category: 인프라/배포·운영
summary: HYEONIVERSE 페이지의 데모 일곱 개와 테마 미리보기, 색 계산이 한 파일(CreativeDemos.tsx, 1,861줄)에 들어 있었다. creative/ 폴더에 데모마다 한 파일로 나누고, 둘 이상이 쓰는 것(데모 이벤트, 화면 안 감지, 발표 장 목록, 서버 호출, 색 계산)은 따로 뽑았다. 색 계산은 React 없이 순수 함수가 되어 처음으로 단위 시험이 생겼다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 첫 번째. 가장 큰 파일부터.

## 왜 한 파일이었나

HYEONIVERSE 프로젝트 페이지에는 그 사이트의 관리자 기능을 흉내 내는 데모가 있다. 발표 갤러리, 음성 만들기, 파형 편집, PDF·PPTX 변환, 번역, 요약, 커버, 그리고 테마 미리보기. 하나씩 붙이다 보니 전부 `CreativeDemos.tsx` 한 파일에 쌓였고 1,861줄이 됐다. 데모 하나를 고치려면 다른 데모 사이를 스크롤해야 했고, 어느 상수가 어느 데모 것인지 파일 안에서는 알 수 없었다.

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

## 알게 된 것

- **react-refresh 규칙**: ESLint의 `react-refresh/only-export-components`가 "컴포넌트와 훅을 한 파일에서 같이 export하지 말라"고 했다. 훅(`useLiveDemo`)과 칩 컴포넌트(`QuotaChip`)를 한 파일에 두었다가 둘로 나눴다. 한 파일에 섞여 있을 때는 이 규칙이 걸리지 않았다. export가 없었으니까
- **순수 함수가 드러난다**: 색 계산(`contrast`, `readableAccent`, `textOnAccent`)은 DOM도 React도 필요 없는데 컴포넌트 파일 안에 있어서 시험이 없었다. 따로 나오자마자 단위 시험 7개를 붙였다. "연한 노랑을 흰 바탕 위에 올리면 어두워지되 여전히 노란 계열"처럼 눈으로 확인하던 것이 글로 남는다
- 가져오는 쪽은 둘뿐이었다. `CreativeChapters`는 `Demo`를, `CreativePage`는 `Themes`와 데모 이벤트를. 경로만 바꿨고 동작은 그대로다

## 대소문자만 다른 파일 이름

처음에는 발표 장 목록을 `slides.ts`로 두었다. 같은 폴더에 갤러리 데모 `Slides.tsx`가 있다. 리눅스(CI)에서는 두 파일이 따로 보여 시험이 모두 통과했는데, macOS에서는 타입 검사와 빌드가 깨졌다. macOS의 기본 파일 시스템은 대소문자를 구분하지 않아서, `import { Slides } from './Slides'`를 `Slides.ts`부터 찾다가 `slides.ts`를 집었다. 그 파일에는 `Slides`가 없다. 목록 파일 이름을 `slideDeck.ts`로 바꿨다. 대소문자만 다른 이름은 같은 폴더에 두지 않는다.
#MacFolio #리팩터링 #React

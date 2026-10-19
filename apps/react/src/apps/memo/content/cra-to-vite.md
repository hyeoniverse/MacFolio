---
title: CRA에서 Vite로 옮기기
date: 2026-09-28
category: 개발기/MacFolio/인프라
summary: CRA로 만든 포트폴리오를 Vite로 옮겼다. dev 서버 시작 5.05초 → 0.58초, 빌드 6.33초 → 1.88초, 설치 패키지 1,438개 → 171개. 옮긴 이유, 같은 조건으로 잰 방법, 빌드는 되는데 조용히 깨져 있던 네 가지를 적었다.
---

이 포트폴리오는 원래 Create React App(CRA)으로 만들었다. Vite로 옮겼더니 dev 서버 시작은 약 8배, 프로덕션 빌드는 약 3배 빨라졌고, 설치되는 패키지는 1,438개에서 171개로 줄었다.

## 배경: 반쯤 옮겨 둔 상태

Vite로 바꾼 첫 커밋은 2025년 3월의 "chore: vite로 변경"이다. `react-scripts`를 빼고 `vite`를 넣고, `public/index.html`을 루트로 옮겼다. 그런데 그 커밋에는 `node_modules/` 아래 파일 1,131개와 CRA가 만든 `build/` 폴더가 같이 들어가 있었다. 저장소에 설치 결과와 빌드 결과가 섞여 있었고, 바뀐 줄 수가 +7,085/−93,827로 부풀어 무엇이 바뀌었는지 읽기도 어려웠다.

그 뒤로 사이트는 Vite dev 서버로 잘 떴다. 1년 반 뒤 이 포트폴리오를 다시 손보기로 하고 이슈 #2를 열었다. 열어 보니 "잘 되는 것처럼 보이는" 문제가 여럿 있었다. 아래 "조용히 깨져 있던 것"이 그것이다. 이 글은 그 정리 커밋(`432039cc`)과 측정(이슈 #3)을 묶은 기록이다.

## 왜 옮겼나

- **CRA는 더 이상 관리되지 않는다.** React 팀이 2025년 2월에 CRA를 공식적으로 deprecated했다.
- **기다리는 시간이 길었다.** CRA는 webpack으로 앱 전체를 묶은 뒤에야 dev 서버를 띄운다. Vite는 브라우저의 ES 모듈을 이용해 요청받은 파일만 그때그때 변환한다.
- **의존성이 무거웠다.** `react-scripts` 하나가 webpack, Babel, Jest, ESLint 설정을 통째로 끌고 온다.

견줄 길은 셋이었다.

| 방법                           | 좋은 점                                          | 나쁜 점                                                      |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| CRA 그대로 (`react-scripts`)   | 할 일이 없다                                     | 관리가 끝났다. React 19 이후 도구 대응을 기대할 수 없다      |
| `eject` 해서 webpack 직접 관리 | 설정을 마음대로 고친다                           | webpack·Babel 설정 수백 줄을 떠안는다. 느린 시작은 그대로다  |
| Vite                           | 시작이 빠르다. 설정이 짧다(`vite.config.ts` 6줄) | 환경변수 접두사·HTML 진입점 등 CRA 관례를 하나씩 바꿔야 한다 |

이 사이트는 서버 렌더링이 필요 없는 한 페이지짜리 데스크톱 흉내라, 프레임워크를 바꾸기보다 빌드 도구만 바꾸는 것이 맞았다. 이미 Vite로 반쯤 옮겨 둔 상태이기도 했다.

## 얼마나 빨라졌나

| 항목                           | CRA      | Vite     |
| ------------------------------ | -------- | -------- |
| dev 서버 시작 (캐시 없음)      | 5.05초   | 0.58초   |
| 프로덕션 빌드 (타입 체크 포함) | 6.33초   | 1.88초   |
| JS 번들 (gzip)                 | 138.2 KB | 127.7 KB |
| 설치 패키지 수                 | 1,438개  | 171개    |
| CSS 번들 (gzip)                | 30.2 KB  | 28.3 KB  |
| `node_modules` 크기            | 548 MB   | 276 MB   |

![CRA와 Vite의 빌드 시간 비교 그래프](./images/cra-vite-benchmark.svg 'dev 서버 시작과 프로덕션 빌드 시간 (초)')

같은 컴퓨터(Apple M4 Pro)에서 캐시를 지우고 3번씩 잰 평균이다. 두 버전 모두 React 19.0.0이다.

비교 대상은 Vite 전환 직전 커밋(태그 `v1-cra`, react-scripts 5.0.1·webpack 5.97.1)과 정리를 마친 커밋(`432039cc`, Vite 6.2.1·@vitejs/plugin-react 4)이다. 환경은 Apple M4 Pro, 메모리 24GB, Node.js 23.10.0, npm 11.19.1이다.

측정할 때 신경 쓴 점이 있다.

- dev 서버 시작은 매번 캐시(`node_modules/.cache`, `node_modules/.vite`)를 지우고 쟀다. CRA는 `/static/js/bundle.js`가 200을 돌려줄 때까지(이때 앱 전체 컴파일이 끝난다), Vite는 `/`와 `/src/App.tsx`가 200을 돌려줄 때까지를 쟀다.
- CRA 빌드는 타입 체크를 포함하므로, Vite도 `tsc && vite build`로 함께 쟀다.
- CRA는 기본으로 소스맵을 만들어서, Vite와 맞추려고 소스맵을 껐다.
- Vite dev 서버는 나머지 파일을 브라우저가 요청할 때 변환한다. 그래서 dev 서버 시작 수치는 첫 화면이 다 그려지는 시간보다 짧다.
- 두 버전 사이에 도구 말고 코드도 바뀌었다(`src/` 파일 39개). 번들 크기 차이는 도구만의 효과가 아니다. 크기는 "비슷하거나 조금 작아졌다" 정도로만 본다.
- 번들 크기는 소스맵을 뺀 `.js`·`.css` 파일을 `gzip -9`로 압축한 합이다.
- 코드를 고친 뒤 화면에 반영되는 속도(HMR)와 Lighthouse 점수는 브라우저가 필요해서 이때는 재지 않았다. Vite 번들만 따로 재면(타입 체크 없이) 1.32초다.

## 무엇을 바꿨나

![CRA와 Vite에서 진입점·환경변수·타입·플러그인·빌드 출력이 어디로 갔는지](./images/cra-to-vite-moves.svg 'CRA 관례가 Vite에서 어디로 가는지')

| 영역           | CRA                                      | Vite                                                            |
| -------------- | ---------------------------------------- | --------------------------------------------------------------- |
| HTML 진입점    | `public/index.html`, `%PUBLIC_URL%` 치환 | 루트 `index.html`, `<script type="module" src="/src/main.tsx">` |
| 환경변수       | `process.env.REACT_APP_*`                | `import.meta.env.VITE_*`                                        |
| 타입           | `react-app-env.d.ts`                     | `vite-env.d.ts` (`vite/client` + `ImportMetaEnv`)               |
| React 플러그인 | 내장 (Babel)                             | `vite.config.ts`에 `@vitejs/plugin-react`                       |
| 빌드 출력      | `build/`                                 | `dist/`                                                         |
| 시험           | Jest (내장)                              | 이때는 뺐다. 뒤에 Vitest로 다시 들였다                          |

`package.json`의 스크립트는 이렇게 바뀌었다.

```json
// 전 (CRA)
"start": "react-scripts start", "build": "react-scripts build", "eject": "react-scripts eject"
// 후 (정리 커밋)
"dev": "vite", "build": "tsc && vite build", "preview": "vite preview", "typecheck": "tsc"
```

`build`에 `tsc`를 앞에 붙인 것은 Vite가 타입 검사를 하지 않기 때문이다. Vite는 esbuild로 타입을 지우기만 하고 틀린 타입은 그냥 지나간다. CRA는 빌드 중에 타입 검사를 해 주었으므로, 그 안전망을 잃지 않으려면 직접 붙여야 했다.

## 옮기면서 조용히 깨져 있던 것

옮긴 직후에는 빌드도 되고 화면도 떴다. 그런데 에러 없이 조용히 깨진 것들이 있었다.

- **배포 경로:** Vite는 `dist/`에 빌드하는데, 배포 설정(`firebase.json`의 `"public": "build"`)은 여전히 CRA의 `build/`를 가리키고 있었다. 저장소에 예전 CRA 빌드가 남아 있었으니, 배포하면 오류 없이 예전 화면이 올라갈 수 있었다.
- **환경변수 이름:** 한 파일이 `REACT_APP_`으로 시작하는 환경변수를 읽고 있었다. Vite는 `VITE_`로 시작하는 변수만 넘겨주므로 값이 `undefined`가 되어 이미지가 깨졌다. `Github.tsx`의 `import.meta.env.REACT_APP_IMAGE_URL` 한 줄이었다.
- **React 플러그인:** `@vitejs/plugin-react`를 설치만 하고 설정 파일이 없었다. 앱은 동작했지만 코드를 고치면 상태가 유지된 채 반영되는 Fast Refresh가 꺼져 있었다. Vite는 플러그인이 없어도 esbuild로 JSX를 변환하므로 겉으로는 아무 차이가 없었다. 6줄짜리 `vite.config.ts`를 더해 고쳤다.
- **빠진 의존성:** `react-dom`과 `typescript`가 `package.json`에 없었다. 예전 `node_modules`에 남아 있어서 내 컴퓨터에서는 드러나지 않았다.

정리 커밋에서는 이 넷 말고도 CRA 잔재를 걷어 냈다. `react-app-env.d.ts`, `setupTests.ts`, `App.test.tsx`, `reportWebVitals.ts`, `web-vitals`, Jest 타입, `browserslist` 설정, 설치되지 않은 Tailwind 지시어, 쓰지 않는 중복 타입 파일 `types/AppTyes.ts`가 빠졌다. 파일 18개를 고쳤다.

## 남은 것과 배운 것

`vite-env.d.ts`에 `ImportMetaEnv`를 선언해 자동 완성은 되게 했다. 하지만 Vite 기본 타입에 인덱스 시그니처가 있어서, 없는 이름을 써도 타입 오류가 나지 않는다. `REACT_APP_` 같은 실수를 타입이 잡아 주지 못한다는 뜻이다. 그래서 다음 단계(이슈 #4)에서 환경변수를 읽는 곳을 `shared/config/env.ts` 한 곳으로 모았다.

전부 "잘 되는 것처럼 보이는" 문제였다. 에러가 나지 않으니 1년 반 동안 아무도 몰랐다. 이 경험 이후로 빌드가 된다고 끝내지 않고, 배포 결과를 직접 열어 보고 자동 시험으로 확인하는 습관을 들였다. 저장소에 설치 결과·빌드 결과를 넣지 않는 것도 이때 정했다. 넣어 두면 지금처럼 "어느 빌드가 올라가는지"가 흐려진다.

관련 글: [GitHub Actions로 배포하기](/memo/deploy-github-actions), [의존성 취약점 정리](/memo/dependency-vulnerabilities).

#MacFolio #Vite #성능

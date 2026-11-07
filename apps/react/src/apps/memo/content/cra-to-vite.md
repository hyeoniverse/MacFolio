---
title: CRA에서 Vite로 옮기기
date: 2026-09-28
category: 개발 기록/MacFolio/배포·운영
summary: CRA로 만든 포트폴리오를 Vite로 옮겼다. dev 서버 시작 5.05초 → 0.58초, 빌드 6.33초 → 1.88초, 설치 패키지 1,438개 → 171개. 옮긴 이유, 같은 조건으로 잰 방법, 빌드는 되는데 조용히 깨져 있던 네 가지를 적었다.
---

이 포트폴리오는 원래 Create React App(CRA)으로 만들었다. 빌드 도구를 Vite로 옮긴 결과 ==dev 서버 시작은 약 8.7배, 프로덕션 빌드는 약 3.4배 빨라졌고==, 설치되는 패키지는 1,438개에서 171개로 줄었다.

## 빌드 도구가 하는 일

React로 작성한 코드는 브라우저가 그대로 실행하지 못한다. `.tsx` 파일에는 TypeScript 타입 표기와 JSX(`<App />` 같은 HTML 모양의 문법)가 섞여 있고, 브라우저는 순수 JavaScript만 이해한다. 그래서 코드와 브라우저 사이에 **빌드 도구**가 필요하다. 빌드 도구는 두 가지 작업을 맡는다.

| 작업                  | 실행하는 명령       | 하는 일                                                                             | 예                                                        |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 개발 서버(dev server) | `npm start`, `vite` | 코드를 고칠 때마다 변환해 `localhost`에서 바로 확인하게 한다                        | `App.tsx`의 문구를 고치고 저장하면 브라우저 화면이 바뀐다 |
| 프로덕션 빌드(build)  | `npm run build`     | 모든 파일을 변환·압축해 서버에 올릴 정적 파일(`index.html`, `.js`, `.css`)을 만든다 | `dist/assets/index-3f2a.js` 같은 파일이 생긴다            |

**번들러**(bundler)는 이 과정의 핵심 부품이다. 진입 파일(`main.tsx`)에서 시작해 `import` 문을 따라가며 의존하는 모든 모듈을 찾고, 이를 몇 개의 파일로 합친다. 파일 수백 개를 그대로 내려받게 하면 요청이 수백 번 발생하기 때문이다.

**CRA**는 React 팀이 2016년에 내놓은 프로젝트 생성 도구다. `npx create-react-app my-app` 한 줄로 webpack(번들러), Babel(JSX·최신 문법 변환기), Jest(시험 도구), ESLint(코드 검사기)를 미리 설정한 프로젝트를 만든다. 이 설정은 `react-scripts`라는 패키지 하나에 감춰져 있다. **Vite**는 2020년에 등장한 빌드 도구로, 개발 서버는 브라우저의 네이티브 ES 모듈[^esm]을 이용하고 프로덕션 빌드는 Rollup으로 번들링한다.

## 배경: 전환이 절반만 끝난 상태

Vite로 바꾼 첫 커밋은 2025년 3월의 "chore: vite로 변경"이다. `react-scripts`를 빼고 `vite`를 넣고, `public/index.html`을 루트로 옮겼다. 그런데 그 커밋에는 `node_modules/` 아래 파일 1,131개와 CRA가 만든 `build/` 폴더가 함께 들어가 있었다. 저장소에 설치 결과와 빌드 결과가 섞였고, diff가 +7,085/−93,827줄로 커져 실제 설정 변경을 diff에서 찾기 어려웠다.

> [!NOTE] node_modules와 build 폴더
> `node_modules/`는 `npm install`이 `package.json`을 읽고 내려받은 라이브러리 폴더이고, `build/`는 빌드 명령이 만든 결과물 폴더다. 둘 다 명령 한 줄로 다시 생성되므로 보통 `.gitignore`에 넣어 저장소에 커밋하지 않는다.

그 뒤로 사이트는 Vite dev 서버에서 오류 없이 실행되었다. 1년 반 뒤 이 포트폴리오를 다시 정비하면서 이슈 [#2](https://github.com/hyeoniverse/MacFolio/issues/2)를 열었고, 점검 결과 오류 메시지 없이 동작이 어긋나 있던 문제 네 가지를 찾았다([오류 없이 깨져 있던 네 가지](#오류-없이-깨져-있던-네-가지)). 정리 커밋(`901b92f7`)과 측정(이슈 [#3](https://github.com/hyeoniverse/MacFolio/issues/3))은 [#12](https://github.com/hyeoniverse/MacFolio/pull/12)로 병합했다.

## 왜 옮겼나

- **CRA는 더 이상 관리되지 않는다.** React 팀이 2025년 2월에 CRA를 공식적으로 deprecated했다([React 블로그: Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)). 새 React 버전이나 새 webpack 버전에 맞춘 수정이 더 나오지 않는다는 뜻이다.
- **dev 서버 시작이 느렸다.** CRA는 webpack으로 앱 전체를 번들링한 뒤에 dev 서버 응답을 시작한다. Vite는 브라우저가 요청한 파일만 요청 시각에 변환한다. 아래 두 그림은 Vite 공식 문서의 비교 그림이다.
- **의존성이 많았다.** `react-scripts` 하나가 webpack, Babel, Jest, ESLint와 그 설정을 모두 의존성으로 설치한다(설치 패키지 1,438개).

![번들 기반 dev 서버. entry에서 route와 module을 모두 따라가 Bundle을 만든 뒤에야 Server ready가 된다](./images/cra-to-vite-bundler-dev-server.jpg '번들 기반 dev 서버(CRA의 webpack): 앱 전체를 번들로 묶은 뒤에 서버가 준비된다. 출처: Vite 문서')

![네이티브 ESM 기반 dev 서버. Server ready가 먼저이고, 브라우저의 HTTP 요청이 entry와 지금 화면의 route·module만 불러온다](./images/cra-to-vite-esm-dev-server.jpg '네이티브 ESM 기반 dev 서버(Vite): 서버가 먼저 준비되고, 지금 화면에 필요한 모듈(초록)만 요청 시각에 변환한다. 회색은 아직 요청되지 않은 모듈')

두 그림의 차이가 시작 시간 차이의 원인이다. 번들 기반 서버는 화면에 보이지 않는 경로(route)의 모듈까지 모두 처리해야 "Server ready"에 도달한다. ESM 기반 서버는 먼저 준비 상태가 되고, 브라우저가 `import`를 만날 때마다 그 파일 하나를 변환해 응답한다. 예를 들어 `import()`로 나중에 불러오는 화면의 코드는 사용자가 그 화면을 열기 전까지 변환되지 않는다.

검토한 선택지는 세 가지였다.

| 방법                         | 장점                                             | 단점                                                         |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| CRA 유지 (`react-scripts`)   | 변경 작업이 없다                                 | 관리가 끝났다. React 19 이후 도구 대응을 기대할 수 없다      |
| `eject` 후 webpack 직접 관리 | 설정을 직접 수정할 수 있다                       | webpack·Babel 설정 수백 줄을 직접 관리한다. 시작 시간은 같다 |
| Vite                         | 시작이 빠르다. 설정이 짧다(`vite.config.ts` 6줄) | 환경변수 접두사·HTML 진입점 등 CRA 관례를 하나씩 바꿔야 한다 |

`eject`는 `react-scripts`에 감춰진 webpack·Babel 설정 파일을 프로젝트 폴더로 꺼내는 CRA 명령이다. 한 번 실행하면 되돌릴 수 없고, 꺼낸 설정은 이후 직접 관리해야 한다.

이 사이트는 서버 렌더링(SSR)이 필요 없는 단일 페이지 애플리케이션(SPA)이다. SSR은 서버가 요청마다 HTML을 완성해 보내는 방식이고, SPA는 빈 HTML과 JS를 보낸 뒤 브라우저가 화면을 그리는 방식이다. 그래서 Next.js 같은 프레임워크로 바꾸지 않고 빌드 도구만 Vite로 교체했다. 2025년 3월 커밋으로 `vite` 의존성과 루트 `index.html`이 이미 들어와 있던 점도 고려했다.

## 측정 결과

| 항목                           | CRA      | Vite     |
| ------------------------------ | -------- | -------- |
| dev 서버 시작 (캐시 없음)      | 5.05초   | 0.58초   |
| 프로덕션 빌드 (타입 체크 포함) | 6.33초   | 1.88초   |
| JS 번들 (gzip)                 | 138.2 KB | 127.7 KB |
| 설치 패키지 수                 | 1,438개  | 171개    |
| CSS 번들 (gzip)                | 30.2 KB  | 28.3 KB  |
| `node_modules` 크기            | 548 MB   | 276 MB   |

![CRA와 Vite의 빌드 시간 비교 그래프](./images/cra-vite-benchmark.svg 'dev 서버 시작과 프로덕션 빌드 시간 (초)')

같은 컴퓨터(Apple M4 Pro)에서 캐시를 삭제하고 3회씩 측정한 평균이다. 두 버전 모두 React 19.0.0이다. 배율은 다음과 같이 계산했다.

```math
\frac{5.05}{0.58} \approx 8.7 \quad (\text{dev 서버 시작}), \qquad \frac{6.33}{1.88} \approx 3.4 \quad (\text{프로덕션 빌드})
```

비교 대상은 Vite 전환 직전 커밋(태그 `v1-cra`, react-scripts 5.0.1·webpack 5.97.1)과 정리를 마친 커밋(`901b92f7`, Vite 6.2.1·@vitejs/plugin-react 4)이다. 환경은 Apple M4 Pro, 메모리 24GB, Node.js 23.10.0, npm 11.19.1이다.

<details>
<summary>측정 조건 상세</summary>

- dev 서버 시작은 매번 캐시(`node_modules/.cache`, `node_modules/.vite`)를 삭제하고 측정했다. CRA는 `/static/js/bundle.js`가 200을 응답할 때까지(이 시각에 앱 전체 컴파일이 끝난다), Vite는 `/`와 `/src/App.tsx`가 200을 응답할 때까지를 측정했다.
- CRA 빌드는 타입 체크를 포함하므로, Vite도 `tsc && vite build`로 함께 측정했다.
- CRA는 기본값으로 소스맵을 생성하므로, Vite와 조건을 맞추려고 소스맵 생성을 비활성화했다.
- Vite dev 서버는 나머지 파일을 브라우저가 요청할 때 변환한다. 그래서 dev 서버 시작 수치는 첫 화면 렌더링이 끝나는 시간보다 짧다.
- 두 버전 사이에 도구 말고 코드도 바뀌었다(`src/` 파일 39개). 번들 크기 차이는 도구만의 효과가 아니다. 크기 수치는 "같은 수준이거나 약간 감소" 정도로만 해석한다.
- 번들 크기는 소스맵을 뺀 `.js`·`.css` 파일을 `gzip -9`로 압축한 합이다.
- 코드 수정이 화면에 반영되는 속도(HMR)와 Lighthouse 점수는 브라우저 자동화가 필요해 이번에는 측정하지 않았다. Vite 번들링만 따로 측정하면(타입 체크 제외) 1.32초다.

</details>

## 변경 내용

CRA는 "이 파일은 이 위치에, 이 변수는 이 이름으로"라는 관례를 정해 두고 `react-scripts`가 그 관례를 처리한다. Vite에는 같은 기능이 다른 위치와 이름으로 있다. 아래 표와 그림은 각 관례가 어디로 옮겨 갔는지 보여 준다.

![CRA와 Vite에서 진입점·환경변수·타입·플러그인·빌드 출력이 어디로 갔는지](./images/cra-to-vite-moves.svg 'CRA 관례가 Vite에서 어디로 가는지')

| 영역           | CRA                                      | Vite                                                            |
| -------------- | ---------------------------------------- | --------------------------------------------------------------- |
| HTML 진입점    | `public/index.html`, `%PUBLIC_URL%` 치환 | 루트 `index.html`, `<script type="module" src="/src/main.tsx">` |
| 환경변수       | `process.env.REACT_APP_*`                | `import.meta.env.VITE_*`                                        |
| 타입           | `react-app-env.d.ts`                     | `vite-env.d.ts` (`vite/client` + `ImportMetaEnv`)               |
| React 플러그인 | 내장 (Babel)                             | `vite.config.ts`에 `@vitejs/plugin-react`                       |
| 빌드 출력      | `build/`                                 | `dist/`                                                         |
| 시험           | Jest (내장)                              | 이 단계에서는 제거했다. 이후 Vitest로 다시 도입했다             |

HTML 진입점이 루트로 옮겨 간 이유는 Vite의 동작 방식에 있다. CRA는 `public/index.html`을 템플릿으로 쓰고 webpack이 번들 파일의 `<script>` 태그를 삽입한다. Vite는 `index.html` 자체를 첫 모듈로 취급하므로, HTML에 직접 `<script type="module" src="/src/main.tsx">`를 적고 그 경로부터 `import`를 따라간다.

`package.json`의 스크립트는 이렇게 바뀌었다.

```json
// 전 (CRA)
"start": "react-scripts start", "build": "react-scripts build", "eject": "react-scripts eject"
// 후 (정리 커밋)
"dev": "vite", "build": "tsc && vite build", "preview": "vite preview", "typecheck": "tsc"
```

> [!WARNING] Vite는 타입 검사를 하지 않는다
> `build` 앞에 `tsc`를 추가한 이유는 Vite가 타입 검사를 하지 않기 때문이다. Vite는 esbuild로 타입 표기를 제거만 하고, 타입 오류가 있어도 빌드를 통과시킨다([Vite 문서: TypeScript](https://vite.dev/guide/features.html#typescript)). 예를 들어 `const n: number = 'a'`가 있어도 `vite build`는 성공한다. CRA는 빌드 중에 타입 검사를 수행했으므로, 같은 검사를 유지하려면 `tsc`를 빌드 단계에 명시해야 했다.

## 오류 없이 깨져 있던 네 가지

전환 직후에는 빌드가 성공하고 화면도 표시되었다. 그러나 오류 메시지 없이 동작이 어긋난 곳이 네 군데 있었다.

| 항목           | 증상                                                                     | 원인                                                                                                                          | 수정                                        |
| -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 배포 경로      | 배포하면 오류 없이 예전 CRA 화면이 올라갈 수 있었다                      | `firebase.json`의 `"public": "build"`가 CRA 출력 폴더를 가리켰고, 저장소에 예전 `build/`가 남아 있었다                        | `firebase.json`의 배포 경로를 `dist`로 변경 |
| 환경변수 이름  | 이미지 주소가 `undefined`가 되어 이미지가 표시되지 않았다                | `Github.tsx`가 `import.meta.env.REACT_APP_IMAGE_URL`을 읽었다. Vite는 `VITE_` 접두사 변수만 노출한다                          | `VITE_APP_IMAGE_URL`로 변경                 |
| React 플러그인 | 코드를 수정하면 상태를 유지한 채 반영하는 Fast Refresh가 비활성 상태였다 | `@vitejs/plugin-react`를 설치만 하고 `vite.config.ts`가 없었다. 플러그인 없이도 esbuild가 JSX를 변환해 겉으로는 차이가 없었다 | 6줄짜리 `vite.config.ts` 추가               |
| 누락된 의존성  | 로컬에서는 증상이 없고, 새로 설치하는 환경에서만 실패할 수 있었다        | `react-dom`과 `typescript`가 `package.json`에 없었고, 예전 `node_modules`에 남아 있었다                                       | 두 패키지를 `package.json`에 추가           |

### 환경변수 접두사

브라우저에서 실행되는 코드에는 "실행 중에 읽는 환경 변수"가 없다. 그래서 Vite와 CRA 모두 빌드 시각에 `import.meta.env.VITE_X`(CRA는 `process.env.REACT_APP_X`) 표현식을 실제 값의 문자열로 바꿔 넣는다. 이때 정해진 접두사가 붙은 변수만 치환한다. 서버 전용 비밀 값(`DATABASE_URL` 등)이 실수로 브라우저 번들에 들어가 누구나 내려받을 수 있게 되는 일을 막기 위해서다([Vite 문서: Env Variables](https://vite.dev/guide/env-and-mode)).

![VITE_ 접두사 변수는 빌드 결과에 문자열로 들어가고 REACT_APP_ 변수는 undefined가 된다](./images/cra-to-vite-env-prefix.svg '접두사가 맞지 않는 변수는 오류 없이 undefined가 된다')

`Github.tsx`는 Vite로 옮긴 뒤에도 CRA 접두사인 `REACT_APP_IMAGE_URL`을 읽고 있었다. Vite 입장에서는 노출 대상이 아닌 이름이므로 값이 `undefined`가 되었고, 빌드 경고도 없었다.

### 누락된 의존성

Node.js와 번들러는 `import 'react-dom/client'`를 처리할 때 `package.json`이 아니라 `node_modules` 폴더를 탐색한다. 개발 컴퓨터의 `node_modules`에는 CRA 시절에 설치된 `react-dom`과 `typescript`가 그대로 남아 있었으므로, `package.json`에 두 이름이 없어도 로컬의 `import`와 `tsc`는 계속 동작했다.

![package.json에 없는 react-dom과 typescript가 예전 node_modules에 남아 로컬에서만 동작하는 구조](./images/cra-to-vite-phantom-deps.svg '로컬은 이전 설치 결과 덕분에 동작하고, 새로 설치한 환경에서만 드러난다')

CI나 새 컴퓨터처럼 `node_modules`가 없는 상태에서 설치하면 두 패키지가 설치되지 않는다. 정리 커밋에서 두 패키지를 `package.json`에 명시했다.

### 그 밖에 삭제한 CRA 잔재

정리 커밋에서는 이 네 가지 외에도 CRA 잔재를 삭제했다. `react-app-env.d.ts`, `setupTests.ts`, `App.test.tsx`, `reportWebVitals.ts`, `web-vitals`, Jest 타입, `browserslist` 설정, 설치되지 않은 Tailwind 지시어, 쓰지 않는 중복 타입 파일 `types/AppTyes.ts`가 빠졌다. 파일 18개를 고쳤다.

## 남은 과제와 정리

`vite-env.d.ts`에 `ImportMetaEnv`를 선언해 자동 완성을 지원했다. 하지만 Vite 기본 타입에 인덱스 시그니처(`[key: string]: any`처럼 임의 이름을 허용하는 선언)가 있어서, ==없는 이름을 써도 타입 오류가 나지 않는다==. `REACT_APP_` 같은 실수를 타입이 잡아 주지 못한다는 뜻이다. 그래서 다음 단계(이슈 [#4](https://github.com/hyeoniverse/MacFolio/issues/4))에서 환경변수를 읽는 코드를 `shared/config/env.ts` 한 파일로 모았다.

네 가지 모두 ==오류 메시지를 내지 않아 1년 반 동안 발견되지 않았다==. 이후로는 빌드 성공으로 작업을 마치지 않고, 배포 결과를 직접 열어 확인하고 자동 시험으로 검증한다. 저장소에 `node_modules/`·`build/` 같은 설치·빌드 결과를 커밋하지 않는 규칙도 이 시각에 정했다. 빌드 결과가 저장소에 있으면 실제로 어느 빌드가 배포되는지 판단하기 어렵다.

## 재현 방법

옮기는 과정과 측정 방법은 저장소의 [docs/migration-cra-to-vite.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/migration-cra-to-vite.md)에 있다. 같은 수치를 다시 측정하는 명령은 다음과 같다.

```bash
cd apps/react
time npx vite build                    # 빌드 시간
npx vite --port 5173                   # 터미널에 'ready in …ms'가 dev 시작 시간
```

CRA에서 Vite로 전환할 때 수정하는 곳은 네 군데다.

1. `react-scripts`를 빼고 `vite`, `@vitejs/plugin-react`를 넣는다. `vite.config.ts`를 만든다
2. `public/index.html`을 루트의 `index.html`로 옮기고 `<script type="module" src="/src/main.tsx">`를 넣는다
3. 환경 변수 `process.env.REACT_APP_*`를 `import.meta.env.VITE_*`로 바꾼다. 빌드할 때 문자열로 들어간다는 점은 같다
4. Jest 시험은 [Vitest](https://vitest.dev/guide/)로 이전한다

`vite.config.ts`의 최소 형태는 다음과 같다. 이 파일이 없으면 3번째 문제처럼 React 플러그인이 동작하지 않는다.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
});
```

> [!NOTE] 되돌리는 방법
> 전환 PR을 revert한다. 다만 위의 "오류 없이 깨져 있던 네 가지"는 CRA 상태에서도 이미 어긋나 있던 것이라, revert해도 수정되지 않는다. 공식 안내는 [Vite 시작하기](https://vite.dev/guide/)에 있다.

## 관련 글

- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [pnpm overrides로 하위 의존성 취약점 고치고 pnpm audit로 CI에서 막기](/memo/supply-chain-security#하위-의존성-취약점과-pnpm-overrides)
- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)

[^esm]: 브라우저가 `<script type="module">`과 `import` 문을 직접 해석하는 방식. 번들러가 파일을 하나로 합치지 않아도 브라우저가 모듈 단위로 요청한다. [MDN: JavaScript 모듈](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Modules)

<details>
<summary>참고 문헌</summary>

- [React 블로그: Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
- [Vite 문서: Why Vite](https://vite.dev/guide/why)
- [Vite 문서: Features - TypeScript](https://vite.dev/guide/features.html#typescript)
- [Vite 문서: Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [Vite 문서: Getting Started](https://vite.dev/guide/)
- [MDN: JavaScript 모듈](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Modules)
- [Node.js 문서: Loading from node_modules folders](https://nodejs.org/api/modules.html#loading-from-node_modules-folders)

</details>

<details>
<summary>사진 출처</summary>

- 번들 기반 dev 서버 그림: Vite 문서, [Why Vite](https://vite.dev/guide/why) ([원본 SVG](https://github.com/vitejs/vite/blob/main/docs/images/bundler.svg)), MIT 라이선스. 어두운 배경에 렌더링해 JPG로 변환
- 네이티브 ESM 기반 dev 서버 그림: Vite 문서, [Why Vite](https://vite.dev/guide/why) ([원본 SVG](https://github.com/vitejs/vite/blob/main/docs/images/esm.svg)), MIT 라이선스. 어두운 배경에 렌더링해 JPG로 변환

</details>

#MacFolio #Vite #성능

---
title: 웹 개발자를 위한 VS Code 확장 — 목적별 추천과 팀에 공유하는 설정
date: 2026-10-26
category: 기술 노트/개발 환경
summary: 웹 프론트엔드·풀스택 개발에 쓰는 VS Code 확장 32개를 일곱 묶음으로 정리했다. 확장마다 상세 화면, 하는 일, 저장소 설정과의 연결을 같은 순서로 적고, 확장 없이 내장 설정으로 대신하는 기능(괄호 색, 태그 이름 바꾸기 등)과 팀에 권하는 extensions.json을 덧붙였다.
---

이 글은 VS Code로 웹 프론트엔드·풀스택 개발을 하는 개발자를 위한 확장 목록이다. 가장 효과가 큰 확장은 **프로젝트에 있는 설정 파일을 편집기가 읽게 해 주는 확장**이다. ESLint 확장은 `eslint.config.js`를, Playwright 확장은 `playwright.config.ts`를 읽어 터미널에서 돌리던 검사를 편집 중에 보여 준다. 각 확장이 저장소의 어떤 파일과 연결되는지는 MacFolio 저장소를 예로 적는다.

![목적별 확장 묶음](./images/vscode-extensions-map.svg '도식. 위 줄은 저장소 설정 파일과 바로 연결되는 확장, 아래 줄은 작업 환경을 넓히는 확장')

| 묶음            | 확장                                                                                                            | 하는 일                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| ① 코드 품질     | [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)                            | ESLint 규칙 위반 표시, 자동 수정           |
|                 | [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)         | 프로젝트의 Prettier로 포맷                 |
|                 | [Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint)                     | CSS를 Stylelint 규칙으로 검사              |
|                 | [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens)                          | 오류 메시지를 그 줄 끝에 표시              |
|                 | [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) | 영어 철자 오류 표시                        |
|                 | [Pretty TypeScript Errors](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors)        | TypeScript 오류 메시지를 읽기 쉽게 표시    |
| ② 테스트        | [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)      | E2E 시험 실행·디버그                       |
|                 | [Vitest](https://marketplace.visualstudio.com/items?itemName=vitest.explorer)                                   | 단위 시험 실행·디버그                      |
| ③ API·데이터    | [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)                            | `.http` 파일의 요청 보내기                 |
|                 | [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)                                     | `schema.prisma` 편집 지원                  |
|                 | [Container Tools](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-containers)          | Dockerfile·Compose 편집, 컨테이너 관리     |
| ④ HTML·CSS·언어 | [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)      | Tailwind 클래스 자동 완성                  |
|                 | [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)                                 | `.vue` 파일 지원                           |
|                 | [CSS Peek](https://marketplace.visualstudio.com/items?itemName=pranaygp.vscode-css-peek)                        | HTML·JSX의 class·id에서 CSS 정의로 이동    |
|                 | [HTML CSS Support](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)                   | HTML의 class·id 자동 완성                  |
|                 | [PostCSS Language Support](https://marketplace.visualstudio.com/items?itemName=csstools.postcss)                | 최신·실험 CSS 문법 강조                    |
|                 | [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)                        | 정적 페이지를 로컬 서버로 띄우고 새로 고침 |
|                 | [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server)                       | 편집기 안에서 HTML 미리 보기               |
| ⑤ Git           | [GitLens — Git supercharged](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)               | 줄별 작성자·커밋 표시                      |
|                 | [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph)                             | 브랜치·병합 기록 그래프                    |
| ⑥ 원격·협업     | [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)        | 컨테이너 안에서 폴더 열기                  |
|                 | [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)                 | SSH로 원격 폴더 열기                       |
|                 | [Live Share](https://marketplace.visualstudio.com/items?itemName=ms-vsliveshare.vsliveshare)                    | 실시간 공동 편집                           |
| ⑦ 편의          | [EditorConfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)                   | `.editorconfig` 규칙 적용                  |
|                 | [Path Intellisense](https://marketplace.visualstudio.com/items?itemName=christian-kohler.path-intellisense)     | import 경로 자동 완성                      |
|                 | [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)           | Markdown 단축키·목차·표 정렬               |
|                 | [markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)              | Markdown 문법 검사                         |
|                 | [Material Icon Theme](https://marketplace.visualstudio.com/items?itemName=PKief.material-icon-theme)            | 파일 종류별 아이콘                         |
|                 | [indent-rainbow](https://marketplace.visualstudio.com/items?itemName=oderwat.indent-rainbow)                    | 들여쓰기 단계마다 색 표시                  |
|                 | [Todo Tree](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree)                          | TODO·FIXME 주석을 트리로 모아 보기         |
|                 | [Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments)               | 주석을 종류(!, ?, TODO)별 색으로 구분      |
|                 | [Import Cost](https://marketplace.visualstudio.com/items?itemName=wix.vscode-import-cost)                       | import한 패키지 크기를 줄 끝에 표시        |

- **확인한 곳:** 확장 이름·게시자·ID·기능은 2026년 10월 26일 [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode)의 각 확장 페이지와 [VS Code 공식 문서](https://code.visualstudio.com/docs)에서 확인했다.
- **ID로 찾기:** 확장 ID(`게시자.이름`)는 각 상세 화면 오른쪽 Installation 표의 Identifier와 글 끝 목록에 있다. Extensions 보기(⇧⌘X) 검색 칸에 넣으면 이름이 비슷한 다른 확장과 섞이지 않는다.
- **화면:** 모든 화면은 VS Code 1.143.1의 웹 버전(`code serve-web`)에서 촬영했다. 상세 화면은 빈 확장 폴더에 새로 설치한 Marketplace 최신 버전이고, 동작 화면은 MacFolio 저장소에 촬영용 파일(`zzDemo.ts`, `zzDemo.css`, `zz-health.http`)을 만들어 찍었다.

아래 절은 확장마다 **상세 화면 → 하는 일 → 이 저장소에서 쓰는 방식 → 동작 화면** 순서로 적는다.

## ① 코드 품질

세 검사 도구(ESLint·Prettier·Stylelint)의 확장은 **확장에 들어 있는 규칙이 아니라 저장소에 설치된 패키지와 설정 파일**을 쓴다. 그래서 CI와 편집기의 결과가 같다.

### ESLint

![ESLint 상세 화면](./images/vscode-extensions-web-eslint.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

편집 중에 ESLint 규칙 위반을 표시하고, 저장할 때 자동 수정할 수 있는 항목을 고친다. ESLint 9 이상의 flat config(`eslint.config.js` 등)를 읽는다. 확장 페이지에 따르면 ESLint 10부터는 `eslint.useFlatConfig` 설정을 보지 않고 항상 flat config를 쓴다. MacFolio는 ESLint 10과 `eslint.config.js`를 쓰므로 따로 설정할 것이 없다.

### Prettier - Code formatter

![Prettier - Code formatter 상세 화면](./images/vscode-extensions-web-prettier.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

프로젝트 의존성에 설치된 Prettier로 파일을 포맷하고, 처음 불러올 때 사용자 확인을 받는다. MacFolio의 `.prettierrc`(탭, 작은따옴표, 줄 길이 120)가 그대로 적용된다. 확장 페이지는 언어별 설정을 `"[javascript][typescript]"`처럼 합쳐 쓰면 동작하지 않으니 언어마다 블록을 따로 두라고 안내한다.

### Stylelint

![Stylelint 상세 화면](./images/vscode-extensions-web-stylelint-detail.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

CSS·PostCSS를 저장소의 Stylelint 규칙으로 검사한다. VS Code 내장 CSS 검사(`css.validate`)를 끄지 않으면 같은 오류가 두 번 표시된다고 확장 페이지가 안내한다.

![Stylelint가 저장소 규칙으로 잡은 z-index](./images/vscode-extensions-stylelint.jpg 'zzDemo.css. z-index: 999를 MacFolio의 stylelint.config.mjs 규칙(declaration-property-value-allowed-list)이 거절하고, 규칙에 적어 둔 한국어 메시지를 Error Lens가 그 줄에 표시한다')

### Error Lens

![Error Lens 상세 화면](./images/vscode-extensions-web-errorlens.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

오류·경고 메시지를 마우스를 올리지 않아도 그 줄 끝에 문장으로 표시한다. ESLint·Stylelint·TypeScript가 낸 진단을 모두 같은 방식으로 보여 준다.

![ESLint·Error Lens·Code Spell Checker가 함께 표시한 TypeScript 파일](./images/vscode-extensions-eslint-errorlens.jpg 'zzDemo.ts. 3번 줄은 ESLint의 no-unused-vars 오류(빨간 물결줄)를 Error Lens가 줄 끝에 문장으로 보여 준다. 4·5번 줄의 lable은 Code Spell Checker가 철자 오류로 표시한 것이다.')

### Code Spell Checker

![Code Spell Checker 상세 화면](./images/vscode-extensions-web-code-spell-checker.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

식별자·주석의 영어 철자 오류를 표시한다(위 화면의 `lable`). 다른 언어 사전은 별도 확장으로 제공하고, 확장 페이지의 사전 목록에 한국어 사전은 없다. 프로젝트 고유 단어는 `cspell.json`에 추가해 팀이 공유한다.

### Pretty TypeScript Errors

![Pretty TypeScript Errors 상세 화면](./images/vscode-extensions-web-pretty-ts-errors.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

TypeScript가 내는 타입 중심의 긴 오류 메시지를 다시 배치하고, 메시지 안의 타입을 테마 색으로 강조한다. 타입 옆에 그 선언으로 이동하는 버튼과 오류 설명 페이지(typescript.tv, ts-error-translator)로 가는 버튼을 붙인다. `.ts`뿐 아니라 `.tsx`, Vue·Svelte·Astro 파일의 TypeScript 오류에도 적용된다고 확장 페이지가 안내한다. 원래 오류 메시지도 그대로 남는다.

### 저장할 때 포맷과 자동 수정

다섯 확장을 함께 쓸 때 저장 한 번으로 포맷과 자동 수정을 실행하는 설정이다. 키와 값은 각 확장 페이지의 안내를 따랐다.

```jsonc
// .vscode/settings.json
{
	"editor.defaultFormatter": "esbenp.prettier-vscode",
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"source.fixAll.eslint": "explicit",
		"source.fixAll.stylelint": "explicit",
	},
	// 내장 CSS 검사를 끄고 Stylelint만 쓴다 (같은 오류가 두 번 나오지 않게)
	"css.validate": false,
	"stylelint.validate": ["css", "postcss"],
}
```

## ② 테스트

두 확장 모두 VS Code의 Testing 보기(테스트 탐색기)에 시험을 나열하고, 시험 이름 옆의 ▶로 하나만 실행한다. 실패한 시험에 중단점을 걸고 디버그할 수 있어 `console.log`를 넣었다 빼는 일이 줄어든다.

### Playwright Test for VSCode

![Playwright Test for VSCode 상세 화면](./images/vscode-extensions-web-playwright.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

E2E 시험을 실행·디버그하고, 동작 녹화와 trace 보기를 지원한다. Playwright 1.38 이상이 필요하다.

- **프로젝트 고르기:** `playwright.config.ts`의 projects를 읽어 어느 브라우저로 실행할지 고르게 한다. MacFolio는 desktop-chromium·mobile-iphone·mobile-android 세 프로젝트가 있어 휴대폰 시험만 골라 실행할 수 있다.
- **로케이터 고르기(Pick locator):** 브라우저에서 요소 위에 마우스를 올리면 `getByRole` 같은 로케이터를 만들어 준다. 접근성 이름으로 요소를 찾는 시험을 쓸 때 이름을 추측하지 않아도 된다.

### Vitest

![Vitest 상세 화면](./images/vscode-extensions-web-vitest.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

단위 시험을 실행·디버그하고, 커버리지와 파일 변경 시 다시 실행을 지원한다. Vitest 1.4 이상이 필요하다. `vitest.config.ts`의 projects를 그대로 쓰므로, MacFolio API처럼 단위(unit)와 E2E(e2e) 프로젝트를 나눈 설정도 탐색기에 따로 보인다.

![Testing 보기에 나열된 Playwright·Vitest 시험](./images/vscode-extensions-testing.jpg 'Testing 보기. Playwright 확장은 apps/react/playwright.config.ts의 프로젝트별 항목을, Vitest 확장은 apps/api의 e2e 프로젝트 시험 파일([e2e] 표시)을 나열한다. 아래 Playwright 판의 TOOLS에 Pick locator·Record new가 있다')

## ③ API·데이터

### REST Client

![REST Client 상세 화면](./images/vscode-extensions-web-rest-client-detail.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

`.http`·`.rest` 파일에 적은 HTTP 요청을 보내고 응답을 옆 창에 표시한다. 요청을 텍스트 파일로 저장하므로 저장소에 커밋해 팀이 같은 요청을 쓴다. 환경 변수(`rest-client.environmentVariables`), 파일 변수(`@name = value`), 앞 요청의 응답 값을 다음 요청에 쓰는 요청 변수를 지원한다. 세션 쿠키가 필요한 관리자 API를 시험할 때 로그인 요청의 응답을 다음 요청에 넘길 수 있다.

![REST Client로 보낸 요청과 응답](./images/vscode-extensions-rest-client.jpg 'zz-health.http. 요청 줄 위의 Send Request를 누르면 오른쪽 창에 응답 헤더가 열린다. 배포된 MacFolio API의 /health 응답으로, CSP·HSTS 같은 보안 헤더를 한눈에 확인할 수 있다.')

### Prisma

![Prisma 상세 화면](./images/vscode-extensions-web-prisma-detail.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

`schema.prisma`의 강조·포맷·자동 완성·린트·정의로 이동·이름 바꾸기를 지원한다. 모델 이름을 바꾸면 쓰는 곳을 모두 고치고, 필요하면 `@map`·`@@map`을 붙인다. MacFolio의 `apps/api/prisma/schema.prisma`를 편집할 때 오타가 저장 전에 드러난다.

![Prisma 확장으로 연 schema.prisma](./images/vscode-extensions-prisma.jpg 'apps/api/prisma/schema.prisma. Prisma 확장이 model·datasource 같은 키워드를 구분해 칠하고, /// 문서 주석을 함께 보여 준다. 블록 위의 회색 글자는 GitLens의 CodeLens(마지막 수정 시각·작성자)다')

### Container Tools

![Container Tools 상세 화면](./images/vscode-extensions-web-container-tools.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

Dockerfile·Compose 편집 지원, 컨테이너 관리, 컨테이너 안 디버깅을 제공한다. 예전에 Docker 확장(`ms-azuretools.vscode-docker`)이 하던 기능을 이 확장이 넘겨받았고, Docker 확장을 설치했다면 확장 팩으로 함께 설치되었을 수 있다. 확장 페이지는 고급 편집 지원으로 Docker DX(`docker.docker`)를 함께 권한다.

## ④ HTML·CSS·언어

TypeScript 언어 지원은 VS Code에 기본으로 들어 있다. [공식 문서](https://code.visualstudio.com/docs/languages/typescript)에 따르면 언어 지원은 포함되어 있지만 컴파일러(`tsc`)는 포함되어 있지 않다. 편집기는 기본적으로 VS Code에 들어 있는 TypeScript로 오류를 계산하므로, 프로젝트의 TypeScript와 버전이 다르면 편집기와 `tsc`의 결과가 어긋날 수 있다. 명령 팔레트의 **TypeScript: Select TypeScript Version**으로 작업 공간 버전을 고르면 같은 버전을 쓴다([공식 문서](https://code.visualstudio.com/docs/typescript/typescript-compiling)). Tailwind CSS·Vue 확장은 그 프레임워크를 쓸 때만 설치하고, 이어지는 네 확장은 HTML·CSS를 직접 다룰 때 쓴다.

### Tailwind CSS IntelliSense

![Tailwind CSS IntelliSense 상세 화면](./images/vscode-extensions-web-tailwindcss.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

클래스 자동 완성, 클래스의 실제 CSS 미리보기, 오류 표시를 제공한다. 작업 공간에 `tailwindcss` 패키지가 설치되어 있어야 동작한다. v4는 `@import "tailwindcss"`가 있는 CSS 파일을, v3 이하는 `tailwind.config.*` 파일을 찾아 활성화된다.

### Vue (Official)

![Vue (Official) 상세 화면](./images/vscode-extensions-web-vue.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

Vue 단일 파일 컴포넌트(`.vue`)를 지원한다. 예전 Vue 확장인 Vetur의 Marketplace 페이지는 새 공식 편집기 지원으로 Volar를 안내한다. Volar가 지금의 Vue (Official)이고, ID에 `volar`가 남아 있다.

### CSS Peek

![CSS Peek 상세 화면](./images/vscode-extensions-web-css-peek.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

HTML·React JSX/TSX·Vue·Svelte 등의 class·id 문자열에서 그 이름을 정의한 CSS·SCSS·Less 규칙을 찾는다. Peek Definition, Go to Definition(F12), ⌘를 누른 채 올리는 Hover를 지원한다. VS Code 내장 CSS 지원은 Sass·Less 변수와 CSS 변수의 선언 찾기, `@import`·`url()` 링크 이동만 지원하고, HTML의 class에서 CSS 규칙으로 가는 기능은 없다([공식 문서](https://code.visualstudio.com/docs/languages/css)).

![CSS Peek로 TSX의 className에서 연 CSS 규칙](./images/vscode-extensions-css-peek.jpg 'SearchKeywords.tsx 232번 줄의 className="search-console-bar"에서 Peek Definition을 실행하면, 아래 창에 Activity.css 704번 줄의 .search-console-bar 규칙이 열린다. 경로 표시는 촬영 환경의 임시 경로라 가렸다')

### HTML CSS Support

![HTML CSS Support 상세 화면](./images/vscode-extensions-web-html-css-support.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

HTML의 `id`·`class` 속성 값을 같은 파일의 스타일과 지정한 스타일시트에서 찾아 자동 완성한다. 로컬 스타일시트의 id·class 선택자로 이동하는 기능과 class 속성 검사도 있다. 참조할 스타일시트는 `css.styleSheets`(glob 사용 가능)에, 적용할 언어는 `css.enabledLanguages`(기본값 `["html"]`)에 적는다.

### PostCSS Language Support

![PostCSS Language Support 상세 화면](./images/vscode-extensions-web-postcss.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

VS Code 내장 CSS 언어 지원에서 출발해 최신·실험 CSS 문법의 강조를 더한다. 중첩 규칙(nesting), `@custom-media`, `@custom-selector`, `:is()`·`:where()`, CSS Modules의 `:global`·`composes` 등을 인식하고, `.pcss`·`.postcss` 파일에도 적용된다. 이런 문법을 쓰거나 PostCSS 플러그인으로 CSS를 변환하는 프로젝트에서 필요하다. MacFolio의 CSS는 중첩 규칙 없이 표준 문법만 써서 이 확장 없이도 강조가 맞다. 상세 화면 기준 마지막 배포가 6년 전이라는 점도 함께 본다.

### Live Server · Live Preview

![Live Server 상세 화면](./images/vscode-extensions-web-live-server.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

![Live Preview 상세 화면](./images/vscode-extensions-web-live-preview.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

빌드 도구 없이 HTML 파일을 로컬 서버로 띄워 보는 확장이다. Live Server는 상태 표시줄의 **Go Live**로 서버를 켜고, 파일을 저장할 때마다 브라우저를 새로 고친다. Microsoft의 Live Preview는 편집기 안 미리 보기를 제공하고, 기본값으로 저장하지 않아도 편집 내용을 반영한다(`livePreview.autoRefreshPreview`). Live Preview 페이지는 React·Angular 같은 앱에는 VS Code의 통합 브라우저를 권한다. Vite처럼 개발 서버가 있는 프로젝트는 그 서버를 쓰므로 두 확장이 필요 없다.

## ⑤ Git

### GitLens — Git supercharged

![GitLens — Git supercharged 상세 화면](./images/vscode-extensions-web-gitlens-detail.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

줄 끝에 작성자·커밋을 표시(blame)하고, 파일·줄 기록과 커밋 상세 hover를 제공한다. 줄별 blame, hover, 파일·줄 기록은 무료(Community)다. Commit Graph와 Worktrees 등은 Pro 요금제 기능이며, Commit Graph는 공개 저장소에서 무료 GitKraken 계정으로 쓸 수 있다고 확장 페이지가 안내한다.

![GitLens가 줄 끝에 표시한 blame](./images/vscode-extensions-gitlens.jpg 'useMemoLibrary.ts 60번 줄. 커서가 있는 줄 끝에 마지막으로 고친 시각(2 weeks ago)과 그 커밋 메시지가 흐리게 표시된다')

### Git Graph

![Git Graph 상세 화면](./images/vscode-extensions-web-git-graph-detail.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

브랜치·병합 기록을 그래프로 보고, 그래프에서 Git 작업을 실행한다. 병합 커밋(merge commit)으로 PR을 합치는 저장소에서는 브랜치가 갈라지고 합쳐지는 모양을 그래프로 봐야 기록을 읽기 쉽다. 병합 방식의 차이는 [GitHub 병합 방식 세 가지](/memo/merge-strategies)에 정리했다.

![Git Graph로 본 MacFolio 브랜치 기록](./images/vscode-extensions-git-graph.jpg 'Git Graph. 색마다 한 브랜치이고, PR마다 갈라졌다 병합 커밋(Merge pull request …)으로 main에 합쳐지는 모양이 보인다. 맨 위 Uncommitted Changes는 촬영용 파일이다')

## ⑥ 원격·협업

### Dev Containers

![Dev Containers 상세 화면](./images/vscode-extensions-web-dev-containers.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

폴더를 Docker 컨테이너 안에서 열고 편집한다(Docker CLI 필요). Node 버전, 데이터베이스 같은 개발 환경을 `devcontainer.json`으로 저장소에 적어 두면 팀원이 같은 환경에서 바로 시작한다. 원격 Docker 호스트를 쓰면 로컬에서 Docker 데몬을 실행하지 않아도 된다.

### Remote - SSH

![Remote - SSH 상세 화면](./images/vscode-extensions-web-remote-ssh.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다 웹 버전에서 촬영해 "데스크톱 VS Code에서만 실행된다"는 안내가 함께 보인다')

SSH로 원격 서버의 폴더를 열고 편집한다. 접속할 호스트는 SSH config 형식의 파일에 저장하고, 쓸 파일은 `remote.SSH.configFile` 설정으로 정한다([공식 문서](https://code.visualstudio.com/docs/remote/ssh)). 서버 IP 대신 별칭으로 접속하는 SSH 설정은 [SSH가 시간 초과되던 이유](/memo/ssh-timeout-public-ip)에 정리했다.

### Live Share

![Live Share 상세 화면](./images/vscode-extensions-web-live-share.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

다른 사람과 같은 작업 공간을 실시간으로 함께 편집한다.

## ⑦ 편의

### EditorConfig

![EditorConfig 상세 화면](./images/vscode-extensions-web-editorconfig.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

`.editorconfig`의 들여쓰기·줄바꿈·끝 공백 규칙을 적용한다. Prettier를 쓰지 않는 파일(셸 스크립트 등)이나 다른 편집기를 쓰는 팀원에게도 같은 들여쓰기를 적용할 때 쓴다. [Prettier도 `.editorconfig`를 읽고](https://prettier.io/docs/configuration), `.prettierrc`의 값이 있으면 그 값이 우선하므로 둘을 함께 둘 수 있다.

### Path Intellisense

![Path Intellisense 상세 화면](./images/vscode-extensions-web-path-intellisense.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

import 경로의 파일 이름을 자동 완성한다. `tsconfig.json`의 `baseUrl`과 `paths`(예: `"@/*": ["src/*"]`)를 읽어 별칭 경로도 완성한다. TypeScript 내장 경로 완성과 겹치면 확장 페이지 안내대로 `typescript.suggest.paths`를 끈다.

### Markdown All in One · markdownlint

![Markdown All in One 상세 화면](./images/vscode-extensions-web-markdown-all-in-one.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

![markdownlint 상세 화면](./images/vscode-extensions-web-markdownlint.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

Markdown All in One은 단축키, 목차 생성, 표 정렬, 목록 이어 쓰기를, markdownlint는 Markdown 문법·스타일 검사를 맡는다. README, 문서, 블로그 글을 Markdown으로 쓰는 저장소에서 유용하다. markdownlint 규칙은 `.markdownlint.json` 등으로 저장소에 둔다.

### Material Icon Theme

![Material Icon Theme 상세 화면](./images/vscode-extensions-web-material-icon-theme.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

파일 탐색기의 파일·폴더 아이콘을 종류별로 구분한다.

### indent-rainbow

![indent-rainbow 상세 화면](./images/vscode-extensions-web-indent-rainbow.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

들여쓰기 단계마다 다른 배경색을 칠해 깊이를 구분한다. 들여쓰기가 탭 크기의 배수가 아닌 줄은 오류 색(`indentRainbow.errorColor`)으로, 탭과 공백이 섞인 줄은 `indentRainbow.tabmixColor`로 표시해 들여쓰기 실수를 찾기 쉽다. 기본 색(`indentRainbow.colors`)은 주로 어두운 배경을 기준으로 정해져 있다. 배경 대신 선으로 표시하려면 `indentRainbow.indicatorStyle`을 `"light"`로 둔다. 선만 필요하면 아래 '확장 대신 쓰는 내장 설정'의 들여쓰기 안내선으로도 충분하다.

### Todo Tree

![Todo Tree 상세 화면](./images/vscode-extensions-web-todo-tree.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

작업 공간의 `TODO`, `FIXME`, `BUG` 주석(기본 태그, `todo-tree.general.tags`)을 트리 보기로 모으고 편집기에서 강조한다. 검색에는 ripgrep을 쓴다.

### Better Comments

![Better Comments 상세 화면](./images/vscode-extensions-web-better-comments.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

주석 앞의 기호로 종류를 나눠 색을 다르게 칠한다. 기본 태그는 `!`(경고), `?`(질문), `TODO`, `*`(강조), `//`(주석 처리한 코드)이고, `better-comments.tags`로 색·굵기·취소선을 바꾼다.

### Import Cost

![Import Cost 상세 화면](./images/vscode-extensions-web-import-cost.jpg 'VS Code 확장 보기의 상세 화면(2026년 10월 27일 촬영). 설치 수와 별점은 촬영 시각의 값이다')

`import`·`require`한 패키지의 크기를 그 줄 끝에 표시한다. 크기는 webpack으로 측정한다. 두 라이브러리가 같은 의존성을 공유하면 그 크기가 양쪽에 따로 더해진다고 확장 페이지가 알려진 문제로 적는다. 실제 번들 크기는 빌드 결과로 확인한다.

AI 코딩 보조 확장도 여러 종류가 있다. 회사 코드에 쓸 때는 기능보다 먼저 코드가 어디로 전송되고 학습에 쓰이는지, 조직 정책이 허용하는지를 확인한다.

## 확장 대신 쓰는 내장 설정

추천 글에 자주 나오는 확장 중 일부는 VS Code에 기능이 들어와 확장 없이 설정으로 쓴다. 확장을 함께 켜 두면 같은 일을 두 번 하거나 서로 충돌한다.

| 확장                        | 내장 기능과 설정                                                        |
| --------------------------- | ----------------------------------------------------------------------- |
| Bracket Pair Colorizer 2    | 괄호 짝 색칠(1.60), `editor.bracketPairColorization.enabled`            |
| 괄호·들여쓰기 안내선 확장   | 안내선(1.61), `editor.guides.bracketPairs`, `editor.guides.indentation` |
| Auto Rename Tag             | 여는 태그를 고치면 닫는 태그도 고침(1.44), `editor.linkedEditing`       |
| Auto Close Tag              | `>`·`/` 입력 시 닫는 태그 입력, `html.autoClosingTags`(기본 켜짐)       |
| 색 표시 확장                | CSS 색 값 옆 색 견본, `editor.colorDecorators`                          |
| Live Server(미리 보기 용도) | HTML 파일 우클릭 › Open in Integrated Browser                           |

근거는 [VS Code 블로그의 괄호 색 내장 글](https://code.visualstudio.com/blogs/2021/09/29/bracket-pair-colorization), [1.61 릴리스 노트](https://code.visualstudio.com/updates/v1_61)(안내선, 예전 `editor.renderIndentGuides`를 대신함), [HTML 문서](https://code.visualstudio.com/docs/languages/html)(태그 자동 닫기, linked editing, 통합 브라우저), [CSS 문서](https://code.visualstudio.com/docs/languages/css)(색 견본)다.

- **괄호 색:** Bracket Pair Colorizer 2 페이지는 이 기능이 VS Code의 기본 기능이 되어 더 개발하지 않는다고 적고 `editor.bracketPairColorization.enabled`를 안내한다. VS Code 블로그의 예에서는 큰 TypeScript 파일에 괄호 하나를 넣었을 때 확장은 색을 다시 칠하는 데 약 10초, 내장 구현은 1ms 미만이 걸렸다.
- **태그 이름 바꾸기:** Auto Rename Tag 페이지는 `editor.linkedEditing`이 켜져 있으면 HTML·Handlebars 파일에서는 확장이 동작하지 않는다고 적는다.

```jsonc
// settings.json
{
	"editor.bracketPairColorization.enabled": true,
	"editor.guides.bracketPairs": "active",
	"editor.guides.indentation": true,
	"editor.linkedEditing": true,
}
```

## 팀에 같은 확장 권하기

### .vscode/extensions.json

저장소에 `.vscode/extensions.json`을 두면 VS Code가 처음 그 폴더를 연 팀원에게 권장 확장 설치를 제안한다([공식 문서](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace#_workspace-recommended-extensions)). 명령 팔레트의 **Extensions: Configure Recommended Extensions (Workspace Folder)**로 파일을 만든다.

```json
{
	"recommendations": [
		"dbaeumer.vscode-eslint",
		"esbenp.prettier-vscode",
		"stylelint.vscode-stylelint",
		"ms-playwright.playwright",
		"vitest.explorer",
		"Prisma.prisma"
	]
}
```

- 권장 목록에는 **저장소 설정 파일과 연결되는 확장**(①②③)만 넣는다. 아이콘 테마나 GitLens처럼 개인 취향인 확장은 넣지 않는다.
- 저장 시 포맷 같은 설정은 ① 코드 품질의 `.vscode/settings.json`처럼 저장소에 두어 공유한다. 개인 설정(글꼴, 테마)까지 넣으면 팀원의 사용자 설정을 덮어쓰므로, 저장소 규칙과 관련된 키만 둔다.

### 확장이 많을 때: Extension Bisect와 프로필

확장이 늘면 VS Code 시작이 느려지거나, 확장끼리 같은 단축키·포맷을 놓고 충돌할 수 있다.

- **Extension Bisect:** 명령 팔레트의 **Help: Start Extension Bisect**는 켜진 확장의 절반을 끄고 문제가 남는지 묻는 과정을 되풀이해 원인 확장을 찾는다. 확장이 N개면 약 log₂N + 1번 확인으로 끝난다. [공식 블로그](https://code.visualstudio.com/blogs/2021/02/16/extension-bisect)의 예에서는 확장 24개를 4~5번 만에 좁혔다.
- **프로필:** [프로필](https://code.visualstudio.com/docs/configure/profiles)은 확장·설정·단축키를 묶은 이름 붙은 묶음이다. 프로필을 고르면 그 폴더나 작업 공간에 연결되어, 다음에 열 때 자동으로 그 프로필이 켜진다. 웹 프로젝트용, 문서 작성용처럼 나눠 두면 프로젝트마다 필요한 확장만 켜진다.

## 한 번에 설치하기

확장을 하나씩 검색해 설치하지 않고 목록으로 한 번에 설치하는 방법은 세 가지다. 32개를 모두 설치하면 시작이 느려지고 기능이 겹칠 수 있으므로, 필요한 묶음만 골라 목록을 줄이는 편이 낫다.

| 방법                      | 쓰는 곳                | 특징                                                        |
| ------------------------- | ---------------------- | ----------------------------------------------------------- |
| 터미널 명령               | 내 컴퓨터에 바로 설치  | 목록을 붙여 넣으면 끝난다                                   |
| `.vscode/extensions.json` | 팀 저장소              | 폴더를 연 팀원에게 설치를 제안한다                          |
| 프로필 내보내기·가져오기  | 다른 컴퓨터, 다른 사람 | 확장과 설정을 파일 하나로 옮기고, 기존 설정과 섞이지 않는다 |

### 1. 터미널 명령

`code --install-extension <ID>`는 한 번에 여러 번 쓸 수 있고, 그만큼의 확장을 한 번에 설치한다([공식 문서](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace#_command-line-extension-management)). macOS에서는 VS Code의 명령 팔레트(⇧⌘P)에서 **Shell Command: Install 'code' command in PATH**를 한 번 실행해야 터미널에서 `code` 명령을 찾는다.

아래 블록을 터미널에 그대로 붙여 넣으면 목록의 확장을 차례로 설치한다. `xargs -n 1`이 줄마다 `code --install-extension <ID>`를 한 번씩 실행한다. 먼저 저장소 설정과 연결되는 ①·② 묶음의 핵심 6개다.

```bash
xargs -n 1 code --install-extension <<'EOF'
dbaeumer.vscode-eslint
esbenp.prettier-vscode
stylelint.vscode-stylelint
usernamehw.errorlens
ms-playwright.playwright
vitest.explorer
EOF
```

<details>
<summary>이 글에서 다룬 32개 전체를 설치하는 명령</summary>

```bash
xargs -n 1 code --install-extension <<'EOF'
dbaeumer.vscode-eslint
esbenp.prettier-vscode
stylelint.vscode-stylelint
usernamehw.errorlens
streetsidesoftware.code-spell-checker
ms-playwright.playwright
vitest.explorer
humao.rest-client
Prisma.prisma
ms-azuretools.vscode-containers
bradlc.vscode-tailwindcss
Vue.volar
eamodio.gitlens
mhutchie.git-graph
ms-vscode-remote.remote-containers
ms-vscode-remote.remote-ssh
ms-vsliveshare.vsliveshare
EditorConfig.EditorConfig
christian-kohler.path-intellisense
yzhang.markdown-all-in-one
DavidAnson.vscode-markdownlint
PKief.material-icon-theme
yoavbls.pretty-ts-errors
pranaygp.vscode-css-peek
ecmel.vscode-html-css
csstools.postcss
ritwickdey.LiveServer
ms-vscode.live-server
oderwat.indent-rainbow
Gruntfuggly.todo-tree
aaron-bond.better-comments
wix.vscode-import-cost
EOF
```

</details>

설치된 확장은 `code --list-extensions`로 확인한다.

### 2. extensions.json으로 팀원에게 권하기

앞 절의 `.vscode/extensions.json`을 저장소에 두면, VS Code가 그 폴더를 처음 연 사람에게 권장 확장 설치를 제안한다. 명령 팔레트의 **Extensions: Show Recommended Extensions**를 실행하면 권장 목록을 다시 열어 설치할 수 있다([공식 문서](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace#_workspace-recommended-extensions)).

### 3. 프로필로 옮기기

확장을 설치해 둔 VS Code에서 프로필 편집기의 **Export...**로 프로필을 내보내면, 확장과 설정이 `.code-profile` 파일 하나(또는 비공개 GitHub gist 주소)로 저장된다. 다른 컴퓨터에서는 **New Profile** 옆 메뉴의 **Import Profile...**에 그 파일이나 주소를 넣으면 같은 확장 묶음이 새 프로필로 만들어진다([공식 문서](https://code.visualstudio.com/docs/configure/profiles)). 기존 프로필과 따로 있으므로, 써 보고 맞지 않으면 프로필만 지우면 된다.

## 참고

추천 후보는 아래 글들에서 여러 번 꼽힌 확장을 골랐고, 각 확장의 이름·ID·기능은 Marketplace 페이지에서 다시 확인했다.

- [20 Best VS Code Extensions for Web Development in 2026](https://www.syncfusion.com/blogs/post/best-visual-studio-code-extensions) (Syncfusion, 2026년 9월 수정)
- [21 Best VS Code Extensions for 2026, by Category](https://www.testmuai.com/blog/best-vs-code-extensions/) (TestMu AI, 2026년 10월 수정)
- [Best VS Code extensions to use in 2026](https://www.educative.io/blog/top-vscode-extensions) (Educative, 2026년 3월)
- VS Code 공식 문서: [HTML](https://code.visualstudio.com/docs/languages/html), [CSS](https://code.visualstudio.com/docs/languages/css), [괄호 색 내장 블로그](https://code.visualstudio.com/blogs/2021/09/29/bracket-pair-colorization), [1.61 릴리스 노트](https://code.visualstudio.com/updates/v1_61)

## 관련 글

- [커밋 규칙을 문서 대신 CI로 지키기](/memo/commit-conventions-ci): 편집기 검사와 같은 규칙을 CI에서도 확인하는 방법
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion): Playwright 확장으로 실행하는 시험의 구성
- [TypeScript 7로 올리기 — 컴파일러는 7, 린트는 6을 나란히](/memo/typescript-7-side-by-side): 편집기·컴파일러·린트가 서로 다른 TypeScript 버전을 쓰는 경우
- [Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup): 확장이 쓰는 Node·패키지 도구 설치

#VSCode #개발환경 #도구

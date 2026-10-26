---
title: 웹 개발자를 위한 VS Code 확장 — 목적별 추천과 팀에 공유하는 설정
date: 2026-10-26
category: 기술 노트/개발 도구/에디터
summary: 웹 프론트엔드·풀스택 개발에 쓰는 VS Code 확장을 코드 품질, 테스트, API·데이터, 언어, Git, 원격, 편의 일곱 묶음으로 정리했다. 확장 ID와 기능은 Marketplace에서 확인했고, 저장 시 포맷 설정, extensions.json 공유, Extension Bisect를 함께 적었다.
---

VS Code 확장은 많이 설치할수록 편해지는 것이 아니라, **프로젝트에 있는 설정 파일을 편집기가 읽게 해 주는 확장**이 가장 효과가 크다. ESLint 확장은 `eslint.config.js`를, Playwright 확장은 `playwright.config.ts`를 읽어 터미널에서 돌리던 검사를 편집 중에 보여 준다. 이 글은 웹 프론트엔드·풀스택 개발자 기준으로 확장을 목적별 일곱 묶음으로 나누고, 각 확장이 저장소의 어떤 파일과 연결되는지 MacFolio 저장소를 예로 적는다.

- 확장 이름·게시자·ID·기능은 2026년 10월 26일 [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode)의 각 확장 페이지와 [VS Code 공식 문서](https://code.visualstudio.com/docs)에서 확인했다. 설치 수처럼 바뀌는 수치는 적지 않는다.
- 확장 ID(`게시자.이름`)는 Extensions 보기(⇧⌘X) 검색 칸에 그대로 넣으면 정확히 그 확장이 나온다. 이름이 비슷한 다른 확장과 구분할 때 쓴다.

- 글 안의 화면은 2026년 10월 26일 VS Code 1.143.1의 웹 버전(`code serve-web`)으로 MacFolio 저장소를 열어 직접 촬영하고 필요한 부분만 잘랐다. 확장은 빈 확장 폴더에 새로 설치한 Marketplace 최신 버전이고, 시험용 파일(`zzDemo.ts`, `zzDemo.css`, `zz-health.http`)은 촬영용으로만 만들었다.
- 각 절 끝의 접기 블록에는 확장마다 VS Code 확장 보기(⇧⌘X)의 상세 화면을 넣었다. 2026년 10월 27일 같은 웹 버전에서 확장을 ID로 검색해 연 화면이고, 설치 수·별점은 그 시각의 값이다.

![목적별 확장 묶음](./images/vscode-extensions-map.svg '도식. 위 줄은 저장소 설정 파일과 바로 연결되는 확장, 아래 줄은 작업 환경을 넓히는 확장')

## ① 코드 품질

| 확장 (ID)                                                                                                                                               | 하는 일                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `dbaeumer.vscode-eslint`                                           | 편집 중에 ESLint 규칙 위반을 표시하고 자동 수정 |
| [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `esbenp.prettier-vscode`                        | 프로젝트의 Prettier로 파일을 포맷               |
| [Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) `stylelint.vscode-stylelint`                                | CSS·PostCSS를 Stylelint 규칙으로 검사           |
| [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) `usernamehw.errorlens`                                           | 오류·경고 메시지를 그 줄 끝에 바로 표시         |
| [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) `streetsidesoftware.code-spell-checker` | 식별자·주석의 영어 철자 오류 표시               |

세 검사 도구(ESLint·Prettier·Stylelint)의 확장은 **확장에 들어 있는 규칙이 아니라 저장소에 설치된 패키지와 설정 파일**을 쓴다. 그래서 CI와 편집기의 결과가 같다.

- **ESLint:** ESLint 9 이상의 flat config(`eslint.config.js` 등)를 읽는다. 확장 페이지에 따르면 ESLint 10부터는 `eslint.useFlatConfig` 설정을 보지 않고 항상 flat config를 쓴다. MacFolio는 ESLint 10과 `eslint.config.js`를 쓰므로 따로 설정할 것이 없다.
- **Prettier:** 기본적으로 프로젝트 의존성에 설치된 Prettier를 쓰고, 처음 불러올 때 사용자 확인을 받는다. MacFolio의 `.prettierrc`(탭, 작은따옴표, 줄 길이 120)가 그대로 적용된다.
- **Stylelint:** VS Code 내장 CSS 검사(`css.validate`)를 끄지 않으면 같은 오류가 두 번 표시된다고 확장 페이지가 안내한다.
- **Code Spell Checker:** 다른 언어 사전은 별도 확장으로 제공한다. 확장 페이지의 사전 목록에 한국어 사전은 없다. 프로젝트 고유 단어는 `cspell.json`에 추가해 팀이 공유한다.

![ESLint·Error Lens·Code Spell Checker가 함께 표시한 TypeScript 파일](./images/vscode-extensions-eslint-errorlens.jpg 'zzDemo.ts. 3번 줄은 ESLint의 no-unused-vars 오류(빨간 물결줄)를 Error Lens가 줄 끝에 문장으로 보여 준다. 4·5번 줄의 lable은 Code Spell Checker가 철자 오류로 표시한 것이다.')

![Stylelint가 저장소 규칙으로 잡은 z-index](./images/vscode-extensions-stylelint.jpg 'zzDemo.css. z-index: 999를 MacFolio의 stylelint.config.mjs 규칙(declaration-property-value-allowed-list)이 거절하고, 규칙에 적어 둔 한국어 메시지를 Error Lens가 그 줄에 표시한다')

저장할 때 포맷과 자동 수정을 한 번에 실행하는 설정은 다음과 같다. 키와 값은 각 확장 페이지의 안내를 따랐다.

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

Prettier 확장 페이지는 언어별 설정을 `"[javascript][typescript]"`처럼 합쳐 쓰면 동작하지 않으니 언어마다 블록을 따로 두라고 안내한다.

<details>
<summary>확장 보기의 상세 화면 5장</summary>

![ESLint 확장의 상세 화면](./images/vscode-extensions-web-eslint.jpg 'VS Code 확장 보기의 ESLint 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Prettier - Code formatter 확장의 상세 화면](./images/vscode-extensions-web-prettier.jpg 'VS Code 확장 보기의 Prettier - Code formatter 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Stylelint 확장의 상세 화면](./images/vscode-extensions-web-stylelint-detail.jpg 'VS Code 확장 보기의 Stylelint 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Error Lens 확장의 상세 화면](./images/vscode-extensions-web-errorlens.jpg 'VS Code 확장 보기의 Error Lens 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Code Spell Checker 확장의 상세 화면](./images/vscode-extensions-web-code-spell-checker.jpg 'VS Code 확장 보기의 Code Spell Checker 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ② 테스트

| 확장 (ID)                                                                                                                             | 하는 일                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) `ms-playwright.playwright` | E2E 시험 실행·디버그, 로케이터 고르기, 동작 녹화, trace 보기 |
| [Vitest](https://marketplace.visualstudio.com/items?itemName=vitest.explorer) `vitest.explorer`                                       | 단위 시험 실행·디버그, 커버리지, 파일이 바뀌면 다시 실행     |

![Testing 보기에 나열된 Playwright·Vitest 시험](./images/vscode-extensions-testing.jpg 'Testing 보기. Playwright 확장은 apps/react/playwright.config.ts의 프로젝트별 항목을, Vitest 확장은 apps/api의 e2e 프로젝트 시험 파일([e2e] 표시)을 나열한다. 아래 Playwright 판의 TOOLS에 Pick locator·Record new가 있다')

두 확장 모두 VS Code의 Testing 보기(테스트 탐색기)에 시험을 나열하고, 시험 이름 옆의 ▶로 하나만 실행한다. 실패한 시험에 중단점을 걸고 디버그할 수 있어 `console.log`를 넣었다 빼는 일이 줄어든다.

- **Playwright:** `playwright.config.ts`의 projects를 읽어 어느 브라우저로 실행할지 고르게 한다. MacFolio는 desktop-chromium·mobile-iphone·mobile-android 세 프로젝트가 있어, 휴대폰 시험만 골라 실행할 수 있다. Playwright 1.38 이상이 필요하다.
- **로케이터 고르기(Pick locator):** 브라우저에서 요소 위에 마우스를 올리면 `getByRole` 같은 로케이터를 만들어 준다. 접근성 이름으로 요소를 찾는 시험을 쓸 때 이름을 추측하지 않아도 된다.
- **Vitest:** Vitest 1.4 이상이 필요하다. `vitest.config.ts`의 projects를 그대로 쓰므로, MacFolio API처럼 단위(unit)와 E2E(e2e) 프로젝트를 나눈 설정도 탐색기에 따로 보인다.

<details>
<summary>확장 보기의 상세 화면 2장</summary>

![Playwright Test for VSCode 확장의 상세 화면](./images/vscode-extensions-web-playwright.jpg 'VS Code 확장 보기의 Playwright Test for VSCode 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Vitest 확장의 상세 화면](./images/vscode-extensions-web-vitest.jpg 'VS Code 확장 보기의 Vitest 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ③ API·데이터

| 확장 (ID)                                                                                                                                | 하는 일                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) `humao.rest-client`                                 | `.http`·`.rest` 파일에 적은 HTTP 요청을 보내고 응답을 옆 창에 표시 |
| [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) `Prisma.prisma`                                              | `schema.prisma` 강조·포맷·자동 완성·린트·정의로 이동·이름 바꾸기   |
| [Container Tools](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-containers) `ms-azuretools.vscode-containers` | Dockerfile·Compose 편집 지원, 컨테이너 관리, 컨테이너 안 디버깅    |

- **REST Client:** 요청을 텍스트 파일로 저장하므로 저장소에 커밋해 팀이 같은 요청을 쓴다. 환경 변수(`rest-client.environmentVariables`), 파일 변수(`@name = value`), 앞 요청의 응답 값을 다음 요청에 쓰는 요청 변수를 지원한다. 로그인한 세션 쿠키가 필요한 관리자 API를 시험할 때, 로그인 요청의 응답을 다음 요청에 넘길 수 있다.
- **Prisma:** 모델 이름을 바꾸면 쓰는 곳을 모두 고치고, 필요하면 `@map`·`@@map`을 붙인다. MacFolio의 `apps/api/prisma/schema.prisma`를 편집할 때 오타가 저장 전에 드러난다.
- **Container Tools:** 예전에 Docker 확장(`ms-azuretools.vscode-docker`)이 하던 언어 서비스·컨테이너 관리·디버깅 기능을 이 확장이 넘겨받았다. Docker 확장을 설치했다면 확장 팩으로 함께 설치되었을 수 있다. 확장 페이지는 고급 편집 지원으로 Docker DX(`docker.docker`)를 함께 권한다.

![REST Client로 보낸 요청과 응답](./images/vscode-extensions-rest-client.jpg 'zz-health.http. 요청 줄 위의 Send Request를 누르면 오른쪽 창에 응답 헤더가 열린다. 배포된 MacFolio API의 /health 응답으로, CSP·HSTS 같은 보안 헤더를 한눈에 확인할 수 있다.')

![Prisma 확장으로 연 schema.prisma](./images/vscode-extensions-prisma.jpg 'apps/api/prisma/schema.prisma. Prisma 확장이 model·datasource 같은 키워드를 구분해 칠하고, /// 문서 주석을 함께 보여 준다. 블록 위의 회색 글자는 GitLens의 CodeLens(마지막 수정 시각·작성자)다')

<details>
<summary>확장 보기의 상세 화면 3장</summary>

![REST Client 확장의 상세 화면](./images/vscode-extensions-web-rest-client-detail.jpg 'VS Code 확장 보기의 REST Client 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Prisma 확장의 상세 화면](./images/vscode-extensions-web-prisma-detail.jpg 'VS Code 확장 보기의 Prisma 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Container Tools 확장의 상세 화면](./images/vscode-extensions-web-container-tools.jpg 'VS Code 확장 보기의 Container Tools 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ④ 언어·프레임워크

TypeScript 언어 지원은 VS Code에 기본으로 들어 있다. [공식 문서](https://code.visualstudio.com/docs/languages/typescript)에 따르면 언어 지원은 포함되어 있지만 컴파일러(`tsc`)는 포함되어 있지 않다. 그래서 TypeScript를 위해 따로 설치할 확장은 없고, 쓰는 프레임워크가 있을 때만 아래 확장을 더한다.

| 확장 (ID)                                                                                                                              | 설치하는 경우                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) `bradlc.vscode-tailwindcss` | Tailwind CSS를 쓸 때. 클래스 자동 완성, 클래스의 실제 CSS 미리보기, 오류 표시 |
| [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) `Vue.volar`                                            | Vue 단일 파일 컴포넌트(`.vue`)를 쓸 때                                        |

- **TypeScript 버전 맞추기:** 편집기는 기본적으로 VS Code에 들어 있는 TypeScript로 오류를 계산한다. 프로젝트의 TypeScript와 버전이 다르면 편집기와 `tsc`의 결과가 어긋날 수 있다. 명령 팔레트의 **TypeScript: Select TypeScript Version**으로 작업 공간 버전을 고르면 같은 버전을 쓴다([공식 문서](https://code.visualstudio.com/docs/typescript/typescript-compiling)).
- **Tailwind CSS:** 작업 공간에 `tailwindcss` 패키지가 설치되어 있어야 동작한다. v4는 `@import "tailwindcss"`가 있는 CSS 파일을, v3 이하는 `tailwind.config.*` 파일을 찾아 활성화된다.
- **Vue:** 예전 Vue 확장인 Vetur의 Marketplace 페이지는 새 공식 편집기 지원으로 Volar를 안내한다. Volar가 지금의 Vue (Official)이고, ID에 `volar`가 남아 있다.

<details>
<summary>확장 보기의 상세 화면 2장 (Tailwind CSS IntelliSense, Vue (Official))</summary>

![Tailwind CSS IntelliSense 확장의 상세 화면](./images/vscode-extensions-web-tailwindcss.jpg 'VS Code 확장 보기의 Tailwind CSS IntelliSense 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Vue (Official) 확장의 상세 화면](./images/vscode-extensions-web-vue.jpg 'VS Code 확장 보기의 Vue (Official) 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ⑤ Git

| 확장 (ID)                                                                                                           | 하는 일                                                        |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [GitLens — Git supercharged](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) `eamodio.gitlens` | 줄 끝에 작성자·커밋 표시(blame), 파일·줄 기록, 커밋 상세 hover |
| [Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) `mhutchie.git-graph`            | 브랜치·병합 기록을 그래프로 보고 그래프에서 Git 작업 실행      |

- **GitLens:** 줄별 blame, hover, 파일·줄 기록은 무료(Community)다. Commit Graph와 Worktrees 등은 Pro 요금제 기능이며, Commit Graph는 공개 저장소에서 무료 GitKraken 계정으로 쓸 수 있다고 확장 페이지가 안내한다.
- **Git Graph:** 병합 커밋(merge commit)으로 PR을 합치는 저장소에서는 브랜치가 갈라지고 합쳐지는 모양을 그래프로 봐야 기록을 읽기 쉽다. 병합 방식의 차이는 [GitHub 병합 방식 세 가지](/memo/merge-strategies)에 정리했다.

![GitLens가 줄 끝에 표시한 blame](./images/vscode-extensions-gitlens.jpg 'useMemoLibrary.ts 60번 줄. 커서가 있는 줄 끝에 마지막으로 고친 시각(2 weeks ago)과 그 커밋 메시지가 흐리게 표시된다')

![Git Graph로 본 MacFolio 브랜치 기록](./images/vscode-extensions-git-graph.jpg 'Git Graph. 색마다 한 브랜치이고, PR마다 갈라졌다 병합 커밋(Merge pull request …)으로 main에 합쳐지는 모양이 보인다. 맨 위 Uncommitted Changes는 촬영용 파일이다')

<details>
<summary>확장 보기의 상세 화면 2장</summary>

![GitLens — Git supercharged 확장의 상세 화면](./images/vscode-extensions-web-gitlens-detail.jpg 'VS Code 확장 보기의 GitLens — Git supercharged 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Git Graph 확장의 상세 화면](./images/vscode-extensions-web-git-graph-detail.jpg 'VS Code 확장 보기의 Git Graph 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ⑥ 원격·협업

| 확장 (ID)                                                                                                                                     | 하는 일                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) `ms-vscode-remote.remote-containers` | 폴더를 Docker 컨테이너 안에서 열고 편집 (Docker CLI 필요) |
| [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) `ms-vscode-remote.remote-ssh`                 | SSH로 원격 서버의 폴더를 열고 편집                        |
| [Live Share](https://marketplace.visualstudio.com/items?itemName=ms-vsliveshare.vsliveshare) `ms-vsliveshare.vsliveshare`                     | 다른 사람과 같은 작업 공간을 실시간으로 함께 편집         |

- **Dev Containers:** Node 버전, 데이터베이스 같은 개발 환경을 `devcontainer.json`으로 저장소에 적어 두면, 팀원이 같은 환경에서 바로 시작한다. Docker 데몬은 원격 Docker 호스트를 쓰면 로컬에서 실행하지 않아도 된다.
- **Remote - SSH:** 접속할 호스트는 SSH config 형식의 파일에 저장하고, 쓸 파일은 `remote.SSH.configFile` 설정으로 정한다([공식 문서](https://code.visualstudio.com/docs/remote/ssh)). 서버 IP 대신 별칭으로 접속하는 SSH 설정은 [SSH가 시간 초과되던 이유](/memo/ssh-timeout-public-ip)에 정리했다.

<details>
<summary>확장 보기의 상세 화면 3장</summary>

![Dev Containers 확장의 상세 화면](./images/vscode-extensions-web-dev-containers.jpg 'VS Code 확장 보기의 Dev Containers 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Remote - SSH 확장의 상세 화면](./images/vscode-extensions-web-remote-ssh.jpg 'VS Code 확장 보기의 Remote - SSH 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다. 웹 버전에서 촬영해 "데스크톱 VS Code에서만 실행된다"는 안내가 함께 보인다')

![Live Share 확장의 상세 화면](./images/vscode-extensions-web-live-share.jpg 'VS Code 확장 보기의 Live Share 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

## ⑦ 편의

| 확장 (ID)                                                                                                                                        | 하는 일                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [EditorConfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) `EditorConfig.EditorConfig`                        | `.editorconfig`의 들여쓰기·줄바꿈·끝 공백 규칙을 적용 |
| [Path Intellisense](https://marketplace.visualstudio.com/items?itemName=christian-kohler.path-intellisense) `christian-kohler.path-intellisense` | import 경로의 파일 이름 자동 완성                     |
| [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one) `yzhang.markdown-all-in-one`               | Markdown 단축키, 목차 생성, 표 정렬, 목록 이어 쓰기   |
| [markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) `DavidAnson.vscode-markdownlint`              | Markdown 문법·스타일 검사                             |
| [Material Icon Theme](https://marketplace.visualstudio.com/items?itemName=PKief.material-icon-theme) `PKief.material-icon-theme`                 | 파일 탐색기의 파일·폴더 아이콘을 종류별로 구분        |

- **EditorConfig:** Prettier를 쓰지 않는 파일(셸 스크립트 등)이나 다른 편집기를 쓰는 팀원에게도 같은 들여쓰기를 적용할 때 쓴다. [Prettier도 `.editorconfig`를 읽고](https://prettier.io/docs/configuration), `.prettierrc`의 값이 있으면 그 값이 우선하므로 둘을 함께 둘 수 있다.
- **Path Intellisense:** `tsconfig.json`의 `baseUrl`과 `paths`(예: `"@/*": ["src/*"]`)를 읽어 별칭 경로도 완성한다. TypeScript 내장 경로 완성과 겹치면 확장 페이지 안내대로 `typescript.suggest.paths`를 끈다.
- **Markdown 두 확장:** README, 문서, 블로그 글을 Markdown으로 쓰는 저장소에서 유용하다. markdownlint 규칙은 `.markdownlint.json` 등으로 저장소에 둔다.

<details>
<summary>확장 보기의 상세 화면 5장</summary>

![EditorConfig 확장의 상세 화면](./images/vscode-extensions-web-editorconfig.jpg 'VS Code 확장 보기의 EditorConfig 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Path Intellisense 확장의 상세 화면](./images/vscode-extensions-web-path-intellisense.jpg 'VS Code 확장 보기의 Path Intellisense 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Markdown All in One 확장의 상세 화면](./images/vscode-extensions-web-markdown-all-in-one.jpg 'VS Code 확장 보기의 Markdown All in One 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![markdownlint 확장의 상세 화면](./images/vscode-extensions-web-markdownlint.jpg 'VS Code 확장 보기의 markdownlint 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

![Material Icon Theme 확장의 상세 화면](./images/vscode-extensions-web-material-icon-theme.jpg 'VS Code 확장 보기의 Material Icon Theme 상세 화면(2026년 10월 27일 촬영). 이름·게시자·설치 수·별점·설명, DETAILS 탭 앞부분, 오른쪽 Installation 표(Identifier·Version·Size). 설치 수와 별점은 촬영 시각 기준이다.')

</details>

AI 코딩 보조 확장도 여러 종류가 있다. 회사 코드에 쓸 때는 기능보다 먼저 코드가 어디로 전송되고 학습에 쓰이는지, 조직 정책이 허용하는지를 확인한다.

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
- 저장 시 포맷 같은 설정은 `.vscode/settings.json`으로 공유한다. 개인 설정(글꼴, 테마)까지 넣으면 팀원의 사용자 설정을 덮어쓰므로, 저장소 규칙과 관련된 키만 둔다.

### 확장이 많을 때: Extension Bisect와 프로필

확장이 늘면 VS Code 시작이 느려지거나, 확장끼리 같은 단축키·포맷을 놓고 충돌할 수 있다.

- **Extension Bisect:** 명령 팔레트의 **Help: Start Extension Bisect**는 켜진 확장의 절반을 끄고 문제가 남는지 묻는 과정을 되풀이해 원인 확장을 찾는다. 확장이 N개면 약 log₂N + 1번 확인으로 끝난다. [공식 블로그](https://code.visualstudio.com/blogs/2021/02/16/extension-bisect)의 예에서는 확장 24개를 4~5번 만에 좁혔다.
- **프로필:** [프로필](https://code.visualstudio.com/docs/configure/profiles)은 확장·설정·단축키를 묶은 이름 붙은 묶음이다. 프로필을 고르면 그 폴더나 작업 공간에 연결되어, 다음에 열 때 자동으로 그 프로필이 켜진다. 웹 프로젝트용, 문서 작성용처럼 나눠 두면 프로젝트마다 필요한 확장만 켜진다.

<details>
<summary>이 글에서 다룬 확장 ID 전체 (복사용)</summary>

```text
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
```

터미널에서 `code --install-extension <ID>`로 하나씩 설치할 수 있다.

</details>

## 관련 글

- [커밋 규칙을 문서 대신 CI로 지키기](/memo/commit-conventions-ci): 편집기 검사와 같은 규칙을 CI에서도 확인하는 방법
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion): Playwright 확장으로 실행하는 시험의 구성
- [TypeScript 7로 올리기 — 컴파일러는 7, 린트는 6을 나란히](/memo/typescript-7-side-by-side): 편집기·컴파일러·린트가 서로 다른 TypeScript 버전을 쓰는 경우
- [Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup): 확장이 쓰는 Node·패키지 도구 설치

#VSCode #개발환경 #도구

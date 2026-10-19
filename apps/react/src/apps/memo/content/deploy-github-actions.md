---
title: 프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만
date: 2026-10-03
category: 개발기/MacFolio/인프라
summary: Cloudflare 빌드 서버가 빌드 환경을 띄우지 못하고 시간 초과로 실패하는 일이 이어졌다. 빌드와 배포를 GitHub Actions로 옮겨, 시험을 통과한 main 커밋만 wrangler deploy로 올리고 PR에는 브랜치 이름으로 된 미리보기 주소를 댓글로 단다.
---

프론트엔드는 Cloudflare Workers에 정적 파일로 올린다. 지금까지는 저장소를 Cloudflare에 연결해 두고, Cloudflare의 빌드 서버(Workers Builds)가 main과 PR 브랜치를 받을 때마다 빌드해서 배포했다. PR은 [#82](https://github.com/hyeoniverse/MacFolio/pull/82)다.

## 배경: 호스팅이 걸어 온 길

이 사이트는 처음 Firebase Hosting에 있었다. [Vite로 옮기며](/memo/cra-to-vite) 9월 28일에 Firebase를 걷어 내고 Cloudflare로 옮겼다. 처음엔 Cloudflare Pages를 준비했다가, 같은 날 Workers의 정적 자산 배포(`wrangler.jsonc`, [#13](https://github.com/hyeoniverse/MacFolio/pull/13))로 바꿨다. 저장소를 대시보드에 연결하면 Cloudflare가 알아서 빌드해 주니, GitHub Actions에는 시험만 두었다. 그 구성으로 닷새를 썼다.

어느 날 PR 미리보기 빌드가 모두 실패했다. GitHub에는 시작과 끝이 같은 초로 찍혀 원인을 알 수 없었고, Cloudflare 대시보드의 로그는 이랬다.

```
Initializing build environment...
Initializing build environment...
Build failed to initialize and was timed out
```

코드를 받기도 전에 빌드 서버가 뜨지 못한 것이다. 빌드 시간 한도는 3,000분 중 150분만 썼으니 한도 때문도 아니었다.

## 원래도 아쉬웠던 점

이 일이 아니어도 구조가 아쉬웠다.

- **시험과 배포가 따로 놀았다.** GitHub Actions의 `check`가 빌드·린트·E2E를 돌리는 동안, Cloudflare는 그 결과와 상관없이 같은 코드를 따로 빌드해서 배포했다. 시험이 깨진 커밋도 사이트에 올라갈 수 있었다.
- **같은 빌드를 두 번 했다.**
- **실패 원인이 GitHub에 남지 않았다.** 로그를 보려면 Cloudflare 대시보드에 들어가야 했다.

## 고를 수 있던 방법

| 방법                                               | 좋은 점                                      | 나쁜 점                                                                         |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Workers Builds를 그대로 두고 다시 시도             | 바꿀 것이 없다                               | 원인이 Cloudflare 쪽이라 언제 또 생길지 모른다. 시험과 따로 논다                |
| Workers Builds에서도 시험을 돌린다                 | 한 곳에서 다 한다                            | E2E(Playwright 브라우저)를 그 빌드 환경에서 돌려야 한다. 로그는 여전히 대시보드 |
| **GitHub Actions가 시험 뒤에 `wrangler`로 올린다** | 시험을 통과한 것만 올라간다. 로그가 GitHub에 | Cloudflare 토큰을 GitHub Secrets에 둬야 한다                                    |

셋째를 골랐다. 이미 GitHub Actions에서 빌드를 한 번 하고 있었으니, 거기서 올리기만 더하면 됐다.

## 옮긴 구조

`ci.yml`에 작업 두 개를 더했다.

- **deploy**: main에 push되면 `check`가 통과한 뒤에만 돈다(`needs: check`). `wrangler deploy`가 `wrangler.jsonc`의 빌드 명령으로 `apps/react/dist`를 만들고 올린다.
- **preview**: PR마다 `wrangler versions upload --preview-alias <브랜치>`로 미리보기 버전을 올린다. 실제 사이트는 바뀌지 않는다. 별칭이 브랜치 이름이라 커밋을 더 올려도 주소가 같고, 주소는 PR 댓글 하나에 적고 새 커밋마다 그 댓글을 고친다.

```yaml
deploy:
  needs: check
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  # …
  - run: pnpm exec wrangler deploy

preview:
  if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
```

`preview`에 붙은 조건은 포크에서 온 PR을 거른다. 포크의 PR에는 저장소의 Secrets가 넘어가지 않고, 넘어가서도 안 된다. 브랜치 이름은 주소에 쓸 수 있는 모양(영문 소문자·숫자·`-`, 40자까지)으로 바꿔 별칭으로 쓴다.

```bash
alias=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40 | sed -E 's/-+$//')
pnpm exec wrangler versions upload --preview-alias "$alias" | tee upload.log
```

`fix/mail-phone-spacing` 같은 브랜치는 `fix-mail-phone-spacing`이 된다. 출력에는 버전마다 바뀌는 주소와 별칭 주소가 둘 다 나오는데, 별칭 주소만 골라 댓글에 적는다. 댓글은 정해 둔 첫 줄(표식)로 찾아서, 있으면 고치고 없으면 새로 단다. 커밋을 열 번 올려도 PR에 댓글은 하나다.

![배포 구조 전후](./images/deploy-github-actions-flow.svg '전: Cloudflare가 시험과 따로 빌드 / 후: check를 통과한 뒤 GitHub Actions가 배포')

`VITE_API_URL`은 빌드할 때 코드에 들어가는 값이라 배포 빌드에만 넣는다. `check`의 E2E는 가짜 API 주소를 쓰므로 거기서는 비운다. 비밀 값이 아니어서 워크플로 맨 위에 적어 두었다. 예전에는 Cloudflare 대시보드의 빌드 변수에 넣어야 했고, 실행 변수 칸에 잘못 넣으면 빌드에 들어가지 않는 함정이 있었는데 그것도 사라졌다.

Cloudflare에는 API 토큰(Workers 편집 권한)과 계정 ID만 GitHub Secrets로 넘긴다. 토큰이 아직 없으면 미리보기는 건너뛰고, 배포는 실패로 알린다. 미리보기는 없어도 되지만, main 배포가 조용히 건너뛰어지면 사이트가 멈춘 줄 모르기 때문이다.

배포 문서에는 GitHub Actions 배포가 한 번 성공한 것을 본 뒤 Cloudflare의 Git 연결(Workers Builds)을 끊는 순서를 적었다. 둘 다 켜 두면 같은 커밋을 두 곳에서 올려 나중 것이 이긴다.

커밋은 파일 4개, +154/−11이다. `ci.yml`에 90줄, 배포 문서에 Secrets 넣는 순서를 30줄 남짓 더했다.

배포 대상은 여전히 Cloudflare라 Cloudflare 자체가 멈추면 영향을 받는다. 하지만 이번처럼 빌드 서버가 뜨지 않는 일과는 상관없어졌고, 무엇이 실패했는지 GitHub에서 바로 보인다.

## 그 뒤에 바뀐 것

지금 `ci.yml`의 `deploy`는 `needs: [check, e2e-reuse, e2e, api-image, api-deploy]`다. 화면 E2E를 따로 작업으로 나누고(여러 칸으로 나눠 동시에), API 서버도 같은 워크플로에서 이미지를 만들어 배포하게 되면서 기다리는 작업이 늘었다. 순서는 "API가 먼저 바뀌고, 프론트엔드가 나중"이다. 새 화면이 아직 없는 API를 부르는 일이 없게 하려는 것이다.

![지금 main에 push했을 때 작업이 기다리는 순서](./images/deploy-github-actions-needs.svg 'deploy는 시험과 API 배포가 모두 끝나야 돈다')

미리보기도 바뀌었다. 프론트엔드에 닿는 파일(`apps/react`, `packages`, 잠금 파일 등)이 바뀌지 않은 PR은 미리보기를 올리지 않는다. 서버만 고친 PR마다 같은 화면을 다시 올릴 이유가 없다. Dependabot이 연 PR도 미리보기를 건너뛴다.

## 남은 것과 배운 것

- 미리보기 버전은 Cloudflare에 쌓인다. PR을 닫아도 별칭이 남는다. 지금까지는 문제가 없었지만, 오래 쌓이면 정리하는 작업이 필요할 수 있다.
- 배포가 실패하면 GitHub 알림으로만 안다. 사이트가 실제로 바뀌었는지(배포된 JS의 해시)를 확인하는 단계는 없다.

배운 것: "시험"과 "배포"가 다른 곳에서 따로 빌드하면, 시험한 것과 배포된 것이 같다는 보장이 없다. 한 파이프라인에서 시험이 통과한 뒤에 배포하게 묶어야 그 보장이 생긴다. 이번 실패는 그 구조를 바꿀 계기였다.

관련 글: [API 서버를 무료로 띄우기](/memo/deploy-api-oracle-tunnel), [API 자동 배포](/memo/api-auto-deploy), [E2E와 CI를 빠르게](/memo/faster-e2e-ci).

#MacFolio #배포 #CI #Cloudflare

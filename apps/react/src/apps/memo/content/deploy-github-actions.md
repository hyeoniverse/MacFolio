---
title: 프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만
date: 2026-10-03
category: 개발기/MacFolio/인프라
summary: Cloudflare 빌드 서버가 빌드 환경을 초기화하지 못하고 시간 초과로 실패하는 일이 이어졌다. 빌드와 배포를 GitHub Actions로 옮겨, 시험을 통과한 main 커밋만 wrangler deploy로 배포하고 PR에는 브랜치 이름 기반 미리보기 주소를 댓글로 남긴다.
---

프론트엔드는 Cloudflare Workers에 정적 자산으로 배포한다. 이 변경 전까지는 저장소를 Cloudflare에 연결하고, Cloudflare의 빌드 서버(Workers Builds[^builds])가 main과 PR 브랜치에 push가 발생할 때마다 빌드해 배포했다. 이 글은 빌드·배포를 GitHub Actions로 옮긴 [#82](https://github.com/hyeoniverse/MacFolio/pull/82)의 기록이다.

## 배경: 호스팅 변경 이력

| 날짜      | 호스팅                                         | 빌드 주체      | 비고                                                                                                                            |
| --------- | ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| ~9월 28일 | Firebase Hosting                               | -              | [Vite 전환](/memo/cra-to-vite)과 함께 제거                                                                                      |
| 9월 28일  | Cloudflare Workers 정적 자산(`wrangler.jsonc`) | Workers Builds | [#13](https://github.com/hyeoniverse/MacFolio/pull/13). Pages를 준비하다 같은 날 Workers로 변경. GitHub Actions에는 시험만 배치 |
| 10월 3일  | Cloudflare Workers                             | GitHub Actions | [#82](https://github.com/hyeoniverse/MacFolio/pull/82). 이 글의 변경                                                            |

Workers Builds 구성은 닷새 동안 사용했다.

10월 3일 PR 미리보기 빌드가 모두 실패했다. GitHub의 상태 표시에는 시작과 종료 시각이 같은 초로 기록되어 원인을 알 수 없었고, Cloudflare 대시보드의 로그는 다음과 같았다.

```
Initializing build environment...
Initializing build environment...
Build failed to initialize and was timed out
```

저장소를 내려받기 전 단계에서 빌드 환경이 시작되지 않았다는 뜻이다. 10월 3일 오후, 빌드마다 "Initializing build environment..."를 두 번 출력하고 5분씩 대기한 뒤 종료되었다. 먼저 무료 한도 초과를 의심해 Cloudflare 대시보드의 사용량 화면을 확인했다.

![Cloudflare Workers 사용량 화면. 이번 달 빌드 시간 150/3,000분, 오늘 요청 0/100,000](./images/deploy-github-actions-workers-usage.jpg '빌드가 실패한 날 확인한 Workers 사용량. 빌드 시간은 3,000분 중 150분만 썼다')

빌드 시간은 한도 3,000분 중 150분만 사용했으므로 한도 초과가 원인이 아니었다. 미리보기 없이 PR을 머지하는 방안 대신, 빌드를 GitHub Actions로 옮기기로 했다.

## 기존 구조의 문제

빌드 실패와 별개로, 기존 구조에는 다음 문제가 있었다.

- **시험과 배포가 연결되지 않았다.** GitHub Actions의 `check`가 빌드·린트·E2E를 실행하는 동안, Cloudflare는 그 결과와 관계없이 같은 코드를 별도로 빌드해 배포했다. 시험이 실패한 커밋도 사이트에 배포될 수 있었다.
- **같은 커밋을 두 곳에서 빌드했다.** GitHub Actions와 Workers Builds가 각각 `vite build`를 실행했다.
- **실패 로그가 GitHub에 남지 않았다.** 로그를 확인하려면 Cloudflare 대시보드에 접속해야 했다.

## 검토한 방법

| 방법                                               | 장점                                                  | 단점                                                                              |
| -------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Workers Builds를 유지하고 재시도                   | 변경 작업이 없다                                      | 원인이 Cloudflare 쪽이라 재발 시점을 알 수 없다. 시험과 연결되지 않는다           |
| Workers Builds에서도 시험을 실행한다               | 한 곳에서 모두 처리한다                               | E2E(Playwright 브라우저)를 그 빌드 환경에서 실행해야 한다. 로그는 여전히 대시보드 |
| **GitHub Actions가 시험 후 `wrangler`로 배포한다** | 시험을 통과한 커밋만 배포된다. 로그가 GitHub에 남는다 | Cloudflare 토큰을 GitHub Secrets에 저장해야 한다                                  |

세 번째 방법을 선택했다. GitHub Actions에서 이미 빌드를 실행하고 있었으므로 배포 단계만 추가하면 되었다.

## 변경한 구조

`ci.yml`에 작업(job) 두 개를 추가했다.

| 작업      | 실행 조건                                  | 실행 명령                                           | 결과                                                                           |
| --------- | ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `deploy`  | main push, `check` 통과 후(`needs: check`) | `wrangler deploy`                                   | `wrangler.jsonc`의 빌드 명령으로 `apps/react/dist`를 만들고 실제 사이트에 배포 |
| `preview` | 같은 저장소 브랜치의 PR                    | `wrangler versions upload --preview-alias <브랜치>` | 미리보기 버전만 업로드. 실제 사이트는 변경되지 않는다                          |

미리보기 별칭은 브랜치 이름이므로 커밋을 추가해도 주소가 같다. 주소는 PR 댓글 하나에 기록하고, 새 커밋마다 그 댓글을 수정한다([Cloudflare 문서: Preview URLs](https://developers.cloudflare.com/workers/configuration/previews/)).

```yaml
deploy:
  needs: check
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  # …
  - run: pnpm exec wrangler deploy

preview:
  if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
```

`preview`의 조건은 포크에서 생성한 PR을 제외한다. 포크의 PR에는 저장소 Secrets가 전달되지 않으며, 전달되어서도 안 된다([GitHub 문서: Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)). 브랜치 이름은 주소에 사용할 수 있는 형식(영문 소문자·숫자·`-`, 최대 40자)으로 변환해 별칭으로 사용한다.

```bash
alias=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40 | sed -E 's/-+$//')
pnpm exec wrangler versions upload --preview-alias "$alias" | tee upload.log
```

예를 들어 `fix/mail-phone-spacing` 브랜치는 `fix-mail-phone-spacing`이 된다. 업로드 출력에는 버전별 주소와 별칭 주소가 함께 표시되며, 별칭 주소만 추출해 댓글에 기록한다. 댓글은 지정한 첫 줄(표식)로 검색해 있으면 수정하고 없으면 새로 작성한다. 커밋을 열 번 push해도 PR의 미리보기 댓글은 하나다.

![배포 구조 전후](./images/deploy-github-actions-flow.svg '전: Cloudflare가 시험과 따로 빌드 / 후: check를 통과한 뒤 GitHub Actions가 배포')

`VITE_API_URL`은 빌드 시각에 코드에 삽입되는 값이므로 배포 빌드에만 지정한다. `check`의 E2E는 가짜 API 주소를 사용하므로 빈 값으로 둔다. 비밀 값이 아니므로 워크플로 상단에 기록했다. 이전에는 Cloudflare 대시보드의 빌드 변수에 입력해야 했고, 실행 변수 칸에 잘못 입력하면 빌드에 반영되지 않았다([API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel) 참고). 워크플로로 옮기면서 이 문제도 없어졌다.

Cloudflare 관련 값은 API 토큰(Workers 편집 권한)과 계정 ID만 GitHub Secrets에 저장한다. 토큰이 없으면 미리보기는 건너뛰고, 배포는 실패로 처리한다. 미리보기는 생략해도 되지만, main 배포가 알림 없이 생략되면 사이트 갱신이 중단된 사실을 발견할 수 없기 때문이다.

배포 문서에는 GitHub Actions 배포가 한 번 성공한 것을 확인한 뒤 Cloudflare의 Git 연결(Workers Builds)을 해제하는 순서를 기록했다. 두 경로가 모두 활성 상태이면 같은 커밋을 두 곳에서 배포하고, 나중에 끝난 배포가 적용된다.

변경은 파일 4개, +154/−11줄이다. `ci.yml`에 90줄, 배포 문서에 Secrets 등록 순서 약 30줄을 추가했다.

배포 대상은 여전히 Cloudflare이므로 Cloudflare 장애의 영향은 받는다. 다만 이번처럼 Cloudflare 빌드 서버가 시작되지 않는 문제와는 무관해졌고, 실패한 단계를 GitHub Actions 로그에서 바로 확인할 수 있다.

## 이후 변경 사항

현재 `ci.yml`의 `deploy`는 `needs: [check, e2e-reuse, e2e, api-image, api-deploy]`다. 화면 E2E를 별도 작업으로 분리해 여러 샤드로 병렬 실행하고([머지하고 배포까지 15분에서 5분으로](/memo/faster-e2e-ci)), API 서버도 같은 워크플로에서 이미지를 빌드해 배포하면서([API 자동 배포](/memo/api-auto-deploy)) 선행 작업이 늘었다. 순서는 API 배포가 먼저, 프론트엔드 배포가 나중이다. 새 화면이 아직 배포되지 않은 API를 호출하는 상황을 막기 위해서다.

![지금 main에 push했을 때 작업이 기다리는 순서](./images/deploy-github-actions-needs.svg 'deploy는 시험과 API 배포가 모두 끝나야 실행된다')

미리보기 조건도 바뀌었다. 프론트엔드 빌드에 영향을 주는 파일(`apps/react`, `packages`, 잠금 파일 등)이 변경되지 않은 PR은 미리보기를 업로드하지 않는다. 서버만 수정한 PR에서는 화면이 같기 때문이다. Dependabot이 생성한 PR도 미리보기를 건너뛴다.

## 남은 과제와 정리

- 미리보기 버전은 Cloudflare에 누적된다. PR을 닫아도 별칭이 남는다. 현재까지 문제는 없지만, 누적량이 늘면 정리 작업이 필요할 수 있다.
- 배포 실패는 GitHub 알림으로만 확인한다. 사이트가 실제로 갱신되었는지(배포된 JS 파일의 해시)를 검사하는 단계는 없다.

시험과 배포가 각각 다른 곳에서 빌드하면, 시험한 결과물과 배포된 결과물이 같다는 보장이 없다. 한 파이프라인에서 시험 통과 후에 배포하도록 연결해야 그 보장이 생긴다.

## 적용 방법

준비물: Cloudflare API 토큰(Edit Cloudflare Workers 템플릿)과 계정 ID. 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '1. 프론트엔드'에 있다.

1. Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers**. 기존 토큰을 재사용하지 않고 배포 전용 토큰을 새로 생성했다. 토큰 값은 생성 직후 한 번만 표시된다
2. GitHub 저장소 → Settings → Secrets and variables → Actions에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 등록한다
3. main에 머지해 `deploy` 작업이 한 번 성공하는지 확인한다
4. Cloudflare → Workers & Pages → `macfolio` → Settings → Build → Git repository → **Disconnect**. 두 경로에서 중복 배포하지 않도록 해제한다

로컬에서 같은 작업을 수동으로 실행하는 명령은 다음과 같다.

```bash
pnpm install
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm exec wrangler deploy                      # 실제 사이트
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm exec wrangler versions upload --preview-alias my-branch   # 미리보기만
```

확인: Actions 실행의 `deploy` 로그 끝에 배포된 주소와 버전 ID가 출력된다. PR에는 `미리보기` 댓글이 하나 생성된다. 되돌리는 방법: Cloudflare 대시보드의 Deployments에서 이전 버전을 선택하거나 `pnpm exec wrangler rollback`을 실행한다. 워크플로는 [.github/workflows/ci.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/ci.yml), 명령 설명은 [wrangler 명령 문서](https://developers.cloudflare.com/workers/wrangler/commands/)와 [GitHub Actions 문서](https://docs.github.com/en/actions)에 있다.

## 관련 글

- [CRA에서 Vite로 옮기기](/memo/cra-to-vite)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- [머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기](/memo/faster-e2e-ci)
- [PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only)
- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot)

#MacFolio #배포 #CI #Cloudflare

[^builds]: 저장소를 연결하면 push마다 Cloudflare가 직접 빌드·배포하는 기능. [Cloudflare 문서: Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)

---
title: 프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만
date: 2026-10-03
category: 개발기/MacFolio/인프라
summary: Cloudflare 빌드 서버가 빌드 환경을 띄우지 못하고 시간 초과로 실패하는 일이 이어졌다. 빌드와 배포를 GitHub Actions로 옮겨, 시험(check)을 통과한 main 커밋만 wrangler deploy로 올리고 PR에는 브랜치 이름으로 된 미리보기 주소를 단다.
---

프론트엔드는 Cloudflare Workers에 정적 파일로 올린다. 지금까지는 저장소를 Cloudflare에 연결해 두고, Cloudflare의 빌드 서버(Workers Builds)가 main과 PR 브랜치를 받을 때마다 빌드해서 배포했다.

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

## 옮긴 구조

`ci.yml`에 작업 두 개를 더했다.

- **deploy**: main에 push되면 `check`가 통과한 뒤에만 돈다(`needs: check`). `wrangler deploy`가 `wrangler.jsonc`의 빌드 명령으로 `apps/react/dist`를 만들고 올린다.
- **preview**: PR마다 `wrangler versions upload --preview-alias <브랜치>`로 미리보기 버전을 올린다. 실제 사이트는 바뀌지 않는다. 별칭이 브랜치 이름이라 커밋을 더 올려도 주소가 같고, 주소는 PR 댓글 하나에 적고 새 커밋마다 그 댓글을 고친다.

`VITE_API_URL`은 빌드할 때 코드에 들어가는 값이라 배포 빌드에만 넣는다. `check`의 E2E는 가짜 API 주소를 쓰므로 거기서는 비운다. 비밀 값이 아니어서 워크플로 맨 위에 적어 두었다. 예전에는 Cloudflare 대시보드의 빌드 변수에 넣어야 했고, 실행 변수 칸에 잘못 넣으면 빌드에 들어가지 않는 함정이 있었는데 그것도 사라졌다.

Cloudflare에는 API 토큰(Workers 편집 권한)과 계정 ID만 GitHub Secrets로 넘긴다. 토큰이 아직 없으면 미리보기는 건너뛰고, 배포는 실패로 알린다.

배포 대상은 여전히 Cloudflare라 Cloudflare 자체가 멈추면 영향을 받는다. 하지만 이번처럼 빌드 서버가 뜨지 않는 일과는 상관없어졌고, 무엇이 실패했는지 GitHub에서 바로 보인다.

#MacFolio #배포 #CI #Cloudflare

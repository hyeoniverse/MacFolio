---
title: API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만
date: 2026-10-05
category: 개발기/MacFolio/인프라
summary: main에 머지하면 Actions가 API 이미지를 GHCR에 올리고, 명령 하나만 되는 SSH 키로 서버의 deploy.sh를 부른다. 서버는 백업 → 교체 → 건강 확인, 안 되면 되돌리기. 버린 방법, 151줄 스크립트의 갈림길, 로컬 레지스트리 시험 7가지를 적었다.
---

API를 올리려면 서버에 SSH로 들어가 `git pull`하고 `docker compose up -d --build`를 쳐야 했다. 서버는 RAM 1GB(E2.1.Micro)라 빌드에 10분이 넘게 걸리고, 빌드하는 동안 서버가 느려진다. 그리고 "새 API를 쓰는 화면은 **API를 먼저 올리고** 머지한다"는 규칙을 사람이 지켜야 했다.

이제 main에 머지하면 알아서 된다. 워크플로(`.github/workflows/ci.yml`의 이미지 단계와 `deploy-api.yml` 91줄)와 서버 스크립트(`ops/deploy.sh` 151줄)는 PR [#104](https://github.com/hyeoniverse/MacFolio/pull/104)에서, 첫 배포 버그는 [#107](https://github.com/hyeoniverse/MacFolio/pull/107)에서 들어갔다.

![자동 배포 흐름](./images/api-auto-deploy-pipeline.svg 'check 뒤에 API가 바뀐 커밋만 이미지를 만들고, 서버의 deploy.sh가 백업·교체·확인·되돌리기를 한다. 프론트엔드는 그 뒤에')

## 서버에서 빌드하지 않는다

이미지는 GitHub Actions가 `docker/build-push-action`으로 만들어 GHCR(`ghcr.io/hyeoniverse/macfolio-api`)에 올린다. 서버가 amd64라 amd64만 만들고, 캐시는 Actions 캐시를 쓴다. 권한은 `GITHUB_TOKEN`의 `packages: write` 하나다.

빌드할 때 커밋을 넣는다(`APP_VERSION=sha-1a2b3c4`). `/health`가 이 값을 `version`으로 돌려줘서, 지금 떠 있는 서버가 어느 커밋인지 바깥에서 알 수 있다. 배포의 마지막 확인도 이것으로 한다.

```json
{ "status": "ok", "database": "up", "version": "sha-1a2b3c4" }
```

## 서버에 들어가는 길: 명령 하나만 되는 키

Actions가 서버에 SSH로 들어가야 한다. 러너의 IP는 정해져 있지 않아서 22번 포트를 열어 둔다(키 인증만). 대신 배포 전용 키를 따로 만들고, 서버의 `authorized_keys`에서 그 키로는 **배포 스크립트 하나만** 돌게 묶었다.

```
restrict,command="/home/ubuntu/macfolio/ops/deploy.sh" ssh-ed25519 AAAA… github-actions-deploy
```

이 키로 무엇을 보내든 `ops/deploy.sh`만 돈다. 보낸 글자는 `SSH_ORIGINAL_COMMAND`로 넘어오고, 스크립트는 `sha-[0-9a-f]{7,40}` 모양만 받는다. 시험해 보니 `'sha-abc; rm -rf /'`는 "태그 모양이 아니다"로 바로 끝났다. 키가 새어도 할 수 있는 일은 "이미 있는 이미지 태그를 골라 배포"뿐이다. 서버의 호스트 키도 Secrets에 고정해서 가짜 서버에 붙지 않는다.

서버가 새 이미지를 스스로 확인하는 방식(cron, Watchtower)도 따져 봤다. 서버로 들어오는 길이 필요 없지만, 배포가 끝났는지 Actions가 몰라서 프론트엔드 배포를 그 뒤에 둘 수 없었다.

| 방법                                       | 좋은 점                                          | 버린 이유 / 고른 이유                                     |
| ------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| 서버에서 `git pull` + `--build` (전)       | 준비할 것이 없다                                 | 1GB 서버에서 10분 넘는 빌드, 그동안 API가 느리다          |
| 서버가 레지스트리를 지켜보기 (Watchtower)  | 서버로 들어오는 길이 필요 없다                   | 끝났는지 Actions가 모른다. 프론트엔드를 뒤에 둘 수 없다   |
| Actions가 빌드, SSH로 스크립트 (고른 방법) | 끝난 결과를 Actions가 안다. 서버는 바꿔 끼우기만 | 22번 포트를 열어 둬야 한다 → 명령 하나만 되는 키로 좁힌다 |

## 배포 스크립트

`ops/deploy.sh <태그>`가 서버 쪽을 다 한다.

1. 태그 모양 검사, 잠금(두 배포가 겹치지 않게)
2. **배포 직전 백업**: 새 버전에 마이그레이션이 있으면 DB가 바뀐다. 바꾸기 전에 서버에 남긴다 (매일 백업 스크립트를 "서버에만, 알리지 않고"로 부른다)
3. `~/deploy/.env`의 `API_TAG`를 바꾼다. `compose.yml`은 `image: …:${API_TAG}`라서, 손으로 `docker compose`를 쳐도 배포한 버전이 뜬다
4. 서버에 그 이미지가 없으면 받고, 컨테이너를 바꾼다
5. 컨테이너가 healthy가 되고 `/health`의 `version`이 그 태그일 때까지 기다린다(최대 120초)
6. 성공하면 지금 버전과 이전 버전 이미지만 남기고 지운다. 1GB 서버라 디스크도 아낀다
7. 건강하지 않으면 이전 태그로 되돌린다. 이전 이미지는 남겨 두었으니 다시 받지 않는다

![deploy.sh의 갈림길](./images/api-auto-deploy-script.svg '끝나는 길마다 종료 코드가 정해져 있어서 Actions가 성공·실패를 안다')

"건강하다"의 기준은 둘이다. 컨테이너의 Docker 건강 상태가 `healthy`이고, 컨테이너 안에서 부른 `/health`의 `version`이 배포하려는 태그와 같아야 한다. 건강 상태만 보면 아직 이전 컨테이너가 응답하는 순간을 성공으로 잘못 볼 수 있다.

```bash
is_live() {
	local id status
	id="$(container)"
	[[ -n "$id" ]] || return 1
	status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
	[[ "$status" == healthy ]] &&
		docker compose exec -T "$API_SERVICE" wget -qO- "http://127.0.0.1:4000/health" 2>/dev/null | grep -q "\"version\":\"$1\""
}
```

이 함수를 3초마다 부르고, 기본 120초를 넘기면 실패로 본다. 시작할 때 마이그레이션이 먼저 돌아서 넉넉히 잡았다.

## 로컬에서 실패시켜 보기

서버에 걸기 전에 로컬에 레지스트리(`registry:2`)를 띄우고, 정상 이미지 둘과 일부러 죽는 이미지 하나(`CMD exit 1`)를 올려 같은 스크립트를 돌렸다.

| 해 본 것                 | 결과                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| 첫 배포 (이전 태그 없음) | 배포 완료                                                                    |
| 같은 태그 다시           | "이미 이 버전이 떠 있다", 아무것도 안 함                                     |
| 새 버전                  | 배포 완료, `/health`의 version이 새 태그                                     |
| 죽는 이미지              | 45초 기다린 뒤 "이전 버전으로 되돌린다" → 이전 버전이 다시 healthy, 1로 끝남 |
| 레지스트리에 없는 태그   | "받지 못해 아무것도 바꾸지 않았다", `.env`도 그대로                          |
| 서버에서 빌드한 이미지   | 받지 않고 그대로 배포                                                        |
| `'sha-abc; rm -rf /'`    | "태그 모양이 아니다", 2로 끝남                                               |

`.env`의 다른 줄(비밀 값)과 권한(`600`)이 그대로인지, 이미지가 둘만 남는지도 봤다.

시험하며 고친 것이 셋 있었다.

- **성공했는데 1로 끝났다.** 지울 옛 이미지가 없으면 `grep`이 1을 돌려주고, `set -o pipefail` 때문에 스크립트 전체가 실패했다. 정리 단계의 실패는 배포 결과와 상관없게 했다
- **변수 이름에 한글이 붙었다.** `"$previous가 다시 떠 있다"`에서 bash가 `previous가`까지를 변수 이름으로 읽어 "unbound variable"로 죽었다. 한국어 앞의 변수는 모두 `${previous}`로 감쌌다
- **받지 못했는데 되돌리려 했다.** 새 이미지를 받지 못하면 아무것도 바뀌지 않았는데도 "되돌리기"를 하다가, 이전 이미지까지 다시 받으려다 "되돌리기도 실패"를 냈다. 받지 못하면 `.env`만 되돌리고 끝나게, 서버에 있는 이미지는 받지 않게 바꿨다

## 서버에서 처음 돌리자 백업에서 멈췄다

로컬 시험을 다 통과했는데, 실제 서버에서 첫 배포를 하자 바로 멈췄다.

```text
배포 시작: 없음 → sha-a38ac7e
error while interpolating services.api.image: required variable API_TAG is missing a value: …
백업 실패: pg_dump
배포 실패: 배포 직전 백업이 되지 않아 멈췄다
```

서버의 `compose.yml`은 태그가 없으면 멈추도록 `${API_TAG:?…}`로 썼다. 첫 배포에는 `.env`에 `API_TAG`가 아직 없다. 그런데 배포 직전 백업도 `docker compose exec db pg_dump`로 DB에 붙는다. compose는 서비스 하나만 써도 파일 전체를 읽으므로, api의 태그가 없다는 이유로 db 백업까지 거부됐다. 로컬 시험의 compose 파일은 `${API_TAG}`만 써서 이 경우를 만들지 못했다.

스크립트가 부르는 compose가 늘 태그를 알게 했다. 바꾸기 전에는 지금 태그(첫 배포면 새 태그)를, 바꾼 뒤에는 새 태그를 환경 변수로 넘긴다(환경 변수가 `.env`보다 먼저다). 첫 배포에서 이미지를 받지 못하면 `.env`에 `API_TAG` 줄을 남기지 않는다. 이번에는 서버와 같은 `${API_TAG:?…}`를 쓴 compose 파일로 첫 배포, 첫 배포인데 받지 못하는 태그, 다음 배포, 되돌리기를 다시 시험했다.

## 끊기지 않게, 겹치지 않게

CI는 같은 브랜치에 새 커밋이 오면 이전 실행을 취소한다. 배포 도중에 취소되면 SSH가 끊기고, 서버의 스크립트가 중간에 멈춰 `.env`와 컨테이너가 어긋날 수 있다. 스크립트가 끊김 신호(`HUP`)를 무시해서 끝까지 하게 했고, 다음 배포는 잠금에서 기다린다. 배포 워크플로 자체도 `cancel-in-progress: false`로 차례로 돈다.

## 되돌리기는 이미지만

되돌리기는 **이미지만** 되돌린다. 마이그레이션은 앞으로만 간다. 그래서 마이그레이션은 이전 버전 코드와도 같이 돌 수 있게 나눠서 만든다는 규칙을 CONTRIBUTING에 적었다 (열은 비워 둘 수 있게 더하고, 지우기는 다음 배포에서). 정말 DB까지 되돌려야 하면 배포 직전 백업을 `ops/restore.sh`로 되살린다.

서버와 GitHub Secrets 설정 순서는 `docs/deployment.md`의 '자동 배포 설정'에 적었다. 그 설정을 실제로 하며 막힌 다섯 곳은 [자동 배포를 실제 서버에 걸기](/memo/api-auto-deploy-setup)에 따로 적었다.

## 남은 것, 배운 것

- 배포 사이 API가 멈추는 시간이 있다. 컨테이너를 하나만 띄우므로 바꿔 끼우는 동안(마이그레이션 포함) 요청이 실패한다. 1GB 서버에 두 벌을 띄울 여유가 없어서 받아들였다. 사이트는 API가 없어도 열리게 만들어 두었다.
- 되돌리기를 시험만 하고 실제로는 한 번도 안 겪었다. 그래서 며칠 뒤 일부러 죽는 이미지를 서버에 올려 되돌리기를 훈련했다([되돌리기 훈련](/memo/rollback-drill)).
- 스크립트의 버그 셋(`pipefail`과 `grep`, 한글 앞 변수 이름, 받지 못했는데 되돌리기)은 모두 "실패하는 길"에서 나왔다. 성공하는 길만 돌려 봤다면 셋 다 실제 배포에서 처음 만났을 것이다. 실패를 일부러 만드는 시험이 가장 값졌다.
- 그래도 서버의 `compose.yml`(`${API_TAG:?…}`)과 로컬 시험의 것(`${API_TAG}`)이 한 글자 달라서 첫 배포 버그를 놓쳤다. 시험 환경의 설정 파일은 실제 것을 그대로 복사해 쓴다.

## 손으로 하던 배포

자동 배포 전에는 서버에 들어가 손으로 올렸다. 10월 3일 아침, 적어 둔 업데이트 순서(`pg_dump … > backup.sql`, `git pull`, `docker compose up -d --build api`)를 서버에 그대로 붙여 넣었더니 세 줄이 모두 실패했다. 서버에는 `pg_dump`가 없었고(DB는 컨테이너 안에 있다), 홈 폴더는 git 저장소가 아니었고(코드는 `~/macfolio`), compose 파일은 `~/deploy`에 있었다. 폴더를 옮겨 다시 하니 `docker compose logs -f api`에 "11 migrations found"가 찍히며 올라갔지만, 1GB 서버에서 빌드까지 하느라 오래 걸렸다. 사람이 순서와 위치를 기억해야 하는 배포는 언젠가 틀린다고 보고, 이 글의 구조로 옮겼다.

## 따라 하기

처음 한 번 하는 설정은 [자동 배포를 실제 서버에 걸기](/memo/api-auto-deploy-setup)와 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정'에 있다. 그 뒤에는 이렇게 쓴다.

```bash
# 평소: API를 바꾼 PR을 main에 머지하면 끝. 진행은 Actions의 ci 실행에서 본다
# 지금 서버 버전
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# 서버에서 직접 특정 태그로 (되돌리기도 같은 명령)
~/macfolio/ops/deploy.sh sha-7e7eac0
tail -20 ~/deploy/deploy.log     # 배포 기록
```

- 손으로: GitHub → Actions → **API 배포** → Run workflow → 태그. 예전 태그를 넣으면 되돌리기다
- 실패하면: 새 이미지가 120초 안에 healthy가 아니면 스크립트가 이전 태그로 돌리고 실패로 끝난다. 실제 서버에서 일부러 실패시켜 본 기록은 [되돌리기 훈련](/memo/rollback-drill)에 있다
- 기다리는 시간: 머지한 뒤 사이트에 반영되기까지 E2E가 대부분을 차지했다. 10월 19일 "머지는 했는데 배포가 안 된다"고 느낀 것이 [E2E와 CI를 빠르게](/memo/faster-e2e-ci)로 이어졌다

스크립트: [ops/deploy.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/deploy.sh), 워크플로: [.github/workflows/deploy-api.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/deploy-api.yml). 이미지 저장소는 [GHCR 문서](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), compose는 [Docker Compose 문서](https://docs.docker.com/compose/)를 봤다.

관련 글: [자동 배포를 실제 서버에 걸기](/memo/api-auto-deploy-setup), [되돌리기 훈련](/memo/rollback-drill), [DB 백업](/memo/db-backup), [Oracle 서버와 터널](/memo/deploy-api-oracle-tunnel)

#MacFolio #배포 #CI #서버

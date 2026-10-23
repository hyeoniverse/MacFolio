---
title: API 자동 배포 - 이미지는 Actions에서 빌드, 서버는 컨테이너 교체만
date: 2026-10-05
category: 개발기/MacFolio/인프라
summary: main에 머지하면 Actions가 API 이미지를 GHCR에 푸시하고, 명령 하나만 실행할 수 있는 SSH 키로 서버의 deploy.sh를 호출한다. 서버는 백업 → 교체 → 헬스 체크를 거치고, 실패하면 이전 버전으로 되돌린다. 제외한 방법, 151줄 스크립트의 분기, 로컬 레지스트리 시험 7가지를 적었다.
---

API를 배포하려면 서버에 SSH로 접속해 `git pull`과 `docker compose up -d --build`를 직접 실행해야 했다. 서버는 RAM 1GB(Oracle E2.1.Micro)라 빌드에 10분 넘게 걸리고, 빌드하는 동안 API 응답도 느려진다. 또 "새 API를 쓰는 화면은 **API를 먼저 배포하고** 머지한다"는 순서를 사람이 기억해야 했다.

지금은 main에 머지하면 이미지 빌드부터 서버 교체까지 자동으로 진행된다. 워크플로(`.github/workflows/ci.yml`의 이미지 단계와 `deploy-api.yml` 91줄)와 서버 스크립트(`ops/deploy.sh` 151줄)는 PR [#104](https://github.com/hyeoniverse/MacFolio/pull/104)에서, 첫 배포 버그는 [#107](https://github.com/hyeoniverse/MacFolio/pull/107)에서 들어갔다.

![자동 배포 흐름](./images/api-auto-deploy-pipeline.svg 'check 뒤에 API가 바뀐 커밋만 이미지를 만들고, 서버의 deploy.sh가 백업·교체·확인·되돌리기를 한다. 프론트엔드는 그 뒤에')

## 서버에서 빌드하지 않는다

이미지는 GitHub Actions가 [`docker/build-push-action`](https://github.com/docker/build-push-action)으로 빌드해 GHCR[^ghcr](`ghcr.io/hyeoniverse/macfolio-api`)에 푸시한다. 서버가 amd64라 amd64 이미지만 빌드하고, 레이어 캐시는 Actions 캐시에 저장한다. 필요한 권한은 `GITHUB_TOKEN`의 `packages: write` 하나다.

빌드 인자로 커밋 SHA를 넣는다(`APP_VERSION=sha-1a2b3c4`). `/health`가 이 값을 `version`으로 응답하므로, 지금 실행 중인 서버가 어느 커밋인지 외부에서 확인할 수 있다. 배포의 마지막 확인도 이 값으로 한다.

```json
{ "status": "ok", "database": "up", "version": "sha-1a2b3c4" }
```

## 서버 접속 경로: 명령 하나만 실행하는 키

Actions가 서버에 SSH로 접속해야 한다. GitHub 호스팅 러너의 IP는 고정되어 있지 않아서 22번 포트를 열어 둔다(키 인증만 허용). 대신 배포 전용 키를 따로 만들고, 서버의 `authorized_keys`에서 그 키로는 **배포 스크립트 하나만** 실행되게 제한했다([OpenSSH `authorized_keys` 형식](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT)).

```
restrict,command="/home/ubuntu/macfolio/ops/deploy.sh" ssh-ed25519 AAAA… github-actions-deploy
```

- `restrict`: 포트 포워딩, 에이전트 포워딩, 터미널 할당을 모두 차단한다.
- `command=`: 이 키로 접속하면 클라이언트가 보낸 명령 대신 `ops/deploy.sh`가 실행된다. 클라이언트가 보낸 문자열은 환경 변수 `SSH_ORIGINAL_COMMAND`로 전달된다.

스크립트는 이 문자열이 `sha-[0-9a-f]{7,40}` 형식일 때만 진행한다. `'sha-abc; rm -rf /'`를 보내면 "태그 모양이 아니다"를 출력하고 종료 코드 2로 끝난다. 키가 유출되어도 가능한 일은 "레지스트리에 이미 있는 이미지 태그로 배포"뿐이다. 서버의 호스트 키도 Secrets(`DEPLOY_KNOWN_HOSTS`)에 고정해서, 다른 서버가 같은 주소로 응답해도 접속하지 않는다.

서버가 새 이미지를 주기적으로 확인하는 방식(cron, [Watchtower](https://containrrr.dev/watchtower/))도 검토했다. 서버로 들어오는 경로가 필요 없지만, 배포가 끝났는지 Actions가 알 수 없어서 프론트엔드 배포를 API 배포 뒤에 배치할 수 없었다.

| 방법                                       | 좋은 점                                       | 버린 이유 / 고른 이유                                      |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| 서버에서 `git pull` + `--build` (전)       | 추가 설정이 없다                              | 1GB 서버에서 10분 넘는 빌드, 그동안 API가 느리다           |
| 서버가 레지스트리를 폴링 (Watchtower)      | 서버로 들어오는 경로가 필요 없다              | 완료 여부를 Actions가 모른다. 프론트엔드를 뒤에 둘 수 없다 |
| Actions가 빌드, SSH로 스크립트 (고른 방법) | 결과를 Actions가 안다. 서버는 컨테이너 교체만 | 22번 포트를 열어야 한다 → 명령 하나만 실행하는 키로 제한   |

## 배포 스크립트

서버 쪽 작업은 `ops/deploy.sh sha-1a2b3c4`(인자는 이미지 태그) 하나가 모두 처리한다.

1. 태그 형식 검사, 잠금(`flock`[^flock]으로 두 배포가 동시에 실행되지 않게, 최대 600초 대기)
2. **배포 직전 백업**: 새 버전에 마이그레이션이 있으면 DB 구조가 바뀐다. 바뀌기 전 상태를 서버에 보관한다(매일 실행하는 백업 스크립트를 "서버에만 저장, 알림 없음" 옵션으로 호출)
3. `~/deploy/.env`의 `API_TAG`를 바꾼다. `compose.yml`은 `image: …:${API_TAG}`라서, 서버에서 `docker compose`를 직접 실행해도 배포한 버전이 실행된다
4. 서버에 그 이미지가 없으면 내려받고, 컨테이너를 교체한다
5. 컨테이너가 healthy가 되고 `/health`의 `version`이 그 태그가 될 때까지 기다린다(최대 120초)
6. 성공하면 현재 버전과 이전 버전 이미지만 남기고 나머지를 삭제한다. 1GB 서버라 디스크 사용량도 줄인다
7. 헬스 체크에 실패하면 이전 태그로 되돌린다. 이전 이미지는 서버에 남아 있으므로 다시 내려받지 않는다

![deploy.sh의 분기](./images/api-auto-deploy-script.svg '종료 경로마다 종료 코드가 정해져 있어서 Actions가 성공·실패를 구분한다')

배포 성공의 조건은 두 가지다. 컨테이너의 Docker 헬스 상태([`HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck))가 `healthy`이고, 컨테이너 안에서 호출한 `/health`의 `version`이 배포하려는 태그와 같아야 한다. 헬스 상태만 확인하면 이전 컨테이너가 아직 응답하는 시각을 성공으로 잘못 판정할 수 있다.

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

이 함수를 3초 간격으로 호출하고, 120초(`HEALTH_TIMEOUT` 기본값)를 넘기면 실패로 판정한다. 컨테이너가 시작할 때 마이그레이션을 먼저 실행하므로 여유 있게 잡았다.

## 로컬에서 실패 경로 시험하기

서버에 적용하기 전에 로컬에서 레지스트리 컨테이너([`registry:2`](https://distribution.github.io/distribution/))를 실행하고, 정상 이미지 두 개와 시작 직후 종료되는 이미지 하나(`CMD exit 1`)를 푸시한 뒤 같은 스크립트를 실행했다.

| 시험한 경우               | 결과                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| 첫 배포 (이전 태그 없음)  | 배포 완료, 종료 코드 0                                                        |
| 같은 태그로 다시 배포     | "이미 이 버전이 떠 있다" 출력, 변경 없음                                      |
| 새 버전                   | 배포 완료, `/health`의 version이 새 태그                                      |
| 시작 직후 종료되는 이미지 | 45초 대기 후 "이전 버전으로 되돌린다" → 이전 버전이 다시 healthy, 종료 코드 1 |
| 레지스트리에 없는 태그    | "받지 못해 아무것도 바꾸지 않았다", `.env`도 변경 없음                        |
| 서버에서 빌드한 이미지    | 내려받지 않고 그대로 배포                                                     |
| `'sha-abc; rm -rf /'`     | "태그 모양이 아니다", 종료 코드 2                                             |

`.env`의 다른 줄(비밀 값)과 파일 권한(`600`)이 유지되는지, 정리 뒤 이미지가 두 개만 남는지도 확인했다.

시험 중에 발견해 수정한 버그는 세 가지다.

| 증상                                     | 원인                                                                                                               | 수정                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 배포는 성공했는데 종료 코드 1            | 삭제할 옛 이미지가 없으면 `grep`이 1을 반환하고, `set -o pipefail`[^pipefail] 때문에 스크립트 전체가 실패로 끝났다 | 이미지 정리 단계의 실패는 배포 결과에 반영하지 않는다                                 |
| `unbound variable`로 중단                | `"$previous가 다시 떠 있다"`에서 bash가 한글 바이트까지 변수 이름(`previous가`)으로 읽었다                         | 한국어 바로 앞의 변수는 모두 `${previous}`로 감싼다                                   |
| 이미지를 받지 못했는데 "되돌리기도 실패" | 새 이미지 pull이 실패해 아무것도 바뀌지 않았는데 되돌리기를 실행했고, 이전 이미지까지 다시 내려받으려다 실패했다   | pull 실패 시 `.env`만 원래 값으로 복원하고 종료. 서버에 있는 이미지는 내려받지 않는다 |

## 서버에서 처음 실행하자 백업에서 멈췄다

로컬 시험을 모두 통과했지만, 실제 서버에서 첫 배포를 실행하자 백업 단계에서 중단됐다.

```text
배포 시작: 없음 → sha-a38ac7e
error while interpolating services.api.image: required variable API_TAG is missing a value: …
백업 실패: pg_dump
배포 실패: 배포 직전 백업이 되지 않아 멈췄다
```

서버의 `compose.yml`은 태그가 없으면 중단하도록 `${API_TAG:?…}`[^interp]로 작성했다. 첫 배포 시각에는 `.env`에 `API_TAG`가 아직 없다. 그런데 배포 직전 백업도 `docker compose exec db pg_dump`로 DB 컨테이너에 접속한다. compose는 서비스 하나만 다뤄도 파일 전체를 해석하므로, api 서비스의 태그가 없다는 이유로 db 백업까지 거부됐다. 로컬 시험의 compose 파일은 `${API_TAG}`로만 작성해서 이 경우를 재현하지 못했다.

수정([#107](https://github.com/hyeoniverse/MacFolio/pull/107))은 스크립트가 호출하는 compose가 항상 태그 값을 갖게 한 것이다. 교체 전에는 현재 태그(첫 배포면 새 태그)를, 교체 후에는 새 태그를 환경 변수로 전달한다(compose는 셸 환경 변수를 `.env`보다 우선한다). 첫 배포에서 이미지를 받지 못하면 `.env`에 `API_TAG` 줄을 남기지 않는다. 그 뒤 서버와 같은 `${API_TAG:?…}`를 쓴 compose 파일로 첫 배포, 첫 배포인데 받지 못하는 태그, 다음 배포, 되돌리기 네 경우를 다시 시험했다.

## 연결이 끊겨도 끝까지, 동시에 하나만

CI 워크플로(`ci.yml`)는 같은 브랜치에 새 커밋이 오면 이전 실행을 취소한다(`cancel-in-progress: true`). 배포 도중에 취소되면 SSH 연결이 끊기고, 서버의 스크립트가 중간에 멈춰 `.env`와 실행 중인 컨테이너가 서로 다른 버전을 가리킬 수 있다. 그래서 대응을 세 겹으로 두었다.

1. 스크립트 첫머리에서 `trap '' HUP`으로 연결 끊김 신호(SIGHUP)를 무시해 끝까지 실행한다.
2. 다음 배포는 `flock` 잠금에서 앞 배포가 끝나기를 기다린다.
3. 배포 워크플로(`deploy-api.yml`)는 [`concurrency`](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)의 `cancel-in-progress: false`로 실행을 취소하지 않고 순서대로 처리한다.

## 되돌리기는 이미지만

되돌리기는 **이미지만** 이전 버전으로 바꾼다. 이미 적용된 마이그레이션은 되돌리지 않는다. 그래서 마이그레이션은 이전 버전 코드에서도 동작하도록 나눠 작성한다는 규칙을 `CONTRIBUTING.md`의 '마이그레이션' 절에 적었다.

- 열·표 추가: 새 열은 nullable로 만들거나 기본값을 지정한다. 이전 코드는 모르는 열을 무시한다.
- 이름 변경·삭제: 한 번에 하지 않는다. ① 새 열을 추가하고 코드가 둘 다 쓰게 배포 → ② 다음 배포에서 옛 열을 삭제한다.

![되돌리기는 이미지만](./images/api-auto-deploy-rollback.svg '새 이미지가 실패하면 컨테이너만 이전 버전으로 돌아가고, DB에는 새 마이그레이션이 남는다. 그래서 마이그레이션은 이전 코드와 호환되게 작성한다')

DB까지 되돌려야 하는 경우에는 배포 직전 백업(`~/backups`)을 `ops/restore.sh`로 복원한다([DB 백업](/memo/db-backup)).

서버와 GitHub Secrets 설정 순서는 `docs/deployment.md`의 '자동 배포 설정'에 적었다. 그 설정을 실제 서버에 적용하며 막힌 곳은 [자동 배포를 실제 서버에 적용하기](/memo/api-auto-deploy-setup)에 따로 정리했다.

## 남은 것, 배운 것

- 배포 중 API가 응답하지 않는 구간이 있다. 컨테이너를 하나만 실행하므로 교체하는 동안(마이그레이션 포함) 요청이 실패한다. 1GB 서버에 컨테이너 두 개를 동시에 실행할 메모리가 없어서 이 중단 시간을 감수했다. 사이트는 API 없이도 열리게 만들어 두었다.
- 되돌리기는 로컬에서 시험만 했고 실제 서버에서는 실행된 적이 없었다. 그래서 며칠 뒤 헬스 체크에 실패하는 이미지를 서버에 일부러 배포해 되돌리기를 훈련했다([되돌리기 훈련](/memo/rollback-drill)).
- 스크립트 버그 세 가지(`pipefail`과 `grep`, 한글 앞 변수 이름, 받지 못한 이미지의 되돌리기)는 모두 실패 경로에서 나왔다. 성공 경로만 시험했다면 세 가지 모두 실제 배포에서 처음 발생했을 것이다.
- 그래도 서버의 `compose.yml`(`${API_TAG:?…}`)과 로컬 시험용 파일(`${API_TAG}`)의 표기 차이 때문에 첫 배포 버그를 놓쳤다. 이후로 시험 환경의 설정 파일은 실제 파일을 그대로 복사해 쓴다.

## 손으로 하던 배포

자동 배포 전에는 서버에 접속해 직접 배포했다. 10월 3일 오전, 문서에 적어 둔 업데이트 순서를 서버에 그대로 붙여 넣었더니 세 명령이 모두 실패했다.

| 명령                               | 실패 원인                                          |
| ---------------------------------- | -------------------------------------------------- |
| `pg_dump … > backup.sql`           | 서버에 `pg_dump`가 없다. DB는 컨테이너 안에 있다   |
| `git pull`                         | 홈 폴더는 git 저장소가 아니다. 코드는 `~/macfolio` |
| `docker compose up -d --build api` | compose 파일은 `~/deploy`에 있다                   |

폴더를 옮겨 다시 실행하자 `docker compose logs -f api`에 "11 migrations found"가 출력되며 API가 시작됐지만, 1GB 서버에서 빌드까지 하느라 오래 걸렸다. 사람이 순서와 위치를 기억해야 하는 배포는 언젠가 틀린다고 보고, 이 글의 구조로 옮겼다.

## 따라 하기

처음 한 번 하는 설정은 [자동 배포를 실제 서버에 적용하기](/memo/api-auto-deploy-setup)와 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정'에 있다. 그 뒤에는 이렇게 쓴다.

```bash
# 평소: API를 바꾼 PR을 main에 머지하면 끝. 진행 상황은 Actions의 ci 실행에서 확인한다
# 지금 서버 버전
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# 서버에서 직접 특정 태그로 (되돌리기도 같은 명령)
~/macfolio/ops/deploy.sh sha-7e7eac0
tail -20 ~/deploy/deploy.log     # 배포 기록
```

- 수동 배포: GitHub → Actions → **API 배포** → Run workflow → 태그 입력. 예전 태그를 넣으면 되돌리기가 된다
- 실패 시: 새 이미지가 120초 안에 healthy가 되지 않으면 스크립트가 이전 태그로 되돌리고 실패로 종료한다. 실제 서버에서 일부러 실패시킨 기록은 [되돌리기 훈련](/memo/rollback-drill)에 있다
- 소요 시간: 머지부터 사이트 반영까지 시간의 대부분을 E2E가 차지했다. 10월 19일 머지 뒤 배포가 늦게 끝난 일이 [E2E와 CI를 빠르게](/memo/faster-e2e-ci)로 이어졌다

스크립트: [ops/deploy.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/deploy.sh), 워크플로: [.github/workflows/deploy-api.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/deploy-api.yml). 이미지 저장소는 [GHCR 문서](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), compose는 [Docker Compose 문서](https://docs.docker.com/compose/)를 참고했다.

## 관련 글

- [자동 배포를 실제 서버에 적용하기 - 막힌 곳 다섯](/memo/api-auto-deploy-setup)
- [되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다](/memo/rollback-drill)
- [글이 DB에만 있게 되어서 백업을 붙였다](/memo/db-backup)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)
- [머지하고 배포까지 15분에서 5분으로](/memo/faster-e2e-ci)

[^ghcr]: GitHub Container Registry. GitHub 패키지 중 컨테이너 이미지를 저장하는 레지스트리로, 주소는 `ghcr.io/<소유자>/<이미지>`다.

[^flock]: 파일 하나를 잠금 대상으로 삼아 프로세스 간 상호 배제를 하는 리눅스 명령. `flock -w 600 9`는 파일 디스크립터 9번이 가리키는 잠금 파일을 최대 600초 기다려 얻는다.

[^pipefail]: bash 옵션. 파이프라인(`a | b`) 중 하나라도 0이 아닌 종료 코드를 내면 파이프라인 전체를 실패로 본다. `set -e`와 함께 쓰면 그 시점에 스크립트가 종료된다.

[^interp]: [Compose 변수 보간](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) 문법. `${VAR:?메시지}`는 VAR가 비어 있거나 없으면 메시지를 출력하고 실패한다.

#MacFolio #배포 #CI #서버

---
title: 되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: 자동 배포의 되돌리기를 진짜 서버에서 확인했다. 코드에 스위치를 두지 않고 HEALTHCHECK false 층만 얹은 훈련용 이미지를 배포했다. 120초를 기다린 뒤 41초 만에 이전 버전으로 돌아왔고, Actions는 3분 만에 실패로 끝났다.
---

API 자동 배포(#100)는 새 버전이 건강하지 않으면 이전 버전으로 되돌리고 Actions를 실패로 끝낸다. 로컬 레지스트리로는 시험했지만, 진짜 서버에서 SSH 키와 터널까지 거쳐 되돌리는 것은 아직 보지 못했다. 그래서 훈련 절차를 만들었다 (`docs/rollback-drill.md`).

## 배포 스크립트가 하는 일

먼저 무엇을 훈련하는지 정리했다. GitHub Actions의 "API 배포"는 배포 전용 SSH 키로 서버에 태그 하나만 보낸다. 서버의 `authorized_keys`에는 그 키에 `command=`가 걸려 있어서, 무엇을 보내든 `ops/deploy.sh`만 돌고 보낸 글자는 `SSH_ORIGINAL_COMMAND`로 넘어온다.

```yaml
# .github/workflows/deploy-api.yml '서버에서 배포'
# 보내는 것은 태그 하나. 서버의 키 설정(command=)이 이것을 ops/deploy.sh에 넘긴다
ssh -i ~/.ssh/deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20 \
-o ServerAliveInterval=15 "$DEPLOY_USER@$DEPLOY_HOST" "$TAG"
```

스크립트는 태그 모양부터 본다. `sha-` 뒤에 16진 글자 7~40자가 아니면 아무것도 하지 않는다.

```bash
# ops/deploy.sh
tag="${1:-${SSH_ORIGINAL_COMMAND:-}}"
if [[ ! "$tag" =~ ^sha-[0-9a-f]{7,40}$ ]]; then
	log "배포 실패: 태그 모양이 아니다 ('sha-' + 커밋 7~40자리): '${tag}'"
	exit 2
fi
```

그다음 잠금, 배포 직전 백업, `.env`의 `API_TAG` 바꾸기, 이미지 받기, `docker compose up -d api`, healthy 기다리기 순서로 간다. 끝은 세 갈래다.

![ops/deploy.sh가 갈라지는 세 길](./images/rollback-drill-branches.svg '훈련은 healthy가 되지 않는 오른쪽 길을 진짜 서버에서 타 보는 일이다')

healthy는 두 가지를 함께 본다. 컨테이너의 `HEALTHCHECK` 상태가 `healthy`이고, 컨테이너 안에서 부른 `/health`의 `version`이 이번 태그여야 한다. 120초 동안 3초마다 묻고, 안 되면 마지막 로그 40줄을 찍은 뒤 이전 태그로 같은 `up`을 다시 부른다.

## 실패시키는 방법 고르기

| 방법                                                 | 좋은 점                 | 걸린 점                                                           |
| ---------------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| main에 `/health`가 503을 내는 커밋을 머지            | 진짜 배포 흐름 그대로   | 깨진 코드가 main 기록에 남고, 되돌리는 커밋이 또 필요하다         |
| 워크플로 입력 `drill_fail_health`로 스위치           | 버튼 하나로 켠다        | 배포 키로 보낼 수 있는 것을 넓히고, 운영에서 켜질 스위치가 남는다 |
| 서버에서 `HEALTHCHECK false` 층만 얹은 이미지 (고름) | 코드·키·권한이 그대로다 | 서버에 직접 들어가 이미지를 만들고, 끝나면 지워야 한다            |

## 환경 변수 스위치를 두지 않은 까닭

처음 떠올린 것은 Run workflow에 `drill_fail_health` 입력을 두고, 켜면 `/health`가 503을 돌려주게 하는 방법이다. 그런데 배포 전용 SSH 키는 `authorized_keys`의 `command=`로 묶여 **태그 하나만** 보낼 수 있다. 컨테이너에 환경 변수를 넘기려면 그 키로 보낼 수 있는 것을 늘려야 하고, 코드에는 운영에서 켜질 수도 있는 스위치가 남는다. 훈련 한 번을 위해 지켜 온 것을 넓히는 셈이다.

대신 서버에서 지금 이미지 위에 층 하나만 얹는다.

```bash
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF
```

태그 `sha-dead000`은 진짜 커밋이 아니지만 `d`·`e`·`a`·`0`이 모두 16진 글자라 위의 태그 검사를 그대로 통과한다. `ops/deploy.sh`는 서버에 그 태그의 이미지가 있으면 GHCR에서 받지 않는다. 그래서 Actions에서 태그 `sha-dead000`을 넣고 Run workflow 버튼을 누르기만 하면 진짜 길을 그대로 탄다. 새 비밀 값, 새 권한, 새 입력이 없고, 끝나면 이미지를 지워 흔적도 남지 않는다.

## 끊기는 시간

배포 스크립트는 블루·그린이 아니다. `docker compose up -d api`가 옛 컨테이너를 멈추고 새 것을 띄운다. 그래서 두 번 끊긴다.

- 훈련용 컨테이너로 바꿀 때: 마이그레이션 확인과 Nest 시작까지 수 초~수십 초
- 기다리는 120초: 끊기지 않는다. 훈련용 이미지도 앱은 정상이라 요청에 답한다
- 이전 버전으로 되돌릴 때: 다시 수 초~수십 초

합쳐 1분 안쪽이다. 방문이 적은 시간에 한다. 10분마다 도는 업타임 감시가 그사이에 돌면 실패 메일이 한 통 올 수 있고, 배포 직전 백업도 평소처럼 하나 생긴다.

훈련용 이미지가 실패하는 조건은 사실 둘이다. `HEALTHCHECK`가 `false`라 컨테이너는 `starting`에서 `unhealthy`가 되고, 앱은 지금 버전 그대로라 `/health`의 `version`도 `sha-dead000`이 아니다. 서버 `compose.yml`의 api에는 `healthcheck:`가 없어서 이미지의 `HEALTHCHECK`를 그대로 쓴다.

## 볼 것

- Actions: 빨간 X. '서버에서 배포' 단계가 `exit code 1`로 끝나고, '바깥에서 버전 확인'은 건너뛴다
- 배포 로그: `120초 안에 healthy가 되지 않았다` → `이전 버전으로 되돌린다` → `배포 실패, 되돌림: …가 다시 떠 있다`
- 서버: `.env`의 `API_TAG`, `docker compose ps api`의 이미지, 바깥 `/health`의 version이 모두 이전 태그이고 healthy

되돌리기마저 실패하면 이전 태그로 `ops/deploy.sh`를 손으로 부르고, 그것도 안 되면 `.env`의 `API_TAG`를 고쳐 `docker compose up -d api`를 한다. 이전 이미지는 서버에 남겨 두므로 다시 받지 않는다.

## 해 보니 (2026-10-18)

절차 문서를 만든 뒤 훈련을 일으키는 방법을 단계별로 더 자세히 적게 했고, 그 순서대로 서버에 들어가 직접 했다. 시각은 모두 UTC다.

**1. 지금 상태 적기.** 서버에 접속해 `.env`의 `API_TAG`, 컨테이너 상태, 바깥 `/health`를 봤다. 셋 다 `sha-7e7eac0`, `(healthy)`였다. `dead000`이 진짜 커밋이 아닌지도 `git rev-parse --verify`로 확인했다. 아무것도 나오지 않으면 진짜 커밋이 아니다.

![서버 접속 후 API_TAG와 /health를 확인한 터미널](./images/rollback-drill-server-before.jpg '1단계: 훈련 전 상태. 접속 명령(키 경로·서버 IP)과 접속해 온 IP는 가렸다.')

**2. 훈련용 이미지 만들기.** 지금 태그를 `cur`에 담고 그 위에 `HEALTHCHECK … CMD false` 층 하나만 얹었다. 3.9초 만에 끝났고, 서버에는 `sha-0f5d74f`, `sha-7e7eac0`(사용 중), `sha-dead000` 세 이미지가 남았다.

![sha-dead000 이미지를 만든 터미널](./images/rollback-drill-build-dead-image.jpg '2단계: 지금 이미지 위에 HEALTHCHECK false 층만 얹어 sha-dead000을 만들었다')

**3. Actions에서 배포.** GitHub의 Actions → "API 배포" → Run workflow에 태그 `sha-dead000`을 넣고 실행한 뒤, 서버에서 `deploy.log`를 지켜봤다.

- 09:03:22 훈련용 컨테이너의 Nest가 정상으로 떴다. 앱은 멀쩡하고 헬스 체크만 거짓말을 한다
- 120초를 기다린 뒤 09:04:53 `이전 버전으로 되돌린다: sha-7e7eac0`
- 09:05:34 `배포 실패, 되돌림: sha-7e7eac0가 다시 떠 있다`. 되돌리는 데 41초

![서버 로그에서 되돌림이 찍힌 부분](./images/rollback-drill-server-log.jpg '3단계: 서버 로그. Nest가 뜬 뒤 09:04:53 되돌리기 시작, 09:05:34 되돌림 완료')

**4. 결과 확인.** Actions "API 배포 #2"는 3분 0초 만에 Failure로 끝났고(`Process completed with exit code 1`), 실패 메일이 왔다. 다른 창에서 `watch`로 보던 `docker compose ps api`에는 `sha-7e7eac0`이 `(healthy)`로 남아 있었다. 바깥 `/health`의 version까지 이전 태그인 것을 보고 성공으로 기록했다.

![GitHub Actions의 API 배포 #2 실패 화면](./images/rollback-drill-actions-failed.jpg '4단계: 수동 실행한 API 배포 #2가 3분 만에 Failure로 끝났다. 바라던 결과다')

![watch로 본 docker compose ps api](./images/rollback-drill-compose-healthy.jpg '4단계: 되돌린 뒤 컨테이너는 sha-7e7eac0, (healthy)')

![되돌리기 훈련의 시각별 타임라인](./images/rollback-drill-timeline.svg '120초를 기다리고, 되돌리는 데 41초. Actions는 3분 만에 실패로 끝났다')

끝나고 `docker image rm …:sha-dead000`으로 훈련용 이미지를 지웠다. 서버에는 지금 버전과 되돌릴 이전 버전(`sha-0f5d74f`, `sha-7e7eac0`)만 남았다. 이것으로 #100의 마지막 완료 기준, "헬스 체크가 실패하는 버전은 이전 버전으로 돌아가고 Actions가 실패로 알린다"를 진짜 서버에서 확인하고 이슈를 닫았다.

## 따라 하는 방법

전체 절차는 [docs/rollback-drill.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/rollback-drill.md)에 있다. 자동 배포를 처음 켜는 법은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정', 실제로 도는 코드는 [ops/deploy.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/deploy.sh)와 [.github/workflows/deploy-api.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/deploy-api.yml)이다.

**준비물**: 서버 SSH 접속, 저장소의 Actions 실행 권한, 방문이 적은 시간. 문서의 `<…>` 자리표시는 붙여 넣지 않는다.

```bash
# 1. 지금 상태 (서버) — 이 태그를 적어 둔다
cd ~/deploy
grep '^API_TAG=' .env                  # API_TAG=sha-xxxxxxx
docker compose ps api                  # STATUS가 Up … (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo

# 2. 훈련용 이미지 (서버)
cur=$(grep '^API_TAG=' ~/deploy/.env | cut -d= -f2)
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF

# 3. GitHub → Actions → API 배포 → Run workflow, 태그에 sha-dead000

# 4. 지켜보기 (서버, 창 두 개)
tail -f deploy.log
watch -n 3 docker compose ps api
```

**기대 결과**: 2분쯤 뒤 `deploy.log`에 `이전 버전으로 되돌린다` → `배포 실패, 되돌림: …가 다시 떠 있다`가 찍힌다. Actions는 실패, '바깥에서 버전 확인' 단계는 건너뛴다. `.env`·컨테이너·바깥 `/health`의 version이 모두 1단계의 태그다.

**정리**: `docker image rm ghcr.io/hyeoniverse/macfolio-api:sha-dead000`

**되돌리기마저 실패하면** 손으로 되돌린다. 이전 이미지는 서버에 남아 있다.

```bash
cd ~/deploy
docker compose ps api; docker compose logs --tail 100 api   # 원인부터 본다
~/macfolio/ops/deploy.sh sha-xxxxxxx                         # 1단계에서 적은 태그
# 스크립트가 안 되면 .env를 직접 고친다
sed -i 's/^API_TAG=.*/API_TAG=sha-xxxxxxx/' .env
docker compose up -d api
```

참고 문서: [Dockerfile HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck), [docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [GitHub Actions 수동 실행](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow).

## 확인한 것

| 볼 것                          | 기대                             | 결과                                 |
| ------------------------------ | -------------------------------- | ------------------------------------ |
| Actions "API 배포 #2"          | 빨간 X, '서버에서 배포'가 exit 1 | 3분 만에 실패, 메일 옴               |
| '바깥에서 버전 확인' 단계      | 건너뜀                           | 건너뜀                               |
| 기다린 시간                    | 120초                            | 120초 뒤 09:04:53(UTC) 되돌리기 시작 |
| 되돌리는 데 걸린 시간          | 수십 초                          | 41초 (09:04:53 → 09:05:34)           |
| `.env`·컨테이너·바깥 `/health` | 모두 이전 태그, healthy          | 모두 `sha-7e7eac0`, `(healthy)`      |

## 남은 것과 배운 것

- **블루·그린이 아니다.** 지금 배포는 옛 컨테이너를 멈추고 새 것을 띄운다. 1GB 서버에서 API 컨테이너 둘을 함께 띄우기는 빠듯해서 그대로 두었다. 훈련으로 끊기는 시간이 1분 안쪽이라는 것을 숫자로 알게 된 것이 이번 수확이다.
- **되돌리기도 실패할 수 있다.** 그때는 이전 태그로 `ops/deploy.sh`를 손으로 부르고, 그것도 안 되면 `.env`를 고쳐 `docker compose up -d api`를 한다. 이 두 단계는 훈련하지 않았다.
- **훈련은 진짜 길로.** 로컬 레지스트리 시험은 SSH 키의 `command=`, 터널, Actions의 실패 알림을 거치지 않는다. 이 셋을 지나야 "되돌린다"를 확인했다고 할 수 있었다.
- **스위치 대신 층 하나.** 실패를 만들 방법을 코드 밖(서버의 이미지)에 두니, 끝나고 지울 것이 이미지 하나뿐이었다.

관련 글: [API 자동 배포](/memo/api-auto-deploy) · [서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게](/memo/server-uptime-and-logs) · [서버 하드닝은 문서가 아니라 스크립트로](/memo/server-hardening-audit). PR: [#104](https://github.com/hyeoniverse/MacFolio/pull/104), [#254](https://github.com/hyeoniverse/MacFolio/pull/254).

#MacFolio #배포 #CI #서버

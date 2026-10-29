---
title: HEALTHCHECK가 실패하는 이미지로 자동 배포 롤백 훈련하기
date: 2026-10-18
category: 개발 기록/MacFolio/배포·운영
series: 배포 자동화
seriesOrder: 3
summary: 자동 배포의 롤백을 실제 서버에서 확인했다. 코드에 스위치를 추가하지 않고 HEALTHCHECK false 레이어만 추가한 훈련용 이미지를 배포했다. 120초 대기 후 41초 만에 이전 버전으로 복귀했고, Actions는 3분 만에 실패로 종료되었다.
---

API 자동 배포([#100](https://github.com/hyeoniverse/MacFolio/issues/100))는 새 버전이 healthy 상태가 되지 않으면 이전 버전으로 롤백하고 Actions를 실패로 종료한다. 로컬 레지스트리로는 시험했지만, 실제 서버에서 SSH 키와 터널을 거쳐 롤백하는 경로는 아직 검증하지 않았다. 그래서 훈련 절차를 작성했다(`docs/rollback-drill.md`, [#254](https://github.com/hyeoniverse/MacFolio/pull/254)).

## 배포 스크립트의 동작

먼저 훈련 대상을 정리했다. GitHub Actions의 "API 배포"는 배포 전용 SSH 키로 서버에 태그 하나만 전송한다. 서버의 `authorized_keys`에서 그 키에 `command=` 옵션[^forced-command]이 지정되어 있어, 어떤 명령을 보내도 `ops/deploy.sh`만 실행되고 전송한 문자열은 `SSH_ORIGINAL_COMMAND` 환경 변수로 전달된다.

```yaml
# .github/workflows/deploy-api.yml '서버에서 배포'
# 보내는 것은 태그 하나. 서버의 키 설정(command=)이 이것을 ops/deploy.sh에 넘긴다
ssh -i ~/.ssh/deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20 \
-o ServerAliveInterval=15 "$DEPLOY_USER@$DEPLOY_HOST" "$TAG"
```

스크립트는 태그 형식부터 검사한다. `sha-` 뒤에 16진수 7~40자가 아니면 아무 작업도 하지 않는다.

```bash
# ops/deploy.sh
tag="${1:-${SSH_ORIGINAL_COMMAND:-}}"
if [[ ! "$tag" =~ ^sha-[0-9a-f]{7,40}$ ]]; then
	log "배포 실패: 태그 모양이 아니다 ('sha-' + 커밋 7~40자리): '${tag}'"
	exit 2
fi
```

그다음 잠금, 배포 직전 백업, `.env`의 `API_TAG` 변경, 이미지 내려받기, `docker compose up -d api`, healthy 대기 순서로 진행한다. 결과는 세 가지로 나뉜다.

![ops/deploy.sh의 세 가지 결과](./images/rollback-drill-branches.svg '훈련은 healthy가 되지 않는 오른쪽 경로를 실제 서버에서 실행하는 것이다')

healthy 판정은 두 조건을 함께 검사한다. 컨테이너의 `HEALTHCHECK` 상태가 `healthy`이고, 컨테이너 안에서 요청한 `/health`의 `version`이 이번 태그여야 한다. 120초 동안 3초마다 확인하고, 실패하면 마지막 로그 40줄을 출력한 뒤 이전 태그로 같은 `up`을 다시 실행한다.

## 실패 유발 방법 선택

| 방법                                                       | 장점                    | 단점                                                                             |
| ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| main에 `/health`가 503을 반환하는 커밋을 머지              | 실제 배포 흐름 그대로   | 오류 코드가 main 기록에 남고, 되돌리는 커밋이 추가로 필요하다                    |
| 워크플로 입력 `drill_fail_health`로 스위치                 | 버튼 하나로 활성화      | 배포 키로 전송 가능한 범위가 넓어지고, 운영에서 활성화될 수 있는 스위치가 남는다 |
| 서버에서 `HEALTHCHECK false` 레이어만 추가한 이미지 (선택) | 코드·키·권한이 그대로다 | 서버에 직접 접속해 이미지를 생성하고, 종료 후 삭제해야 한다                      |

## 환경 변수 스위치를 두지 않은 이유

처음 검토한 방법은 Run workflow에 `drill_fail_health` 입력을 추가하고, 활성화하면 `/health`가 503을 반환하게 하는 방식이다. 그런데 배포 전용 SSH 키는 `authorized_keys`의 `command=`로 제한되어 **태그 하나만** 전송할 수 있다. 컨테이너에 환경 변수를 전달하려면 그 키의 전송 범위를 넓혀야 하고, 코드에는 운영 환경에서 활성화될 수 있는 스위치가 남는다. 훈련 1회를 위해 기존 보안 제약을 완화하는 셈이다.

대신 서버에서 현재 이미지 위에 레이어 하나만 추가한다.

```bash
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF
```

태그 `sha-dead000`은 실제 커밋이 아니지만 `d`·`e`·`a`·`0`이 모두 16진수 문자라 위의 태그 검사를 통과한다. `ops/deploy.sh`는 서버에 그 태그의 이미지가 있으면 GHCR에서 내려받지 않는다. 따라서 Actions에서 태그 `sha-dead000`을 입력하고 Run workflow를 실행하면 실제 배포 경로를 그대로 거친다. 새 비밀 값, 새 권한, 새 입력이 필요 없고, 종료 후 이미지를 삭제하면 흔적도 남지 않는다.

## 서비스 중단 시간

배포 스크립트는 블루·그린 배포[^bluegreen]가 아니다. `docker compose up -d api`가 기존 컨테이너를 중지하고 새 컨테이너를 시작한다. 그래서 중단이 두 번 발생한다.

- 훈련용 컨테이너로 교체하는 시각: 마이그레이션 확인과 Nest 시작까지 수 초~수십 초
- 대기하는 120초: 중단되지 않는다. 훈련용 이미지도 앱 자체는 정상이라 요청에 응답한다
- 이전 버전으로 롤백하는 시각: 다시 수 초~수십 초

합계 1분 이내다. 방문이 적은 시간대에 진행한다. 10분마다 실행되는 업타임 감시가 그 사이에 실행되면 실패 메일이 한 통 발송될 수 있고, 배포 직전 백업도 평소처럼 하나 생성된다.

훈련용 이미지가 실패하는 조건은 실제로 두 가지다. `HEALTHCHECK`가 `false`라 컨테이너가 `starting`에서 `unhealthy`로 바뀌고, 앱은 현재 버전 그대로라 `/health`의 `version`도 `sha-dead000`이 아니다. 서버 `compose.yml`의 api 서비스에는 `healthcheck:`가 없으므로 이미지의 `HEALTHCHECK`가 그대로 적용된다([Docker 문서: HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)).

## 확인 항목

- Actions: 실패 표시. '서버에서 배포' 단계가 `exit code 1`로 종료되고, '바깥에서 버전 확인'은 건너뛴다
- 배포 로그: `120초 안에 healthy가 되지 않았다` → `이전 버전으로 되돌린다` → `배포 실패, 되돌림: …가 다시 떠 있다`
- 서버: `.env`의 `API_TAG`, `docker compose ps api`의 이미지, 외부 `/health`의 version이 모두 이전 태그이고 healthy

롤백까지 실패하면 이전 태그로 `ops/deploy.sh`를 수동 실행하고, 그래도 실패하면 `.env`의 `API_TAG`를 수정해 `docker compose up -d api`를 실행한다. 이전 이미지는 서버에 보관되므로 다시 내려받지 않는다.

## 실행 결과 (2026-10-18)

절차 문서를 작성한 뒤 훈련 실행 방법을 단계별로 보강했고, 그 순서대로 서버에 접속해 실행했다. 시각은 모두 UTC다.

**1. 현재 상태 기록.** 서버에 접속해 `.env`의 `API_TAG`, 컨테이너 상태, 외부 `/health`를 확인했다. 세 값 모두 `sha-7e7eac0`, `(healthy)`였다. `dead000`이 실제 커밋이 아닌지도 `git rev-parse --verify`로 확인했다. 출력이 없으면 실제 커밋이 아니다.

![서버 접속 후 API_TAG와 /health를 확인한 터미널](./images/rollback-drill-server-before.jpg '1단계: 훈련 전 상태. 접속 명령(키 경로·서버 IP)과 접속 IP는 마스킹했다.')

**2. 훈련용 이미지 생성.** 현재 태그를 `cur`에 저장하고 그 위에 `HEALTHCHECK … CMD false` 레이어 하나만 추가했다. 3.9초 만에 완료되었고, 서버에는 `sha-0f5d74f`, `sha-7e7eac0`(사용 중), `sha-dead000` 이미지 3개가 남았다.

![sha-dead000 이미지를 만든 터미널](./images/rollback-drill-build-dead-image.jpg '2단계: 현재 이미지 위에 HEALTHCHECK false 레이어만 추가해 sha-dead000을 생성했다')

**3. Actions에서 배포.** GitHub의 Actions → "API 배포" → Run workflow에 태그 `sha-dead000`을 입력해 실행하고, 서버에서 `deploy.log`를 모니터링했다.

- 09:03:22 훈련용 컨테이너의 Nest가 정상 시작되었다. 앱은 정상이고 헬스 체크만 실패를 보고한다
- 120초 대기 후 09:04:53 `이전 버전으로 되돌린다: sha-7e7eac0`
- 09:05:34 `배포 실패, 되돌림: sha-7e7eac0가 다시 떠 있다`. 롤백 소요 시간 41초

![서버 로그의 롤백 기록 부분](./images/rollback-drill-server-log.jpg '3단계: 서버 로그. Nest 시작 후 09:04:53 롤백 시작, 09:05:34 롤백 완료')

**4. 결과 확인.** Actions "API 배포 #2"는 3분 0초 만에 Failure로 종료되었고(`Process completed with exit code 1`), 실패 메일이 수신되었다. 다른 창에서 `watch`로 모니터링한 `docker compose ps api`에는 `sha-7e7eac0`이 `(healthy)`로 유지되었다. 외부 `/health`의 version까지 이전 태그인 것을 확인하고 성공으로 기록했다.

![GitHub Actions의 API 배포 #2 실패 화면](./images/rollback-drill-actions-failed.jpg '4단계: 수동 실행한 API 배포 #2가 3분 만에 Failure로 종료되었다. 의도한 결과다')

![watch로 모니터링한 docker compose ps api](./images/rollback-drill-compose-healthy.jpg '4단계: 롤백 후 컨테이너는 sha-7e7eac0, (healthy)')

![되돌리기 훈련의 시각별 타임라인](./images/rollback-drill-timeline.svg '120초 대기, 롤백 41초. Actions는 3분 만에 실패로 종료되었다')

종료 후 `docker image rm …:sha-dead000`으로 훈련용 이미지를 삭제했다. 서버에는 현재 버전과 롤백용 이전 버전(`sha-0f5d74f`, `sha-7e7eac0`)만 남았다. 이것으로 [#100](https://github.com/hyeoniverse/MacFolio/issues/100)의 마지막 완료 기준 "헬스 체크가 실패하는 버전은 이전 버전으로 돌아가고 Actions가 실패로 알린다"를 실제 서버에서 확인하고 이슈를 종료했다.

## 적용 방법

전체 절차는 [docs/rollback-drill.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/rollback-drill.md)에 있다. 자동 배포 최초 설정은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정', 실행되는 코드는 [ops/deploy.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/deploy.sh)와 [.github/workflows/deploy-api.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/deploy-api.yml)이다.

**준비 사항**: 서버 SSH 접속, 저장소의 Actions 실행 권한, 방문이 적은 시간대. 문서의 `<…>` 플레이스홀더는 그대로 붙여 넣지 않는다.

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

**기대 결과**: 약 2분 후 `deploy.log`에 `이전 버전으로 되돌린다` → `배포 실패, 되돌림: …가 다시 떠 있다`가 기록된다. Actions는 실패하고, '바깥에서 버전 확인' 단계는 건너뛴다. `.env`·컨테이너·외부 `/health`의 version이 모두 1단계의 태그다.

**정리**: `docker image rm ghcr.io/hyeoniverse/macfolio-api:sha-dead000`

**롤백까지 실패하면** 수동으로 롤백한다. 이전 이미지는 서버에 보관되어 있다.

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

| 항목                           | 기대                           | 결과                             |
| ------------------------------ | ------------------------------ | -------------------------------- |
| Actions "API 배포 #2"          | 실패, '서버에서 배포'가 exit 1 | 3분 만에 실패, 메일 수신         |
| '바깥에서 버전 확인' 단계      | 건너뜀                         | 건너뜀                           |
| 대기 시간                      | 120초                          | 120초 후 09:04:53(UTC) 롤백 시작 |
| 롤백 소요 시간                 | 수십 초                        | 41초 (09:04:53 → 09:05:34)       |
| `.env`·컨테이너·외부 `/health` | 모두 이전 태그, healthy        | 모두 `sha-7e7eac0`, `(healthy)`  |

## 남은 과제와 정리

- **블루·그린 배포가 아니다.** 현재 배포는 기존 컨테이너를 중지하고 새 컨테이너를 시작한다. 메모리 1GB 서버에서 API 컨테이너 2개를 동시에 실행하기는 어려워 현재 방식을 유지했다. 훈련으로 중단 시간이 1분 이내라는 수치를 확보했다.
- **롤백도 실패할 수 있다.** 그 경우 이전 태그로 `ops/deploy.sh`를 수동 실행하고, 그래도 실패하면 `.env`를 수정해 `docker compose up -d api`를 실행한다. 이 두 단계는 훈련하지 않았다.
- **훈련은 실제 경로로.** 로컬 레지스트리 시험은 SSH 키의 `command=`, 터널, Actions의 실패 알림을 거치지 않는다. 이 세 단계를 거쳐야 롤백을 검증했다고 할 수 있다.
- **스위치 대신 레이어 하나.** 실패 유발 수단을 코드 밖(서버의 이미지)에 두었으므로, 종료 후 삭제할 대상이 이미지 하나뿐이었다.

관련 PR: [#104](https://github.com/hyeoniverse/MacFolio/pull/104)(API 자동 배포), [#254](https://github.com/hyeoniverse/MacFolio/pull/254)(훈련 절차).

## 관련 글

- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)
- [서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기](/memo/server-hardening-audit)
- [pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)

[^forced-command]: `authorized_keys`의 키 앞에 `command="…"`를 지정하면, 그 키로 접속할 때 클라이언트가 요청한 명령 대신 지정한 명령만 실행된다. 요청한 명령은 `SSH_ORIGINAL_COMMAND` 환경 변수로 전달된다. [OpenSSH 매뉴얼: sshd(8) AUTHORIZED_KEYS FILE FORMAT](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT)

[^bluegreen]: 새 버전(그린)을 기존 버전(블루)과 동시에 실행하고, 정상 확인 후 트래픽을 전환하는 배포 방식. 전환 시각에 서비스 중단이 없다.

#MacFolio #배포 #CI #서버

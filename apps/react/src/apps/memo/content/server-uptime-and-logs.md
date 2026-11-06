---
title: GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기
date: 2026-10-07
category: 개발 기록/MacFolio/배포·운영
series: 서버 운영
seriesOrder: 3
summary: API 서버가 중지되어도 사이트에 접속하기 전에는 알 수 없었고, 컨테이너 로그는 계속 누적됐다. 10분마다 외부에서 /health와 사이트를 호출하는 GitHub Actions 예약 실행과, 컨테이너마다 30MB까지만 보관하는 로그 설정을 추가했다. 장애를 인지하기까지 걸리는 최대 시간도 계산했다.
---

## 배경: 업타임 감시와 로그 로테이션

API는 Oracle Cloud의 무료 VM(RAM 1GB) 한 대에서 실행된다. 배포는 GitHub Actions로 자동화했고 DB 백업도 매일 서버 외부(Cloudflare R2)로 전송하지만, 운영에 두 가지 공백이 남아 있었다.

| 공백                   | 구체적인 상황                                                                                                   | 필요한 장치   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- |
| 서버 중지를 알 수 없다 | 사이트에 접속해 메뉴 막대의 서버 상태 표시를 확인하기 전에는 API가 중지된 사실을 인지할 방법이 없다             | 업타임 감시   |
| 로그가 계속 누적된다   | Docker는 기본 설정에서 컨테이너 로그를 삭제하지 않는다. 디스크가 가득 차면 PostgreSQL도 더 이상 기록하지 못한다 | 로그 로테이션 |

**업타임 감시**(uptime monitoring)는 서비스가 응답하는지 일정 간격으로 요청을 보내 확인하고, 응답이 없으면 알리는 작업이다. 예를 들어 10분마다 `https://…/health`에 요청을 보내 200 응답이 오면 정상, 시간 초과나 5xx 응답이 오면 장애로 판단한다. "업타임"은 서비스가 정상 동작한 시간을 뜻하고, 감시 결과를 모으면 "한 달 중 99.9% 동작" 같은 가용률을 계산할 수 있다.

**로그 로테이션**(log rotation)은 로그 파일이 정해진 크기에 도달하면 새 파일로 바꿔 기록하고, 오래된 파일은 정해진 개수만 남기고 삭제하는 방식이다. 로그를 계속 남기면서도 디스크 사용량에 상한을 둘 수 있다.

## 감시 방법 비교

| 방법                                                          | 장점                                      | 단점                                                                  |
| ------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| [UptimeRobot](https://uptimerobot.com/) 같은 외부 감시 서비스 | 1분 간격, 상태 페이지 제공                | 가입과 알림 설정이 저장소 밖에 생기고, 감시 대상이 코드로 남지 않는다 |
| 서버 내부 cron이 직접 확인                                    | 외부 서비스가 필요 없다                   | 서버 전체가 중지되면 알림을 보낼 주체도 함께 중지된다                 |
| GitHub Actions 예약 실행 (**채택**)                           | 이미 사용 중이고, 워크플로 파일이 곧 설정 | 10분 간격이고, 예약 실행이 몇 분 지연될 수 있다                       |

서버 내부에서 확인하는 방법은 처음부터 목적에 맞지 않았다. 감지하려는 상황이 "서버 중지"인데, ==알림 주체가 서버 안에 있으면 그 상황에서 알림을 보낼 수 없다==. 아래 그림의 A처럼 VM이 중지되면 같은 VM에서 실행되던 cron도 함께 중지된다.

![서버 안의 cron은 VM과 함께 중지되어 알림을 보내지 못하고, 바깥의 GitHub Actions는 530 응답이나 시간 초과를 받아 실행 실패 메일을 보내는 비교](./images/server-uptime-and-logs-inside-outside.svg '감시 주체가 감시 대상과 같은 VM에 있으면 서버 중지를 알릴 수 없다')

B처럼 외부에서 요청을 보내면 방문자와 같은 경로를 거친다. 이 사이트의 API는 인바운드 포트를 열지 않고 Cloudflare Tunnel[^tunnel]로만 공개되므로, 외부 요청은 Cloudflare를 거쳐 터널로 서버에 도달한다. 서버가 중지되어 터널이 끊기면 Cloudflare가 530 오류를 응답하고, 감시 쪽은 이 응답으로 장애를 판단한다.

## 업타임 감시: GitHub Actions 예약 실행

GitHub Actions는 저장소의 `.github/workflows/*.yml` 파일에 적은 작업을 GitHub의 가상 머신(러너)에서 실행하는 CI 서비스다. 보통 push나 PR 같은 사건에 반응해 실행되지만, [예약 실행(schedule)](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule)을 지정하면 정해진 시각마다 실행된다. 이미 빌드·배포에 사용하는 서비스라 새 계정이나 비밀 값이 필요 없다.

```yaml
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
```

`cron` 값은 Unix cron과 같은 문법의 다섯 칸 식이다. 칸은 차례대로 분·시·일·월·요일이고, `*`는 "모든 값", `*/10`은 "0부터 10씩 건너뛴 값"을 뜻한다. 따라서 `*/10 * * * *`는 매시 0·10·20·30·40·50분, 하루 144번 실행된다. `workflow_dispatch`는 Actions 화면의 Run workflow 버튼으로 즉시 실행할 수 있게 하는 항목이다.

![cron 식 */10 * * * *의 다섯 칸이 각각 분·시·일·월·요일을 뜻하고, 분 칸만 10분 간격이라 09:00, 09:10, …, 10:00에 실행되는 예시](./images/server-uptime-and-logs-cron.svg '분 칸의 */10이 10분 간격을 만든다. 시각은 UTC 기준이다')

GitHub 문서에 명시된 예약 실행의 규칙은 다음과 같다.

| 규칙        | 내용                                                     |
| ----------- | -------------------------------------------------------- |
| 최소 간격   | 5분                                                      |
| 시간대      | 기본 UTC                                                 |
| 실행 브랜치 | 기본 브랜치(main)의 워크플로 파일만 실행                 |
| 지연        | Actions 전체 부하가 높은 시간대에는 늦게 시작될 수 있다  |
| 비활성화    | 공개 저장소에 60일 동안 활동이 없으면 자동으로 비활성화  |
| 실패 알림   | 워크플로 파일의 cron을 마지막으로 수정한 사용자에게 발송 |

### 확인하는 두 주소

워크플로는 10분마다 외부에서 두 주소를 호출한다.

1. **API `/health`**: 응답이 있어야 하고, 본문의 `status`가 `ok`, `database`가 `up`이어야 한다. 서버는 실행 중이지만 DB가 중지된 경우도 검출한다.
2. **사이트 첫 화면**: Cloudflare Worker가 응답하는 정적 페이지가 200인지 확인한다.

`/health`는 DB에 `SELECT 1` 쿼리를 보내 성공하면 200과 다음 본문을, 실패하면 503을 응답한다(`apps/api/src/health/health.controller.ts`).

```json
{ "status": "ok", "database": "up", "version": "sha-1a2b3c4" }
```

호출이 실패하면 워크플로 실행이 실패하고, GitHub이 실패한 실행을 메일로 알린다. 별도 알림 서비스를 연결하지 않아도 된다.

### 배포 중 순단을 걸러 내는 다시 시도

자동 배포가 API 컨테이너를 교체하는 몇 초 동안은 `/health`가 응답하지 않는다. 그때마다 메일이 발송되면 알림을 신뢰할 수 없게 된다. 그래서 `curl --retry 3 --retry-delay 30 --retry-all-errors`로 실패하면 30초 간격으로 세 번 더 시도한다. ==1분 30초 이상 응답이 없어야 실패로 판정한다==.

```yaml
# .github/workflows/uptime.yml
permissions: {}

jobs:
  uptime:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: API /health (서버와 DB)
        run: |
          body=$(curl -fsS --max-time 15 --retry 3 --retry-delay 30 --retry-all-errors https://macfolio-api.hyeoniverse.com/health)
          echo "$body"
          jq -e '.status == "ok" and .database == "up"' <<<"$body" > /dev/null
      - name: 사이트
        run: curl -fsS -o /dev/null --max-time 15 --retry 3 --retry-delay 30 --retry-all-errors https://macfolio.hyeoniverse.com/
```

| 옵션·설정            | 역할                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-f`                 | 응답 코드가 400 이상이면 curl이 0이 아닌 종료 코드로 끝나게 한다. 이 옵션이 없으면 503 응답도 "요청 성공"으로 처리되어 단계가 통과한다                                                                                                           |
| `--max-time 15`      | 한 번의 시도가 15초를 넘으면 중단한다. 응답 없이 연결만 유지되는 경우에도 단계가 끝나도록 상한을 둔다                                                                                                                                            |
| `--retry-all-errors` | `--retry`만으로는 시간 초과와 408·429·500·502·503·504 같은 정해진 응답만 재시도한다. 터널이 서버에 연결하지 못할 때 Cloudflare가 반환하는 530이나 연결 거부까지 재시도하려면 이 옵션이 필요하다 ([curl 문서](https://curl.se/docs/manpage.html)) |
| `jq -e`              | 응답 본문까지 검사한다. DB가 중지되면 `/health`가 503을 반환해 curl 단계에서 먼저 실패하지만, 200 응답에 다른 본문이 오는 경우도 검출한다                                                                                                        |
| `permissions: {}`    | 저장소 읽기·쓰기 권한을 모두 제거한다. 업타임 감시에는 저장소 토큰 권한이 필요 없다                                                                                                                                                              |

`jq -e`는 식의 결과가 `false`나 `null`이면 종료 코드 1로 끝난다. 예를 들어 본문이 `{"status":"ok","database":"down"}`이면 식이 `false`가 되어 단계가 실패한다.

![10분마다 상태를 확인하고 실패하면 30초 간격으로 세 번 더 시도하는 타임라인과 로그 로테이션](./images/server-uptime-and-logs-retry.svg '배포로 몇 초 끊긴 요청은 다시 시도 구간 안에서 통과한다')

### 장애 인지까지 걸리는 최대 시간

서버가 중지된 시각부터 메일이 도착하기까지 가장 오래 걸리는 경우는, 예약 실행이 끝난 직후 서버가 중지되는 경우다.

1. 다음 예약 실행까지 대기: 최대 10분
2. 시도 4번(첫 시도 + 다시 시도 3번), 시도마다 최대 15초: 60초
3. 시도 사이 대기 3번, 30초씩: 90초

```math
10\text{분} + 4 \times 15\text{초} + 3 \times 30\text{초} = 10\text{분} + 150\text{초} = 12\text{분 } 30\text{초}
```

![서버가 중지된 뒤 메일이 오기까지 가장 늦은 경우](./images/server-uptime-and-logs-worst.svg '다음 확인까지 10분, 다시 시도까지 2분 30초')

> [!WARNING] 예약 실행의 지연과 비활성화
> GitHub 쪽 부하에 따라 실행이 몇 분씩 지연될 수 있어 실제로는 12분 30초보다 더 걸릴 수 있다. 공개 저장소에 60일 동안 활동이 없으면 예약 실행이 비활성화된다. 이 서비스는 1분 단위 감시가 필요하지 않아 이 수준으로 충분하다. 공개 저장소라 실행 시간 비용은 없다.

## 로그 로테이션

Docker는 컨테이너가 표준 출력(stdout)과 표준 오류(stderr)로 내보낸 문자열을 **로그 드라이버**로 저장한다. 기본 드라이버 `json-file`은 한 줄마다 `{"log":"…","stream":"stdout","time":"…"}` 형식의 JSON을 호스트의 `/var/lib/docker/containers/<컨테이너 ID>/<컨테이너 ID>-json.log` 파일에 덧붙인다. 기본값에는 크기 제한이 없어 컨테이너가 오래 실행될수록 파일이 커진다.

`json-file` 드라이버는 두 옵션으로 로테이션을 지원한다([Docker 문서](https://docs.docker.com/engine/logging/drivers/json-file/)).

| 옵션       | 뜻                                                          | 설정값 |
| ---------- | ----------------------------------------------------------- | ------ |
| `max-size` | 파일 하나의 최대 크기. 넘으면 새 파일로 바꿔 기록한다       | `10m`  |
| `max-file` | 보관할 파일의 최대 개수. 넘으면 가장 오래된 파일을 삭제한다 | `3`    |

![json-file 로그 드라이버가 현재 파일이 10MB에 도달하면 json.log를 json.log.1로, json.log.1을 json.log.2로 밀고 가장 오래된 json.log.2를 삭제하는 과정](./images/server-uptime-and-logs-rotation.svg '파일 세 개를 돌려 쓰므로 컨테이너당 30MB를 넘지 않는다')

서버의 `compose.yml`에 로그 설정을 한 번 정의하고 세 서비스(db, api, tunnel)가 공유하게 했다. YAML 앵커(`&logging`, `*logging`)[^anchor]를 사용해 같은 설정을 세 번 반복하지 않는다.

```yaml
x-logging: &logging
  driver: json-file
  options:
    max-size: 10m
    max-file: '3'

services:
  api:
    logging: *logging
```

| 항목                  | 값                |
| --------------------- | ----------------- |
| 파일 하나의 최대 크기 | 10MB (`max-size`) |
| 보관 파일 수          | 3개 (`max-file`)  |
| 컨테이너당 최대 용량  | 30MB              |
| 세 컨테이너 합계      | 90MB 이하         |

`x-`로 시작하는 최상위 항목은 compose가 무시하는 [확장 필드](https://docs.docker.com/reference/compose-file/extension/)라 앵커를 정의하기에 적합하다. `*logging`을 쓴 자리는 YAML을 읽는 시각에 앵커의 내용으로 치환되므로, compose 입장에서는 세 서비스에 같은 `logging:` 블록을 적은 것과 같다. 문서의 `compose.yml`을 그대로 `docker compose config`로 전개해 세 서비스 모두에 같은 설정이 적용된 것을 확인했다.

> [!IMPORTANT] 로그 설정은 컨테이너를 다시 만들어야 적용된다
> 로그 설정은 컨테이너 생성 시각에 결정되므로, 이미 실행 중인 서버는 `compose.yml`을 수정한 뒤 `docker compose up -d`로 컨테이너를 다시 생성해야 한다. 서버 `compose.yml`은 저장소 밖(서버의 `~/deploy`)에 있어서 이 작업은 수동으로 한 번 실행한다. 순서는 `docs/deployment.md`의 '로그 로테이션'에 기록했다.

```bash
cd ~/deploy
docker compose config --quiet && echo OK     # 들여쓰기 확인
docker compose up -d                         # 설정이 바뀐 컨테이너를 다시 만든다 (몇 초 끊긴다, DB 데이터는 볼륨에 남는다)
docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Config}}' $(docker compose ps -q)   # 셋 다 max-size:10m
```

마지막 줄이 검증 단계다. 컨테이너마다 실제로 적용된 로그 설정을 출력해, 세 컨테이너 모두 `max-size:10m`인지 확인한다.

## 운영 방법

| 항목          | 위치                                                                                                           | 작업                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 업타임 감시   | [.github/workflows/uptime.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/uptime.yml) | 즉시 실행은 Actions → uptime → Run workflow. 실패 메일은 GitHub Settings → Notifications → Actions에서 알림이 활성화되어 있어야 수신된다. 60일 동안 활동이 없어 비활성화되면 다시 활성화한다 |
| 로그 로테이션 | 서버 `compose.yml`의 `x-logging`                                                                               | 설정이 없는 서버라면 위의 설정을 추가하고 같은 명령으로 확인한다. 로그 조회는 `docker compose logs --tail=100 api`. 되돌리려면 `logging:` 줄을 삭제하고 `docker compose up -d`를 실행한다    |

전체 절차는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '로그와 상태'에 있다.

## 남은 과제

- **알림은 cron을 마지막으로 수정한 사용자에게 발송된다.** 1인 저장소라 문제가 없지만, 참여자가 늘면 알림 수신자를 별도로 지정해야 한다.
- **60일 규칙.** 공개 저장소에 60일 동안 활동이 없으면 GitHub이 예약 실행을 비활성화한다. 저장소 관리가 멈춘 기간, 즉 감시가 가장 필요한 기간에 감시가 중단될 수 있다.
- **30MB는 부족할 수 있다.** 로그가 많이 기록되는 날 장애를 늦게 인지하면, 그 사이의 로그가 이미 로테이션으로 삭제됐을 수 있다. 장기 보관할 로그가 생기면 파일 수를 늘리거나 서버 외부로 전송해야 한다. 로그에 기록하고 마스킹하는 항목은 [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)에 정리했다.
- **장애는 외부에서 감지한다.** 감시 주체가 감시 대상과 함께 중지되면 안 된다는 것이 이 작업의 핵심 기준이었다.

## 관련 글

- [Oracle Always Free 회수를 막는 /proc 사용률 측정과 위험 메일 알림](/memo/resource-monitor): 이후 같은 방향으로 추가한 서버 자원 감시
- [HEALTHCHECK가 실패하는 이미지로 자동 배포 롤백 훈련하기](/memo/rollback-drill)
- [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)
- [서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기](/memo/server-hardening-audit)

<details>
<summary>참고 문헌</summary>

- GitHub Docs, [Events that trigger workflows: schedule](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule)
- GitHub Docs, [Manually running a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow)
- curl, [curl man page](https://curl.se/docs/manpage.html) (`--fail`, `--retry`, `--retry-all-errors`, `--max-time`)
- jq, [jq Manual](https://jqlang.org/manual/) (`--exit-status`)
- Docker Docs, [JSON File logging driver](https://docs.docker.com/engine/logging/drivers/json-file/)
- Docker Docs, [Compose file extensions](https://docs.docker.com/reference/compose-file/extension/)
- Cloudflare Docs, [Error 530](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-530/)
- YAML 1.2.2 명세, [3.2.2.2 Anchors and Aliases](https://yaml.org/spec/1.2.2/)

</details>

[^tunnel]: 서버 안의 `cloudflared` 프로세스가 Cloudflare로 나가는 연결을 먼저 맺고, 외부 요청을 그 연결로 받아 서버에 전달하는 방식. 서버에 인바운드 포트를 열지 않아도 된다.

[^anchor]: YAML에서 `&이름`으로 값에 이름을 붙이고 `*이름`으로 같은 값을 다시 참조하는 문법.

#MacFolio #서버 #감시

---
title: 서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게
date: 2026-10-07
category: 개발기/MacFolio/인프라
summary: API 서버가 중지되어도 사이트에 접속하기 전에는 알 수 없었고, 컨테이너 로그는 계속 누적됐다. 10분마다 외부에서 /health와 사이트를 호출하는 GitHub Actions 예약 실행과, 컨테이너마다 30MB까지만 보관하는 로그 설정을 추가했다. 장애를 인지하기까지 걸리는 최대 시간도 계산했다.
---

API는 Oracle의 무료 VM(RAM 1GB) 한 대에서 실행된다. 배포는 자동화됐고 백업도 매일 서버 외부로 전송되지만, 운영에 두 가지 공백이 남아 있었다.

- **서버가 중지되어도 알 수 없다.** 사이트에 접속해 메뉴 막대의 서버 상태를 확인하기 전에는 인지할 방법이 없다.
- **로그가 계속 누적된다.** Docker는 기본 설정에서 컨테이너 로그를 삭제하지 않는다. 디스크가 가득 차면 DB도 더 이상 기록하지 못한다.

## 검토한 방법

| 방법                                                          | 장점                                      | 단점                                                                  |
| ------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| [UptimeRobot](https://uptimerobot.com/) 같은 외부 감시 서비스 | 1분 간격, 상태 페이지 제공                | 가입과 알림 설정이 저장소 밖에 생기고, 감시 대상이 코드로 남지 않는다 |
| 서버 내부 cron이 직접 확인                                    | 외부 서비스가 필요 없다                   | 서버 전체가 중지되면 알림을 보낼 주체도 함께 중지된다                 |
| GitHub Actions 예약 실행 (**채택**)                           | 이미 사용 중이고, 워크플로 파일이 곧 설정 | 10분 간격이고, 예약 실행이 몇 분 지연될 수 있다                       |

서버 내부에서 확인하는 방법은 처음부터 목적에 맞지 않았다. 감지하려는 상황이 "서버 중지"인데, 알림 주체가 서버 안에 있으면 그 상황에서 알림을 보낼 수 없다. 외부에서 터널과 Cloudflare를 거친 실제 주소로 호출해야 방문자가 경험하는 상태와 같다.

## 업타임 감시: GitHub Actions 예약 실행

외부 감시 서비스에 가입하는 대신, 이미 사용 중인 GitHub Actions에 [예약 실행(schedule)](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule)을 하나 추가했다. 10분마다 외부에서 두 주소를 호출한다.

```yaml
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
```

1. API `/health`: 응답이 있어야 하고, `status`가 `ok`, `database`가 `up`이어야 한다. 서버는 실행 중이지만 DB가 중지된 경우도 검출한다.
2. 사이트 첫 화면

호출이 실패하면 워크플로 실행이 실패하고, GitHub이 실패한 실행을 메일로 알린다. 별도 알림 서비스를 연결하지 않아도 된다. 예약 실행의 알림은 해당 cron을 마지막으로 수정한 사용자에게 발송된다.

자동 배포가 API 컨테이너를 교체하는 몇 초 동안은 `/health`가 응답하지 않는다. 그때마다 메일이 발송되면 알림의 신뢰도가 떨어진다. 그래서 `curl --retry 3 --retry-delay 30 --retry-all-errors`로 30초 간격으로 세 번 더 시도한다. 1분 30초 이상 응답이 없어야 실패로 판정한다.

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
| `--retry-all-errors` | `--retry`만으로는 시간 초과와 408·429·500·502·503·504 같은 정해진 응답만 재시도한다. 터널이 서버에 연결하지 못할 때 Cloudflare가 반환하는 530이나 연결 거부까지 재시도하려면 이 옵션이 필요하다 ([curl 문서](https://curl.se/docs/manpage.html)) |
| `jq -e`              | 응답 본문까지 검사한다. DB가 중지되면 `/health`가 503을 반환해 curl 단계에서 먼저 실패하지만, 200 응답에 다른 본문이 오는 경우도 검출한다                                                                                                        |
| `permissions: {}`    | 저장소 읽기·쓰기 권한을 모두 제거한다. 업타임 감시에는 저장소 토큰 권한이 필요 없다                                                                                                                                                              |

![10분마다 상태를 묻고 실패하면 30초 간격으로 세 번 더 시도하는 타임라인과 로그 로테이션](./images/server-uptime-and-logs-retry.svg '배포로 잠깐 끊긴 것은 다시 시도 안에 지나간다')

장애 발생부터 알림 메일까지 걸리는 최대 시간은 다음과 같다.

![서버가 죽은 뒤 메일이 오기까지 가장 늦은 경우](./images/server-uptime-and-logs-worst.svg '다음 확인까지 10분, 다시 시도까지 2분 30초')

예약 실행에는 제약도 있다. GitHub 쪽 부하에 따라 실행이 몇 분씩 지연될 수 있고, 공개 저장소에 60일 동안 활동이 없으면 예약 실행이 비활성화된다. 이 서비스는 1분 단위 감시가 필요하지 않아 이 수준으로 충분하다. 공개 저장소라 실행 시간 비용은 없다.

## 로그 로테이션

서버의 `compose.yml`에 로그 설정을 한 번 정의하고 세 서비스(db, api, tunnel)가 공유하게 했다. YAML 앵커[^anchor](`&logging`, `*logging`)를 사용해 같은 설정을 세 번 반복하지 않는다.

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

`x-`로 시작하는 최상위 항목은 compose가 무시하는 [확장 필드](https://docs.docker.com/reference/compose-file/extension/)라 앵커를 정의하기에 적합하다. 문서의 `compose.yml`을 그대로 `docker compose config`로 전개해 세 서비스 모두에 같은 설정이 적용된 것을 확인했다.

로그 설정은 컨테이너 생성 시각에 결정되므로, 이미 실행 중인 서버는 `compose.yml`을 수정한 뒤 `docker compose up -d`로 컨테이너를 다시 생성해야 한다. 서버 `compose.yml`은 저장소 밖(서버의 `~/deploy`)에 있어서 이 작업은 수동으로 한 번 실행한다. 순서는 `docs/deployment.md`의 '로그 로테이션'에 기록했다.

```bash
cd ~/deploy
docker compose config --quiet && echo OK     # 들여쓰기 확인
docker compose up -d                         # 설정이 바뀐 컨테이너를 다시 만든다 (몇 초 끊긴다, DB 데이터는 볼륨에 남는다)
docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Config}}' $(docker compose ps -q)   # 셋 다 max-size:10m
```

마지막 줄이 검증 단계다. 컨테이너마다 실제로 적용된 로그 설정을 출력해, 세 컨테이너 모두 `max-size:10m`인지 확인한다.

## 운영 방법

**업타임 감시**는 [.github/workflows/uptime.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/uptime.yml)이 10분마다 실행한다. 즉시 한 번 실행하려면 저장소의 Actions → uptime → Run workflow를 누른다. 실패 메일은 GitHub Settings → Notifications → Actions에서 알림이 활성화되어 있어야 수신된다. 저장소에 60일 동안 활동이 없어 예약 실행이 비활성화되면 다시 활성화한다.

**로그 로테이션**은 서버 `compose.yml`의 `x-logging`이다. 설정이 없는 서버라면 위의 설정을 추가하고 같은 명령으로 확인한다. 로그는 `docker compose logs --tail=100 api`로 조회한다. 설정을 되돌리려면 `logging:` 줄을 삭제하고 `docker compose up -d`를 실행한다. 전체 절차는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '로그와 상태'에 있다.

참고 문서: [GitHub Actions schedule](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule), [Docker json-file 로그 드라이버](https://docs.docker.com/engine/logging/drivers/json-file/).

## 남은 과제와 정리

- **알림은 cron을 마지막으로 수정한 사용자에게 발송된다.** 1인 저장소라 문제가 없지만, 참여자가 늘면 알림 수신자를 별도로 지정해야 한다. GitHub 설정의 Notifications → Actions에서 실패 알림이 활성화되어 있어야 한다.
- **60일 규칙.** 공개 저장소에 60일 동안 활동이 없으면 GitHub이 예약 실행을 비활성화한다. 저장소 관리가 멈춘 기간, 즉 감시가 가장 필요한 기간에 감시가 중단될 수 있다.
- **30MB는 부족할 수 있다.** 로그가 많이 기록되는 날 장애를 늦게 인지하면, 그 사이의 로그가 이미 로테이션으로 삭제됐을 수 있다. 장기 보관할 로그가 생기면 파일 수를 늘리거나 서버 외부로 전송해야 한다. 로그에 기록하고 마스킹하는 항목은 [오류 응답은 감추고, 로그는 가리고](/memo/error-log-masking)에 정리했다.
- **장애는 외부에서 감지한다.** 감시 주체가 감시 대상과 함께 중지되면 안 된다는 것이 이 작업의 핵심 기준이었다.

## 관련 글

- [무료 서버가 회수되기 전에](/memo/resource-monitor): 이후 같은 방향으로 추가한 서버 자원 감시
- [되돌리기 훈련](/memo/rollback-drill)
- [오류 응답은 감추고, 로그는 가리고](/memo/error-log-masking)
- [서버 하드닝은 문서가 아니라 스크립트로 남긴다](/memo/server-hardening-audit)

[^anchor]: YAML에서 `&이름`으로 값에 이름을 붙이고 `*이름`으로 같은 값을 다시 참조하는 문법.

#MacFolio #서버 #감시

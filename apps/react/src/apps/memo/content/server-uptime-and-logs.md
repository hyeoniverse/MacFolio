---
title: 서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게
date: 2026-10-07
category: 개발기/MacFolio/인프라
summary: API 서버가 내려가도 사이트에 들어와 보기 전에는 몰랐고, 컨테이너 로그는 쌓이기만 했다. 10분마다 바깥에서 /health와 사이트를 부르는 GitHub Actions 예약 실행과, 컨테이너마다 30MB까지만 남기는 로그 설정을 더했다. 가장 늦게 알게 되는 시간도 계산했다.
---

API는 Oracle의 무료 VM(RAM 1GB) 한 대에서 돈다. 배포는 자동이 됐고 백업도 매일 서버 밖으로 나가지만, 운영에 두 구멍이 남아 있었다.

- **서버가 내려가도 모른다.** 사이트에 들어와 메뉴 막대의 서버 상태를 보기 전까지는 알 길이 없다
- **로그가 쌓이기만 한다.** Docker는 기본으로 컨테이너 로그를 지우지 않는다. 디스크가 차면 DB도 더 쓰지 못한다

## 고른 방법과 버린 방법

| 방법                              | 좋은 점                               | 걸린 점                                                                 |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| UptimeRobot 같은 바깥 감시 서비스 | 1분 단위, 상태 페이지까지             | 가입과 알림 설정이 저장소 밖에 생기고, 무엇을 보는지 코드로 남지 않는다 |
| 서버 안의 cron이 스스로 확인      | 바깥 서비스가 없다                    | 서버가 통째로 죽으면 알릴 주체도 함께 죽는다                            |
| GitHub Actions 예약 실행 (고름)   | 이미 쓰는 곳, 워크플로 파일이 곧 설정 | 10분 간격, 예약이 몇 분 늦을 수 있다                                    |

서버 안에서 확인하는 방법은 처음부터 맞지 않았다. 알고 싶은 것이 "서버가 죽었다"인데, 그때 알릴 쪽이 서버 안에 있으면 안 된다. 바깥에서, 터널과 Cloudflare까지 거친 진짜 주소로 불러야 방문자가 보는 것과 같다.

## 업타임 감시: GitHub Actions 예약 실행

바깥 감시 서비스에 가입하는 대신, 이미 쓰는 GitHub Actions에 예약 실행을 하나 더했다. 10분마다 바깥에서 두 곳을 불러 본다.

```yaml
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
```

1. API `/health`: 응답이 와야 하고, `status`가 `ok`, `database`가 `up`이어야 한다. 서버만 살고 DB가 죽은 경우도 잡는다
2. 사이트 첫 화면

실패하면 실행이 실패하고, GitHub이 실패한 실행을 메일로 알린다. 따로 알림 서비스를 붙이지 않아도 된다. 예약 실행의 알림은 그 cron을 마지막으로 바꾼 사람에게 간다.

자동 배포가 API를 바꾸는 몇 초 동안은 `/health`가 응답하지 않는다. 그때마다 메일이 오면 곧 메일을 안 보게 된다. 그래서 `curl --retry 3 --retry-delay 30 --retry-all-errors`로 30초 간격으로 세 번 더 시도한다. 1분 반 넘게 안 되어야 실패다.

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

- `--retry`만으로는 시간 초과와 408·429·500·502·503·504 같은 정해진 응답만 다시 시도한다. 터널이 서버에 닿지 못할 때 Cloudflare가 돌려주는 530이나 연결 거부까지 다시 시도하려면 `--retry-all-errors`가 필요하다.
- `jq -e`로 몸통까지 본다. 서버는 살아 있는데 DB가 죽으면 `/health`가 503을 주므로 curl에서 먼저 실패하지만, 혹시 200에 다른 몸통이 오는 경우도 잡는다.
- 권한은 `{}`다. 저장소를 읽지도 쓰지도 않는다. 업타임 감시가 저장소 토큰을 가질 까닭이 없다.

![10분마다 상태를 묻고 실패하면 30초 간격으로 세 번 더 시도하는 타임라인과 로그 로테이션](./images/server-uptime-and-logs-retry.svg '배포로 잠깐 끊긴 것은 다시 시도 안에 지나간다')

가장 늦게 알게 되는 경우를 계산해 보면 이렇다.

![서버가 죽은 뒤 메일이 오기까지 가장 늦은 경우](./images/server-uptime-and-logs-worst.svg '다음 확인까지 10분, 다시 시도까지 2분 30초')

예약 실행에는 한계도 있다. GitHub 사정으로 몇 분씩 늦게 돌 수 있고, 저장소에 60일 동안 활동이 없으면 멈춘다. 1분 단위 감시가 필요한 서비스는 아니라서 이 정도로 충분하다. 공개 저장소라 실행 시간은 무료다.

## 로그 로테이션

서버의 `compose.yml`에 로그 설정을 한 번 적고 세 서비스(db, api, tunnel)가 같이 쓰게 했다. YAML 앵커(`&logging`, `*logging`)로 같은 설정을 세 번 쓰지 않는다.

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

컨테이너마다 10MB짜리 파일 3개, 30MB까지만 남는다. 세 컨테이너를 합쳐도 90MB가 넘지 않는다. `x-`로 시작하는 최상위 항목은 compose가 무시하는 자리라 앵커를 두기 좋다. 문서의 `compose.yml`을 그대로 꺼내 `docker compose config`로 펼쳐 보니 세 서비스 모두에 같은 설정이 들어갔다.

로그 설정은 컨테이너를 만들 때 정해져서, 이미 떠 있는 서버는 `compose.yml`을 고친 뒤 `docker compose up -d`로 컨테이너를 다시 만들어야 한다. 서버 `compose.yml`은 저장소 밖(서버의 `~/deploy`)에 있어서 이 부분은 손으로 한 번 한다. 순서는 `docs/deployment.md`의 '로그 로테이션'에 적었다.

```bash
cd ~/deploy
docker compose config --quiet && echo OK     # 들여쓰기 확인
docker compose up -d                         # 설정이 바뀐 컨테이너를 다시 만든다 (몇 초 끊긴다, DB 데이터는 볼륨에 남는다)
docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Config}}' $(docker compose ps -q)   # 셋 다 max-size:10m
```

마지막 줄이 확인이다. 컨테이너마다 실제로 적용된 로그 설정을 찍어, 셋 다 `max-size:10m`인지 본다.

## 남은 것과 배운 것

- **알림은 cron을 마지막으로 바꾼 사람에게 간다.** 혼자 쓰는 저장소라 문제가 없지만, 사람이 늘면 알림 받을 사람을 따로 정해야 한다. GitHub 설정의 Notifications → Actions에서 실패 알림이 켜져 있어야 한다.
- **60일 규칙.** 저장소에 60일 동안 활동이 없으면 GitHub이 예약 실행을 멈춘다. 감시가 가장 필요한 때(손을 놓은 때)에 멈출 수 있다는 뜻이다.
- **로그는 30MB면 짧을 수 있다.** 로그가 많이 쌓이는 날 장애를 늦게 알면, 그 사이의 로그가 이미 밀려났을 수 있다. 오래 남겨야 할 로그가 생기면 파일 수를 늘리거나 서버 밖으로 보내야 한다. 로그에 무엇을 남기고 가리는지는 [오류 응답은 감추고, 로그는 가리고](/memo/error-log-masking)에 적었다.
- **"죽었다"는 바깥에서 본다.** 감시하는 쪽이 감시받는 쪽과 같이 죽으면 안 된다는 것이 이 일의 가장 큰 기준이었다.

이 뒤로 서버 자원 감시([무료 서버가 회수되기 전에](/memo/resource-monitor))와 되돌리기 훈련([되돌리기 훈련](/memo/rollback-drill))이 같은 방향으로 이어졌다.

#MacFolio #서버 #감시

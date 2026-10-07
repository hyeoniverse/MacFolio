---
title: 서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게
date: 2026-10-07
category: 개발기/MacFolio
summary: API 서버가 내려가도 사이트에 들어와 보기 전에는 몰랐고, 컨테이너 로그는 지워지지 않고 쌓이기만 했다. 10분마다 바깥에서 /health를 부르는 GitHub Actions 예약 실행과, 컨테이너마다 30MB까지만 남기는 로그 설정을 더했다.
---

API는 Oracle의 무료 VM(RAM 1GB) 한 대에서 돈다. 배포는 자동이 됐고 백업도 매일 서버 밖으로 나가지만, 운영에 두 구멍이 남아 있었다.

- **서버가 내려가도 모른다.** 사이트에 들어와 메뉴 막대의 서버 상태를 보기 전까지는 알 길이 없다
- **로그가 쌓이기만 한다.** Docker는 기본으로 컨테이너 로그를 지우지 않는다. 디스크가 차면 DB도 더 쓰지 못한다

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

컨테이너마다 10MB짜리 파일 3개, 30MB까지만 남는다. `x-`로 시작하는 최상위 항목은 compose가 무시하는 자리라 앵커를 두기 좋다. 문서의 `compose.yml`을 그대로 꺼내 `docker compose config`로 펼쳐 보니 세 서비스 모두에 같은 설정이 들어갔다.

로그 설정은 컨테이너를 만들 때 정해져서, 이미 떠 있는 서버는 `compose.yml`을 고친 뒤 `docker compose up -d`로 컨테이너를 다시 만들어야 한다. 서버 `compose.yml`은 저장소 밖(서버의 `~/deploy`)에 있어서 이 부분은 손으로 한 번 한다. 순서는 `docs/deployment.md`의 '로그 로테이션'에 적었다.

---
title: 되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올린다
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: 자동 배포의 되돌리기를 진짜 서버에서 확인하는 훈련을 설계했다. 코드에 스위치를 두지 않고, 서버에서 지금 이미지에 HEALTHCHECK false 층만 얹은 훈련용 이미지를 만들어 배포한다. 끊기는 시간과 볼 것을 정리했다.
---

API 자동 배포(#100)는 새 버전이 건강하지 않으면 이전 버전으로 되돌리고 Actions를 실패로 끝낸다. 로컬 레지스트리로는 시험했지만, 진짜 서버에서 SSH 키와 터널까지 거쳐 되돌리는 것은 아직 보지 못했다. 그래서 훈련 절차를 만들었다 (`docs/rollback-drill.md`).

## 환경 변수 스위치를 두지 않은 까닭

처음 떠올린 것은 Run workflow에 `drill_fail_health` 입력을 두고, 켜면 `/health`가 503을 돌려주게 하는 방법이다. 그런데 배포 전용 SSH 키는 `authorized_keys`의 `command=`로 묶여 **태그 하나만** 보낼 수 있다. 컨테이너에 환경 변수를 넘기려면 그 키로 보낼 수 있는 것을 늘려야 하고, 코드에는 운영에서 켜질 수도 있는 스위치가 남는다. 훈련 한 번을 위해 지켜 온 것을 넓히는 셈이다.

대신 서버에서 지금 이미지 위에 층 하나만 얹는다.

```bash
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF
```

`ops/deploy.sh`는 서버에 그 태그의 이미지가 있으면 GHCR에서 받지 않는다. 그래서 Actions에서 태그 `sha-dead000`을 넣고 Run workflow 버튼을 누르기만 하면 진짜 길을 그대로 탄다. 새 비밀 값, 새 권한, 새 입력이 없고, 끝나면 이미지를 지워 흔적도 남지 않는다.

## 끊기는 시간

배포 스크립트는 블루·그린이 아니다. `docker compose up -d api`가 옛 컨테이너를 멈추고 새 것을 띄운다. 그래서 두 번 끊긴다.

- 훈련용 컨테이너로 바꿀 때: 마이그레이션 확인과 Nest 시작까지 수 초~수십 초
- 기다리는 120초: 끊기지 않는다. 훈련용 이미지도 앱은 정상이라 요청에 답한다
- 이전 버전으로 되돌릴 때: 다시 수 초~수십 초

합쳐 1분 안쪽이다. 방문이 적은 시간에 한다.

## 볼 것

- Actions: 빨간 X. '서버에서 배포' 단계가 `exit code 1`로 끝나고, '바깥에서 버전 확인'은 건너뛴다
- 배포 로그: `120초 안에 healthy가 되지 않았다` → `이전 버전으로 되돌린다` → `배포 실패, 되돌림: …가 다시 떠 있다`
- 서버: `.env`의 `API_TAG`, `docker compose ps api`의 이미지, 바깥 `/health`의 version이 모두 이전 태그이고 healthy

되돌리기마저 실패하면 이전 태그로 `ops/deploy.sh`를 손으로 부르고, 그것도 안 되면 `.env`의 `API_TAG`를 고쳐 `docker compose up -d api`를 한다. 이전 이미지는 서버에 남겨 두므로 다시 받지 않는다.

#MacFolio #배포 #CI #서버

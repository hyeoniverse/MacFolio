---
title: 서버 하드닝은 문서가 아니라 스크립트로 남긴다
date: 2026-10-10
category: 인프라/배포·운영
summary: "SSH는 키로만, 열린 포트는 22뿐, 컨테이너는 root가 아닌 사용자로, 보안 업데이트는 자동으로." 이 넷을 문서에 적는 대신 ops/audit.sh가 읽어서 OK/확인을 찍게 했다. 문서는 바뀐 뒤에도 그대로지만 스크립트는 지금 상태를 말한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 마지막 보안 항목 "서버: SSH는 키만, 방화벽 포트 목록, 컨테이너를 root가 아닌 사용자로 실행하는지 확인하고 문서에 남기기".

## 서버가 바깥에 내놓은 것

MacFolio의 API 서버는 Oracle 무료 VM 한 대다. 밖에서 닿는 길은 SSH(22) 하나뿐이다. API는 Cloudflare Tunnel이 서버에서 **밖으로** 연결을 걸고 요청이 그 연결을 타고 들어오므로 80·443을 열 필요가 없다. `compose.yml`에는 `ports:`가 하나도 없어서 DB도 API도 호스트 포트를 열지 않는다. 그러니 지킬 것은 넷으로 줄어든다.

1. SSH는 키로만 (비밀번호 없음)
2. 바깥에서 듣는 포트는 22뿐
3. 컨테이너는 root가 아닌 사용자로
4. 보안 업데이트는 자동으로

## 용어

- **`sshd -T`**: SSH 서버가 실제로 적용 중인 설정을 전부 찍는다. `sshd_config`와 `sshd_config.d/*.conf`가 겹칠 때 어느 값이 이기는지 파일을 읽어서는 알기 어려운데, 이 명령은 합친 결과를 보여 준다
- **`ss -lntu`**: 지금 듣고 있는 TCP·UDP 소켓. `0.0.0.0`이나 `[::]`로 듣는 것이 바깥에 열린 것이고, `127.0.0.1`은 서버 안에서만 닿는다
- **unattended-upgrades**: Ubuntu가 보안 패키지를 알아서 받아 설치하는 기능. 켜 두면 사람이 `apt upgrade`를 잊어도 된다
- **Security List**: Oracle 쪽 방화벽. 서버 안의 iptables와 별개로, 클라우드 네트워크가 먼저 거른다

## 문서 대신 스크립트

처음에는 "확인했다"고 문서에 적으려 했다. 그런데 그 문장은 적은 날에만 참이다. 누가 `compose.yml`에 `ports`를 넣거나 Dockerfile의 `USER node`를 지우면 문서는 모른다. 그래서 `ops/audit.sh`를 만들었다. 서버에서 돌리면 넷을 읽어 항목마다 `OK`/`확인`을 찍고, 확인이 하나라도 있으면 1로 끝난다. 아무것도 바꾸지 않는다.

```
[SSH] 키로만 접속
  OK    PasswordAuthentication no
  OK    PermitRootLogin prohibit-password
  OK    KbdInteractiveAuthentication no
  OK    비밀번호가 설정된 계정 없음
[포트] 바깥에서 듣는 것
        tcp 0.0.0.0:22
  OK    SSH(22) 말고 바깥에서 듣는 포트 없음
  OK    호스트 포트를 연 컨테이너 없음
[컨테이너] root가 아닌 사용자
  OK    api → node
  OK    tunnel → nonroot
  OK    db → postgres
```

문서(`docs/deployment.md`의 '서버 하드닝 점검')에는 기대하는 상태와 어긋났을 때 고치는 법만 표로 남겼다.

## 알게 된 것

- `api`는 Dockerfile 끝의 `USER node`로 이미 root가 아니었다. `cloudflared` 이미지도 기본이 `nonroot`다. `postgres`는 시작할 때만 root였다가 `postgres`로 내려가므로 `docker exec … id`가 root로 나올 수 있어서 둘 다 OK로 친다
- `ubuntu` 계정이 `docker` 그룹에 있으면 그 계정은 사실상 root다 (컨테이너에 호스트 디스크를 마운트하면 된다). 그래서 SSH 키가 곧 서버 전체의 열쇠이고, 키로만 받는 것이 가장 중요하다
- 비밀번호 질문은 `PasswordAuthentication` 말고 `KbdInteractiveAuthentication`로도 올 수 있어서 둘 다 `no`인지 본다
- fail2ban이나 SSH 포트 바꾸기는 두지 않았다. 키로만 받으면 무작위 시도는 로그만 남긴다

#MacFolio #보안 #서버 #SSH #Docker

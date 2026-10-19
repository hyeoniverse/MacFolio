---
title: 서버 하드닝은 문서가 아니라 스크립트로 남긴다
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: "SSH는 키로만, 열린 포트는 22뿐, 컨테이너는 root가 아닌 사용자로, 보안 업데이트는 자동으로." 이 넷을 문서에 적는 대신 ops/audit.sh가 읽어서 OK/확인을 찍게 했다. 첫 실행에서는 스크립트 쪽 실수 둘(루프백 DNS, distroless 사용자)을 고쳤다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 마지막 보안 항목 "서버: SSH는 키만, 방화벽 포트 목록, 컨테이너를 root가 아닌 사용자로 실행하는지 확인하고 문서에 남기기".

## 서버가 바깥에 내놓은 것

MacFolio의 API 서버는 Oracle 무료 VM 한 대다. 밖에서 닿는 길은 SSH(22) 하나뿐이다. API는 Cloudflare Tunnel이 서버에서 **밖으로** 연결을 걸고 요청이 그 연결을 타고 들어오므로 80·443을 열 필요가 없다. `compose.yml`에는 `ports:`가 하나도 없어서 DB도 API도 호스트 포트를 열지 않는다. 그러니 지킬 것은 넷으로 줄어든다.

![서버에 닿는 길은 SSH 22번뿐이고 API는 밖으로 건 터널로 요청을 받는 구조](./images/server-hardening-audit-exposure.svg '80·443이 닫혀 있어도 API가 도는 까닭은 터널이 서버에서 밖으로 연결을 걸기 때문이다')

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

남기는 방법을 견줘 보면 이렇다.

| 방법                                | 좋은 점                            | 걸린 점                                                         |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| 문서에 "확인했다"고 적기            | 바로 끝난다                        | 적은 날에만 참이다. 누가 바꿔도 문서는 모른다                   |
| Lynis 같은 점검 도구 들이기         | 항목이 수백 개다                   | 이 서버에 맞지 않는 항목이 대부분이라, 볼 것을 다시 골라야 한다 |
| 지킬 넷만 읽는 짧은 스크립트 (고름) | 이 서버의 기준 그대로, 언제든 다시 | 넷 밖의 것은 보지 않는다                                        |

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

![ops/audit.sh가 읽는 것](./images/server-hardening-audit-checks.svg '네 영역을 읽기만 하고, 어긋나면 고치는 명령을 같이 찍는다')

SSH 설정은 파일을 읽지 않고 `sshd -T`가 찍는 합친 결과에서 값을 꺼낸다.

```bash
# ops/audit.sh
sshd_value() { sudo sshd -T 2>/dev/null | awk -v key="$1" '$1 == key { print $2; exit }'; }

pw="$(sshd_value passwordauthentication)"
[[ "$pw" == "no" ]] && ok "PasswordAuthentication no" || warn "PasswordAuthentication=${pw:-?} (no여야 한다)"
```

`ok`와 `warn`은 한 줄씩 찍는 함수이고, `warn`은 끝날 때 1로 끝나도록 표시만 남긴다. 그래서 하나가 어긋나도 나머지를 끝까지 본다. `set -e`를 쓰지 않은 것도 그 때문이다.

## 첫 실행에서 고친 두 곳

서버에서 돌려 보니 스크립트가 틀린 곳이 둘 있었다([#186](https://github.com/hyeoniverse/MacFolio/pull/186)).

- **루프백 DNS를 바깥 포트로 셌다.** 처음 정규식은 `127.0.0.1`만 뺐다. Ubuntu의 systemd-resolved는 `127.0.0.53`·`127.0.0.54`의 53번에서 듣는다. 그래서 목록에 올라왔고, 이를 넘기려고 `:53`을 통째로 빼 두었는데 그러면 바깥에 열린 DNS도 놓친다. 루프백 대역 전체(`127.`)를 빼고 `:53` 예외는 지웠다.
- **cloudflared의 사용자를 읽지 못했다.** 처음에는 `docker exec … id -un`으로 물었는데, cloudflared 이미지는 셸도 `id`도 없는 distroless 이미지라 `?`가 나왔다. 이미지가 정한 사용자를 `docker inspect --format '{{.Config.User}}'`로 읽게 바꿨다. 숫자 65532는 distroless의 `nonroot`라 이름으로 바꿔 찍는다.

```bash
user="$(docker inspect --format '{{.Config.User}}' "$cid" 2>/dev/null)"
user="${user%%:*}"
[[ -z "$user" ]] && user="$(docker exec "$cid" id -un 2>/dev/null || echo root)"
[[ "$user" == "65532" ]] && user=nonroot
```

같은 PR에서 방화벽 확인에 nftables도 더했다. ufw가 켜져 있으면 ufw를, 아니면 iptables의 22번 허용 규칙을, 그것도 없으면 nft 규칙을 본다.

## 알게 된 것

- `api`는 Dockerfile 끝의 `USER node`로 이미 root가 아니었다. `cloudflared` 이미지도 기본이 `nonroot`다. `postgres`는 시작할 때만 root였다가 `postgres`로 내려가므로 `docker exec … id`가 root로 나올 수 있어서 둘 다 OK로 친다
- `ubuntu` 계정이 `docker` 그룹에 있으면 그 계정은 사실상 root다 (컨테이너에 호스트 디스크를 마운트하면 된다). 그래서 SSH 키가 곧 서버 전체의 열쇠이고, 키로만 받는 것이 가장 중요하다
- 비밀번호 질문은 `PasswordAuthentication` 말고 `KbdInteractiveAuthentication`로도 올 수 있어서 둘 다 `no`인지 본다
- fail2ban이나 SSH 포트 바꾸기는 두지 않았다. 키로만 받으면 무작위 시도는 로그만 남긴다
- 컨테이너가 `privileged`로 뜨지 않았는지, `docker.sock`을 마운트한 컨테이너가 없는지도 본다. 둘 다 컨테이너 안에서 호스트 root와 같은 힘을 갖게 한다

## 처음 돌렸을 때

서버에서 `cd ~/macfolio && git pull && ops/audit.sh`를 처음 돌리자 두 항목이 `확인`으로 나왔다.

- **[포트]** 111번(rpcbind)이 바깥에서 듣고 있었다. Oracle Ubuntu 이미지가 NFS용으로 켜 두는 것이다. `sudo systemctl disable --now rpcbind.socket rpcbind.service`를 하자 "triggering units are still active"라는 경고가 나와서 꺼진 것인지 헷갈렸고, `sudo reboot`로 다시 띄운 뒤 `docker compose ps`로 컨테이너 셋이 다시 healthy인지 봤다
- **[컨테이너]** cloudflared의 사용자가 `?`로 나오고 `exec: "sh": executable file not found`가 찍혔다. 셸이 없는 distroless 이미지라 그렇다. 이것이 위 '첫 실행에서 고친 두 곳'의 두 번째다

방화벽은 `sudo iptables -S INPUT`으로 22번 허용 규칙이 있는 것을 같이 봤다. 스크립트를 고친 PR을 받은 뒤 다시 돌려 **모두 OK**를 확인했다.

## 따라 하는 방법

```bash
cd ~/macfolio && git pull
ops/audit.sh             # 확인 항목이 있으면 1로 끝난다
```

`확인`이 나오면 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '서버 하드닝 점검' 표대로 손보고 다시 돌린다. 스크립트가 못 보는 Oracle 쪽 방화벽은 콘솔의 VCN → Subnet → Security Lists → Ingress Rules에서 `22/tcp` 하나만 열려 있는지 본다. 출력에는 계정 이름과 듣는 주소가 들어 있으니 어디에도 올리지 않는다. 스크립트: [ops/audit.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/audit.sh).

참고 문서: [OCI Security Lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm), [Ubuntu 자동 보안 업데이트](https://documentation.ubuntu.com/server/how-to/software/automatic-updates/), [Docker 보안](https://docs.docker.com/engine/security/).

## 남은 것과 배운 것

- **Security List는 스크립트가 못 본다.** Oracle 콘솔의 방화벽은 서버 밖에 있다. 스크립트는 "콘솔에서 22만 여는지 확인한다"는 안내만 찍는다. Oracle API로 읽으려면 이 점검을 위한 API 키가 하나 더 필요하다.
- **언제 돌리나.** 지금은 서버 설정을 바꾼 뒤 손으로 돌린다. cron으로 매주 돌려 결과를 메일로 받게 하면 잊을 일이 없다.
- **점검 스크립트도 틀린다.** 서버에서 돌려 보고 고친 두 곳은 모두 스크립트 쪽 실수였다. 처음 돌릴 때는 결과와 함께 스크립트도 의심해야 한다.
- **문장 대신 명령.** "SSH는 키로만"이라는 문장은 확인할 수 없지만 `sshd -T`의 한 줄은 지금 상태를 말한다.

관련 글: [리팩터링 7단계 — 보안](/memo/refactor-step7-security) · [되돌리기 훈련](/memo/rollback-drill) · [서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게](/memo/server-uptime-and-logs). PR: [#183](https://github.com/hyeoniverse/MacFolio/pull/183), [#186](https://github.com/hyeoniverse/MacFolio/pull/186).

#MacFolio #보안 #서버 #SSH #Docker

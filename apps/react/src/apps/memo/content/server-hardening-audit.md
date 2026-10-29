---
title: 서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기
date: 2026-10-10
category: 개발 기록/MacFolio/품질
series: 서버 운영
seriesOrder: 6
summary: "SSH는 키로만, 열린 포트는 22뿐, 컨테이너는 root가 아닌 사용자로, 보안 업데이트는 자동으로." 이 네 가지를 문서에 적는 대신 ops/audit.sh가 서버 상태를 읽어 OK/확인을 출력하게 했다. 첫 실행에서 스크립트 쪽 오류 두 가지(루프백 DNS, distroless 사용자)를 수정했다.
---

이 글은 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 마지막 보안 항목 "서버: SSH는 키만, 방화벽 포트 목록, 컨테이너를 root가 아닌 사용자로 실행하는지 확인하고 문서에 남기기"를 처리한 기록이다.

## 서버의 외부 노출 범위

MacFolio의 API 서버는 Oracle 무료 VM 한 대다. 외부에서 접근할 수 있는 경로는 SSH(22) 하나뿐이다. API는 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)이 서버에서 **외부로** 연결을 맺고 요청이 그 연결로 전달되므로 80·443을 열 필요가 없다. `compose.yml`에는 `ports:`가 하나도 없어서 DB와 API 모두 호스트 포트를 열지 않는다. 그래서 유지해야 할 조건은 네 가지로 줄어든다.

![서버에 닿는 길은 SSH 22번뿐이고 API는 밖으로 건 터널로 요청을 받는 구조](./images/server-hardening-audit-exposure.svg '80·443이 닫혀 있어도 API가 동작하는 이유는 터널이 서버에서 밖으로 연결을 걸기 때문이다')

1. SSH는 키로만 접속 (비밀번호 인증 없음)
2. 외부에서 수신 대기하는 포트는 22뿐
3. 컨테이너는 root가 아닌 사용자로 실행
4. 보안 업데이트는 자동 설치

<details>
<summary>용어 정리</summary>

- **`sshd -T`**: SSH 서버가 실제로 적용 중인 설정을 모두 출력한다. `sshd_config`와 `sshd_config.d/*.conf`가 겹칠 때 어느 값이 적용되는지 파일만 읽어서는 판단하기 어려운데, 이 명령은 병합된 결과를 출력한다.
- **`ss -lntu`**: 현재 수신 대기 중인 TCP·UDP 소켓 목록. `0.0.0.0`이나 `[::]`에서 수신 대기하면 외부에 열린 것이고, `127.0.0.1`은 서버 내부에서만 접근할 수 있다.
- **unattended-upgrades**: Ubuntu가 보안 패키지를 자동으로 내려받아 설치하는 기능. 활성화하면 `apt upgrade`를 수동으로 실행하지 않아도 보안 패치가 적용된다.
- **Security List**: Oracle Cloud의 네트워크 방화벽. 서버 안의 iptables와 별개로, 클라우드 네트워크 단계에서 먼저 트래픽을 필터링한다.
- **distroless**: 셸과 패키지 관리자 없이 실행에 필요한 파일만 담은 컨테이너 이미지.

</details>

## 문서 대신 스크립트

점검 결과를 기록하는 방법을 비교하면 다음과 같다.

| 방법                                                   | 장점                                      | 단점                                                                    |
| ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| 문서에 "확인했다"고 기록                               | 즉시 끝난다                               | 기록한 날짜에만 유효하다. 이후 설정이 바뀌어도 문서에는 반영되지 않는다 |
| [Lynis](https://cisofy.com/lynis/) 같은 점검 도구 도입 | 점검 항목이 수백 개다                     | 이 서버에 맞지 않는 항목이 대부분이라 확인할 항목을 다시 선별해야 한다  |
| 네 가지만 읽는 짧은 스크립트 (**채택**)                | 이 서버의 기준 그대로, 언제든 재실행 가능 | 네 가지 밖의 항목은 검사하지 않는다                                     |

처음에는 "확인했다"고 문서에 기록하려 했다. 그러나 그 문장은 기록한 날짜에만 유효하다. 누군가 `compose.yml`에 `ports`를 추가하거나 Dockerfile의 `USER node`를 삭제해도 문서에는 반영되지 않는다. 그래서 `ops/audit.sh`를 작성했다. 서버에서 실행하면 네 가지를 읽어 항목마다 `OK`/`확인`을 출력하고, `확인`이 하나라도 있으면 종료 코드 1로 끝난다. 설정은 하나도 변경하지 않는다.

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

문서(`docs/deployment.md`의 '서버 하드닝 점검')에는 기대하는 상태와, 상태가 다를 때의 수정 방법만 표로 기록했다.

![ops/audit.sh가 읽는 것](./images/server-hardening-audit-checks.svg '네 영역을 읽기만 하고, 어긋나면 고치는 명령을 같이 찍는다')

SSH 설정은 파일을 직접 읽지 않고 `sshd -T`가 출력하는 병합 결과에서 값을 추출한다.

```bash
# ops/audit.sh
sshd_value() { sudo sshd -T 2>/dev/null | awk -v key="$1" '$1 == key { print $2; exit }'; }

pw="$(sshd_value passwordauthentication)"
[[ "$pw" == "no" ]] && ok "PasswordAuthentication no" || warn "PasswordAuthentication=${pw:-?} (no여야 한다)"
```

`ok`와 `warn`은 한 줄씩 출력하는 함수이고, `warn`은 종료 코드를 1로 만들 표시만 남긴다. 그래서 한 항목이 실패해도 나머지 항목을 끝까지 검사한다. `set -e`를 쓰지 않은 이유도 같다.

## 첫 실행에서 수정한 두 곳

서버에서 실행해 보니 스크립트 쪽 오류가 두 가지 있었다([#186](https://github.com/hyeoniverse/MacFolio/pull/186)).

| 증상                              | 원인                                                                                                                                                                                                       | 수정                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 루프백 DNS를 외부 포트로 집계     | 처음 정규식은 `127.0.0.1`만 제외했다. Ubuntu의 systemd-resolved는 `127.0.0.53`·`127.0.0.54`의 53번에서 수신 대기한다. 이를 제외하려고 `:53`을 통째로 빼 두었는데, 그러면 외부에 열린 DNS도 검출하지 못한다 | 루프백 대역 전체(`127.`)를 제외하고 `:53` 예외는 삭제                                                                                    |
| cloudflared의 사용자를 `?`로 출력 | `docker exec … id -un`으로 조회했는데, cloudflared 이미지는 셸도 `id`도 없는 distroless 이미지다                                                                                                           | 이미지에 지정된 사용자를 `docker inspect --format '{{.Config.User}}'`로 읽는다. 숫자 65532는 distroless의 `nonroot`라 이름으로 바꿔 출력 |

```bash
user="$(docker inspect --format '{{.Config.User}}' "$cid" 2>/dev/null)"
user="${user%%:*}"
[[ -z "$user" ]] && user="$(docker exec "$cid" id -un 2>/dev/null || echo root)"
[[ "$user" == "65532" ]] && user=nonroot
```

같은 PR에서 방화벽 확인에 nftables도 추가했다. 검사 순서는 다음과 같다.

1. ufw가 활성화되어 있으면 ufw 규칙
2. 아니면 iptables의 22번 허용 규칙
3. 그것도 없으면 nft 규칙

## 점검에서 확인한 사실

- `api`는 Dockerfile 끝의 `USER node`로 이미 root가 아니었다. `cloudflared` 이미지도 기본 사용자가 `nonroot`다. `postgres`는 시작 시각에만 root로 실행되고 이후 `postgres` 사용자로 전환되므로 `docker exec … id`가 root로 출력될 수 있어서, 두 경우 모두 OK로 처리한다.
- `ubuntu` 계정이 `docker` 그룹에 속하면 그 계정은 사실상 root 권한을 가진다(컨테이너에 호스트 디스크를 마운트할 수 있다). 그래서 SSH 키가 서버 전체에 대한 접근 수단이고, 키 인증만 허용하는 설정이 가장 중요하다.
- 비밀번호 입력 요청은 `PasswordAuthentication` 외에 `KbdInteractiveAuthentication`으로도 발생할 수 있어 둘 다 `no`인지 확인한다.
- fail2ban 도입과 SSH 포트 변경은 적용하지 않았다. 키 인증만 허용하면 무작위 대입 시도는 로그에만 남는다.
- 컨테이너가 `privileged`로 실행되지 않았는지, `docker.sock`을 마운트한 컨테이너가 없는지도 확인한다. 둘 다 컨테이너 안에서 호스트 root와 같은 권한을 얻게 한다([Docker 보안 문서](https://docs.docker.com/engine/security/)).

## 첫 실행 결과

서버에서 `cd ~/macfolio && git pull && ops/audit.sh`를 처음 실행하자 두 항목이 `확인`으로 출력됐다.

- **[포트]** 111번(rpcbind)이 외부에서 수신 대기하고 있었다. Oracle Ubuntu 이미지가 NFS용으로 활성화해 두는 서비스다. `sudo systemctl disable --now rpcbind.socket rpcbind.service`를 실행하자 "triggering units are still active" 경고가 출력되어 중지 여부를 판단하기 어려웠다. 그래서 `sudo reboot`로 재부팅한 뒤 `docker compose ps`로 컨테이너 3개가 다시 healthy 상태인지 확인했다.
- **[컨테이너]** cloudflared의 사용자가 `?`로 출력되고 `exec: "sh": executable file not found`가 함께 출력됐다. 셸이 없는 distroless 이미지이기 때문이다. 위 '첫 실행에서 수정한 두 곳'의 두 번째 항목이다.

방화벽은 `sudo iptables -S INPUT`으로 22번 허용 규칙이 있는지 함께 확인했다. 스크립트를 수정한 PR을 병합한 뒤 다시 실행해 **모두 OK**인 것을 확인했다.

## 따라 하는 방법

```bash
cd ~/macfolio && git pull
ops/audit.sh             # 확인 항목이 있으면 1로 끝난다
```

`확인`이 출력되면 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '서버 하드닝 점검' 표에 따라 설정을 수정하고 다시 실행한다. 스크립트가 검사하지 못하는 Oracle 쪽 방화벽은 콘솔의 VCN → Subnet → Security Lists → Ingress Rules에서 `22/tcp` 하나만 열려 있는지 확인한다. 출력에는 계정 이름과 수신 대기 주소가 포함되므로 외부에 공개하지 않는다. 스크립트: [ops/audit.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/audit.sh).

참고 문서: [OCI Security Lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm), [Ubuntu 자동 보안 업데이트](https://documentation.ubuntu.com/server/how-to/software/automatic-updates/), [Docker 보안](https://docs.docker.com/engine/security/).

## 남은 과제와 정리

- **Security List는 스크립트로 검사할 수 없다.** Oracle 콘솔의 방화벽은 서버 외부에 있다. 스크립트는 "콘솔에서 22번만 열려 있는지 확인한다"는 안내만 출력한다. Oracle API로 조회하려면 이 점검용 API 키가 추가로 필요하다.
- **실행 시점.** 현재는 서버 설정을 변경한 뒤 수동으로 실행한다. cron으로 매주 실행해 결과를 메일로 수신하면 누락을 방지할 수 있다.
- **점검 스크립트에도 오류가 있을 수 있다.** 서버에서 실행해 수정한 두 곳은 모두 스크립트 쪽 오류였다. 첫 실행 결과는 서버 상태와 스크립트 양쪽을 검증해야 한다.
- **문장 대신 명령.** "SSH는 키로만"이라는 문장은 현재 상태를 보장하지 않지만, `sshd -T`가 출력하는 한 줄은 현재 상태를 그대로 보여 준다.

## 관련 글

- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-step7-security)
- [되돌리기 훈련](/memo/rollback-drill)
- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)

PR: [#183](https://github.com/hyeoniverse/MacFolio/pull/183), [#186](https://github.com/hyeoniverse/MacFolio/pull/186)

#MacFolio #보안 #서버 #SSH #Docker

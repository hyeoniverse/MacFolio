---
title: SSH가 시간 초과되던 이유 — 기억한 IP가 삭제한 임시 VM의 주소였다
date: 2026-10-23
category: 개발기/MacFolio/인프라
summary: 서버에 scp로 키를 옮기려는데 Operation timed out이 났다. 보안 목록은 열려 있었고 GitHub Actions 배포는 성공했다. 네트워크, 통신사 경로, 서버 설정을 차례로 배제하자 원인은 접속 주소였다. SSH 키를 복구하면서 만든 임시 VM의 IP를 서버 주소로 기억하고 있었다. 확인 명령과 재발 방지 설정을 정리했다.
---

## 해결 방법

`ssh`·`scp`가 `Operation timed out`인데 서버의 다른 기능(API, 자동 배포)은 정상이라면, 먼저 **접속하는 IP가 서버의 현재 공인 IP인지** 확인한다.

```bash
# Oracle Cloud Shell (콘솔 오른쪽 위 >_)
ID=$(oci search resource structured-search --query-text "query instance resources" \
  --query 'data.items[0].identifier' --raw-output)
oci compute instance list-vnics --instance-id "$ID" \
  --query 'data[].{public:"public-ip",private:"private-ip",nsg:"nsg-ids"}' --output table
```

콘솔에서는 **Compute → Instances → 서버 → Networking → Primary VNIC의 Public IPv4 address**에 있다. 이 값이 접속하던 주소와 다르면 이 주소로 접속하면 된다.

재발을 막는 설정은 두 가지다.

| 설정                               | 하는 곳        | 효과                                                                                           |
| ---------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `~/.ssh/config` 별칭               | 내 컴퓨터      | 서버 IP를 한 곳에만 기록하고 `ssh macfolio`로 접속한다. 기억이나 터미널 기록에 의존하지 않는다 |
| 예약된 공인 IP(Reserved public IP) | VNIC의 IP 화면 | 서버를 중지·시작해도 IP가 바뀌지 않는다. Always Free 계정에서도 1개 무료                       |

```text
Host macfolio
  HostName <현재 공인 IP>
  User ubuntu
  IdentityFile ~/.ssh/oracle-macfolio.key
  IdentitiesOnly yes
```

서버 IP가 실제로 바뀐 경우에는 GitHub Secrets의 `DEPLOY_HOST`와 `DEPLOY_KNOWN_HOSTS`도 함께 갱신해야 API 자동 배포가 동작한다.

## 상황

[Search Console 검색어 탭을 연결](/memo/search-console-setup)하면서 서비스 계정 키를 서버로 옮기려고 했다.

```text
$ scp ~/Downloads/<키>.json ubuntu@198.51.100.10:~/deploy/gsc.json
ssh: connect to host 198.51.100.10 port 22: Operation timed out
```

이 글의 IP는 모두 문서용 예시 주소다[^doc-ip]. `198.51.100.10`이 서버 주소로 알고 있던 주소, `203.0.113.20`이 서버의 실제 주소다.

`Operation timed out`은 `Connection refused`와 다르다. refused는 서버까지 도달했지만 그 포트에서 듣는 프로그램이 없다는 뜻이고, timed out은 **응답이 아예 오지 않았다**는 뜻이다. 그래서 sshd 설정보다 네트워크 경로나 방화벽, 주소를 먼저 의심한다([Oracle 문서: SSH 연결 문제 해결](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/troubleshooting-ssh-connection.htm)).

## 원인을 좁힌 순서

![SSH 시간 초과 원인 좁히기](./images/ssh-timeout-public-ip-diagnosis.svg '같은 주소를 여러 곳에서 시도하고, 성공한 경로와 실패한 경로를 비교해 원인을 하나씩 배제했다')

| 순서 | 확인                             | 결과                               | 배제한 원인                    |
| ---- | -------------------------------- | ---------------------------------- | ------------------------------ |
| 1    | Oracle 보안 목록의 Ingress Rules | `0.0.0.0/0` TCP 22 허용            | 클라우드 방화벽                |
| 2    | API `/health`                    | `status: ok`, 최신 버전            | 서버가 꺼진 경우               |
| 3    | 최근 CI의 `api-deploy`           | 성공 (GitHub Actions가 SSH로 접속) | sshd, 서버 방화벽              |
| 4    | Mac에서 `nc -zv github.com 22`   | 연결됨                             | 이 네트워크가 22번을 막는 경우 |
| 5    | 휴대폰 핫스팟에서 같은 주소      | 시간 초과                          | 특정 통신사 경로               |
| 6    | Oracle Cloud Shell에서 같은 주소 | 시간 초과                          | 한국에서 Oracle까지의 경로     |
| 7    | Cloud Shell에서 VNIC 조회        | 공인 IP가 다른 주소                | **원인: 접속 주소**            |

3번이 단서였다. GitHub Actions는 Secrets의 `DEPLOY_HOST`로 SSH 접속해 배포하는데, 이 배포가 그날 성공했다. 즉 sshd와 22번 포트는 정상이고, 인터넷에서 들어갈 수 있다. 그런데 6번에서 Oracle 네트워크 안(같은 도쿄 리전의 Cloud Shell)에서도 실패했다. 경로 문제라면 Oracle 내부에서는 연결되어야 하므로, 남는 차이는 **Actions와 내가 접속한 주소가 다르다**는 것뿐이었다.

처음에는 "IP는 바뀌지 않았다"고 판단해 주소를 의심하지 않았다. 판단 자체는 맞았다. 서버 IP는 바뀌지 않았고, 처음부터 다른 주소를 서버 주소로 알고 있었다.

<details>
<summary>중간에 의심했다가 배제한 것</summary>

- **Mac에서 실행 중인 Docker**: 로컬 컨테이너는 Mac에서 바깥으로 나가는 SSH 연결에 영향을 주지 않는다. 확인해 보니 실행 중인 컨테이너도 없었다
- **traceroute**: 국내망을 지나 해외 백본까지는 응답이 있고 그 뒤로는 없었다. Oracle은 이런 추적 패킷에 원래 응답하지 않아서, 어디서 막혔는지 판단하는 근거가 되지 못했다
- **네트워크 보안 그룹(NSG)**: VNIC 조회 결과 `nsg`가 빈 목록이었다. 보안 목록 하나만 적용된다

</details>

## 그 주소는 어디서 왔나

Mac의 `~/.ssh/known_hosts`에 답이 있었다. 접속한 적 있는 서버의 주소와 호스트 키가 처음 접속한 순서대로 기록되는 파일이다.

```text
$ awk '{print NR": "$1" "$2}' ~/.ssh/known_hosts
1: 198.51.100.10 ssh-ed25519
2: 198.51.100.10 ssh-rsa
3: 198.51.100.10 ecdsa-sha2-nistp256
4: 203.0.113.20 ssh-ed25519
```

이 파일은 10월 20일에 새로 만들어졌다. 그날 Mac을 초기화하면서 SSH 키를 잃어버렸고, [서버를 되살리는](/memo/oracle-ssh-key-recovery) 순서는 이랬다.

| 순서 | 한 일                                               | 접속한 주소                          |
| ---- | --------------------------------------------------- | ------------------------------------ |
| 1    | 새 키로 **임시 VM**을 만들고 접속 확인              | `198.51.100.10` (known_hosts 1\~3행) |
| 2    | 원래 서버의 부트 볼륨을 임시 VM에 연결해 새 키 추가 | 임시 VM                              |
| 3    | 부트 볼륨을 원래 서버로 되돌리고 접속               | `203.0.113.20` (4행)                 |
| 4    | 임시 VM 삭제                                        | -                                    |

복구 작업 내내 임시 VM에 접속하느라 그 주소를 반복해서 입력했고, 그 주소를 서버 주소로 기억하게 되었다. 원래 서버의 IP는 바뀌지 않았다. 10월 5일에 등록한 `DEPLOY_HOST`로 지금도 배포가 성공하는 것이 근거다. API는 Cloudflare Tunnel로, 배포는 Secrets의 주소로 접속하므로, 사람이 직접 접속하기 전까지는 드러나지 않았다.

참고로 인스턴스를 만들 때 **Automatically assign public IPv4 address**로 붙는 주소는 임시(Ephemeral) 공인 IP[^ephemeral]라, 서버를 중지했다 시작하면 실제로 바뀔 수도 있다. 이번 원인은 아니었지만, 해결 방법의 예약 IP 설정은 그 경우를 막는다.

## 돌아보며

**기억한 값으로 판단하지 않는다.** 보안 목록을 확인하고, 통신사를 바꾸고, 다른 리전에서도 시도했지만, 접속하는 주소가 맞는지는 마지막에 확인했다. "IP는 바뀌지 않았다"는 판단은 맞았지만, 기억하던 주소가 처음부터 서버 주소가 아니었다. 접속 주소처럼 바뀔 수 있는 값은 콘솔이나 CLI에서 조회한 값으로 확인한다. [배포 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md#3-oracle-vm-만들기)에 공인 IP 확인 명령과 별칭 설정을 추가했다.

**성공하는 경로와 실패하는 경로를 비교한다.** GitHub Actions가 성공한다는 사실 하나로 서버 쪽 원인을 모두 배제할 수 있었다. 무엇이 다른지(주소)를 찾는 쪽이 실패 원인을 하나씩 의심하는 쪽보다 빨랐다.

## 관련 글

- [SSH 키를 잃어버린 Oracle 서버 되살리기 — 임시 VM이 원래 서버 디스크로 부팅됐다](/memo/oracle-ssh-key-recovery): 임시 VM의 주소를 서버 주소로 기억하게 된 작업
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel): API가 IP와 상관없이 동작하는 이유
- [자동 배포를 실제 서버에 적용하기 - 막힌 곳 다섯](/memo/api-auto-deploy-setup): `DEPLOY_HOST`·`DEPLOY_KNOWN_HOSTS`를 설정한 글
- [Google Search Console 연결하기 — 사이트 등록, 사이트맵 제출, 검색어 탭](/memo/search-console-setup): 이 문제를 만난 작업

## 참고한 공식 문서

- [Oracle Cloud: Troubleshooting the SSH Connection](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/troubleshooting-ssh-connection.htm)
- [Oracle Cloud: Public IP Addresses](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingpublicIPs.htm) (임시 IP와 예약 IP)

[^doc-ip]: `198.51.100.0/24`, `203.0.113.0/24`는 문서와 예제에 쓰도록 예약된 주소 범위다([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737)). 실제 서버 주소는 글에 적지 않는다.

[^ephemeral]: Oracle Cloud의 공인 IP는 두 종류다. 임시(Ephemeral) IP는 인스턴스의 VNIC에 묶여 수명이 같고, 예약된(Reserved) IP는 계정에 남아 있어 다른 VNIC로 옮기거나 다시 붙일 수 있다.

#MacFolio #서버 #SSH #트러블슈팅

---
title: SSH 키를 잃어버린 Oracle 서버 되살리기 — 임시 VM이 원래 서버 디스크로 부팅됐다
date: 2026-10-20
category: 개발기/MacFolio/인프라
summary: 새 Mac에 서버 SSH 키가 없었다. 비밀번호 계정이 없는 Ubuntu 서버라 시리얼 콘솔도 못 쓰고, 부트 볼륨을 임시 VM에 붙여 키를 넣기로 했다. 그런데 임시 VM이 원래 서버 디스크로 부팅돼 cloud-init이 키를 대신 넣었다. 그 과정과 되돌린 뒤 할 일을 적었다.
---

로컬 API의 `.env`를 잃어버렸다. 서버의 `~/deploy/api.env`에 배포 값이 다 있으니 가져와서 로컬에 맞는 값만 고치면 된다. 그래서 문서에 적어 둔 명령을 그대로 쳤다.

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<서버 IP> 'cat ~/deploy/api.env' > .env.production
Warning: Identity file ~/.ssh/oracle-macfolio.key not accessible: No such file or directory.
```

새 Mac에는 `~/.ssh` 폴더부터 없었다. 다운로드·데스크톱·문서 폴더를 Spotlight로 뒤져도, Time Machine을 봐도 키가 없었다.

```text
$ ls ~/.ssh
ls: ~/.ssh: No such file or directory
$ tmutil destinationinfo
tmutil: No destinations configured.
```

`.env` 하나를 찾다가 서버 접속을 통째로 잃어버린 상태라는 것을 알게 됐다.

## 다시 받을 수 없는 이유

Oracle에서 VM을 만들 때 **Download private key**로 받은 비밀 키는 그 화면에서 한 번만 받을 수 있다. Oracle도 사본을 갖고 있지 않고, 서버에는 공개 키만 있다. 그러니 비밀 키를 "다시 받는" 방법은 없다. 할 수 있는 것은 **새 키를 만들어 서버의 `~/.ssh/authorized_keys`에 등록하는** 것뿐이다. 문제는 들어가지 못하는 서버에 그 한 줄을 어떻게 넣느냐다.

배포 문서에는 "키를 잃어버리면 Oracle 콘솔의 **Console connection**으로 들어가 `authorized_keys`를 바꾼다"고 적어 두었다. 그런데 이 서버에서는 안 된다. 시리얼 콘솔은 접속까지는 되지만 OS 로그인 화면에서 사용자 이름과 **비밀번호**를 묻는다. 이 서버는 하드닝 점검(`ops/audit.sh`)에서 "비밀번호 있는 계정 0"을 기대하도록 만들어 두었다. 그래서 그 화면에서 넣을 비밀번호가 없다. 보안을 위해 막아 둔 문이 복구할 때도 막혀 있었다.

GitHub Actions가 쓰는 배포 키도 대신할 수 없다. 그 키는 `authorized_keys`에 `restrict,command="…/ops/deploy.sh"`로 묶여 있어서, 무엇을 보내든 배포 스크립트만 돈다.

## 계획: 디스크를 떼어 다른 VM에서 고친다

Oracle이 안내하는 방법은 이렇다.

1. 이 Mac에서 새 키를 만든다 (`ssh-keygen -t ed25519`)
2. 같은 가용 도메인에 작은 임시 VM을 만든다. 만들 때 **Paste public keys**에 새 공개 키를 넣어, 임시 VM에는 새 키로 들어갈 수 있게 한다
3. 원래 서버를 멈추고 부트 볼륨을 떼어, 임시 VM에 **두 번째 디스크**로 붙인다
4. 임시 VM에서 그 디스크를 마운트하고 `home/ubuntu/.ssh/authorized_keys`에 새 공개 키 한 줄을 덧붙인다
5. 떼어서 원래 서버에 부트 볼륨으로 되돌리고 켠다

임시 VM은 원래 서버와 같은 무료 shape(`VM.Standard.E2.1.Micro`, 2대까지 무료)로 만들었다. 지금 서버가 한 대라 임시 VM까지 무료 한도 안이다.

### 화면 대신 Cloud Shell로 붙였다

3에서 막혔다. 임시 VM 화면의 **Attach block volume** 버튼이 회색이었고, 툴팁에도 이유가 나오지 않았다. 그래서 콘솔 안의 터미널인 Cloud Shell에서 OCI CLI로 붙였다.

```bash
oci compute volume-attachment attach --type paravirtualized \
  --instance-id "$RESCUE" --volume-id "$OLDVOL"
```

여기서도 몇 번 헛디뎠다.

| 증상                                                 | 원인                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 무엇을 쳐도 `Invalid command, try again.`            | Cloud Shell을 처음 열면 안내 투어가 뜨는데, 투어는 정해진 명령만 받는다. Ctrl+C로 빠져나와 프롬프트가 `…@cloudshell:~ (리전)$`이 된 뒤 친다 |
| 부트 볼륨 목록에서 둘 다 `AVAILABLE`                 | `AVAILABLE`은 "볼륨이 정상"이라는 뜻이지 "어디에도 안 붙음"이 아니다. 붙어 있는지는 `boot-volume-attachment list`로 본다                    |
| `MissingParameter` (400)                             | 변수(`$RESCUE`·`$OLDVOL`)가 비어 빈 값이 서버로 갔다. `echo "[$OLDVOL]"`처럼 괄호로 감싸 찍어 보고 다시 담으니 넘어갔다                     |
| `volumeId is invalid or incorrectly formatted` (400) | 손으로 복사한 OCID가 잘못됐다. 표에서 복사하지 않고 `--query … --raw-output`으로 OCID만 뽑아 담으니 넘어갔다                                |
| `Conflict: Volume … currently attached` (409)        | 이미 붙어 있었다. 앞선 시도 가운데 하나가 실제로는 들어갔던 것이다. `volume-attachment list --instance-id "$RESCUE"`에 `ATTACHED`로 나왔다  |
| `lsblk`에 `/home/<계정>`만 보임                      | `lsblk`를 Cloud Shell에서 쳤다. Cloud Shell 자기 디스크다. 디스크는 임시 VM 안에서 봐야 한다                                                |

마지막 줄처럼, 이번 작업에서는 창이 세 개(Mac, Cloud Shell, 임시 VM)라 명령을 엉뚱한 창에 친 일이 여러 번 있었다. 칠 때마다 프롬프트의 맨 앞을 봤어야 했다.

## 예상 밖: 임시 VM이 원래 서버 디스크로 떠 있었다

붙인 것을 확인하려고 임시 VM에 다시 들어가자 경고가 떴다.

```text
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
...
Host key verification failed.
```

몇 분 전에 처음 접속하며 저장한 임시 VM의 호스트 키와, 지금 그 주소가 내미는 키가 ED25519·ECDSA 둘 다 달랐다. 원래 서버의 호스트 키와도 달랐다. 누가 가로챈 것보다는, 같은 주소의 VM이 재부팅되면서 호스트 키를 새로 만든 쪽이 그럴듯했다. 옛 기록을 지우고(`ssh-keygen -R`) 들어가서, 아무것도 고치지 않고 상태부터 봤다.

```text
$ hostname; uptime -s; findmnt -n -o SOURCE /; lsblk -o NAME,SIZE,MOUNTPOINT,LABEL
macfolio-vnic-7712
2026-10-20 08:54:34
/dev/sdb1
NAME     SIZE MOUNTPOINT                   LABEL
...
sda     46.6G
├─sda1  45.6G                              cloudimg-rootfs
├─sda14    4M
├─sda15  106M /boot/efi                    UEFI
└─sda16  913M /boot                        BOOT
sdb     46.6G
├─sdb1  45.6G /                            cloudimg-rootfs
├─sdb14    4M
├─sdb15  106M                              UEFI
└─sdb16  913M                              BOOT
```

`/`가 `sdb1`이다. 임시 VM은 17:54:34(UTC 08:54:34)에 재부팅됐다. 그때 **붙여 둔 원래 서버 디스크를 루트로 잡고** 떠 있었다. `/boot`와 `/boot/efi`만 임시 VM 자기 디스크(`sda`)에서 왔다. 왜 그 시각에 재부팅됐는지는 확인하지 못했다.

![임시 VM이 원래 서버 디스크로 부팅된 과정](./images/oracle-ssh-key-recovery-boot.svg '두 디스크의 루트 이름표(cloudimg-rootfs)가 같아 sdb1이 /로 잡혔고, cloud-init이 이를 새 VM의 첫 부팅으로 처리했다')

두 디스크가 같은 Ubuntu 이미지에서 나와서, 루트 파티션의 이름표(`LABEL=cloudimg-rootfs`)가 같다. 부팅할 때 이 이름표로 루트를 찾으면 둘 중 어느 쪽이 잡힐지 보장이 없다. 이번에는 원래 서버 쪽이 잡혔다.

정말 원래 서버의 OS인지 확인했다.

```text
$ ls ~/deploy
api.env  backup.env  backup.log  compose.yml  compose.yml.bak  deploy.log
$ docker ps --format '{{.Names}} {{.Status}}'
macfolio-api-1 Up 5 minutes (healthy)
macfolio-tunnel-1 Up 5 minutes
macfolio-db-1 Up 5 minutes (healthy)
$ grep -c . ~/.ssh/authorized_keys
3
```

배포 폴더가 있고, 컨테이너 셋이 떠 있다. 원래 서버가 꺼져 있었으니 터널은 임시 VM에서 Cloudflare로 붙었다. 그래서 그동안 사이트 API는 **임시 VM 위에서** 돌고 있었다. Mac에서 `/health`를 부르니 200이 왔다.

더 눈에 띈 것은 `authorized_keys`가 세 줄이라는 것이다. 잃어버린 옛 키, 배포 키, 그리고 **새 공개 키**였다. 4단계(키 덧붙이기)를 하기도 전에 새 키가 이미 들어가 있었다.

### cloud-init이 대신 해 준 일

Ubuntu 클라우드 이미지는 부팅할 때 cloud-init이 돈다. cloud-init은 VM마다 다른 instance-id를 보고, 처음 보는 id면 "새 VM의 첫 부팅"으로 여겨 그때 할 일을 한다. 그중 둘이 이번 일과 맞아떨어진다.

- 호스트 키를 새로 만든다. 경고가 뜬 이유다
- 메타데이터의 SSH 공개 키를 기본 사용자(`ubuntu`)의 `authorized_keys`에 넣는다. 메타데이터에 든 것은 임시 VM을 만들 때 넣은 새 공개 키다

원래 서버의 OS가 임시 VM의 instance-id로 부팅됐으니, cloud-init이 이 둘을 원래 서버 디스크에 해 준 것으로 보인다. 로그로 하나하나 확인하지는 않았다. 다만 호스트 키가 모두 바뀐 것, 넣지 않은 키가 들어가 있던 것이 이 설명과 맞는다.

목표였던 키 등록은 끝나 있었다. 덤으로, 처음에 가져오려던 `api.env`도 바로 이 디스크에 있었다. Mac에서 새 키로 받았다.

```bash
scp -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>:deploy/api.env apps/api/.env.production
```

## 되돌리기

원래 서버 디스크가 지금 **루트로 쓰이며 DB가 돌고 있으니**, 켜진 채로 떼면 안 된다. 임시 VM을 정상 종료한 뒤 떼었다.

```bash
oci compute instance action --instance-id "$RESCUE" --action SOFTSTOP   # STOP은 전원을 바로 끈다
oci compute volume-attachment detach --volume-attachment-id "$ATT" --force
oci compute boot-volume-attachment attach --instance-id "$ORIG" --boot-volume-id "$OLDVOL"
oci compute instance action --instance-id "$ORIG" --action START
```

켜는 동안 Mac에서 10초마다 `/health`와 22번 포트를 봤다.

```text
18:11:41 health=530 ssh=closed
18:12:18 health=530 ssh=open
18:12:39 health=502 ssh=open
18:13:21 health=200 ssh=open
```

530은 Cloudflare가 터널 너머 서버에 닿지 못할 때, 502는 터널은 붙었는데 API가 아직 준비되지 않았을 때다. 켠 뒤 2분 남짓에 돌아왔다.

### 되돌린 뒤에 바뀌어 있던 것

원래 서버로 돌아가면 cloud-init이 또 한 번 키를 바꾸지 않을까 걱정했다. 그런데 호스트 키는 임시 VM에서 새로 만든 그대로였다. 원래 서버의 instance-id는 처음 만들 때 처리한 기록이 디스크(`/var/lib/cloud`)에 남아 있다. 그래서 cloud-init이 "이미 한 일"로 보고 다시 하지 않은 것으로 보인다. 덕분에 새 공개 키도 그대로 남았다.

호스트 키가 바뀌었으니 할 일이 둘 생겼다.

1. **`DEPLOY_KNOWN_HOSTS` 바꾸기.** GitHub Actions의 API 배포는 이 secret에 고정해 둔 호스트 키로 서버를 확인한다. 옛 키 그대로면 다음 배포가 `Host key verification failed`로 실패한다. 서버 공개 키에 서버 주소를 붙인 한 줄로 바꿨다
   ```bash
   gh secret set DEPLOY_KNOWN_HOSTS --body "$(ssh-keyscan -t ed25519 <서버 IP> 2>/dev/null | grep -v '^#')"
   ```
   여기서 `ssh-keyscan`으로 받은 키는, 임시 VM에 처음 로그인했을 때 확인한 지문과 같았다. 같은 키라는 것을 그렇게 확인했다
2. **잃어버린 옛 키 지우기.** `authorized_keys` 첫 줄의 `ssh-rsa`가 잃어버린 키다. 누가 그 파일을 주우면 들어올 수 있다. 백업을 두고, 첫 줄이 `ssh-rsa`일 때만 지웠다. 지운 뒤에는 열어 둔 창을 닫기 전에 새 탭에서 새 키로 다시 들어가지는지 본다. 안 되면 열어 둔 창에서 백업으로 되돌린다
   ```bash
   cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
   sed -i '1{/^ssh-rsa /d}' ~/.ssh/authorized_keys
   ```

임시 VM은 Terminate했다. 이때 "Permanently delete the attached boot volume"을 체크하면 임시 VM 자기 디스크도 지운다. 원래 서버 디스크는 원래 서버에 붙어 있어서 함께 지워지지 않는다.

## 로컬 `.env`로 돌아와서

처음 목적은 로컬 `.env`였다. 배포 값을 그대로 쓰면 안 되는 키만 골라 고쳤다.

| 키                                         | 로컬에서                    | 이유                                                                                     |
| ------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | `localhost:5432`로 **더함** | 배포에서는 compose가 넣어 줘서 `api.env`에 없다                                          |
| `CORS_ORIGINS`                             | `http://localhost:5173`     | 배포 주소면 로컬 화면이 API에 붙지 못한다                                                |
| `API_URL`, `TRUST_PROXY`                   | 지움                        | OAuth 콜백이 배포 주소로 가고, 로컬에는 프록시가 없다                                    |
| `RESOURCE_MONITOR`                         | 지움                        | 노트북 CPU를 서버 자원으로 기록하고 알림 메일까지 보낸다                                 |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | 비움 → 개발용 OAuth 앱 값   | 배포용 앱은 콜백이 배포 도메인이라, 로컬에서는 GitHub가 `redirect_uri` 오류로 돌려보낸다 |

나머지(AI·번역·R2·메일 키 등)는 그대로 두었다. 대신 로컬에서 메일을 시험하면 진짜 메일이 나가고, 파일을 올리면 실제 버킷에 들어간다.

## 정리

- SSH 비밀 키는 다시 받을 수 없다. 새 키를 만들어 `authorized_keys`에 넣는 것이 복구다
- 비밀번호 계정이 없는 서버는 시리얼 콘솔로도 들어갈 수 없다. 부트 볼륨을 다른 VM에 붙여 고친다
- 같은 이미지에서 나온 두 디스크는 루트 이름표가 같다. 디스크를 붙인 채로 재부팅하면 붙인 디스크로 부팅될 수 있다
- 그렇게 부팅되면 cloud-init이 첫 부팅으로 여겨 호스트 키를 바꾸고 메타데이터의 공개 키를 넣는다. 원래 서버에 되돌려도 그대로 남는다
- 호스트 키가 바뀌면 배포가 쓰는 `DEPLOY_KNOWN_HOSTS`를 바꾸고, 잃어버린 옛 키 줄은 지운다
- 새 비밀 키와 그 암호는 비밀번호 관리자처럼 Mac 밖에도 둔다. Mac을 바꿀 때 `~/.ssh`도 옮길 목록에 넣는다

배포 문서의 키 복구 절차도 이번에 실제로 된 순서로 고쳐 두었다.

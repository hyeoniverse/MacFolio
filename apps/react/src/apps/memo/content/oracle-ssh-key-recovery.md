---
title: SSH 키를 잃어버린 Oracle 서버 되살리기 — 임시 VM이 원래 서버 디스크로 부팅됐다
date: 2026-10-20
category: 개발기/MacFolio/인프라
summary: 새 Mac에 서버 SSH 키가 없었다. 부트 볼륨을 임시 VM에 붙여 새 키를 넣는 순서를 단계별로 정리하고, 키 암호·Cloud Shell·엉뚱한 창에서 친 명령 같은 시행착오와 임시 VM이 원래 서버 디스크로 부팅된 일까지 적었다.
---

로컬 API의 `.env`를 잃어버렸다. 서버의 `~/deploy/api.env`에 배포 값이 다 있으니 가져와서 로컬에 맞는 값만 고치면 된다. 그런데 서버에 들어갈 SSH 키가 새 Mac에 없었다. 이 글은 키 없이 Oracle 서버에 다시 들어가기까지 **한 순서 그대로**와, 그 사이에 헛디딘 곳을 적은 기록이다.

## 전체 순서

| 단계 | 할 일                                       | 어디서                       | 서버 멈춤 |
| ---- | ------------------------------------------- | ---------------------------- | --------- |
| 0    | 키가 정말 없는지 확인                       | Mac                          |           |
| 1    | 복구 방법 고르기                            |                              |           |
| 2    | 새 SSH 키 만들기                            | Mac                          |           |
| 3    | 임시 VM 만들고 접속 확인                    | Oracle 콘솔, Mac             |           |
| 4    | 원래 서버 멈추고 부트 볼륨 떼기             | Oracle 콘솔                  | 여기부터  |
| 5    | 떼어 낸 볼륨을 임시 VM에 붙이기             | Cloud Shell                  | ↓         |
| 6    | 임시 VM에서 새 키 넣기 (실제로는 다르게 됨) | 임시 VM                      | ↓         |
| 7    | 되돌리고 원래 서버 켜기                     | Cloud Shell                  | 여기까지  |
| 8    | 뒤처리: 배포 secret, 옛 키, 임시 VM         | Mac, 원래 서버, GitHub, 콘솔 |           |
| 9    | 처음 목적이던 로컬 `.env`                   | Mac                          |           |

창이 세 개(Mac 터미널, Oracle Cloud Shell, 임시 VM에 접속한 터미널)라서, 단계마다 **어느 창에서 치는지**를 먼저 적었다. 이 구분을 놓쳐서 생긴 시행착오가 가장 많았다.

### Oracle 콘솔 화면 길잡이

콘솔은 메뉴가 깊어서 매번 어디였는지 헤맸다. 아래 경로는 Oracle 공식 문서에 적힌 것이다. 콘솔 화면이 바뀐 버전에 따라 이름이 조금 다를 수 있어서, 문서에 함께 적힌 옛 이름도 괄호에 넣었다.

| 찾는 것                    | 경로                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 메뉴 열기                  | 화면 왼쪽 위의 ☰(navigation menu)                                                                                                                                    |
| 인스턴스 목록              | ☰ → **Compute** → **Instances**. 목록이 비어 있으면 화면 왼쪽의 **Compartment** 필터를 인스턴스가 있는 곳(보통 계정 이름의 root)으로 바꾼다                          |
| 인스턴스 상세              | 인스턴스 목록에서 이름을 누른다. 가용 도메인·공인 IP·OCID가 여기 있다                                                                                                 |
| 인스턴스의 볼륨            | 인스턴스 상세 → **Storage** 탭을 열고 아래로 내려 **Attached block volumes** (옛 화면: 왼쪽 아래 Resources의 **Attached Block Volumes**). 그 위 칸이 부트 볼륨 칸이다 |
| 부트 볼륨 목록             | ☰ → **Storage** → Block Storage 아래 **Block Volumes** → 왼쪽 사이드바의 **Boot Volumes**                                                                            |
| 부트 볼륨을 떼고 붙이는 곳 | 부트 볼륨 목록 → 볼륨 이름 → **Attached instances**                                                                                                                   |
| 인스턴스별 메뉴            | 인스턴스 목록 줄 끝의 **⋮**(Actions). Stop·Start·Terminate가 여기와 인스턴스 상세 위쪽에 있다                                                                         |
| Cloud Shell                | 화면 맨 위 막대(Console header) 오른쪽의 **Cloud Shell/Code Editor 아이콘** → 펼쳐지는 메뉴에서 **Cloud Shell**. 화면 아래쪽에 서랍처럼 터미널이 열린다               |
| 리전                       | 화면 맨 위 막대 오른쪽의 리전 이름. Cloud Shell의 CLI는 **Cloud Shell을 연 순간 여기 골라 둔 리전**에 명령을 보낸다                                                   |

## 0. 키가 정말 없는지 확인 (Mac)

문서에 적어 둔 명령으로 서버의 `api.env`를 받으려 했다.

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<서버 IP> 'cat ~/deploy/api.env' > .env.production
Warning: Identity file ~/.ssh/oracle-macfolio.key not accessible: No such file or directory.
The authenticity of host '<서버 IP> (<서버 IP>)' can't be established.
ED25519 key fingerprint is: SHA256:…
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

여기서 실수가 둘 있었다.

- **지문을 보지 않고 `yes`를 쳤다.** 처음 붙는 서버의 호스트 키를 믿을지 묻는 질문인데, 지문을 확인할 다른 경로 없이 넘겼다. 이번에는 `~/.ssh` 폴더가 없어 저장조차 되지 않았지만, 원래는 콘솔이나 서버 안에서 본 지문과 맞춰 보고 답해야 한다
- **`>`가 빈 파일을 남겼다.** 셸은 명령을 돌리기 전에 `> .env.production`부터 처리해 파일을 만든다. 접속은 실패했는데 0바이트 `.env.production`만 생겼다

키는 어디에도 없었다.

```text
$ ls ~/.ssh
ls: ~/.ssh: No such file or directory
$ tmutil destinationinfo
tmutil: No destinations configured.
```

Spotlight로 이름(`oracle-macfolio`, Oracle이 내려받을 때 붙이는 `ssh-key-날짜.key`)과 내용(`PRIVATE KEY` 머리말)으로 찾아도 없었고, 이 Mac에는 Time Machine 백업도 없었다. 예전 Mac이나 백업 디스크에 있었다면 거기서 `~/.ssh/`로 옮겨 오는 것이 가장 빠르다.

## 1. 복구 방법 고르기

**비밀 키는 다시 받을 수 없다.** Oracle에서 VM을 만들 때 **Download private key**로 받은 비밀 키는 그 화면에서 한 번만 받을 수 있고, Oracle도 사본이 없다. 할 수 있는 것은 **새 키를 만들어 서버의 `~/.ssh/authorized_keys`에 넣는** 것뿐이다. 문제는 들어가지 못하는 서버에 그 한 줄을 어떻게 넣느냐다.

| 방법                                       | 이 서버에서                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인스턴스를 지우고 새로 만들기              | Oracle 문서의 공식 답이다. 하지만 Docker·터널·백업·배포 키를 처음부터 다시 세워야 한다                                                                            |
| 시리얼 콘솔(Console connection)            | 안 된다. 로그인 화면이 OS 비밀번호를 묻는데, 이 서버는 하드닝 점검에서 "비밀번호 있는 계정 0"을 기대하게 만들어 두었다. 보안을 위해 막은 문이 복구 때도 막혀 있다 |
| 시리얼 콘솔의 유지보수 모드로 키 바꾸기    | Oracle 문서에 절차가 있지만 **Oracle Linux 이미지에만** 해당한다. 이 서버는 Ubuntu다                                                                              |
| GitHub Actions의 배포 키                   | 안 된다. `authorized_keys`에 `restrict,command="…/ops/deploy.sh"`로 묶여 있어서 무엇을 보내든 배포 스크립트만 돈다                                                |
| **부트 볼륨을 다른 VM에 붙여 파일 고치기** | 이것으로 했다. Oracle 문서에 "떼어 낸 부트 볼륨은 다른 인스턴스에 데이터 볼륨으로 붙일 수 있다"고 되어 있다                                                       |

계획은 이렇다. 새 키로 들어갈 수 있는 임시 VM을 만들고, 원래 서버의 디스크를 떼어 임시 VM에 두 번째 디스크로 꽂는다. 그 디스크의 `authorized_keys`에 새 공개 키 한 줄을 덧붙이고, 다시 원래 서버에 꽂아 켠다.

## 2. 새 SSH 키 만들기 (Mac)

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/oracle-macfolio.key -C macfolio-admin
cat ~/.ssh/oracle-macfolio.key.pub
```

파일이 둘 생긴다.

| 파일                      | 무엇                                               | 어디에 쓰나                                                |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `oracle-macfolio.key`     | 비밀 키 (권한 `600`)                               | 내 Mac에만 둔다. 어디에도 붙여 넣거나 올리지 않는다        |
| `oracle-macfolio.key.pub` | 공개 키 (`ssh-ed25519 AAAA… macfolio-admin` 한 줄) | Oracle 화면에 붙여 넣고, 서버의 `authorized_keys`에 넣는다 |

`ssh-keygen`이 `Enter passphrase`를 물을 때 암호를 넣으면, 이 키를 쓸 때마다 그 암호를 묻는다.

### 시행착오: 키 암호와 공개 키를 헷갈렸다

이 단계에서 가장 오래 헤맸다. 나중에 임시 VM에 접속할 때 이렇게 물었다.

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>
Enter passphrase for key '~/.ssh/oracle-macfolio.key':
```

여기에 긴 공개 키(`ssh-ed25519 AAAA…`)를 넣어야 하는 줄 알았다. 붙여 넣어도 화면에 아무것도 안 보여서, 직접 타이핑하려다 "이렇게 긴 걸 어떻게 정확히 치나" 싶어 멈췄다. 결과는 이랬다.

```text
ubuntu@<임시 VM IP>: Permission denied (publickey).
```

정리하면 이렇다.

- `Enter passphrase`가 묻는 것은 **2단계에서 정한 짧은 암호**다. 공개 키가 아니다
- 터미널은 암호를 입력하든 붙여 넣든 **화면에 아무것도 보여 주지 않는다**. 별표도 없다. 다 치고 Enter를 누른다
- 암호를 세 번 틀리면 다른 방법이 없어 `Permission denied (publickey)`로 끝난다. 서버가 키를 거절한 것과 겉모습이 같아서 헷갈린다
- 암호가 맞는지는 서버 없이 확인할 수 있다. 맞으면 공개 키가 나오고, 틀리면 `incorrect passphrase supplied`가 나온다
  ```bash
  ssh-keygen -y -f ~/.ssh/oracle-macfolio.key
  ```
- 암호를 잊었다면 되살릴 방법이 없다. 아직 서버에 넣기 전이라면 키를 새로 만들고(`-N ''`면 암호 없이) 임시 VM도 새 공개 키로 다시 만드는 것이 빠르다

결국 2단계에서 정한 암호를 제대로 쳐서 들어갔다.

## 3. 임시 VM 만들고 접속 확인 (Oracle 콘솔 → Mac)

☰ → **Compute** → **Instances** → 목록 위의 **Create instance**. 한 화면에 칸이 위에서 아래로 이어진다.

| 항목       | 고른 것                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement  | 원래 서버와 **같은 가용 도메인**. 부트 볼륨은 같은 가용 도메인의 VM에만 붙는다                                                                                                                    |
| Image      | Canonical Ubuntu (원래 서버와 같게)                                                                                                                                                               |
| Shape      | `VM.Standard.E2.1.Micro` (Always Free, 2대까지 무료라 원래 서버와 함께 한도 안이다)                                                                                                               |
| Networking | 원래 서버와 같은 VCN의 public subnet, 공인 IPv4 자동 할당                                                                                                                                         |
| SSH keys   | **Add SSH keys** 칸의 네 가지(Generate a key pair for me / Upload public key files / **Paste public keys** / No SSH keys) 중 **Paste public keys**를 고르고, 나타나는 상자에 2단계의 `.pub` 한 줄 |

맨 아래 **Create**를 누르면 인스턴스 상세로 넘어가고, 상태가 PROVISIONING에서 **RUNNING**이 되면 같은 화면의 공인 IP로 접속한다. **원래 서버를 끄기 전에** 만든다. VM이 뜨는 데 몇 분 걸리므로, 그만큼 서비스가 멈추는 시간이 준다.

### 헷갈렸던 것

- **가용 도메인이 `AD-1`로만 보였다.** 콘솔은 짧은 이름을 보여 주고, `XXXX:<리전>-AD-1` 같은 긴 이름은 API와 CLI에서 쓴다. 같은 것이다. 가용 도메인이 하나뿐인 리전이면 신경 쓸 필요가 없다
- **"Generate a key pair로 만들면 되지 않나?"** 그래도 된다. 다만 그 키 쌍을 원래 서버에도 쓰려면 비밀 키와 공개 키를 둘 다 그 화면에서 내려받아 보관해야 한다. 이번에 잃어버린 키가 바로 그렇게 받은 파일이었다. 이미 Mac에서 만든 키가 있으니 그 공개 키를 붙여 넣는 쪽이 잃어버릴 파일이 하나 적다

### 시행착오: 만들자마자 접속하면 끊긴다

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>
ssh: connect to host <임시 VM IP> port 22: Connection refused
```

`Connection refused`는 서버까지는 닿았는데 22번 포트에서 받는 프로그램이 아직 없다는 뜻이다. 방화벽에 막혔다면 거절이 아니라 시간 초과가 난다. 조금 뒤 다시 하니 호스트 키를 물은 뒤 바로 끊겼다.

```text
Warning: Permanently added '<임시 VM IP>' (ED25519) to the list of known hosts.
Connection closed by <임시 VM IP> port 22
```

Ubuntu는 부팅이 끝날 때까지 일반 사용자 로그인을 막는다. 둘 다 **부팅이 덜 끝나서**였고, 1~2분 기다리니 됐다. 프롬프트가 `ubuntu@…:~$`로 바뀌면 준비 끝이다.

## 4. 원래 서버 멈추고 부트 볼륨 떼기 (Oracle 콘솔)

1. **원래 서버 멈추기**: 인스턴스 목록에서 원래 서버 줄 끝의 ⋮(또는 상세 화면 위쪽) → **Stop**. 강제로 끄는 선택지가 보이면 고르지 않는다. 상태가 **STOPPED**가 될 때까지 기다린다. **여기부터 API가 멈춘다**. 부트 볼륨은 인스턴스가 멈춘 상태에서만 뗄 수 있다
2. **(권장) 백업**: ☰ → Storage → Block Volumes → 사이드바 **Boot Volumes** → 원래 서버 볼륨(보통 `<서버 이름> (Boot Volume)`) → 상세 화면의 **Boot volume backups** → 만들기. 실수해도 이 백업으로 되돌릴 수 있다
3. **떼기**: 같은 부트 볼륨 상세 → **Attached instances** → 원래 서버 줄의 ⋮ → **Detach Boot Volume** → **Continue Detachment**

### 시행착오: 중간에 멈추려 했더니 서버가 안 켜졌다

작업 중에 자리를 비워야 해서 원래 서버부터 다시 켜려 했다.

```text
Unable to start instance: Operation cannot be performed. Boot volume is not currently attached to the instance.
```

부트 볼륨을 뗀 인스턴스는 켤 수 없다. 중간에 멈추려면 **역순**으로 간다. 임시 VM에 붙였다면 거기서 먼저 떼고, 부트 볼륨 상세 → **Attached instances**에서 원래 서버에 다시 붙이고(상태가 **Attached**가 된 뒤) Start한다. 중간에 끊을 가능성이 있다면 4~7을 한 번에 할 수 있는 시간을 잡는 편이 낫다.

## 5. 떼어 낸 볼륨을 임시 VM에 붙이기 (Cloud Shell)

### 시행착오: 콘솔 버튼이 비활성화되어 있었다

임시 VM 화면에서 붙이려 했는데 **Attach block volume** 버튼이 비활성화(disabled)되어 눌리지 않았고, 마우스를 올려도 이유를 알려 주는 툴팁이 없었다. 그 대신 눌리는 버튼은 **Replace boot volume**이었다. **이것은 누르면 안 된다.** 임시 VM의 디스크 자체를 원래 서버 디스크로 바꿔 끼우는 기능이라, 우리가 원하는 "두 번째 디스크로 꽂기"가 아니다.

화면 대신 콘솔 안의 터미널인 **Cloud Shell**에서 OCI CLI로 붙였다. Cloud Shell은 따로 설치하거나 로그인할 것이 없다. 콘솔에 로그인한 계정 권한으로 `oci` 명령이 바로 된다.

처음엔 Cloud Shell이 어디 있는지 못 찾았다. 여는 순서는 이렇다.

1. 화면 **맨 위 막대**(Console header)의 오른쪽 아이콘들을 본다. 리전 이름 근처다
2. **Cloud Shell/Code Editor 아이콘**을 누르면 메뉴가 펼쳐진다. 여기서 **Cloud Shell**을 고른다
3. 화면 **아래쪽**에 서랍처럼 검은 터미널이 올라온다. 처음 열 때는 준비에 1분쯤 걸린다. 창 오른쪽 위 아이콘으로 최소화·최대화·닫기를 한다

아이콘이 안 보이면 브라우저 창이 좁아 접힌 것일 수 있다. 창을 넓히거나 화면 맨 위 검색 칸에 `Cloud Shell`을 친다. 그리고 Cloud Shell을 열기 전에 **맨 위 막대의 리전이 원래 서버의 리전인지** 확인한다. CLI는 Cloud Shell을 연 순간의 리전에 명령을 보낸다.

### 시행착오: Cloud Shell이 명령을 안 받았다

```text
Hit return to run the oci command oci iam availability-domain list :
...
$ AD=$(oci iam availability-domain list --query 'data[0].name' --raw-output); echo $AD
Invalid command, try again.
```

처음 열면 **안내 투어**가 뜨고, 투어는 정해진 명령만 받는다. Ctrl+C로 빠져나와 프롬프트가 `<계정>@cloudshell:~ (<리전>)$` 모양이 된 뒤에 친다.

### 실제로 친 명령

OCID는 길어서 손으로 복사하다 틀리기 쉽다. 표에서 복사하지 말고 `--query … --raw-output`으로 값만 뽑아 변수에 담는다.

```bash
AD=$(oci iam availability-domain list --query 'data[0].name' --raw-output)
oci compute instance list -c $OCI_TENANCY \
  --query 'data[].{name:"display-name",state:"lifecycle-state",id:id}' --output table
RESCUE=ocid1.instance…      # 표에서 임시 VM 줄
ORIG=ocid1.instance…        # 원래 서버 줄
RESCUEVOL=$(oci compute boot-volume-attachment list -c $OCI_TENANCY --availability-domain "$AD" \
  --instance-id "$RESCUE" --query 'data[0]."boot-volume-id"' --raw-output)
OLDVOL=$(oci bv boot-volume list -c $OCI_TENANCY --availability-domain "$AD" \
  --query "data[?id!='$RESCUEVOL'].id | [0]" --raw-output)
echo "[$RESCUE] [$OLDVOL]"   # 둘 다 비어 있지 않은지
oci compute volume-attachment attach --type paravirtualized \
  --instance-id "$RESCUE" --volume-id "$OLDVOL"
```

`--type paravirtualized`로 붙이면 Attached가 되자마자 임시 VM에 디스크가 보인다. iSCSI로 붙이면 VM 안에서 연결 명령을 더 쳐야 한다.

### 시행착오: 오류 넷

| 겪은 것                                              | 원인과 넘어간 방법                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 부트 볼륨 목록에서 둘 다 `AVAILABLE`                 | `AVAILABLE`은 "볼륨이 정상"이라는 뜻이지 "어디에도 안 붙음"이 아니다. 붙어 있는지는 `boot-volume-attachment list --boot-volume-id`로 본다  |
| `MissingParameter` (400)                             | 변수가 비어 빈 값이 서버로 갔다. `echo "[$OLDVOL]"`처럼 괄호로 감싸 찍어 보고 다시 담았다                                                  |
| `volumeId is invalid or incorrectly formatted` (400) | 손으로 복사한 OCID가 잘못됐다. 위처럼 `--query`로 뽑아 담으니 넘어갔다                                                                     |
| `Conflict: Volume … currently attached` (409)        | 이미 붙어 있었다. 앞선 시도 가운데 하나가 실제로는 들어갔던 것이다. `volume-attachment list --instance-id "$RESCUE"`에 `ATTACHED`로 나왔다 |

`attachment list`가 아무것도 출력하지 않을 때도 "붙은 것이 없다"와 "변수가 비었다" 두 경우가 있다. 결과가 비면 변수부터 찍어 본다.

## 6. 임시 VM에서 새 키 넣기 (임시 VM)

원래 계획은 이랬다.

```bash
lsblk                                   # 원래 서버 디스크(sdb) 찾기
sudo mkdir -p /mnt/old && sudo mount /dev/sdb1 /mnt/old
echo '<새 공개 키 한 줄>' | sudo tee -a /mnt/old/home/ubuntu/.ssh/authorized_keys
sudo umount /mnt/old
```

### 시행착오: `lsblk`를 Cloud Shell에서 쳤다

```text
$ lsblk
NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
sda      8:0    0   140G  0 disk
...
sdb      8:16   0    50G  0 disk
└─sdb1   8:17   0     5G  0 part /home/<계정>
```

`sdb`가 보여서 맞는 줄 알았는데, 프롬프트가 `…@cloudshell`이었다. Cloud Shell 자기 디스크다. 여기서 `mount`나 `tee`를 쳤다면 엉뚱한 곳을 건드렸을 것이다. 디스크 작업은 **Mac에서 임시 VM에 ssh로 들어간 창**에서 한다.

### 예상 밖: 임시 VM의 호스트 키가 바뀌어 있었다

임시 VM에 다시 들어가자 경고가 떴다.

```text
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
...
Host key verification failed.
```

몇 분 전에 처음 접속하며 저장한 호스트 키와, 지금 그 주소가 내미는 키가 ED25519·ECDSA 둘 다 달랐다. 원래 서버의 호스트 키와도 달랐다. 누가 가로챈 것보다는 VM이 재부팅되며 호스트 키를 새로 만든 쪽이 그럴듯했다. 옛 기록을 지우고(`ssh-keygen -R <임시 VM IP>`) 들어가서, **아무것도 고치지 않고** 상태부터 봤다.

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

`/`가 `sdb1`, 즉 **붙여 둔 원래 서버 디스크**다. 임시 VM은 17:54:34(UTC 08:54:34)에 재부팅됐고, 그때 원래 서버 디스크를 루트로 잡고 떠 있었다. `/boot`와 `/boot/efi`만 임시 VM 자기 디스크(`sda`)에서 왔다. 왜 그 시각에 재부팅됐는지는 확인하지 못했다.

![임시 VM이 원래 서버 디스크로 부팅된 과정](./images/oracle-ssh-key-recovery-boot.svg '두 디스크의 루트 이름표(cloudimg-rootfs)가 같아 sdb1이 /로 잡혔고, cloud-init이 이를 새 VM의 첫 부팅으로 처리했다')

두 디스크가 같은 Ubuntu 이미지에서 나와서 루트 파티션의 이름표(`LABEL=cloudimg-rootfs`)가 같다. 부팅할 때 이 이름표로 루트를 찾으면 어느 쪽이 잡힐지 보장이 없다. 그래서 **디스크를 붙인 뒤에는 임시 VM을 재부팅하지 않는다.**

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

원래 서버가 꺼져 있었으니 터널은 임시 VM에서 Cloudflare로 붙었고, 그동안 사이트 API는 **임시 VM 위에서** 돌고 있었다. Mac에서 `/health`를 부르니 200이 왔다. 그리고 `authorized_keys` 세 줄 가운데 셋째가 **새 공개 키**였다. 키를 넣기도 전에 이미 들어가 있었다.

### cloud-init이 대신 해 준 일

Ubuntu 클라우드 이미지는 부팅할 때 cloud-init이 돈다. cloud-init은 디스크에 남은 캐시의 instance ID와 지금 VM의 instance ID를 비교해, 다르면 "이 인스턴스의 첫 부팅"으로 보고 인스턴스마다 한 번 할 일을 한다. 그중 SSH 모듈이 하는 두 가지가 이번 일과 맞는다.

- 호스트 키를 지우고 새로 만든다 (`ssh_deletekeys`, 기본값 `true`). 경고가 뜬 이유다
- 메타데이터의 공개 키를 기본 사용자의 `authorized_keys`에 넣는다 (`allow_public_ssh_keys`, 기본값 `true`). 메타데이터에 든 것은 3단계에서 임시 VM에 붙여 넣은 새 공개 키다

원래 서버의 OS가 임시 VM의 instance ID로 부팅됐으니, cloud-init이 이 둘을 원래 서버 디스크에 해 준 것으로 보인다. 로그로 하나하나 확인하지는 않았지만, 호스트 키가 모두 바뀐 것과 넣지 않은 키가 들어가 있던 것이 이 설명과 맞는다. 키를 넣는 일은 이것으로 끝났다.

### 시행착오: `scp`를 서버 안에서 쳤다

마침 이 디스크에 처음 목적이던 `api.env`가 있었다. Mac으로 받으려고 `scp`를 쳤는데, 서버에 접속한 창에서 쳤다.

```text
ubuntu@macfolio-vnic-7712:~$ scp -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>:deploy/api.env ~/Documents/…/.env.production
Warning: Identity file /home/ubuntu/.ssh/oracle-macfolio.key not accessible: No such file or directory.
...
ubuntu@<임시 VM IP>: Permission denied (publickey).
```

서버가 자기 자신에게 접속하려다 실패한 것이다. Mac 터미널에서 새 탭(⌘T)을 열어 다시 쳤다. 프롬프트 맨 앞이 `ubuntu@`인지 내 Mac 이름인지를 보면 된다.

## 7. 되돌리고 원래 서버 켜기 (Cloud Shell)

원래 서버 디스크가 지금 **루트로 쓰이며 DB가 돌고 있으니** 켜진 채로 떼면 안 된다. 임시 VM 안에서 `sudo poweroff`를 해도 되지만, 콘솔 상태가 한동안 RUNNING에서 바뀌지 않아 밖에서 끄기로 했다. 이때 **`STOP`이 아니라 `SOFTSTOP`**을 쓴다. OCI CLI 문서에 따르면 `STOP`은 전원을 끄고, `SOFTSTOP`은 OS에 종료 명령을 보내 정상 종료한다. 다만 `SOFTSTOP`도 **15분**을 기다린 뒤에는 전원을 끈다. 종료에 오래 걸리는 프로그램이 있으면 안에서 먼저 끄라고 문서에 적혀 있다. 이 서버는 컨테이너 셋이라 금방 꺼졌다.

```bash
oci compute instance action --instance-id "$RESCUE" --action SOFTSTOP
oci compute instance get --instance-id "$RESCUE" --query 'data."lifecycle-state"' --raw-output   # STOPPED까지
ATT=$(oci compute volume-attachment list -c $OCI_TENANCY --instance-id "$RESCUE" \
  --query "data[?\"lifecycle-state\"=='ATTACHED'].id | [0]" --raw-output)
oci compute volume-attachment detach --volume-attachment-id "$ATT" --force
oci compute volume-attachment get --volume-attachment-id "$ATT" --query 'data."lifecycle-state"' --raw-output   # DETACHED까지
oci compute boot-volume-attachment attach --instance-id "$ORIG" --boot-volume-id "$OLDVOL"
oci compute instance action --instance-id "$ORIG" --action START
```

`detach`는 `{"opc-work-request-id": …}`만 돌려준다. 요청이 접수됐다는 뜻이지 끝났다는 뜻이 아니므로, 상태가 DETACHED가 될 때까지 다시 물어본 뒤 다음으로 간다.

켜는 동안 Mac에서 10초마다 `/health`와 22번 포트를 봤다.

```text
18:11:41 health=530 ssh=closed
18:12:18 health=530 ssh=open
18:12:39 health=502 ssh=open
18:13:21 health=200 ssh=open
```

530은 Cloudflare가 원본 서버를 찾지 못할 때 내는 코드로, 서버가 꺼져 터널이 연결되지 않은 동안이다. 502는 터널은 붙었는데 API가 아직 준비되지 않았을 때다. 켠 뒤 2분 남짓에 돌아왔다.

## 8. 뒤처리 (Mac, 원래 서버, GitHub, 콘솔)

### 새 키로 들어가지는지 확인

```bash
ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<서버 IP> 'grep -c . ~/.ssh/authorized_keys; docker ps --format "{{.Names}} {{.Status}}"'
```

원래 서버로 돌아가면 cloud-init이 또 키를 바꾸지 않을까 걱정했는데, 호스트 키는 임시 VM에서 새로 만든 그대로였다. 원래 서버의 instance ID는 처음 만들 때 처리한 기록이 디스크에 남아 있어서, cloud-init이 다시 하지 않은 것으로 보인다. 덕분에 새 공개 키도 그대로 남았다.

### 배포 secret `DEPLOY_KNOWN_HOSTS` 바꾸기

GitHub Actions의 API 배포는 이 secret에 고정해 둔 호스트 키로 서버를 확인한다. 호스트 키가 바뀌었으니 그대로 두면 다음 배포가 `Host key verification failed`로 실패한다. 서버 주소를 붙인 공개 호스트 키 한 줄로 바꿨다.

```bash
gh secret set DEPLOY_KNOWN_HOSTS --body "$(ssh-keyscan -t ed25519 <서버 IP> 2>/dev/null | grep -v '^#')"
```

`ssh-keyscan`으로 받은 키가 6단계에서 임시 VM에 들어갔을 때 확인한 지문과 같은지 보고 넣었다.

### 잃어버린 옛 키 지우기 (원래 서버)

```text
$ cut -c1-60 ~/.ssh/authorized_keys
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ…
restrict,command="/home/ubuntu/macfolio/ops/deploy.sh" ssh-e
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI…
```

첫 줄의 `ssh-rsa`가 잃어버린 키, 둘째가 배포 키, 셋째가 새 키다. 누가 잃어버린 파일을 주우면 들어올 수 있으니 첫 줄만 지웠다.

```bash
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
sed -i '1{/^ssh-rsa /d}' ~/.ssh/authorized_keys   # 1번 줄이 ssh-rsa일 때만 지운다
```

지운 뒤에는 **열어 둔 창을 닫지 않고** Mac에서 새 탭을 열어 새 키로 다시 들어가지는지 본다. 안 되면 열어 둔 창에서 `.bak`으로 되돌린다. 들어가지면 `.bak`을 지운다.

### 임시 VM 지우기 (Oracle 콘솔)

인스턴스 목록에서 임시 VM 줄 끝의 ⋮ → **Terminate** → 나오는 창에서 **Permanently delete the attached boot volume**을 체크 → **Terminate Instance**. 체크하지 않으면 부트 볼륨은 남는 것이 기본이다. 체크하면 임시 VM 자기 디스크도 함께 지운다. 원래 서버 디스크는 원래 서버에 붙어 있어서 지워지지 않는다. 지우기 전에 이름이 임시 VM인지 한 번 더 본다.

## 9. 처음 목적이던 로컬 `.env` (Mac)

받아 온 `api.env`(`.env.production`)를 그대로 복사하지 않고, 배포 값을 쓰면 안 되는 키만 고쳤다.

| 키                                         | 로컬에서                    | 이유                                                                                     |
| ------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | `localhost:5432`로 **더함** | 배포에서는 compose가 넣어 줘서 `api.env`에 없다                                          |
| `CORS_ORIGINS`                             | `http://localhost:5173`     | 배포 주소면 로컬 화면이 API에 붙지 못한다                                                |
| `API_URL`, `TRUST_PROXY`                   | 지움                        | OAuth 콜백이 배포 주소로 가고, 로컬에는 프록시가 없다                                    |
| `RESOURCE_MONITOR`                         | 지움                        | 노트북 CPU를 서버 자원으로 기록하고 알림 메일까지 보낸다                                 |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | 비움 → 개발용 OAuth 앱 값   | 배포용 앱은 콜백이 배포 도메인이라, 로컬에서는 GitHub가 `redirect_uri` 오류로 돌려보낸다 |

처음엔 "서버에 OAuth 값이 있는데 왜 비우나" 싶었다. GitHub OAuth 앱은 등록한 콜백 주소로만 돌려보내므로, 로컬 로그인에는 콜백이 `http://localhost:4000/…`인 개발용 앱이 따로 필요하다. 나머지(AI·번역·R2·메일 키 등)는 그대로 두었다. 대신 로컬에서 메일을 시험하면 진짜 메일이 나가고, 파일을 올리면 실제 버킷에 들어간다.

## 시행착오 정리

| 단계 | 한 실수                                          | 다음엔                                                                |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------- |
| 0    | 처음 보는 호스트 키에 지문을 안 보고 `yes`       | 콘솔이나 서버 안에서 본 지문과 맞춰 보고 답한다                       |
| 0    | 실패한 `ssh … > 파일`이 빈 파일을 남김           | 받을 파일은 성공한 뒤 `scp`로 받는다                                  |
| 2    | `Enter passphrase`에 공개 키를 넣으려 함         | 묻는 것은 키를 만들 때 정한 암호다. `ssh-keygen -y`로 따로 확인한다   |
| 3    | 만들자마자 접속해 `refused`·`closed`             | 1~2분 기다린다. 거절과 끊김은 방화벽이 아니라 부팅 중이라는 뜻이다    |
| 4    | 부트 볼륨을 뗀 채로 서버를 켜려 함               | 중간에 멈추려면 역순으로 다시 붙인 뒤 켠다                            |
| 5    | 비활성화된 버튼 대신 Replace boot volume을 볼 뻔 | Replace는 디스크를 바꿔 끼우는 기능이다. CLI로 데이터 볼륨으로 붙인다 |
| 5    | Cloud Shell 안내 투어에서 명령을 침              | Ctrl+C로 빠져나와 일반 프롬프트에서 친다                              |
| 5    | 빈 변수, 손으로 복사한 OCID                      | `--query … --raw-output`으로 담고 `echo "[$변수]"`로 확인한다         |
| 6    | `lsblk`를 Cloud Shell에서, `scp`를 서버에서      | 치기 전에 프롬프트 맨 앞을 본다                                       |
| 6    | (임시 VM이 재부팅되어 원래 디스크로 부팅)        | 디스크를 붙인 뒤에는 재부팅하지 않고, 작업 전에 `findmnt /`를 본다    |

## 정리

- SSH 비밀 키는 다시 받을 수 없다. 새 키를 만들어 `authorized_keys`에 넣는 것이 복구다
- 비밀번호 계정이 없는 Ubuntu 서버는 시리얼 콘솔로도 들어갈 수 없다. 부트 볼륨을 다른 VM에 데이터 볼륨으로 붙여 고친다
- 콘솔 버튼이 막히면 Cloud Shell의 OCI CLI로 붙인다. Paravirtualized면 붙자마자 보인다
- 같은 이미지에서 나온 두 디스크는 루트 이름표가 같다. 붙인 채로 재부팅하면 붙인 디스크로 부팅될 수 있고, 그러면 cloud-init이 호스트 키를 바꾸고 임시 VM의 공개 키를 넣는다
- 호스트 키가 바뀌면 배포가 쓰는 `DEPLOY_KNOWN_HOSTS`를 바꾸고, 잃어버린 옛 키 줄은 지운다
- 새 비밀 키와 그 암호는 비밀번호 관리자처럼 Mac 밖에도 둔다. Mac을 바꿀 때 `~/.ssh`도 옮길 목록에 넣는다

배포 문서의 키 복구 절차도 이번에 실제로 된 순서로 고쳐 두었다.

## 참고한 공식 문서

영어 문서는 이 글과 관련된 부분만 옮겼다.

- [Connecting to a Linux Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm) (Oracle)
  - "SSH 키를 잃어버렸으면 인스턴스를 종료하고, 제공된 SSH 키나 직접 만든 SSH 키로 새 인스턴스를 만든다."
  - "Ubuntu 플랫폼 이미지로 만든 인스턴스의 사용자 이름은 `ubuntu`다."
- [Instance Console Connections](https://docs.oracle.com/en-us/iaas/Content/Compute/References/serialconsole.htm) (Oracle)
  - "사용자 이름과 비밀번호로 로그인하려면 비밀번호가 있는 사용자 계정이 있어야 한다. Oracle Cloud Infrastructure는 `opc` 사용자에게 기본 비밀번호를 설정하지 않는다."
  - 유지보수 모드로 부팅해 SSH 키를 바꾸는 절차에는 "이 절차는 Oracle Linux 이미지에만 해당한다"는 주의가 붙어 있다.
- [Attaching a Boot Volume](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/attachingabootvolume.htm) (Oracle)
  - "부트 볼륨을 인스턴스에서 떼었거나 인스턴스가 멈췄거나 종료됐으면, 그 부트 볼륨을 다른 인스턴스에 데이터 볼륨으로 붙일 수 있다."
  - 원래 인스턴스에 부트 볼륨으로 다시 붙일 때는 `oci compute boot-volume-attachment attach`에 `--boot-volume-id`와 `--instance-id`를 준다.
- [Attaching a Block Volume to an Instance](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/attach-compute-volume-attachment.htm) (Oracle)
  - "볼륨 상태가 Attached일 때 연결 방식이 Paravirtualized면 자동으로 연결되어 바로 쓸 수 있다. iSCSI면 먼저 볼륨에 연결해야 한다."
- [Cloud Shell 시작하기](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/cloudshellgettingstarted.htm) (Oracle)
  - "콘솔 맨 위 막대의 Cloud Shell/Code Editor 아이콘을 누르고 드롭다운 메뉴에서 Cloud Shell을 고른다. Cloud Shell의 OCI CLI는 Cloud Shell을 시작할 때 콘솔의 리전 메뉴에서 골라 둔 리전에 명령을 보낸다."
  - "Cloud Shell은 콘솔 아래쪽의 서랍에 나타난다. Cloud Shell 창 오른쪽 위 아이콘으로 최소화·최대화·닫기를 한다."
- [Creating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm) (Oracle)
  - 경로: "navigation menu → Compute → Instances", "Create instance".
  - Add SSH keys의 **Paste public keys**: "키 쌍의 공개 키 부분을 상자에 붙여 넣는다." **Generate a key pair for me**를 고르면 Save Private Key로 비밀 키를 받아 두어야 한다.
- [Detaching a Boot Volume](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/detachingabootvolume.htm) (Oracle)
  - "부트 볼륨은 인스턴스가 멈춘 상태에서만 뗄 수 있다." 경로: Boot Volumes 목록 → 볼륨 → Attached instances → Actions(⋮) → Detach Boot Volume → Continue Detachment.
- [oci compute instance action](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/instance/action.html) (OCI CLI)
  - `STOP`: "인스턴스 전원을 끈다." `SOFTSTOP`: "OS에 종료 명령을 보내 정상 종료한다. OS 종료를 15분 기다린 뒤 전원을 끈다. 프로그램 종료가 15분보다 오래 걸리면 제대로 멈추지 못해 데이터가 깨질 수 있으니, softstop 전에 OS 안에서 직접 종료한다."
- [Terminating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/terminatinginstance.htm) (Oracle)
  - "인스턴스의 Actions(⋮) 메뉴에서 Terminate를 고른다. 연결된 부트 볼륨을 지우려면 Permanently delete the attached boot volume을 고른다." 기본으로는 부트 볼륨이 남는다.
- [First boot determination](https://docs.cloud-init.io/en/latest/explanation/first_boot.html) (cloud-init)
  - "캐시에 있는 instance ID와 실행 중에 알아낸 instance ID를 비교한다. 다르면 이 인스턴스의 첫 부팅이고, 같으면 이후 부팅이다."
  - 첫 부팅이면 "per-instance" 설정을 모두 돌리고, 이후 부팅에서는 "per-boot" 설정만 돌린다.
  - 파일시스템이 새 인스턴스에 붙으면 캐시가 그대로 남을 수 있고, instance ID 비교가 이를 첫 부팅으로 알아채게 한다.
- [Module reference: SSH](https://docs.cloud-init.io/en/latest/reference/modules.html) (cloud-init)
  - `ssh_deletekeys`: "호스트 SSH 키를 지운다. 기본 호스트 키가 든 이미지의 비밀 호스트 키를 다시 쓰지 않게 한다. 기본값 `true`."
  - `allow_public_ssh_keys`: "`true`면 데이터소스 메타데이터의 공개 SSH 키를 사용자의 `.ssh/authorized_keys` 파일로 가져온다. 기본값 `true`."
  - 실행 빈도: 인스턴스마다 한 번(once-per-instance).
- [Error 530](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-530/), [Error 1033](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/) (Cloudflare)
  - 530: "Cloudflare가 원본 호스트 이름을 확인하지 못한다는 뜻이다." 자세한 원인은 함께 오는 1XXX 오류를 본다.
  - 1033: "터널이 Cloudflare 네트워크에 연결되어 있지 않다. 트래픽을 받을 정상 `cloudflared` 인스턴스를 찾지 못했기 때문이다."

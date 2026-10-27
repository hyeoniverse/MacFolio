---
title: SSH 키를 잃어버린 Oracle 서버 되살리기 — 임시 VM이 원래 서버 디스크로 부팅됐다
date: 2026-10-20
category: 개발 기록/MacFolio/배포·품질/배포·운영
summary: 시스템 데이터 용량 문제로 Mac을 초기화하면서 서버 SSH 키도 함께 삭제되었다. 부트 볼륨을 임시 VM에 연결해 새 키를 추가하는 순서를 단계별로 정리하고, 키 암호·Cloud Shell·다른 터미널 창에서 실행한 명령 같은 시행착오와 임시 VM이 원래 서버 디스크로 부팅된 현상까지 기록했다.
---

Mac의 시스템 데이터 용량이 커져 초기화하자 로컬 API의 `.env`가 삭제되었다. 서버의 `~/deploy/api.env`에 배포 값이 모두 있으므로, 내려받아 로컬용 값만 수정하면 된다. 그런데 서버에 접속할 SSH 키도 `~/.ssh` 폴더와 함께 삭제된 상태였다. 이 글은 키 없이 Oracle 서버에 다시 접속하기까지의 **실제 작업 순서**와 그 과정의 시행착오를 기록한 것이다.

![부트 볼륨을 옮겨 SSH 키를 복구하는 계획](./images/oracle-ssh-key-recovery-plan.svg '원래 서버 디스크를 임시 VM에 데이터 볼륨으로 연결해 authorized_keys를 수정하고 다시 원래 서버에 연결한다')

## 전체 순서

| 단계 | 작업                                      | 실행 위치                    | 서버 중지 |
| ---- | ----------------------------------------- | ---------------------------- | --------- |
| 0    | 키가 실제로 없는지 확인                   | Mac                          |           |
| 1    | 복구 방법 선택                            |                              |           |
| 2    | 새 SSH 키 생성                            | Mac                          |           |
| 3    | 임시 VM 생성, 접속 확인                   | Oracle 콘솔, Mac             |           |
| 4    | 원래 서버 중지, 부트 볼륨 분리            | Oracle 콘솔                  | 중지 시작 |
| 5    | 분리한 볼륨을 임시 VM에 연결              | Cloud Shell                  | ↓         |
| 6    | 임시 VM에서 새 키 추가 (실제 결과는 다름) | 임시 VM                      | ↓         |
| 7    | 원상 복구, 원래 서버 시작                 | Cloud Shell                  | 중지 종료 |
| 8    | 후속 정리: 배포 secret, 이전 키, 임시 VM  | Mac, 원래 서버, GitHub, 콘솔 |           |
| 9    | 원래 목적인 로컬 `.env` 복원              | Mac                          |           |

터미널 창이 세 개(Mac 터미널, Oracle Cloud Shell, 임시 VM에 SSH로 접속한 터미널)이므로, 단계마다 **명령을 실행할 창**을 먼저 표시했다. 이 구분을 놓쳐 생긴 시행착오가 가장 많았다.

### Oracle 콘솔 화면 경로

콘솔은 메뉴 단계가 깊어 위치를 찾는 데 시간이 걸린다. 아래 경로는 Oracle 공식 문서 기준이다. 콘솔 화면 버전에 따라 이름이 다를 수 있어, 문서에 함께 적힌 이전 이름도 괄호에 기록했다.

<details>
<summary>콘솔 메뉴 경로 표 (9항목)</summary>

| 찾는 것                    | 경로                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 메뉴 열기                  | 화면 왼쪽 위의 ☰(navigation menu)                                                                                                                                    |
| 인스턴스 목록              | ☰ → **Compute** → **Instances**. 목록이 비어 있으면 화면 왼쪽의 **Compartment** 필터를 인스턴스가 있는 곳(보통 계정 이름의 root)으로 바꾼다                          |
| 인스턴스 상세              | 인스턴스 목록에서 이름을 클릭한다. 가용 도메인·공인 IP·OCID가 여기 있다                                                                                               |
| 인스턴스의 볼륨            | 인스턴스 상세 → **Storage** 탭을 열고 아래로 내려 **Attached block volumes** (옛 화면: 왼쪽 아래 Resources의 **Attached Block Volumes**). 그 위 칸이 부트 볼륨 칸이다 |
| 부트 볼륨 목록             | ☰ → **Storage** → Block Storage 아래 **Block Volumes** → 왼쪽 사이드바의 **Boot Volumes**                                                                            |
| 부트 볼륨을 떼고 붙이는 곳 | 부트 볼륨 목록 → 볼륨 이름 → **Attached instances**                                                                                                                   |
| 인스턴스별 메뉴            | 인스턴스 목록 줄 끝의 **⋮**(Actions). Stop·Start·Terminate가 여기와 인스턴스 상세 위쪽에 있다                                                                         |
| Cloud Shell                | 화면 맨 위 막대(Console header) 오른쪽의 **Cloud Shell/Code Editor 아이콘** → 펼쳐지는 메뉴에서 **Cloud Shell**. 화면 아래쪽에 서랍처럼 터미널이 열린다               |
| 리전                       | 화면 맨 위 막대 오른쪽의 리전 이름. Cloud Shell의 CLI는 **Cloud Shell을 연 순간 여기 골라 둔 리전**에 명령을 보낸다                                                   |

</details>

## 0. 키가 실제로 없는지 확인 (Mac)

문서에 기록한 명령으로 서버의 `api.env`를 내려받으려 했다.

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<서버 IP> 'cat ~/deploy/api.env' > .env.production
Warning: Identity file ~/.ssh/oracle-macfolio.key not accessible: No such file or directory.
The authenticity of host '<서버 IP> (<서버 IP>)' can't be established.
ED25519 key fingerprint is: SHA256:…
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
```

여기서 실수가 두 가지 있었다.

- **지문(fingerprint)을 확인하지 않고 `yes`를 입력했다.** 처음 접속하는 서버의 호스트 키를 신뢰할지 묻는 질문인데, 지문을 대조할 다른 경로 없이 승인했다. 이번에는 `~/.ssh` 폴더가 없어 저장되지도 않았지만, 원칙적으로는 콘솔이나 서버 안에서 확인한 지문과 대조한 뒤 답해야 한다
- **`>`가 빈 파일을 생성했다.** 셸은 명령을 실행하기 전에 `> .env.production` 리다이렉션부터 처리해 파일을 생성한다. 접속은 실패했지만 0바이트 `.env.production` 파일이 생성되었다

키는 어디에도 없었다.

```text
$ ls ~/.ssh
ls: ~/.ssh: No such file or directory
$ tmutil destinationinfo
tmutil: No destinations configured.
```

Spotlight로 파일 이름(`oracle-macfolio`, Oracle이 내려받기 시 지정하는 `ssh-key-날짜.key`)과 내용(`PRIVATE KEY` 헤더)으로 검색해도 없었고, 이 Mac에는 Time Machine 백업도 없었다. 이전 Mac이나 백업 디스크에 키가 있다면 그 파일을 `~/.ssh/`로 복사하는 것이 가장 빠르다.

## 1. 복구 방법 선택

**비밀 키는 다시 내려받을 수 없다.** Oracle에서 VM을 생성할 때 **Download private key**로 받은 비밀 키는 그 화면에서 한 번만 내려받을 수 있고, Oracle도 사본을 보관하지 않는다. 가능한 방법은 **새 키를 생성해 서버의 `~/.ssh/authorized_keys`에 추가하는** 것뿐이다. 문제는 접속할 수 없는 서버에 그 한 줄을 추가하는 방법이다.

| 방법                                       | 이 서버에서                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인스턴스를 지우고 새로 만들기              | Oracle 문서의 공식 방법이다. 하지만 Docker·터널·백업·배포 키를 처음부터 다시 구성해야 한다                                                                           |
| 시리얼 콘솔(Console connection)            | 불가. 로그인 화면이 OS 비밀번호를 요구하는데, 이 서버는 하드닝 점검에서 "비밀번호가 있는 계정 0개"를 기준으로 삼는다. 보안을 위해 차단한 경로가 복구 시에도 차단된다 |
| 시리얼 콘솔의 유지보수 모드로 키 교체      | Oracle 문서에 절차가 있지만 **Oracle Linux 이미지에만** 해당한다. 이 서버는 Ubuntu다                                                                                 |
| GitHub Actions의 배포 키                   | 불가. `authorized_keys`에 `restrict,command="…/ops/deploy.sh"`로 제한되어 있어 어떤 명령을 보내도 배포 스크립트만 실행된다                                           |
| **부트 볼륨을 다른 VM에 연결해 파일 수정** | 선택한 방법. Oracle 문서에 "분리한 부트 볼륨은 다른 인스턴스에 데이터 볼륨으로 연결할 수 있다"고 명시되어 있다                                                       |

계획은 다음과 같다. 새 키로 접속할 수 있는 임시 VM을 생성하고, 원래 서버의 디스크를 분리해 임시 VM에 두 번째 디스크로 연결한다. 그 디스크의 `authorized_keys`에 새 공개 키 한 줄을 추가하고, 다시 원래 서버에 연결해 시작한다.

## 2. 새 SSH 키 생성 (Mac)

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/oracle-macfolio.key -C macfolio-admin
cat ~/.ssh/oracle-macfolio.key.pub
```

파일 두 개가 생성된다.

| 파일                      | 내용                                               | 용도                                                          |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `oracle-macfolio.key`     | 비밀 키 (권한 `600`)                               | 로컬 Mac에만 보관한다. 어디에도 붙여 넣거나 업로드하지 않는다 |
| `oracle-macfolio.key.pub` | 공개 키 (`ssh-ed25519 AAAA… macfolio-admin` 한 줄) | Oracle 화면에 붙여 넣고, 서버의 `authorized_keys`에 추가한다  |

`ssh-keygen`이 `Enter passphrase`를 요청할 때 암호를 입력하면, 이 키를 사용할 때마다 그 암호를 요구한다.

### 시행착오: 키 암호와 공개 키 혼동

이 단계에서 가장 많은 시간을 사용했다. 이후 임시 VM에 접속할 때 다음 입력을 요구했다.

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>
Enter passphrase for key '~/.ssh/oracle-macfolio.key':
```

여기에 긴 공개 키(`ssh-ed25519 AAAA…`)를 입력해야 한다고 판단했다. 붙여 넣어도 화면에 아무것도 표시되지 않아 직접 입력하려다 중단했다. 결과는 다음과 같았다.

```text
ubuntu@<임시 VM IP>: Permission denied (publickey).
```

정리하면 다음과 같다.

- `Enter passphrase`가 요구하는 값은 **2단계에서 지정한 암호**다. 공개 키가 아니다
- 터미널은 암호를 입력하든 붙여 넣든 **화면에 아무것도 표시하지 않는다**. 별표도 표시되지 않는다. 입력을 마치고 Enter를 누른다
- 암호를 세 번 틀리면 다른 인증 수단이 없어 `Permission denied (publickey)`로 종료된다. 서버가 키를 거부한 경우와 출력이 같아 원인을 구분하기 어렵다
- 암호가 맞는지는 서버 없이 확인할 수 있다. 맞으면 공개 키가 출력되고, 틀리면 `incorrect passphrase supplied`가 출력된다
  ```bash
  ssh-keygen -y -f ~/.ssh/oracle-macfolio.key
  ```
- 암호를 잊었다면 복구할 방법이 없다. 아직 서버에 추가하기 전이라면 키를 새로 생성하고(`-N ''`이면 암호 없음) 임시 VM도 새 공개 키로 다시 생성하는 것이 빠르다

2단계에서 지정한 암호를 입력해 접속했다.

## 3. 임시 VM 생성, 접속 확인 (Oracle 콘솔 → Mac)

☰ → **Compute** → **Instances** → 목록 위의 **Create instance**. 한 화면에 입력 항목이 위에서 아래로 이어진다.

| 항목       | 선택한 값                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement  | 원래 서버와 **같은 가용 도메인**. 부트 볼륨은 같은 가용 도메인의 VM에만 연결할 수 있다                                                                                                                |
| Image      | Canonical Ubuntu (원래 서버와 같게)                                                                                                                                                                   |
| Shape      | `VM.Standard.E2.1.Micro` (Always Free, 2대까지 무료라 원래 서버와 함께 한도 안이다)                                                                                                                   |
| Networking | 원래 서버와 같은 VCN의 public subnet, 공인 IPv4 자동 할당                                                                                                                                             |
| SSH keys   | **Add SSH keys** 칸의 네 가지(Generate a key pair for me / Upload public key files / **Paste public keys** / No SSH keys) 중 **Paste public keys**를 선택하고, 표시되는 입력란에 2단계의 `.pub` 한 줄 |

맨 아래 **Create**를 클릭하면 인스턴스 상세 화면으로 이동하고, 상태가 PROVISIONING에서 **RUNNING**이 되면 같은 화면의 공인 IP로 접속한다. **원래 서버를 중지하기 전에** 생성한다. VM 시작에 몇 분 걸리므로, 그만큼 서비스 중단 시간이 줄어든다.

### 혼동했던 항목

- **가용 도메인이 `AD-1`로만 표시되었다.** 콘솔은 짧은 이름을 표시하고, `XXXX:<리전>-AD-1` 같은 전체 이름은 API와 CLI에서 사용한다. 같은 가용 도메인이다. 가용 도메인이 하나뿐인 리전에서는 고려하지 않아도 된다
- **Generate a key pair 옵션으로 생성해도 되는가.** 가능하다. 다만 그 키 쌍을 원래 서버에도 사용하려면 비밀 키와 공개 키를 모두 그 화면에서 내려받아 보관해야 한다. 이번에 분실한 키가 바로 그 방식으로 받은 파일이었다. Mac에서 이미 생성한 키가 있으므로, 그 공개 키를 붙여 넣는 방식이 관리할 파일이 하나 적다

### 시행착오: 생성 직후 접속하면 연결이 종료된다

```text
$ ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>
ssh: connect to host <임시 VM IP> port 22: Connection refused
```

`Connection refused`는 서버까지 도달했지만 22번 포트에서 수신 대기하는 프로세스가 아직 없다는 뜻이다. 방화벽에서 차단되었다면 거부가 아니라 시간 초과가 발생한다. 잠시 후 다시 시도하자 호스트 키를 확인한 직후 연결이 종료되었다.

```text
Warning: Permanently added '<임시 VM IP>' (ED25519) to the list of known hosts.
Connection closed by <임시 VM IP> port 22
```

Ubuntu는 부팅이 끝날 때까지 일반 사용자 로그인을 차단한다(`pam_nologin`). 두 출력 모두 **부팅이 완료되지 않은 상태**가 원인이었고, 1~2분 뒤 접속에 성공했다. 프롬프트가 `ubuntu@…:~$`로 바뀌면 준비가 끝난 것이다.

## 4. 원래 서버 중지, 부트 볼륨 분리 (Oracle 콘솔)

1. **원래 서버 중지**: 인스턴스 목록에서 원래 서버 행 끝의 ⋮(또는 상세 화면 상단) → **Stop**. 강제 종료 옵션이 표시되면 선택하지 않는다. 상태가 **STOPPED**가 될 때까지 기다린다. **이 시각부터 API가 중단된다**. 부트 볼륨은 인스턴스가 중지된 상태에서만 분리할 수 있다
2. **(권장) 백업**: ☰ → Storage → Block Volumes → 사이드바 **Boot Volumes** → 원래 서버 볼륨(보통 `<서버 이름> (Boot Volume)`) → 상세 화면의 **Boot volume backups** → 생성. 작업 중 실수해도 이 백업으로 복원할 수 있다
3. **분리**: 같은 부트 볼륨 상세 → **Attached instances** → 원래 서버 행의 ⋮ → **Detach Boot Volume** → **Continue Detachment**

### 시행착오: 작업 중단 시 서버가 시작되지 않음

작업을 중단해야 해서 원래 서버를 먼저 다시 시작하려 했다.

```text
Unable to start instance: Operation cannot be performed. Boot volume is not currently attached to the instance.
```

부트 볼륨을 분리한 인스턴스는 시작할 수 없다. 작업을 중단하려면 **역순**으로 진행한다. 임시 VM에 연결했다면 먼저 분리하고, 부트 볼륨 상세 → **Attached instances**에서 원래 서버에 다시 연결한 뒤(상태가 **Attached**가 된 뒤) Start한다. 중단 가능성이 있다면 4~7단계를 연속으로 진행할 수 있는 시간을 확보하는 편이 좋다.

## 5. 분리한 볼륨을 임시 VM에 연결 (Cloud Shell)

### 시행착오: 콘솔 버튼 비활성

임시 VM 화면에서 연결하려 했지만 **Attach block volume** 버튼이 비활성(disabled) 상태였고, 마우스를 올려도 이유를 알려 주는 툴팁이 없었다. 활성 상태인 버튼은 **Replace boot volume**이었다. **이 버튼은 사용하면 안 된다.** 임시 VM의 부트 디스크 자체를 원래 서버 디스크로 교체하는 기능이므로, 필요한 동작(두 번째 디스크로 연결)이 아니다.

화면 대신 콘솔 안의 터미널인 **Cloud Shell**에서 OCI CLI로 연결했다. Cloud Shell은 별도 설치나 로그인이 필요 없다. 콘솔에 로그인한 계정 권한으로 `oci` 명령을 바로 실행할 수 있다.

Cloud Shell을 여는 순서는 다음과 같다.

1. 화면 **맨 위 막대**(Console header)의 오른쪽 아이콘을 확인한다. 리전 이름 근처에 있다
2. **Cloud Shell/Code Editor 아이콘**을 클릭하면 메뉴가 펼쳐진다. 여기서 **Cloud Shell**을 선택한다
3. 화면 **아래쪽**에 드로어 형태로 터미널이 열린다. 처음 열 때는 준비에 약 1분이 걸린다. 창 오른쪽 위 아이콘으로 최소화·최대화·닫기를 한다

아이콘이 보이지 않으면 브라우저 창이 좁아 접혀 있을 수 있다. 창을 넓히거나 화면 맨 위 검색 칸에 `Cloud Shell`을 입력한다. Cloud Shell을 열기 전에 **맨 위 막대의 리전이 원래 서버의 리전인지** 확인한다. CLI는 Cloud Shell을 연 시각의 리전에 명령을 보낸다.

### 시행착오: Cloud Shell이 명령을 거부

```text
Hit return to run the oci command oci iam availability-domain list :
...
$ AD=$(oci iam availability-domain list --query 'data[0].name' --raw-output); echo $AD
Invalid command, try again.
```

처음 열면 **안내 투어**가 실행되고, 투어는 지정된 명령만 받는다. Ctrl+C로 종료하고 프롬프트가 `<계정>@cloudshell:~ (<리전>)$` 형식이 된 뒤 입력한다.

### 실행한 명령

OCID[^ocid]는 길어서 수동 복사 시 오류가 생기기 쉽다. 표에서 복사하지 말고 `--query … --raw-output`으로 값만 추출해 변수에 저장한다.

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

`--type paravirtualized`로 연결하면 Attached 상태가 되는 즉시 임시 VM에서 디스크가 인식된다. iSCSI로 연결하면 VM 안에서 추가 연결 명령을 실행해야 한다.

### 시행착오: 오류 네 가지

| 증상                                                 | 원인과 해결                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 부트 볼륨 목록에서 둘 다 `AVAILABLE`                 | `AVAILABLE`은 "볼륨이 정상"이라는 뜻이지 "연결되지 않음"이 아니다. 연결 여부는 `boot-volume-attachment list --boot-volume-id`로 확인한다   |
| `MissingParameter` (400)                             | 변수가 비어 빈 값이 전송되었다. `echo "[$OLDVOL]"`처럼 괄호로 감싸 출력해 확인하고 다시 저장했다                                           |
| `volumeId is invalid or incorrectly formatted` (400) | 수동 복사한 OCID가 잘못되었다. 위처럼 `--query`로 추출해 저장하자 해결되었다                                                               |
| `Conflict: Volume … currently attached` (409)        | 이미 연결되어 있었다. 앞선 시도 중 하나가 실제로 처리된 것이다. `volume-attachment list --instance-id "$RESCUE"`에 `ATTACHED`로 표시되었다 |

`attachment list`가 아무것도 출력하지 않을 때도 "연결된 것이 없음"과 "변수가 비어 있음" 두 경우가 있다. 결과가 비어 있으면 변수 값부터 출력해 확인한다.

## 6. 임시 VM에서 새 키 추가 (임시 VM)

원래 계획한 명령은 다음과 같다.

```bash
lsblk                                   # 원래 서버 디스크(sdb) 찾기
sudo mkdir -p /mnt/old && sudo mount /dev/sdb1 /mnt/old
echo '<새 공개 키 한 줄>' | sudo tee -a /mnt/old/home/ubuntu/.ssh/authorized_keys
sudo umount /mnt/old
```

### 시행착오: `lsblk`를 Cloud Shell에서 실행

```text
$ lsblk
NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
sda      8:0    0   140G  0 disk
...
sdb      8:16   0    50G  0 disk
└─sdb1   8:17   0     5G  0 part /home/<계정>
```

`sdb`가 표시되어 대상 디스크로 판단했지만, 프롬프트가 `…@cloudshell`이었다. Cloud Shell 자체의 디스크다. 여기서 `mount`나 `tee`를 실행했다면 다른 디스크를 변경했을 것이다. 디스크 작업은 **Mac에서 임시 VM에 SSH로 접속한 창**에서 실행한다.

### 예상하지 못한 결과: 임시 VM의 호스트 키 변경

임시 VM에 다시 접속하자 경고가 출력되었다.

```text
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
...
Host key verification failed.
```

몇 분 전 첫 접속에서 저장한 호스트 키와 현재 그 주소가 제시하는 키가 ED25519·ECDSA 모두 달랐다. 원래 서버의 호스트 키와도 달랐다. 중간자 공격보다는 VM이 재부팅되며 호스트 키를 새로 생성했을 가능성이 높았다. 이전 기록을 삭제하고(`ssh-keygen -R <임시 VM IP>`) 접속한 뒤, **아무것도 수정하지 않고** 상태부터 확인했다.

<details open>
<summary>hostname · uptime · findmnt · lsblk 출력</summary>

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

</details>

`/`가 `sdb1`, 즉 **연결해 둔 원래 서버 디스크**다. 임시 VM은 17:54:34(UTC 08:54:34)에 재부팅되었고, 그 시각에 원래 서버 디스크를 루트 파일시스템으로 마운트해 실행 중이었다. `/boot`와 `/boot/efi`만 임시 VM 자체 디스크(`sda`)에서 마운트되었다. 그 시각에 재부팅된 원인은 확인하지 못했다.

![임시 VM이 원래 서버 디스크로 부팅된 과정](./images/oracle-ssh-key-recovery-boot.svg '두 디스크의 루트 이름표(cloudimg-rootfs)가 같아 sdb1이 /로 잡혔고, cloud-init이 이를 새 VM의 첫 부팅으로 처리했다')

두 디스크가 같은 Ubuntu 이미지에서 생성되어 루트 파티션의 레이블(`LABEL=cloudimg-rootfs`)이 같다. 부팅 시 이 레이블로 루트를 찾으면 어느 디스크가 선택될지 보장되지 않는다. 그래서 **디스크를 연결한 뒤에는 임시 VM을 재부팅하지 않는다.**

원래 서버의 OS인지 확인했다.

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

원래 서버가 중지된 상태였으므로 터널은 임시 VM에서 Cloudflare로 연결되었고, 그동안 사이트 API는 **임시 VM에서** 실행되고 있었다. Mac에서 `/health`를 요청하자 200이 응답되었다. 그리고 `authorized_keys` 세 줄 중 세 번째가 **새 공개 키**였다. 키를 추가하기 전에 이미 추가되어 있었다.

### cloud-init이 수행한 작업

Ubuntu 클라우드 이미지는 부팅 시 cloud-init[^cloud-init]을 실행한다. cloud-init은 디스크에 남은 캐시의 instance ID와 현재 VM의 instance ID를 비교해, 다르면 "이 인스턴스의 첫 부팅"으로 판단하고 인스턴스당 한 번 실행하는 작업을 수행한다. 그중 SSH 모듈의 두 동작이 이번 현상과 일치한다.

- 호스트 키를 삭제하고 새로 생성한다 (`ssh_deletekeys`, 기본값 `true`). 경고가 출력된 원인이다
- 메타데이터의 공개 키를 기본 사용자의 `authorized_keys`에 추가한다 (`allow_public_ssh_keys`, 기본값 `true`). 메타데이터에 있는 키는 3단계에서 임시 VM에 붙여 넣은 새 공개 키다

원래 서버의 OS가 임시 VM의 instance ID로 부팅되었으므로, cloud-init이 이 두 작업을 원래 서버 디스크에 수행한 것으로 판단한다. 로그로 개별 확인하지는 않았지만, 호스트 키가 모두 바뀐 것과 직접 추가하지 않은 키가 존재한 것이 이 설명과 일치한다. 키 추가 작업은 이것으로 완료되었다.

### 시행착오: `scp`를 서버 안에서 실행

이 디스크에 원래 목적인 `api.env`가 있었다. Mac으로 내려받으려고 `scp`를 실행했는데, 서버에 접속한 창에서 실행했다.

```text
ubuntu@macfolio-vnic-7712:~$ scp -i ~/.ssh/oracle-macfolio.key ubuntu@<임시 VM IP>:deploy/api.env ~/Documents/…/.env.production
Warning: Identity file /home/ubuntu/.ssh/oracle-macfolio.key not accessible: No such file or directory.
...
ubuntu@<임시 VM IP>: Permission denied (publickey).
```

서버가 자기 자신에게 접속하려다 실패한 것이다. Mac 터미널에서 새 탭(⌘T)을 열어 다시 실행했다. 프롬프트 앞부분이 `ubuntu@`인지 로컬 Mac 이름인지로 구분한다.

## 7. 원상 복구, 원래 서버 시작 (Cloud Shell)

원래 서버 디스크가 현재 **루트 파일시스템으로 사용되며 DB가 실행 중이므로** 실행 상태에서 분리하면 안 된다. 임시 VM 안에서 `sudo poweroff`를 실행해도 되지만, 콘솔 상태가 한동안 RUNNING에서 바뀌지 않아 외부에서 중지하기로 했다. 이때 **`STOP`이 아니라 `SOFTSTOP`**을 사용한다. OCI CLI 문서에 따르면 `STOP`은 전원을 차단하고, `SOFTSTOP`은 OS에 종료 명령을 보내 정상 종료한다. 다만 `SOFTSTOP`도 **15분** 대기 후에는 전원을 차단한다. 종료에 오래 걸리는 프로그램이 있으면 OS 안에서 먼저 종료하라고 문서에 명시되어 있다. 이 서버는 컨테이너 3개라 빠르게 종료되었다.

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

`detach`는 `{"opc-work-request-id": …}`만 반환한다. 요청이 접수되었다는 뜻이지 완료되었다는 뜻이 아니므로, 상태가 DETACHED가 될 때까지 다시 조회한 뒤 다음 단계로 진행한다.

시작하는 동안 Mac에서 10초마다 `/health` 응답과 22번 포트를 확인했다.

```text
18:11:41 health=530 ssh=closed
18:12:18 health=530 ssh=open
18:12:39 health=502 ssh=open
18:13:21 health=200 ssh=open
```

| 상태 코드 | 의미                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| 530       | Cloudflare가 원본 서버를 찾지 못함. 서버가 중지되어 터널이 연결되지 않은 구간 |
| 502       | 터널은 연결되었지만 API가 아직 준비되지 않은 구간                             |
| 200       | 정상. 시작 후 약 2분에 복구                                                   |

## 8. 후속 정리 (Mac, 원래 서버, GitHub, 콘솔)

### 새 키로 접속되는지 확인

```bash
ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<서버 IP> 'grep -c . ~/.ssh/authorized_keys; docker ps --format "{{.Names}} {{.Status}}"'
```

원래 서버에서 부팅하면 cloud-init이 키를 다시 교체할 가능성을 확인했는데, 호스트 키는 임시 VM에서 생성된 그대로였다. 원래 서버의 instance ID는 최초 생성 시 처리한 기록이 디스크에 남아 있어, cloud-init이 다시 실행하지 않은 것으로 판단한다. 새 공개 키도 그대로 유지되었다.

### 배포 secret `DEPLOY_KNOWN_HOSTS` 교체

GitHub Actions의 API 배포는 이 secret에 고정한 호스트 키로 서버를 검증한다. 호스트 키가 바뀌었으므로 그대로 두면 다음 배포가 `Host key verification failed`로 실패한다. 서버 주소가 포함된 공개 호스트 키 한 줄로 교체했다.

```bash
gh secret set DEPLOY_KNOWN_HOSTS --body "$(ssh-keyscan -t ed25519 <서버 IP> 2>/dev/null | grep -v '^#')"
```

`ssh-keyscan`으로 받은 키가 6단계에서 임시 VM에 접속해 확인한 지문과 같은지 대조한 뒤 등록했다.

### 분실한 이전 키 삭제 (원래 서버)

```text
$ cut -c1-60 ~/.ssh/authorized_keys
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ…
restrict,command="/home/ubuntu/macfolio/ops/deploy.sh" ssh-e
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI…
```

첫 줄의 `ssh-rsa`가 분실한 키, 두 번째가 배포 키, 세 번째가 새 키다. 분실한 비밀 키 파일을 다른 사람이 획득하면 접속할 수 있으므로 첫 줄만 삭제했다.

```bash
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
sed -i '1{/^ssh-rsa /d}' ~/.ssh/authorized_keys   # 1번 줄이 ssh-rsa일 때만 지운다
```

삭제한 뒤에는 **기존 접속 창을 닫지 않고** Mac에서 새 탭을 열어 새 키로 접속되는지 확인한다. 실패하면 기존 창에서 `.bak`으로 복원한다. 접속되면 `.bak`을 삭제한다.

### 임시 VM 삭제 (Oracle 콘솔)

인스턴스 목록에서 임시 VM 행 끝의 ⋮ → **Terminate** → 표시되는 창에서 **Permanently delete the attached boot volume**을 선택 → **Terminate Instance**. 선택하지 않으면 기본적으로 부트 볼륨이 남는다. 선택하면 임시 VM 자체 디스크도 함께 삭제된다. 원래 서버 디스크는 원래 서버에 연결되어 있어 삭제되지 않는다. 삭제 전에 대상 이름이 임시 VM인지 다시 확인한다.

## 9. 원래 목적인 로컬 `.env` 복원 (Mac)

내려받은 `api.env`(`.env.production`)를 그대로 복사하지 않고, 배포 값을 사용하면 안 되는 키만 수정했다.

| 키                                         | 로컬 값                     | 이유                                                                                   |
| ------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | `localhost:5432`로 **추가** | 배포 환경에서는 compose가 주입하므로 `api.env`에 없다                                  |
| `CORS_ORIGINS`                             | `http://localhost:5173`     | 배포 주소이면 로컬 화면의 요청이 CORS에서 차단된다                                     |
| `API_URL`, `TRUST_PROXY`                   | 삭제                        | OAuth 콜백이 배포 주소로 이동하고, 로컬에는 프록시가 없다                              |
| `RESOURCE_MONITOR`                         | 삭제                        | 노트북 CPU를 서버 자원으로 기록하고 알림 메일까지 발송한다                             |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | 비움 → 개발용 OAuth 앱 값   | 배포용 앱은 콜백이 배포 도메인이라, 로컬에서는 GitHub가 `redirect_uri` 오류를 반환한다 |

GitHub OAuth 앱은 등록한 콜백 주소로만 리다이렉트하므로([GitHub 문서: Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)), 로컬 로그인에는 콜백이 `http://localhost:4000/…`인 개발용 앱이 별도로 필요하다. 나머지(AI·번역·R2·메일 키 등)는 그대로 유지했다. 그 결과 로컬에서 메일 기능을 시험하면 실제 메일이 발송되고, 파일을 업로드하면 실제 버킷에 저장된다.

## 시행착오 정리

| 단계 | 실수                                               | 대응                                                                      |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 0    | 처음 보는 호스트 키에 지문 확인 없이 `yes`         | 콘솔이나 서버 안에서 확인한 지문과 대조한 뒤 답한다                       |
| 0    | 실패한 `ssh … > 파일`이 빈 파일을 생성             | 파일은 접속 성공을 확인한 뒤 `scp`로 내려받는다                           |
| 2    | `Enter passphrase`에 공개 키를 입력하려 함         | 요구하는 값은 키 생성 시 지정한 암호다. `ssh-keygen -y`로 확인한다        |
| 3    | 생성 직후 접속해 `refused`·`closed`                | 1~2분 대기한다. 거부와 연결 종료는 방화벽이 아니라 부팅 중이라는 뜻이다   |
| 4    | 부트 볼륨을 분리한 상태로 서버를 시작하려 함       | 중단하려면 역순으로 다시 연결한 뒤 시작한다                               |
| 5    | 비활성 버튼 대신 Replace boot volume을 사용할 뻔함 | Replace는 부트 디스크를 교체하는 기능이다. CLI로 데이터 볼륨으로 연결한다 |
| 5    | Cloud Shell 안내 투어에서 명령을 입력              | Ctrl+C로 종료하고 일반 프롬프트에서 입력한다                              |
| 5    | 빈 변수, 수동 복사한 OCID                          | `--query … --raw-output`으로 저장하고 `echo "[$변수]"`로 확인한다         |
| 6    | `lsblk`를 Cloud Shell에서, `scp`를 서버에서 실행   | 실행 전에 프롬프트 앞부분을 확인한다                                      |
| 6    | (임시 VM이 재부팅되어 원래 디스크로 부팅)          | 디스크를 연결한 뒤에는 재부팅하지 않고, 작업 전에 `findmnt /`로 확인한다  |

## 정리

- SSH 비밀 키는 다시 내려받을 수 없다. 새 키를 생성해 `authorized_keys`에 추가하는 것이 복구 방법이다
- 비밀번호가 있는 계정이 없는 Ubuntu 서버는 시리얼 콘솔로도 접속할 수 없다. 부트 볼륨을 다른 VM에 데이터 볼륨으로 연결해 수정한다
- 콘솔 버튼이 비활성이면 Cloud Shell의 OCI CLI로 연결한다. Paravirtualized이면 연결 즉시 인식된다
- 같은 이미지에서 생성된 두 디스크는 루트 레이블이 같다. 연결한 상태로 재부팅하면 연결한 디스크로 부팅될 수 있고, 그러면 cloud-init이 호스트 키를 교체하고 임시 VM의 공개 키를 추가한다
- 호스트 키가 바뀌면 배포가 사용하는 `DEPLOY_KNOWN_HOSTS`를 교체하고, 분실한 이전 키 줄은 삭제한다
- 새 비밀 키와 암호는 비밀번호 관리자처럼 Mac 외부에도 보관한다. Mac을 초기화하기 전에는 `~/.ssh`와 `.env`처럼 저장소에 없는 파일부터 백업한다

배포 문서의 키 복구 절차도 이번 실제 작업 순서로 수정했다.

## 참고한 공식 문서

영어 문서는 이 글과 관련된 부분만 번역해 인용했다.

<details>
<summary>공식 문서 11개와 인용 내용</summary>

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
  - 첫 부팅이면 "per-instance" 설정을 모두 실행하고, 이후 부팅에서는 "per-boot" 설정만 실행한다.
  - 파일시스템이 새 인스턴스에 붙으면 캐시가 그대로 남을 수 있고, instance ID 비교가 이를 첫 부팅으로 알아채게 한다.
- [Module reference: SSH](https://docs.cloud-init.io/en/latest/reference/modules.html) (cloud-init)
  - `ssh_deletekeys`: "호스트 SSH 키를 지운다. 기본 호스트 키가 든 이미지의 비밀 호스트 키를 다시 쓰지 않게 한다. 기본값 `true`."
  - `allow_public_ssh_keys`: "`true`면 데이터소스 메타데이터의 공개 SSH 키를 사용자의 `.ssh/authorized_keys` 파일로 가져온다. 기본값 `true`."
  - 실행 빈도: 인스턴스마다 한 번(once-per-instance).
- [Error 530](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-530/), [Error 1033](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/) (Cloudflare)
  - 530: "Cloudflare가 원본 호스트 이름을 확인하지 못한다는 뜻이다." 자세한 원인은 함께 오는 1XXX 오류를 본다.
  - 1033: "터널이 Cloudflare 네트워크에 연결되어 있지 않다. 트래픽을 받을 정상 `cloudflared` 인스턴스를 찾지 못했기 때문이다."

</details>

## 관련 글

- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- [서버 하드닝은 문서가 아니라 스크립트로 남긴다](/memo/server-hardening-audit)
- [커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기](/memo/secret-scanning)

[^ocid]: Oracle Cloud Identifier. OCI의 모든 리소스에 부여되는 고유 ID로, `ocid1.instance.oc1.…` 형식의 긴 문자열이다. [Oracle 문서: Resource Identifiers](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/identifiers.htm)

[^cloud-init]: 클라우드 VM의 첫 부팅 시각에 호스트 이름, SSH 키, 사용자 등을 메타데이터에 따라 설정하는 초기화 도구. [cloud-init 문서](https://docs.cloud-init.io/en/latest/)

#MacFolio #서버 #SSH #트러블슈팅

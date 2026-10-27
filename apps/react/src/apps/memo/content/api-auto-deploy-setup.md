---
title: 자동 배포를 실제 서버에 적용하기 - 막힌 곳 다섯
date: 2026-10-05
category: 개발 기록/MacFolio/배포·품질/배포·운영
summary: 로컬에서 모두 시험한 자동 배포를 실제 서버에 적용하면서 다섯 번 막혔다. 첫 배포의 백업, 자리표시, 명령 실행 위치 혼동, 두 번 만든 SSH 키, Secrets보다 먼저 한 머지. 실패한 실행이 배포를 누락시킨 일과, 비교 대상을 서버 버전으로 바꾼 것까지 적었다.
---

[API 자동 배포](/memo/api-auto-deploy)는 로컬 레지스트리로 성공·실패·되돌리기까지 시험한 뒤 머지했다. 남은 작업은 실제 서버에 적용하는 세 가지였다.

1. 서버 `compose.yml`의 api 서비스를 `build:`에서 `image:`로 바꾼다.
2. 첫 배포를 실행한다.
3. 배포 전용 SSH 키를 만들어 GitHub Secrets에 등록한다.

이 과정에서 아래 그림의 여섯 곳에서 막혔다.

자동 배포의 흐름은 이렇다. main에 API 변경이 들어오면 Actions가 이미지를 빌드해 GHCR에 푸시하고(`sha-커밋 7자리` 태그), 배포 전용 SSH 키로 서버에 접속해 `ops/deploy.sh sha-…`를 실행한다. 스크립트는 DB를 백업하고, 이미지를 내려받아 컨테이너를 교체하고, 컨테이너가 healthy이고 `/health`의 version이 일치하는지 확인한다. 일치하지 않으면 이전 버전으로 되돌린다. 이 글의 수정은 PR [#107](https://github.com/hyeoniverse/MacFolio/pull/107)(첫 배포 버그, 자리표시)과 [#108](https://github.com/hyeoniverse/MacFolio/pull/108)(서버에서 한 번에 하는 설정)에 들어 있다.

![막힌 여섯 곳](./images/api-auto-deploy-setup-blockers.svg '0~6. 빨강은 배포가 실패하거나 빠진 곳, 노랑은 사람이 헷갈린 곳')

## 0. 이미지는 처음부터 공개였다

머지하자 Actions가 첫 이미지(`sha-a38ac7e`)를 GHCR에 푸시했다. 문서에는 "새로 만든 패키지는 비공개이니 공개로 바꾼다"고 적어 두었는데, 로그인 없이 pull해 보니 바로 성공했다(HTTP 200). 공개 저장소에 연결된 패키지라 처음부터 공개였다. 문서의 이 단계를 "공개 여부를 확인하고, 비공개면 바꾼다"로 수정했다.

## 1. 첫 배포가 백업에서 멈췄다

```text
배포 시작: 없음 → sha-a38ac7e
error while interpolating services.api.image: required variable API_TAG is missing a value: …
백업 실패: pg_dump
```

첫 배포에는 `.env`에 `API_TAG`가 없는데, 서버 `compose.yml`의 `${API_TAG:?…}` 때문에 배포 직전 백업(`docker compose exec db pg_dump`)까지 거부됐다. 원인과 수정 방법은 [API 자동 배포](/memo/api-auto-deploy)의 '서버에서 처음 실행하자 백업에서 멈췄다'에 적었다([#107](https://github.com/hyeoniverse/MacFolio/pull/107)). 수정이 배포되기 전에는 환경 변수로 태그를 직접 넘겨 `API_TAG=sha-a38ac7e ops/deploy.sh sha-a38ac7e`로 첫 배포를 마쳤다.

## 2. `<태그>`를 그대로 붙여 넣었다

```text
$ ~/macfolio/ops/deploy.sh sha-<태그>
-bash: syntax error near unexpected token `newline'
```

문서의 명령에 `sha-<커밋 7자리>` 같은 자리표시를 썼다. 그대로 붙여 넣으면 bash가 `<`와 `>`를 입출력 리디렉션[^redirect] 기호로 해석해 구문 오류로 끝난다. 백업 복원 안내의 `~/backups/<파일>`에서도 같은 오류가 났다. 명령 안의 자리표시를 실제 형식의 예(`sha-a38ac7e`)로 바꾸고, "예시 값이니 바꿔서 실행한다"는 안내를 명령 밖의 문장으로 적었다.

## 3. 명령을 실행할 기계를 혼동했다

처음 안내는 "키는 내 컴퓨터에서 만들고, 공개 키를 서버의 `authorized_keys`에 추가한다"였다. 명령이 내 컴퓨터와 서버를 오갔고, 서버에서 실행할 명령을 내 컴퓨터 터미널에서 실행했다.

```text
… MacBook … % tail -n 1 ~/.ssh/authorized_keys
tail: /Users/…/.ssh/authorized_keys: No such file or directory
… MacBook … % ssh -i ~/.ssh/macfolio-deploy ubuntu@$SERVER ls
ssh: Could not resolve hostname : nodename nor servname provided, or not known
```

첫 오류는 내 컴퓨터에 없는 `authorized_keys`를 읽으려 한 것이고, 둘째는 `$SERVER` 변수가 내 컴퓨터의 셸에는 정의되어 있지 않아 호스트 이름이 빈 문자열이 된 것이다. 그래서 **모든 작업을 서버에서 한 번에** 하도록 바꿨다.

| 방법                                         | 장점                                     | 단점                                                    |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| 내 컴퓨터에서 만들고 공개 키를 서버에 추가   | 일반적인 안내 방식                       | 명령이 두 기계를 오간다. 개인 키가 내 컴퓨터에도 남는다 |
| 서버에서 만들고 출력해 Secrets로 (고른 방법) | 한 기계에서 끝난다. 복사할 값만 출력된다 | 출력 뒤 서버의 키 파일을 삭제해야 한다                  |

바꾼 절차는 서버에서 키를 만들고, `authorized_keys`에 제한 옵션을 붙여 등록하고, GitHub에 등록할 값 세 개(서버 IP, 서버 호스트 키, 개인 키)를 차례로 출력한다. 내 컴퓨터와 서버 사이에 파일을 옮기지 않는다. 키는 GitHub과 서버에만 있으므로 연결 시험도 Actions에서 한다. 문서 맨 앞에는 "프롬프트가 `ubuntu@…`로 시작하면 서버"라는 구분법을 적었다.

## 4. Permission denied (publickey)

Secrets를 등록하고 Actions에서 배포를 실행하자 `exit code 255`로 실패했다.

```text
ubuntu@***: Permission denied (publickey).
```

로그로 보면 단계별 상태는 다음과 같았다.

| 단계                           | 결과                       |
| ------------------------------ | -------------------------- |
| TCP 연결 (22번 포트)           | 성공                       |
| 호스트 키 검증 (`known_hosts`) | 성공                       |
| 사용자 키 인증                 | 실패 (`Permission denied`) |

3번 과정에서 키를 두 번 만들었다. 한 번에 실행하는 명령에 "이미 등록되어 있으면 다시 추가하지 않는다"는 조건이 있어서, 서버의 `authorized_keys`에는 첫 번째 키만 남고 GitHub Secrets에는 두 번째 키가 등록됐다.

조건을 반대로 바꿨다. **항상 예전 배포 키 줄을 삭제하고 새로 만들어 등록한다.**

```bash
sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys
rm -f ~/macfolio-deploy ~/macfolio-deploy.pub
ssh-keygen -q -t ed25519 -N "" -C github-actions-deploy -f ~/macfolio-deploy
echo "restrict,command=\"/home/ubuntu/macfolio/ops/deploy.sh\" $(cat ~/macfolio-deploy.pub)" >> ~/.ssh/authorized_keys
echo "등록된 배포 열쇠 수: $(grep -c github-actions-deploy ~/.ssh/authorized_keys)"
```

![키 등록 순서](./images/api-auto-deploy-setup-keys.svg '먼저 삭제하고 새로 등록하므로 몇 번을 실행해도 배포 키는 하나다')

- `restrict`: 포트 포워딩과 터미널 할당을 차단한다.
- `command=`: 이 키로 접속하면 클라이언트가 보낸 명령과 관계없이 `ops/deploy.sh`만 실행한다. 클라이언트가 보낸 문자열은 `SSH_ORIGINAL_COMMAND`로 전달되고, 스크립트는 `sha-[0-9a-f]{7,40}` 형식만 허용한다. 키가 유출되어도 가능한 일은 "레지스트리에 있는 이미지 태그로 배포"뿐이다.

이 절차는 몇 번을 실행해도 서버에 배포 키가 하나만 남고, 그 키가 방금 출력한 키다. 평소 접속하는 키는 주석이 다른 줄이라 삭제되지 않는다. 마지막 줄의 `등록된 배포 열쇠 수: 1` 출력으로 결과를 확인한다. 새 키로 `DEPLOY_SSH_KEY`만 교체하자 배포가 통과했다.

```text
서버에서 배포:      배포 시작: sha-a38ac7e → sha-a38ac7e
                    이미 이 버전이 떠 있다: sha-a38ac7e
바깥에서 버전 확인: 확인: {"status":"ok","database":"up","version":"sha-a38ac7e"}
```

## 5. Secrets보다 먼저 머지한 PR

설정하는 동안 API를 바꾼 PR 두 개(첫 배포 수정, AI 요약 Groq)가 머지됐다. 그 시각에는 Secrets가 없어서 Actions는 이미지(`sha-5531e4f`)만 빌드하고 서버 배포 단계는 건너뛰었다. 서버 설정 전에 머지해도 CI가 실패하지 않도록 의도한 동작이지만, 그 결과 서버는 예전 버전으로 남는다. 해결 방법은 그 태그로 'API 배포' 워크플로를 수동으로 한 번 실행하는 것이다. 문서의 문제 해결 표에 "API 변경을 머지했는데 `/health`의 version이 그대로"를 추가했다.

## 6. 실패한 실행이 배포를 빠뜨렸다

며칠 뒤 CORS를 수정한 API 변경([#115](https://github.com/hyeoniverse/MacFolio/pull/115))을 머지했는데, 그 CI 실행이 메뉴 막대 E2E 시험 하나 때문에 실패했다. 시험을 수정한 PR([#116](https://github.com/hyeoniverse/MacFolio/pull/116))을 머지하자 CI는 통과했지만, API 이미지 빌드와 배포 단계가 모두 건너뛰어졌다. 서버는 여전히 `sha-a38ac7e`였다.

API 변경 여부를 **직전 push와 비교**해서 판정했기 때문이다. #116의 push에는 API 변경이 없으므로 배포 대상이 없다고 판정했다. #115의 API 변경은 실패한 실행에만 포함되어 이후 어떤 실행에서도 배포되지 않았다. 5번에서 Secrets 등록 전에 머지한 변경이 배포되지 않은 것도 같은 원인이다.

![비교 대상 바꾸기](./images/api-auto-deploy-setup-compare.svg '직전 push와 비교하면 실패한 실행의 변경이 누락된다')

비교 대상을 **서버에서 실제로 실행 중인 버전**으로 바꿨다(커밋 `39f64038e`). 배포 확인에 쓰던 `/health`의 version(`sha-커밋`)을 읽고, 그 커밋과 이번 커밋 사이에 API 관련 파일이 바뀌었으면 배포한다. 서버에 접속할 수 없거나 저장소에 없는 커밋이면 변경이 있는 것으로 판정한다. 이 단계만 분리해 로컬에서 실행하고 세 경우를 확인했다.

```text
서버와 다른 커밋     서버의 API: sha-a38ac7e → api=true
서버와 같은 커밋     서버의 API: sha-a38ac7e → api=false
서버에 닿지 않음     서버의 API: 알 수 없음  → api=true
```

이제 중간 실행이 실패해도, 다음 머지가 서버 버전과 main 사이의 변경 전체를 배포한다.

<details><summary>배포 여부 판정 단계 (ci.yml)</summary>

```bash
deployed=$(curl -fsS --max-time 10 "$VITE_API_URL/health" | jq -r '.version // empty' || true)
commit=${deployed#sha-}
if [ -z "$commit" ] || ! git cat-file -e "$commit^{commit}" 2>/dev/null; then
	echo "api=true" >> "$GITHUB_OUTPUT"
elif git diff --quiet "$commit" "$GITHUB_SHA" -- apps/api packages/desktop-core packages/contracts package.json pnpm-lock.yaml pnpm-workspace.yaml ops/deploy.sh; then
	echo "api=false" >> "$GITHUB_OUTPUT"
else
	echo "api=true" >> "$GITHUB_OUTPUT"
fi
```

</details>

이전에는 비교 기준으로 `$BEFORE`(`github.event.before`, 직전 push의 커밋)를 썼다. 수정은 그 자리에 서버의 커밋을 넣은 것뿐이다. 비교 경로에는 지금 `packages/contracts`와 `packages/desktop-core`도 들어 있다. API가 이 패키지를 쓰게 된 뒤에 추가했다. 서버의 커밋이 몇 커밋 전이든 `git diff`할 수 있도록 `actions/checkout`에 `fetch-depth: 0`[^fetch-depth]을 지정한다.

## 남긴 것

- `docs/deployment.md` '자동 배포 설정'을 서버에서 한 번에 하는 방법으로 다시 작성했다 (여러 번 실행해도 같은 결과가 나오는 명령 하나)
- 문제 해결 표에 `Permission denied (publickey)`, version이 그대로인 경우, `No such file`·`Could not resolve hostname :`을 추가했다
- 스크립트의 첫 배포 버그는 [#107](https://github.com/hyeoniverse/MacFolio/pull/107)에서 수정했다
- 배포 판정 기준을 서버 버전으로 바꿨다 (`39f64038e`)

로컬 시험은 스크립트가 맞는지는 확인해 주지만, 사람이 그 스크립트를 서버에 적용하는 과정까지는 확인해 주지 않았다. 1~5번 다섯 곳 가운데 넷(2~5번)이 적용 과정에서 발생했다.

## 남은 것, 배운 것

- 서버가 일시적으로 응답하지 않으면 항상 `api=true`가 되어 이미지를 다시 빌드한다. 같은 버전이면 `deploy.sh`가 "이미 이 버전이 떠 있다"를 출력하고 종료하므로 서버에는 영향이 없고, 빌드 시간만 추가된다.
- 자리표시 `<…>`는 문서에서 쓰지 않기로 했다. 명령은 대개 읽지 않고 그대로 붙여 넣기 때문이다. 붙여 넣어도 안전한 예시 값을 쓰고, 바꿀 부분은 명령 밖의 문장으로 적는다.
- 멱등성[^idempotent]은 스크립트뿐 아니라 사람이 따라 하는 설정 절차에도 필요했다. 한 번에 성공한다고 가정한 절차는 두 번째 실행에서 오류 없이 서버와 GitHub의 키를 어긋나게 만들었다.
- 변경 여부는 직전 실행이 아니라 실제 상태와 비교해 판정한다. 실행은 실패하거나 건너뛸 수 있지만, 서버의 `/health`가 응답하는 버전은 실제로 실행 중인 코드를 가리킨다.

## 따라 하기: 처음 한 번

전체 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정 (한 번)'에 있다. 프롬프트가 `ubuntu@…`로 시작하는 명령은 서버에서, 나머지는 내 컴퓨터나 GitHub 화면에서 실행한다.

| 단계 | 어디서 | 할 일                                                                              | 확인                            |
| ---- | ------ | ---------------------------------------------------------------------------------- | ------------------------------- |
| 1    | 서버   | `compose.yml`의 api를 `image:`로 바꾸고 `~/macfolio/ops/deploy.sh sha-…`로 첫 배포 | `.env`에 `API_TAG=`가 생긴다    |
| 2    | 서버   | 배포 전용 키를 만들고 `restrict,command=…`로 등록                                  | `등록된 배포 열쇠 수: 1`        |
| 3    | GitHub | Secrets에 `DEPLOY_HOST`·`DEPLOY_KNOWN_HOSTS`·`DEPLOY_SSH_KEY`                      | 서버의 키 파일을 삭제한다       |
| 4    | GitHub | Actions → API 배포 → Run workflow (지금 태그)                                      | 로그에 "이미 이 버전이 떠 있다" |

태그는 자리표시(`<태그>`)가 아니라 실제 값(`sha-` + 7자리)을 입력한다. 현재 서버 버전은 외부에서 확인할 수 있다.

```bash
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# {"status":"ok","database":"up","version":"sha-7e7eac0"}
```

- 되돌리기: Run workflow에 예전 태그를 넣으면 그 이미지로 교체된다. 실제 서버에서 동작하는지는 [되돌리기 훈련](/memo/rollback-drill)에서 확인했다.
- 배포 키 폐기: 서버의 `~/.ssh/authorized_keys`에서 `github-actions-deploy`로 끝나는 줄을 삭제한다(`sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys`).

SSH 키의 `command=`·`restrict` 옵션은 [OpenSSH authorized_keys 설명](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT), Secrets는 [GitHub Actions 문서](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)에 있다.

## 관련 글

- [API 자동 배포 - 이미지는 Actions에서 빌드, 서버는 컨테이너 교체만](/memo/api-auto-deploy)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다](/memo/rollback-drill)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)

[^redirect]: 셸에서 `<파일`은 파일을 표준 입력으로, `>파일`은 표준 출력을 파일로 연결한다. `sha-<태그>`는 "`태그`라는 파일을 입력으로 읽고, 출력은 (이름 없는) 파일로"가 되어 `>` 뒤에 파일 이름이 없다는 구문 오류(`unexpected token 'newline'`)가 난다. [Bash 매뉴얼: Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)

[^fetch-depth]: `actions/checkout`은 기본값(`fetch-depth: 1`)으로 마지막 커밋 하나만 내려받는다. `0`은 전체 기록을 내려받는다는 뜻이다. [actions/checkout](https://github.com/actions/checkout)

[^idempotent]: 같은 작업을 여러 번 실행해도 결과가 한 번 실행한 것과 같은 성질.

#MacFolio #배포 #서버 #트러블슈팅

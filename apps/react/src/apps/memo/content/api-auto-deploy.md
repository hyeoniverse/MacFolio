---
title: 배포 자동화 2 - command= 제한 SSH 키와 GHCR 이미지로 하는 API 자동 배포와 롤백
date: 2026-10-05
category: 개발 기록/MacFolio/배포·운영
summary: main에 머지하면 Actions가 API 이미지를 GHCR에 올리고, 명령 하나만 실행하는 SSH 키로 서버의 deploy.sh를 부른다. 서버는 백업, 교체, 헬스 체크를 거쳐 실패하면 이전 이미지로 되돌린다. 실제 서버에서 막힌 곳과 /health 버전으로 바꾼 배포 판정 기준을 정리했다.
---

API를 배포하려면 서버에 SSH로 접속해 `git pull`과 `docker compose up -d --build`를 직접 실행해야 했다. 서버는 RAM 1GB(Oracle E2.1.Micro)라 빌드에 10분 넘게 걸리고, 빌드하는 동안 API 응답도 느려진다. 또 "새 API를 쓰는 화면은 **API를 먼저 배포하고** 머지한다"는 순서를 사람이 기억해야 했다.

10월 3일 오전, 문서에 적어 둔 업데이트 순서를 서버에 그대로 붙여 넣었더니 세 명령이 모두 실패했다.

| 명령                               | 실패 원인                                          |
| ---------------------------------- | -------------------------------------------------- |
| `pg_dump … > backup.sql`           | 서버에 `pg_dump`가 없다. DB는 컨테이너 안에 있다   |
| `git pull`                         | 홈 폴더는 git 저장소가 아니다. 코드는 `~/macfolio` |
| `docker compose up -d --build api` | compose 파일은 `~/deploy`에 있다                   |

폴더를 옮겨 다시 실행하자 `docker compose logs -f api`에 "11 migrations found"가 출력되며 API가 시작됐지만, 1GB 서버에서 빌드까지 하느라 오래 걸렸다. 순서와 위치를 사람이 기억해야 하는 배포를 자동 배포로 바꿨다.

지금은 main에 머지하면 이미지 빌드부터 서버 교체까지 자동으로 진행된다. 워크플로(`.github/workflows/ci.yml`의 이미지 단계와 `deploy-api.yml` 91줄)와 서버 스크립트(`ops/deploy.sh` 151줄)는 PR [#104](https://github.com/hyeoniverse/MacFolio/pull/104), 첫 배포 버그는 [#107](https://github.com/hyeoniverse/MacFolio/pull/107), 서버에서 한 번에 하는 설정은 [#108](https://github.com/hyeoniverse/MacFolio/pull/108)에 있다.

![자동 배포 흐름](./images/api-auto-deploy-pipeline.svg 'check 뒤에 API가 바뀐 커밋만 이미지를 만들고, 서버의 deploy.sh가 백업·교체·확인·되돌리기를 한다. 프론트엔드는 그 뒤에')

## 서버에서 빌드하지 않는다

이미지는 GitHub Actions가 [`docker/build-push-action`](https://github.com/docker/build-push-action)으로 빌드해 GHCR(`ghcr.io/hyeoniverse/macfolio-api`)[^ghcr]에 푸시한다. 서버가 amd64라 amd64 이미지만 빌드하고, 레이어 캐시는 Actions 캐시에 저장한다. 필요한 권한은 `GITHUB_TOKEN`의 `packages: write` 하나다. 공개 저장소에 연결된 패키지라 이미지는 처음부터 공개였고, 로그인 없이 pull하면 HTTP 200이 응답한다.

빌드 인자로 커밋 SHA를 넣는다(`APP_VERSION=sha-1a2b3c4`). `/health`가 이 값을 `version`으로 응답하므로, 지금 실행 중인 서버가 어느 커밋인지 외부에서 확인할 수 있다. 배포의 마지막 확인과 배포 여부 판정도 이 값으로 한다.

```json
{ "status": "ok", "database": "up", "version": "sha-1a2b3c4" }
```

## 서버 접속 경로: 명령 하나만 실행하는 키

Actions가 서버에 SSH로 접속해야 한다. GitHub 호스팅 러너의 IP는 고정되어 있지 않아서 22번 포트를 열어 둔다(키 인증만 허용). 대신 배포 전용 키를 따로 만들고, 서버의 `authorized_keys`에서 그 키로는 **배포 스크립트 하나만** 실행되게 제한했다([OpenSSH `authorized_keys` 형식](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT)).

```
restrict,command="/home/ubuntu/macfolio/ops/deploy.sh" ssh-ed25519 AAAA… github-actions-deploy
```

- `restrict`: 포트 포워딩, 에이전트 포워딩, 터미널 할당을 모두 차단한다.
- `command=`: 이 키로 접속하면 클라이언트가 보낸 명령 대신 `ops/deploy.sh`가 실행된다. 클라이언트가 보낸 문자열은 환경 변수 `SSH_ORIGINAL_COMMAND`로 전달된다.

스크립트는 이 문자열이 `sha-[0-9a-f]{7,40}` 형식일 때만 진행한다. `'sha-abc; rm -rf /'`를 보내면 "태그 모양이 아니다"를 출력하고 종료 코드 2로 끝난다. 키가 유출되어도 가능한 일은 "레지스트리에 이미 있는 이미지 태그로 배포"뿐이다. 서버의 호스트 키도 Secrets(`DEPLOY_KNOWN_HOSTS`)에 고정해서, 다른 서버가 같은 주소로 응답해도 접속하지 않는다.

서버가 새 이미지를 주기적으로 확인하는 방식(cron, [Watchtower](https://containrrr.dev/watchtower/))도 검토했다. 서버로 들어오는 경로가 필요 없지만, 배포가 끝났는지 Actions가 알 수 없어서 프론트엔드 배포를 API 배포 뒤에 배치할 수 없었다.

| 방법                                       | 좋은 점                                       | 버린 이유 / 고른 이유                                      |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| 서버에서 `git pull` + `--build` (전)       | 추가 설정이 없다                              | 1GB 서버에서 10분 넘는 빌드, 그동안 API가 느리다           |
| 서버가 레지스트리를 폴링 (Watchtower)      | 서버로 들어오는 경로가 필요 없다              | 완료 여부를 Actions가 모른다. 프론트엔드를 뒤에 둘 수 없다 |
| Actions가 빌드, SSH로 스크립트 (고른 방법) | 결과를 Actions가 안다. 서버는 컨테이너 교체만 | 22번 포트를 열어야 한다 → 명령 하나만 실행하는 키로 제한   |

### 키는 서버에서 만들고, 등록은 멱등하게

처음 안내는 "키는 내 컴퓨터에서 만들고, 공개 키를 서버의 `authorized_keys`에 추가한다"였다. 명령이 두 기계를 오가서, 서버에서 실행할 명령을 내 컴퓨터 터미널에서 실행하는 오류(`authorized_keys: No such file or directory`, 변수가 비어 `Could not resolve hostname :`)가 났다. 그래서 키 생성부터 등록까지 **서버에서 한 번에** 하도록 바꿨다.

| 방법                                         | 장점                                     | 단점                                                    |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| 내 컴퓨터에서 만들고 공개 키를 서버에 추가   | 일반적인 안내 방식                       | 명령이 두 기계를 오간다. 개인 키가 내 컴퓨터에도 남는다 |
| 서버에서 만들고 출력해 Secrets로 (고른 방법) | 한 기계에서 끝난다. 복사할 값만 출력된다 | 출력 뒤 서버의 키 파일을 삭제해야 한다                  |

절차는 서버에서 키를 만들고, `authorized_keys`에 제한 옵션을 붙여 등록하고, GitHub에 등록할 값 세 개(서버 IP, 서버 호스트 키, 개인 키)를 차례로 출력한다. 키는 GitHub과 서버에만 있으므로 연결 시험도 Actions에서 한다.

첫 등록 뒤 Actions에서 배포를 실행하자 `exit code 255`로 실패했다.

```text
ubuntu@***: Permission denied (publickey).
```

| 단계                           | 결과                       |
| ------------------------------ | -------------------------- |
| TCP 연결 (22번 포트)           | 성공                       |
| 호스트 키 검증 (`known_hosts`) | 성공                       |
| 사용자 키 인증                 | 실패 (`Permission denied`) |

설정 중에 키를 두 번 만들었다. 등록 명령에 "이미 등록되어 있으면 다시 추가하지 않는다"는 조건이 있어서, 서버의 `authorized_keys`에는 첫 번째 키만 남고 GitHub Secrets에는 두 번째 키가 등록됐다. 조건을 반대로 바꿨다. **항상 예전 배포 키 줄을 삭제하고 새로 만들어 등록한다.**

```bash
sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys
rm -f ~/macfolio-deploy ~/macfolio-deploy.pub
ssh-keygen -q -t ed25519 -N "" -C github-actions-deploy -f ~/macfolio-deploy
echo "restrict,command=\"/home/ubuntu/macfolio/ops/deploy.sh\" $(cat ~/macfolio-deploy.pub)" >> ~/.ssh/authorized_keys
echo "등록된 배포 열쇠 수: $(grep -c github-actions-deploy ~/.ssh/authorized_keys)"
```

![키 등록 순서](./images/api-auto-deploy-setup-keys.svg '먼저 삭제하고 새로 등록하므로 몇 번을 실행해도 배포 키는 하나다')

이 절차는 몇 번을 실행해도 서버에 배포 키가 하나만 남고, 그 키가 방금 출력한 키다. 평소 접속하는 키는 주석이 다른 줄이라 삭제되지 않는다. 마지막 줄의 `등록된 배포 열쇠 수: 1` 출력으로 결과를 확인한다. 새 키로 `DEPLOY_SSH_KEY`만 교체하자 배포가 통과했다.

```text
서버에서 배포:      배포 시작: sha-a38ac7e → sha-a38ac7e
                    이미 이 버전이 떠 있다: sha-a38ac7e
바깥에서 버전 확인: 확인: {"status":"ok","database":"up","version":"sha-a38ac7e"}
```

## 배포 스크립트

서버 쪽 작업은 `ops/deploy.sh sha-1a2b3c4`(인자는 이미지 태그) 하나가 모두 처리한다.

1. 태그 형식 검사, 잠금(`flock`[^flock]으로 두 배포가 동시에 실행되지 않게, 최대 600초 대기)
2. **배포 직전 백업**: 새 버전에 마이그레이션이 있으면 DB 구조가 바뀐다. 바뀌기 전 상태를 서버에 보관한다(매일 실행하는 백업 스크립트를 "서버에만 저장, 알림 없음" 옵션으로 호출)
3. `~/deploy/.env`의 `API_TAG`를 바꾼다. `compose.yml`은 `image: …:${API_TAG}`라서, 서버에서 `docker compose`를 직접 실행해도 배포한 버전이 실행된다
4. 서버에 그 이미지가 없으면 내려받고, 컨테이너를 교체한다
5. 컨테이너가 healthy가 되고 `/health`의 `version`이 그 태그가 될 때까지 기다린다(최대 120초)
6. 성공하면 현재 버전과 이전 버전 이미지만 남기고 나머지를 삭제한다. 1GB 서버라 디스크 사용량도 줄인다
7. 헬스 체크에 실패하면 이전 태그로 되돌린다. 이전 이미지는 서버에 남아 있으므로 다시 내려받지 않는다

![deploy.sh의 분기](./images/api-auto-deploy-script.svg '종료 경로마다 종료 코드가 정해져 있어서 Actions가 성공·실패를 구분한다')

배포 성공의 조건은 두 가지다. 컨테이너의 Docker 헬스 상태([`HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck))가 `healthy`이고, 컨테이너 안에서 호출한 `/health`의 `version`이 배포하려는 태그와 같아야 한다. 헬스 상태만 확인하면 이전 컨테이너가 아직 응답하는 시각을 성공으로 잘못 판정할 수 있다.

```bash
is_live() {
	local id status
	id="$(container)"
	[[ -n "$id" ]] || return 1
	status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
	[[ "$status" == healthy ]] &&
		docker compose exec -T "$API_SERVICE" wget -qO- "http://127.0.0.1:4000/health" 2>/dev/null | grep -q "\"version\":\"$1\""
}
```

이 함수를 3초 간격으로 호출하고, 120초(`HEALTH_TIMEOUT` 기본값)를 넘기면 실패로 판정한다. 컨테이너가 시작할 때 마이그레이션을 먼저 실행하므로 여유 있게 잡았다.

### 로컬에서 실패 경로 시험하기

서버에 적용하기 전에 로컬에서 레지스트리 컨테이너([`registry:2`](https://distribution.github.io/distribution/))를 실행하고, 정상 이미지 두 개와 시작 직후 종료되는 이미지 하나(`CMD exit 1`)를 푸시한 뒤 같은 스크립트를 실행했다.

| 시험한 경우               | 결과                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| 첫 배포 (이전 태그 없음)  | 배포 완료, 종료 코드 0                                                        |
| 같은 태그로 다시 배포     | "이미 이 버전이 떠 있다" 출력, 변경 없음                                      |
| 새 버전                   | 배포 완료, `/health`의 version이 새 태그                                      |
| 시작 직후 종료되는 이미지 | 45초 대기 후 "이전 버전으로 되돌린다" → 이전 버전이 다시 healthy, 종료 코드 1 |
| 레지스트리에 없는 태그    | "받지 못해 아무것도 바꾸지 않았다", `.env`도 변경 없음                        |
| 서버에서 빌드한 이미지    | 내려받지 않고 그대로 배포                                                     |
| `'sha-abc; rm -rf /'`     | "태그 모양이 아니다", 종료 코드 2                                             |

`.env`의 다른 줄(비밀 값)과 파일 권한(`600`)이 유지되는지, 정리 뒤 이미지가 두 개만 남는지도 확인했다.

시험 중에 발견해 수정한 버그는 세 가지다.

| 증상                                     | 원인                                                                                                               | 수정                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 배포는 성공했는데 종료 코드 1            | 삭제할 옛 이미지가 없으면 `grep`이 1을 반환하고, `set -o pipefail`[^pipefail] 때문에 스크립트 전체가 실패로 끝났다 | 이미지 정리 단계의 실패는 배포 결과에 반영하지 않는다                                 |
| `unbound variable`로 중단                | `"$previous가 다시 떠 있다"`에서 bash가 한글 바이트까지 변수 이름(`previous가`)으로 읽었다                         | 한국어 바로 앞의 변수는 모두 `${previous}`로 감싼다                                   |
| 이미지를 받지 못했는데 "되돌리기도 실패" | 새 이미지 pull이 실패해 아무것도 바뀌지 않았는데 되돌리기를 실행했고, 이전 이미지까지 다시 내려받으려다 실패했다   | pull 실패 시 `.env`만 원래 값으로 복원하고 종료. 서버에 있는 이미지는 내려받지 않는다 |

## 실제 서버 적용에서 막힌 곳

로컬 시험을 모두 통과한 뒤 서버에 적용한 작업은 세 가지였다. 서버 `compose.yml`의 api 서비스를 `build:`에서 `image:`로 바꾸고, 첫 배포를 실행하고, 배포 전용 SSH 키를 GitHub Secrets에 등록한다. 키를 두 번 만든 문제는 앞 절에 적었고, 나머지는 아래와 같다.

![막힌 여섯 곳](./images/api-auto-deploy-setup-blockers.svg '0~6. 빨강은 배포가 실패하거나 빠진 곳, 노랑은 사람이 헷갈린 곳')

### 첫 배포가 백업에서 멈췄다

```text
배포 시작: 없음 → sha-a38ac7e
error while interpolating services.api.image: required variable API_TAG is missing a value: …
백업 실패: pg_dump
배포 실패: 배포 직전 백업이 되지 않아 멈췄다
```

서버의 `compose.yml`은 태그가 없으면 중단하도록 `${API_TAG:?…}`[^interp]로 작성했다. 첫 배포 시각에는 `.env`에 `API_TAG`가 아직 없다. 그런데 배포 직전 백업도 `docker compose exec db pg_dump`로 DB 컨테이너에 접속한다. compose는 서비스 하나만 다뤄도 파일 전체를 해석하므로, api 서비스의 태그가 없다는 이유로 db 백업까지 거부됐다. 로컬 시험의 compose 파일은 `${API_TAG}`로만 작성해서 이 경우를 재현하지 못했다.

수정이 배포되기 전에는 환경 변수로 태그를 직접 넘겨 `API_TAG=sha-a38ac7e ops/deploy.sh sha-a38ac7e`로 첫 배포를 마쳤다. 수정([#107](https://github.com/hyeoniverse/MacFolio/pull/107))은 스크립트가 호출하는 compose가 항상 태그 값을 갖게 한 것이다. 교체 전에는 현재 태그(첫 배포면 새 태그)를, 교체 후에는 새 태그를 환경 변수로 전달한다(compose는 셸 환경 변수를 `.env`보다 우선한다). 첫 배포에서 이미지를 받지 못하면 `.env`에 `API_TAG` 줄을 남기지 않는다. 그 뒤 서버와 같은 `${API_TAG:?…}`를 쓴 compose 파일로 첫 배포, 첫 배포인데 받지 못하는 태그, 다음 배포, 되돌리기 네 경우를 다시 시험했다.

### `<태그>`를 그대로 붙여 넣었다

```text
$ ~/macfolio/ops/deploy.sh sha-<태그>
-bash: syntax error near unexpected token `newline'
```

문서의 명령에 `sha-<커밋 7자리>` 같은 자리표시를 썼다. 그대로 붙여 넣으면 bash가 `<`와 `>`를 입출력 리디렉션[^redirect] 기호로 해석해 구문 오류로 끝난다. 백업 복원 안내의 `~/backups/<파일>`에서도 같은 오류가 났다. 명령 안의 자리표시를 실제 형식의 예(`sha-a38ac7e`)로 바꾸고, "예시 값이니 바꿔서 실행한다"는 안내를 명령 밖의 문장으로 적었다.

### Secrets보다 먼저 머지한 PR

설정하는 동안 API를 바꾼 PR 두 개(첫 배포 수정, AI 요약 Groq)가 머지됐다. 그 시각에는 Secrets가 없어서 Actions는 이미지(`sha-5531e4f`)만 빌드하고 서버 배포 단계는 건너뛰었다. 서버 설정 전에 머지해도 CI가 실패하지 않도록 의도한 동작이지만, 그 결과 서버는 예전 버전으로 남았다. 그 태그로 'API 배포' 워크플로를 수동으로 한 번 실행해 해결했다. 다음 절의 판정 기준 변경 뒤에는 다음 머지가 이 변경까지 배포한다.

## 배포 판정 기준: 직전 push에서 서버의 /health 버전으로

며칠 뒤 CORS를 수정한 API 변경([#115](https://github.com/hyeoniverse/MacFolio/pull/115))을 머지했는데, 그 CI 실행이 메뉴 막대 E2E 시험 하나 때문에 실패했다. 시험을 수정한 PR([#116](https://github.com/hyeoniverse/MacFolio/pull/116))을 머지하자 CI는 통과했지만, API 이미지 빌드와 배포 단계가 모두 건너뛰어졌다. 서버는 여전히 `sha-a38ac7e`였다.

API 변경 여부를 **직전 push와 비교**해서 판정했기 때문이다. #116의 push에는 API 변경이 없으므로 배포 대상이 없다고 판정했다. #115의 API 변경은 실패한 실행에만 포함되어 이후 어떤 실행에서도 배포되지 않았다. Secrets 등록 전에 머지한 변경이 배포되지 않은 것도 같은 원인이다.

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

서버가 일시적으로 응답하지 않으면 항상 `api=true`가 되어 이미지를 다시 빌드한다. 같은 버전이면 `deploy.sh`가 "이미 이 버전이 떠 있다"를 출력하고 종료하므로 서버에는 영향이 없고, 빌드 시간만 추가된다.

## 연결이 끊겨도 끝까지, 동시에 하나만

CI 워크플로(`ci.yml`)는 같은 브랜치에 새 커밋이 오면 이전 실행을 취소한다(`cancel-in-progress: true`). 배포 도중에 취소되면 SSH 연결이 끊기고, 서버의 스크립트가 중간에 멈춰 `.env`와 실행 중인 컨테이너가 서로 다른 버전을 가리킬 수 있다. 그래서 대응을 세 겹으로 두었다.

1. 스크립트 첫머리에서 `trap '' HUP`으로 연결 끊김 신호(SIGHUP)를 무시해 끝까지 실행한다.
2. 다음 배포는 `flock` 잠금에서 앞 배포가 끝나기를 기다린다.
3. 배포 워크플로(`deploy-api.yml`)는 [`concurrency`](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)의 `cancel-in-progress: false`로 실행을 취소하지 않고 순서대로 처리한다.

## 되돌리기는 이미지만

되돌리기는 **이미지만** 이전 버전으로 바꾼다. 이미 적용된 마이그레이션은 되돌리지 않는다. 그래서 마이그레이션은 이전 버전 코드에서도 동작하도록 나눠 작성한다는 규칙을 `CONTRIBUTING.md`의 '마이그레이션' 절에 적었다.

- 열·표 추가: 새 열은 nullable로 만들거나 기본값을 지정한다. 이전 코드는 모르는 열을 무시한다.
- 이름 변경·삭제: 한 번에 하지 않는다. ① 새 열을 추가하고 코드가 둘 다 쓰게 배포 → ② 다음 배포에서 옛 열을 삭제한다.

![되돌리기는 이미지만](./images/api-auto-deploy-rollback.svg '새 이미지가 실패하면 컨테이너만 이전 버전으로 돌아가고, DB에는 새 마이그레이션이 남는다. 그래서 마이그레이션은 이전 코드와 호환되게 작성한다')

DB까지 되돌려야 하는 경우에는 배포 직전 백업(`~/backups`)을 `ops/restore.sh`로 복원한다([DB 백업](/memo/db-backup)).

## 따라 하기

### 처음 한 번

전체 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '자동 배포 설정 (한 번)'에 있다. 프롬프트가 `ubuntu@…`로 시작하는 명령은 서버에서, 나머지는 내 컴퓨터나 GitHub 화면에서 실행한다.

| 단계 | 어디서 | 할 일                                                                              | 확인                            |
| ---- | ------ | ---------------------------------------------------------------------------------- | ------------------------------- |
| 1    | 서버   | `compose.yml`의 api를 `image:`로 바꾸고 `~/macfolio/ops/deploy.sh sha-…`로 첫 배포 | `.env`에 `API_TAG=`가 생긴다    |
| 2    | 서버   | 배포 전용 키를 만들고 `restrict,command=…`로 등록                                  | `등록된 배포 열쇠 수: 1`        |
| 3    | GitHub | Secrets에 `DEPLOY_HOST`·`DEPLOY_KNOWN_HOSTS`·`DEPLOY_SSH_KEY`                      | 서버의 키 파일을 삭제한다       |
| 4    | GitHub | Actions → API 배포 → Run workflow (지금 태그)                                      | 로그에 "이미 이 버전이 떠 있다" |

태그는 자리표시(`<태그>`)가 아니라 실제 값(`sha-` + 7자리)을 입력한다. 문서의 문제 해결 표에는 `Permission denied (publickey)`, API 변경을 머지했는데 `/health`의 version이 그대로인 경우, `No such file`·`Could not resolve hostname :`을 적었다.

### 평소

```bash
# 평소: API를 바꾼 PR을 main에 머지하면 끝. 진행 상황은 Actions의 ci 실행에서 확인한다
# 지금 서버 버전
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# 서버에서 직접 특정 태그로 (되돌리기도 같은 명령)
~/macfolio/ops/deploy.sh sha-7e7eac0
tail -20 ~/deploy/deploy.log     # 배포 기록
```

- 수동 배포: GitHub → Actions → **API 배포** → Run workflow → 태그 입력. 예전 태그를 넣으면 되돌리기가 된다
- 실패 시: 새 이미지가 120초 안에 healthy가 되지 않으면 스크립트가 이전 태그로 되돌리고 실패로 종료한다. 실제 서버에서 일부러 실패시킨 기록은 [되돌리기 훈련](/memo/rollback-drill)에 있다
- 배포 키 폐기: 서버의 `~/.ssh/authorized_keys`에서 `github-actions-deploy`로 끝나는 줄을 삭제한다(`sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys`)
- 소요 시간: 머지부터 사이트 반영까지 시간의 대부분을 E2E가 차지했다. 10월 19일 머지 뒤 배포가 늦게 끝난 일이 [E2E와 CI를 빠르게](/memo/faster-e2e-ci)로 이어졌다

스크립트: [ops/deploy.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/deploy.sh), 워크플로: [.github/workflows/deploy-api.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/deploy-api.yml). 이미지 저장소는 [GHCR 문서](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), compose는 [Docker Compose 문서](https://docs.docker.com/compose/), Secrets는 [GitHub Actions 문서](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)를 참고했다.

## 남은 것, 배운 것

- 배포 중 API가 응답하지 않는 구간이 있다. 컨테이너를 하나만 실행하므로 교체하는 동안(마이그레이션 포함) 요청이 실패한다. 1GB 서버에 컨테이너 두 개를 동시에 실행할 메모리가 없어서 이 중단 시간을 감수했다. 사이트는 API 없이도 열리게 만들어 두었다.
- 되돌리기는 로컬에서 시험만 했고 실제 서버에서는 실행된 적이 없었다. 그래서 며칠 뒤 헬스 체크에 실패하는 이미지를 서버에 일부러 배포해 되돌리기를 훈련했다([되돌리기 훈련](/memo/rollback-drill)).
- 스크립트 버그 세 가지(`pipefail`과 `grep`, 한글 앞 변수 이름, 받지 못한 이미지의 되돌리기)는 모두 실패 경로에서 나왔다. 성공 경로만 시험했다면 세 가지 모두 실제 배포에서 처음 발생했을 것이다.
- 그래도 서버의 `compose.yml`(`${API_TAG:?…}`)과 로컬 시험용 파일(`${API_TAG}`)의 표기 차이 때문에 첫 배포 버그를 놓쳤다. 이후로 시험 환경의 설정 파일은 실제 파일을 그대로 복사해 쓴다.
- 로컬 시험은 스크립트가 맞는지는 확인해 주지만, 사람이 그 스크립트를 서버에 적용하는 과정까지는 확인해 주지 않았다. 실제 서버에서 막힌 곳 가운데 넷(자리표시, 키 두 번 생성, Secrets 전 머지, 누락된 배포)이 적용 과정에서 발생했다.
- 자리표시 `<…>`는 문서에서 쓰지 않는다. 명령은 대개 읽지 않고 그대로 붙여 넣기 때문이다. 붙여 넣어도 안전한 예시 값을 쓰고, 바꿀 부분은 명령 밖의 문장으로 적는다.
- 멱등성[^idempotent]은 스크립트뿐 아니라 사람이 따라 하는 설정 절차에도 필요했다. 한 번에 성공한다고 가정한 절차는 두 번째 실행에서 오류 없이 서버와 GitHub의 키를 어긋나게 만들었다.
- 변경 여부는 직전 실행이 아니라 실제 상태와 비교해 판정한다. 실행은 실패하거나 건너뛸 수 있지만, 서버의 `/health`가 응답하는 버전은 실제로 실행 중인 코드를 가리킨다.

## 관련 글

- [배포 자동화 3 - HEALTHCHECK가 실패하는 이미지로 자동 배포 롤백 훈련하기](/memo/rollback-drill)
- [서버 운영 2 - pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)
- [서버 운영 1 - Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)
- [배포 자동화 1 - Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [E2E 시험 5 - git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci)

[^ghcr]: GitHub Container Registry. GitHub 패키지 중 컨테이너 이미지를 저장하는 레지스트리로, 주소는 `ghcr.io/<소유자>/<이미지>`다.

[^flock]: 파일 하나를 잠금 대상으로 삼아 프로세스 간 상호 배제를 하는 리눅스 명령. `flock -w 600 9`는 파일 디스크립터 9번이 가리키는 잠금 파일을 최대 600초 기다려 얻는다.

[^pipefail]: bash 옵션. 파이프라인(`a | b`) 중 하나라도 0이 아닌 종료 코드를 내면 파이프라인 전체를 실패로 본다. `set -e`와 함께 쓰면 그 시점에 스크립트가 종료된다.

[^interp]: [Compose 변수 보간](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) 문법. `${VAR:?메시지}`는 VAR가 비어 있거나 없으면 메시지를 출력하고 실패한다.

[^redirect]: 셸에서 `<파일`은 파일을 표준 입력으로, `>파일`은 표준 출력을 파일로 연결한다. `sha-<태그>`는 "`태그`라는 파일을 입력으로 읽고, 출력은 (이름 없는) 파일로"가 되어 `>` 뒤에 파일 이름이 없다는 구문 오류(`unexpected token 'newline'`)가 난다. [Bash 매뉴얼: Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)

[^fetch-depth]: `actions/checkout`은 기본값(`fetch-depth: 1`)으로 마지막 커밋 하나만 내려받는다. `0`은 전체 기록을 내려받는다는 뜻이다. [actions/checkout](https://github.com/actions/checkout)

[^idempotent]: 같은 작업을 여러 번 실행해도 결과가 한 번 실행한 것과 같은 성질.

#MacFolio #배포 #CI #서버 #트러블슈팅

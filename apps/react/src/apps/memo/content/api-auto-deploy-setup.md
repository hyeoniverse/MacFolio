---
title: 자동 배포를 실제 서버에 걸기 - 막힌 곳 다섯
date: 2026-10-05
category: 개발기/MacFolio
summary: 로컬에서 다 시험한 자동 배포를 실제 서버에 걸면서 다섯 번 막혔다. 첫 배포의 백업, 그대로 붙여 넣은 자리표시, 어디서 칠지 헷갈린 명령, 두 번 만든 열쇠, Secrets보다 먼저 머지한 PR. 막힌 순서대로 원인과 바꾼 것을 적었다. 며칠 뒤 실패한 실행이 배포를 빠뜨린 일도 더했다.
---

[API 자동 배포](/memo/api-auto-deploy)는 로컬 레지스트리로 성공·실패·되돌리기까지 시험한 뒤 머지했다. 남은 일은 서버에 거는 것이었다: 서버 `compose.yml`을 이미지로 바꾸고, 첫 배포를 하고, 배포 전용 열쇠를 만들어 GitHub Secrets에 넣는 것. 생각보다 많이 막혔다.

## 0. 이미지는 처음부터 공개였다

머지하자 Actions가 첫 이미지(`sha-a38ac7e`)를 GHCR에 올렸다. 처음 만든 패키지는 비공개라 공개로 바꿔야 한다고 문서에 적어 두었는데, 로그인 없이 받아 보니 바로 받혔다(200). 공개 저장소에 연결된 패키지라 처음부터 공개였다. 문서의 이 단계를 "확인하고, 아니면 바꾼다"로 고쳤다.

## 1. 첫 배포가 백업에서 멈췄다

```text
배포 시작: 없음 → sha-a38ac7e
error while interpolating services.api.image: required variable API_TAG is missing a value: …
백업 실패: pg_dump
```

서버 `compose.yml`은 태그가 없으면 멈추게 `${API_TAG:?…}`로 썼는데, 첫 배포에는 `.env`에 태그가 아직 없다. 배포 직전 백업도 `docker compose`로 DB에 붙어서, compose가 파일을 읽다가 거부했다. 로컬 시험의 compose 파일에는 이 `:?`가 없었다. 스크립트가 부르는 compose가 늘 태그를 알게 고쳤다(#107). 그날은 `API_TAG=sha-a38ac7e ops/deploy.sh sha-a38ac7e`로 넘어갔다.

## 2. `<태그>`를 그대로 붙여 넣었다

```text
$ ~/macfolio/ops/deploy.sh sha-<태그>
-bash: syntax error near unexpected token `newline'
```

문서의 명령에 `sha-<커밋 7자리>` 같은 자리표시를 썼다. 그대로 붙여 넣으면 bash가 `<`와 `>`를 입력·출력을 바꾸는 기호로 읽어 아무것도 하지 않는다. 백업 때도 `~/backups/<파일>`에서 같은 일이 있었다. 명령 안의 자리표시를 실제 모양의 예(`sha-a38ac7e`)로 바꾸고, "예시이니 바꾼다"를 문장으로 적었다.

## 3. 어디서 칠 명령인지 헷갈렸다

처음 안내는 "열쇠는 내 컴퓨터에서 만들고, 공개 키를 서버의 `authorized_keys`에 붙인다"였다. 명령이 내 컴퓨터와 서버를 오갔다. 그러다 보니 서버에서 칠 명령을 내 컴퓨터에서 치게 됐다.

```text
… MacBook … % tail -n 1 ~/.ssh/authorized_keys
tail: /Users/…/.ssh/authorized_keys: No such file or directory
… MacBook … % ssh -i ~/.ssh/macfolio-deploy ubuntu@$SERVER ls
ssh: Could not resolve hostname : nodename nor servname provided, or not known
```

**모든 것을 서버에서 한 번에** 하게 바꿨다. 열쇠를 서버에서 만들고, `authorized_keys`에 제한을 붙여 등록하고, GitHub에 넣을 값 세 개(서버 IP, 서버 호스트 키, 비밀 열쇠)를 차례로 출력한다. 내 컴퓨터와 서버 사이에 옮길 것이 없다. 열쇠는 GitHub과 서버에만 있으니, 연결 시험도 Actions로 한다. 문서 맨 앞에는 "줄 맨 앞이 `ubuntu@…`이면 서버"를 적었다.

## 4. Permission denied (publickey)

Secrets를 넣고 Actions에서 배포를 돌리자 `exit code 255`로 실패했다.

```text
ubuntu@***: Permission denied (publickey).
```

서버에 닿았고(22번 포트), 호스트 키도 맞았다(가짜 서버 걱정 없음). 열쇠만 거부됐다. 오가는 사이에 열쇠를 두 번 만들었는데, 한 번에 하는 명령에 "이미 등록돼 있으면 다시 넣지 않는다"는 조건을 넣어 두는 바람에 첫 열쇠만 서버에 남고, GitHub에는 두 번째 열쇠가 들어갔다.

조건을 반대로 바꿨다. **늘 예전 배포 열쇠 줄을 지우고 새로 만들어 등록한다.** 몇 번을 하든 서버에는 배포 열쇠가 하나만 있고, 그것이 방금 출력한 열쇠다. 평소 접속하는 열쇠는 다른 줄이라 지워지지 않는다. 마지막에 `등록된 배포 열쇠 수: 1`을 찍어 확인하게 했다. 새 열쇠로 `DEPLOY_SSH_KEY`만 바꾸자 통과했다.

```text
서버에서 배포:      배포 시작: sha-a38ac7e → sha-a38ac7e
                    이미 이 버전이 떠 있다: sha-a38ac7e
바깥에서 버전 확인: 확인: {"status":"ok","database":"up","version":"sha-a38ac7e"}
```

## 5. Secrets보다 먼저 머지한 PR

설정하는 사이에 API를 바꾼 PR 둘(첫 배포 수정, AI 요약 Groq)이 머지됐다. 그때는 Secrets가 없어서 Actions는 이미지(`sha-5531e4f`)만 만들고 서버 배포는 건너뛰었다. 서버 설정 전에 머지해도 CI가 깨지지 않게 일부러 그렇게 만든 것인데, 대신 서버는 예전 버전으로 남는다. 그 태그로 'API 배포'를 손으로 한 번 돌리면 된다. 문서의 문제 해결 표에 "API 변경을 머지했는데 `/health`의 version이 그대로"를 더했다.

## 남긴 것

- `docs/deployment.md` '자동 배포 설정'을 서버에서 한 번에 하는 방법으로 다시 썼다 (여러 번 해도 되는 명령 하나)
- 문제 해결 표에 `Permission denied (publickey)`, version이 그대로, `No such file`·`Could not resolve hostname :`
- 스크립트의 첫 배포 버그는 고쳤다 (#107)

로컬 시험은 스크립트가 맞는지는 알려 주지만, 사람이 그 스크립트를 서버에 거는 과정까지는 알려 주지 않았다. 막힌 다섯 곳 가운데 넷이 거는 과정에서 나왔다.

## 6. 실패한 실행이 배포를 빠뜨렸다

며칠 뒤 CORS를 고친 API 변경(#115)을 머지했는데, 그 실행이 메뉴 막대 화면 테스트 하나 때문에 실패했다. 테스트를 고친 PR(#116)을 머지하자 CI는 통과했는데, API 이미지 빌드와 배포가 둘 다 건너뛰어졌다. 서버는 여전히 `sha-a38ac7e`였다.

API가 바뀌었는지를 **직전 push와 비교**해서 정했기 때문이다. #116의 push에는 API 변경이 없으니 배포할 것이 없다고 봤다. #115의 API 변경은 실패한 실행과 함께 묻혔다. 위 5번에서 Secrets 전에 머지한 변경이 남은 것도 같은 구멍이었다.

비교할 대상을 **서버에 실제로 떠 있는 버전**으로 바꿨다. 배포 확인에 쓰던 `/health`의 version(`sha-커밋`)을 읽어, 그 커밋과 이번 커밋 사이에 API 파일이 바뀌었으면 배포한다. 서버에 닿지 않거나 모르는 커밋이면 바뀐 것으로 친다. 단계만 떼어 로컬에서 돌려 세 경우를 확인했다.

```text
서버와 다른 커밋     서버의 API: sha-a38ac7e → api=true
서버와 같은 커밋     서버의 API: sha-a38ac7e → api=false
서버에 닿지 않음     서버의 API: 알 수 없음  → api=true
```

이제 어떤 실행이 실패해도, 다음 머지가 서버와 main의 차이를 통째로 배포한다.

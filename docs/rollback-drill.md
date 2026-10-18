# 되돌리기 훈련 (서버)

헬스 체크가 실패하는 버전을 **진짜 서버에 일부러 배포**해서, `ops/deploy.sh`가 이전 버전으로 되돌리고 GitHub Actions가 실패로 알리는지 확인한다. #100의 남은 두 항목을 닫기 위한 절차다.

- 한 번 일부러 실패시켜 되돌리기 확인 (헬스 체크가 실패하는 이미지)
- 헬스 체크가 실패하는 버전은 이전 버전으로 돌아가고 Actions가 실패로 알린다

로컬 레지스트리로는 #104에서 확인했다. 여기서는 Actions → SSH(배포 전용 키) → `ops/deploy.sh` → 터널까지 진짜 길을 그대로 탄다.

## 방법: 코드를 바꾸지 않는다

main에 깨진 코드를 머지하지 않고, 저장소에 훈련용 스위치도 두지 않는다. 대신 **서버에서 지금 이미지 위에 "언제나 unhealthy"인 층 하나만 얹은 훈련용 이미지**를 만들고, 진짜 커밋이 아닌 태그(`sha-dead000`)를 붙인다.

- `ops/deploy.sh`는 서버에 그 태그의 이미지가 있으면 GHCR에서 받지 않고 그대로 쓴다. 그래서 GHCR에 아무것도 올리지 않는다
- 배포 전용 키는 태그 하나만 보낼 수 있으므로, 컨테이너에 환경 변수를 넘기는 스위치는 새 길을 뚫어야 한다. 이 방법은 그런 길을 만들지 않는다. 새 비밀 값, 새 권한, 새 워크플로 입력이 없다
- 훈련용 이미지는 서버에만 있고 끝나면 지운다. 실수로 켜질 스위치가 남지 않는다

훈련용 이미지는 Dockerfile의 `HEALTHCHECK`만 `false`로 바꾼다. 앱은 지금 버전 그대로 돈다. 서버 `compose.yml`의 api에는 `healthcheck:`가 없어서 이미지의 `HEALTHCHECK`를 쓴다. 따라서 컨테이너는 `starting` → `unhealthy`가 되고, `ops/deploy.sh`는 `HEALTH_TIMEOUT`(120초) 동안 기다린 뒤 되돌린다. (훈련용 이미지의 `/health` version도 지금 태그라서 `sha-dead000`과 맞지 않는다. 두 조건 모두 실패한다.)

## 끊기는 시간

`ops/deploy.sh`는 블루·그린이 아니다. `docker compose up -d api`가 **옛 컨테이너를 멈추고 새 컨테이너를 띄운다**. 그래서 훈련 중 API는 두 번 잠깐 끊긴다.

| 언제                      | 얼마나                                                                              | 왜                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 훈련용 컨테이너로 바꿀 때 | 수 초~수십 초 (`prisma migrate deploy`와 Nest 시작까지, 적용할 마이그레이션은 없다) | 옛 컨테이너를 멈추고 새로 띄운다                                                |
| 기다리는 120초            | 끊기지 않는다                                                                       | 훈련용 컨테이너도 앱은 정상이라 터널로 오는 요청에 답한다 (version만 지금 태그) |
| 이전 버전으로 되돌릴 때   | 수 초~수십 초                                                                       | 다시 컨테이너를 바꾼다                                                          |

정리하면 **두 번, 합쳐 1분 안쪽**이다. 업타임 감시(`uptime.yml`)가 그사이에 돌면 한 번 실패로 알릴 수 있다. 방문이 적은 시간에 한다. 배포 직전 백업(`~/backups`)도 평소처럼 하나 생긴다.

## 준비

- 서버에 평소 쓰는 SSH(내 키)로 들어갈 수 있다. 배포 전용 키가 아니다
- GitHub 저장소에 Actions를 돌릴 권한이 있다
- 지금 배포가 돌고 있지 않다 ([Actions → API 배포](https://github.com/hyeoniverse/MacFolio/actions/workflows/deploy-api.yml)에 진행 중인 실행이 없다). main에 API 변경을 머지하지 않는다
- 지금 상태를 적어 둔다 (아래 1단계)

명령의 `sha-xxxxxxx`는 1단계에서 본 지금 태그로 바꾼다. `<…>` 같은 자리표시를 그대로 붙여 넣지 않는다.

## 절차

### 1. 지금 상태 적기 (서버)

```bash
cd ~/deploy
grep '^API_TAG=' .env                  # 예: API_TAG=sha-65ff5e6  ← 이것이 "이전 버전"이다
docker compose ps api                  # STATUS가 Up … (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo
```

예상:

```text
API_TAG=sha-65ff5e6
NAME             IMAGE                                          … STATUS
macfolio-api-1   ghcr.io/hyeoniverse/macfolio-api:sha-65ff5e6   … Up 3 days (healthy)
{"status":"ok","database":"up","version":"sha-65ff5e6"}
```

`sha-dead000`이 진짜 커밋과 겹치지 않는지 본다. 아무것도 나오지 않아야 한다.

```bash
git -C ~/macfolio rev-parse --verify -q dead000^{commit}
```

### 2. 훈련용 이미지 만들기 (서버)

```bash
cur=$(grep '^API_TAG=' ~/deploy/.env | cut -d= -f2)
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF
docker image ls ghcr.io/hyeoniverse/macfolio-api
```

빌드는 층 하나만 얹으므로 몇 초다 (컨텍스트가 없어 코드를 다시 빌드하지 않는다). 목록에 `sha-dead000`과 지금 태그가 함께 보이면 된다.

### 3. Actions에서 배포 (GitHub)

1. [Actions → API 배포](https://github.com/hyeoniverse/MacFolio/actions/workflows/deploy-api.yml)를 연다. 첫 화면(All workflows)에는 버튼이 없으니 왼쪽 목록에서 **API 배포**를 누른다
2. 오른쪽 위 **Run workflow** 버튼을 누른다
3. Branch는 `main` 그대로, tag에 `sha-dead000`을 넣는다
4. 초록 **Run workflow** 버튼을 누른다

### 4. 지켜보기 (서버, 선택)

실행이 도는 동안 다른 창에서 본다.

```bash
cd ~/deploy
tail -f deploy.log
watch -n 3 docker compose ps api       # 다른 창에서
```

컨테이너가 `sha-dead000`으로 바뀌어 `(health: starting)` → `(unhealthy)`가 되었다가, 약 2분 뒤 이전 태그로 돌아와 `(healthy)`가 된다.

### 5. 결과 확인

**Actions**: 실행이 빨간 X로 끝난다 (전체 약 2~4분).

- **서버에서 배포** 단계가 실패하고, 마지막 줄이 `Error: Process completed with exit code 1.`이다
- **바깥에서 버전 확인** 단계는 건너뛴다 (회색)
- 저장소 알림 설정에 따라 실패 메일이 온다

**서버에서 배포 단계의 로그 (= `~/deploy/deploy.log`)**, 순서대로 이렇게 나온다 (시각은 다르다):

```text
… 배포 시작: sha-65ff5e6 → sha-dead000
… (백업 스크립트의 줄)
… 120초 안에 healthy가 되지 않았다
… 새 버전이 건강하지 않다. api 로그 끝:
api-1  | … Nest application successfully started …
… 이전 버전으로 되돌린다: sha-65ff5e6
… 배포 실패, 되돌림: sha-65ff5e6가 다시 떠 있다
```

앱 로그에는 오류가 없다. 훈련용 이미지는 헬스 체크만 일부러 실패시킨 것이라서 정상이다.

**서버 상태**:

```bash
cd ~/deploy
grep '^API_TAG=' .env                  # API_TAG=sha-65ff5e6 (이전 버전 그대로)
docker compose ps api                  # IMAGE …:sha-65ff5e6, STATUS Up N minutes (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# {"status":"ok","database":"up","version":"sha-65ff5e6"}
```

`Up N minutes`의 N이 훈련 시각과 맞는다 (되돌리며 컨테이너를 새로 만들었다). `.env`의 `API_TAG`가 `sha-dead000`이면 되돌리기가 끝나지 않은 것이다. 아래 '되돌리기가 실패하면'으로 간다.

**프론트엔드**: 손으로 돌린 API 배포는 프론트엔드 `deploy`를 부르지 않으므로 영향이 없다.

### 6. 정리 (서버)

```bash
docker image rm ghcr.io/hyeoniverse/macfolio-api:sha-dead000
docker image ls ghcr.io/hyeoniverse/macfolio-api     # sha-dead000이 없다
ls -t ~/backups | head -n 1                          # 훈련 때 생긴 백업. 두어도 되고 지워도 된다
```

`deploy.log`의 훈련 기록은 남겨 둔다. Actions의 빨간 실행도 기록으로 둔다.

## 되돌리기가 실패하면

로그 끝이 `배포 실패, 되돌리기도 실패`이거나, 5단계에서 이전 버전이 `healthy`가 아니면 손으로 이전 이미지를 고정한다. 이전 이미지는 서버에 남아 있으므로 다시 받지 않는다.

```bash
cd ~/deploy
docker compose ps api; docker compose logs --tail 100 api      # 왜 안 되는지 먼저 본다
~/macfolio/ops/deploy.sh sha-65ff5e6                            # 1단계에서 적은 태그. 백업 → 교체 → healthy 확인까지 한다
```

스크립트가 다른 배포를 기다리며 멈춰 있거나(`flock`) 스크립트 자체가 안 되면, `.env`를 직접 고친다.

```bash
cd ~/deploy
sed -i 's/^API_TAG=.*/API_TAG=sha-65ff5e6/' .env
docker compose up -d api
docker compose ps api                  # (healthy)가 될 때까지 1분쯤
curl -s https://macfolio-api.hyeoniverse.com/health; echo
```

그래도 healthy가 안 되면 훈련과 상관없는 문제다 (DB, `api.env`, 디스크). `docker compose ps`로 db를, `df -h`로 디스크를 본다. 이전 이미지가 지워졌다면 `docker compose pull api`로 GHCR에서 다시 받는다 (공개 패키지라 로그인이 필요 없다). 정리는 위 6단계를 그대로 한다.

## #100에 붙일 체크리스트

```markdown
### 서버 되돌리기 훈련 (docs/rollback-drill.md) — YYYY-MM-DD

- [ ] 훈련 전: `API_TAG=sha-_______`, `/health` version 같음, `(healthy)`
- [ ] 서버에 훈련용 이미지 `sha-dead000` (지금 이미지 + `HEALTHCHECK CMD false`)
- [ ] Run workflow `sha-dead000` → Actions 빨간 X, '서버에서 배포' exit code 1, '바깥에서 버전 확인' 건너뜀 (실행 링크: )
- [ ] 로그: `120초 안에 healthy가 되지 않았다` → `이전 버전으로 되돌린다` → `배포 실패, 되돌림: sha-_______가 다시 떠 있다`
- [ ] 훈련 뒤: `.env`의 `API_TAG`, `docker compose ps api`의 이미지, 바깥 `/health` version이 모두 이전 태그, `(healthy)`
- [ ] 끊긴 시간: 약 __초 (업타임 알림: 있음/없음)
- [ ] 정리: `sha-dead000` 이미지 지움
```

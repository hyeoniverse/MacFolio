[한국어](../rollback-drill.md) | **English**

# Rollback drill (server)

**Deliberately deploy a version whose health check fails to the real server**, and confirm that `ops/deploy.sh` rolls back to the previous version and GitHub Actions reports a failure. This is the procedure for closing the two remaining items in [#100](https://github.com/hyeoniverse/MacFolio/issues/100) ([#254](https://github.com/hyeoniverse/MacFolio/pull/254)).

- Deliberately fail once and confirm the rollback (an image whose health check fails)
- A version whose health check fails goes back to the previous version, and Actions reports a failure

[#104](https://github.com/hyeoniverse/MacFolio/pull/104) already verified this with a local registry. Here the drill takes the real path end to end: Actions → SSH (deploy-only key) → `ops/deploy.sh` → tunnel.

## Approach: don't change the code

I don't merge broken code into main, and I don't keep a drill switch in the repository. Instead, **on the server I build a drill image that adds a single "always unhealthy" layer on top of the current image**, and give it a tag that isn't a real commit (`sha-dead000`).

- If the server already has an image with that tag, `ops/deploy.sh` uses it as is without pulling from GHCR. So nothing is pushed to GHCR
- The deploy-only key can only send a tag, so a switch that passes environment variables to the container would require opening a new path. This approach creates no such path. No new secrets, no new permissions, no new workflow inputs
- The drill image exists only on the server and is deleted afterward. No switch is left behind that could be turned on by mistake

The drill image changes only the Dockerfile's [`HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck) to `false`. The app runs exactly as the current version. The api service in the server's `compose.yml` has no `healthcheck:`, so it uses the image's `HEALTHCHECK`. The container therefore goes `starting` → `unhealthy`, and `ops/deploy.sh` waits for `HEALTH_TIMEOUT` (120 seconds) and then rolls back. (The drill image's `/health` version is also the current tag, so it doesn't match `sha-dead000`. Both conditions fail.)

## Downtime

`ops/deploy.sh` is not a blue-green deployment[^blue-green]. `docker compose up -d api` **stops the old container and starts the new one**. So the API drops briefly twice during the drill.

![The order of pre-deploy backup, swap ①, 120-second healthy wait, swap ② and exit, with the two intervals where the API stops responding](../images/rollback-drill-timeline.svg)

| When                                 | How long                                                                                                                  | Why                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Switching to the drill container     | A few seconds to a few tens of seconds (up to `prisma migrate deploy` and Nest startup; there are no migrations to apply) | Stops the old container and starts the new one                                                                                        |
| The 120-second wait                  | No downtime                                                                                                               | The app in the drill container is healthy too, so it answers requests coming through the tunnel (only the version is the current tag) |
| Rolling back to the previous version | A few seconds to a few tens of seconds                                                                                    | Swaps the container again                                                                                                             |

In short, **twice, under a minute in total**. If uptime monitoring (`uptime.yml`) runs in that window, it may report one failure. Do it at a low-traffic time. The pre-deploy backup (`~/backups`) is also created as usual.

## Preparation

- You can get into the server with your usual SSH (your own key), not the deploy-only key
- You have permission to [run the workflow manually](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow) on the GitHub repository
- No deploy is currently running (no in-progress run in [Actions → Deploy API (API 배포)](https://github.com/hyeoniverse/MacFolio/actions/workflows/deploy-api.yml)). Don't merge API changes into main
- Write down the current state (step 1 below)

Replace `sha-xxxxxxx` in the commands with the current tag you saw in step 1. Don't paste placeholders like `<…>` as is.

## Procedure

### 1. Record the current state (server)

```bash
cd ~/deploy
grep '^API_TAG=' .env                  # e.g. API_TAG=sha-65ff5e6  ← this is the "previous version"
docker compose ps api                  # STATUS is Up … (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo
```

Expected:

```text
API_TAG=sha-65ff5e6
NAME             IMAGE                                          … STATUS
macfolio-api-1   ghcr.io/hyeoniverse/macfolio-api:sha-65ff5e6   … Up 3 days (healthy)
{"status":"ok","database":"up","version":"sha-65ff5e6"}
```

Check that `sha-dead000` doesn't collide with a real commit. Nothing should be printed.

```bash
git -C ~/macfolio rev-parse --verify -q dead000^{commit}
```

### 2. Build the drill image (server)

```bash
cur=$(grep '^API_TAG=' ~/deploy/.env | cut -d= -f2)
docker build -t ghcr.io/hyeoniverse/macfolio-api:sha-dead000 - <<EOF
FROM ghcr.io/hyeoniverse/macfolio-api:$cur
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=1 CMD false
EOF
docker image ls ghcr.io/hyeoniverse/macfolio-api
```

The build only adds one layer, so it takes a few seconds (there's no context, so the code isn't rebuilt). You're good if the list shows both `sha-dead000` and the current tag.

### 3. Deploy from Actions (GitHub)

1. Open [Actions → Deploy API (API 배포)](https://github.com/hyeoniverse/MacFolio/actions/workflows/deploy-api.yml). The first screen (All workflows) has no button, so click **API 배포** (Deploy API) in the list on the left
2. Click the **Run workflow** button at the top right
3. Leave Branch as `main` and enter `sha-dead000` in tag
4. Click the green **Run workflow** button

### 4. Watch (server, optional)

Watch in another window while the run is in progress.

```bash
cd ~/deploy
tail -f deploy.log
watch -n 3 docker compose ps api       # in another window
```

The container switches to `sha-dead000` and goes `(health: starting)` → `(unhealthy)`, then about 2 minutes later returns to the previous tag and becomes `(healthy)`.

### 5. Check the results

**Actions**: the run ends with a red X (about 2–4 minutes in total).

- The **서버에서 배포** (Deploy on server) step fails, and its last line is `Error: Process completed with exit code 1.`
- The **바깥에서 버전 확인** (Check version from outside) step is skipped (gray)
- Depending on the repository's notification settings, a failure email arrives

**The log of the Deploy on server step (= `~/deploy/deploy.log`)** shows the following, in order (timestamps will differ):

```text
… 배포 시작: sha-65ff5e6 → sha-dead000
… (backup script lines)
… 120초 안에 healthy가 되지 않았다
… 새 버전이 건강하지 않다. api 로그 끝:
api-1  | … Nest application successfully started …
… 이전 버전으로 되돌린다: sha-65ff5e6
… 배포 실패, 되돌림: sha-65ff5e6가 다시 떠 있다
```

(The script prints these lines in Korean: "Deploy started: sha-65ff5e6 → sha-dead000", "Did not become healthy within 120 seconds", "The new version is unhealthy. End of api log:", "Rolling back to the previous version: sha-65ff5e6", "Deploy failed, rolled back: sha-65ff5e6 is up again".)

There are no errors in the app log. That's expected: the drill image only deliberately fails the health check.

**Server state**:

```bash
cd ~/deploy
grep '^API_TAG=' .env                  # API_TAG=sha-65ff5e6 (still the previous version)
docker compose ps api                  # IMAGE …:sha-65ff5e6, STATUS Up N minutes (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo
# {"status":"ok","database":"up","version":"sha-65ff5e6"}
```

The N in `Up N minutes` matches the drill time (the rollback recreated the container). If `API_TAG` in `.env` is `sha-dead000`, the rollback didn't finish. Go to "If the rollback fails" below.

**Frontend**: a manually run API deploy doesn't call the frontend `deploy`, so it's unaffected.

### 6. Clean up (server)

```bash
docker image rm ghcr.io/hyeoniverse/macfolio-api:sha-dead000
docker image ls ghcr.io/hyeoniverse/macfolio-api     # no sha-dead000
ls -t ~/backups | head -n 1                          # backup created during the drill. Keep it or delete it
```

Keep the drill record in `deploy.log`. Keep the red run in Actions as a record too.

## If the rollback fails

If the log ends with `배포 실패, 되돌리기도 실패` (deploy failed, rollback also failed), or the previous version isn't `healthy` in step 5, pin the previous image by hand. The previous image is still on the server, so it doesn't need to be pulled again.

```bash
cd ~/deploy
docker compose ps api; docker compose logs --tail 100 api      # first see why it isn't working
~/macfolio/ops/deploy.sh sha-65ff5e6                            # the tag recorded in step 1. Does backup → swap → healthy check
```

If the script is stuck waiting for another deploy (`flock`) or the script itself doesn't work, edit `.env` directly.

```bash
cd ~/deploy
sed -i 's/^API_TAG=.*/API_TAG=sha-65ff5e6/' .env
docker compose up -d api
docker compose ps api                  # about a minute until (healthy)
curl -s https://macfolio-api.hyeoniverse.com/health; echo
```

If it still doesn't become healthy, the problem is unrelated to the drill (DB, `api.env`, disk). Check the db with `docker compose ps` and the disk with `df -h`. If the previous image was deleted, pull it again from GHCR with `docker compose pull api` (it's a public package, so no login is needed). For cleanup, follow step 6 above as is.

## Checklist to attach to #100

Record the drill result in [#100](https://github.com/hyeoniverse/MacFolio/issues/100) in the format below.

<details>
<summary>Checklist source (for copying)</summary>

```markdown
### Server rollback drill (docs/rollback-drill.md) — YYYY-MM-DD

- [ ] Before the drill: `API_TAG=sha-_______`, `/health` version matches, `(healthy)`
- [ ] Drill image `sha-dead000` on the server (current image + `HEALTHCHECK CMD false`)
- [ ] Run workflow `sha-dead000` → red X in Actions, '서버에서 배포' exit code 1, '바깥에서 버전 확인' skipped (run link: )
- [ ] Log: `120초 안에 healthy가 되지 않았다` → `이전 버전으로 되돌린다` → `배포 실패, 되돌림: sha-_______가 다시 떠 있다`
- [ ] After the drill: `API_TAG` in `.env`, the image in `docker compose ps api`, and the external `/health` version are all the previous tag, `(healthy)`
- [ ] Downtime: about __ s (uptime alert: yes/no)
- [ ] Cleanup: `sha-dead000` image deleted
```

</details>

## Records

### 2026-10-18 (first server drill, wrapping up #100)

- Before the drill: `API_TAG=sha-7e7eac0`, `/health` version matches, `(healthy)`
- Built the drill image `sha-dead000` on the server (4 seconds)
- Run workflow `sha-dead000` → Actions "API 배포 #2" (Deploy API #2) failed (3 minutes, `Process completed with exit code 1`)
- Log: `09:04:53Z 이전 버전으로 되돌린다: sha-7e7eac0` → `09:05:34Z 배포 실패, 되돌림: sha-7e7eac0가 다시 떠 있다`. The rollback took 41 seconds
- After the drill: `.env`, the container image, and the external `/health` version all `sha-7e7eac0`, `(healthy)`
- Cleanup: deleted `sha-dead000`; remaining images `sha-0f5d74f`, `sha-7e7eac0`
- What happened: I also pasted the placeholder line `ssh <평소 쓰는 서버 접속>` (your usual server login) from the connection instructions, which caused `syntax error near unexpected token 'newline'`. The remaining lines ran as normal, so the result was unaffected. As the note in "Preparation" says, don't paste placeholders

## Related posts (Korean)

- [되돌리기 훈련 - 헬스 체크가 실패하는 이미지를 서버에 일부러 올렸다](https://macfolio.hyeoniverse.com/memo/rollback-drill)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](https://macfolio.hyeoniverse.com/memo/api-auto-deploy)

[^blue-green]: A deployment method that runs the new container alongside the old one and switches traffic only after its health check passes. Responses never stop during the switch, but more memory is used while both containers run. This server (E2.1.Micro, 1GB) replaces its single container instead.

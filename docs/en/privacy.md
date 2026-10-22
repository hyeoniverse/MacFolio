[한국어](../privacy.md) | **English**

# Privacy: what is collected and how long it is kept

This document lists everything MacFolio (macfolio.hyeoniverse.com) keeps on the server about visitors. When the code changes, this document changes with it.

## Traffic analytics (#102)

When you open the site, the browser gathers a few events and sends them to the API (`POST /analytics/events`). The collected numbers are viewed in the Activity Monitor (활동 상태 보기) app.

- **Visible to anyone:** visits and unique visitors per day, app opens, average time spent, counts per app, post and outbound link, counts per country, device, browser, OS and language, referrer groups (search, social, direct, link), view count per blog post, and "N visitors today" (오늘 방문자 N명) in the Apple menu. All of these are totals that do not identify anyone
- **Visible only to the admin:** referrer addresses (hosts) and search terms passed on by search engines, utm values (source, medium, campaign and their combinations, term, content; these can reveal where a link was posted), the live visit list (visit flow, masked IP), and search terms from Google Search Console (below)

### What is collected

| Value                                                                               | Where it comes from                                           | Example                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Event type and time received                                                        | Browser, server                                               | Page open, app open, viewing a post or project, clicking an outbound link, time spent                                           |
| App opened, post or project viewed, address of the link clicked                     | Browser                                                       | `memo`, `memo/hello`, `github.com/hyeoniverse`                                                                                  |
| First address opened                                                                | Browser                                                       | `/memo/hello`                                                                                                                   |
| The referrer's **host only**                                                        | Browser (`document.referrer`)                                 | `github.com` (the path is not sent, and the server rejects anything that doesn't look like a host)                              |
| The **search term** a search engine put in the referrer address (only when it does) | Browser (the query field of `document.referrer`)              | `macfolio 포트폴리오` ("macfolio portfolio"; Naver and others. Google and Bing don't send it. Lowercased, up to 100 characters) |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`               | Address (removed from the address bar after reading)          | `linkedin`, `social`, `resume-2026` (lowercased, spaces replaced with `-`, up to 100 characters)                                |
| Device type (screen width), language                                                | Browser                                                       | `desktop`, `ko-KR`                                                                                                              |
| Country                                                                             | `CF-IPCountry` added by Cloudflare                            | `KR`                                                                                                                            |
| Browser and OS **type**                                                             | Reduced from the User-Agent by the server                     | `Chrome`, `macOS`                                                                                                               |
| Daily hash                                                                          | Server: `HMAC(date + IP + User-Agent, secret key)`            | 64 hex characters                                                                                                               |
| IP with the last part masked                                                        | Server                                                        | `203.0.113.x`, `2001:db8:1::`                                                                                                   |
| Visit id                                                                            | A random value the browser creates each time a page is opened | Groups the events of one visit                                                                                                  |

utm values are read once from the first page's address and immediately removed from the address bar (`history.replaceState`; other query parameters stay). Copying and sharing the address or reloading doesn't count the same campaign visit again, and where the link was posted isn't passed on to others.

### What is not collected

- **The original IP.** It is used only to compute the daily hash and is not stored. Only the IP with the last part masked is shown on screen
- **The raw User-Agent.** Only the reduced browser and OS type is kept
- **Cookies, device fingerprints.** Analytics doesn't use cookies. The visitor cookie for the guestbook and comments (below) isn't used for analytics either
- **Tracking across days.** The daily hash includes the date, so the same person gets a different value when the day changes. That's why unique visitors are only counted per day
- The referrer's path (only the search term passed on by a search engine is kept), what you type, mouse movement

### What is not counted

- Browsers logged in as the admin
- Search crawlers, link previews, automated tools (filtered by User-Agent)
- Browsers with Global Privacy Control (`navigator.globalPrivacyControl`) turned on: the site doesn't send anything (the site's collection code)
- Local development and UI tests (E2E)

### How long it is kept

| Value                                                                                                        | Period                                                           |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Masked IP                                                                                                    | Deleted after 7 days                                             |
| Events (the table above)                                                                                     | Deleted after 90 days                                            |
| Daily aggregated numbers (visits per day, counts per referrer, search term, utm, app, post, country, device) | Kept indefinitely. They contain nothing that identifies a person |
| Search Console search terms (totals per date, search term and page; below)                                   | Kept indefinitely. They contain nothing that identifies a person |

Every hour the server aggregates past days and deletes values past their period (`maintain` in `apps/api/src/analytics/analytics-rollup.service.ts`). They are also included in DB backups (`ops/backup.sh`). Backups are kept for 7 days on the server and 30 days off the server (R2), then deleted (defaults). So deleted values remain in backups for that much longer.

### Google Search Console

Google doesn't pass search terms to the site. So every 6 hours the server fetches impressions, clicks and average position per date, search term and page from Google Search Console and stores them (`apps/api/src/analytics/search-keywords.service.ts`). These are totals Google counted over its search results, so they aren't linked to any single visit or person, and Google leaves out rare search terms that could identify someone. Only the admin sees them.

## Guestbook and comments (visitor cookie)

A browser that writes a message or comment for the first time gets a random token cookie (`macfolio_visitor`, 1 year), and that token determines a name (e.g. 🦊 날쌘 여우, "swift fox"). The DB stores only the token's HMAC. To prevent spam, the HMAC of the IP and its first two parts (`211.234`) are stored with it. This cookie and these values aren't used for analytics.

## Contact mail (Mail app)

Mail sent from the Mail (메일) app (name, reply-to address, subject, body) goes through the mail service Resend to the site owner's inbox, and is also stored on the server for **1 year**. The reply-to address becomes that mail's Reply-To.

- **Who can see it:** it's visible only in the sent mailbox of the browser that sent it (visitor cookie) and in the admin's inbox. The server filters by the visitor cookie's HMAC, so it isn't visible from other browsers. If you delete the cookie, it's no longer visible in that browser either
- **Replies:** replies the admin writes in the Mail app go by email to the reply-to address, and also appear under that mail in the sender's sent mailbox
- **Period:** mail and replies older than 1 year are deleted (when mail is sent or when the admin opens the inbox)
- To count how many mails can be sent per day, the HMAC of the IP is kept only in server memory, and it disappears when the day changes or the server restarts
- If human verification (Cloudflare Turnstile) is turned on, Cloudflare checks the browser

## Document files (résumé, portfolio and certificates in Finder)

The résumé, portfolio and certificate files opened in Finder are stored in Cloudflare R2 and served from the site's address (`/files/…`). Nothing extra is kept about visitors (files are served without login or cookies). Only public versions are stored, with phone number, address, date of birth and ID numbers removed before upload.

## Human verification (Cloudflare Turnstile)

Writing mail, comments or messages can require verifying that you're human. The admin decides where it's turned on under **Privacy & Security** (개인정보 보호 및 보안) in System Settings (시스템 설정) (initially only for mail). Anyone can see on the same screen where it's currently on.

- When you write somewhere it's on, Cloudflare's widget checks the browser and issues a single-use token. The server verifies that token with Cloudflare. At this point Cloudflare sees the IP and browser information ([Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/))
- This site doesn't store the token
- Posts written by the admin aren't verified

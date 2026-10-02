// 방문자 이름 (apps/api의 GET /visitor). 처음 온 브라우저에는 서버가 쿠키를 주고 이름(예: 🦊 날쌘 여우)을 정한다.
// 같은 브라우저면 언제 와도 같은 이름이라, 메시지와 블로그 댓글이 같은 이름을 쓴다.

let cached: Promise<string | null> | null = null;

/** 이 브라우저의 이름. 서버에 닿지 못하면 null (다음에 부르면 다시 묻는다) */
export function fetchVisitorName(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
	cached ??= fetchImpl(`${apiUrl}/visitor`, { credentials: 'include' })
		.then(async (response) => (response.ok ? ((await response.json()) as { name: string }).name : null))
		.catch(() => null)
		.then((name) => {
			if (name === null) cached = null;
			return name;
		});
	return cached;
}

/** 시험용: 기억한 이름을 잊는다 */
export function forgetVisitorName() {
	cached = null;
}

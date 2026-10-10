// 로그에 남기면 안 되는 값을 가린다. 서버 로그는 Docker 로그·호스팅 콘솔에 그대로 쌓이고, 오류 메시지에는
// DB 주소(비밀번호 포함), 바깥 API 키, 세션 쿠키, 방문자 메일 주소가 섞여 들어올 수 있다.
// 모양이 정해진 것(URL의 비밀번호, Bearer, 쿠키·쿼리 값, 알려진 키 접두사, 메일 주소)만 가리고 나머지는 그대로 둔다.

const RULES: [RegExp, string][] = [
	// postgresql://user:password@host → postgresql://user:***@host
	[/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s@/]+@/gi, '$1***@'],
	// Authorization: Bearer xxx
	[/(\bBearer\s+)[A-Za-z0-9._~+/=-]+/g, '$1***'],
	// 쿠키·쿼리·폼의 값: macfolio_session=…, token=…, code=…, state=…, key=…, secret=…, password=…
	[/((?<![\w-])(?:macfolio_[a-z_]+|session|token|state|code|key|api[_-]?key|secret|password)=)[^&;\s"']+/gi, '$1***'],
	// JSON 안의 같은 항목: "authorization": "…", "cookie": "…"
	[/("(?:authorization|cookie|set-cookie|token|secret|password|api[_-]?key)"\s*:\s*")[^"]*(")/gi, '$1***$2'],
	// 알려진 키 접두사: Resend(re_), Groq(gsk_), GitHub(ghp_·gho_·ghu_·ghs_·ghr_·github_pat_), OpenAI 모양(sk-), Google(AIza)
	[/\b(?:re|gsk|ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{8,}\b/g, '***'],
	[/\bsk-[A-Za-z0-9_-]{8,}\b/g, '***'],
	[/\bAIza[0-9A-Za-z_-]{20,}/g, '***'],
	// 메일 주소: 첫 글자와 도메인만 남긴다 (minsu@example.com → m***@example.com)
	[/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g, '$1***@$2'],
];

/** 글에서 비밀 값과 메일 주소를 가린 글 */
export function redact(text: string): string {
	return RULES.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
}

/** 로그에 넘기는 값 하나를 가린다: 글, Error(메시지·스택), 그 밖의 객체(JSON으로 바꿔서). 나머지는 그대로 */
export function redactValue(value: unknown): unknown {
	if (typeof value === 'string') return redact(value);
	if (value instanceof Error) {
		const copy = new Error(redact(value.message));
		copy.name = value.name;
		copy.stack = value.stack ? redact(value.stack) : undefined;
		return copy;
	}
	if (value && typeof value === 'object') {
		try {
			return JSON.parse(redact(JSON.stringify(value)));
		} catch {
			return value;
		}
	}
	return value;
}

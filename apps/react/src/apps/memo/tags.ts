// 메모 태그 (macOS 메모처럼 본문에 #태그로 쓴다). 따로 저장하지 않고 본문에서 읽는다.
// React와 DOM에 의존하지 않는 순수 함수만 둔다.

/** 태그 이름에 쓰는 글자: 글자·숫자·_·- (한글 포함) */
const NAME = '[\\p{L}\\p{N}_-]+';
/** #태그: 줄 처음이나 공백·여는 괄호 뒤의 #, 바로 뒤에 이름 (# 뒤에 공백이 있으면 제목이다) */
export const TAG_PATTERN = new RegExp(`(^|[\\s(（\\[])#(${NAME})`, 'gu');

/** 태그로 보지 않는 것: 숫자만 (이슈 번호 #14), 색 (#edbb4d) */
export function isTagName(name: string): boolean {
	if (/^\d+$/.test(name)) return false;
	if (/^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(name)) return false;
	return true;
}

/** 글 한 덩어리(코드가 아닌 글자)에서 태그와 자리: [시작, 끝) 은 #부터 이름 끝까지 */
export function tagsInText(text: string): { name: string; start: number; end: number }[] {
	const found: { name: string; start: number; end: number }[] = [];
	for (const match of text.matchAll(TAG_PATTERN)) {
		const name = match[2];
		if (!isTagName(name)) continue;
		const start = match.index + match[1].length;
		found.push({ name, start, end: start + 1 + name.length });
	}
	return found;
}

/**
 * Markdown 본문의 태그 (처음 나온 순서, 대소문자가 달라도 하나로).
 * 코드(```·`)와 링크 주소, HTML 태그 안의 #은 태그가 아니다.
 */
export function tagsOf(markdown: string): string[] {
	const text = markdown
		.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, ' ')
		.replace(/`[^`\n]*`/g, ' ')
		.replace(/\]\([^)\n]*\)/g, '] ')
		.replace(/<[^>\n]*>/g, ' ');
	const seen = new Map<string, string>();
	for (const { name } of tagsInText(text)) {
		const key = name.toLowerCase();
		if (!seen.has(key)) seen.set(key, name);
	}
	return [...seen.values()];
}

/** 같은 태그인지 (대소문자를 가리지 않는다) */
export const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 모든 글의 태그와 글 수. 글이 많은 태그가 앞, 같으면 이름 순 */
export function collectTags(posts: { body: string }[]): { name: string; count: number }[] {
	const counts = new Map<string, { name: string; count: number }>();
	for (const post of posts) {
		for (const name of tagsOf(post.body)) {
			const entry = counts.get(name.toLowerCase());
			if (entry) entry.count += 1;
			else counts.set(name.toLowerCase(), { name, count: 1 });
		}
	}
	return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}

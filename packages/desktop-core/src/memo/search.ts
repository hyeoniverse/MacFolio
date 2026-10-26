// 메모 검색: 검색어를 낱말로 나눠 모든 낱말이 들어 있는 글을 찾고(AND), 어느 칸에서 찾았는지로 순서를 매긴다.
// 한글로 적은 기술 용어(리액트)는 글에 쓴 영문(React)으로도 찾는다.
// 결과가 없으면 제목·주소·태그와 철자가 비슷한 글과 고친 검색어를 추천한다.
// React와 DOM에 의존하지 않는 순수 함수만 둔다. 글마다 검색용 글자는 한 번만 만들어 둔다 (WeakMap, 글이 바뀌면 새 객체다).
import { tagsOf } from './tags.js';

/** 검색에 쓰는 글의 칸 (Post의 일부. posts.ts를 가져오지 않아 순환 의존이 생기지 않는다) */
export interface SearchablePost {
	slug: string;
	title: string;
	summary: string;
	body: string;
}

/** 칸마다 무게. 제목에서 찾은 글이 본문에서만 찾은 글보다 앞에 온다 */
export const SEARCH_WEIGHTS = { title: 10, slug: 8, tags: 6, initials: 5, summary: 4, body: 1 } as const;
type Field = keyof typeof SEARCH_WEIGHTS;
const FIELDS = Object.keys(SEARCH_WEIGHTS) as Field[];

// ── 한글 ────────────────────────────────────────────────────────────────
const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
/** 초성 19자 (호환 자모) */
const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const JUNG = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
/** 종성 28자 (0은 받침 없음) */
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

const isSyllable = (code: number) => code >= SYLLABLE_START && code <= SYLLABLE_END;

/** 완성된 한글을 초성·중성·종성 자모로 푼다 (다른 글자는 그대로). 철자가 비슷한지 잴 때 쓴다 */
export function toJamo(text: string): string {
	let out = '';
	for (const char of text) {
		const code = char.charCodeAt(0);
		if (!isSyllable(code)) {
			out += char;
			continue;
		}
		const index = code - SYLLABLE_START;
		out += CHO[Math.floor(index / 588)] + JUNG[Math.floor((index % 588) / 28)] + JONG[index % 28];
	}
	return out;
}

/** 한글은 초성만, 다른 글자는 그대로 (초성 검색: ㅍㄹㅌ → 프론트) */
export function toInitials(text: string): string {
	let out = '';
	for (const char of text) {
		const code = char.charCodeAt(0);
		out += isSyllable(code) ? CHO[Math.floor((code - SYLLABLE_START) / 588)] : char;
	}
	return out;
}

const isConsonantJamo = (char: string) => CHO.includes(char);
/** 낱말이 초성으로만 되어 있는지 (두 글자 이상. 한 글자는 입력 중인 글자로 본다) */
const isInitialsTerm = (term: string) => [...term].length >= 2 && [...term].every(isConsonantJamo);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const charRange = (from: number, to: number) => `[${String.fromCharCode(from)}-${String.fromCharCode(to)}]`;

/**
 * 낱말의 마지막 글자는 아직 입력 중일 수 있다 (한글 입력기는 '엔'을 'ㅇ' → '에' → '엔' 순서로 보낸다).
 * 그래서 마지막 글자가 받침 없는 음절이면 같은 초성·중성의 모든 음절을, 홑자음이면 그 초성의 모든 음절을 받아 준다.
 * 받침이 있으면 그 받침이 다음 음절의 초성이 되는 경우('각' → '가기')도 받는다
 */
function termPattern(term: string): string {
	const chars = [...term];
	const last = chars.pop()!;
	const head = escapeRegExp(chars.join(''));
	const code = last.charCodeAt(0);
	if (isSyllable(code)) {
		const index = code - SYLLABLE_START;
		const base = code - (index % 28);
		const jong = index % 28;
		if (jong === 0) return `${head}${charRange(base, base + 27)}`;
		const initial = CHO.indexOf(JONG[jong]);
		if (initial < 0) return `${head}${escapeRegExp(last)}`;
		const next = SYLLABLE_START + initial * 588;
		return `${head}(?:${escapeRegExp(last)}|${String.fromCharCode(base)}${charRange(next, next + 587)})`;
	}
	const initial = CHO.indexOf(last);
	if (initial >= 0) {
		const start = SYLLABLE_START + initial * 588;
		return `${head}(?:${escapeRegExp(last)}|${charRange(start, start + 587)})`;
	}
	return head + escapeRegExp(last);
}

// ── 검색용 글자 ─────────────────────────────────────────────────────────
/** 대소문자·전각·공백을 하나로. 하이픈·밑줄은 공백과 같게 본다 (merge-strategies와 "merge strategies") */
export function normalizeSearchText(text: string): string {
	// NFKC는 전각 글자를 반각으로 바꾸지만, 한글 호환 자모(ㄱ-ㅣ)도 첫가끝 자모로 바꿔 버린다. 그래서 자모는 그대로 둔다
	return text
		.replace(/[^\u3131-\u318E]+/g, (part) => part.normalize('NFKC'))
		.toLowerCase()
		.replace(/[-_\s]+/g, ' ')
		.trim();
}

/** 칸마다 검색용 글자와, 띄어쓰기를 뺀 글자(본문 빼고). '병합방식'으로 '병합 방식'을 찾는다 */
type Index = Record<Field, string> & { compact: Partial<Record<Field, string>> };
/** 띄어쓰기를 무시하고 찾는 칸 (본문은 길어서 빼고, 초성은 원래 붙어 있다) */
const COMPACT_FIELDS: Field[] = ['title', 'slug', 'tags', 'summary'];
const indexes = new WeakMap<SearchablePost, Index>();

/** 글의 검색용 글자. 처음 물을 때 한 번 만들고, 같은 글 객체에는 그대로 쓴다 */
export function searchIndexOf(post: SearchablePost): Index {
	let index = indexes.get(post);
	if (!index) {
		const title = normalizeSearchText(post.title);
		const fields: Record<Field, string> = {
			title,
			slug: normalizeSearchText(post.slug),
			tags: normalizeSearchText(tagsOf(post.body).join(' ')),
			initials: toInitials(title),
			summary: normalizeSearchText(post.summary),
			body: normalizeSearchText(post.body),
		};
		const compact = Object.fromEntries(COMPACT_FIELDS.map((field) => [field, fields[field].replaceAll(' ', '')]));
		index = { ...fields, compact };
		indexes.set(post, index);
	}
	return index;
}

// ── 같은 용어의 다른 표기 ───────────────────────────────────────────────
/**
 * 같은 것을 가리키는 표기 묶음. 글은 기술 용어를 영문(React, GitHub)으로 쓰고, 검색은 한글 음차(리액트, 깃허브)로 하는 일이 많다.
 * 저장소 글의 제목·태그에 나오는 용어 위주로 둔다. 띄어쓰기는 무시한다 (비주얼 스튜디오 코드 = 비주얼스튜디오코드)
 */
const ALIAS_GROUPS: string[][] = [
	['react', '리액트'],
	['typescript', '타입스크립트'],
	['javascript', '자바스크립트'],
	['github', '깃허브', '깃헙'],
	['github actions', '깃허브 액션', '깃허브 액션스'],
	['git', '깃'],
	['docker', '도커'],
	['flux', '플럭스'],
	['redux', '리덕스'],
	['next.js', 'nextjs', '넥스트'],
	['vue', '뷰js'],
	['node', 'nodejs', '노드'],
	['prettier', '프리티어'],
	['eslint', '이에스린트'],
	['lint', '린트'],
	['vite', '비트', '바이트'],
	['playwright', '플레이라이트'],
	['vitest', '바이테스트', '비테스트'],
	['vs code', 'vscode', 'vs코드', '브이에스코드', '비주얼 스튜디오 코드'],
	['kubernetes', '쿠버네티스'],
	['cloudflare', '클라우드플레어'],
	['oracle', '오라클'],
	['nestjs', '네스트', '네스트js'],
	['prisma', '프리즈마', '프리스마'],
	['postgres', 'postgresql', '포스트그레스', '포스트그레스큐엘'],
	['zod', '조드'],
	['macos', '맥os', '맥오에스'],
	['safari', '사파리'],
	['finder', '파인더'],
	['homebrew', '홈브루'],
	['lighthouse', '라이트하우스'],
	['webpack', '웹팩'],
	['firebase', '파이어베이스'],
	['python', '파이썬'],
	['express', '익스프레스'],
	['markdown', '마크다운'],
	['unity', '유니티'],
	['pnpm', '피엔피엠'],
	['css', '씨에스에스'],
	['확장', '확장 프로그램', '익스텐션', 'extension'],
];
/** 띄어쓰기를 뺀 표기 → 같은 묶음의 다른 표기 (검색용 글자로 다듬은 것) */
const ALIASES = new Map<string, string[]>();
for (const group of ALIAS_GROUPS) {
	const spellings = group.map(normalizeSearchText);
	for (const spelling of spellings) {
		ALIASES.set(
			spelling.replaceAll(' ', ''),
			spellings.filter((other) => other !== spelling)
		);
	}
}
/** 다른 표기로 찾은 칸은 무게를 조금 덜 준다 (원래 표기로 찾은 글이 앞에 온다) */
const ALIAS_WEIGHT = 0.9;
/** 입력 중인 표기(타입스크립)도 받는 최소 길이. 짧으면 너무 많은 표기의 앞부분이 된다 */
const MIN_ALIAS_PREFIX = 3;

/** 낱말과 같은 것을 가리키는 다른 표기. 낱말이 표기의 앞부분이면(입력 중) 그 표기와 같은 묶음도 */
function aliasesOf(term: string): string[] {
	const key = term.replaceAll(' ', '');
	const exact = ALIASES.get(key);
	if (exact) return exact;
	if ([...key].length < MIN_ALIAS_PREFIX) return [];
	const found = new Set<string>();
	for (const [spelling, others] of ALIASES) {
		if (spelling.length > key.length && spelling.startsWith(key)) {
			found.add(spelling);
			for (const other of others) found.add(other);
		}
	}
	return [...found];
}

// ── 검색어 ─────────────────────────────────────────────────────────────
interface QueryTerm {
	text: string;
	/** 마지막 글자를 입력 중으로 볼 때만 있다 (없으면 그대로 포함되는지만 본다) */
	pattern: RegExp | null;
	initials: boolean;
}

export interface ParsedQuery {
	/** 다듬은 검색어 전체 (낱말 사이 공백 하나) */
	text: string;
	/** aliases는 같은 것을 가리키는 다른 표기 (리액트 → react) */
	terms: (QueryTerm & { aliases: QueryTerm[] })[];
}

/** 검색어를 낱말로. 글 주소 전체(`/memo/<글>`, 사이트 주소 포함)를 붙여 넣으면 글 주소만 쓴다 */
export function parseQuery(query: string): ParsedQuery {
	const trimmed = query
		.trim()
		.replace(/^.*\/memo\//, '')
		.replace(/[?#].*$/, '')
		.replace(/\/+$/, '');
	const text = normalizeSearchText(trimmed);
	// 낱말은 공백으로 나눈다. 하이픈·밑줄로 이은 낱말(merge-strategies)은 이어진 한 덩어리로 찾는다 (글 주소처럼 적은 것)
	const terms = trimmed
		.split(/\s+/)
		.map(normalizeSearchText)
		.filter(Boolean)
		.map((term) => {
			const pattern = termPattern(term);
			return {
				text: term,
				pattern: pattern === escapeRegExp(term) ? null : new RegExp(pattern),
				initials: isInitialsTerm(term),
				aliases: aliasesOf(term).map((alias) => ({ text: alias, pattern: null, initials: false })),
			};
		});
	return { text, terms };
}

/** 표기 하나가 걸린 칸 중 가장 무거운 칸의 무게. 어디에도 없으면 0 */
function fieldScore(index: Index, term: QueryTerm): number {
	let best = 0;
	for (const field of FIELDS) {
		if (SEARCH_WEIGHTS[field] <= best) continue;
		const compact = index.compact[field];
		const hit =
			field === 'initials'
				? term.initials && index.initials.includes(term.text)
				: index[field].includes(term.text) ||
					(term.pattern !== null && term.pattern.test(index[field])) ||
					(compact !== undefined &&
						(compact.includes(term.text.replaceAll(' ', '')) || (term.pattern !== null && term.pattern.test(compact))));
		if (hit) best = SEARCH_WEIGHTS[field];
	}
	return best;
}

/** 낱말 하나의 점수: 원래 표기와 다른 표기(무게를 조금 덜어서) 중 높은 쪽 */
function termScore(index: Index, term: ParsedQuery['terms'][number]): number {
	let best = fieldScore(index, term);
	for (const alias of term.aliases) best = Math.max(best, fieldScore(index, alias) * ALIAS_WEIGHT);
	return best;
}

/**
 * 검색어에 맞는 점수. 모든 낱말이 어느 칸에든 있어야 한다 (없으면 0).
 * 낱말마다 가장 무거운 칸의 무게를 더하고, 제목·주소가 검색어 전체와 같거나 검색어로 시작하면 더 준다
 */
export function scorePost(post: SearchablePost, query: ParsedQuery): number {
	if (query.terms.length === 0) return 0;
	const index = searchIndexOf(post);
	let score = 0;
	for (const term of query.terms) {
		const value = termScore(index, term);
		if (value === 0) return 0;
		score += value;
	}
	if (index.title === query.text || index.slug === query.text) score += 30;
	else if (index.title.startsWith(query.text) || index.slug.startsWith(query.text)) score += 10;
	return score;
}

/** 검색어에 맞는 글인지 (빈 검색어는 모든 글) */
export function matchesQuery(post: SearchablePost, query: ParsedQuery): boolean {
	return query.terms.length === 0 || scorePost(post, query) > 0;
}

/** 점수가 높은 글부터 (같으면 원래 순서). 맞지 않는 글은 뺀다 */
export function rankPosts<T extends SearchablePost>(posts: T[], query: string): T[] {
	const parsed = parseQuery(query);
	if (parsed.terms.length === 0) return posts;
	return posts
		.map((post, order) => ({ post, order, score: scorePost(post, parsed) }))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.map((item) => item.post);
}

// ── 결과가 없을 때 ──────────────────────────────────────────────────────
/**
 * 바꾸기 비용. 넣기·빼기(1)보다 조금 싸게 두어, 같은 횟수면 길이가 같은 낱말을 고른다 ('flix'는 'fix'보다 'flux')
 */
const SUBSTITUTE = 0.9;

/**
 * 글 a를 b로 바꾸는 데 드는 편집 비용 (넣기·빼기 1, 바꾸기 0.9, 이웃한 두 글자 맞바꾸기 1: dokcer → docker).
 * partial이면 b 안의 어느 부분과 가장 가까운지 잰다 (b의 앞뒤를 잘라 내는 데는 비용이 없다)
 */
function editDistance(a: string, b: string, partial = false): number {
	const x = [...a];
	const y = [...b];
	let before: number[] = [];
	let previous = Array.from({ length: y.length + 1 }, (_, j) => (partial ? 0 : j));
	for (let i = 1; i <= x.length; i++) {
		const current = [i];
		for (let j = 1; j <= y.length; j++) {
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : SUBSTITUTE)
			);
			if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1] && x[i - 1] !== y[j - 1]) {
				current[j] = Math.min(current[j], before[j - 2] + 1);
			}
		}
		before = previous;
		previous = current;
	}
	return partial ? Math.min(...previous) : previous[y.length];
}

/**
 * 철자가 비슷하다고 볼 최대 편집 비용. 자모 기준 길이의 25%, 적어도 1 (짧은 낱말도 한 글자는 틀릴 수 있다).
 * 한글 한 음절의 오타는 자모 1~2개라, 3음절 낱말(자모 7~9개)에서 한 음절까지 받는다
 */
export const similarLimit = (length: number) => Math.max(1, Math.floor(length * 0.25));
/** 이보다 짧은 검색어(자모 기준)는 비슷한 글을 찾지 않는다 (한두 글자는 무엇과도 비슷하다) */
const MIN_SIMILAR_LENGTH = 3;

/**
 * 결과가 없을 때 보여 줄 비슷한 글: 검색어의 낱말마다 제목·주소·태그의 어느 부분과 자모 단위로 가까운 글.
 * 낱말마다 허용 편집 횟수(similarLimit) 안이어야 하고, 편집 횟수 합이 적은 글부터 limit개.
 * 본문은 보지 않는다 (긴 본문에서는 아무 검색어나 비슷한 부분이 있다)
 */
export function similarPosts<T extends SearchablePost>(posts: T[], query: string, limit = 5): T[] {
	const terms = parseQuery(query).terms.map((term) => {
		const jamo = toJamo(term.text);
		const allowed = similarLimit([...jamo].length);
		// 낱말과 그 다른 표기, 철자가 비슷한 표기(리엑트 → 리액트)의 다른 표기(react)까지. 비용은 표기까지 고친 비용부터
		const needles = [
			{ jamo, cost: 0 },
			...term.aliases.map((alias) => ({ jamo: toJamo(alias.text), cost: 0 })),
			...nearSpellings(jamo, allowed).flatMap(({ others, cost }) =>
				others.map((other) => ({ jamo: toJamo(other), cost }))
			),
		];
		return { length: [...jamo].length, allowed, needles };
	});
	if (terms.length === 0 || terms.some((term) => term.length < MIN_SIMILAR_LENGTH)) return [];
	return posts
		.map((post, order) => {
			const index = searchIndexOf(post);
			const fields = [index.title, index.slug, index.tags, index.compact.title ?? '']
				.filter(Boolean)
				.map((field) => toJamo(field));
			let distance = 0;
			for (const term of terms) {
				let best = Infinity;
				for (const needle of term.needles) {
					for (const field of fields) best = Math.min(best, needle.cost + editDistance(needle.jamo, field, true));
				}
				if (best > term.allowed) return null;
				distance += best;
			}
			return { post, order, distance };
		})
		.filter((item): item is { post: T; order: number; distance: number } => item !== null)
		.sort((a, b) => a.distance - b.distance || a.order - b.order)
		.slice(0, limit)
		.map((item) => item.post);
}

/** 다른 표기 모두의 자모 (철자가 비슷한 표기를 찾을 때 쓴다) */
let aliasSpellings: { jamo: string; others: string[] }[] | null = null;

/** allowed 비용 안에서 철자가 비슷한 표기의 다른 표기와 그 비용 (리엑트 → 리액트 → react, 0.9) */
function nearSpellings(jamo: string, allowed: number): { others: string[]; cost: number }[] {
	aliasSpellings ??= [...ALIASES].map(([spelling, others]) => ({ jamo: toJamo(spelling), others }));
	return aliasSpellings
		.map(({ jamo: spelling, others }) => ({ others, cost: editDistance(jamo, spelling) }))
		.filter(({ cost }) => cost > 0 && cost <= allowed);
}

/** 붙여 쓴 검색어(확장프로그램)도 고칠 수 있게, 제목의 이웃한 낱말을 이은 것도 후보로 둔다 (낱말 3개까지) */
const MAX_JOINED_WORDS = 3;
const vocabularies = new WeakMap<SearchablePost[], { word: string; jamo: string }[]>();

/**
 * 고친 검색어 후보: 제목·주소·태그에 나오는 낱말(두 글자 이상), 제목의 이웃한 낱말을 이은 것, 다른 표기 사전의 표기.
 * 자모는 띄어쓰기를 빼고 잰다. 같은 글 목록에는 한 번만 만든다
 */
function vocabulary(posts: SearchablePost[]): { word: string; jamo: string }[] {
	let list = vocabularies.get(posts);
	if (list) return list;
	const words = new Set<string>();
	const split = (text: string) => text.split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
	for (const post of posts) {
		const index = searchIndexOf(post);
		for (const word of split(`${index.title} ${index.slug} ${index.tags}`)) {
			if ([...word].length >= 2) words.add(word);
		}
		const titleWords = split(index.title);
		for (let start = 0; start < titleWords.length; start++) {
			for (let size = 2; size <= MAX_JOINED_WORDS && start + size <= titleWords.length; size++) {
				words.add(titleWords.slice(start, start + size).join(' '));
			}
		}
	}
	// 사전의 표기는 띄어쓰기 없이 (확장프로그램). 띄우면 낱말마다 따로 찾아 사전의 묶음으로 넓혀지지 않는다
	for (const spelling of ALIASES.keys()) words.add(spelling);
	list = [...words].map((word) => ({ word, jamo: toJamo(word.replaceAll(' ', '')) }));
	vocabularies.set(posts, list);
	return list;
}

/**
 * 고친 검색어 ("혹시 ○○?"). 어느 글에도 없는 낱말을, 제목·주소·태그의 낱말 중 자모 단위로 가장 가까운 낱말로 바꾼다.
 * 바꾼 검색어로 찾은 글이 있을 때만 돌려준다. 고칠 것이 없으면 null
 */
export function suggestQuery(posts: SearchablePost[], query: string): string | null {
	const parsed = parseQuery(query);
	if (parsed.terms.length === 0) return null;
	const words = vocabulary(posts);
	let changed = false;
	const fixed = parsed.terms.map((term) => {
		// 제목·주소·태그 어딘가에 있는 낱말은 고치지 않는다 (다른 표기로 있어도. 본문에만 있는 낱말은 오타일 수 있어 후보를 찾는다)
		if (posts.some((post) => termScore(searchIndexOf(post), term) >= SEARCH_WEIGHTS.tags * ALIAS_WEIGHT)) {
			return term.text;
		}
		const jamo = toJamo(term.text);
		if ([...jamo].length < MIN_SIMILAR_LENGTH) return term.text;
		const allowed = similarLimit([...jamo].length);
		let best: { word: string; distance: number } | null = null;
		for (const candidate of words) {
			const distance = editDistance(jamo, candidate.jamo);
			if (distance <= allowed && (!best || distance < best.distance)) best = { word: candidate.word, distance };
		}
		if (!best || best.word === term.text) return term.text;
		changed = true;
		return best.word;
	});
	if (!changed) return null;
	const suggestion = fixed.join(' ');
	const result = parseQuery(suggestion);
	return posts.some((post) => scorePost(post, result) > 0) ? suggestion : null;
}

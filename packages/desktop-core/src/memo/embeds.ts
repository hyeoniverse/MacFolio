/**
 * 글에 주소만 한 줄로 적은 바깥 링크를 iframe 임베드로 그릴 수 있는지 판별한다.
 * 읽기 화면(MemoMarkdown), 편집기(writer/embedPreview), CSP의 frame-src(worker/securityHeaders)가 이 목록 하나를 쓴다.
 * iframe 주소는 원래 주소를 그대로 쓰지 않고, 주소에서 뽑은 ID로 각 사이트의 임베드 주소를 새로 만든다
 */

export type EmbedProvider =
	'youtube' | 'vimeo' | 'codepen' | 'codesandbox' | 'stackblitz' | 'spotify' | 'loom' | 'figma';

export interface Embed {
	provider: EmbedProvider;
	/** 사이트 이름 (iframe 제목과 캡션) */
	name: string;
	/** iframe 주소 */
	src: string;
	/** 가로세로 비율(예: '16 / 9'). 없으면 height로 높이를 고정한다 */
	aspectRatio?: string;
	/** 높이(px). aspectRatio가 없을 때 쓴다 */
	height?: number;
}

/** 각 사이트의 임베드 주소 출처. CSP frame-src에 이 출처만 더한다 */
export const EMBED_ORIGINS: Readonly<Record<EmbedProvider, string>> = {
	youtube: 'https://www.youtube-nocookie.com',
	vimeo: 'https://player.vimeo.com',
	codepen: 'https://codepen.io',
	codesandbox: 'https://codesandbox.io',
	stackblitz: 'https://stackblitz.com',
	spotify: 'https://open.spotify.com',
	loom: 'https://www.loom.com',
	figma: 'https://www.figma.com',
};

/**
 * desktop-core는 DOM·Node 타입을 쓰지 않는다(브라우저·Node·Worker 어디서나 돈다).
 * 세 환경 모두에 있는 URL 가운데 여기서 쓰는 부분만 선언한다
 */
interface ParsedUrl {
	protocol: string;
	hostname: string;
	pathname: string;
	search: string;
	searchParams: { get(name: string): string | null };
}
declare const URL: new (input: string) => ParsedUrl;

/** 주소의 ID에 쓸 수 있는 글자 (주소를 iframe src에 다시 넣으므로 그 밖의 글자는 받지 않는다) */
const ID = /^[\w-]+$/;

/** YouTube의 시작 시각 t=90, t=1m30s, start=90 → 초 */
function startSeconds(value: string | null): number | null {
	if (!value) return null;
	if (/^\d+$/.test(value)) return Number(value);
	const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
	if (!match || !match[0]) return null;
	return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function youtube(url: ParsedUrl): Embed | null {
	const host = url.hostname.replace(/^(www|m)\./, '');
	const segments = url.pathname.split('/').filter(Boolean);
	let id: string | null = null;
	let vertical = false;
	if (host === 'youtu.be') id = segments[0] ?? null;
	else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		if (segments[0] === 'watch') id = url.searchParams.get('v');
		else if (segments[0] === 'shorts') [id, vertical] = [segments[1] ?? null, true];
		else if (segments[0] === 'embed' || segments[0] === 'live') id = segments[1] ?? null;
	}
	if (!id || !ID.test(id)) return null;
	const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
	return {
		provider: 'youtube',
		name: 'YouTube',
		src: `${EMBED_ORIGINS.youtube}/embed/${id}${start ? `?start=${start}` : ''}`,
		aspectRatio: vertical ? '9 / 16' : '16 / 9',
	};
}

function vimeo(url: ParsedUrl): Embed | null {
	const [first, second] = url.pathname.split('/').filter(Boolean);
	const id = url.hostname === 'player.vimeo.com' && first === 'video' ? second : first;
	if (!id || !/^\d+$/.test(id)) return null;
	return { provider: 'vimeo', name: 'Vimeo', src: `${EMBED_ORIGINS.vimeo}/video/${id}`, aspectRatio: '16 / 9' };
}

function codepen(url: ParsedUrl): Embed | null {
	const [user, kind, id] = url.pathname.split('/').filter(Boolean);
	if (!user || (kind !== 'pen' && kind !== 'embed') || !id || !ID.test(user) || !ID.test(id)) return null;
	return {
		provider: 'codepen',
		name: 'CodePen',
		src: `${EMBED_ORIGINS.codepen}/${user}/embed/${id}?default-tab=result`,
		height: 420,
	};
}

function codesandbox(url: ParsedUrl): Embed | null {
	const segments = url.pathname.split('/').filter(Boolean);
	// /s/<id>, /p/sandbox/<id>, /embed/<id>
	const id = segments[0] === 's' || segments[0] === 'embed' ? segments[1] : segments[0] === 'p' ? segments[2] : null;
	if (!id || !ID.test(id)) return null;
	return { provider: 'codesandbox', name: 'CodeSandbox', src: `${EMBED_ORIGINS.codesandbox}/embed/${id}`, height: 500 };
}

function stackblitz(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if (kind !== 'edit' || !id || !ID.test(id)) return null;
	return {
		provider: 'stackblitz',
		name: 'StackBlitz',
		src: `${EMBED_ORIGINS.stackblitz}/edit/${id}?embed=1`,
		height: 500,
	};
}

const SPOTIFY_KINDS = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist']);

function spotify(url: ParsedUrl): Embed | null {
	// /track/<id>, /intl-ko/track/<id>, /embed/track/<id>
	const segments = url.pathname
		.split('/')
		.filter((segment: string) => segment && !segment.startsWith('intl-') && segment !== 'embed');
	const [kind, id] = segments;
	if (!kind || !SPOTIFY_KINDS.has(kind) || !id || !ID.test(id)) return null;
	return {
		provider: 'spotify',
		name: 'Spotify',
		src: `${EMBED_ORIGINS.spotify}/embed/${kind}/${id}`,
		height: kind === 'track' || kind === 'episode' ? 152 : 352,
	};
}

function loom(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if ((kind !== 'share' && kind !== 'embed') || !id || !ID.test(id)) return null;
	return { provider: 'loom', name: 'Loom', src: `${EMBED_ORIGINS.loom}/embed/${id}`, aspectRatio: '16 / 9' };
}

const FIGMA_KINDS = new Set(['file', 'design', 'proto', 'board', 'slides']);

function figma(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if (!kind || !FIGMA_KINDS.has(kind) || !id || !ID.test(id)) return null;
	return {
		provider: 'figma',
		name: 'Figma',
		// Figma의 임베드 주소는 원래 주소를 url 인자로 받는다. 경로와 검색 인자만 다시 붙여 다른 출처의 주소는 넣지 않는다
		src: `${EMBED_ORIGINS.figma}/embed?embed_host=share&url=${encodeURIComponent(`https://www.figma.com${url.pathname}${url.search}`)}`,
		aspectRatio: '16 / 10',
	};
}

const PROVIDERS: Record<string, (url: ParsedUrl) => Embed | null> = {
	'youtube.com': youtube,
	'www.youtube.com': youtube,
	'm.youtube.com': youtube,
	'youtu.be': youtube,
	'www.youtube-nocookie.com': youtube,
	'vimeo.com': vimeo,
	'www.vimeo.com': vimeo,
	'player.vimeo.com': vimeo,
	'codepen.io': codepen,
	'codesandbox.io': codesandbox,
	'stackblitz.com': stackblitz,
	'open.spotify.com': spotify,
	'www.loom.com': loom,
	'loom.com': loom,
	'www.figma.com': figma,
	'figma.com': figma,
};

/** 주소를 임베드할 수 있으면 그 iframe 정보. 지원하지 않는 사이트나 https가 아닌 주소는 null */
export function embedOf(href: string): Embed | null {
	let url: ParsedUrl;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;
	return PROVIDERS[url.hostname]?.(url) ?? null;
}

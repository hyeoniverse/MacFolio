/**
 * 글에 주소만 한 줄로 적은 바깥 링크를 iframe 임베드로 그릴 수 있는지 판별한다.
 * 읽기 화면(MemoMarkdown), 편집기(writer/embedPreview), CSP의 frame-src(worker/securityHeaders)가 이 목록 하나를 쓴다.
 * iframe 주소는 원래 주소를 그대로 쓰지 않고, 주소에서 뽑은 ID로 각 사이트의 임베드 주소를 새로 만든다
 */

export type EmbedProvider =
	| 'youtube'
	| 'vimeo'
	| 'twitch'
	| 'ted'
	| 'streamable'
	| 'loom'
	| 'tiktok'
	| 'instagram'
	| 'spotify'
	| 'soundcloud'
	| 'applemusic'
	| 'applepodcasts'
	| 'codepen'
	| 'codesandbox'
	| 'stackblitz'
	| 'jsfiddle'
	| 'figma'
	| 'miro'
	| 'canva'
	| 'googledocs'
	| 'googledrive';

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
	/** 최대 폭(px). 세로 영상·SNS 게시물처럼 본문 폭 전체로 늘리면 어색한 것만. 가운데에 둔다 */
	maxWidth?: number;
}

/**
 * 각 사이트의 임베드 주소 출처. CSP frame-src에 이 출처만 더한다.
 * 첫 출처가 iframe 주소의 출처이고, 그 뒤는 임베드 재생기가 넘어가는(리다이렉트) 출처다 (frame-src는 넘어간 곳에도 적용된다)
 */
export const EMBED_ORIGINS: Readonly<Record<EmbedProvider, readonly string[]>> = {
	youtube: ['https://www.youtube-nocookie.com'],
	vimeo: ['https://player.vimeo.com'],
	twitch: ['https://player.twitch.tv', 'https://clips.twitch.tv'],
	ted: ['https://embed.ted.com'],
	streamable: ['https://streamable.com'],
	loom: ['https://www.loom.com'],
	tiktok: ['https://www.tiktok.com'],
	instagram: ['https://www.instagram.com'],
	spotify: ['https://open.spotify.com'],
	soundcloud: ['https://w.soundcloud.com'],
	applemusic: ['https://embed.music.apple.com'],
	applepodcasts: ['https://embed.podcasts.apple.com'],
	codepen: ['https://codepen.io'],
	codesandbox: ['https://codesandbox.io'],
	stackblitz: ['https://stackblitz.com'],
	jsfiddle: ['https://jsfiddle.net'],
	figma: ['https://www.figma.com'],
	miro: ['https://miro.com'],
	canva: ['https://www.canva.com'],
	googledocs: ['https://docs.google.com'],
	googledrive: ['https://drive.google.com'],
};

/** 사이트의 iframe 주소 출처 */
const origin = (provider: EmbedProvider) => EMBED_ORIGINS[provider][0];

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
/** 숫자 ID */
const DIGITS = /^\d+$/;
/** 경로 조각 (Apple Music의 앨범 이름처럼 한글이 퍼센트 인코딩된 것 포함). /·?·# 같은 구분 글자는 없다 */
const SEGMENT = /^[\w%.-]+$/;

const segmentsOf = (url: ParsedUrl) => url.pathname.split('/').filter(Boolean);

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
		src: `${origin('youtube')}/embed/${id}${start ? `?start=${start}` : ''}`,
		aspectRatio: vertical ? '9 / 16' : '16 / 9',
		...(vertical && { maxWidth: 352 }),
	};
}

function vimeo(url: ParsedUrl): Embed | null {
	const [first, second] = url.pathname.split('/').filter(Boolean);
	const id = url.hostname === 'player.vimeo.com' && first === 'video' ? second : first;
	if (!id || !/^\d+$/.test(id)) return null;
	return { provider: 'vimeo', name: 'Vimeo', src: `${origin('vimeo')}/video/${id}`, aspectRatio: '16 / 9' };
}

function codepen(url: ParsedUrl): Embed | null {
	const [user, kind, id] = url.pathname.split('/').filter(Boolean);
	if (!user || (kind !== 'pen' && kind !== 'embed') || !id || !ID.test(user) || !ID.test(id)) return null;
	return {
		provider: 'codepen',
		name: 'CodePen',
		src: `${origin('codepen')}/${user}/embed/${id}?default-tab=result`,
		height: 420,
	};
}

function codesandbox(url: ParsedUrl): Embed | null {
	const segments = url.pathname.split('/').filter(Boolean);
	// /s/<id>, /p/sandbox/<id>, /embed/<id>
	const id = segments[0] === 's' || segments[0] === 'embed' ? segments[1] : segments[0] === 'p' ? segments[2] : null;
	if (!id || !ID.test(id)) return null;
	return { provider: 'codesandbox', name: 'CodeSandbox', src: `${origin('codesandbox')}/embed/${id}`, height: 500 };
}

function stackblitz(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if (kind !== 'edit' || !id || !ID.test(id)) return null;
	return {
		provider: 'stackblitz',
		name: 'StackBlitz',
		src: `${origin('stackblitz')}/edit/${id}?embed=1`,
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
		src: `${origin('spotify')}/embed/${kind}/${id}`,
		height: kind === 'track' || kind === 'episode' ? 152 : 352,
	};
}

function loom(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if ((kind !== 'share' && kind !== 'embed') || !id || !ID.test(id)) return null;
	return { provider: 'loom', name: 'Loom', src: `${origin('loom')}/embed/${id}`, aspectRatio: '16 / 9' };
}

const FIGMA_KINDS = new Set(['file', 'design', 'proto', 'board', 'slides']);

function figma(url: ParsedUrl): Embed | null {
	const [kind, id] = url.pathname.split('/').filter(Boolean);
	if (!kind || !FIGMA_KINDS.has(kind) || !id || !ID.test(id)) return null;
	return {
		provider: 'figma',
		name: 'Figma',
		// Figma의 임베드 주소는 원래 주소를 url 인자로 받는다. 경로와 검색 인자만 다시 붙여 다른 출처의 주소는 넣지 않는다
		src: `${origin('figma')}/embed?embed_host=share&url=${encodeURIComponent(`https://www.figma.com${url.pathname}${url.search}`)}`,
		aspectRatio: '16 / 10',
	};
}

/** Twitch 주소의 첫 조각이 채널 이름이 아닌 것 */
const TWITCH_RESERVED = new Set(['directory', 'videos', 'p', 'settings', 'downloads', 'jobs', 'turbo', 'search']);

/**
 * Twitch: 채널(생방송), 다시보기(videos/<숫자>), 클립. Twitch 재생기는 삽입한 사이트의 도메인을 parent 인자로 받아야 열린다.
 * parent를 모르면(서버·시험 환경) 임베드하지 않는다
 */
function twitch(url: ParsedUrl, { parent }: EmbedOptions): Embed | null {
	if (!parent || !/^[a-z0-9.-]+$/i.test(parent)) return null;
	const segments = segmentsOf(url);
	const clip = url.hostname === 'clips.twitch.tv' ? segments[0] : segments[1] === 'clip' ? segments[2] : undefined;
	if (clip !== undefined) {
		if (!ID.test(clip)) return null;
		return {
			provider: 'twitch',
			name: 'Twitch',
			src: `${EMBED_ORIGINS.twitch[1]}/embed?clip=${clip}&parent=${parent}&autoplay=false`,
			aspectRatio: '16 / 9',
		};
	}
	if (url.hostname === 'clips.twitch.tv') return null;
	const [first, second] = segments;
	const query =
		first === 'videos' && second && DIGITS.test(second)
			? `video=${second}`
			: first && segments.length === 1 && /^\w+$/.test(first) && !TWITCH_RESERVED.has(first)
				? `channel=${first}`
				: null;
	if (!query) return null;
	return {
		provider: 'twitch',
		name: 'Twitch',
		src: `${origin('twitch')}/?${query}&parent=${parent}&autoplay=false`,
		aspectRatio: '16 / 9',
	};
}

function ted(url: ParsedUrl): Embed | null {
	const [kind, slug] = segmentsOf(url);
	if (kind !== 'talks' || !slug || !ID.test(slug)) return null;
	return { provider: 'ted', name: 'TED', src: `${origin('ted')}/talks/${slug}`, aspectRatio: '16 / 9' };
}

function streamable(url: ParsedUrl): Embed | null {
	const segments = segmentsOf(url);
	const id = segments[0] === 'e' ? segments[1] : segments.length === 1 ? segments[0] : undefined;
	if (!id || !/^[a-z0-9]+$/i.test(id)) return null;
	return { provider: 'streamable', name: 'Streamable', src: `${origin('streamable')}/e/${id}`, aspectRatio: '16 / 9' };
}

function tiktok(url: ParsedUrl): Embed | null {
	// tiktok.com/@<사용자>/video/<숫자>
	const [user, kind, id] = segmentsOf(url);
	if (!user?.startsWith('@') || kind !== 'video' || !id || !DIGITS.test(id)) return null;
	return {
		provider: 'tiktok',
		name: 'TikTok',
		src: `${origin('tiktok')}/embed/v2/${id}`,
		height: 760,
		maxWidth: 340,
	};
}

const INSTAGRAM_KINDS = new Set(['p', 'reel', 'tv']);

function instagram(url: ParsedUrl): Embed | null {
	const [kind, code] = segmentsOf(url);
	if (!kind || !INSTAGRAM_KINDS.has(kind) || !code || !ID.test(code)) return null;
	return {
		provider: 'instagram',
		name: 'Instagram',
		src: `${origin('instagram')}/${kind}/${code}/embed`,
		height: 720,
		maxWidth: 540,
	};
}

/** SoundCloud 주소의 첫 조각이 사용자 이름이 아닌 것 */
const SOUNDCLOUD_RESERVED = new Set(['discover', 'stream', 'search', 'you', 'upload', 'charts', 'settings', 'pages']);

function soundcloud(url: ParsedUrl): Embed | null {
	// soundcloud.com/<사용자>, /<사용자>/<곡>, /<사용자>/sets/<재생 목록>
	const segments = segmentsOf(url);
	if (segments.length === 0 || segments.length > 3 || !segments.every((segment) => ID.test(segment))) return null;
	if (SOUNDCLOUD_RESERVED.has(segments[0]) || (segments.length === 3 && segments[1] !== 'sets')) return null;
	const track = segments.length === 2 && segments[1] !== 'sets';
	// SoundCloud 재생기는 원래 주소를 url 인자로 받는다. 검사한 경로만 다시 붙여 다른 주소는 넣지 않는다
	const page = encodeURIComponent(`https://soundcloud.com/${segments.join('/')}`);
	return {
		provider: 'soundcloud',
		name: 'SoundCloud',
		src: `${origin('soundcloud')}/player/?url=${page}&visual=false`,
		height: track ? 166 : 450,
	};
}

const APPLE_MUSIC_KINDS = new Set(['album', 'playlist', 'song', 'music-video', 'station']);

function applemusic(url: ParsedUrl): Embed | null {
	// music.apple.com/<국가>/album/<이름>/<id>(?i=<곡 id>)
	const segments = segmentsOf(url);
	const [country, kind] = segments;
	if (!country || !/^[a-z]{2}$/.test(country) || !kind || !APPLE_MUSIC_KINDS.has(kind)) return null;
	if (segments.length < 3 || segments.length > 4 || !segments.every((segment) => SEGMENT.test(segment))) return null;
	const song = url.searchParams.get('i');
	if (song !== null && !DIGITS.test(song)) return null;
	return {
		provider: 'applemusic',
		name: 'Apple Music',
		src: `${origin('applemusic')}/${segments.join('/')}${song ? `?i=${song}` : ''}`,
		height: song || kind === 'song' ? 175 : 450,
	};
}

function applepodcasts(url: ParsedUrl): Embed | null {
	// podcasts.apple.com/<국가>/podcast/<이름>/id<숫자>(?i=<에피소드 id>)
	const segments = segmentsOf(url);
	const [country, kind, , id] = segments;
	if (!country || !/^[a-z]{2}$/.test(country) || kind !== 'podcast' || segments.length !== 4) return null;
	if (!id || !/^id\d+$/.test(id) || !segments.every((segment) => SEGMENT.test(segment))) return null;
	const episode = url.searchParams.get('i');
	if (episode !== null && !DIGITS.test(episode)) return null;
	return {
		provider: 'applepodcasts',
		name: 'Apple 팟캐스트',
		src: `${origin('applepodcasts')}/${segments.join('/')}${episode ? `?i=${episode}` : ''}`,
		// 쇼 카드는 폭에 따라 높이가 바뀌는 16:9 모양이라 높이를 고정하면 아래가 빈다. 에피소드는 175px 한 줄
		...(episode ? { height: 175 } : { aspectRatio: '16 / 9' }),
	};
}

function jsfiddle(url: ParsedUrl): Embed | null {
	// jsfiddle.net/<id>, /<사용자>/<id>, 끝에 /<판 번호>
	const segments = segmentsOf(url).filter(
		(segment) => !/^\d+$/.test(segment) && segment !== 'embedded' && segment !== 'show'
	);
	if (segments.length === 0 || segments.length > 2 || !segments.every((segment) => ID.test(segment))) return null;
	return {
		provider: 'jsfiddle',
		name: 'JSFiddle',
		src: `${origin('jsfiddle')}/${segments.join('/')}/embedded/`,
		height: 420,
	};
}

function miro(url: ParsedUrl): Embed | null {
	// miro.com/app/board/<id>/ (보드 id는 끝에 = 가 붙는다)
	const [app, kind, id] = segmentsOf(url);
	if (app !== 'app' || (kind !== 'board' && kind !== 'live-embed') || !id || !/^[\w=-]+$/.test(id)) return null;
	return { provider: 'miro', name: 'Miro', src: `${origin('miro')}/app/live-embed/${id}/`, aspectRatio: '16 / 9' };
}

function canva(url: ParsedUrl): Embed | null {
	// canva.com/design/<id>/<공유 토큰>/view
	const [kind, id, token] = segmentsOf(url);
	if (kind !== 'design' || !id || !token || !ID.test(id) || !ID.test(token)) return null;
	return {
		provider: 'canva',
		name: 'Canva',
		src: `${origin('canva')}/design/${id}/${token}/view?embed`,
		aspectRatio: '16 / 9',
	};
}

/** Google 문서 종류마다 이름, 공유 주소(/d/<id>)의 임베드 경로, 게시 주소(/d/e/<id>)의 임베드 경로, 크기 */
const GOOGLE_DOCS: Record<
	string,
	{ name: string; shared: string | null; published: string; size: Pick<Embed, 'aspectRatio' | 'height'> }
> = {
	document: { name: 'Google 문서', shared: 'preview', published: 'pub?embedded=true', size: { height: 640 } },
	presentation: { name: 'Google 프레젠테이션', shared: 'embed', published: 'embed', size: { aspectRatio: '16 / 9' } },
	spreadsheets: {
		name: 'Google 스프레드시트',
		shared: 'preview',
		published: 'pubhtml?widget=true&headers=false',
		size: { height: 480 },
	},
	// 설문지는 응답 주소(/d/e/<id>/viewform)만 공개된다
	forms: { name: 'Google 설문지', shared: null, published: 'viewform?embedded=true', size: { height: 800 } },
};

function googledocs(url: ParsedUrl): Embed | null {
	const [kind, d, third, fourth] = segmentsOf(url);
	const type = kind ? GOOGLE_DOCS[kind] : undefined;
	if (!type || d !== 'd' || !third) return null;
	const published = third === 'e';
	const id = published ? fourth : third;
	if (!id || !ID.test(id) || (!published && !type.shared)) return null;
	return {
		provider: 'googledocs',
		name: type.name,
		src: `${origin('googledocs')}/${kind}/d/${published ? `e/${id}/${type.published}` : `${id}/${type.shared}`}`,
		...type.size,
	};
}

function googledrive(url: ParsedUrl): Embed | null {
	const [kind, d, id] = segmentsOf(url);
	if (kind !== 'file' || d !== 'd' || !id || !ID.test(id)) return null;
	return {
		provider: 'googledrive',
		name: 'Google Drive',
		src: `${origin('googledrive')}/file/d/${id}/preview`,
		aspectRatio: '4 / 3',
	};
}

/** 임베드에 필요한 삽입 사이트 정보 */
export interface EmbedOptions {
	/** 이 글을 띄운 사이트의 도메인 (Twitch 재생기의 parent 인자). 브라우저에서는 location.hostname */
	parent?: string;
}

const PROVIDERS: Record<string, (url: ParsedUrl, options: EmbedOptions) => Embed | null> = {
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
	'www.twitch.tv': twitch,
	'twitch.tv': twitch,
	'm.twitch.tv': twitch,
	'clips.twitch.tv': twitch,
	'www.ted.com': ted,
	'ted.com': ted,
	'streamable.com': streamable,
	'www.tiktok.com': tiktok,
	'tiktok.com': tiktok,
	'www.instagram.com': instagram,
	'instagram.com': instagram,
	'soundcloud.com': soundcloud,
	'm.soundcloud.com': soundcloud,
	'music.apple.com': applemusic,
	'podcasts.apple.com': applepodcasts,
	'jsfiddle.net': jsfiddle,
	'miro.com': miro,
	'www.canva.com': canva,
	'canva.com': canva,
	'docs.google.com': googledocs,
	'drive.google.com': googledrive,
};

/** 주소를 임베드할 수 있으면 그 iframe 정보. 지원하지 않는 사이트나 https가 아닌 주소는 null */
export function embedOf(href: string, options: EmbedOptions = {}): Embed | null {
	let url: ParsedUrl;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;
	return PROVIDERS[url.hostname]?.(url, options) ?? null;
}

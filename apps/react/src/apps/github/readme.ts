// 프로필 README를 GitHub 앱에 맞게 고치는 규칙 (rehype 플러그인). React와 DOM에 의존하지 않는다.
// - 상대 주소(./profile/stats-light.svg)를 프로필 저장소 주소로
// - <picture>는 앱의 화면 모드(밝게·어둡게)에 맞는 그림 하나로 (브라우저는 OS 설정만 본다)
// - shields.io 배지 링크는 앱의 Contact 단추로, capsule-render 배너는 CSS 배너로 (외부 그림이 멈춰도 깨지지 않게)

export interface HastText {
	type: 'text';
	value: string;
}

export interface HastElement {
	type: 'element';
	tagName: string;
	properties: Record<string, unknown>;
	children: HastNode[];
}

export type HastNode = HastElement | HastText | { type: 'comment' | 'doctype' | 'raw'; value?: string };

interface HastRoot {
	type: 'root';
	children: HastNode[];
}

const element = (tagName: string, properties: Record<string, unknown>, children: HastNode[] = []): HastElement => ({
	type: 'element',
	tagName,
	properties,
	children,
});
const text = (value: string): HastText => ({ type: 'text', value });
const isElement = (node: HastNode, tagName?: string): node is HastElement =>
	node.type === 'element' && (!tagName || (node as HastElement).tagName === tagName);

/** 상대 주소를 기준 주소로 푼다. http(s)·mailto·#는 그대로 */
export function resolveUrl(value: string, base: string): string {
	if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(value)) return value;
	try {
		return new URL(value, base).toString();
	} catch {
		return value;
	}
}

export interface Badge {
	label: string;
	color: string;
	logo: string | null;
}

/** shields.io의 /badge/ 글자 규칙: -- → -, __ → _, _ → 공백 */
const badgeText = (value: string) =>
	decodeURIComponent(value)
		.split('--')
		.map((part) =>
			part
				.split('__')
				.map((piece) => piece.replace(/_/g, ' '))
				.join('_')
		)
		.join('-');

/** https://img.shields.io/badge/Gmail-EA4335?logo=gmail → { label: 'Gmail', color: '#EA4335', logo: 'gmail' } */
export function parseBadge(src: string): Badge | null {
	let url: URL;
	try {
		url = new URL(src);
	} catch {
		return null;
	}
	if (url.hostname !== 'img.shields.io' || !url.pathname.startsWith('/badge/')) return null;
	// 라벨-색 또는 라벨-메시지-색 (글자 안의 -는 --로 적는다)
	const parts = url.pathname
		.slice('/badge/'.length)
		.replace(/\.(svg|png)$/, '')
		.split(/(?<!-)-(?!-)/);
	if (parts.length < 2) return null;
	const color = parts.at(-1)!;
	const label = parts.slice(0, -1).map(badgeText).filter(Boolean).join(' ');
	if (!label || !/^[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return null;
	return { label, color: `#${color.toUpperCase()}`, logo: url.searchParams.get('logo') };
}

/** 배지의 로고 → Font Awesome 아이콘 */
const LOGO_ICONS: Record<string, string> = {
	gmail: 'fa-solid fa-envelope',
	'google-chrome': 'fa-solid fa-globe',
	baekjoon: 'fa-solid fa-code',
	github: 'fa-brands fa-github',
	linkedin: 'fa-brands fa-linkedin',
	instagram: 'fa-brands fa-instagram',
	x: 'fa-brands fa-x-twitter',
	twitter: 'fa-brands fa-x-twitter',
	youtube: 'fa-brands fa-youtube',
	discord: 'fa-brands fa-discord',
	notion: 'fa-solid fa-book',
	velog: 'fa-solid fa-pen-nib',
	tistory: 'fa-solid fa-pen-nib',
};

export const badgeIcon = (badge: Badge) =>
	(badge.logo && LOGO_ICONS[badge.logo.toLowerCase()]) ??
	(badge.label.toLowerCase().includes('mail') ? 'fa-solid fa-envelope' : 'fa-solid fa-link');

export interface Capsule {
	text: string;
	desc: string;
	/** CSS 그라데이션 (색이 없으면 기본 분홍) */
	background: string;
}

/** https://capsule-render.vercel.app/api?text=…&desc=…&color=0:A8004E,100:F74D96 → CSS 배너 값 */
export function parseCapsule(src: string): Capsule | null {
	let url: URL;
	try {
		url = new URL(src);
	} catch {
		return null;
	}
	if (url.hostname !== 'capsule-render.vercel.app') return null;
	const textValue = url.searchParams.get('text');
	if (!textValue) return null;
	const stops = (url.searchParams.get('color') ?? '')
		.split(',')
		.map((stop) => /^(\d{1,3}):([0-9a-f]{6})$/i.exec(stop.trim()))
		.filter((match): match is RegExpExecArray => match !== null)
		.map(([, at, color]) => `#${color} ${Math.min(100, Number(at))}%`);
	const single = /^[0-9a-f]{6}$/i.test(url.searchParams.get('color') ?? '')
		? `#${url.searchParams.get('color')}`
		: null;
	return {
		text: textValue,
		desc: url.searchParams.get('desc') ?? '',
		background:
			stops.length >= 2
				? `linear-gradient(90deg, ${stops.join(', ')})`
				: (single ?? 'linear-gradient(90deg, #a8004e 0%, #d40063 50%, #f74d96 100%)'),
	};
}

const firstSrc = (value: unknown): string | null => {
	const raw = Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';
	return raw.split(',')[0]?.trim().split(/\s+/)[0] || null;
};

export interface ReadmeOptions {
	/** 그림 주소의 기준 (raw.githubusercontent.com/…/HEAD/) */
	rawBase: string;
	/** 링크 주소의 기준 (github.com/…/blob/HEAD/) */
	blobBase: string;
	dark: boolean;
}

/** 공백뿐인 글자를 뺀 자식 */
const meaningful = (node: HastElement) =>
	node.children.filter((child) => !(child.type === 'text' && !(child as HastText).value.trim()));

function transform(node: HastNode, options: ReadmeOptions): HastNode {
	if (!isElement(node)) return node;

	if (node.tagName === 'picture') {
		const img = node.children.find((child): child is HastElement => isElement(child, 'img'));
		if (!img) return node;
		const dark = node.children.find(
			(child): child is HastElement =>
				isElement(child, 'source') && String(child.properties.media ?? '').includes('prefers-color-scheme: dark')
		);
		const src = options.dark && dark ? firstSrc(dark.properties.srcSet) : null;
		return transform(element('img', { ...img.properties, ...(src ? { src } : {}) }), options);
	}

	if (node.tagName === 'img' && typeof node.properties.src === 'string') {
		const src = resolveUrl(node.properties.src, options.rawBase);
		const capsule = parseCapsule(src);
		if (capsule)
			return element(
				'div',
				{
					className: ['gh-banner'],
					role: 'img',
					ariaLabel: String(node.properties.alt ?? capsule.text),
					style: `background: ${capsule.background}`,
				},
				[
					element('strong', {}, [text(capsule.text)]),
					...(capsule.desc ? [element('span', {}, [text(capsule.desc)])] : []),
				]
			);
		return { ...node, properties: { ...node.properties, src, loading: 'lazy' } };
	}

	if (node.tagName === 'a' && typeof node.properties.href === 'string') {
		const href = resolveUrl(node.properties.href, options.blobBase);
		const only = meaningful(node);
		const badge =
			only.length === 1 && isElement(only[0], 'img') && typeof only[0].properties.src === 'string'
				? parseBadge(only[0].properties.src)
				: null;
		if (badge)
			return element('a', { href, className: ['gh-contact-button'], style: `background-color: ${badge.color}` }, [
				element('i', { className: badgeIcon(badge).split(' '), ariaHidden: 'true' }),
				text(` ${badge.label}`),
			]);
		return {
			...node,
			properties: { ...node.properties, href },
			children: node.children.map((child) => transform(child, options)),
		};
	}

	return { ...node, children: node.children.map((child) => transform(child, options)) };
}

/** rehype 플러그인: rehype-raw·rehype-sanitize 뒤에 건다 (넣은 class·style이 지워지지 않게) */
export function rehypeGithubReadme(options: ReadmeOptions) {
	return (tree: HastRoot) => {
		tree.children = tree.children.map((child) => transform(child, options));
	};
}

/** 프로필 README가 있는 저장소의 링크 기준 (https://github.com/<login>/<login>/blob/HEAD/) */
export const readmeBlobBase = (login: string) =>
	`https://github.com/${encodeURIComponent(login)}/${encodeURIComponent(login)}/blob/HEAD/`;

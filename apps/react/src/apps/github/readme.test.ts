import { describe, expect, it } from 'vitest';
import {
	badgeIcon,
	parseBadge,
	parseCapsule,
	rehypeGithubReadme,
	resolveUrl,
	type HastElement,
	type HastNode,
} from './readme';

const el = (tagName: string, properties: Record<string, unknown> = {}, children: HastNode[] = []): HastElement => ({
	type: 'element',
	tagName,
	properties,
	children,
});
const text = (value: string) => ({ type: 'text' as const, value });

const OPTIONS = {
	rawBase: 'https://raw.githubusercontent.com/me/me/HEAD/',
	blobBase: 'https://github.com/me/me/blob/HEAD/',
	dark: false,
};

function run(nodes: HastNode[], options = OPTIONS) {
	const tree = { type: 'root' as const, children: nodes };
	rehypeGithubReadme(options)(tree);
	return tree.children as HastElement[];
}

describe('resolveUrl', () => {
	it('상대 주소만 기준 주소로 푼다', () => {
		expect(resolveUrl('./profile/a.svg', OPTIONS.rawBase)).toBe(
			'https://raw.githubusercontent.com/me/me/HEAD/profile/a.svg'
		);
		expect(resolveUrl('docs/x.md', OPTIONS.blobBase)).toBe('https://github.com/me/me/blob/HEAD/docs/x.md');
		expect(resolveUrl('https://example.com/a.png', OPTIONS.rawBase)).toBe('https://example.com/a.png');
		expect(resolveUrl('mailto:me@example.com', OPTIONS.rawBase)).toBe('mailto:me@example.com');
		expect(resolveUrl('#about', OPTIONS.blobBase)).toBe('#about');
	});
});

describe('parseBadge', () => {
	it('shields.io 배지에서 글자·색·로고를 읽는다', () => {
		expect(parseBadge('https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail')).toEqual({
			label: 'Gmail',
			color: '#EA4335',
			logo: 'gmail',
		});
		expect(parseBadge('https://img.shields.io/badge/solved.ac-17CE3A?logo=baekjoon')).toMatchObject({
			label: 'solved.ac',
			color: '#17CE3A',
		});
		// -- 는 -, _ 는 공백, 라벨-메시지-색
		expect(parseBadge('https://img.shields.io/badge/My--Blog_Posts-Velog-20C997')).toMatchObject({
			label: 'My-Blog Posts Velog',
			color: '#20C997',
			logo: null,
		});
	});

	it('배지가 아니거나 색을 모르면 null (그림 그대로)', () => {
		expect(parseBadge('https://komarev.com/ghpvc/?username=me')).toBeNull();
		expect(parseBadge('https://img.shields.io/github/stars/me/repo')).toBeNull();
		expect(parseBadge('https://img.shields.io/badge/Gmail-red')).toBeNull();
		expect(parseBadge('not a url')).toBeNull();
	});

	it('로고에 맞는 아이콘, 모르면 링크 아이콘', () => {
		expect(badgeIcon({ label: 'Gmail', color: '#000', logo: 'gmail' })).toBe('fa-solid fa-envelope');
		expect(badgeIcon({ label: 'Portfolio', color: '#000', logo: 'google-chrome' })).toBe('fa-solid fa-globe');
		expect(badgeIcon({ label: 'Somewhere', color: '#000', logo: 'unknown' })).toBe('fa-solid fa-link');
	});
});

describe('parseCapsule', () => {
	it('capsule-render 배너의 글자와 그라데이션', () => {
		expect(
			parseCapsule(
				'https://capsule-render.vercel.app/api?type=soft&color=0:A8004E,50:D40063,100:F74D96&text=Hyeoniverse&desc=Frontend%20Focused'
			)
		).toEqual({
			text: 'Hyeoniverse',
			desc: 'Frontend Focused',
			background: 'linear-gradient(90deg, #A8004E 0%, #D40063 50%, #F74D96 100%)',
		});
		expect(parseCapsule('https://capsule-render.vercel.app/api?color=0D1117&text=Hi')?.background).toBe('#0D1117');
		expect(parseCapsule('https://capsule-render.vercel.app/api?type=waving')).toBeNull();
	});
});

describe('rehypeGithubReadme', () => {
	const BADGE = 'https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail';

	it('배지 링크는 Contact 단추로 바꾼다', () => {
		const [link] = run([
			el('a', { href: 'mailto:me@example.com' }, [text('\n  '), el('img', { src: BADGE, alt: 'Gmail' }), text('\n')]),
		]);
		expect(link.properties).toEqual({
			href: 'mailto:me@example.com',
			className: ['gh-contact-button'],
			style: 'background-color: #EA4335',
		});
		expect(
			link.children.map((child) => (child.type === 'text' ? child.value : (child as HastElement).tagName))
		).toEqual(['i', ' Gmail']);
	});

	it('배지가 아닌 그림 링크는 그대로 두고 상대 주소만 푼다', () => {
		const [link] = run([el('a', { href: 'LICENSE' }, [el('img', { src: './a.png' })])]);
		expect(link.properties.href).toBe('https://github.com/me/me/blob/HEAD/LICENSE');
		expect((link.children[0] as HastElement).properties.src).toBe('https://raw.githubusercontent.com/me/me/HEAD/a.png');
	});

	it('<picture>는 화면 모드에 맞는 그림 하나로', () => {
		const picture = () =>
			el('picture', {}, [
				el('source', { media: '(prefers-color-scheme: dark)', srcSet: ['./profile/stats-dark.svg'] }),
				el('img', { src: './profile/stats-light.svg', width: '49%', alt: 'GitHub Stats' }),
			]);
		const [light] = run([picture()]);
		expect(light.tagName).toBe('img');
		expect(light.properties).toMatchObject({
			src: 'https://raw.githubusercontent.com/me/me/HEAD/profile/stats-light.svg',
			width: '49%',
			alt: 'GitHub Stats',
		});
		const [dark] = run([picture()], { ...OPTIONS, dark: true });
		expect(dark.properties.src).toBe('https://raw.githubusercontent.com/me/me/HEAD/profile/stats-dark.svg');
	});

	it('capsule-render 배너는 CSS 배너로', () => {
		const [banner] = run([
			el('img', {
				src: 'https://capsule-render.vercel.app/api?color=0:A8004E,100:F74D96&text=Hello&desc=World',
				alt: 'Hello',
			}),
		]);
		expect(banner).toMatchObject({
			tagName: 'div',
			properties: { className: ['gh-banner'], role: 'img', ariaLabel: 'Hello' },
		});
		expect(banner.properties.style).toContain('linear-gradient');
	});
});

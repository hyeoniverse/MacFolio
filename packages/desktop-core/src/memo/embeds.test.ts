import { describe, expect, it } from 'vitest';
import { EMBED_ORIGINS, embedOf } from './embeds.js';

describe('embedOf', () => {
	it('YouTube: watch·youtu.be·shorts·live 주소를 youtube-nocookie 임베드로, 시작 시각을 초로 바꾼다', () => {
		expect(embedOf('https://www.youtube.com/watch?v=nYkdrAPrdcw')).toEqual({
			provider: 'youtube',
			name: 'YouTube',
			src: 'https://www.youtube-nocookie.com/embed/nYkdrAPrdcw',
			aspectRatio: '16 / 9',
		});
		expect(embedOf('https://youtu.be/nYkdrAPrdcw?t=1m30s')?.src).toBe(
			'https://www.youtube-nocookie.com/embed/nYkdrAPrdcw?start=90'
		);
		expect(embedOf('https://m.youtube.com/watch?v=abc_123&t=45')?.src).toBe(
			'https://www.youtube-nocookie.com/embed/abc_123?start=45'
		);
		expect(embedOf('https://www.youtube.com/shorts/abc123')?.aspectRatio).toBe('9 / 16');
		expect(embedOf('https://www.youtube.com/live/abc123')?.src).toBe('https://www.youtube-nocookie.com/embed/abc123');
	});

	it('Vimeo·CodePen·CodeSandbox·StackBlitz·Spotify·Loom·Figma', () => {
		expect(embedOf('https://vimeo.com/76979871')?.src).toBe('https://player.vimeo.com/video/76979871');
		expect(embedOf('https://codepen.io/team/pen/AbCdEf')?.src).toBe(
			'https://codepen.io/team/embed/AbCdEf?default-tab=result'
		);
		expect(embedOf('https://codesandbox.io/s/new-abc12')?.src).toBe('https://codesandbox.io/embed/new-abc12');
		expect(embedOf('https://codesandbox.io/p/sandbox/abc12')?.src).toBe('https://codesandbox.io/embed/abc12');
		expect(embedOf('https://stackblitz.com/edit/vitejs-vite-abc')?.src).toBe(
			'https://stackblitz.com/edit/vitejs-vite-abc?embed=1'
		);
		expect(embedOf('https://open.spotify.com/intl-ko/track/4uLU6hMCjMI75M1A2tKUQC')).toMatchObject({
			src: 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
			height: 152,
		});
		expect(embedOf('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')?.height).toBe(352);
		expect(embedOf('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184')?.src).toBe(
			'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184'
		);
		expect(embedOf('https://www.figma.com/design/AbC123/Name?node-id=1-2')?.src).toBe(
			`https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent('https://www.figma.com/design/AbC123/Name?node-id=1-2')}`
		);
	});

	it('지원하지 않는 사이트, http, 형식이 다른 주소, ID에 다른 글자가 섞인 주소는 null', () => {
		expect(embedOf('https://github.com/facebookarchive/flux')).toBeNull();
		expect(embedOf('http://www.youtube.com/watch?v=abc')).toBeNull();
		expect(embedOf('https://www.youtube.com/channel/UCabc')).toBeNull();
		expect(embedOf('https://www.youtube.com/watch?v=abc"onload=x')).toBeNull();
		expect(embedOf('https://vimeo.com/channels/staff')).toBeNull();
		expect(embedOf('https://open.spotify.com/user/abc')).toBeNull();
		expect(embedOf('/memo/flux-pattern')).toBeNull();
		expect(embedOf('주소 아님')).toBeNull();
	});

	it('만든 iframe 주소는 모두 EMBED_ORIGINS의 출처다 (CSP frame-src와 일치)', () => {
		const urls = [
			'https://youtu.be/abc',
			'https://vimeo.com/1',
			'https://codepen.io/a/pen/b',
			'https://codesandbox.io/s/a',
			'https://stackblitz.com/edit/a',
			'https://open.spotify.com/album/a',
			'https://www.loom.com/share/a',
			'https://www.figma.com/file/a/b',
		];
		for (const url of urls) {
			const embed = embedOf(url)!;
			expect(embed.src.startsWith(`${EMBED_ORIGINS[embed.provider]}/`)).toBe(true);
		}
	});
});

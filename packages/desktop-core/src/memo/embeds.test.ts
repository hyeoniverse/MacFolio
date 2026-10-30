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

	it('동영상: Twitch(parent 필요)·TED·Streamable', () => {
		const parent = { parent: 'www.hyeoniverse.com' };
		expect(embedOf('https://www.twitch.tv/twitch', parent)?.src).toBe(
			'https://player.twitch.tv/?channel=twitch&parent=www.hyeoniverse.com&autoplay=false'
		);
		expect(embedOf('https://www.twitch.tv/videos/123456', parent)?.src).toBe(
			'https://player.twitch.tv/?video=123456&parent=www.hyeoniverse.com&autoplay=false'
		);
		expect(embedOf('https://www.twitch.tv/somechannel/clip/FunnyClip-abc', parent)?.src).toBe(
			'https://clips.twitch.tv/embed?clip=FunnyClip-abc&parent=www.hyeoniverse.com&autoplay=false'
		);
		expect(embedOf('https://www.twitch.tv/twitch')).toBeNull();
		expect(embedOf('https://www.twitch.tv/directory', parent)).toBeNull();
		expect(embedOf('https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity')?.src).toBe(
			'https://embed.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity'
		);
		expect(embedOf('https://streamable.com/moo')?.src).toBe('https://streamable.com/e/moo');
	});

	it('SNS: TikTok·Instagram은 최대 폭을 둔다', () => {
		expect(embedOf('https://www.tiktok.com/@scout2015/video/6718335390845095173')).toMatchObject({
			src: 'https://www.tiktok.com/embed/v2/6718335390845095173',
			maxWidth: 340,
		});
		expect(embedOf('https://www.instagram.com/reel/C1abcDEF/?igsh=x')).toMatchObject({
			src: 'https://www.instagram.com/reel/C1abcDEF/embed',
			maxWidth: 540,
		});
		expect(embedOf('https://www.youtube.com/shorts/abc123')?.maxWidth).toBe(352);
	});

	it('음악·팟캐스트: SoundCloud·Apple Music·Apple 팟캐스트', () => {
		expect(embedOf('https://soundcloud.com/forss/flickermood')).toEqual({
			provider: 'soundcloud',
			name: 'SoundCloud',
			src: `https://w.soundcloud.com/player/?url=${encodeURIComponent('https://soundcloud.com/forss/flickermood')}&visual=false`,
			height: 166,
		});
		expect(embedOf('https://soundcloud.com/forss/sets/soulhack')?.height).toBe(450);
		expect(embedOf('https://soundcloud.com/discover')).toBeNull();
		expect(embedOf('https://music.apple.com/us/album/1989-taylors-version/1708308989?i=1708308993')).toMatchObject({
			src: 'https://embed.music.apple.com/us/album/1989-taylors-version/1708308989?i=1708308993',
			height: 175,
		});
		expect(embedOf('https://music.apple.com/kr/album/%EC%95%A8%EB%B2%94/123')?.height).toBe(450);
		expect(embedOf('https://podcasts.apple.com/kr/podcast/name/id1234')?.aspectRatio).toBe('16 / 9');
		expect(embedOf('https://podcasts.apple.com/kr/podcast/name/id1234?i=1000')).toMatchObject({
			src: 'https://embed.podcasts.apple.com/kr/podcast/name/id1234?i=1000',
			height: 175,
		});
	});

	it('문서·도구: JSFiddle·Miro·Canva·Google 문서·Drive', () => {
		expect(embedOf('https://jsfiddle.net/user/abc123/4/')?.src).toBe('https://jsfiddle.net/user/abc123/embedded/');
		expect(embedOf('https://miro.com/app/board/uXjVKabc12=/')?.src).toBe(
			'https://miro.com/app/live-embed/uXjVKabc12=/'
		);
		expect(embedOf('https://www.canva.com/design/DAFabc/xyz12/edit')?.src).toBe(
			'https://www.canva.com/design/DAFabc/xyz12/view?embed'
		);
		expect(embedOf('https://docs.google.com/presentation/d/1AbC/edit#slide=id.p')).toMatchObject({
			name: 'Google 프레젠테이션',
			src: 'https://docs.google.com/presentation/d/1AbC/embed',
		});
		expect(embedOf('https://docs.google.com/document/d/1AbC/edit')?.src).toBe(
			'https://docs.google.com/document/d/1AbC/preview'
		);
		expect(embedOf('https://docs.google.com/spreadsheets/d/e/2PACX-1abc/pubhtml')?.src).toBe(
			'https://docs.google.com/spreadsheets/d/e/2PACX-1abc/pubhtml?widget=true&headers=false'
		);
		expect(embedOf('https://docs.google.com/forms/d/e/1FAIpQL/viewform')?.src).toBe(
			'https://docs.google.com/forms/d/e/1FAIpQL/viewform?embedded=true'
		);
		expect(embedOf('https://docs.google.com/forms/d/1abc/edit')).toBeNull();
		expect(embedOf('https://drive.google.com/file/d/1AbC/view?usp=sharing')?.src).toBe(
			'https://drive.google.com/file/d/1AbC/preview'
		);
	});

	it('지원하지 않는 사이트, http, 형식이 다른 주소, ID에 다른 글자가 섞인 주소는 null', () => {
		expect(embedOf('https://github.com/facebookarchive/flux')).toBeNull();
		// 주소만으로 재생기를 열 수 없는 사이트(Dailymotion은 등록한 Player ID가 필요, 네이버 TV는 주소 체계가 바뀜)는 목록에 없다
		expect(embedOf('https://www.dailymotion.com/video/x8abc12')).toBeNull();
		expect(embedOf('https://tv.naver.com/v/12345678')).toBeNull();
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
			'https://www.twitch.tv/twitch',
			'https://clips.twitch.tv/AbcDef',
			'https://www.ted.com/talks/a_b',
			'https://streamable.com/abc',
			'https://www.tiktok.com/@a/video/1',
			'https://www.instagram.com/p/abc/',
			'https://soundcloud.com/a/b',
			'https://music.apple.com/us/album/a/1',
			'https://podcasts.apple.com/us/podcast/a/id1',
			'https://jsfiddle.net/a/b/',
			'https://miro.com/app/board/a=/',
			'https://www.canva.com/design/a/b/view',
			'https://docs.google.com/document/d/a/edit',
			'https://drive.google.com/file/d/a/view',
		];
		for (const url of urls) {
			const embed = embedOf(url, { parent: 'localhost' })!;
			expect(EMBED_ORIGINS[embed.provider].some((origin) => embed.src.startsWith(`${origin}/`))).toBe(true);
		}
	});
});

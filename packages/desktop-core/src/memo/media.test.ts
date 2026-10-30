import { describe, expect, it } from 'vitest';
import { mediaKindOf } from './media.js';

describe('mediaKindOf', () => {
	it('확장자로 영상·음악을 가른다 (대소문자 무시, 검색 인자·조각 제외)', () => {
		expect(mediaKindOf('발표 녹화.MP4')).toBe('video');
		expect(mediaKindOf('https://example.com/a/clip.webm?raw=1#t=10')).toBe('video');
		expect(mediaKindOf('/files/intro.mov')).toBe('video');
		expect(mediaKindOf('노래.mp3')).toBe('audio');
		expect(mediaKindOf('podcast.m4a')).toBe('audio');
		expect(mediaKindOf('sound.flac')).toBe('audio');
	});

	it('영상·음악이 아니거나 확장자가 없으면 null', () => {
		expect(mediaKindOf('문서.pdf')).toBeNull();
		expect(mediaKindOf('https://api.example.com/files/abc123')).toBeNull();
		expect(mediaKindOf('mp3')).toBeNull();
		expect(mediaKindOf('')).toBeNull();
	});
});

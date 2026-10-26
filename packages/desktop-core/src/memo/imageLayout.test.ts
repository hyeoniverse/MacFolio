import { describe, expect, it } from 'vitest';
import { imageLayoutOf, withImageLayout } from './imageLayout.js';
import { resolveImageSrc } from './posts.js';

describe('이미지 배치', () => {
	it('주소 끝의 # 조각에서 배치를 읽고, 없으면 가운데', () => {
		expect(imageLayoutOf('./images/a.jpg#float-right')).toEqual({ src: './images/a.jpg', layout: 'float-right' });
		expect(imageLayoutOf('/files/abcdefghijklmnop#left')).toEqual({ src: '/files/abcdefghijklmnop', layout: 'left' });
		expect(imageLayoutOf('./images/a.jpg')).toEqual({ src: './images/a.jpg', layout: 'center' });
	});

	it('배치가 아닌 # 조각(SVG의 #id 등)은 주소에 남긴다', () => {
		expect(imageLayoutOf('./images/icons.svg#star')).toEqual({ src: './images/icons.svg#star', layout: 'center' });
	});

	it('배치를 적고 바꾸고, 가운데면 지운다', () => {
		expect(withImageLayout('./images/a.jpg', 'right')).toBe('./images/a.jpg#right');
		expect(withImageLayout('./images/a.jpg#right', 'float-left')).toBe('./images/a.jpg#float-left');
		expect(withImageLayout('./images/a.jpg#float-left', 'center')).toBe('./images/a.jpg');
	});

	it('주소를 바꿀 때 배치 표기는 뗀다', () => {
		const images = { 'images/a.jpg': '/assets/a-1.jpg' };
		expect(resolveImageSrc('./images/a.jpg#float-right', images)).toBe('/assets/a-1.jpg');
		expect(resolveImageSrc('https://example.com/a.png#left', images)).toBe('https://example.com/a.png');
	});
});

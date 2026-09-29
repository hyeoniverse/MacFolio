import { describe, expect, it } from 'vitest';
import { fromPexels, fromUnsplash, parseSearch } from './stock.js';

describe('사진 찾기 결과 맞추기', () => {
	it('Unsplash: 본문 크기 주소, 설명, 사진가와 utm이 붙은 링크', () => {
		const { results, hasMore } = fromUnsplash(
			{
				total_pages: 3,
				results: [
					{
						id: 'abc',
						width: 4000,
						height: 3000,
						color: '#a0b0c0',
						description: null,
						alt_description: 'a cat on a desk',
						urls: { regular: 'https://images.unsplash.com/r', small: 'https://images.unsplash.com/s' },
						links: { html: 'https://unsplash.com/photos/abc' },
						user: { name: 'Jane', links: { html: 'https://unsplash.com/@jane' } },
					},
				],
			},
			1
		);
		expect(hasMore).toBe(true);
		expect(results[0]).toEqual({
			provider: 'unsplash',
			id: 'abc',
			thumb: 'https://images.unsplash.com/s',
			url: 'https://images.unsplash.com/r',
			width: 4000,
			height: 3000,
			alt: 'a cat on a desk',
			author: 'Jane',
			authorUrl: 'https://unsplash.com/@jane?utm_source=macfolio&utm_medium=referral',
			pageUrl: 'https://unsplash.com/photos/abc?utm_source=macfolio&utm_medium=referral',
			color: '#a0b0c0',
		});
		expect(fromUnsplash({ total_pages: 3, results: [] }, 3).hasMore).toBe(false);
	});

	it('Pexels: 큰 주소, 사진가, 다음 쪽', () => {
		const { results, hasMore } = fromPexels({
			next_page: 'https://api.pexels.com/v1/search?page=2',
			photos: [
				{
					id: 42,
					width: 3000,
					height: 2000,
					url: 'https://www.pexels.com/photo/42/',
					alt: 'mountain',
					avg_color: '#112233',
					photographer: 'Kim',
					photographer_url: 'https://www.pexels.com/@kim',
					src: { large2x: 'https://images.pexels.com/l', medium: 'https://images.pexels.com/m' },
				},
			],
		});
		expect(hasMore).toBe(true);
		expect(results[0]).toMatchObject({
			provider: 'pexels',
			id: '42',
			url: 'https://images.pexels.com/l',
			author: 'Kim',
		});
		expect(fromPexels({ photos: [] }).hasMore).toBe(false);
	});

	it('검색 요청을 검사한다', () => {
		expect(parseSearch({ provider: 'unsplash', q: ' 고양이 ' })).toEqual({
			value: { provider: 'unsplash', q: '고양이', page: 1 },
		});
		expect(parseSearch({ provider: 'flickr', q: '', page: '0' })).toEqual({
			errors: ['provider는 unsplash 또는 pexels입니다.', '검색어는 1~100자입니다.', 'page는 1~50입니다.'],
		});
	});
});

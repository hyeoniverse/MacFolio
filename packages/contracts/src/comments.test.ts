import { describe, expect, it } from 'vitest';
import { Comment, CommentInput, Likes } from './comments.js';
import { parse } from './parse.js';

describe('CommentInput', () => {
	it('앞뒤 공백을 다듬고, 모르는 필드(이름·비밀번호)는 버린다', () => {
		expect(parse(CommentInput, { name: '누구', password: '1234', body: ' 잘 봤어요 ' })).toEqual({
			value: { body: '잘 봤어요' },
		});
	});

	it('비었거나 500자를 넘으면 이유를 알린다', () => {
		expect(parse(CommentInput, { body: ' ' })).toEqual({ errors: ['내용을 입력해주세요.'] });
		expect(parse(CommentInput, { body: '가'.repeat(501) })).toEqual({
			errors: ['내용은 500자까지 입력할 수 있습니다.'],
		});
		expect(parse(CommentInput, null)).toEqual({ errors: ['내용을 입력해주세요.'] });
		expect(parse(CommentInput, {})).toEqual({ errors: ['내용을 입력해주세요.'] });
		expect(parse(CommentInput, { body: 3 })).toEqual({ errors: ['내용을 입력해주세요.'] });
	});

	it('사람 확인 토큰은 있으면 그대로', () => {
		expect(parse(CommentInput, { body: 'x', turnstileToken: 't' })).toEqual({
			value: { body: 'x', turnstileToken: 't' },
		});
	});
});

describe('응답 스키마', () => {
	it('서버가 주는 댓글 모양을 받아들이고, 해시 같은 여분 필드는 거른다', () => {
		const row = {
			id: 'c1',
			name: '🦊 날쌘 여우',
			ipPrefix: '211.234',
			isAdmin: false,
			body: '안녕',
			createdAt: '2026-10-10T00:00:00.000Z',
			mine: true,
			likes: 0,
			liked: false,
		};
		expect(parse(Comment, { ...row, visitorHash: 'secret' })).toEqual({ value: row });
		expect(parse(Likes, { count: 2, liked: true })).toEqual({ value: { count: 2, liked: true } });
	});
});

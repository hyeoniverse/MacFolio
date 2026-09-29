import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorBody } from './http-error.filter.js';

const now = new Date('2026-09-29T00:00:00.000Z');

describe('toErrorBody', () => {
	it('HTTP 에러는 상태와 설명을 그대로', () => {
		expect(toErrorBody(new NotFoundException('글이 없습니다.'), '/posts/x', now)).toEqual({
			statusCode: 404,
			error: 'Not Found',
			message: '글이 없습니다.',
			path: '/posts/x',
			timestamp: '2026-09-29T00:00:00.000Z',
		});
	});

	it('입력 검증 실패는 항목마다 설명', () => {
		const body = toErrorBody(new BadRequestException(['name은 20자 이하', 'content는 비울 수 없음']), '/feedback', now);
		expect(body.statusCode).toBe(400);
		expect(body.error).toBe('Bad Request');
		expect(body.message).toEqual(['name은 20자 이하', 'content는 비울 수 없음']);
	});

	it('예상하지 못한 에러는 내용을 감추고 500', () => {
		const body = toErrorBody(new Error('password authentication failed for user "macfolio"'), '/health', now);
		expect(body).toMatchObject({ statusCode: 500, error: 'Internal Server Error' });
		expect(JSON.stringify(body)).not.toContain('password');
	});
});

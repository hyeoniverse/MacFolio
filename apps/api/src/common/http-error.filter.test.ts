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

	it('Express 미들웨어의 http-errors(몸통이 너무 큼, 깨진 JSON)는 상태를 믿고 설명은 우리말로', () => {
		const tooLarge = Object.assign(new Error('request entity too large'), {
			status: 413,
			statusCode: 413,
			expose: true,
			type: 'entity.too.large',
		});
		expect(toErrorBody(tooLarge, '/posts', now)).toMatchObject({
			statusCode: 413,
			error: 'Payload Too Large',
			message: '요청이 너무 큽니다.',
		});
		const badJson = Object.assign(new Error('Unexpected end of JSON input'), {
			status: 400,
			expose: true,
			type: 'entity.parse.failed',
		});
		expect(toErrorBody(badJson, '/posts', now)).toMatchObject({
			statusCode: 400,
			message: '요청 본문을 읽을 수 없습니다.',
		});
		// 모르는 종류면 메시지를 그대로, expose가 아니거나 5xx면 500으로 감춘다
		const other = Object.assign(new Error('unsupported'), { status: 415, expose: true });
		expect(toErrorBody(other, '/posts', now)).toMatchObject({ statusCode: 415, message: 'unsupported' });
		const hidden = Object.assign(new Error('internal detail'), { status: 400, expose: false });
		expect(toErrorBody(hidden, '/posts', now)).toMatchObject({
			statusCode: 500,
			message: '서버에서 문제가 생겼습니다.',
		});
		const upstream = Object.assign(new Error('db down'), { status: 503, expose: true });
		expect(toErrorBody(upstream, '/posts', now)).toMatchObject({ statusCode: 500 });
	});

	it('예상하지 못한 에러는 내용을 감추고 500', () => {
		const body = toErrorBody(new Error('password authentication failed for user "macfolio"'), '/health', now);
		expect(body).toMatchObject({ statusCode: 500, error: 'Internal Server Error' });
		expect(JSON.stringify(body)).not.toContain('password');
		expect(JSON.stringify(body)).not.toContain('stack');
	});
});

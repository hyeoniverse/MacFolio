import { describe, expect, it } from 'vitest';
import { ADJECTIVES, ANIMALS, hashVisitor, publicAuthorId, visitorName, VISITOR_TOKEN } from './visitor.js';
import { randomToken } from '../auth/session.js';

describe('방문자 이름', () => {
	it('같은 토큰이면 늘 같은 이름, 키가 다르면 다른 해시', () => {
		const token = randomToken(24);
		const hash = hashVisitor(token, 'secret');
		expect(hashVisitor(token, 'secret')).toBe(hash);
		expect(hashVisitor(token, 'other')).not.toBe(hash);
		expect(visitorName(hash)).toBe(visitorName(hashVisitor(token, 'secret')));
	});

	it('이름은 "이모지 꾸밈말 동물" 모양이고, 해시에 따라 골고루 나온다', () => {
		expect(visitorName('0'.repeat(64))).toBe(`${ANIMALS[0][0]} ${ADJECTIVES[0]} ${ANIMALS[0][1]}`);
		const names = new Set(Array.from({ length: 200 }, () => visitorName(hashVisitor(randomToken(24), 's'))));
		expect(names.size).toBeGreaterThan(100);
		for (const name of names) expect(name).toMatch(/^\S+ .+ \S+$/);
	});

	it('토큰 모양: randomToken(24)만 받는다', () => {
		expect(VISITOR_TOKEN.test(randomToken(24))).toBe(true);
		expect(VISITOR_TOKEN.test('short')).toBe(false);
		expect(VISITOR_TOKEN.test(`${randomToken(24)};x`)).toBe(false);
	});

	it('밖으로 내보내는 글쓴이 값은 저장한 해시와 다르다', () => {
		const hash = hashVisitor(randomToken(24), 's');
		expect(publicAuthorId(hash)).toHaveLength(16);
		expect(hash).not.toContain(publicAuthorId(hash));
	});
});

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parse } from './parse.js';

describe('parse', () => {
	const schema = z.object({
		a: z.string().min(1, '첫째'),
		b: z.string().min(1, '둘째'),
		c: z.number({ error: '둘째' }),
	});

	it('성공하면 다듬은 값', () => {
		expect(parse(schema, { a: 'x', b: 'y', c: 1, extra: true })).toEqual({ value: { a: 'x', b: 'y', c: 1 } });
	});

	it('실패하면 스키마에 적은 문구를 순서대로, 같은 문구는 한 번만', () => {
		expect(parse(schema, { a: '', b: '', c: 'no' })).toEqual({ errors: ['첫째', '둘째'] });
		expect(parse(schema, undefined)).toMatchObject({ errors: expect.any(Array) });
	});
});

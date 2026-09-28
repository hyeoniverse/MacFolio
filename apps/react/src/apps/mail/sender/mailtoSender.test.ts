import { describe, expect, it, vi } from 'vitest';
import { createMailtoSender } from './mailtoSender';

const input = { name: '민수', email: 'minsu@example.com', subject: '문의', body: '안녕하세요' };

describe('createMailtoSender', () => {
	it('받는 사람과 제목이 담긴 mailto 주소를 열고, 메일 앱에 넘겼다고 알려준다', async () => {
		const open = vi.fn();
		const result = await createMailtoSender('owner@example.com', open).send(input);
		expect(result).toEqual({ status: 'handed-off' });
		expect(open).toHaveBeenCalledOnce();
		expect(open.mock.calls[0][0]).toMatch(/^mailto:owner@example\.com\?subject=%EB%AC%B8%EC%9D%98&body=/);
	});

	it('여는 데 실패하면 실패를 알려준다', async () => {
		const result = await createMailtoSender('owner@example.com', () => {
			throw new Error('blocked');
		}).send(input);
		expect(result.status).toBe('failed');
	});
});

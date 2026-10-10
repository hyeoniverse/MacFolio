import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafeLogger } from './safe-logger.js';

describe('SafeLogger', () => {
	afterEach(() => vi.restoreAllMocks());

	it('쓰기 전에 비밀 값을 가린다 (글, Error, 컨텍스트)', () => {
		const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
		const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
		const logger = new SafeLogger('Test', { colors: false, timestamp: false });
		logger.warn('mail to minsu@example.com with Bearer re_abcdefgh1234');
		logger.error(new Error('postgresql://macfolio:s3cret@db/macfolio'), 'Ctx');
		const written = [...out.mock.calls, ...err.mock.calls].map((call) => String(call[0])).join('\n');
		expect(written).toContain('m***@example.com');
		expect(written).toContain('Bearer ***');
		expect(written).toContain('postgresql://macfolio:***@db/macfolio');
		expect(written).not.toContain('minsu@');
		expect(written).not.toContain('s3cret');
		expect(written).not.toContain('re_abcdefgh1234');
	});
});

import { describe, expect, it } from 'vitest';
import { parseSecurityUpdate } from './rules.js';

describe('보안 설정 입력', () => {
	it('켜고 끌 곳만 true/false로 받는다', () => {
		expect(parseSecurityUpdate({ comment: true })).toEqual({ value: { comment: true } });
		expect(parseSecurityUpdate({ contact: false, message: true })).toEqual({
			value: { contact: false, message: true },
		});
	});

	it('다른 키, 다른 값, 빈 몸통은 거절한다', () => {
		expect(parseSecurityUpdate({ comment: 'yes' })).toEqual({
			errors: ['comment는 켜기(true)나 끄기(false)여야 합니다.'],
		});
		expect(parseSecurityUpdate({ likes: true })).toEqual({ errors: ['알 수 없는 설정입니다: likes'] });
		expect(parseSecurityUpdate({})).toEqual({ errors: ['바꿀 설정이 없습니다.'] });
		expect(parseSecurityUpdate(null)).toEqual({ errors: ['설정을 보내 주세요.'] });
		expect(parseSecurityUpdate([])).toEqual({ errors: ['설정을 보내 주세요.'] });
	});
});

import { describe, expect, it } from 'vitest';
import { shouldPlayClick, type ClickInput } from './clickRules';

const base: ClickInput = { pointerType: 'mouse', button: 0, onLoadingScreen: false, enabled: true };

describe('shouldPlayClick', () => {
	it('마우스·펜의 주 단추에 소리를 낸다', () => {
		expect(shouldPlayClick(base)).toBe(true);
		expect(shouldPlayClick({ ...base, pointerType: 'pen' })).toBe(true);
	});

	it('오른쪽·가운데 단추에는 내지 않는다', () => {
		expect(shouldPlayClick({ ...base, button: 2 })).toBe(false);
		expect(shouldPlayClick({ ...base, button: 1 })).toBe(false);
	});

	it('터치에는 내지 않는다', () => {
		expect(shouldPlayClick({ ...base, pointerType: 'touch' })).toBe(false);
	});

	it('설정에서 끄면 내지 않는다', () => {
		expect(shouldPlayClick({ ...base, enabled: false })).toBe(false);
	});

	it('로딩 화면에서는 시작음만 나게 내지 않는다', () => {
		expect(shouldPlayClick({ ...base, onLoadingScreen: true })).toBe(false);
	});
});

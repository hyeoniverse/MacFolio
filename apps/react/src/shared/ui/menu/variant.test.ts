import { describe, expect, it } from 'vitest';
import { menuVariantClass } from '@/shared/ui/menu/variant';

describe('Menu variant', () => {
	it('mac은 클래스를 덧붙이지 않는다', () => {
		expect(menuVariantClass('mac')).toBeUndefined();
	});
	it('ios는 Menu.css의 touch 모양을 붙인다', () => {
		expect(menuVariantClass('ios')).toBe('touch');
	});
});

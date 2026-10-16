import { describe, expect, it } from 'vitest';
import { issueOf, mastOf } from './issue';

describe('magazine 표지 글', () => {
	it('이름의 앞말을 제호로, 뒷말을 작은 줄로 나눈다', () => {
		expect(mastOf('북클럽 – 독서 모임 플랫폼')).toEqual({ title: '북클럽', sub: '독서 모임 플랫폼' });
		expect(mastOf('QRU')).toEqual({ title: 'QRU', sub: '' });
	});

	it('기간을 호수 줄로 줄인다', () => {
		expect(issueOf('2025.03.04 – 2025.06.27')).toBe('Vol. 1 · 2025.03 – 06');
		expect(issueOf('2025.11 – 2026.02')).toBe('Vol. 1 · 2025.11 – 2026.02');
		expect(issueOf('2024.7')).toBe('Vol. 1 · 2024.07');
		expect(issueOf('진행 중')).toBe('Vol. 1 · 진행 중');
		expect(issueOf(undefined)).toBe('Vol. 1');
	});
});

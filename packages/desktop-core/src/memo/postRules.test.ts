import { describe, expect, it } from 'vitest';
import { validateDraft } from './postRules';

const DRAFT = { title: '새 글', date: '2026-09-29', category: '개발기', summary: '', body: '본문' };

describe('validateDraft', () => {
	it('필수 항목이 다 있으면 문제 없음 (요약은 비워도 된다)', () => {
		expect(validateDraft(DRAFT)).toEqual({});
	});

	it('비운 필수 항목마다 안내', () => {
		expect(validateDraft({ title: ' ', date: '', category: '', summary: '', body: '\n' })).toEqual({
			title: '제목을 입력해주세요.',
			date: '날짜를 골라주세요.',
			category: '폴더를 골라주세요.',
			body: '본문을 입력해주세요.',
		});
	});

	it('길이 제한과 없는 날짜', () => {
		expect(validateDraft({ ...DRAFT, title: '가'.repeat(101), summary: '나'.repeat(201), date: '2026-02-30' })).toEqual(
			{
				title: '제목은 100자까지 입력할 수 있습니다.',
				summary: '요약은 200자까지 입력할 수 있습니다.',
				date: '날짜를 골라주세요.',
			}
		);
	});
});

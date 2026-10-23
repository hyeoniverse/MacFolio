import { describe, expect, it } from 'vitest';
import { formatIso, monthGrid, parseIso, shiftMonth, toIso } from '@/shared/ui/date/calendar';
import { fromEditorMarkdown, plainTableAlign, toEditorMarkdown, unescapeTags } from './markdownImages';
import { captionParts } from '@macfolio/desktop-core/memo';
import { imageFileName } from '../download';

describe('이미지 경로', () => {
	const images = { 'images/a.jpg': '/assets/a-123.jpg' };

	it('편집기에서는 빌드된 주소로, 저장할 때는 원래 상대 경로로', () => {
		const source = "앞\n\n![설명](./images/a.jpg '캡션')\n\n![밖](https://x.com/b.png)";
		const shown = toEditorMarkdown(source, images);
		expect(shown).toContain("![설명](/assets/a-123.jpg '캡션')");
		expect(shown).toContain('![밖](https://x.com/b.png)');
		expect(fromEditorMarkdown(shown, images)).toBe(source);
	});

	it('모르는 경로는 그대로', () => {
		expect(toEditorMarkdown('![x](./images/none.jpg)', images)).toBe('![x](./images/none.jpg)');
	});
});

describe('달력', () => {
	it('일요일부터 주 단위로, 앞뒤는 빈 칸', () => {
		const grid = monthGrid(2026, 8); // 2026년 9월: 1일이 화요일
		expect(grid[0]).toEqual([null, null, 1, 2, 3, 4, 5]);
		expect(grid.at(-1)).toEqual([27, 28, 29, 30, null, null, null]);
		expect(grid.flat().filter(Boolean)).toHaveLength(30);
	});

	it('달을 넘기면 연도도 넘어간다', () => {
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
	});

	it('날짜 문자열', () => {
		expect(toIso(2026, 8, 5)).toBe('2026-09-05');
		expect(parseIso('2026-09-05')).toEqual({ year: 2026, month: 8, day: 5 });
		expect(parseIso('어제')).toBeNull();
		expect(formatIso('2026-09-05')).toBe('2026. 9. 5.');
	});
});

describe('표 정렬 표시', () => {
	it('왼쪽 정렬은 정렬 없음으로, 가운데·오른쪽은 그대로', () => {
		const table = '| 이름 | 값 | 비고 |\n| :- | :-: | --: |\n| a | b | c |\n';
		expect(plainTableAlign(table)).toBe('| 이름 | 값 | 비고 |\n| -- | :-: | --: |\n| a | b | c |\n');
	});

	it('표가 아닌 줄의 :-는 건드리지 않는다', () => {
		expect(plainTableAlign('시간 :-) 좋다\n| a :- b |\n')).toBe('시간 :-) 좋다\n| a :- b |\n');
	});
});

describe('태그 이스케이프', () => {
	it('줄 맨 앞의 \\#태그를 #태그로 되돌린다 (목록·인용 기호 뒤도). 뒤에 이어지는 태그는 원래 그대로', () => {
		expect(unescapeTags('본문\n\n\\#프론트엔드 #CSS #Safari\n')).toBe('본문\n\n#프론트엔드 #CSS #Safari\n');
		expect(unescapeTags('- \\#할일\n> \\#인용\n1. \\#번호\n')).toBe('- #할일\n> #인용\n1. #번호\n');
	});

	it('제목이 될 수 있는 \\#(뒤에 공백이나 #)와 코드 블록 안은 건드리지 않는다', () => {
		expect(unescapeTags('\\# 제목 아님\n\\## 둘\n')).toBe('\\# 제목 아님\n\\## 둘\n');
		const code = '```sh\n\\#주석\n```\n\\#태그\n';
		expect(unescapeTags(code)).toBe('```sh\n\\#주석\n```\n#태그\n');
	});
});

describe('캡션 링크', () => {
	it('[글자](https 주소)만 링크로 나눈다', () => {
		expect(captionParts('사진: [Jane](https://unsplash.com/@jane), [Unsplash](https://unsplash.com)')).toEqual([
			{ text: '사진: ' },
			{ text: 'Jane', href: 'https://unsplash.com/@jane' },
			{ text: ', ' },
			{ text: 'Unsplash', href: 'https://unsplash.com' },
		]);
		// 스크립트 주소나 괄호만 있는 글은 링크가 아니다
		expect(captionParts('[x](javascript:alert(1)) 그냥 [괄호]')).toEqual([
			{ text: '[x](javascript:alert(1)) 그냥 [괄호]' },
		]);
		expect(captionParts('')).toEqual([]);
	});
});

describe('이미지 내려받기 파일 이름', () => {
	it('설명을 이름으로, 형식에 맞는 확장자', () => {
		expect(imageFileName('편집기 화면', 'http://api/files/abc', 'image/png')).toBe('편집기 화면.png');
		expect(imageFileName('', 'https://images.unsplash.com/photo-123.jpg?w=1080', 'image/jpeg')).toBe('photo-123.jpg');
		expect(imageFileName('a/b:c?', 'x', '')).toBe('abc.png');
		expect(imageFileName('', '/assets/memo-editor-abc.webp', '')).toBe('memo-editor-abc.webp');
	});
});

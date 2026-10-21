// 텍스트 편집기의 Markdown 도구 막대: 고른 글자를 Markdown 문법으로 감싸거나 줄 앞에 표시를 붙인다. React와 DOM에 의존하지 않는 순수 함수만 둔다.

export type MarkdownFormat = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'ordered' | 'quote';

export interface Edit {
	text: string;
	/** 바꾼 뒤 고를 범위 */
	start: number;
	end: number;
}

const WRAP: Partial<Record<MarkdownFormat, string>> = { bold: '**', italic: '_', strike: '~~', code: '`' };
const LINE: Partial<Record<MarkdownFormat, string>> = { list: '- ', ordered: '1. ', quote: '> ' };

/**
 * 감싸기(굵게·기울임·취소선·코드)는 이미 감싸져 있으면 벗긴다. 줄 표시(제목·목록·인용)는 고른 줄마다 붙이고, 모두 붙어 있으면 뗀다.
 * 링크는 [글자](https://)를 넣고 주소 자리를 고른다
 */
export function applyMarkdown(text: string, start: number, end: number, format: MarkdownFormat): Edit {
	const selected = text.slice(start, end);
	const mark = WRAP[format];
	if (mark) {
		const before = text.slice(start - mark.length, start);
		const after = text.slice(end, end + mark.length);
		if (before === mark && after === mark)
			return {
				text: text.slice(0, start - mark.length) + selected + text.slice(end + mark.length),
				start: start - mark.length,
				end: end - mark.length,
			};
		return {
			text: text.slice(0, start) + mark + selected + mark + text.slice(end),
			start: start + mark.length,
			end: end + mark.length,
		};
	}
	if (format === 'link') {
		const label = selected || '링크';
		const url = 'https://';
		const inserted = `[${label}](${url})`;
		const urlStart = start + label.length + 3;
		return {
			text: text.slice(0, start) + inserted + text.slice(end),
			start: urlStart,
			end: urlStart + url.length,
		};
	}
	const prefix = LINE[format]!;
	return mapLines(text, start, end, (lines) => {
		const remove = lines.every((line) => line.startsWith(prefix));
		return lines.map((line) => (remove ? line.slice(prefix.length) : prefix + line));
	});
}

/** 고른 줄들(커서가 있는 줄 포함)을 바꾼다 */
function mapLines(text: string, start: number, end: number, change: (lines: string[]) => string[]): Edit {
	const lineStart = text.lastIndexOf('\n', start - 1) + 1;
	const lineEndAt = text.indexOf('\n', Math.max(end - 1, start));
	const lineEnd = lineEndAt < 0 ? text.length : lineEndAt;
	const changed = change(text.slice(lineStart, lineEnd).split('\n')).join('\n');
	return {
		text: text.slice(0, lineStart) + changed + text.slice(lineEnd),
		start: lineStart,
		end: lineStart + changed.length,
	};
}

/** 지금 줄의 문단 스타일: 0은 본문, 1~3은 제목 단계 (#의 개수) */
export function headingAt(text: string, at: number): number {
	const line = text.slice(text.lastIndexOf('\n', at - 1) + 1);
	return /^(#{1,6}) /.exec(line)?.[1].length ?? 0;
}

/** 문단 스타일 팝업: 고른 줄의 # 표시를 그 단계로 바꾼다 (0은 떼기) */
export function setHeading(text: string, start: number, end: number, level: number): Edit {
	return mapLines(text, start, end, (lines) =>
		lines.map((line) => `${level ? `${'#'.repeat(level)} ` : ''}${line.replace(/^#{1,6} /, '')}`)
	);
}

/** 지금 줄이 목록·번호 목록·인용인지 (서식 막대에서 그 버튼을 켠다) */
export function lineKindAt(text: string, at: number): 'list' | 'ordered' | 'quote' | null {
	const line = text.slice(text.lastIndexOf('\n', at - 1) + 1);
	if (line.startsWith('- ')) return 'list';
	if (/^\d+\. /.test(line)) return 'ordered';
	if (line.startsWith('> ')) return 'quote';
	return null;
}

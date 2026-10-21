// 텍스트 편집기의 Markdown 도구 막대: 고른 글자를 Markdown 문법으로 감싸거나 줄 앞에 표시를 붙인다. React와 DOM에 의존하지 않는 순수 함수만 둔다.

export type MarkdownFormat = 'heading' | 'bold' | 'italic' | 'code' | 'link' | 'list' | 'quote';

export interface Edit {
	text: string;
	/** 바꾼 뒤 고를 범위 */
	start: number;
	end: number;
}

const WRAP: Partial<Record<MarkdownFormat, string>> = { bold: '**', italic: '_', code: '`' };
const LINE: Partial<Record<MarkdownFormat, string>> = { heading: '### ', list: '- ', quote: '> ' };

/**
 * 감싸기(굵게·기울임·코드)는 이미 감싸져 있으면 벗긴다. 줄 표시(제목·목록·인용)는 고른 줄마다 붙이고, 모두 붙어 있으면 뗀다.
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
	const lineStart = text.lastIndexOf('\n', start - 1) + 1;
	const lineEndAt = text.indexOf('\n', Math.max(end - 1, start));
	const lineEnd = lineEndAt < 0 ? text.length : lineEndAt;
	const lines = text.slice(lineStart, lineEnd).split('\n');
	const remove = lines.every((line) => line.startsWith(prefix));
	const changed = lines.map((line) => (remove ? line.slice(prefix.length) : prefix + line)).join('\n');
	return {
		text: text.slice(0, lineStart) + changed + text.slice(lineEnd),
		start: lineStart,
		end: lineStart + changed.length,
	};
}

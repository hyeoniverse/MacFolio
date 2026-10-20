// 시스템 설정 › 프로젝트의 기간 입력칸 규칙 (React와 DOM 없이): 기간 읽기·쓰기
/** 기간: 시작일과 끝(날짜, 또는 '운영 중' 같은 글). 프로젝트의 period는 '2024.12.26 – 2025.02.05' 모양이다 */
export interface Period {
	/** YYYY-MM-DD (input type=date의 값). 비었으면 '' */
	start: string;
	end: string;
	/** 끝 대신 쓰는 글 (예: 운영 중). 있으면 end는 비운다 */
	ongoing: string;
}

const DATE = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const toInput = (match: RegExpExecArray | null) =>
	match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
const toPeriod = (value: string) => value.replaceAll('-', '.');

/** 기간 글을 읽는다. 날짜 모양이 아니면 null (그대로 글로 고치게 한다) */
export function parsePeriod(text: string | undefined): Period | null {
	if (!text?.trim()) return { start: '', end: '', ongoing: '' };
	const [head, ...rest] = text.split(/\s*[–-]\s*(?=\D|$|\d{4}\.)/);
	const start = DATE.exec(head);
	if (!start || start[0] !== head.trim()) return null;
	const tail = rest.join(' – ').trim();
	if (!tail) return { start: toInput(start), end: '', ongoing: '' };
	const end = DATE.exec(tail);
	if (end && end[0] === tail) return { start: toInput(start), end: toInput(end), ongoing: '' };
	if (/\d/.test(tail)) return null;
	return { start: toInput(start), end: '', ongoing: tail };
}

/** 기간을 글로 쓴다 ('2024.12.26 – 2025.02.05', '2026.02.05 – 운영 중', 끝을 모르면 '2024.10.22 –'). 시작이 없으면 undefined */
export function formatPeriod({ start, end, ongoing }: Period): string | undefined {
	if (!start) return undefined;
	const tail = ongoing.trim() || (end ? toPeriod(end) : '');
	return tail ? `${toPeriod(start)} – ${tail}` : `${toPeriod(start)} –`;
}

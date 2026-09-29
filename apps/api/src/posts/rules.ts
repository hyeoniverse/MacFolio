// 블로그 글 입력 규칙. 폴더 규칙은 메모 정리 내용과 같다.
import { randomBytes } from 'node:crypto';
import { folderPathError } from '../memo/organization.js';

export const POST_LIMITS = {
	title: { min: 1, max: 100 },
	summary: { max: 200 },
	body: { min: 1, max: 50_000 },
} as const;

export const SLUG = /^[\w-]{1,100}$/;

export interface PostInput {
	title: string;
	/** YYYY-MM-DD */
	date: string;
	category: string;
	summary: string;
	body: string;
}

/** 실제로 있는 날짜인지 (2026-02-30 같은 날짜는 거절) */
function isDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** 글 입력을 다듬고 검사한다. 문제가 있으면 이유를 모두 모은다 */
export function parsePostInput(input: unknown, today: string): { value: PostInput } | { errors: string[] } {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '');
	const value: PostInput = {
		title: text('title'),
		date: text('date') || today,
		category: text('category'),
		summary: text('summary'),
		body: typeof raw.body === 'string' ? raw.body.replace(/\s+$/, '') : '',
	};
	const errors: string[] = [];

	if (value.title.length < POST_LIMITS.title.min) errors.push('제목을 입력해주세요.');
	else if (value.title.length > POST_LIMITS.title.max)
		errors.push(`제목은 ${POST_LIMITS.title.max}자까지 입력할 수 있습니다.`);
	if (!isDate(value.date)) errors.push('날짜가 올바르지 않습니다.');
	const folderError = value.category ? folderPathError(value.category) : '폴더를 골라주세요.';
	if (folderError) errors.push(folderError);
	if (value.summary.length > POST_LIMITS.summary.max)
		errors.push(`요약은 ${POST_LIMITS.summary.max}자까지 입력할 수 있습니다.`);
	if (!value.body.trim()) errors.push('본문을 입력해주세요.');
	else if (value.body.length > POST_LIMITS.body.max)
		errors.push(`본문은 ${POST_LIMITS.body.max}자까지 입력할 수 있습니다.`);

	return errors.length > 0 ? { errors } : { value };
}

/** 새 글의 주소: 날짜와 짧은 무작위 문자 (한글 제목도 주소가 깨지지 않게) */
export const newSlug = (date: string) => `${date}-${randomBytes(3).toString('hex')}`;

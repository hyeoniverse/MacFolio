// 블로그 글 (apps/api의 /posts). 길이·날짜·폴더 규칙은 desktop-core의 memo/rules.ts와 함께 쓴다.
// 글 내용(PostContent)·관리자 글(AdminPost)·공개 글(ServerPost)의 타입은 desktop-core에 있고, 여기 스키마가 그 타입과 같은지 tsc가 확인한다
import { z } from 'zod';
import {
	folderPathError,
	isCalendarDate,
	POST_LIMITS,
	type AdminPost as AdminPostShape,
	type PostContent as PostContentShape,
	type ServerPost as ServerPostShape,
} from '@macfolio/desktop-core/memo';
import { requestBody } from './parse.js';

/** 문자열이 아니면 빈 문자열로 보고 앞뒤 공백을 다듬는다 (서버가 하던 그대로) */
const text = () => z.preprocess((value) => (typeof value === 'string' ? value.trim() : ''), z.string());

/**
 * 글 쓰기·임시 저장·게시 요청 몸통. 날짜가 비어 있으면 오늘(서버 기준).
 * 이유는 칸 순서(제목 → 날짜 → 폴더 → 요약 → 본문)대로 모두 모은다
 */
export const postInput = (today: string): z.ZodType<PostContentShape, unknown> =>
	requestBody({
		title: text()
			.refine((title) => title.length > 0, '제목을 입력해주세요.')
			.refine((title) => title.length <= POST_LIMITS.title, `제목은 ${POST_LIMITS.title}자까지 입력할 수 있습니다.`),
		date: text()
			.transform((date) => date || today)
			.refine(isCalendarDate, '날짜가 올바르지 않습니다.'),
		category: text().superRefine((category, ctx) => {
			const error = category ? folderPathError(category) : '폴더를 골라주세요.';
			if (error) ctx.addIssue({ code: 'custom', message: error });
		}),
		summary: text().refine(
			(summary) => summary.length <= POST_LIMITS.summary,
			`요약은 ${POST_LIMITS.summary}자까지 입력할 수 있습니다.`
		),
		body: z
			.preprocess((value) => (typeof value === 'string' ? value.replace(/\s+$/, '') : ''), z.string())
			.refine((body) => body.trim().length > 0, '본문을 입력해주세요.')
			.refine((body) => body.length <= POST_LIMITS.body, `본문은 ${POST_LIMITS.body}자까지 입력할 수 있습니다.`),
	});
export type PostInput = PostContentShape;

/** 글 내용 (게시한 내용, 임시 저장, 버전이 같은 모양) */
export const PostContent: z.ZodType<PostContentShape> = z.object({
	title: z.string(),
	/** YYYY-MM-DD */
	date: z.string(),
	category: z.string(),
	summary: z.string(),
	body: z.string(),
});
export type PostContent = PostContentShape;

/** 방문자에게 보이는 글. deleted면 저장소의 같은 주소 글도 가린다 (지운 글, 아직 날짜가 안 된 예약 글) */
export const ServerPost: z.ZodType<ServerPostShape> = z.object({
	slug: z.string(),
	title: z.string(),
	date: z.string(),
	category: z.string(),
	summary: z.string(),
	body: z.string(),
	deleted: z.boolean(),
});
export type ServerPost = ServerPostShape;

/** 관리자가 보는 글: 게시한 내용과 임시 저장을 따로 */
export const AdminPost: z.ZodType<AdminPostShape> = z.object({
	slug: z.string(),
	published: PostContent.nullable(),
	publishedAt: z.string().nullable(),
	draft: PostContent.nullable(),
	draftUpdatedAt: z.string().nullable(),
	deleted: z.boolean(),
	/** 지운 때. 있으면 '최근 삭제된 항목'에 있다 (30일 동안 되살릴 수 있다) */
	deletedAt: z.string().nullable(),
	/** 남은 버전 수 */
	revisions: z.number().int().nonnegative(),
});
export type AdminPost = AdminPostShape;

/** 글의 예전 버전 목록 한 줄 (게시할 때마다 남는다) */
export const RevisionSummary = z.object({
	id: z.number().int(),
	title: z.string(),
	date: z.string(),
	/** ISO 8601 */
	createdAt: z.string(),
	createdBy: z.string(),
});
export type RevisionSummary = z.infer<typeof RevisionSummary>;

/** 예전 버전 하나의 내용 */
export const Revision = RevisionSummary.extend({ category: z.string(), summary: z.string(), body: z.string() });
export type Revision = z.infer<typeof Revision>;

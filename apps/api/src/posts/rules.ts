// 블로그 글 주변 규칙: 주소. 글 몸통의 모양과 검사는 @macfolio/contracts의 postInput (화면과 같은 스키마)
import { randomBytes } from 'node:crypto';
import { POST_SLUG } from '@macfolio/desktop-core/memo';
import { parse, postInput, type PostInput } from '@macfolio/contracts';

export const SLUG = POST_SLUG;
export type { PostInput };

/** 글 입력을 다듬고 검사한다. 문제가 있으면 이유를 모두 모은다 (스키마와 문구는 contracts에) */
export const parsePostInput = (input: unknown, today: string) => parse(postInput(today), input);

/** 새 글의 주소: 날짜와 짧은 무작위 문자 (한글 제목도 주소가 깨지지 않게) */
export const newSlug = (date: string) => `${date}-${randomBytes(3).toString('hex')}`;

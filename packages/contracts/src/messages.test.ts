import { describe, expect, it } from 'vitest';
import { Message, MessageInput, PINNED_THREAD_ID, Thread, ThreadCreated } from './messages.js';
import { parse } from './parse.js';

describe('MessageInput', () => {
	it('댓글과 같은 규칙: 다듬고, 비었거나 500자를 넘으면 이유를 알린다', () => {
		expect(parse(MessageInput, { body: ' 디자인이 깔끔해요 ' })).toEqual({ value: { body: '디자인이 깔끔해요' } });
		expect(parse(MessageInput, { body: ' ' })).toEqual({ errors: ['내용을 입력해주세요.'] });
		expect(parse(MessageInput, { body: '가'.repeat(501) })).toEqual({
			errors: ['내용은 500자까지 입력할 수 있습니다.'],
		});
		expect(parse(MessageInput, 'hi')).toEqual({ errors: ['내용을 입력해주세요.'] });
	});
});

describe('응답 모양', () => {
	const message = {
		id: 'm1',
		threadId: PINNED_THREAD_ID,
		text: '반가워요',
		createdAt: '2026-10-11T00:00:00.000Z',
		authorId: 'a1b2',
		nickname: '🦊 날쌘 여우',
		ipPrefix: '211.234',
		fromOwner: false,
		mine: true,
	};
	const thread = { id: 't1', title: '🦊 날쌘 여우', createdAt: message.createdAt, mine: true };

	it('말풍선과 항목 (ipPrefix·summary·lastMessage는 없어도 된다)', () => {
		expect(parse(Message, message)).toEqual({ value: message });
		expect(parse(Thread, thread)).toEqual({ value: thread });
		expect(parse(Thread, { ...thread, pinned: true, lastMessage: { text: 'x', createdAt: '2026' } })).toMatchObject({
			value: { pinned: true },
		});
		expect(parse(ThreadCreated, { thread, message })).toEqual({ value: { thread, message } });
	});

	it('방문자 해시 같은 모르는 필드는 버린다', () => {
		expect(parse(Message, { ...message, visitorHash: 'secret' })).toEqual({ value: message });
	});
});

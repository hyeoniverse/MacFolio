import { describe, expect, it } from 'vitest';
import {
	avatarGradient,
	buildTimeline,
	formatListTime,
	formatTimeLabel,
	LIMITS,
	OWNER_NAME,
	sortThreads,
	validateMessage,
	validateNewThread,
	type Message,
	type Thread,
} from './conversations';

const now = new Date('2026-09-28T03:00:00Z'); // 서울 기준 9월 28일(월) 정오
const TZ = 'Asia/Seoul';
const msg = (id: string, createdAt: string, fromOwner = false): Message => ({
	id,
	threadId: 't',
	text: id,
	createdAt,
	fromOwner,
});

describe('validateNewThread', () => {
	it('앞뒤 공백을 지우고 통과시킨다 (비밀번호는 그대로)', () => {
		const { value, errors } = validateNewThread({ nickname: ' 민수 ', password: ' 1234 ', text: ' 안녕하세요 ' });
		expect(errors).toEqual({});
		expect(value).toEqual({ nickname: '민수', password: ' 1234 ', text: '안녕하세요' });
	});

	it('비어 있거나 길이를 넘으면 필드별로 알려준다', () => {
		expect(Object.keys(validateNewThread({ nickname: '', password: '', text: ' ' }).errors).sort()).toEqual([
			'nickname',
			'password',
			'text',
		]);
		const { errors } = validateNewThread({
			nickname: 'a'.repeat(LIMITS.nickname.max + 1),
			password: 'a'.repeat(LIMITS.password.max + 1),
			text: 'a'.repeat(LIMITS.text.max + 1),
		});
		expect(errors.nickname).toContain('20자');
		expect(errors.text).toContain('500자');
		expect(errors.password).toBeDefined();
	});

	it('주인 이름으로는 대화를 시작할 수 없다', () => {
		expect(validateNewThread({ nickname: OWNER_NAME, password: '1234', text: 'hi' }).errors.nickname).toBeDefined();
	});
});

describe('validateMessage', () => {
	it('공백만 있으면 거부한다', () => {
		expect(validateMessage('   ').error).toBeDefined();
		expect(validateMessage(' 안녕 ')).toEqual({ value: '안녕', error: undefined });
	});
});

describe('sortThreads', () => {
	it('고정 대화가 맨 위, 나머지는 최근 메시지 순', () => {
		const thread = (id: string, at: string, pinned = false): Thread => ({
			id,
			title: id,
			createdAt: '2026-01-01T00:00:00Z',
			pinned,
			lastMessage: { text: '', createdAt: at },
		});
		const sorted = sortThreads([
			thread('old', '2026-09-01T00:00:00Z'),
			thread('owner', '2026-01-01T00:00:00Z', true),
			thread('new', '2026-09-27T00:00:00Z'),
		]);
		expect(sorted.map((t) => t.id)).toEqual(['owner', 'new', 'old']);
	});
});

describe('buildTimeline', () => {
	const messages = (items: ReturnType<typeof buildTimeline>) =>
		items.flatMap((item) => (item.type === 'message' ? [item] : []));

	it('방문자 글은 오른쪽, 주인 글은 왼쪽', () => {
		const items = buildTimeline([msg('a', '2026-09-28T01:00:00Z'), msg('b', '2026-09-28T01:01:00Z', true)], {
			showReceipt: false,
			now,
			timeZone: TZ,
		});
		expect(messages(items).map((m) => m.side)).toEqual(['right', 'left']);
	});

	it('같은 사람이 연달아 보낸 묶음의 마지막 말풍선에만 꼬리를 단다', () => {
		const items = buildTimeline(
			[
				msg('a', '2026-09-28T01:00:00Z'),
				msg('b', '2026-09-28T01:01:00Z'),
				msg('c', '2026-09-28T01:02:00Z', true),
				msg('d', '2026-09-28T01:03:00Z', true),
			],
			{ showReceipt: false, now, timeZone: TZ }
		);
		expect(messages(items).map((m) => [m.key, m.tail])).toEqual([
			['a', false],
			['b', true],
			['c', false],
			['d', true],
		]);
	});

	it('내 대화에서만, 방문자의 마지막 메시지에 전송됨을 표시한다', () => {
		const list = [
			msg('a', '2026-09-28T01:00:00Z'),
			msg('b', '2026-09-28T01:01:00Z'),
			msg('c', '2026-09-28T01:02:00Z', true),
		];
		const receipts = (showReceipt: boolean) =>
			messages(buildTimeline(list, { showReceipt, now, timeZone: TZ }))
				.filter((m) => m.receipt)
				.map((m) => m.key);
		expect(receipts(true)).toEqual(['b']);
		expect(receipts(false)).toEqual([]);
	});

	it('한 시간 넘게 벌어지면 시간 구분선을 넣고 묶음을 끊는다', () => {
		const items = buildTimeline(
			[msg('a', '2026-09-28T00:00:00Z'), msg('b', '2026-09-28T00:30:00Z'), msg('c', '2026-09-28T02:00:00Z')],
			{ showReceipt: false, now, timeZone: TZ }
		);
		expect(items.map((item) => (item.type === 'time' ? `[${item.label}]` : item.key))).toEqual([
			'[오늘 오전 9:00]',
			'a',
			'b',
			'[오늘 오전 11:00]',
			'c',
		]);
		expect(messages(items).find((m) => m.key === 'b')?.tail).toBe(true);
	});
});

describe('formatTimeLabel', () => {
	const label = (iso: string) => formatTimeLabel(new Date(iso), now, TZ);

	it('오늘, 어제, 일주일 이내는 요일', () => {
		expect(label('2026-09-28T01:36:00Z')).toBe('오늘 오전 10:36');
		expect(label('2026-09-27T06:00:00Z')).toBe('어제 오후 3:00');
		expect(label('2026-09-25T06:00:00Z')).toBe('금요일 오후 3:00');
	});

	it('올해는 월·일과 요일, 그 전은 연도까지', () => {
		expect(label('2026-03-02T06:00:00Z')).toBe('3월 2일 (월) 오후 3:00');
		expect(label('2025-09-26T06:00:00Z')).toBe('2025년 9월 26일 오후 3:00');
	});

	it('시간대 기준으로 날짜를 판단한다 (UTC로는 어제여도 서울로는 오늘)', () => {
		expect(label('2026-09-27T16:00:00Z')).toBe('오늘 오전 1:00');
	});
});

describe('formatListTime', () => {
	const label = (iso: string) => formatListTime(new Date(iso), now, TZ);

	it('오늘은 시각, 어제, 일주일 이내는 요일, 그 전은 날짜', () => {
		expect(label('2026-09-28T01:36:00Z')).toBe('오전 10:36');
		expect(label('2026-09-27T06:00:00Z')).toBe('어제');
		expect(label('2026-09-25T06:00:00Z')).toBe('금요일');
		expect(label('2026-09-01T06:00:00Z')).toBe('2026. 9. 1.');
	});
});

describe('avatarGradient', () => {
	it('같은 이름은 항상 같은 색', () => {
		expect(avatarGradient('민수')).toEqual(avatarGradient('민수'));
	});
});

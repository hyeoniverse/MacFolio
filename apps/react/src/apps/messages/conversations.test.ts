import { describe, expect, it } from 'vitest';
import {
	buildTimeline,
	displayName,
	formatListTime,
	formatTimeLabel,
	LIMITS,
	maskIp,
	monogram,
	sortThreads,
	validateMessageInput,
	visitorName,
	ADJECTIVES,
	ANIMALS,
	type Message,
	type Thread,
} from './conversations';

const now = new Date('2026-09-28T03:00:00Z'); // 서울 기준 9월 28일(월) 정오
const TZ = 'Asia/Seoul';
const msg = (id: string, createdAt: string, authorId = 'a', extra: Partial<Message> = {}): Message => ({
	id,
	threadId: 't',
	text: id,
	createdAt,
	authorId,
	nickname: authorId,
	fromOwner: false,
	mine: false,
	...extra,
});

describe('validateMessageInput', () => {
	it('앞뒤 공백을 지우고 통과시킨다', () => {
		const { value, errors } = validateMessageInput({ text: ' 안녕하세요 ' });
		expect(errors).toEqual({});
		expect(value).toEqual({ text: '안녕하세요' });
	});

	it('비어 있거나 길이를 넘으면 알려준다', () => {
		expect(validateMessageInput({ text: ' ' }).errors.text).toBe('내용을 입력해주세요.');
		expect(validateMessageInput({ text: 'a'.repeat(LIMITS.text.max + 1) }).errors.text).toContain('500자');
	});
});

describe('visitorName', () => {
	it('같은 해시면 같은 이름, "이모지 꾸밈말 동물" 모양이고 서버와 같은 목록을 쓴다', () => {
		expect(visitorName('0'.repeat(16))).toBe(`${ANIMALS[0][0]} ${ADJECTIVES[0]} ${ANIMALS[0][1]}`);
		expect(visitorName('0123456789abcdef')).toBe(visitorName('0123456789abcdef'));
		const names = new Set(
			Array.from({ length: 200 }, (_, i) => visitorName((i * 2654435761).toString(16).padStart(16, '7')))
		);
		expect(names.size).toBeGreaterThan(50);
		expect(ADJECTIVES).toHaveLength(30);
		expect(ANIMALS).toHaveLength(24);
	});
});

describe('IP 표시', () => {
	it('IPv4는 앞 두 자리, IPv6는 앞 두 묶음만 남긴다', () => {
		expect(maskIp('211.234.56.78')).toBe('211.234');
		expect(maskIp('::ffff:175.112.3.4')).toBe('175.112');
		expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8');
	});

	it('IP 앞자리가 있으면 이름 뒤에 붙인다', () => {
		expect(displayName('민수', '211.234')).toBe('민수(211.234)');
		expect(displayName('민수')).toBe('민수');
	});
});

describe('sortThreads', () => {
	it('고정 방이 맨 위, 나머지는 최근 메시지 순', () => {
		const thread = (id: string, at: string, pinned = false): Thread => ({
			id,
			title: id,
			createdAt: '2026-01-01T00:00:00Z',
			pinned,
			mine: false,
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
	const build = (list: Message[]) => messages(buildTimeline(list, { now, timeZone: TZ }));

	it('내 글은 오른쪽, 다른 사람 글은 왼쪽', () => {
		const items = build([
			msg('a', '2026-09-28T01:00:00Z', 'me', { mine: true }),
			msg('b', '2026-09-28T01:01:00Z', 'x'),
		]);
		expect(items.map((m) => m.side)).toEqual(['right', 'left']);
	});

	it('같은 사람이 연달아 쓴 글은 묶어서, 첫 말풍선에 이름·마지막 말풍선에 꼬리', () => {
		const items = build([
			msg('a', '2026-09-28T01:00:00Z', 'x'),
			msg('b', '2026-09-28T01:01:00Z', 'x'),
			msg('c', '2026-09-28T01:02:00Z', 'y'),
		]);
		expect(items.map((m) => [m.key, m.showName, m.tail])).toEqual([
			['a', true, false],
			['b', false, true],
			['c', true, true],
		]);
	});

	it('내 글에는 이름을 붙이지 않고, 마지막 내 글에만 전송됨을 표시한다', () => {
		const items = build([
			msg('a', '2026-09-28T01:00:00Z', 'me', { mine: true }),
			msg('b', '2026-09-28T01:01:00Z', 'me', { mine: true }),
			msg('c', '2026-09-28T01:02:00Z', 'x'),
		]);
		expect(items.map((m) => [m.key, m.showName, m.receipt])).toEqual([
			['a', false, false],
			['b', false, true],
			['c', true, false],
		]);
	});

	it('한 시간 넘게 벌어지면 시간 구분선을 넣고 묶음을 끊는다', () => {
		const items = buildTimeline(
			[msg('a', '2026-09-28T00:00:00Z'), msg('b', '2026-09-28T00:30:00Z'), msg('c', '2026-09-28T02:00:00Z')],
			{ now, timeZone: TZ }
		);
		expect(items.map((item) => (item.type === 'time' ? `[${item.label}]` : item.key))).toEqual([
			'[오늘 오전 9:00]',
			'a',
			'b',
			'[오늘 오전 11:00]',
			'c',
		]);
		const c = messages(items).find((m) => m.key === 'c')!;
		expect(c.showName).toBe(true);
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

describe('monogram', () => {
	it('두 글자 이하는 통째로, 그보다 길면 첫 글자', () => {
		expect(monogram('엄마')).toBe('엄마');
		// 방문자 이름은 앞의 동물 이모지 (변형 선택자가 붙은 것도 통째로)
		expect(monogram('🦊 날쌘 여우')).toBe('🦊');
		expect(monogram('🐿️ 졸린 다람쥐')).toBe('🐿️');
		expect(monogram('김정현')).toBe('김');
		expect(monogram(' Alex ')).toBe('A');
	});

	it('이모지 같은 여러 코드 단위 문자도 한 글자로 센다', () => {
		expect(monogram('🙂친구')).toBe('🙂');
	});
});

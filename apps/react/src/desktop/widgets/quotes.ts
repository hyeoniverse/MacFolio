// 명언 위젯의 말과 고르기 (QuoteWidget.tsx). 개발·만들기에 관한 짧은 말을 원문과 우리말로 둔다. React에 의존하지 않는다

export interface Quote {
	/** 원문 */
	text: string;
	/** 우리말 */
	ko: string;
	author: string;
}

export const QUOTES: readonly Quote[] = [
	{
		text: 'Simplicity is prerequisite for reliability.',
		ko: '단순함은 신뢰성의 전제 조건이다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'Programs must be written for people to read, and only incidentally for machines to execute.',
		ko: '프로그램은 사람이 읽으라고 쓰는 것이고, 기계가 실행하는 것은 덤이다.',
		author: 'Harold Abelson',
	},
	{
		text: 'Premature optimization is the root of all evil.',
		ko: '섣부른 최적화는 모든 악의 근원이다.',
		author: 'Donald Knuth',
	},
	{ text: 'Talk is cheap. Show me the code.', ko: '말은 쉽다. 코드를 보여 줘.', author: 'Linus Torvalds' },
	{
		text: 'Make it work, make it right, make it fast.',
		ko: '돌아가게, 올바르게, 그다음에 빠르게.',
		author: 'Kent Beck',
	},
	{
		text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.',
		ko: '컴퓨터가 알아듣는 코드는 누구나 쓴다. 좋은 프로그래머는 사람이 알아듣는 코드를 쓴다.',
		author: 'Martin Fowler',
	},
	{
		text: 'First, solve the problem. Then, write the code.',
		ko: '먼저 문제를 풀어라. 코드는 그다음이다.',
		author: 'John Johnson',
	},
	{
		text: 'The best way to predict the future is to invent it.',
		ko: '미래를 내다보는 가장 좋은 방법은 미래를 만드는 것이다.',
		author: 'Alan Kay',
	},
	{
		text: 'Design is not just what it looks like and feels like. Design is how it works.',
		ko: '디자인은 보이고 느껴지는 것만이 아니다. 어떻게 작동하는가다.',
		author: 'Steve Jobs',
	},
	{ text: 'Real artists ship.', ko: '진짜 예술가는 내놓는다.', author: 'Steve Jobs' },
	{
		text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.',
		ko: '완벽함은 더할 것이 없을 때가 아니라 뺄 것이 없을 때 이루어진다.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: "Code is like humor. When you have to explain it, it's bad.",
		ko: '코드는 농담과 같다. 설명해야 한다면 나쁜 것이다.',
		author: 'Cory House',
	},
];

/** 날짜(YYYY-MM-DD)의 날 번호. 하루에 1씩 는다 */
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/**
 * 그날의 말: 날마다 다음 말로 넘어가 모두가 같은 날 같은 말을 본다. skip만큼 더 넘긴다 (위젯을 눌러 다음 말).
 * 날짜가 틀렸으면 첫 말
 */
export function quoteOf(day: string, skip = 0, quotes: readonly Quote[] = QUOTES): Quote {
	const base = dayNumber(day);
	const index = Number.isFinite(base) ? base + skip : skip;
	return quotes[((index % quotes.length) + quotes.length) % quotes.length];
}

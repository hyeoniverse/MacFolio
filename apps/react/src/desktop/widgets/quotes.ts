// 명언 위젯의 말과 고르기 (QuoteWidget.tsx). 개발·디자인·만들기에 관한 짧은 말을 원문과 우리말로 둔다. React에 의존하지 않는다

export interface Quote {
	/** 원문 */
	text: string;
	/** 우리말 */
	ko: string;
	author: string;
}

/** 짧은 말 위주로 (작은 위젯에 세 줄). 날마다 하나씩 돌아가며, 한 바퀴는 두 달 남짓 */
export const QUOTES: readonly Quote[] = [
	{
		text: 'Simplicity is prerequisite for reliability.',
		ko: '단순함은 신뢰성의 전제 조건이다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'Testing shows the presence, not the absence of bugs.',
		ko: '테스트는 버그가 있음을 보여 줄 뿐, 없음을 보여 주지는 못한다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'The question of whether computers can think is like the question of whether submarines can swim.',
		ko: '컴퓨터가 생각할 수 있느냐는 물음은 잠수함이 헤엄칠 수 있느냐는 물음과 같다.',
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
	{
		text: 'Beware of bugs in the above code; I have only proved it correct, not tried it.',
		ko: '위 코드의 버그를 조심하라. 맞다고 증명만 했지 돌려 보지는 않았다.',
		author: 'Donald Knuth',
	},
	{ text: 'Talk is cheap. Show me the code.', ko: '말은 쉽다. 코드를 보여 줘.', author: 'Linus Torvalds' },
	{
		text: 'Bad programmers worry about the code. Good programmers worry about data structures and their relationships.',
		ko: '나쁜 프로그래머는 코드를 걱정한다. 좋은 프로그래머는 자료 구조와 그 관계를 걱정한다.',
		author: 'Linus Torvalds',
	},
	{
		text: 'Make it work, make it right, make it fast.',
		ko: '돌아가게, 올바르게, 그다음에 빠르게.',
		author: 'Kent Beck',
	},
	{
		text: "I'm not a great programmer; I'm just a good programmer with great habits.",
		ko: '나는 대단한 프로그래머가 아니다. 좋은 습관을 가진 괜찮은 프로그래머일 뿐이다.',
		author: 'Kent Beck',
	},
	{
		text: 'Optimism is an occupational hazard of programming: feedback is the treatment.',
		ko: '낙관은 프로그래밍의 직업병이다. 피드백이 약이다.',
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
		text: 'Simple things should be simple, complex things should be possible.',
		ko: '쉬운 일은 쉬워야 하고, 어려운 일은 할 수 있어야 한다.',
		author: 'Alan Kay',
	},
	{
		text: 'Design is not just what it looks like and feels like. Design is how it works.',
		ko: '디자인은 보이고 느껴지는 것만이 아니다. 어떻게 작동하는가다.',
		author: 'Steve Jobs',
	},
	{ text: 'Real artists ship.', ko: '진짜 예술가는 내놓는다.', author: 'Steve Jobs' },
	{
		text: 'Innovation distinguishes between a leader and a follower.',
		ko: '혁신이 이끄는 사람과 따르는 사람을 가른다.',
		author: 'Steve Jobs',
	},
	{ text: 'Stay hungry. Stay foolish.', ko: '늘 갈망하고, 늘 우직하게.', author: 'Stewart Brand' },
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
	{
		text: 'There are only two hard things in Computer Science: cache invalidation and naming things.',
		ko: '컴퓨터 과학에서 어려운 것은 둘뿐이다. 캐시 무효화와 이름 짓기.',
		author: 'Phil Karlton',
	},
	{
		text: 'Debugging is twice as hard as writing the code in the first place.',
		ko: '디버깅은 처음 코드를 쓰는 것보다 두 배 어렵다.',
		author: 'Brian Kernighan',
	},
	{
		text: 'Controlling complexity is the essence of computer programming.',
		ko: '복잡함을 다스리는 것이 프로그래밍의 본질이다.',
		author: 'Brian Kernighan',
	},
	{
		text: 'The function of good software is to make the complex appear to be simple.',
		ko: '좋은 소프트웨어는 복잡한 것을 단순해 보이게 한다.',
		author: 'Grady Booch',
	},
	{
		text: 'Inside every large program, there is a small program trying to get out.',
		ko: '모든 큰 프로그램 안에는 빠져나오려는 작은 프로그램이 있다.',
		author: 'C. A. R. Hoare',
	},
	{
		text: 'Walking on water and developing software from a specification are easy if both are frozen.',
		ko: '물 위를 걷는 것과 명세대로 소프트웨어를 만드는 것은, 둘 다 얼어 있으면 쉽다.',
		author: 'Edward V. Berard',
	},
	{
		text: 'Before software can be reusable it first has to be usable.',
		ko: '다시 쓸 수 있으려면 먼저 쓸 수 있어야 한다.',
		author: 'Ralph Johnson',
	},
	{
		text: 'Make each program do one thing well.',
		ko: '프로그램마다 한 가지 일을 잘하게 하라.',
		author: 'Doug McIlroy',
	},
	{ text: 'When in doubt, use brute force.', ko: '망설여지면 무식하게 풀어라.', author: 'Ken Thompson' },
	{
		text: 'One of my most productive days was throwing away 1,000 lines of code.',
		ko: '가장 생산적이었던 날 중 하나는 코드 천 줄을 버린 날이었다.',
		author: 'Ken Thompson',
	},
	{
		text: 'Measuring programming progress by lines of code is like measuring aircraft building progress by weight.',
		ko: '코드 줄 수로 진척을 재는 것은 비행기 만들기의 진척을 무게로 재는 것과 같다.',
		author: 'Bill Gates',
	},
	{
		text: 'Truth can only be found in one place: the code.',
		ko: '진실은 한 곳에만 있다. 코드.',
		author: 'Robert C. Martin',
	},
	{
		text: 'The only way to go fast, is to go well.',
		ko: '빨리 가는 유일한 길은 잘 가는 것이다.',
		author: 'Robert C. Martin',
	},
	{
		text: 'Clean code always looks like it was written by someone who cares.',
		ko: '깔끔한 코드는 늘 마음을 쓴 사람이 쓴 것처럼 보인다.',
		author: 'Michael Feathers',
	},
	{
		text: 'To me, legacy code is simply code without tests.',
		ko: '내게 레거시 코드란 테스트가 없는 코드일 뿐이다.',
		author: 'Michael Feathers',
	},
	{
		text: 'Good code is its own best documentation.',
		ko: '좋은 코드는 그 자체로 가장 좋은 문서다.',
		author: 'Steve McConnell',
	},
	{
		text: 'The best error message is the one that never shows up.',
		ko: '가장 좋은 오류 메시지는 나타나지 않는 메시지다.',
		author: 'Thomas Fuchs',
	},
	{
		text: "Programming isn't about what you know; it's about what you can figure out.",
		ko: '프로그래밍은 무엇을 아느냐가 아니라 무엇을 알아낼 수 있느냐다.',
		author: 'Chris Pine',
	},
	{
		text: 'Code never lies, comments sometimes do.',
		ko: '코드는 거짓말하지 않는다. 주석은 가끔 한다.',
		author: 'Ron Jeffries',
	},
	{ text: "You aren't gonna need it.", ko: '그거, 안 쓰게 될 거야.', author: 'Ron Jeffries' },
	{
		text: 'Do the simplest thing that could possibly work.',
		ko: '될 법한 가장 단순한 것을 하라.',
		author: 'Ward Cunningham',
	},
	{ text: 'Fix the cause, not the symptom.', ko: '증상이 아니라 원인을 고쳐라.', author: 'Steve Maguire' },
	{
		text: 'Java is to JavaScript what car is to carpet.',
		ko: 'Java와 JavaScript의 관계는 car와 carpet의 관계다.',
		author: 'Chris Heilmann',
	},
	{
		text: 'Any application that can be written in JavaScript, will eventually be written in JavaScript.',
		ko: 'JavaScript로 쓸 수 있는 앱은 결국 JavaScript로 쓰인다.',
		author: 'Jeff Atwood',
	},
	{
		text: 'Given enough eyeballs, all bugs are shallow.',
		ko: '보는 눈이 충분하면 모든 버그는 얕다.',
		author: 'Eric S. Raymond',
	},
	{
		text: 'Release early. Release often. And listen to your customers.',
		ko: '일찍 내놓고, 자주 내놓고, 쓰는 사람의 말을 들어라.',
		author: 'Eric S. Raymond',
	},
	{
		text: 'Plan to throw one away; you will, anyhow.',
		ko: '하나는 버릴 셈으로 만들어라. 어차피 버리게 된다.',
		author: 'Fred Brooks',
	},
	{
		text: 'Adding manpower to a late software project makes it later.',
		ko: '늦어진 프로젝트에 사람을 더하면 더 늦어진다.',
		author: 'Fred Brooks',
	},
	{
		text: 'Code is read much more often than it is written.',
		ko: '코드는 쓰는 것보다 읽히는 일이 훨씬 많다.',
		author: 'Guido van Rossum',
	},
	{ text: 'Readability counts.', ko: '읽기 쉬움이 중요하다.', author: 'Tim Peters' },
	{ text: 'Explicit is better than implicit.', ko: '드러난 것이 숨은 것보다 낫다.', author: 'Tim Peters' },
	{ text: 'Errors should never pass silently.', ko: '오류는 조용히 넘어가서는 안 된다.', author: 'Tim Peters' },
	{ text: 'Now is better than never.', ko: '안 하는 것보다 지금 하는 것이 낫다.', author: 'Tim Peters' },
	{
		text: "It always takes longer than you expect, even when you take into account Hofstadter's Law.",
		ko: '일은 늘 생각보다 오래 걸린다. 이 법칙을 셈에 넣어도 그렇다.',
		author: 'Douglas Hofstadter',
	},
	{
		text: 'Any sufficiently advanced technology is indistinguishable from magic.',
		ko: '충분히 발달한 기술은 마법과 구별할 수 없다.',
		author: 'Arthur C. Clarke',
	},
	{
		text: 'Simplicity, the art of maximizing the amount of work not done, is essential.',
		ko: '단순함, 즉 하지 않아도 되는 일을 최대로 늘리는 기술이 꼭 필요하다.',
		author: 'Agile Manifesto',
	},
	{
		text: 'Working software is the primary measure of progress.',
		ko: '돌아가는 소프트웨어가 진척의 첫째 척도다.',
		author: 'Agile Manifesto',
	},
	{
		text: "If you don't make mistakes, you're not working on hard enough problems.",
		ko: '실수하지 않는다면 충분히 어려운 문제를 풀고 있지 않은 것이다.',
		author: 'Frank Wilczek',
	},
	{
		text: 'Experience is the name everyone gives to their mistakes.',
		ko: '경험이란 누구나 자기 실수에 붙이는 이름이다.',
		author: 'Oscar Wilde',
	},
	{ text: 'Less is more.', ko: '적을수록 많다.', author: 'Ludwig Mies van der Rohe' },
	{
		text: 'Good design is as little design as possible.',
		ko: '좋은 디자인은 가능한 한 적게 디자인한 것이다.',
		author: 'Dieter Rams',
	},
	{ text: 'Form follows function.', ko: '형태는 기능을 따른다.', author: 'Louis Sullivan' },
	{
		text: 'The details are not the details. They make the design.',
		ko: '디테일은 그냥 디테일이 아니다. 디테일이 디자인을 만든다.',
		author: 'Charles Eames',
	},
	{ text: 'Design is thinking made visual.', ko: '디자인은 눈에 보이게 만든 생각이다.', author: 'Saul Bass' },
	{
		text: "Content precedes design. Design in the absence of content is not design, it's decoration.",
		ko: '내용이 디자인보다 먼저다. 내용 없는 디자인은 디자인이 아니라 장식이다.',
		author: 'Jeffrey Zeldman',
	},
	{ text: "Don't make me think.", ko: '생각하게 하지 마라.', author: 'Steve Krug' },
	{
		text: "A user interface is like a joke. If you have to explain it, it's not that good.",
		ko: 'UI는 농담과 같다. 설명해야 한다면 그리 좋은 것이 아니다.',
		author: 'Martin LeBlanc',
	},
	{
		text: 'Software and cathedrals are much the same: first we build them, then we pray.',
		ko: '소프트웨어와 성당은 비슷하다. 먼저 짓고, 그다음 기도한다.',
		author: 'Sam Redwine',
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

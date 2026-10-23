// 명언 위젯의 말과 고르기 (QuoteWidget.tsx). 개발·디자인·만들기에 관한 짧은 말을 원문과 우리말로 둔다. React에 의존하지 않는다

export interface Quote {
	/** 원문 */
	text: string;
	/** 우리말 */
	ko: string;
	author: string;
}

/** 짧은 말 위주로 (작은 위젯에 세 줄). 365개라 날마다 하나씩 돌면 한 해 동안 같은 말이 나오지 않는다 */
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
	{
		text: "The most dangerous phrase in the language is: we've always done it this way.",
		ko: "가장 위험한 말은 '늘 이렇게 해 왔다'이다.",
		author: 'Grace Hopper',
	},
	{
		text: "It's easier to ask forgiveness than it is to get permission.",
		ko: '허락을 구하는 것보다 용서를 구하는 것이 쉽다.',
		author: 'Grace Hopper',
	},
	{
		text: "A ship in port is safe, but that's not what ships are built for.",
		ko: '항구에 있는 배는 안전하다. 하지만 배는 그러려고 만든 것이 아니다.',
		author: 'Grace Hopper',
	},
	{ text: 'Software is eating the world.', ko: '소프트웨어가 세상을 먹어 치우고 있다.', author: 'Marc Andreessen' },
	{
		text: "Programming is not about typing, it's about thinking.",
		ko: '프로그래밍은 타자가 아니라 생각이다.',
		author: 'Rich Hickey',
	},
	{ text: 'Simplicity is hard work.', ko: '단순함은 힘든 일이다.', author: 'Rich Hickey' },
	{
		text: 'The art of programming is the art of organizing complexity.',
		ko: '프로그래밍의 기술은 복잡함을 정리하는 기술이다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'Elegance is not a dispensable luxury but a quality that decides between success and failure.',
		ko: '우아함은 없어도 되는 사치가 아니라 성공과 실패를 가르는 품질이다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'People who are really serious about software should make their own hardware.',
		ko: '소프트웨어에 진지한 사람이라면 하드웨어도 직접 만들어야 한다.',
		author: 'Alan Kay',
	},
	{ text: 'There is no silver bullet.', ko: '은탄환은 없다.', author: 'Fred Brooks' },
	{
		text: 'The bearing of a child takes nine months, no matter how many women are assigned.',
		ko: '아이를 낳는 데는 몇 사람을 붙이든 아홉 달이 걸린다.',
		author: 'Fred Brooks',
	},
	{
		text: 'Conceptual integrity is the most important consideration in system design.',
		ko: '개념의 일관성이 시스템 설계에서 가장 중요하다.',
		author: 'Fred Brooks',
	},
	{
		text: 'Every program attempts to expand until it can read mail.',
		ko: '모든 프로그램은 메일을 읽을 수 있을 때까지 커지려 한다.',
		author: 'Jamie Zawinski',
	},
	{
		text: 'Be conservative in what you send, be liberal in what you accept.',
		ko: '보낼 때는 엄격하게, 받을 때는 너그럽게.',
		author: 'Jon Postel',
	},
	{ text: 'Worse is better.', ko: '덜 좋은 것이 더 낫다.', author: 'Richard P. Gabriel' },
	{ text: 'Data dominates.', ko: '데이터가 지배한다.', author: 'Rob Pike' },
	{ text: 'Simplicity is complicated.', ko: '단순함은 복잡하다.', author: 'Rob Pike' },
	{ text: 'Clear is better than clever.', ko: '영리한 것보다 분명한 것이 낫다.', author: 'Rob Pike' },
	{
		text: 'A little copying is better than a little dependency.',
		ko: '조금 베끼는 것이 조금 의존하는 것보다 낫다.',
		author: 'Rob Pike',
	},
	{ text: 'Errors are values.', ko: '오류도 값이다.', author: 'Rob Pike' },
	{
		text: 'Duplication is far cheaper than the wrong abstraction.',
		ko: '중복은 잘못된 추상화보다 훨씬 싸다.',
		author: 'Sandi Metz',
	},
	{
		text: 'Make the change easy, then make the easy change.',
		ko: '바꾸기 쉽게 만든 다음, 쉬워진 변경을 하라.',
		author: 'Kent Beck',
	},
	{
		text: 'Leave the campground cleaner than you found it.',
		ko: '야영지는 왔을 때보다 깨끗하게 해 두고 떠나라.',
		author: 'Robert C. Martin',
	},
	{
		text: 'Functions should do one thing. They should do it well. They should do it only.',
		ko: '함수는 한 가지를 해야 한다. 그것을 잘해야 하고, 그것만 해야 한다.',
		author: 'Robert C. Martin',
	},
	{ text: 'If it hurts, do it more often.', ko: '아프다면 더 자주 하라.', author: 'Martin Fowler' },
	{
		text: 'The most effective debugging tool is still careful thought, coupled with judiciously placed print statements.',
		ko: '가장 좋은 디버깅 도구는 여전히 차분한 생각과 잘 둔 출력문이다.',
		author: 'Brian Kernighan',
	},
	{
		text: "Don't comment bad code, rewrite it.",
		ko: '나쁜 코드에 주석을 달지 말고 다시 써라.',
		author: 'Brian Kernighan & P. J. Plauger',
	},
	{
		text: "It's not at all important to get it right the first time. It's vitally important to get it right the last time.",
		ko: '처음에 맞게 하는 것은 중요하지 않다. 마지막에 맞게 하는 것이 정말 중요하다.',
		author: 'Andrew Hunt & David Thomas',
	},
	{
		text: "Don't live with broken windows.",
		ko: '깨진 창문을 그대로 두고 살지 마라.',
		author: 'Andrew Hunt & David Thomas',
	},
	{ text: 'Care about your craft.', ko: '자기 일의 솜씨에 마음을 써라.', author: 'Andrew Hunt & David Thomas' },
	{
		text: 'As far as the customer is concerned, the interface is the product.',
		ko: '쓰는 사람에게는 인터페이스가 곧 제품이다.',
		author: 'Jef Raskin',
	},
	{ text: 'Design is really an act of communication.', ko: '디자인은 사실 소통하는 일이다.', author: 'Don Norman' },
	{ text: 'Simple can be harder than complex.', ko: '단순한 것이 복잡한 것보다 어려울 수 있다.', author: 'Steve Jobs' },
	{ text: 'Focus is about saying no.', ko: '집중이란 아니라고 말하는 것이다.', author: 'Steve Jobs' },
	{ text: 'Ideas are easy. Implementation is hard.', ko: '생각은 쉽다. 만드는 것이 어렵다.', author: 'Guy Kawasaki' },
	{
		text: "If you are not embarrassed by the first version of your product, you've launched too late.",
		ko: '첫 버전이 부끄럽지 않다면 너무 늦게 내놓은 것이다.',
		author: 'Reid Hoffman',
	},
	{ text: 'Make something people want.', ko: '사람들이 원하는 것을 만들어라.', author: 'Paul Graham' },
	{ text: "Do things that don't scale.", ko: '규모가 커지지 않는 일을 하라.', author: 'Paul Graham' },
	{
		text: 'To iterate is human, to recurse divine.',
		ko: '반복은 인간의 일, 재귀는 신의 일.',
		author: 'L. Peter Deutsch',
	},
	{
		text: "One man's constant is another man's variable.",
		ko: '누군가의 상수는 다른 누군가의 변수다.',
		author: 'Alan Perlis',
	},
	{
		text: "A language that doesn't affect the way you think about programming is not worth knowing.",
		ko: '프로그래밍에 대한 생각을 바꾸지 않는 언어는 배울 가치가 없다.',
		author: 'Alan Perlis',
	},
	{
		text: 'Simplicity does not precede complexity, but follows it.',
		ko: '단순함은 복잡함보다 앞서지 않고 그 뒤에 온다.',
		author: 'Alan Perlis',
	},
	{
		text: 'There are two ways to write error-free programs; only the third one works.',
		ko: '오류 없는 프로그램을 쓰는 방법은 두 가지다. 통하는 것은 세 번째뿐이다.',
		author: 'Alan Perlis',
	},
	{
		text: 'It is easier to write an incorrect program than understand a correct one.',
		ko: '맞는 프로그램을 이해하는 것보다 틀린 프로그램을 쓰는 것이 쉽다.',
		author: 'Alan Perlis',
	},
	{
		text: 'All problems in computer science can be solved by another level of indirection.',
		ko: '컴퓨터 과학의 모든 문제는 간접 계층을 하나 더 두면 풀린다.',
		author: 'David Wheeler',
	},
	{
		text: "It's harder to read code than to write it.",
		ko: '코드는 쓰는 것보다 읽는 것이 어렵다.',
		author: 'Joel Spolsky',
	},
	{
		text: 'Good software, like wine, takes time.',
		ko: '좋은 소프트웨어는 와인처럼 시간이 걸린다.',
		author: 'Joel Spolsky',
	},
	{
		text: 'A complex system that works is invariably found to have evolved from a simple system that worked.',
		ko: '잘 돌아가는 복잡한 시스템은 늘 잘 돌아가던 단순한 시스템에서 자라난 것이다.',
		author: 'John Gall',
	},
	{ text: 'Everything fails, all the time.', ko: '모든 것은 늘 고장 난다.', author: 'Werner Vogels' },
	{ text: 'You build it, you run it.', ko: '만든 사람이 운영한다.', author: 'Werner Vogels' },
	{
		text: 'Every great developer you know got there by solving problems they were unqualified to solve until they actually did it.',
		ko: '뛰어난 개발자는 모두 풀 자격이 없던 문제를 풀어내며 거기에 이르렀다.',
		author: 'Patrick McKenzie',
	},
	{
		text: "Users don't care about what's inside the box, as long as the box does what they need done.",
		ko: '상자가 필요한 일을 해 주는 한, 쓰는 사람은 상자 안에 무엇이 있는지 신경 쓰지 않는다.',
		author: 'Jef Raskin',
	},
	{
		text: 'We will encourage you to develop the three great virtues of a programmer: laziness, impatience, and hubris.',
		ko: '프로그래머의 세 가지 큰 미덕, 게으름과 조급함과 오만을 기르기를 권한다.',
		author: 'Larry Wall',
	},
	{ text: "There's more than one way to do it.", ko: '방법은 하나가 아니다.', author: 'Larry Wall' },
	{
		text: 'The competent programmer is fully aware of the strictly limited size of his own skull.',
		ko: '유능한 프로그래머는 자기 머리의 크기가 매우 제한되어 있다는 것을 잘 안다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'Perfecting oneself is as much unlearning as it is learning.',
		ko: '자신을 완성하는 일은 배우는 일인 만큼 배운 것을 버리는 일이기도 하다.',
		author: 'Edsger W. Dijkstra',
	},
	{ text: 'Do only what only you can do.', ko: '당신만 할 수 있는 일만 하라.', author: 'Edsger W. Dijkstra' },
	{
		text: "The computing scientist's main challenge is not to get confused by the complexities of his own making.",
		ko: '컴퓨터 과학자의 가장 큰 과제는 스스로 만든 복잡함에 헷갈리지 않는 것이다.',
		author: 'Edsger W. Dijkstra',
	},
	{
		text: 'Science is what we understand well enough to explain to a computer. Art is everything else we do.',
		ko: '과학은 컴퓨터에게 설명할 수 있을 만큼 잘 이해한 것이다. 나머지는 모두 예술이다.',
		author: 'Donald Knuth',
	},
	{
		text: 'An algorithm must be seen to be believed.',
		ko: '알고리즘은 직접 봐야 믿을 수 있다.',
		author: 'Donald Knuth',
	},
	{
		text: 'Programming is the art of telling another human being what one wants the computer to do.',
		ko: '프로그래밍은 컴퓨터에게 시키고 싶은 일을 다른 사람에게 설명하는 기술이다.',
		author: 'Donald Knuth',
	},
	{
		text: 'Everyday life is like programming, I guess. If you love something you can put beauty into it.',
		ko: '일상도 프로그래밍과 비슷한 것 같다. 무언가를 좋아하면 거기에 아름다움을 담을 수 있다.',
		author: 'Donald Knuth',
	},
	{
		text: 'The price of reliability is the pursuit of the utmost simplicity.',
		ko: '신뢰성의 대가는 극도의 단순함을 추구하는 것이다.',
		author: 'C. A. R. Hoare',
	},
	{
		text: 'I call it my billion-dollar mistake.',
		ko: '나는 그것을 10억 달러짜리 실수라고 부른다.',
		author: 'C. A. R. Hoare',
	},
	{
		text: 'Fools ignore complexity. Pragmatists suffer it. Some can avoid it. Geniuses remove it.',
		ko: '바보는 복잡함을 무시하고, 실용주의자는 견디고, 누군가는 피하고, 천재는 없앤다.',
		author: 'Alan Perlis',
	},
	{
		text: 'Every program is a part of some other program and rarely fits.',
		ko: '모든 프로그램은 다른 프로그램의 일부이고, 잘 들어맞는 경우는 드물다.',
		author: 'Alan Perlis',
	},
	{
		text: 'If you have a procedure with ten parameters, you probably missed some.',
		ko: '매개변수가 열 개인 함수가 있다면 아마 몇 개를 빠뜨렸을 것이다.',
		author: 'Alan Perlis',
	},
	{ text: 'Optimization hinders evolution.', ko: '최적화는 진화를 가로막는다.', author: 'Alan Perlis' },
	{
		text: 'Syntactic sugar causes cancer of the semicolon.',
		ko: '문법 설탕은 세미콜론의 암을 일으킨다.',
		author: 'Alan Perlis',
	},
	{
		text: 'Some programming languages manage to absorb change, but withstand progress.',
		ko: '어떤 프로그래밍 언어는 변화는 받아들이면서 진보는 버텨 낸다.',
		author: 'Alan Perlis',
	},
	{
		text: 'The most important single aspect of software development is to be clear about what you are trying to build.',
		ko: '소프트웨어 개발에서 가장 중요한 한 가지는 무엇을 만들려는지 분명히 하는 것이다.',
		author: 'Bjarne Stroustrup',
	},
	{
		text: 'There are only two kinds of languages: the ones people complain about and the ones nobody uses.',
		ko: '언어는 두 종류뿐이다. 사람들이 불평하는 언어와 아무도 쓰지 않는 언어.',
		author: 'Bjarne Stroustrup',
	},
	{
		text: 'Within C++, there is a much smaller and cleaner language struggling to get out.',
		ko: 'C++ 안에는 훨씬 작고 깔끔한 언어가 빠져나오려고 애쓰고 있다.',
		author: 'Bjarne Stroustrup',
	},
	{ text: 'Beautiful is better than ugly.', ko: '아름다운 것이 추한 것보다 낫다.', author: 'Tim Peters' },
	{ text: 'Simple is better than complex.', ko: '단순한 것이 복잡한 것보다 낫다.', author: 'Tim Peters' },
	{ text: 'Complex is better than complicated.', ko: '복잡한 것이 난해한 것보다 낫다.', author: 'Tim Peters' },
	{ text: 'Flat is better than nested.', ko: '평평한 것이 중첩된 것보다 낫다.', author: 'Tim Peters' },
	{ text: 'Sparse is better than dense.', ko: '여유 있는 것이 빽빽한 것보다 낫다.', author: 'Tim Peters' },
	{
		text: "Special cases aren't special enough to break the rules.",
		ko: '특별한 경우라도 규칙을 깰 만큼 특별하지는 않다.',
		author: 'Tim Peters',
	},
	{ text: 'Practicality beats purity.', ko: '실용성이 순수함을 이긴다.', author: 'Tim Peters' },
	{
		text: 'In the face of ambiguity, refuse the temptation to guess.',
		ko: '모호할 때는 추측하고 싶은 유혹을 뿌리쳐라.',
		author: 'Tim Peters',
	},
	{
		text: 'There should be one, and preferably only one, obvious way to do it.',
		ko: '분명한 방법이 하나, 되도록이면 오직 하나만 있어야 한다.',
		author: 'Tim Peters',
	},
	{
		text: "If the implementation is hard to explain, it's a bad idea.",
		ko: '구현을 설명하기 어렵다면 나쁜 생각이다.',
		author: 'Tim Peters',
	},
	{
		text: 'If the implementation is easy to explain, it may be a good idea.',
		ko: '구현을 설명하기 쉽다면 좋은 생각일 수 있다.',
		author: 'Tim Peters',
	},
	{
		text: "Namespaces are one honking great idea, let's do more of those!",
		ko: '네임스페이스는 정말 훌륭한 생각이다. 더 많이 쓰자!',
		author: 'Tim Peters',
	},
	{
		text: 'UNIX is very simple, it just needs a genius to understand its simplicity.',
		ko: '유닉스는 아주 단순하다. 그 단순함을 이해하려면 천재가 필요할 뿐이다.',
		author: 'Dennis Ritchie',
	},
	{
		text: 'The only way to learn a new programming language is by writing programs in it.',
		ko: '새 프로그래밍 언어를 배우는 유일한 방법은 그 언어로 프로그램을 써 보는 것이다.',
		author: 'Dennis Ritchie',
	},
	{
		text: 'UNIX was not designed to stop its users from doing stupid things, as that would also stop them from doing clever things.',
		ko: '유닉스는 사용자가 어리석은 일을 못 하게 막지 않는다. 그러면 영리한 일도 못 하게 되기 때문이다.',
		author: 'Doug Gwyn',
	},
	{ text: 'Write programs to work together.', ko: '함께 동작하는 프로그램을 만들어라.', author: 'Doug McIlroy' },
	{
		text: 'Write programs to handle text streams, because that is a universal interface.',
		ko: '텍스트 스트림을 다루는 프로그램을 만들어라. 그것이 보편적인 인터페이스이기 때문이다.',
		author: 'Doug McIlroy',
	},
	{
		text: "Every good work of software starts by scratching a developer's personal itch.",
		ko: '좋은 소프트웨어는 모두 개발자가 자기 가려운 곳을 긁는 데서 시작한다.',
		author: 'Eric S. Raymond',
	},
	{
		text: 'Smart data structures and dumb code works a lot better than the other way around.',
		ko: '똑똑한 자료 구조와 단순한 코드가 그 반대보다 훨씬 잘 동작한다.',
		author: 'Eric S. Raymond',
	},
	{
		text: 'Good programmers know what to write. Great ones know what to rewrite (and reuse).',
		ko: '좋은 프로그래머는 무엇을 쓸지 안다. 뛰어난 프로그래머는 무엇을 다시 쓸지(그리고 재사용할지) 안다.',
		author: 'Eric S. Raymond',
	},
	{ text: 'Clarity is better than cleverness.', ko: '명확함이 영리함보다 낫다.', author: 'Eric S. Raymond' },
	{
		text: 'Intelligence is the ability to avoid doing work, yet getting the work done.',
		ko: '지능이란 일을 하지 않고도 일을 끝내는 능력이다.',
		author: 'Linus Torvalds',
	},
	{
		text: "When you don't create things, you become defined by your tastes rather than ability.",
		ko: '무언가를 만들지 않으면 능력이 아니라 취향으로 규정된다.',
		author: 'why the lucky stiff',
	},
	{
		text: 'The Web as I envisaged it, we have not seen it yet. The future is still so much bigger than the past.',
		ko: '내가 그린 웹은 아직 오지 않았다. 미래는 여전히 과거보다 훨씬 크다.',
		author: 'Tim Berners-Lee',
	},
	{ text: 'This is for everyone.', ko: '이것은 모두를 위한 것이다.', author: 'Tim Berners-Lee' },
	{ text: 'The power of the Web is in its universality.', ko: '웹의 힘은 보편성에 있다.', author: 'Tim Berners-Lee' },
	{ text: 'Always bet on JS.', ko: '언제나 JavaScript에 걸어라.', author: 'Brendan Eich' },
	{
		text: "JavaScript is the only language that I'm aware of that people feel they don't need to learn before they start using it.",
		ko: 'JavaScript는 내가 아는 한 사람들이 배우지 않고도 쓸 수 있다고 느끼는 유일한 언어다.',
		author: 'Douglas Crockford',
	},
	{
		text: 'Java is C++ without the guns, knives, and clubs.',
		ko: 'Java는 총과 칼과 몽둥이를 뺀 C++다.',
		author: 'James Gosling',
	},
	{
		text: 'Ruby is designed to make programmers happy.',
		ko: 'Ruby는 프로그래머를 행복하게 하려고 만들었다.',
		author: 'Yukihiro Matsumoto',
	},
	{ text: 'Convention over configuration.', ko: '설정보다 관례.', author: 'David Heinemeier Hansson' },
	{
		text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.',
		ko: '우리는 앞을 조금밖에 보지 못하지만, 그 안에서도 해야 할 일은 많이 보인다.',
		author: 'Alan Turing',
	},
	{
		text: 'Machines take me by surprise with great frequency.',
		ko: '기계는 꽤 자주 나를 놀라게 한다.',
		author: 'Alan Turing',
	},
	{ text: 'Humans are allergic to change.', ko: '사람은 변화에 알레르기가 있다.', author: 'Grace Hopper' },
	{ text: "If it's a good idea, go ahead and do it.", ko: '좋은 생각이라면 그냥 해라.', author: 'Grace Hopper' },
	{
		text: 'The Analytical Engine has no pretensions whatever to originate anything.',
		ko: '해석 기관은 무언가를 스스로 만들어 낸다고 내세우지 않는다.',
		author: 'Ada Lovelace',
	},
	{
		text: 'The more I study, the more insatiable do I feel my genius for it to be.',
		ko: '공부할수록 그 재능에 대한 갈증이 더 커진다.',
		author: 'Ada Lovelace',
	},
	{
		text: 'Your most unhappy customers are your greatest source of learning.',
		ko: '가장 불만이 많은 고객이 가장 큰 배움을 준다.',
		author: 'Bill Gates',
	},
	{
		text: "Success is a lousy teacher. It seduces smart people into thinking they can't lose.",
		ko: '성공은 형편없는 선생이다. 똑똑한 사람에게 질 리 없다고 믿게 만든다.',
		author: 'Bill Gates',
	},
	{
		text: "It's fine to celebrate success but it is more important to heed the lessons of failure.",
		ko: '성공을 축하하는 것도 좋지만 실패의 교훈에 귀 기울이는 것이 더 중요하다.',
		author: 'Bill Gates',
	},
	{
		text: "Your time is limited, so don't waste it living someone else's life.",
		ko: '시간은 한정되어 있으니 다른 사람의 삶을 사느라 낭비하지 마라.',
		author: 'Steve Jobs',
	},
	{
		text: 'Quality is more important than quantity. One home run is much better than two doubles.',
		ko: '양보다 질이 중요하다. 홈런 하나가 2루타 두 개보다 훨씬 낫다.',
		author: 'Steve Jobs',
	},
	{
		text: "People don't know what they want until you show it to them.",
		ko: '사람들은 보여 주기 전까지 자기가 무엇을 원하는지 모른다.',
		author: 'Steve Jobs',
	},
	{
		text: "Details matter, it's worth waiting to get it right.",
		ko: '디테일이 중요하다. 제대로 하려면 기다릴 가치가 있다.',
		author: 'Steve Jobs',
	},
	{
		text: "I'm as proud of many of the things we haven't done as the things we have done.",
		ko: '우리가 한 일만큼이나 하지 않은 일도 자랑스럽다.',
		author: 'Steve Jobs',
	},
	{ text: 'Creativity is just connecting things.', ko: '창의력은 그저 여러 가지를 잇는 것이다.', author: 'Steve Jobs' },
	{ text: 'Be a yardstick of quality.', ko: '품질의 기준이 되어라.', author: 'Steve Jobs' },
	{
		text: 'Design is the fundamental soul of a man-made creation.',
		ko: '디자인은 사람이 만든 것의 근본적인 영혼이다.',
		author: 'Steve Jobs',
	},
	{
		text: 'Simplicity is not the absence of clutter.',
		ko: '단순함은 어수선함이 없는 상태가 아니다.',
		author: 'Jony Ive',
	},
	{
		text: "It's very easy to be different, but very difficult to be better.",
		ko: '다르기는 아주 쉽지만, 더 낫기는 아주 어렵다.',
		author: 'Jony Ive',
	},
	{
		text: "Never trust a computer you can't throw out a window.",
		ko: '창밖으로 던질 수 없는 컴퓨터는 절대 믿지 마라.',
		author: 'Steve Wozniak',
	},
	{
		text: "My goal wasn't to make a ton of money. It was to build good computers.",
		ko: '내 목표는 돈을 많이 버는 것이 아니라 좋은 컴퓨터를 만드는 것이었다.',
		author: 'Steve Wozniak',
	},
	{
		text: 'Wherever smart people work, doors are unlocked.',
		ko: '똑똑한 사람들이 일하는 곳의 문은 잠겨 있지 않다.',
		author: 'Steve Wozniak',
	},
	{ text: 'Point of view is worth 80 IQ points.', ko: '관점은 IQ 80점만큼의 가치가 있다.', author: 'Alan Kay' },
	{
		text: "Technology is anything that wasn't around when you were born.",
		ko: '기술이란 당신이 태어났을 때 없던 모든 것이다.',
		author: 'Alan Kay',
	},
	{
		text: 'I invented the term object-oriented, and I can tell you I did not have C++ in mind.',
		ko: '객체 지향이라는 말은 내가 만들었고, 그때 C++를 염두에 두지는 않았다.',
		author: 'Alan Kay',
	},
	{
		text: "The computer revolution hasn't happened yet.",
		ko: '컴퓨터 혁명은 아직 일어나지 않았다.',
		author: 'Alan Kay',
	},
	{
		text: 'The programmer, like the poet, works only slightly removed from pure thought-stuff.',
		ko: '프로그래머는 시인처럼 순수한 생각에서 아주 조금 떨어진 재료로 일한다.',
		author: 'Fred Brooks',
	},
	{
		text: 'The hardest single part of building a software system is deciding precisely what to build.',
		ko: '소프트웨어를 만들 때 가장 어려운 일은 무엇을 만들지 정확히 정하는 것이다.',
		author: 'Fred Brooks',
	},
	{
		text: "Any decent answer to an interesting question begins, 'it depends...'",
		ko: "흥미로운 질문에 대한 괜찮은 답은 모두 '상황에 따라 다르다'로 시작한다.",
		author: 'Kent Beck',
	},
	{
		text: 'Comprehensiveness is the enemy of comprehensibility.',
		ko: '빠짐없음은 이해하기 쉬움의 적이다.',
		author: 'Martin Fowler',
	},
	{
		text: 'The ratio of time spent reading versus writing is well over 10 to 1.',
		ko: '코드를 읽는 시간과 쓰는 시간의 비율은 10 대 1을 훌쩍 넘는다.',
		author: 'Robert C. Martin',
	},
	{
		text: 'A long descriptive name is better than a short enigmatic name.',
		ko: '길어도 뜻이 드러나는 이름이 짧고 수수께끼 같은 이름보다 낫다.',
		author: 'Robert C. Martin',
	},
	{
		text: "Don't use a comment when you can use a function or a variable.",
		ko: '함수나 변수로 표현할 수 있으면 주석을 쓰지 마라.',
		author: 'Robert C. Martin',
	},
	{
		text: 'You know you are working on clean code when each routine you read turns out to be pretty much what you expected.',
		ko: '읽는 함수마다 예상한 그대로라면 깨끗한 코드로 일하고 있는 것이다.',
		author: 'Ward Cunningham',
	},
	{ text: "Don't repeat yourself.", ko: '같은 것을 반복하지 마라.', author: 'Andrew Hunt & David Thomas' },
	{
		text: 'Use tracer bullets to find the target.',
		ko: '예광탄을 쏴서 목표를 찾아라.',
		author: 'Andrew Hunt & David Thomas',
	},
	{
		text: 'Fix the problem, not the blame.',
		ko: '탓할 사람이 아니라 문제를 고쳐라.',
		author: 'Andrew Hunt & David Thomas',
	},
	{ text: 'Prototype to learn.', ko: '배우기 위해 프로토타입을 만들어라.', author: 'Andrew Hunt & David Thomas' },
	{
		text: 'Test early. Test often. Test automatically.',
		ko: '일찍 테스트하고, 자주 테스트하고, 자동으로 테스트하라.',
		author: 'Andrew Hunt & David Thomas',
	},
	{ text: "Don't assume it, prove it.", ko: '가정하지 말고 증명하라.', author: 'Andrew Hunt & David Thomas' },
	{ text: 'Crash early.', ko: '일찍 멈춰라.', author: 'Andrew Hunt & David Thomas' },
	{ text: 'Think! About your work.', ko: '자기 일에 대해 생각하라!', author: 'Andrew Hunt & David Thomas' },
	{
		text: "Don't just check errors, handle them gracefully.",
		ko: '오류를 확인만 하지 말고 우아하게 처리하라.',
		author: 'Rob Pike',
	},
	{
		text: 'The bigger the interface, the weaker the abstraction.',
		ko: '인터페이스가 클수록 추상화는 약해진다.',
		author: 'Rob Pike',
	},
	{ text: 'Make the zero value useful.', ko: '제로 값을 쓸모 있게 만들어라.', author: 'Rob Pike' },
	{
		text: "Gofmt's style is no one's favorite, yet gofmt is everyone's favorite.",
		ko: 'gofmt의 스타일은 누구의 취향도 아니지만, gofmt는 모두가 좋아한다.',
		author: 'Rob Pike',
	},
	{ text: 'Concurrency is not parallelism.', ko: '동시성은 병렬성이 아니다.', author: 'Rob Pike' },
	{ text: 'Documentation is for users.', ko: '문서는 사용자를 위한 것이다.', author: 'Rob Pike' },
	{ text: 'Reflection is never clear.', ko: '리플렉션은 결코 명확하지 않다.', author: 'Rob Pike' },
	{ text: 'The best code is no code at all.', ko: '가장 좋은 코드는 아예 없는 코드다.', author: 'Jeff Atwood' },
	{
		text: 'All non-trivial abstractions, to some degree, are leaky.',
		ko: '간단하지 않은 추상화는 모두 어느 정도 새는 곳이 있다.',
		author: 'Joel Spolsky',
	},
	{ text: 'Smart, and gets things done.', ko: '똑똑하고, 일을 해낸다.', author: 'Joel Spolsky' },
	{
		text: "The cheapest, fastest, and most reliable components are those that aren't there.",
		ko: '가장 싸고 빠르고 믿을 만한 부품은 아예 없는 부품이다.',
		author: 'Gordon Bell',
	},
	{
		text: 'Most of the biggest problems in software are problems of misconception.',
		ko: '소프트웨어의 큰 문제는 대부분 잘못 이해한 데서 온다.',
		author: 'Rich Hickey',
	},
	{
		text: 'Software is getting slower more rapidly than hardware becomes faster.',
		ko: '소프트웨어가 느려지는 속도가 하드웨어가 빨라지는 속도보다 빠르다.',
		author: 'Niklaus Wirth',
	},
	{ text: 'Algorithms + Data Structures = Programs.', ko: '알고리즘 + 자료 구조 = 프로그램.', author: 'Niklaus Wirth' },
	{
		text: "The trouble with programmers is that you can never tell what a programmer is doing until it's too late.",
		ko: '프로그래머의 문제는 너무 늦기 전까지 그가 무엇을 하는지 알 수 없다는 것이다.',
		author: 'Seymour Cray',
	},
	{
		text: 'Focused, hard work is the real key to success.',
		ko: '집중해서 열심히 일하는 것이 성공의 진짜 열쇠다.',
		author: 'John Carmack',
	},
	{
		text: "If you're willing to restrict the flexibility of your approach, you can almost always do something better.",
		ko: '방식의 유연성을 기꺼이 제한하면 거의 언제나 더 잘할 수 있다.',
		author: 'John Carmack',
	},
	{ text: "It's done when it's done.", ko: '끝나면 끝난 것이다.', author: 'John Carmack' },
	{ text: 'A fool with a tool is still a fool.', ko: '도구를 든 바보도 여전히 바보다.', author: 'Grady Booch' },
	{
		text: "No matter what the problem is, it's always a people problem.",
		ko: '문제가 무엇이든 결국 사람의 문제다.',
		author: 'Gerald Weinberg',
	},
	{
		text: "People under time pressure don't think faster.",
		ko: '시간에 쫓기는 사람이 더 빨리 생각하지는 않는다.',
		author: 'Tom DeMarco',
	},
	{
		text: 'Program to an interface, not an implementation.',
		ko: '구현이 아니라 인터페이스에 맞춰 프로그래밍하라.',
		author: 'Gang of Four',
	},
	{
		text: 'Favor object composition over class inheritance.',
		ko: '클래스 상속보다 객체 합성을 택하라.',
		author: 'Gang of Four',
	},
	{
		text: 'Complexity is anything related to the structure of a software system that makes it hard to understand and modify.',
		ko: '복잡함이란 소프트웨어를 이해하고 고치기 어렵게 만드는 구조상의 모든 것이다.',
		author: 'John Ousterhout',
	},
	{ text: "Working code isn't enough.", ko: '돌아가는 코드만으로는 충분하지 않다.', author: 'John Ousterhout' },
	{
		text: 'With a sufficient number of users of an API, it does not matter what you promise in the contract.',
		ko: 'API 사용자가 충분히 많으면 계약서에 무엇을 약속했는지는 중요하지 않다.',
		author: 'Hyrum Wright',
	},
	{
		text: "If you're thinking without writing, you only think you're thinking.",
		ko: '쓰지 않고 생각한다면, 생각한다고 생각할 뿐이다.',
		author: 'Leslie Lamport',
	},
	{
		text: 'Free software is a matter of liberty, not price.',
		ko: '자유 소프트웨어는 가격이 아니라 자유의 문제다.',
		author: 'Richard Stallman',
	},
	{
		text: 'Developers, developers, developers, developers!',
		ko: '개발자, 개발자, 개발자, 개발자!',
		author: 'Steve Ballmer',
	},
	{
		text: 'Individuals and interactions over processes and tools.',
		ko: '프로세스와 도구보다 개인과 상호작용을.',
		author: 'Agile Manifesto',
	},
	{
		text: 'Working software over comprehensive documentation.',
		ko: '포괄적인 문서보다 돌아가는 소프트웨어를.',
		author: 'Agile Manifesto',
	},
	{
		text: 'Customer collaboration over contract negotiation.',
		ko: '계약 협상보다 고객과의 협력을.',
		author: 'Agile Manifesto',
	},
	{
		text: 'Responding to change over following a plan.',
		ko: '계획을 따르기보다 변화에 대응하기를.',
		author: 'Agile Manifesto',
	},
	{
		text: 'The best architectures, requirements, and designs emerge from self-organizing teams.',
		ko: '가장 좋은 아키텍처와 요구 사항과 설계는 스스로 조직하는 팀에서 나온다.',
		author: 'Agile Manifesto',
	},
	{
		text: 'Continuous attention to technical excellence and good design enhances agility.',
		ko: '기술적 탁월함과 좋은 설계에 꾸준히 신경 쓰면 민첩성이 높아진다.',
		author: 'Agile Manifesto',
	},
	{ text: 'Security is a process, not a product.', ko: '보안은 제품이 아니라 과정이다.', author: 'Bruce Schneier' },
	{
		text: "The human factor is truly security's weakest link.",
		ko: '사람이야말로 보안에서 가장 약한 고리다.',
		author: 'Kevin Mitnick',
	},
	{
		text: "If you don't work on important problems, it's not likely that you'll do important work.",
		ko: '중요한 문제를 다루지 않으면 중요한 일을 해낼 가능성은 낮다.',
		author: 'Richard Hamming',
	},
	{
		text: 'The purpose of computing is insight, not numbers.',
		ko: '계산의 목적은 숫자가 아니라 통찰이다.',
		author: 'Richard Hamming',
	},
	{ text: 'Less, but better.', ko: '더 적게, 그러나 더 낫게.', author: 'Dieter Rams' },
	{ text: 'Good design is honest.', ko: '좋은 디자인은 정직하다.', author: 'Dieter Rams' },
	{ text: 'Good design is long-lasting.', ko: '좋은 디자인은 오래간다.', author: 'Dieter Rams' },
	{
		text: 'Good design makes a product understandable.',
		ko: '좋은 디자인은 제품을 이해하기 쉽게 만든다.',
		author: 'Dieter Rams',
	},
	{ text: 'Good design is unobtrusive.', ko: '좋은 디자인은 거슬리지 않는다.', author: 'Dieter Rams' },
	{ text: 'Good design is innovative.', ko: '좋은 디자인은 혁신적이다.', author: 'Dieter Rams' },
	{
		text: 'Good design is actually a lot harder to notice than poor design.',
		ko: '좋은 디자인은 사실 나쁜 디자인보다 훨씬 알아차리기 어렵다.',
		author: 'Don Norman',
	},
	{
		text: 'Two of the most important characteristics of good design are discoverability and understanding.',
		ko: '좋은 디자인의 가장 중요한 특징 두 가지는 발견 가능성과 이해다.',
		author: 'Don Norman',
	},
	{
		text: 'Users spend most of their time on other sites.',
		ko: '사용자는 대부분의 시간을 다른 사이트에서 보낸다.',
		author: 'Jakob Nielsen',
	},
	{
		text: "Design is so simple, that's why it is so complicated.",
		ko: '디자인은 아주 단순하다. 그래서 아주 복잡하다.',
		author: 'Paul Rand',
	},
	{
		text: 'Design is the silent ambassador of your brand.',
		ko: '디자인은 브랜드의 말 없는 대사다.',
		author: 'Paul Rand',
	},
	{ text: 'Design depends largely on constraints.', ko: '디자인은 대부분 제약에 달려 있다.', author: 'Charles Eames' },
	{
		text: 'Recognizing the need is the primary condition for design.',
		ko: '필요를 알아보는 것이 디자인의 첫째 조건이다.',
		author: 'Charles Eames',
	},
	{
		text: 'If you can design one thing, you can design everything.',
		ko: '하나를 디자인할 수 있으면 무엇이든 디자인할 수 있다.',
		author: 'Massimo Vignelli',
	},
	{
		text: 'There are three responses to a piece of design: yes, no, and WOW! Wow is the one to aim for.',
		ko: "디자인에 대한 반응은 세 가지다. 좋다, 별로다, 와! 노릴 것은 '와'다.",
		author: 'Milton Glaser',
	},
	{
		text: 'People ignore design that ignores people.',
		ko: '사람을 무시하는 디자인은 사람에게 무시당한다.',
		author: 'Frank Chimero',
	},
	{
		text: 'Good design is obvious. Great design is transparent.',
		ko: '좋은 디자인은 분명하다. 훌륭한 디자인은 투명하다.',
		author: 'Joe Sparano',
	},
	{
		text: 'Clutter and confusion are failures of design, not attributes of information.',
		ko: '어수선함과 혼란은 정보의 성질이 아니라 디자인의 실패다.',
		author: 'Edward Tufte',
	},
	{ text: 'Above all else show the data.', ko: '무엇보다 데이터를 보여 줘라.', author: 'Edward Tufte' },
	{
		text: 'What is essential is invisible to the eye.',
		ko: '가장 중요한 것은 눈에 보이지 않는다.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: 'The best way to have a good idea is to have a lot of ideas.',
		ko: '좋은 아이디어를 얻는 가장 좋은 방법은 아이디어를 많이 내는 것이다.',
		author: 'Linus Pauling',
	},
	{
		text: 'Science is a way of thinking much more than it is a body of knowledge.',
		ko: '과학은 지식의 모음이라기보다 생각하는 방식이다.',
		author: 'Carl Sagan',
	},
	{
		text: 'Extraordinary claims require extraordinary evidence.',
		ko: '비범한 주장에는 비범한 증거가 필요하다.',
		author: 'Carl Sagan',
	},
	{
		text: 'If you wish to make an apple pie from scratch, you must first invent the universe.',
		ko: '사과 파이를 처음부터 만들려면 먼저 우주를 발명해야 한다.',
		author: 'Carl Sagan',
	},
	{
		text: 'The first principle is that you must not fool yourself, and you are the easiest person to fool.',
		ko: '첫째 원칙은 자신을 속이지 않는 것이다. 그리고 가장 속이기 쉬운 사람이 바로 자신이다.',
		author: 'Richard Feynman',
	},
	{
		text: 'What I cannot create, I do not understand.',
		ko: '만들 수 없는 것은 이해하지 못한 것이다.',
		author: 'Richard Feynman',
	},
	{
		text: 'I learned very early the difference between knowing the name of something and knowing something.',
		ko: '나는 무언가의 이름을 아는 것과 그것을 아는 것의 차이를 아주 일찍 배웠다.',
		author: 'Richard Feynman',
	},
	{
		text: 'Imagination is more important than knowledge.',
		ko: '상상력이 지식보다 중요하다.',
		author: 'Albert Einstein',
	},
	{
		text: 'The important thing is not to stop questioning.',
		ko: '중요한 것은 질문을 멈추지 않는 것이다.',
		author: 'Albert Einstein',
	},
	{
		text: 'Life is like riding a bicycle. To keep your balance, you must keep moving.',
		ko: '삶은 자전거 타기와 같다. 균형을 잡으려면 계속 움직여야 한다.',
		author: 'Albert Einstein',
	},
	{
		text: 'Nothing in life is to be feared, it is only to be understood.',
		ko: '삶에서 두려워할 것은 없다. 이해할 것이 있을 뿐이다.',
		author: 'Marie Curie',
	},
	{
		text: 'Be less curious about people and more curious about ideas.',
		ko: '사람보다 생각에 더 호기심을 가져라.',
		author: 'Marie Curie',
	},
	{
		text: 'Genius is one percent inspiration and ninety-nine percent perspiration.',
		ko: '천재는 1퍼센트의 영감과 99퍼센트의 땀으로 이루어진다.',
		author: 'Thomas Edison',
	},
	{
		text: 'If I have seen further it is by standing on the shoulders of giants.',
		ko: '내가 더 멀리 보았다면 거인들의 어깨 위에 서 있었기 때문이다.',
		author: 'Isaac Newton',
	},
	{
		text: 'Truth is ever to be found in simplicity, and not in the multiplicity and confusion of things.',
		ko: '진리는 언제나 단순함에서 찾을 수 있지, 사물의 복잡함과 혼란에서 찾을 수 있는 것이 아니다.',
		author: 'Isaac Newton',
	},
	{
		text: "The scientist is not a person who gives the right answers, he's one who asks the right questions.",
		ko: '과학자는 옳은 답을 주는 사람이 아니라 옳은 질문을 하는 사람이다.',
		author: 'Claude Lévi-Strauss',
	},
	{ text: 'Chance favors only the prepared mind.', ko: '기회는 준비된 사람에게만 온다.', author: 'Louis Pasteur' },
	{
		text: 'Discovery consists of seeing what everybody has seen and thinking what nobody has thought.',
		ko: '발견이란 모두가 본 것을 보고 아무도 하지 않은 생각을 하는 것이다.',
		author: 'Albert Szent-Györgyi',
	},
	{ text: 'There is no royal road to geometry.', ko: '기하학에는 왕도가 없다.', author: 'Euclid' },
	{
		text: 'Give me a place to stand and I will move the earth.',
		ko: '설 곳을 주면 지구를 움직여 보이겠다.',
		author: 'Archimedes',
	},
	{
		text: 'The only way of discovering the limits of the possible is to venture a little way past them into the impossible.',
		ko: '가능의 한계를 알아내는 유일한 방법은 그 너머 불가능 속으로 조금 들어가 보는 것이다.',
		author: 'Arthur C. Clarke',
	},
	{
		text: "The future is already here, it's just not very evenly distributed.",
		ko: '미래는 이미 와 있다. 고르게 퍼져 있지 않을 뿐이다.',
		author: 'William Gibson',
	},
	{
		text: 'I love deadlines. I love the whooshing noise they make as they go by.',
		ko: '나는 마감이 좋다. 마감이 휙 지나가는 소리가 좋다.',
		author: 'Douglas Adams',
	},
	{
		text: 'All models are wrong, but some are useful.',
		ko: '모든 모델은 틀렸지만, 어떤 모델은 쓸모 있다.',
		author: 'George Box',
	},
	{ text: 'The map is not the territory.', ko: '지도는 영토가 아니다.', author: 'Alfred Korzybski' },
	{
		text: 'If the only tool you have is a hammer, it is tempting to treat everything as if it were a nail.',
		ko: '가진 도구가 망치뿐이면 모든 것을 못처럼 다루고 싶어진다.',
		author: 'Abraham Maslow',
	},
	{
		text: 'The limits of my language mean the limits of my world.',
		ko: '내 언어의 한계는 내 세계의 한계다.',
		author: 'Ludwig Wittgenstein',
	},
	{
		text: 'A problem well stated is a problem half solved.',
		ko: '잘 정의한 문제는 절반은 푼 문제다.',
		author: 'Charles Kettering',
	},
	{
		text: 'A wealth of information creates a poverty of attention.',
		ko: '정보가 넘치면 주의가 모자라게 된다.',
		author: 'Herbert Simon',
	},
	{ text: 'The medium is the message.', ko: '미디어가 곧 메시지다.', author: 'Marshall McLuhan' },
	{
		text: 'We shape our tools and thereafter our tools shape us.',
		ko: '우리는 도구를 만들고, 그 뒤로는 도구가 우리를 만든다.',
		author: 'John Culkin',
	},
	{
		text: 'Technology is neither good nor bad; nor is it neutral.',
		ko: '기술은 좋지도 나쁘지도 않고, 중립적이지도 않다.',
		author: 'Melvin Kranzberg',
	},
	{
		text: 'Getting information off the Internet is like taking a drink from a fire hydrant.',
		ko: '인터넷에서 정보를 얻는 것은 소화전에서 물을 마시는 것과 같다.',
		author: 'Mitch Kapor',
	},
	{
		text: 'The Internet is a reflection of our society.',
		ko: '인터넷은 우리 사회를 비추는 거울이다.',
		author: 'Vint Cerf',
	},
	{
		text: 'There is nothing so useless as doing efficiently that which should not be done at all.',
		ko: '하지 말아야 할 일을 효율적으로 하는 것만큼 쓸모없는 일은 없다.',
		author: 'Peter Drucker',
	},
	{
		text: 'Efficiency is doing things right; effectiveness is doing the right things.',
		ko: '효율은 일을 바르게 하는 것이고, 효과는 바른 일을 하는 것이다.',
		author: 'Peter Drucker',
	},
	{
		text: 'In God we trust; all others must bring data.',
		ko: '우리는 신을 믿는다. 나머지는 모두 데이터를 가져와라.',
		author: 'W. Edwards Deming',
	},
	{
		text: 'It is not necessary to change. Survival is not mandatory.',
		ko: '변할 필요는 없다. 살아남는 것이 의무는 아니니까.',
		author: 'W. Edwards Deming',
	},
	{
		text: 'Having no problems is the biggest problem of all.',
		ko: '문제가 없는 것이 가장 큰 문제다.',
		author: 'Taiichi Ohno',
	},
	{
		text: 'Tell me how you measure me, and I will tell you how I will behave.',
		ko: '나를 어떻게 평가하는지 알려 주면 내가 어떻게 행동할지 알려 주겠다.',
		author: 'Eliyahu Goldratt',
	},
	{
		text: 'When a measure becomes a target, it ceases to be a good measure.',
		ko: '지표가 목표가 되면 더 이상 좋은 지표가 아니다.',
		author: 'Marilyn Strathern',
	},
	{
		text: 'The only way to win is to learn faster than anyone else.',
		ko: '이기는 유일한 방법은 누구보다 빨리 배우는 것이다.',
		author: 'Eric Ries',
	},
	{ text: 'Competition is for losers.', ko: '경쟁은 패자들이 하는 것이다.', author: 'Peter Thiel' },
	{
		text: "Your brand is what other people say about you when you're not in the room.",
		ko: '브랜드란 당신이 없는 자리에서 사람들이 당신에 대해 하는 말이다.',
		author: 'Jeff Bezos',
	},
	{
		text: 'We are stubborn on vision. We are flexible on details.',
		ko: '비전에는 고집스럽고, 세부에는 유연하다.',
		author: 'Jeff Bezos',
	},
	{
		text: "Don't be a know-it-all; be a learn-it-all.",
		ko: '다 아는 사람이 되지 말고, 다 배우는 사람이 되라.',
		author: 'Satya Nadella',
	},
	{ text: 'Only the paranoid survive.', ko: '편집증 환자만 살아남는다.', author: 'Andy Grove' },
	{ text: 'Move fast and break things.', ko: '빠르게 움직이고 부숴라.', author: 'Mark Zuckerberg' },
	{
		text: 'The biggest risk is not taking any risk.',
		ko: '가장 큰 위험은 아무 위험도 감수하지 않는 것이다.',
		author: 'Mark Zuckerberg',
	},
	{
		text: "Live in the future, then build what's missing.",
		ko: '미래에 살고, 그다음 빠진 것을 만들어라.',
		author: 'Paul Graham',
	},
	{
		text: "It's better to make a few people really happy than to make a lot of people semi-happy.",
		ko: '많은 사람을 반쯤 만족시키는 것보다 몇 사람을 정말 만족시키는 편이 낫다.',
		author: 'Paul Graham',
	},
	{
		text: 'The way to get startup ideas is not to try to think of startup ideas.',
		ko: '스타트업 아이디어를 얻는 방법은 스타트업 아이디어를 떠올리려 애쓰지 않는 것이다.',
		author: 'Paul Graham',
	},
	{ text: 'Information wants to be free.', ko: '정보는 자유로워지고 싶어 한다.', author: 'Stewart Brand' },
	{
		text: 'Learn to sell. Learn to build. If you can do both, you will be unstoppable.',
		ko: '파는 법을 배우고, 만드는 법을 배워라. 둘 다 할 수 있으면 아무도 막지 못한다.',
		author: 'Naval Ravikant',
	},
	{
		text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
		ko: '사람은 목표의 수준으로 올라가지 않는다. 시스템의 수준으로 떨어진다.',
		author: 'James Clear',
	},
	{ text: "Be so good they can't ignore you.", ko: '무시할 수 없을 만큼 잘하라.', author: 'Steve Martin' },
	{
		text: 'Your mind is for having ideas, not holding them.',
		ko: '머리는 생각을 떠올리라고 있는 것이지, 담아 두라고 있는 것이 아니다.',
		author: 'David Allen',
	},
	{
		text: 'Wind extinguishes a candle and energizes fire.',
		ko: '바람은 촛불을 끄지만 모닥불은 살린다.',
		author: 'Nassim Nicholas Taleb',
	},
	{
		text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.',
		ko: '아마추어는 앉아서 영감을 기다리고, 나머지는 그냥 일어나 일하러 간다.',
		author: 'Stephen King',
	},
	{ text: 'You fail only if you stop writing.', ko: '쓰기를 멈출 때만 실패한다.', author: 'Ray Bradbury' },
	{
		text: 'Never use a long word where a short one will do.',
		ko: '짧은 말로 될 때 긴 말을 쓰지 마라.',
		author: 'George Orwell',
	},
	{ text: 'Omit needless words.', ko: '필요 없는 말은 빼라.', author: 'William Strunk Jr.' },
	{
		text: 'I have made this longer than usual because I have not had time to make it shorter.',
		ko: '더 짧게 쓸 시간이 없어서 평소보다 길게 썼다.',
		author: 'Blaise Pascal',
	},
	{ text: 'The best is the enemy of the good.', ko: '최선은 선의 적이다.', author: 'Voltaire' },
	{ text: 'Well done is better than well said.', ko: '잘한 것이 잘 말한 것보다 낫다.', author: 'Benjamin Franklin' },
	{
		text: 'An investment in knowledge pays the best interest.',
		ko: '지식에 대한 투자가 가장 좋은 이자를 낸다.',
		author: 'Benjamin Franklin',
	},
	{
		text: 'Inspiration exists, but it has to find you working.',
		ko: '영감은 있다. 다만 일하고 있을 때 찾아온다.',
		author: 'Pablo Picasso',
	},
	{
		text: "You can't use up creativity. The more you use, the more you have.",
		ko: '창의력은 다 써 버릴 수 없다. 쓸수록 더 많아진다.',
		author: 'Maya Angelou',
	},
	{
		text: 'Absorb what is useful, discard what is useless, add what is specifically your own.',
		ko: '쓸모 있는 것은 받아들이고, 쓸모없는 것은 버리고, 자기만의 것을 더하라.',
		author: 'Bruce Lee',
	},
	{ text: 'Quality is not an act, it is a habit.', ko: '품질은 행동이 아니라 습관이다.', author: 'Will Durant' },
	{
		text: "Real knowledge is to know the extent of one's ignorance.",
		ko: '참된 앎은 자기가 얼마나 모르는지 아는 것이다.',
		author: 'Confucius',
	},
	{
		text: 'A journey of a thousand miles begins with a single step.',
		ko: '천 리 길도 한 걸음부터.',
		author: 'Lao Tzu',
	},
	{
		text: 'No man ever steps in the same river twice.',
		ko: '누구도 같은 강물에 두 번 들어가지 못한다.',
		author: 'Heraclitus',
	},
	{
		text: 'The impediment to action advances action. What stands in the way becomes the way.',
		ko: '행동을 가로막는 것이 행동을 나아가게 한다. 길을 막는 것이 길이 된다.',
		author: 'Marcus Aurelius',
	},
	{
		text: 'Men are disturbed not by things, but by the views which they take of things.',
		ko: '사람을 괴롭히는 것은 일 자체가 아니라 그 일을 보는 생각이다.',
		author: 'Epictetus',
	},
	{ text: 'While we teach, we learn.', ko: '가르치면서 배운다.', author: 'Seneca' },
	{
		text: 'Do what you can, with what you have, where you are.',
		ko: '지금 있는 곳에서, 가진 것으로, 할 수 있는 일을 하라.',
		author: 'Theodore Roosevelt',
	},
	{
		text: 'Alone we can do so little; together we can do so much.',
		ko: '혼자서는 할 수 있는 것이 적지만, 함께라면 많은 것을 할 수 있다.',
		author: 'Helen Keller',
	},
	{
		text: 'Like what you do, and then you will do your best.',
		ko: '하는 일을 좋아하라. 그러면 최선을 다하게 된다.',
		author: 'Katherine Johnson',
	},
	{
		text: "Without data, you're just another person with an opinion.",
		ko: '데이터가 없으면 당신은 의견을 가진 또 한 사람일 뿐이다.',
		author: 'W. Edwards Deming',
	},
	{
		text: 'Plans are worthless, but planning is everything.',
		ko: '계획은 쓸모없지만, 계획하는 일은 전부다.',
		author: 'Dwight D. Eisenhower',
	},
	{ text: 'Simplicity is the soul of efficiency.', ko: '단순함은 효율의 영혼이다.', author: 'Austin Freeman' },
	{
		text: 'The most effective way to do it, is to do it.',
		ko: '가장 효과적인 방법은 그냥 하는 것이다.',
		author: 'Amelia Earhart',
	},
	{
		text: 'Strive for continuous improvement, instead of perfection.',
		ko: '완벽이 아니라 꾸준한 개선을 목표로 하라.',
		author: 'Kim Collins',
	},
	{
		text: 'Errors using inadequate data are much less than those using no data at all.',
		ko: '부족한 데이터로 생기는 오류는 데이터가 없을 때의 오류보다 훨씬 작다.',
		author: 'Charles Babbage',
	},
	{
		text: 'The art of simplicity is a puzzle of complexity.',
		ko: '단순함의 기술은 복잡함을 푸는 퍼즐이다.',
		author: 'Douglas Horton',
	},
	{
		text: 'Everything is designed. Few things are designed well.',
		ko: '모든 것은 디자인되었다. 잘 디자인된 것은 드물다.',
		author: 'Brian Reed',
	},
	{
		text: 'Styles come and go. Good design is a language, not a style.',
		ko: '스타일은 왔다 간다. 좋은 디자인은 스타일이 아니라 언어다.',
		author: 'Massimo Vignelli',
	},
	{
		text: 'Digital design is like painting, except the paint never dries.',
		ko: '디지털 디자인은 물감이 마르지 않는 그림과 같다.',
		author: 'Neville Brody',
	},
	{ text: 'Typography is what language looks like.', ko: '타이포그래피는 언어의 생김새다.', author: 'Ellen Lupton' },
	{
		text: 'White space is to be regarded as an active element, not a passive background.',
		ko: '여백은 수동적인 배경이 아니라 능동적인 요소로 봐야 한다.',
		author: 'Jan Tschichold',
	},
];

/** 날짜(YYYY-MM-DD)의 날 번호. 하루에 1씩 는다 */
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/**
 * 그날의 말: 날마다 다음 말로 넘어가 모두가 같은 날 같은 말을 본다. skip만큼 더 넘긴다 (위젯을 눌러 다음 말).
 * 날짜가 틀렸으면 첫 말
 */
export function quoteOf(day: string, skip = 0, quotes: readonly Quote[] = QUOTES): Quote {
	return quotes[quoteIndexOf(day, skip, quotes.length)];
}

/** 그날의 말의 자리 (quoteOf) */
export function quoteIndexOf(day: string, skip: number, length: number): number {
	const base = dayNumber(day);
	const index = Number.isFinite(base) ? base + skip : skip;
	return ((index % length) + length) % length;
}

/** 지금 말이 아닌 다른 말 하나를 무작위로 (위젯을 누르면). random은 0 이상 1 미만 */
export function otherQuoteIndex(current: number, length: number, random: () => number = Math.random): number {
	if (length < 2) return current;
	const pick = Math.floor(random() * (length - 1));
	return pick >= current ? pick + 1 : pick;
}

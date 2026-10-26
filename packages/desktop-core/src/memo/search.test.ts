import { describe, expect, it } from 'vitest';
import {
	matchesQuery,
	normalizeSearchText,
	parseQuery,
	rankPosts,
	searchIndexOf,
	similarPosts,
	suggestQuery,
	toInitials,
	toJamo,
	type SearchablePost,
} from './search.js';

const post = (slug: string, title: string, body = '', summary = ''): SearchablePost => ({ slug, title, body, summary });

const merge = post('merge-strategies', 'GitHub 병합 방식 세 가지', 'Squash and merge와 Rebase를 비교한다. #Git');
const frontend = post('frontend-notes', '프론트엔드 성능 메모', 'LCP를 줄인 기록. #성능');
const flux = post('flux-pattern', 'Flux 패턴', 'Dispatcher와 Store. 병합 이야기는 없다. #React');
const posts = [merge, frontend, flux];

const matches = (target: SearchablePost, query: string) => matchesQuery(target, parseQuery(query));

describe('검색용 글자', () => {
	it('대소문자·전각·공백을 하나로, 하이픈·밑줄은 공백과 같게', () => {
		expect(normalizeSearchText('  Merge-Strategies__ＡＢＣ\n\t끝 ')).toBe('merge strategies abc 끝');
	});

	it('한글을 자모와 초성으로 푼다', () => {
		expect(toJamo('엔드')).toBe('ㅇㅔㄴㄷㅡ');
		expect(toInitials('프론트엔드 A')).toBe('ㅍㄹㅌㅇㄷ A');
	});

	it('글마다 한 번만 만든다 (같은 글 객체면 같은 결과를 다시 쓴다)', () => {
		expect(searchIndexOf(merge)).toBe(searchIndexOf(merge));
		expect(searchIndexOf(merge).tags).toBe('git');
	});
});

describe('찾기', () => {
	it('여러 낱말은 모두 들어 있어야 한다 (AND). 낱말마다 칸은 달라도 된다', () => {
		expect(matches(merge, 'github squash')).toBe(true);
		expect(matches(merge, 'github lcp')).toBe(false);
	});

	it('글 주소: 하이픈과 공백, 주소 전체를 붙여 넣어도', () => {
		expect(matches(merge, 'merge-strategies')).toBe(true);
		expect(matches(merge, 'merge strategies')).toBe(true);
		expect(matches(flux, 'merge-strategies')).toBe(false); // 하이픈으로 이은 낱말은 이어진 덩어리로 찾는다
		expect(matches(merge, 'https://macfolio.hyeoniverse.com/memo/merge-strategies?x=1')).toBe(true);
	});

	it('입력 중인 마지막 글자: 받침 없는 음절과 홑자음, 다음 음절로 넘어갈 받침', () => {
		expect(matches(frontend, '프론트에')).toBe(true); // '엔'을 입력하는 중
		expect(matches(frontend, '프론트ㅇ')).toBe(true);
		expect(matches(frontend, '성느')).toBe(true); // '능'
		expect(matches(frontend, '프론틍')).toBe(true); // '트'에 ㅇ을 치면 잠깐 '틍'이 된다 (곧 '트엔')
		expect(matches(frontend, '프론튼')).toBe(false);
		expect(matches(merge, '병핣')).toBe(false);
		expect(matches(merge, '방식세')).toBe(true); // 띄어쓰기를 무시한다 ('방식 세')
		expect(matches(merge, '병합방식')).toBe(true);
		expect(matches(merge, '방싯')).toBe(false);
		expect(matches(post('a', '세 가지 방'), '방식')).toBe(false);
		expect(matches(post('a', '가기'), '각')).toBe(true); // 받침 ㄱ이 다음 음절 '기'의 초성이 된다
	});

	it('초성 검색은 두 글자 이상 초성만 쓴 낱말을 제목에서', () => {
		expect(matches(frontend, 'ㅍㄹㅌ')).toBe(true);
		expect(matches(flux, 'ㅍㄹㅌ')).toBe(false);
	});

	it('빈 검색어는 모든 글', () => {
		expect(posts.every((item) => matches(item, '  '))).toBe(true);
	});
});

describe('순서', () => {
	it('제목에서 찾은 글이 본문에서만 찾은 글보다 앞', () => {
		// '병합'은 merge의 제목, flux의 본문에 있다
		expect(rankPosts([flux, merge], '병합')).toEqual([merge, flux]);
	});

	it('제목·주소가 검색어와 같으면 맨 앞, 점수가 같으면 원래 순서', () => {
		const same = post('flux', '다른 글', 'flux 패턴을 다룬다');
		expect(rankPosts([same, flux], 'flux 패턴')[0]).toBe(flux);
		expect(rankPosts([frontend, merge], '기록 비교 없는말')).toEqual([]);
	});
});

describe('같은 용어의 다른 표기', () => {
	const docker = post('docker-deploy', 'Docker로 배포하기', '이미지를 만든다. #Docker');
	const vscode = post('vscode-extensions', 'VS Code 확장 추천', '설정을 공유한다.');
	const typescript = post('ts-types', '응답 타입 한 번만 적기', '#TypeScript #zod');
	const all = [...posts, docker, vscode, typescript];

	it('한글 음차로 영문 용어를 찾는다 (리액트 → React, 깃허브·깃헙 → GitHub)', () => {
		expect(rankPosts(all, '리액트')).toEqual([flux]);
		expect(rankPosts(all, '플럭스')).toEqual([flux]);
		expect(rankPosts(all, '깃허브')[0]).toBe(merge);
		expect(rankPosts(all, '깃헙')[0]).toBe(merge);
		expect(rankPosts(all, '도커')).toEqual([docker]);
		expect(rankPosts(all, '브이에스코드')).toEqual([vscode]);
	});

	it('입력 중인 표기도 받는다 (타입스크립 → typescript)', () => {
		expect(rankPosts(all, '타입스크립')).toEqual([typescript]);
	});

	it('원래 표기로 찾은 글이 다른 표기로 찾은 글보다 앞', () => {
		const korean = post('react-korean', '리액트 입문', '');
		const english = post('react-english', 'React 입문', '');
		expect(rankPosts([english, korean], '리액트')).toEqual([korean, english]);
	});
});

describe('결과가 없을 때', () => {
	it('제목·주소·태그와 자모 단위로 비슷한 글', () => {
		expect(similarPosts(posts, '프런트엔드')).toEqual([frontend]); // '론'을 '런'으로
		expect(similarPosts(posts, 'flix pattern')).toEqual([flux]);
		expect(similarPosts(posts, '전혀 다른 검색어')).toEqual([]);
	});

	it('너무 짧은 검색어는 추천하지 않는다', () => {
		expect(similarPosts(posts, 'fl')).toEqual([]);
	});

	it('어느 글에도 없는 낱말만 가장 가까운 낱말로 고친 검색어. 고칠 것이 없으면 null', () => {
		expect(suggestQuery(posts, '프런트엔드 성능')).toBe('프론트엔드 성능');
		expect(suggestQuery(posts, 'flux patern')).toBe('flux pattern');
		expect(suggestQuery(posts, 'flux')).toBeNull();
		expect(suggestQuery(posts, 'qwertyuiop')).toBeNull();
	});

	const docker = post('docker-deploy', 'Docker로 배포하기', '이미지를 만든다. #Docker');
	const vscode = post('vscode-extensions', 'VS Code 확장 추천', '설정을 공유한다.');
	const all = [...posts, docker, vscode];

	it('한글 음차의 오타는 가까운 표기로 고치고, 그 표기의 영문으로 비슷한 글을 찾는다 (리엑트 → 리액트 → React)', () => {
		expect(rankPosts(all, '리엑트')).toEqual([]);
		expect(suggestQuery(all, '리엑트')).toBe('리액트');
		expect(similarPosts(all, '리엑트')).toEqual([flux]);
	});

	it('이웃한 두 글자를 맞바꾼 오타는 한 번 고친 것으로 본다 (dokcer → docker, fulx → flux)', () => {
		expect(suggestQuery(all, 'dokcer')).toBe('docker');
		expect(similarPosts(all, 'dokcer')).toEqual([docker]);
		expect(suggestQuery(all, 'fulx')).toBe('flux');
		expect(similarPosts(all, 'fulx')).toEqual([flux]);
	});

	it('붙여 쓴 검색어의 오타는 이웃한 낱말을 이은 것과 비교한다 (프론트엔드셩능 → 프론트엔드 성능, 확장프로그렘 → 확장프로그램)', () => {
		expect(rankPosts(all, '프론트엔드셩능')).toEqual([]);
		expect(suggestQuery(all, '프론트엔드셩능')).toBe('프론트엔드 성능');
		expect(suggestQuery(all, '확장프로그렘')).toBe('확장프로그램');
		expect(rankPosts(all, '확장프로그램')).toEqual([vscode]);
	});
});

describe('성능', () => {
	it('글 240편(본문 8,600자씩)에서 검색어를 한 글자씩 칠 때 한 번에 평균 5ms 안 (검색용 글자는 처음 한 번만 만든다)', () => {
		const words = ['메모', '검색', '성능', 'react', 'store', '프론트엔드', '배포', '서버', 'merge', '위젯'];
		const many = Array.from({ length: 240 }, (_, i) =>
			post(
				`post-${i}`,
				`글 ${i} ${words[i % words.length]}`,
				Array.from({ length: 1400 }, (_, j) => words[(i * 7 + j) % words.length]).join(' ')
			)
		);
		const typed = [
			'프',
			'프론',
			'프론트',
			'프론트엔',
			'프론트엔드',
			'프론트엔드 성',
			'프론트엔드 성능',
			'merge s',
			'리액',
			'리액트',
			'타입스크립',
			'없는말',
		];
		for (const query of typed) rankPosts(many, query); // 검색용 글자를 만든다
		const start = Date.now();
		for (let round = 0; round < 10; round++) for (const query of typed) rankPosts(many, query);
		const average = (Date.now() - start) / (10 * typed.length);
		expect(average).toBeLessThan(5);
	});
});

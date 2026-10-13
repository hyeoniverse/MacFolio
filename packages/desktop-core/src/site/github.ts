// 프로젝트의 GitHub 저장소: 주소에서 owner와 이름을 읽고, 코드의 프로젝트가 가리키는 저장소 목록을 둔다.
// API는 이 목록과 관리자가 저장한 프로젝트 주소에 있는 저장소의 언어만 GitHub에 대신 묻는다 (아무 저장소나 묻는 통로가 되지 않게).
// 화면(apps/react)의 시험이 코드의 프로젝트(DEFAULT_PROJECTS) 주소가 모두 이 목록에 있는지 확인한다

// URL은 브라우저와 Node 모두에 있다. 이 패키지는 DOM 타입을 넣지 않으므로 쓰는 만큼만 적는다
declare const URL: new (input: string) => { protocol: string; hostname: string; pathname: string };

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/** GitHub 저장소 주소(https://github.com/owner/name, .git이나 뒤의 경로가 붙어도 된다)의 owner와 이름. 아니면 null */
export function githubRepoOf(url: string | null | undefined): { owner: string; name: string } | null {
	if (!url) return null;
	let parsed: { protocol: string; hostname: string; pathname: string };
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const host = parsed.hostname.toLowerCase();
	if (parsed.protocol !== 'https:' || (host !== 'github.com' && host !== 'www.github.com')) return null;
	const [owner, raw] = parsed.pathname.split('/').filter(Boolean);
	if (!owner || !raw) return null;
	const name = raw.replace(/\.git$/i, '');
	if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') return null;
	return { owner, name };
}

/** 코드의 프로젝트(apps/react/src/shared/profile.ts의 DEFAULT_PROJECTS)가 가리키는 저장소 (owner/이름) */
export const CODE_PROJECT_REPOS: readonly string[] = [
	'hyeoniverse/web-portfolio-hyeoniverse',
	'hyeoniverse/MacFolio',
	'Devcourse-NewPick/front',
	'hyeoniverse/QRU',
	'Devcourse-WhatToDo/todo-front',
	'hyeoniverse/SproutFarm',
	'hyeoniverse/DevCourse-FullStack',
];

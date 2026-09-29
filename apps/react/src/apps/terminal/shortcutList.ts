// 모바일 '단축어'의 목록. 각 단축어는 터미널 명령 하나를 실행한다 (commands.ts).

export interface Shortcut {
	/** 실행할 터미널 명령 */
	command: string;
	title: string;
	/** Font Awesome 아이콘 클래스 */
	icon: string;
	/** 타일 그라데이션 (위 → 아래) */
	colors: [string, string];
}

export const SHORTCUTS: Shortcut[] = [
	{ command: 'whoami', title: '자기소개', icon: 'fa-solid fa-user', colors: ['#5e9bff', '#3867e0'] },
	{ command: 'skills', title: '기술 스택', icon: 'fa-solid fa-code', colors: ['#ffac4a', '#f07b1e'] },
	{ command: 'projects', title: '프로젝트', icon: 'fa-solid fa-folder-open', colors: ['#4fd67a', '#1fa651'] },
	{ command: 'contact', title: '연락처', icon: 'fa-solid fa-address-card', colors: ['#3fd0d4', '#1597a8'] },
	{ command: 'neofetch', title: '이 사이트', icon: 'fa-solid fa-mobile-screen', colors: ['#b27cff', '#7c4ddb'] },
	{ command: 'date', title: '지금 몇 시?', icon: 'fa-solid fa-clock', colors: ['#ff7a8a', '#e0435a'] },
];

/** 프로젝트 목록 줄의 번호("1.")로 그 프로젝트를 자세히 보는 명령을 만든다 */
export const projectCommand = (marker: string) => `project ${Number.parseInt(marker, 10)}`;

/** 값이 "open messages"처럼 명령이면 누를 수 있게 그 명령을 돌려준다 */
export const commandInValue = (value: string) => (/^open \S+$/.test(value) ? value : null);

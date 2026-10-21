import { describe, expect, it } from 'vitest';
import { complete, formatDate, parse, runCommand, toBlocks, type CommandContext, type Line } from './commands';
import { commandInValue, projectCommand, SHORTCUTS } from './shortcutList';
import { PROJECTS } from '@/shared/profile';
import { DEFAULT_RESUME, setSiteResume } from '@/shared/site/resumeStore';
import { parseResume } from '@/apps/finder/resumeModel';

const context: CommandContext = {
	history: ['whoami', 'skills'],
	now: new Date(2026, 8, 28, 9, 5, 7),
	apps: [
		{ name: 'memo', label: '메모' },
		{ name: 'messages', label: '메시지' },
		{ name: 'mail', label: '메일' },
	],
};

/** 줄을 비교하기 쉬운 글자로 */
const texts = (lines: Line[]) =>
	lines.map((line) => {
		if (line.kind === 'link') return line.href;
		if (line.kind === 'pair') return `${line.key}: ${line.value}`;
		if (line.kind === 'item') return `${line.marker} ${line.title}`;
		return line.text;
	});

describe('parse', () => {
	it('공백으로 명령과 인자를 나눈다', () => {
		expect(parse('  open   memo ')).toEqual({ name: 'open', args: ['memo'] });
		expect(parse('')).toEqual({ name: '', args: [] });
	});
});

describe('runCommand', () => {
	it('resume는 이력서 Markdown(저장한 것, 없으면 기본)을 고양이 그림과 함께 짧은 줄로 그린다', () => {
		const resume = parseResume(DEFAULT_RESUME);
		const result = runCommand('resume', context);
		const lines = texts(result.lines);
		expect(result.lines[0]).toMatchObject({ kind: 'art' });
		expect(lines).toContain(`${resume.name} · ${resume.role}`);
		expect(lines).toContain(`“${resume.motto}”`);
		// 절마다 제목 줄
		for (const section of resume.sections) expect(lines).toContain(`── ${section.title} ──`);
		// 강점 카드는 ★, 날짜 줄은 날짜: 제목
		expect(lines).toContain(
			'★ 끝까지 운영: 기획·디자인부터 서버·배포까지 1인 개발한 서비스 2개를 실제 도메인에서 운영'
		);
		expect(lines).toContain('2024.06: 정보처리기사 · 한국산업인력공단');
		// 프로젝트: projects 목록에 있으면 그 번호 (project <번호>로 이어서 본다), 성과는 제목만 설명 아래 줄로
		const macfolio = result.lines.find((line) => line.kind === 'item' && line.title === 'MacFolio');
		const index = PROJECTS.findIndex((project) => project.id === 'macfolio');
		expect(macfolio).toMatchObject({ marker: `${index + 1}.`, tag: '2024.10 –' });
		expect(macfolio?.kind === 'item' && macfolio.detail).toContain('\n✓ 창 관리와 반응형 셸');
		expect(result.effects).toEqual([]);
	});

	it('resume는 관리자가 고친 이력서를 그대로 그린다 (규칙에 맞지 않는 절도 글로)', () => {
		setSiteResume({
			markdown: '# 홍길동\n\n## 자기소개\n끝까지 만드는 사람입니다.\n\n## 프로젝트\n\n### 새 프로젝트 | 2026\n\n설명',
		});
		try {
			const lines = texts(runCommand('resume', context).lines);
			expect(lines).toContain('홍길동');
			expect(lines).toContain('끝까지 만드는 사람입니다.');
			expect(lines).toContain('• 새 프로젝트');
		} finally {
			setSiteResume(null);
		}
	});

	it('resume의 그림은 한 칸 폭 글자만 쓴다 (한글 등 두 칸 글자가 끼면 줄이 어긋난다)', () => {
		const art = runCommand('resume', context).lines.flatMap((line) => (line.kind === 'art' ? [line.text] : []));
		for (const block of art) expect(block).not.toMatch(/[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/);
	});

	it('빈 입력은 아무것도 하지 않는다', () => {
		expect(runCommand('   ', context)).toEqual({ lines: [], effects: [] });
	});

	it('없는 명령은 zsh처럼 알려준다', () => {
		const { lines } = runCommand('ls', context);
		expect(lines[0]).toEqual({ kind: 'error', text: 'zsh: command not found: ls' });
	});

	it('Object 기본 속성 이름(toString 등)을 명령으로 착각하지 않는다', () => {
		expect(runCommand('toString', context).lines[0].kind).toBe('error');
	});

	it('help는 숨긴 명령(sudo)을 빼고 보여준다', () => {
		const output = texts(runCommand('help', context).lines).join('\n');
		expect(output).toContain('whoami: 저를 소개합니다');
		expect(output).toContain('open <앱>: 앱 열기');
		expect(output).not.toContain('sudo');
	});

	it('projects는 번호 목록, project <번호>는 자세히와 저장소 링크', () => {
		expect(runCommand('projects', context).lines[0]).toEqual({
			kind: 'item',
			marker: '1.',
			title: PROJECTS[0].name,
			detail: PROJECTS[0].description,
			tag: PROJECTS[0].language,
		});
		const detail = runCommand('project 1', context).lines;
		expect(detail.at(-1)).toEqual({ kind: 'pair', key: '저장소', value: PROJECTS[0].url, href: PROJECTS[0].url });
		expect(runCommand('project 99', context).lines[0].kind).toBe('error');
	});

	it('open은 앱 이름이나 한글 이름으로 열고, 없으면 열 수 있는 앱을 알려준다', () => {
		expect(runCommand('open memo', context).effects).toEqual([{ type: 'open-app', app: 'memo' }]);
		expect(runCommand('open 메시지', context).effects).toEqual([{ type: 'open-app', app: 'messages' }]);
		const missing = runCommand('open photoshop', context);
		expect(missing.effects).toEqual([]);
		expect(texts(missing.lines).join('\n')).toContain('memo, messages, mail');
	});

	it('contact는 GitHub과 이메일 링크를 보여준다', () => {
		const hrefs = runCommand('contact', context).lines.flatMap((line) =>
			line.kind === 'pair' && line.href ? [line.href] : []
		);
		expect(hrefs).toEqual(['https://github.com/hyeoniverse', 'mailto:hyeoniverse.dev@gmail.com']);
	});

	it('clear, exit은 효과만 돌려준다', () => {
		expect(runCommand('clear', context)).toEqual({ lines: [], effects: [{ type: 'clear' }] });
		expect(runCommand('exit', context).effects).toEqual([{ type: 'close' }]);
	});

	it('history와 echo', () => {
		expect(texts(runCommand('history', context).lines)).toEqual(['1 whoami', '2 skills']);
		expect(texts(runCommand('echo  안녕  하세요', context).lines)).toEqual(['안녕 하세요']);
	});
});

describe('formatDate', () => {
	it('한국식 날짜와 24시간 시각', () => {
		expect(formatDate(context.now)).toBe('2026년 9월 28일 (월) 09:05:07');
	});
});

describe('complete', () => {
	it('후보가 하나면 완성하고 공백을 붙인다', () => {
		expect(complete('who', context)).toEqual({ value: 'whoami ', candidates: [] });
		expect(complete('open mem', context)).toEqual({ value: 'open memo ', candidates: [] });
	});

	it('후보가 여럿이면 공통 앞부분까지 채우고 후보를 돌려준다', () => {
		expect(complete('open me', context)).toEqual({ value: 'open me', candidates: ['memo', 'messages'] });
		expect(complete('open m', context)).toEqual({ value: 'open m', candidates: ['memo', 'messages', 'mail'] });
		expect(complete('pro', context)).toEqual({ value: 'project', candidates: ['projects', 'project'] });
	});

	it('project 뒤는 번호를 완성한다', () => {
		expect(complete('project ', context).candidates).toEqual(PROJECTS.map((_, i) => String(i + 1)));
	});

	it('후보가 없으면 그대로', () => {
		expect(complete('zzz', context)).toEqual({ value: 'zzz', candidates: [] });
		expect(complete('echo hi', context)).toEqual({ value: 'echo hi', candidates: [] });
	});
});

describe('toBlocks', () => {
	it('연속된 pair와 item을 각각 한 묶음으로 모은다', () => {
		const lines: Line[] = [
			{ kind: 'heading', text: '제목' },
			{ kind: 'pair', key: 'a', value: '1' },
			{ kind: 'pair', key: 'b', value: '2' },
			{ kind: 'item', marker: '1.', title: 'x' },
			{ kind: 'text', text: '끝' },
			{ kind: 'pair', key: 'c', value: '3' },
		];
		expect(toBlocks(lines).map((block) => (block.type === 'line' ? block.line.kind : block.type))).toEqual([
			'heading',
			'pairs',
			'items',
			'text',
			'pairs',
		]);
	});
});

describe('SHORTCUTS', () => {
	it('모든 단축어는 있는 명령을 실행한다', () => {
		for (const shortcut of SHORTCUTS) {
			expect(runCommand(shortcut.command, context).lines[0]?.kind).not.toBe('error');
		}
	});

	it('프로젝트 번호로 자세히 보기 명령을 만든다', () => {
		expect(projectCommand('2.')).toBe('project 2');
		expect(runCommand(projectCommand('1.'), context).lines[0]).toEqual({ kind: 'heading', text: PROJECTS[0].name });
	});

	it('값이 open 명령일 때만 누를 수 있다', () => {
		expect(commandInValue('open messages')).toBe('open messages');
		expect(commandInValue('hyeoniverse.dev@gmail.com')).toBeNull();
	});
});

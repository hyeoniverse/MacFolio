import { describe, expect, it } from 'vitest';
import { complete, formatDate, parse, runCommand, type CommandContext, type Line } from './commands';
import { PROJECTS } from '@/shared/profile';

const context: CommandContext = {
	history: ['whoami', 'skills'],
	now: new Date(2026, 8, 28, 9, 5, 7),
	apps: [
		{ name: 'memo', label: '메모' },
		{ name: 'messages', label: '메시지' },
		{ name: 'mail', label: '메일' },
	],
};

const texts = (lines: Line[]) => lines.map((line) => (line.kind === 'link' ? line.href : line.text));

describe('parse', () => {
	it('공백으로 명령과 인자를 나눈다', () => {
		expect(parse('  open   memo ')).toEqual({ name: 'open', args: ['memo'] });
		expect(parse('')).toEqual({ name: '', args: [] });
	});
});

describe('runCommand', () => {
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
		expect(output).toContain('whoami');
		expect(output).toContain('open <앱>');
		expect(output).not.toContain('sudo');
	});

	it('projects는 번호 목록, project <번호>는 자세히와 링크', () => {
		expect(texts(runCommand('projects', context).lines)[0]).toMatch(/^1\. /);
		const detail = runCommand('project 1', context).lines;
		expect(detail.at(-1)).toEqual({ kind: 'link', label: PROJECTS[0].url, href: PROJECTS[0].url });
		expect(runCommand('project 99', context).lines[0].kind).toBe('error');
	});

	it('open은 앱 이름이나 한글 이름으로 열고, 없으면 열 수 있는 앱을 알려준다', () => {
		expect(runCommand('open memo', context).effects).toEqual([{ type: 'open-app', app: 'memo' }]);
		expect(runCommand('open 메시지', context).effects).toEqual([{ type: 'open-app', app: 'messages' }]);
		const missing = runCommand('open photoshop', context);
		expect(missing.effects).toEqual([]);
		expect(texts(missing.lines).join('\n')).toContain('memo, messages, mail');
	});

	it('clear, exit은 효과만 돌려준다', () => {
		expect(runCommand('clear', context)).toEqual({ lines: [], effects: [{ type: 'clear' }] });
		expect(runCommand('exit', context).effects).toEqual([{ type: 'close' }]);
	});

	it('history와 echo', () => {
		expect(texts(runCommand('history', context).lines)).toEqual(['   1  whoami', '   2  skills']);
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

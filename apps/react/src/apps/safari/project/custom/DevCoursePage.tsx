// 직접 짠 페이지: devcourse 전용 (처음부터 이 프로젝트를 위해 짠 페이지. custom/index.ts에 등록돼 있고 look이 custom이면 이걸로 그린다)
// DevCourse (학습 기록): 페이지 전체가 터미널 화면 하나(창 테두리 없이). 소개 아래에는 프롬프트만 있고,
// 숫자·주차별 기록·실습 프로젝트·컨벤션·만든 방식·맡은 일·기술 사양은 명령을 쳐야 나온다.
// 실제 저장소(DevCourse-FullStack)도 ls·cd·tree·cat으로 돌아볼 수 있다: 날짜별 강의 노트와 실습 코드는 페이지에 없는 내용이다.
// 명령은 고정폭 글꼴, 결과의 한글 문장은 읽기 쉬운 본문 글꼴로 쓴다
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import {
	completePath,
	entries as listDir,
	isDir,
	loadRepo,
	nodeAt,
	resolve,
	treeLines,
	type RepoDir,
} from '@/apps/safari/project/terminalRepo';
import '@/apps/safari/project/custom/DevCoursePage.css';

/** 저장소 이름 (프롬프트의 맨 위 폴더) */
const REPO = 'DevCourse-FullStack';

/** 프롬프트 한 줄. path는 저장소 안의 폴더, home이면 저장소 밖(~) */
const Prompt: React.FC<{ command?: string; path?: string[]; home?: boolean; children?: React.ReactNode }> = ({
	command,
	path = [],
	home = false,
	children,
}) => (
	<p className="tm-prompt">
		<span className="tm-user">hyeoniverse@devcourse</span>
		<span className="tm-path">{home ? '~' : ['~', REPO, ...path].join('/')}</span>
		<span className="tm-dollar">$</span> {command !== undefined ? <code>{command}</code> : children}
	</p>
);

/** 폴더 이름처럼 (빈칸은 -) */
const slug = (value: string) => value.replace(/\s+/g, '-');

/* ─── 명령마다의 결과 (미리 쳐 둔 세션과 직접 친 명령이 같이 쓴다) ─── */

const About: React.FC<{ project: Project }> = ({ project }) => (
	<>
		<p className="tm-heading"># {project.name}</p>
		<p className="tm-title">{project.tagline}</p>
		<p className="tm-out">{project.description}</p>
	</>
);

const Stat: React.FC<{ project: Project }> = ({ project }) => (
	<dl className="tm-pairs">
		<div>
			<dt>context</dt>
			<dd>{project.context}</dd>
		</div>
		{project.period && (
			<div>
				<dt>period</dt>
				<dd>{project.period}</dd>
			</div>
		)}
		{project.facts.map((fact) => (
			<div key={fact.label}>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

const Weeks: React.FC<{ project: Project }> = ({ project }) => (
	<ol className="tm-weeks">
		{project.timeline?.map((step) => (
			<li key={step.date}>
				<span className="tm-week">{step.date}</span>
				<span>{step.label}</span>
			</li>
		))}
	</ol>
);

const ProjectsList: React.FC<{ project: Project }> = ({ project }) => (
	<ul className="tm-ls">
		{project.highlights.map((point) => (
			<li key={point.title}>
				<span className="tm-dir">{slug(point.title)}/</span>
				<p>{point.body}</p>
			</li>
		))}
	</ul>
);

const Types: React.FC<{ project: Project }> = ({ project }) => (
	<ul className="tm-types">
		{project.conventions?.map((convention) => (
			<li key={convention.type}>
				<code>{convention.type}</code>
				<span>{convention.description}</span>
			</li>
		))}
	</ul>
);

const Build: React.FC<{ project: Project }> = ({ project }) => (
	<>
		{project.build.map((point) => (
			<div key={point.title} className="tm-md">
				<p className="tm-heading">## {point.title}</p>
				<p className="tm-out">{point.body}</p>
			</div>
		))}
	</>
);

const Contributions: React.FC<{ project: Project }> = ({ project }) => (
	<ul className="tm-list">
		{project.contributions.map((item) => (
			<li key={item}>{item}</li>
		))}
	</ul>
);

const Stack: React.FC<{ project: Project }> = ({ project }) => (
	<pre className="tm-json">
		{'{\n'}
		{project.specs.map((spec, i) => (
			<React.Fragment key={spec.label}>
				{'  '}
				<span className="tm-key">"{spec.label}"</span>
				{': '}
				<span className="tm-string">"{spec.value}"</span>
				{i < project.specs.length - 1 ? ',\n' : '\n'}
			</React.Fragment>
		))}
		{'}'}
	</pre>
);

/* ─── 직접 치는 명령 ─── */

/** 페이지 내용을 보여 주는 명령: 결과 구역의 이름(보조 기술·시험이 찾는 이름)과 함께 */
type PageCommand = {
	name: string;
	aliases: string[];
	help: string;
	label: string;
	run: React.FC<{ project: Project }>;
};

const PAGE_COMMANDS: PageCommand[] = [
	{ name: 'cat ABOUT.md', aliases: ['about'], help: '이 저장소 소개', label: '소개', run: About },
	{ name: 'stat .', aliases: ['stat', 'info'], help: '기간과 숫자', label: '한눈에 보기', run: Stat },
	{
		name: 'git log --by-week',
		aliases: ['git log', 'log', 'weeks'],
		help: '주차별 기록',
		label: '진행 과정',
		run: Weeks,
	},
	{
		name: 'projects',
		aliases: ['ls projects --long'],
		help: '직접 만든 실습 프로젝트',
		label: '주요 기능',
		run: ProjectsList,
	},
	{ name: 'git types', aliases: ['types', 'conventions'], help: '커밋 타입 컨벤션', label: '커밋 컨벤션', run: Types },
	{ name: 'cat BUILD.md', aliases: ['build'], help: '만든 방식', label: '만든 방식', run: Build },
	{ name: 'whoami', aliases: ['me'], help: '맡은 일', label: '맡은 일', run: Contributions },
	{ name: 'cat stack.json', aliases: ['stack'], help: '기술 사양', label: '기술 사양', run: Stack },
];

/** 저장소를 돌아보는 명령과 그 밖의 명령 (help에 보이는 순서) */
const SHELL_COMMANDS: { name: string; help: string }[] = [
	{ name: 'ls', help: '폴더 안 보기 (ls Week02)' },
	{ name: 'cd', help: '폴더로 들어가기 (cd Week02/03, cd ..)' },
	{ name: 'tree', help: '폴더 구조를 두 단계까지' },
	{ name: 'cat', help: '파일 읽기 (cat Readme.md)' },
	{ name: 'pwd', help: '지금 폴더' },
	{ name: 'open', help: '저장소 링크' },
	{ name: 'history', help: '친 명령 목록' },
	{ name: 'clear', help: '화면 지우기 (Ctrl+L)' },
];

/** 맨 위 폴더에만 보이는, 페이지 내용을 담은 파일 */
const PAGE_FILES: Record<string, string> = {
	'ABOUT.md': 'cat ABOUT.md',
	'BUILD.md': 'cat BUILD.md',
	'stack.json': 'cat stack.json',
};

/** 대소문자와 빈칸 수를 가리지 않는다 */
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const findPage = (input: string) => {
	const key = normalize(input);
	return PAGE_COMMANDS.find((command) => [command.name, ...command.aliases].some((name) => normalize(name) === key));
};

const COMMAND_NAMES = [...PAGE_COMMANDS.map((command) => command.name), 'help', ...SHELL_COMMANDS.map((c) => c.name)];

/** 칩으로 보여 주는 첫걸음 */
const SUGGESTED = ['help', 'stat .', 'projects', 'ls', 'cd Week02', 'cat Readme.md', 'whoami', 'cat stack.json'];

/** 명령 하나의 결과 */
type Output =
	| { kind: 'page'; command: PageCommand }
	| { kind: 'help' }
	| { kind: 'list'; path: string[]; items: { name: string; dir: boolean }[] }
	| { kind: 'tree'; lines: string[] }
	| { kind: 'file'; name: string; text: string | null }
	| { kind: 'text'; text: string }
	| { kind: 'error'; text: string }
	| { kind: 'links' }
	| { kind: 'history'; past: string[] }
	| { kind: 'none' };

/** 친 명령 하나: 친 자리(cwd)와 결과 */
type Entry = { id: number; input: string; cwd: string[]; output: Output };

/** 저장소가 필요 없는 명령의 결과 */
function runSimple(text: string, cwd: string[], past: string[]): Output | null {
	const page = findPage(text);
	if (page) return { kind: 'page', command: page };
	const [name] = normalize(text).split(' ');
	if (name === 'help' || name === '?' || name === 'man') return { kind: 'help' };
	if (name === 'open') return { kind: 'links' };
	if (name === 'pwd') return { kind: 'text', text: ['~', REPO, ...cwd].join('/') };
	if (name === 'history') return { kind: 'history', past };
	if (name === 'date') return { kind: 'text', text: new Date().toLocaleString('ko-KR') };
	if (name === 'sudo') return { kind: 'error', text: '이 터미널에서는 sudo를 쓸 수 없습니다' };
	return null;
}

/** 저장소를 돌아보는 명령의 결과와 옮겨 간 폴더 */
function runRepo(repo: RepoDir, text: string, cwd: string[]): { output: Output; cwd: string[] } {
	const [name, ...rest] = text.trim().split(/\s+/);
	const arg = rest.join(' ');
	const command = name.toLowerCase();
	const where = arg ? resolve(repo, cwd, arg) : cwd;
	const missing = { kind: 'error', text: `${command}: ${arg}: 그런 파일이나 폴더가 없습니다` } as const;
	const listOf = (path: string[]): Output => {
		const dir = nodeAt(repo, path);
		const items = isDir(dir) ? listDir(dir) : [];
		// 맨 위에는 페이지 내용을 담은 파일도 보인다
		const extra = path.length === 0 ? Object.keys(PAGE_FILES).map((file) => ({ name: file, dir: false })) : [];
		return { kind: 'list', path, items: [...items, ...extra] };
	};
	switch (command) {
		case 'ls': {
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (!isDir(node)) return { output: { kind: 'text', text: where[where.length - 1] }, cwd };
			return { output: listOf(where), cwd };
		}
		case 'cd': {
			const next = arg ? where : [];
			if (!next) return { output: missing, cwd };
			if (!isDir(nodeAt(repo, next))) return { output: { kind: 'error', text: `cd: ${arg}: 폴더가 아닙니다` }, cwd };
			// 들어간 폴더의 내용을 바로 보여 준다 (cd 하고 ls 한 것처럼)
			return { output: listOf(next), cwd: next };
		}
		case 'tree': {
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (!isDir(node)) return { output: missing, cwd };
			return { output: { kind: 'tree', lines: ['.', ...treeLines(node, 2)] }, cwd };
		}
		case 'cat':
		case 'head':
		case 'less': {
			if (!arg) return { output: { kind: 'error', text: `${command}: 읽을 파일 이름을 넣어 주세요` }, cwd };
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (isDir(node)) return { output: { kind: 'error', text: `${command}: ${arg}: 폴더입니다` }, cwd };
			return { output: { kind: 'file', name: where[where.length - 1], text: node ?? null }, cwd };
		}
		default:
			return { output: { kind: 'error', text: `zsh: command not found: ${name}` }, cwd };
	}
}

/** 글 파일: 마크다운 제목 줄은 색을 달리한다 */
const FileView: React.FC<{ name: string; text: string | null }> = ({ name, text }) =>
	text === null ? (
		<p className="tm-muted">{name}: 그림 같은 파일이라 여기서는 열지 않습니다</p>
	) : (
		<pre className="tm-file">
			{text.split('\n').map((line, i) => (
				<span key={i} className={/^#{1,6} /.test(line) ? 'tm-heading' : undefined}>
					{line}
					{'\n'}
				</span>
			))}
		</pre>
	);

const Shell: React.FC<{ project: Project }> = ({ project }) => {
	const [entries, setEntries] = useState<Entry[]>(() => [{ id: 0, input: 'help', cwd: [], output: { kind: 'help' } }]);
	const [cwd, setCwd] = useState<string[]>([]);
	const [repo, setRepo] = useState<RepoDir | null>(null);
	const [failed, setFailed] = useState(false);
	const [value, setText] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	// 위·아래 화살표로 고르고 있는 이전 명령 (없으면 null)
	const [cursor, setCursor] = useState<number | null>(null);
	const [typing, setTyping] = useState(false);
	// 커서가 서 있는 글자 자리, 입력칸에 커서가 있는지
	const [caret, setCaret] = useState(0);
	const [focused, setFocused] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const end = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	// 저장소를 기다리는 동안 친 명령 (불러오면 이어서 실행)
	const waiting = useRef<{ text: string; past: string[] }[]>([]);

	/** 글을 통째로 바꿀 때(이전 명령, Tab, 칩)는 커서를 끝으로 */
	const setValue = (text: string) => {
		setText(text);
		setCaret(text.length);
	};

	// 저장소는 페이지를 열면 바로 받아 둔다
	useEffect(() => {
		let alive = true;
		loadRepo()
			.then((data) => alive && setRepo(data))
			.catch(() => alive && setFailed(true));
		return () => {
			alive = false;
		};
	}, []);

	const push = (input: string, at: string[], output: Output) => {
		nextId.current += 1;
		setEntries((prev) => [...prev, { id: nextId.current, input, cwd: at, output }]);
	};

	const execute = (text: string, past: string[], data: RepoDir | null) => {
		const simple = runSimple(text, cwd, past);
		if (simple) return push(text, cwd, simple);
		if (!data) {
			if (failed) return push(text, cwd, { kind: 'error', text: '저장소를 불러오지 못했습니다' });
			waiting.current.push({ text, past });
			return push(text, cwd, { kind: 'text', text: '저장소를 불러오는 중…' });
		}
		const result = runRepo(data, text, cwd);
		push(text, cwd, result.output);
		setCwd(result.cwd);
	};

	// 저장소를 기다리던 명령은 불러온 뒤 다시 실행한다
	useEffect(() => {
		if (!repo || waiting.current.length === 0) return;
		const queued = waiting.current;
		waiting.current = [];
		setEntries((prev) =>
			prev.filter((entry) => !(entry.output.kind === 'text' && entry.output.text === '저장소를 불러오는 중…'))
		);
		let at = cwd;
		for (const { text } of queued) {
			const result = runRepo(repo, text, at);
			nextId.current += 1;
			const id = nextId.current;
			const from = at;
			setEntries((prev) => [...prev, { id, input: text, cwd: from, output: result.output }]);
			at = result.cwd;
		}
		setCwd(at);
		// cwd는 기다리던 명령을 친 자리라 다시 돌리지 않는다
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [repo]);

	const run = (raw: string) => {
		const text = raw.trim();
		setValue('');
		setCursor(null);
		if (!text) return;
		const past = [...history, text];
		setHistory(past);
		if (['clear', 'cls'].includes(normalize(text))) {
			setEntries([]);
			return;
		}
		execute(text, past, repo);
	};

	// 새 결과가 나오면 프롬프트가 보이게 내린다
	useEffect(() => {
		if (entries.length > 1) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [entries]);

	// 칩·목록을 누르면 한 글자씩 쳐서 실행한다
	const type = (text: string) => {
		if (typing) return;
		setTyping(true);
		input.current?.focus({ preventScroll: true });
		let i = 0;
		const timer = window.setInterval(() => {
			i += 1;
			setValue(text.slice(0, i));
			if (i >= text.length) {
				window.clearInterval(timer);
				window.setTimeout(() => {
					run(text);
					setTyping(false);
				}, 140);
			}
		}, 35);
	};

	/** Tab: 첫 낱말은 명령, 그 뒤는 저장소 경로를 채운다 */
	const fill = (text: string) => {
		const space = text.indexOf(' ');
		if (space < 0) {
			const key = text.toLowerCase();
			const match = COMMAND_NAMES.find((name) => name.toLowerCase().startsWith(key));
			return match ?? text;
		}
		if (!repo) return text;
		const command = text.slice(0, space + 1);
		return command + completePath(repo, cwd, text.slice(space + 1).trimStart());
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Tab') {
			const filled = fill(value);
			if (filled !== value) {
				event.preventDefault();
				setValue(filled);
			}
		} else if (event.key === 'ArrowUp' && history.length) {
			event.preventDefault();
			const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
			setCursor(next);
			setValue(history[next]);
		} else if (event.key === 'ArrowDown' && cursor !== null) {
			event.preventDefault();
			const next = cursor + 1;
			setCursor(next >= history.length ? null : next);
			setValue(next >= history.length ? '' : history[next]);
		} else if (event.key === 'l' && event.ctrlKey) {
			event.preventDefault();
			setEntries([]);
		}
	};

	/** 목록의 이름: 폴더는 들어가고 파일은 읽는다 (컴포넌트로 두면 다시 그릴 때마다 단추가 갈려 누른 것이 사라진다) */
	const item = (name: string, dir: boolean, path: string[]) => {
		const page = path.length === 0 ? PAGE_FILES[name] : undefined;
		const relative = [...path.slice(cwd.length), name].join('/');
		const command = page ?? (dir ? `cd ${relative}` : `cat ${relative}`);
		return (
			<button type="button" className={dir ? 'tm-dir' : 'tm-name'} onClick={() => type(command)} disabled={typing}>
				{name}
				{dir ? '/' : ''}
			</button>
		);
	};

	const output = (entry: Entry) => {
		const out = entry.output;
		switch (out.kind) {
			case 'page':
				return <out.command.run project={project} />;
			case 'help':
				return (
					<div className="tm-help">
						<p className="tm-comment"># 이 과정에서 한 일</p>
						<ul>
							{PAGE_COMMANDS.map((item) => (
								<li key={item.name}>
									<button type="button" onClick={() => type(item.name)} disabled={typing}>
										{item.name}
									</button>
									<span>{item.help}</span>
								</li>
							))}
						</ul>
						<p className="tm-comment"># 저장소 돌아보기: 날짜별 강의 노트와 실습 코드</p>
						<ul>
							{SHELL_COMMANDS.map((item) => (
								<li key={item.name}>
									<button type="button" onClick={() => type(item.name)} disabled={typing}>
										{item.name}
									</button>
									<span>{item.help}</span>
								</li>
							))}
						</ul>
					</div>
				);
			case 'list':
				return out.items.length ? (
					<ul className="tm-names">
						{out.items.map((each) => (
							<li key={each.name}>{item(each.name, each.dir, out.path)}</li>
						))}
					</ul>
				) : (
					<p className="tm-muted">(비어 있음)</p>
				);
			case 'tree':
				return <pre className="tm-file">{out.lines.join('\n')}</pre>;
			case 'file':
				return <FileView name={out.name} text={out.text} />;
			case 'text':
				return <p className="tm-out">{out.text}</p>;
			case 'error':
				return (
					<p className="tm-error">
						{out.text} — <span className="tm-hint">help</span>를 쳐 보세요
					</p>
				);
			case 'links':
				return <Links project={project} className="tm-links" />;
			case 'history':
				return (
					<ol className="tm-history">
						{out.past.map((item, i) => (
							<li key={i}>{item}</li>
						))}
					</ol>
				);
			default:
				return null;
		}
	};

	return (
		<section
			className="tm-block tm-shell"
			aria-label="직접 쳐 보기"
			onClick={(event) => {
				// 글을 고르거나 단추·링크를 누른 게 아니면 입력칸으로
				if ((event.target as HTMLElement).closest('a, button') || window.getSelection()?.toString()) return;
				input.current?.focus();
			}}
		>
			<div className="tm-entries" aria-live="polite">
				{entries.map((entry) =>
					entry.output.kind === 'page' ? (
						<section key={entry.id} className="tm-entry" aria-label={entry.output.command.label}>
							<Prompt command={entry.input} path={entry.cwd} />
							{output(entry)}
						</section>
					) : (
						<div key={entry.id} className="tm-entry">
							<Prompt command={entry.input} path={entry.cwd} />
							{output(entry)}
						</div>
					)
				)}
			</div>
			<form
				className="tm-input"
				onSubmit={(event) => {
					event.preventDefault();
					run(value);
				}}
			>
				<Prompt path={cwd}>
					{/* 글은 커서 앞·커서 칸·뒤로 나눠 그리고, 진짜 입력칸은 그 위에 투명하게 덮는다 (커서가 글자 사이를 따라간다) */}
					<span className="tm-line" data-focused={focused}>
						<span aria-hidden="true">{value.slice(0, Math.min(caret, value.length))}</span>
						<span className="tm-cursor" aria-hidden="true">
							{value[caret] ?? ' '}
						</span>
						<span aria-hidden="true">{value.slice(caret + 1)}</span>
						<input
							ref={input}
							value={value}
							onChange={(event) => {
								setText(event.target.value);
								setCaret(event.target.selectionStart ?? event.target.value.length);
								setCursor(null);
							}}
							onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
							onFocus={() => setFocused(true)}
							onBlur={() => setFocused(false)}
							onKeyDown={onKeyDown}
							aria-label="명령 입력"
							autoComplete="off"
							autoCapitalize="off"
							spellCheck={false}
							readOnly={typing}
						/>
					</span>
				</Prompt>
			</form>
			<div className="tm-chips" ref={end}>
				{SUGGESTED.map((text) => (
					<button key={text} type="button" onClick={() => type(text)} disabled={typing}>
						{text}
					</button>
				))}
			</div>
		</section>
	);
};

const DevCoursePage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="tm">
		<header className="tm-block">
			{project.terminal?.map((line) =>
				line.startsWith('$ ') ? (
					<Prompt key={line} command={line.slice(2)} home={line.startsWith('$ git clone')} />
				) : (
					<p key={line} className="tm-out">
						{line}
					</p>
				)
			)}
			<Prompt command="cat ABOUT.md" />
			<p className="tm-heading"># {project.name}</p>
			<h1>{project.tagline}</h1>
			<p className="tm-out">{project.description}</p>
			<p className="tm-comment">
				# 아래에 명령을 쳐서 둘러보세요. 저장소의 날짜별 강의 노트와 실습 코드도 열어 볼 수 있습니다
			</p>
		</header>

		<Shell project={project} />
	</div>
);

export default DevCoursePage;

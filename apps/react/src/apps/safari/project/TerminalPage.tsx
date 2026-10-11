// 터미널 세션 로그: 페이지 전체가 어두운 터미널 창 하나. 맨 위 창 제목 줄, 접속하면 뜨는 MOTD(큰 이름·소개·Last login·번호 링크),
// 그 아래로 `$ 명령`과 결과가 쌓이고 맨 아래에 늘 입력 줄이 있다. 내용(숫자·진행 과정·실습·컨벤션·만든 방식·맡은 일·기술 사양)은 명령을 쳐야 나온다.
// 명령 표와 실행 규칙은 terminalShell.ts, 저장소 트리는 terminalRepo.ts. 여기는 그리는 일만 한다
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Links, Region } from '@/apps/safari/project/parts';
import { loadRepo, type RepoDir } from '@/apps/safari/project/terminalRepo';
import {
	commandFor,
	complete,
	fakeHash,
	hasRepoTree,
	isClear,
	pageCommands,
	promptPath,
	repoName,
	runRepo,
	runSimple,
	SHELL_COMMANDS,
	suggested,
	USER,
	type Output,
	type PageCommand,
} from '@/apps/safari/project/terminalShell';
import '@/apps/safari/project/TerminalPage.css';

/** 친 명령 하나: 친 자리(cwd)와 결과 */
type Entry = { id: number; input: string; cwd: string[]; output: Output };

const LOADING = '저장소를 불러오는 중…';

/** 프롬프트 한 줄: 사용자, 지금 폴더(.tm-path), $ 와 명령 */
const Prompt: React.FC<{ repo: string; cwd: string[]; children: React.ReactNode }> = ({ repo, cwd, children }) => (
	<p className="tm-prompt">
		<span className="tm-user">{USER}</span>
		<span className="tm-colon">:</span>
		<span className="tm-path">{promptPath(repo, cwd)}</span>
		<span className="tm-dollar">$</span>
		{children}
	</p>
);

/** 주석 줄 (# …) */
const Comment: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="tm-comment"># {children}</p>;

/* ─── 페이지 명령의 결과: 저마다 터미널 도구의 출력 모양을 흉내 낸다 ─── */

const About: React.FC<{ project: Project }> = ({ project }) => (
	<div className="tm-md">
		<p className="tm-h1"># {project.name}</p>
		<p className="tm-strong">{project.tagline}</p>
		<p className="tm-prose">{project.description}</p>
	</div>
);

/** stat . : ls -l처럼 열을 맞춘 표. 기간·맥락은 읽기 전용 파일, 숫자는 폴더처럼 */
const Stat: React.FC<{ project: Project }> = ({ project }) => {
	const rows = [
		{ key: 'context', value: project.context, dir: false },
		...(project.period ? [{ key: 'period', value: project.period, dir: false }] : []),
		...(project.role ? [{ key: 'role', value: project.role, dir: false }] : []),
		...project.facts.map((fact) => ({ key: fact.label, value: fact.value, dir: true })),
	];
	return (
		<table className="tm-table">
			<tbody>
				{rows.map((row) => (
					<tr key={row.key}>
						<td className="tm-perm">{row.dir ? 'drwxr-xr-x' : '-r--r--r--'}</td>
						<td className="tm-key">{row.key}</td>
						<td className="tm-value">{row.value}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

/** git log --by-week : `* 해시 날짜 제목` 그래프 */
const Log: React.FC<{ project: Project }> = ({ project }) => (
	<ol className="tm-log">
		{project.timeline?.map((step) => (
			<li key={step.date + step.label}>
				<span className="tm-graph" aria-hidden="true">
					*
				</span>
				<span className="tm-hash">{fakeHash(step.date + step.label)}</span>
				<span className="tm-date">{step.date}</span>
				<span className="tm-value">{step.label}</span>
			</li>
		))}
	</ol>
);

/** projects : 폴더 목록처럼 이름/ 아래 설명 */
const Projects: React.FC<{ project: Project }> = ({ project }) => (
	<ul className="tm-dirs">
		{project.highlights.map((point) => (
			<li key={point.title}>
				<span className="tm-dir">{point.title.replace(/\s+/g, '-')}/</span>
				<p className="tm-prose">{point.body}</p>
			</li>
		))}
	</ul>
);

/** git types : 타입과 뜻 */
const Types: React.FC<{ project: Project }> = ({ project }) => (
	<table className="tm-table tm-types">
		<tbody>
			{project.conventions?.map((convention) => (
				<tr key={convention.type}>
					<td className="tm-type">{convention.type}</td>
					<td className="tm-value">{convention.description}</td>
				</tr>
			))}
		</tbody>
	</table>
);

/** cat BUILD.md : 마크다운 제목과 문단 */
const Build: React.FC<{ project: Project }> = ({ project }) => (
	<div className="tm-md">
		{project.build.map((point) => (
			<React.Fragment key={point.title}>
				<p className="tm-h2">## {point.title}</p>
				<p className="tm-prose">{point.body}</p>
			</React.Fragment>
		))}
	</div>
);

/** whoami : key: value, 맡은 일은 목록으로 */
const Whoami: React.FC<{ project: Project }> = ({ project }) => (
	<dl className="tm-pairs">
		<div>
			<dt>user</dt>
			<dd>hyeoniverse</dd>
		</div>
		<div>
			<dt>role</dt>
			<dd>{project.role ?? project.context}</dd>
		</div>
		{project.contributions.length > 0 && (
			<div>
				<dt>did</dt>
				<dd>
					<ul className="tm-checks">
						{project.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</dd>
			</div>
		)}
	</dl>
);

/** cat stack.json : JSON 하이라이트 */
const Key: React.FC<{ name: string }> = ({ name }) => <span className="tm-jkey">"{name}"</span>;
const Str: React.FC<{ text: string }> = ({ text }) => <span className="tm-jstr">"{text}"</span>;

const Stack: React.FC<{ project: Project }> = ({ project }) => {
	return (
		<pre className="tm-json">
			{'{\n'}
			{project.specs.map((spec) => (
				<React.Fragment key={spec.label}>
					{'  '}
					<Key name={spec.label} />
					{': '}
					<Str text={spec.value} />
					{',\n'}
				</React.Fragment>
			))}
			{'  '}
			<Key name="language" />
			{': '}
			<Str text={project.language} />
			{',\n  '}
			<Key name="stack" />
			{': ['}
			{project.stack.map((name, i) => (
				<React.Fragment key={name}>
					{i > 0 && ', '}
					<Str text={name} />
				</React.Fragment>
			))}
			{']\n}'}
		</pre>
	);
};

const VIEWS: Record<PageCommand['view'], React.FC<{ project: Project }>> = {
	about: About,
	stat: Stat,
	log: Log,
	projects: Projects,
	types: Types,
	build: Build,
	whoami: Whoami,
	stack: Stack,
};

/** cat·tree 결과: 마크다운 제목 줄은 색을 달리한다 */
const FileView: React.FC<{ name: string; text: string | null }> = ({ name, text }) =>
	text === null ? (
		<p className="tm-muted">{name}: 그림 같은 파일이라 여기서는 열지 않습니다</p>
	) : (
		<pre className="tm-file">
			{text.split('\n').map((line, i) => (
				<span key={i} className={/^#{1,6} /.test(line) ? 'tm-h2' : undefined}>
					{line}
					{'\n'}
				</span>
			))}
		</pre>
	);

/* ─── 셸 ─── */

const Shell: React.FC<{ project: Project }> = ({ project }) => {
	const repoTitle = repoName(project);
	const withRepo = hasRepoTree(project);
	const pages = pageCommands(project);
	const chips = suggested(project, withRepo);

	const [entries, setEntries] = useState<Entry[]>(() => [{ id: 0, input: 'help', cwd: [], output: { kind: 'help' } }]);
	const [cwd, setCwd] = useState<string[]>([]);
	// 저장소 트리: 없는 프로젝트는 빈 트리 (맨 위의 가짜 파일만 보인다)
	const [repo, setRepo] = useState<RepoDir | null>(() => (withRepo ? null : {}));
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
	const bottom = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	// 저장소를 기다리는 동안 친 명령 (불러오면 이어서 실행)
	const waiting = useRef<string[]>([]);

	/** 글을 통째로 바꿀 때(이전 명령, Tab, 칩)는 커서를 끝으로 */
	const setValue = (text: string) => {
		setText(text);
		setCaret(text.length);
	};

	// 저장소는 페이지를 열면 바로 받아 둔다
	useEffect(() => {
		if (!withRepo) return;
		let alive = true;
		loadRepo()
			.then((data) => alive && setRepo(data))
			.catch(() => alive && setFailed(true));
		return () => {
			alive = false;
		};
	}, [withRepo]);

	const push = (text: string, at: string[], output: Output) => {
		nextId.current += 1;
		setEntries((prev) => [...prev, { id: nextId.current, input: text, cwd: at, output }]);
	};

	const execute = (text: string, past: string[]) => {
		const simple = runSimple(project, text, cwd, past);
		if (simple) return push(text, cwd, simple);
		if (!repo) {
			if (failed) return push(text, cwd, { kind: 'error', text: '저장소를 불러오지 못했습니다' });
			waiting.current.push(text);
			return push(text, cwd, { kind: 'text', text: LOADING });
		}
		const result = runRepo(repo, text, cwd);
		push(text, cwd, result.output);
		setCwd(result.cwd);
	};

	// 저장소를 기다리던 명령은 불러온 뒤 다시 실행한다
	useEffect(() => {
		if (!repo || waiting.current.length === 0) return;
		const queued = waiting.current;
		waiting.current = [];
		setEntries((prev) => prev.filter((entry) => !(entry.output.kind === 'text' && entry.output.text === LOADING)));
		let at = cwd;
		for (const text of queued) {
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
		if (isClear(text)) {
			setEntries([]);
			return;
		}
		execute(text, past);
	};

	// 새 결과가 나오면 입력 줄이 보이게 내린다
	useEffect(() => {
		if (entries.length > 1) bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Tab') {
			const filled = complete(project, repo, cwd, value);
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

	/** 명령 이름 단추: 누르면 그 명령이 쳐진다 (컴포넌트로 두면 다시 그릴 때마다 단추가 갈려 누른 것이 사라진다) */
	const cmd = (text: string, className = 'tm-cmd', label: React.ReactNode = text) => (
		<button type="button" className={className} onClick={() => type(text)} disabled={typing}>
			{label}
		</button>
	);

	const render = (out: Output) => {
		switch (out.kind) {
			case 'page': {
				const View = VIEWS[out.command.view];
				return <View project={project} />;
			}
			case 'help':
				return (
					<div className="tm-help">
						<Comment>이 저장소에서 한 일</Comment>
						<table className="tm-table">
							<tbody>
								{pages.map((item) => (
									<tr key={item.name}>
										<td>{cmd(item.name)}</td>
										<td className="tm-value">{item.help}</td>
									</tr>
								))}
							</tbody>
						</table>
						<Comment>{withRepo ? '저장소 돌아보기: 날짜별 강의 노트와 실습 코드' : '그 밖의 명령'}</Comment>
						<table className="tm-table">
							<tbody>
								{SHELL_COMMANDS.map((item) => (
									<tr key={item.name}>
										<td>{cmd(item.name)}</td>
										<td className="tm-value">{item.help}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				);
			case 'list':
				return out.items.length ? (
					<ul className="tm-ls">
						{out.items.map((each) => (
							<li key={each.name}>
								{cmd(
									commandFor(each.name, each.dir, out.path, cwd),
									each.dir ? 'tm-dir' : 'tm-name',
									`${each.name}${each.dir ? '/' : ''}`
								)}
							</li>
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
				return <p className="tm-text">{out.text}</p>;
			case 'error':
				return (
					<p className="tm-error">
						{out.text} — {cmd('help', 'tm-hint')}를 쳐 보세요
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
		<Region
			label="직접 쳐 보기"
			className="tm-shell"
			onClick={(event) => {
				// 글을 고르거나 단추·링크를 누른 게 아니면 입력칸으로
				if ((event.target as HTMLElement).closest('a, button') || window.getSelection()?.toString()) return;
				input.current?.focus();
			}}
		>
			<div className="tm-entries" aria-live="polite">
				{entries.map((entry) => {
					const body = (
						<>
							<Prompt repo={repoTitle} cwd={entry.cwd}>
								<code>{entry.input}</code>
							</Prompt>
							<div className="tm-result">{render(entry.output)}</div>
						</>
					);
					return entry.output.kind === 'page' ? (
						<Region key={entry.id} label={entry.output.command.label} className="tm-entry">
							{body}
						</Region>
					) : (
						<div key={entry.id} className="tm-entry">
							{body}
						</div>
					);
				})}
			</div>

			<form
				className="tm-form"
				onSubmit={(event) => {
					event.preventDefault();
					run(value);
				}}
			>
				<Prompt repo={repoTitle} cwd={cwd}>
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

			<div className="tm-chips" ref={bottom}>
				<span className="tm-muted">SUGGESTED</span>
				{chips.map((text) => (
					<React.Fragment key={text}>{cmd(text, 'tm-chip')}</React.Fragment>
				))}
			</div>
		</Region>
	);
};

/* ─── 창 제목 줄과 MOTD ─── */

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const Motd: React.FC<{ project: Project; repo: string }> = ({ project, repo }) => {
	const links = [
		{ label: 'GitHub', href: project.url },
		...(project.demo ? [{ label: 'Demo', href: project.demo }] : []),
	];
	return (
		<header className="tm-motd">
			{/* 접속 로그: 프로젝트가 적어 둔 줄이 있으면 먼저 흘려 보낸다 */}
			{project.terminal && project.terminal.length > 0 && (
				<div className="tm-replay">
					{project.terminal.map((line) =>
						line.startsWith('$ ') ? (
							<p key={line} className="tm-prompt">
								<span className="tm-user">{USER}</span>
								<span className="tm-colon">:</span>
								<span className="tm-path">{line.startsWith('$ git clone') ? '~' : `~/${repo}`}</span>
								<span className="tm-dollar">$</span>
								<code>{line.slice(2)}</code>
							</p>
						) : (
							<p key={line} className={line.startsWith('#') ? 'tm-comment' : 'tm-text'}>
								{line}
							</p>
						)
					)}
				</div>
			)}
			<div className="tm-banner" aria-hidden="true">
				{project.name}
			</div>
			<h1 className="tm-headline">
				<span className="visually-hidden">{project.name} — </span>
				{project.tagline}
			</h1>
			<p className="tm-prose tm-lead">{project.description}</p>
			<p className="tm-login">
				<span className="tm-muted">Last login:</span> {project.period ?? '—'}
				<span className="tm-muted"> on </span>
				{project.context}
			</p>
			<p className="tm-refs">
				{links.map((link, i) => (
					<a key={link.label} href={link.href} {...external}>
						<span className="tm-ref">[{i + 1}]</span> {link.label}
					</a>
				))}
			</p>
			<Comment>아래에 명령을 쳐서 둘러보세요. help 가 명령 목록을 보여 줍니다</Comment>
		</header>
	);
};

const TerminalPage: React.FC<{ project: Project }> = ({ project }) => {
	const repo = repoName(project);
	return (
		<div className="tm">
			<div className="tm-window">
				<div className="tm-titlebar" aria-hidden="true">
					<span className="tm-lights">
						<i />
						<i />
						<i />
					</span>
					<span className="tm-title">
						{USER}: ~/{repo}
					</span>
					<span className="tm-size">80×24</span>
				</div>
				<div className="tm-screen">
					<Motd project={project} repo={repo} />
					<Shell project={project} />
				</div>
			</div>
		</div>
	);
};

export default TerminalPage;

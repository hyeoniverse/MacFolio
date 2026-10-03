// DevCourse (학습 기록): 페이지 전체가 터미널 화면 하나(창 테두리 없이). 위에는 미리 쳐 둔 명령과 결과로 소개, 숫자, 주차별 기록,
// 실습 프로젝트, 컨벤션, 만든 방식, 맡은 일, 기술 사양이 나오고, 맨 아래 프롬프트에서는 직접 명령을 쳐 볼 수 있다.
// 명령은 고정폭 글꼴, 결과의 한글 문장은 읽기 쉬운 본문 글꼴로 쓴다
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import '@/apps/safari/project/TerminalPage.css';

const Prompt: React.FC<{ command?: string; children?: React.ReactNode }> = ({ command, children }) => (
	<p className="tm-prompt">
		<span className="tm-user">hyeoniverse@devcourse</span>
		<span className="tm-path">~</span>
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

type Command = {
	/** 프롬프트에 보이는 대표 이름 */
	name: string;
	/** 같은 뜻으로 받아 주는 다른 이름 */
	aliases: string[];
	help: string;
	run?: React.FC<{ project: Project }>;
};

const COMMANDS: Command[] = [
	{ name: 'help', aliases: ['?', 'man'], help: '쓸 수 있는 명령' },
	{ name: 'cat ABOUT.md', aliases: ['about', 'cat about'], help: '이 저장소 소개', run: About },
	{ name: 'stat .', aliases: ['stat', 'info'], help: '기간과 숫자', run: Stat },
	{ name: 'git log --by-week', aliases: ['git log', 'log', 'weeks'], help: '주차별 기록', run: Weeks },
	{
		name: 'ls Projects/',
		aliases: ['ls', 'ls projects', 'projects'],
		help: '직접 만든 실습 프로젝트',
		run: ProjectsList,
	},
	{ name: 'git types', aliases: ['types', 'conventions', 'commits'], help: '커밋 타입 컨벤션', run: Types },
	{ name: 'cat BUILD.md', aliases: ['build', 'cat build'], help: '만든 방식', run: Build },
	{ name: 'whoami', aliases: ['me', 'whoami --contributions'], help: '맡은 일', run: Contributions },
	{ name: 'cat stack.json', aliases: ['stack', 'cat stack'], help: '기술 사양', run: Stack },
	{ name: 'open', aliases: ['open github', 'github'], help: '저장소 열기 링크' },
	{ name: 'date', aliases: [], help: '지금 시각' },
	{ name: 'history', aliases: [], help: '친 명령 목록' },
	{ name: 'clear', aliases: ['cls'], help: '화면 지우기' },
];

/** 대소문자와 끝의 / 를 가리지 않고, 빈칸은 하나로 */
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\/$/, '');

const find = (input: string) => {
	const key = normalize(input);
	return COMMANDS.find((command) => [command.name, ...command.aliases].some((name) => normalize(name) === key));
};

/** 앞부분이 맞는 첫 명령 이름 (Tab으로 채우기) */
const complete = (input: string) => {
	const key = normalize(input);
	if (!key) return input;
	return COMMANDS.find((command) => normalize(command.name).startsWith(key))?.name ?? input;
};

/** 칩으로 보여 주는 자주 쓰는 명령 */
const SUGGESTED = ['help', 'ls Projects/', 'git log --by-week', 'whoami', 'cat stack.json', 'clear'];

/** 친 명령 하나: 그때까지의 명령 목록을 함께 둔다(history 결과) */
type Entry = { id: number; input: string; past: string[] };

const Shell: React.FC<{ project: Project }> = ({ project }) => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [value, setValue] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	// 위·아래 화살표로 고르고 있는 이전 명령 (없으면 null)
	const [cursor, setCursor] = useState<number | null>(null);
	const [typing, setTyping] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const end = useRef<HTMLDivElement>(null);
	const nextId = useRef(0);

	const run = (raw: string) => {
		const text = raw.trim();
		setValue('');
		setCursor(null);
		if (!text) return;
		const past = [...history, text];
		setHistory(past);
		if (find(text)?.name === 'clear') {
			setEntries([]);
			return;
		}
		nextId.current += 1;
		setEntries((prev) => [...prev, { id: nextId.current, input: text, past }]);
	};

	// 새 결과가 나오면 프롬프트가 보이게 내린다
	useEffect(() => {
		if (entries.length) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [entries]);

	// 칩을 누르면 한 글자씩 쳐서 실행한다
	const type = (text: string) => {
		if (typing) return;
		setTyping(true);
		input.current?.focus();
		let i = 0;
		const timer = window.setInterval(() => {
			i += 1;
			setValue(text.slice(0, i));
			if (i >= text.length) {
				window.clearInterval(timer);
				window.setTimeout(() => {
					run(text);
					setTyping(false);
				}, 160);
			}
		}, 45);
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Tab') {
			const filled = complete(value);
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

	const output = ({ input: text, past }: Entry) => {
		const command = find(text);
		if (!command) {
			return (
				<p className="tm-error">
					zsh: command not found: {text.split(' ')[0]} — <span className="tm-hint">help</span>를 쳐 보세요
				</p>
			);
		}
		if (command.run) return <command.run project={project} />;
		switch (command.name) {
			case 'help':
				return (
					<ul className="tm-help">
						{COMMANDS.map((item) => (
							<li key={item.name}>
								<button type="button" onClick={() => type(item.name)} disabled={typing}>
									{item.name}
								</button>
								<span>{item.help}</span>
							</li>
						))}
					</ul>
				);
			case 'open':
				return <Links project={project} className="tm-links" />;
			case 'date':
				return <p className="tm-out">{new Date().toLocaleString('ko-KR')}</p>;
			case 'history':
				return (
					<ol className="tm-history">
						{past.map((item, i) => (
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
			<p className="tm-comment"># 직접 쳐 보세요. Tab으로 채우고, ↑↓로 이전 명령을 불러옵니다</p>
			<div className="tm-entries" aria-live="polite">
				{entries.map((entry) => (
					<div key={entry.id} className="tm-entry">
						<Prompt command={entry.input} />
						{output(entry)}
					</div>
				))}
			</div>
			<form
				className="tm-input"
				onSubmit={(event) => {
					event.preventDefault();
					run(value);
				}}
			>
				<Prompt>
					<input
						ref={input}
						value={value}
						onChange={(event) => {
							setValue(event.target.value);
							setCursor(null);
						}}
						onKeyDown={onKeyDown}
						aria-label="명령 입력"
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						readOnly={typing}
						size={Math.max(1, value.length + 1)}
					/>
					<span className="tm-cursor" aria-hidden="true" />
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

/** 맨 아래 프롬프트로 내려가 입력칸에 커서를 둔다 */
const focusShell = (event: React.MouseEvent<HTMLElement>) => {
	const field = event.currentTarget.closest('.tm')?.querySelector<HTMLInputElement>('.tm-input input');
	field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	field?.focus({ preventScroll: true });
};

const TerminalPage: React.FC<{ project: Project }> = ({ project }) => (
	<div className="tm">
		<header className="tm-block">
			{project.terminal?.map((line) =>
				line.startsWith('$ ') ? (
					<Prompt key={line} command={line.slice(2)} />
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
			<button type="button" className="tm-jump" onClick={focusShell}>
				# 맨 아래 프롬프트에서 직접 명령을 쳐 볼 수 있습니다 ↓
			</button>
		</header>

		<section className="tm-block" aria-label="한눈에 보기">
			<Prompt command="stat ." />
			<Stat project={project} />
		</section>

		{project.timeline && (
			<section className="tm-block" aria-label="진행 과정">
				<Prompt command="git log --by-week" />
				<Weeks project={project} />
			</section>
		)}

		<section className="tm-block" aria-label="주요 기능">
			<Prompt command="ls Projects/" />
			<ProjectsList project={project} />
		</section>

		{project.conventions && (
			<section className="tm-block" aria-label="커밋 컨벤션">
				<Prompt command="git types" />
				<Types project={project} />
			</section>
		)}

		<section className="tm-block" aria-label="만든 방식">
			<Prompt command="cat BUILD.md" />
			<Build project={project} />
		</section>

		<section className="tm-block" aria-label="맡은 일">
			<Prompt command="whoami" />
			<Contributions project={project} />
		</section>

		<section className="tm-block" aria-label="기술 사양">
			<Prompt command="cat stack.json" />
			<Stack project={project} />
		</section>

		<section className="tm-block" aria-label="링크">
			<Prompt command="open" />
			<Links project={project} className="tm-links" />
		</section>

		<Shell project={project} />
	</div>
);

export default TerminalPage;

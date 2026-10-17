// repo 템플릿의 맨 아래 상태 줄과 터미널 서랍: 버튼을 누르면 아래에서 터미널이 올라오고, shell.ts의 명령을 받아 결과를 서랍 안에 그린다.
// 결과는 구역(region)을 만들지 않는다 (페이지의 구역은 랜딩 구역뿐)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LandingLinks, type LandingSectionKind, type SectionOf } from '@/apps/safari/project/landing';
import type { RepoDir } from '@/apps/safari/project/terminalRepo';
import { commitsOf, fileIcon } from './repo';
import {
	commandFor,
	complete,
	isClear,
	pageCommands,
	promptPath,
	runRepo,
	runSimple,
	SHELL_COMMANDS,
	suggested,
	USER,
	type Output,
	type PageView,
	type ShellData,
} from './shell';
import { TypeBadge } from './bits';

const sectionOf = <K extends LandingSectionKind>(data: ShellData, kind: K) =>
	data.landing.sections.find((section): section is SectionOf<K> => section.kind === kind);

/** 페이지 명령의 결과 */
const PageOut: React.FC<{ data: ShellData; view: PageView }> = ({ data, view }) => {
	const { hero } = data.landing;
	switch (view) {
		case 'about':
			return (
				<>
					<p className="rp-t-h"># {hero.name}</p>
					{hero.headline !== hero.name && <p className="rp-t-strong">{hero.headline}</p>}
					{hero.subhead && <p>{hero.subhead}</p>}
				</>
			);
		case 'stat': {
			const facts = sectionOf(data, 'stats')?.facts ?? [];
			const rows = [
				...(hero.meta.context ? [{ label: 'context', value: hero.meta.context }] : []),
				...(hero.meta.period ? [{ label: 'period', value: hero.meta.period }] : []),
				...facts,
			];
			if (!rows.length) return <p>아직 적은 숫자가 없습니다.</p>;
			return (
				<dl className="rp-t-pairs">
					{rows.map((row) => (
						<div key={row.label}>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
						</div>
					))}
				</dl>
			);
		}
		case 'log':
			return (
				<ol className="rp-t-log">
					{commitsOf(sectionOf(data, 'timeline')?.entries ?? [], data.conventions)
						.reverse()
						.map((commit) => (
							<li key={commit.hash}>
								<span className="rp-t-hash">{commit.hash}</span>
								<span className="rp-t-date">{commit.date}</span>
								<span>{commit.message}</span>
							</li>
						))}
				</ol>
			);
		case 'features':
			return (
				<ul className="rp-t-ls">
					{sectionOf(data, 'features')?.items.map((point) => (
						<li key={point.title}>
							<span className="rp-t-dir">{point.title.replace(/\s+/g, '-')}/</span>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			);
		case 'types':
			return (
				<ul className="rp-t-types">
					{data.conventions.map((convention) => (
						<li key={convention.type}>
							<TypeBadge type={convention.type} />
							<span>{convention.description}</span>
						</li>
					))}
				</ul>
			);
		case 'build':
			return (
				<>
					{sectionOf(data, 'built')?.items.map((point) => (
						<div key={point.title}>
							<p className="rp-t-h">## {point.title}</p>
							<p>{point.body}</p>
						</div>
					))}
				</>
			);
		case 'whoami': {
			const role = sectionOf(data, 'role');
			return (
				<>
					{role?.role && <p>{role.role}</p>}
					<ul className="rp-t-list">
						{role?.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</>
			);
		}
		case 'stack': {
			const tech = sectionOf(data, 'tech');
			const pairs: [string, string][] = [
				...(tech?.stack.length ? [['stack', tech.stack.join(', ')] as [string, string]] : []),
				...(tech?.specs.map((spec) => [spec.label, spec.value] as [string, string]) ?? []),
			];
			return (
				<pre className="rp-t-json">
					{'{\n'}
					{pairs.map(([key, value], i) => (
						<React.Fragment key={key}>
							{'  '}
							<span className="rp-t-key">"{key}"</span>
							{': '}
							<span className="rp-t-str">"{value}"</span>
							{i < pairs.length - 1 ? ',\n' : '\n'}
						</React.Fragment>
					))}
					{'}'}
				</pre>
			);
		}
	}
};

type Entry = { id: number; input: string; cwd: string[]; output: Output };

const OutputView: React.FC<{ data: ShellData; entry: Entry; run: (text: string) => void }> = ({ data, entry, run }) => {
	const { output } = entry;
	switch (output.kind) {
		case 'page':
			return (
				<div className="rp-t-out" data-view={output.command.view}>
					<PageOut data={data} view={output.command.view} />
				</div>
			);
		case 'help':
			return (
				<dl className="rp-t-help">
					{[...pageCommands(data), ...SHELL_COMMANDS].map((command) => (
						<div key={command.name}>
							<dt>
								<button type="button" onClick={() => run(command.name)}>
									{command.name}
								</button>
							</dt>
							<dd>{command.help}</dd>
						</div>
					))}
				</dl>
			);
		case 'list':
			return output.items.length ? (
				<ul className="rp-t-files">
					{output.items.map((item) => (
						<li key={item.name}>
							<button
								type="button"
								className={item.dir ? 'dir' : ''}
								onClick={() => run(commandFor(data, item.name, item.dir, output.path, entry.cwd))}
							>
								<i className={fileIcon(item.name, item.dir)} aria-hidden="true" /> {item.name}
								{item.dir ? '/' : ''}
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="rp-t-muted">빈 폴더입니다.</p>
			);
		case 'tree':
			return <pre className="rp-t-pre">{output.lines.join('\n')}</pre>;
		case 'file':
			if (output.text === null)
				return <p className="rp-t-err">{output.name}: 그림이나 바이너리 파일은 터미널에서 열 수 없습니다.</p>;
			if (!output.text.trim()) return <p className="rp-t-muted">{output.name}: 이 파일의 내용은 적혀 있지 않습니다.</p>;
			return <pre className="rp-t-pre">{output.text}</pre>;
		case 'text':
			return <p>{output.text}</p>;
		case 'error':
			return <p className="rp-t-err">{output.text}</p>;
		case 'links':
			return data.landing.hero.links.length ? (
				<LandingLinks links={data.landing.hero.links} className="rp-t-links" />
			) : (
				<p className="rp-t-muted">열 수 있는 링크가 없습니다.</p>
			);
		case 'history':
			return (
				<ol className="rp-t-history">
					{output.past.map((text, i) => (
						<li key={i}>
							<button type="button" onClick={() => run(text)}>
								{text}
							</button>
						</li>
					))}
				</ol>
			);
	}
};

/** 상태 줄과 서랍. repo가 null이면 저장소 트리를 아직 불러오는 중이다 (loading) */
export const Terminal: React.FC<{
	data: ShellData;
	name: string;
	repo: RepoDir | null;
	loading: boolean;
	period?: string;
	open: boolean;
	onToggle: () => void;
}> = ({ data, name, repo, loading, period, open, onToggle }) => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [cwd, setCwd] = useState<string[]>([]);
	const [past, setPast] = useState<string[]>([]);
	const [value, setValue] = useState('');
	const [cursor, setCursor] = useState<number | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const body = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	const withTree = Boolean(repo && Object.keys(repo).length);

	const run = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			setPast((list) => [...list, trimmed]);
			setCursor(null);
			setValue('');
			if (isClear(trimmed)) {
				setEntries([]);
				return;
			}
			const simple = runSimple(data, name, trimmed, cwd, past);
			let output: Output;
			if (simple) output = simple;
			else if (loading) output = { kind: 'error', text: '저장소를 아직 불러오는 중입니다. 잠시 뒤 다시 쳐 주세요.' };
			else {
				const result = runRepo(data, repo ?? {}, trimmed, cwd);
				output = result.output;
				setCwd(result.cwd);
			}
			setEntries((list) => [...list, { id: nextId.current++, input: trimmed, cwd, output }]);
		},
		[data, name, cwd, past, repo, loading]
	);

	// 새 결과가 생기면 맨 아래로
	useEffect(() => {
		body.current?.scrollTo({ top: body.current.scrollHeight });
	}, [entries]);

	useEffect(() => {
		if (open) input.current?.focus({ preventScroll: true });
	}, [open]);

	const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Tab') {
			event.preventDefault();
			setValue(complete(data, repo, cwd, value));
		} else if (event.key === 'ArrowUp' && past.length > 0) {
			event.preventDefault();
			const index = cursor === null ? past.length - 1 : Math.max(0, cursor - 1);
			setCursor(index);
			setValue(past[index]);
		} else if (event.key === 'ArrowDown' && cursor !== null) {
			event.preventDefault();
			const index = cursor + 1;
			if (index >= past.length) {
				setCursor(null);
				setValue('');
			} else {
				setCursor(index);
				setValue(past[index]);
			}
		} else if (event.key === 'l' && event.ctrlKey) {
			event.preventDefault();
			setEntries([]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			onToggle();
		}
	};

	return (
		<footer className="rp-footer" data-open={open || undefined}>
			<aside className="rp-drawer" aria-label="터미널" hidden={!open}>
				<div className="rp-drawer-head">
					<span className="rp-mono">
						<i className="fa-solid fa-terminal" aria-hidden="true" /> {USER}:{promptPath(name, cwd)}
					</span>
					<button type="button" className="rp-drawer-x" aria-label="터미널 닫기" onClick={onToggle}>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				</div>
				<div className="rp-drawer-body" ref={body}>
					<p className="rp-t-muted">
						help를 치면 명령 목록이 나옵니다.{withTree ? ' ls, cd, cat, tree로 저장소를 돌아볼 수 있습니다.' : ''}
					</p>
					{entries.map((entry) => (
						<div key={entry.id} className="rp-t-entry">
							<p className="rp-t-prompt">
								<span className="rp-t-path">{promptPath(name, entry.cwd)}</span>
								<span className="rp-t-dollar">$</span> <code>{entry.input}</code>
							</p>
							<OutputView data={data} entry={entry} run={run} />
						</div>
					))}
					<form
						className="rp-t-form"
						onSubmit={(event) => {
							event.preventDefault();
							run(value);
						}}
					>
						<span className="rp-t-path">{promptPath(name, cwd)}</span>
						<span className="rp-t-dollar">$</span>
						<input
							ref={input}
							value={value}
							onChange={(event) => setValue(event.target.value)}
							onKeyDown={onKey}
							aria-label="명령 입력"
							autoComplete="off"
							autoCapitalize="off"
							spellCheck={false}
						/>
					</form>
				</div>
				<div className="rp-t-chips">
					{suggested(data, withTree).map((text) => (
						<button key={text} type="button" onClick={() => run(text)}>
							{text}
						</button>
					))}
				</div>
			</aside>
			<div className="rp-statusbar">
				<button type="button" className="rp-term-btn" aria-expanded={open} onClick={onToggle}>
					<i className="fa-solid fa-terminal" aria-hidden="true" /> 터미널
					<i className="fa-solid fa-chevron-up rp-term-chev" aria-hidden="true" />
				</button>
				<span className="rp-status-right rp-mono">
					<i className="fa-solid fa-code-branch" aria-hidden="true" /> main
					{period && <span>· {period}</span>}
				</span>
			</div>
		</footer>
	);
};

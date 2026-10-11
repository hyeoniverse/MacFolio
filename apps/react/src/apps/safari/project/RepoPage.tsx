// 저장소 페이지(repo): GitHub 저장소 화면을 그대로 흉내 낸다. 머리(owner / 이름, 설명, 숫자 뱃지, Code 단추),
// 탭(Code 파일 트리와 파일 내용 · Commits 타임라인을 커밋 그래프로 · README · Conventions 표 · About), 아래 터미널 서랍.
// 파일 트리는 terminalRepo.ts의 저장소(DevCourse만 있다)를 돌아보고, 서랍의 셸은 terminalShell.ts의 명령을 그대로 쓴다.
// 저장소 트리가 없는 프로젝트는 Code 탭 없이 README부터 시작한다
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { entries, isDir, loadRepo, nodeAt, type RepoDir, type RepoNode } from '@/apps/safari/project/terminalRepo';
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
	type PageView,
} from '@/apps/safari/project/terminalShell';
import '@/apps/safari/project/RepoPage.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** GitHub가 언어마다 칠하는 점 색 (없는 언어는 강조색) */
const LANGUAGE_COLORS: Record<string, string> = {
	JavaScript: '#f1e05a',
	TypeScript: '#3178c6',
	'C#': '#178600',
	'C++': '#f34b7d',
	C: '#555555',
	Python: '#3572a5',
	Java: '#b07219',
	Kotlin: '#a97bff',
	Swift: '#f05138',
	Dart: '#00b4ab',
	Go: '#00add8',
	Rust: '#dea584',
	HTML: '#e34c26',
	CSS: '#663399',
	SCSS: '#c6538c',
	Vue: '#41b883',
	Shell: '#89e051',
};

/** 주소에서 owner와 저장소 이름 (github.com/owner/name). 안 맞으면 프로젝트 이름만 */
function ownerOf(project: Project): string | null {
	const match = /github\.com\/([^/]+)\/[^/]+/.exec(project.url);
	return match ? match[1] : null;
}

/** 파일 이름으로 아이콘 (폴더·글·그림·코드) */
const fileIcon = (name: string, dir: boolean, open = false) => {
	if (dir) return open ? 'fa-regular fa-folder-open' : 'fa-solid fa-folder';
	if (/\.(md|txt)$/i.test(name)) return 'fa-regular fa-file-lines';
	if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) return 'fa-regular fa-file-image';
	if (/\.(js|ts|jsx|tsx|css|html|json|mjs|cjs|py|java|cs|sh)$/i.test(name)) return 'fa-regular fa-file-code';
	return 'fa-regular fa-file';
};

/** 커밋 타입 뱃지의 색: 타입 이름으로 늘 같은 색 (컨벤션 표·커밋 목록·서랍이 같이 쓴다) */
const typeHue = (type: string) => parseInt(fakeHash(type).slice(0, 3), 16) % 360;
const typeStyle = (type: string) => ({ '--rp-hue': typeHue(type) }) as React.CSSProperties;

/** 진행 과정 한 줄에 어울리는 커밋 타입: 말에 실마리가 있으면 그 타입, 아니면 해시로 고른다 (컨벤션에 있는 타입만) */
const TYPE_HINTS: [string, RegExp][] = [
	['project', /보드|스토어|쇼핑몰|프로젝트|앱|출시|배포/],
	['example', /예제/],
	['docs', /정리|이해|환경|문서|라이선스|노트/],
	['practice', /기초|API|실습|데모|연습/],
	['feat', /기능|추가|구현/],
	['fix', /수정|고침|버그/],
	['refactor', /리팩|정돈/],
	['test', /테스트|시험/],
];

function commitType(label: string, types: string[]): string | undefined {
	if (types.length === 0) return undefined;
	const hint = TYPE_HINTS.find(([type, pattern]) => types.includes(type) && pattern.test(label));
	return hint ? hint[0] : types[parseInt(fakeHash(label).slice(0, 4), 16) % types.length];
}

type Commit = { hash: string; date: string; message: string; type?: string };

const commitsOf = (project: Project): Commit[] => {
	const types = project.conventions?.map((convention) => convention.type) ?? [];
	return (project.timeline ?? []).map((step) => ({
		hash: fakeHash(step.date + step.label),
		date: step.date,
		message: step.label,
		type: commitType(step.label, types),
	}));
};

/* ─── 머리 ─── */

/** owner / 이름, 설명, 숫자 뱃지, 'Code ▾' 단추(누르면 clone 주소와 링크), 언어 점과 기술 칩 */
const Head: React.FC<{ project: Project }> = ({ project }) => {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const wrap = useRef<HTMLDivElement>(null);
	const owner = ownerOf(project);
	const name = repoName(project);
	const clone = `${project.url.replace(/\/+$/, '')}.git`;

	// 바깥을 누르면 닫힌다
	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (!wrap.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		return () => document.removeEventListener('pointerdown', close);
	}, [open]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(clone);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			// 클립보드를 못 쓰는 곳에서는 조용히 넘어간다
		}
	};

	return (
		<header className="rp-head">
			<div className="rp-head-row">
				<h1 className="rp-title">
					{project.icon ? (
						<img className="rp-avatar" src={project.icon} alt="" />
					) : (
						<i className="rp-avatar fallback fa-regular fa-bookmark" aria-hidden="true" />
					)}
					{owner && (
						<>
							<a href={`https://github.com/${owner}`} {...external}>
								{owner}
							</a>
							<span className="rp-slash" aria-hidden="true">
								/
							</span>
						</>
					)}
					<a className="rp-repo" href={project.url} {...external}>
						{name}
					</a>
					<span className="rp-visibility">Public</span>
				</h1>
				<div className="rp-actions" ref={wrap}>
					{project.facts.map((fact) => (
						<span key={fact.label} className="rp-counter" title={fact.label}>
							<i className="fa-regular fa-star" aria-hidden="true" />
							<FactValue text={fact.value} />
							<span className="rp-counter-label">{fact.label}</span>
						</span>
					))}
					<button
						type="button"
						className="rp-code-btn"
						aria-expanded={open}
						aria-haspopup="dialog"
						onClick={() => setOpen((value) => !value)}
					>
						<i className="fa-solid fa-code" aria-hidden="true" /> Code
						<i className="fa-solid fa-caret-down" aria-hidden="true" />
					</button>
					{open && (
						<div className="rp-pop" role="dialog" aria-label="저장소 가져오기">
							<p className="rp-pop-title">
								<i className="fa-solid fa-terminal" aria-hidden="true" /> Clone
							</p>
							<div className="rp-clone">
								<input value={clone} readOnly aria-label="clone 주소" onFocus={(event) => event.target.select()} />
								<button type="button" onClick={copy} aria-label="clone 주소 복사">
									<i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'} aria-hidden="true" />
								</button>
							</div>
							<Links project={project} className="rp-pop-links" />
						</div>
					)}
				</div>
			</div>
			{project.description && <p className="rp-desc">{project.description}</p>}
			<p className="rp-meta">
				<span className="rp-lang">
					<i
						className="rp-dot"
						style={{ background: LANGUAGE_COLORS[project.language] ?? 'var(--sp-accent)' }}
						aria-hidden="true"
					/>
					{project.language}
				</span>
				{project.context && <span>{project.context}</span>}
				{project.period && (
					<span>
						<i className="fa-regular fa-calendar" aria-hidden="true" /> {project.period}
					</span>
				)}
			</p>
			{project.stack.length > 0 && (
				<ul className="rp-topics" aria-label="기술">
					{project.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			)}
		</header>
	);
};

/* ─── 탭 ─── */

type TabId = 'code' | 'commits' | 'readme' | 'conventions' | 'about';

/** role=tab 줄. 고른 탭 밑의 밑줄은 자리와 너비를 재서 미끄러진다 */
const Tabs: React.FC<{
	tabs: { id: TabId; label: string; icon: string; count?: number }[];
	active: TabId;
	onChange: (id: TabId) => void;
}> = ({ tabs, active, onChange }) => {
	const list = useRef<HTMLDivElement>(null);
	const [ink, setInk] = useState({ left: 0, width: 0 });

	const measure = useCallback(() => {
		const node = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
		if (node) setInk({ left: node.offsetLeft, width: node.offsetWidth });
	}, []);

	useLayoutEffect(measure, [active, tabs, measure]);
	useEffect(() => {
		if (!list.current || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(list.current);
		return () => observer.disconnect();
	}, [measure]);

	const onKey = (event: React.KeyboardEvent, index: number) => {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		const next = tabs[(index + step + tabs.length) % tabs.length];
		onChange(next.id);
		list.current?.querySelector<HTMLElement>(`#rp-tab-${next.id}`)?.focus();
	};

	// Safari 창의 탭(role=tab)과 섞이지 않게 저장소 탭은 nav + 단추(aria-current)로 둔다
	return (
		<nav className="rp-tabs" aria-label="저장소 탭" ref={list}>
			{tabs.map((tab, index) => (
				<button
					key={tab.id}
					type="button"
					id={`rp-tab-${tab.id}`}
					aria-current={active === tab.id ? 'page' : undefined}
					aria-controls={`rp-panel-${tab.id}`}
					tabIndex={active === tab.id ? 0 : -1}
					onClick={() => onChange(tab.id)}
					onKeyDown={(event) => onKey(event, index)}
				>
					<i className={tab.icon} aria-hidden="true" />
					{tab.label}
					{tab.count !== undefined && <span className="rp-count">{tab.count}</span>}
				</button>
			))}
			<span
				className="rp-ink"
				style={{ transform: `translateX(${ink.left}px)`, width: ink.width }}
				aria-hidden="true"
			/>
		</nav>
	);
};

/* ─── Code 탭: 파일 트리와 파일 내용 ─── */

type TreeState = {
	expanded: Set<string>;
	selected: string[] | null;
	toggle: (path: string[]) => void;
	select: (path: string[]) => void;
};

const keyOf = (path: string[]) => path.join('/');

/** 폴더 하나의 항목들 (폴더는 접고 펼치기, 파일은 고르기). 펼친 폴더의 자식은 아래로 미끄러져 나온다 */
const TreeList: React.FC<{ dir: RepoDir; path: string[]; state: TreeState; depth: number }> = ({
	dir,
	path,
	state,
	depth,
}) => (
	<ul className="rp-tree-list" role={depth === 0 ? 'tree' : 'group'}>
		{entries(dir).map((entry) => {
			const here = [...path, entry.name];
			const key = keyOf(here);
			const open = state.expanded.has(key);
			const selected = state.selected !== null && keyOf(state.selected) === key;
			return (
				<li key={entry.name} role="treeitem" aria-expanded={entry.dir ? open : undefined} aria-selected={selected}>
					<button
						type="button"
						className={`rp-node${selected ? ' selected' : ''}`}
						style={{ '--depth': depth } as React.CSSProperties}
						data-path={key}
						onClick={() => (entry.dir ? state.toggle(here) : state.select(here))}
					>
						{entry.dir && (
							<i className={`rp-chev fa-solid fa-chevron-right${open ? ' open' : ''}`} aria-hidden="true" />
						)}
						<i className={`rp-file-icon ${fileIcon(entry.name, entry.dir, open)}`} aria-hidden="true" />
						<span>{entry.name}</span>
					</button>
					{entry.dir && open && isDir(dir[entry.name]) && (
						<div className="rp-tree-children">
							<TreeList dir={dir[entry.name] as RepoDir} path={here} state={state} depth={depth + 1} />
						</div>
					)}
				</li>
			);
		})}
	</ul>
);

/** 트리를 불러오는 동안의 자리표 */
const TreeSkeleton: React.FC = () => (
	<ul className="rp-tree-list rp-skeleton" aria-label="저장소를 불러오는 중" aria-busy="true">
		{Array.from({ length: 9 }, (_, i) => (
			<li key={i} style={{ '--i': i, '--w': `${55 + ((i * 37) % 40)}%` } as React.CSSProperties} />
		))}
	</ul>
);

/** 글 파일: 줄 번호와 함께, 마크다운 제목 줄은 굵게 */
const FileText: React.FC<{ text: string; markdown: boolean }> = ({ text, markdown }) => {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	return (
		<pre className="rp-file-text" tabIndex={0}>
			<code>
				{lines.map((line, i) => (
					<span key={i} className={`rp-line${markdown && /^#{1,6}\s/.test(line) ? ' heading' : ''}`}>
						<span className="rp-ln" aria-hidden="true">
							{i + 1}
						</span>
						<span className="rp-lc">{line || ' '}</span>
					</span>
				))}
			</code>
		</pre>
	);
};

/** 파일 내용 칸: 글은 줄마다, 그림은 '열지 않음', 폴더는 안내 */
const FileView: React.FC<{ project: Project; path: string[]; node: RepoNode | undefined }> = ({
	project,
	path,
	node,
}) => {
	const name = path[path.length - 1] ?? '';
	const branchUrl = `${project.url.replace(/\/+$/, '')}/blob/main/${path.map(encodeURIComponent).join('/')}`;
	if (node === undefined) return <p className="rp-empty">왼쪽에서 파일을 고르면 여기에 내용이 보입니다.</p>;
	if (isDir(node)) return <p className="rp-empty">폴더입니다. 왼쪽에서 펼쳐 파일을 고르세요.</p>;
	if (node === null)
		return (
			<p className="rp-empty">
				<i className="fa-regular fa-file-image" aria-hidden="true" /> 그림·바이너리 파일은 여기서 열지 않습니다.{' '}
				<a href={branchUrl} {...external}>
					GitHub에서 보기
				</a>
			</p>
		);
	const lines = node.split('\n').length;
	return (
		<>
			<div className="rp-file-bar">
				<span className="rp-mono">
					{lines} lines · {new Blob([node]).size} Bytes
				</span>
				<a href={branchUrl} {...external}>
					Raw <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
				</a>
			</div>
			<FileText text={node} markdown={/\.md$/i.test(name)} />
		</>
	);
};

const CodeTab: React.FC<{
	project: Project;
	repo: RepoDir | null;
	error: string | null;
	state: TreeState;
}> = ({ project, repo, error, state }) => {
	const selected = state.selected;
	const node = repo && selected ? nodeAt(repo, selected) : undefined;
	return (
		<div className="rp-code">
			<nav className="rp-crumbs" aria-label="경로">
				<button type="button" className="rp-crumb" onClick={() => state.select([])}>
					{repoName(project)}
				</button>
				{selected?.map((part, i) => (
					<React.Fragment key={i}>
						<span className="rp-slash" aria-hidden="true">
							/
						</span>
						<span className={`rp-crumb${i === selected.length - 1 ? ' current' : ''}`}>{part}</span>
					</React.Fragment>
				))}
			</nav>
			<div className="rp-code-grid">
				<aside className="rp-tree" aria-label="파일">
					{repo ? (
						<TreeList dir={repo} path={[]} state={state} depth={0} />
					) : error ? (
						<p className="rp-empty">{error}</p>
					) : (
						<TreeSkeleton />
					)}
				</aside>
				<Region label="파일 내용" className="rp-file">
					{repo ? (
						<FileView project={project} path={selected ?? []} node={selected?.length ? node : undefined} />
					) : (
						<div className="rp-file-skeleton" aria-hidden="true">
							{Array.from({ length: 12 }, (_, i) => (
								<span key={i} style={{ '--i': i, '--w': `${30 + ((i * 53) % 60)}%` } as React.CSSProperties} />
							))}
						</div>
					)}
				</Region>
			</div>
		</div>
	);
};

/* ─── Commits 탭 ─── */

const CommitsTab: React.FC<{ project: Project; commits: Commit[] }> = ({ project, commits }) => {
	const [filter, setFilter] = useState<string | null>(null);
	const types = useMemo(
		() => Array.from(new Set(commits.map((commit) => commit.type).filter((type): type is string => Boolean(type)))),
		[commits]
	);
	const shown = filter ? commits.filter((commit) => commit.type === filter) : commits;
	const owner = ownerOf(project) ?? USER;
	return (
		<div className="rp-commits">
			{types.length > 0 && (
				<div className="rp-chips" role="group" aria-label="커밋 타입으로 거르기">
					<button type="button" className="rp-chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
						전체 <span className="rp-count">{commits.length}</span>
					</button>
					{types.map((type) => (
						<button
							key={type}
							type="button"
							className="rp-chip"
							style={typeStyle(type)}
							aria-pressed={filter === type}
							onClick={() => setFilter(filter === type ? null : type)}
						>
							{type}
						</button>
					))}
				</div>
			)}
			<ol className="rp-log" aria-label="커밋 목록" key={filter ?? '*'}>
				{shown.map((commit, i) => (
					<li key={commit.hash} className="rp-commit" style={{ '--i': i } as React.CSSProperties}>
						<span className="rp-node-dot" aria-hidden="true" />
						<div className="rp-commit-card">
							<p className="rp-commit-msg">
								{commit.type && (
									<span className="rp-badge" style={typeStyle(commit.type)}>
										{commit.type}
									</span>
								)}
								{commit.message}
							</p>
							<p className="rp-commit-meta">
								<span className="rp-author">{owner}</span> committed · <time>{commit.date}</time>
							</p>
						</div>
						<span className="rp-hash rp-mono">{commit.hash}</span>
					</li>
				))}
			</ol>
			{shown.length === 0 && <p className="rp-empty">이 타입의 커밋이 없습니다.</p>}
		</div>
	);
};

/* ─── README 탭 ─── */

const ReadmeTab: React.FC<{ project: Project }> = ({ project }) => (
	<div className="rp-readme">
		<div className="rp-readme-bar">
			<i className="fa-solid fa-list-ul" aria-hidden="true" /> README.md
		</div>
		<div className="rp-md">
			<h1>{project.tagline || project.name}</h1>
			{project.description && <p>{project.description}</p>}
			{project.highlights.length > 0 && (
				<Region label="주요 기능">
					<h2>주요 기능</h2>
					<ul>
						{project.highlights.map((point) => (
							<li key={point.title}>
								<strong>{point.title}</strong> — {point.body}
							</li>
						))}
					</ul>
				</Region>
			)}
			{project.build.length > 0 && (
				<Region label="만든 방식">
					<h2>만든 방식</h2>
					{project.build.map((point) => (
						<React.Fragment key={point.title}>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</React.Fragment>
					))}
				</Region>
			)}
			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법">
					<h2>쓰는 법</h2>
					<ol>
						{project.usage.map((point) => (
							<li key={point.title}>
								<strong>{point.title}</strong> — {point.body}
							</li>
						))}
					</ol>
				</Region>
			)}
			{project.structure && (
				<Region label="폴더 구조">
					<h2>폴더 구조</h2>
					<pre>
						<code>{project.structure}</code>
					</pre>
				</Region>
			)}
		</div>
	</div>
);

/* ─── Conventions 탭 ─── */

const ConventionsTab: React.FC<{ project: Project }> = ({ project }) => (
	<div className="rp-conventions">
		<p className="rp-section-lead">
			커밋 메시지는 <code className="rp-mono">type: 요약</code> 꼴로 쓰고, 타입은 아래 표에서 고른다.
		</p>
		<table className="rp-table">
			<thead>
				<tr>
					<th scope="col">type</th>
					<th scope="col">설명</th>
				</tr>
			</thead>
			<tbody>
				{project.conventions?.map((convention, i) => (
					<tr key={convention.type} style={{ '--i': i } as React.CSSProperties}>
						<td>
							<span className="rp-badge" style={typeStyle(convention.type)}>
								{convention.type}
							</span>
						</td>
						<td>{convention.description}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/* ─── About 탭 ─── */

/** 기여 그래프 모양의 장식: 프로젝트 이름으로 늘 같은 무늬 (실제 기록은 아니다) */
const Heat: React.FC<{ seed: string }> = ({ seed }) => {
	const cells = useMemo(() => {
		const hex = Array.from({ length: 6 }, (_, i) => fakeHash(`${seed}:${i}`)).join('');
		return Array.from({ length: 7 * 26 }, (_, i) => {
			const value = parseInt(hex[i % hex.length], 16);
			return value < 7 ? 0 : value < 10 ? 1 : value < 13 ? 2 : value < 15 ? 3 : 4;
		});
	}, [seed]);
	return (
		<div className="rp-heat" aria-hidden="true">
			{cells.map((level, i) => (
				<i key={i} data-level={level} style={{ '--i': Math.floor(i / 7) } as React.CSSProperties} />
			))}
		</div>
	);
};

const AboutTab: React.FC<{ project: Project }> = ({ project }) => (
	<div className="rp-about">
		<div className="rp-about-main">
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="rp-card">
					<h2>
						<i className="fa-solid fa-layer-group" aria-hidden="true" /> 기술 사양
					</h2>
					<dl className="rp-specs">
						{project.specs.map((spec) => (
							<div key={spec.label}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</Region>
			)}
			{(project.contributions.length > 0 || project.role) && (
				<Region label="맡은 일" className="rp-card">
					<h2>
						<i className="fa-solid fa-user-check" aria-hidden="true" /> 맡은 일
					</h2>
					{project.role && <p className="rp-role">{project.role}</p>}
					<ul className="rp-checks">
						{project.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</Region>
			)}
			<div className="rp-card rp-heat-card">
				<h2>
					<i className="fa-solid fa-table-cells" aria-hidden="true" /> 활동 무늬 <small>(장식)</small>
				</h2>
				<Heat seed={project.id} />
			</div>
		</div>
		<aside className="rp-about-side" aria-label="정보">
			<h2>About</h2>
			{project.description && <p>{project.description}</p>}
			<dl className="rp-side-list">
				{project.context && (
					<div>
						<dt>
							<i className="fa-solid fa-circle-info" aria-hidden="true" />
						</dt>
						<dd>{project.context}</dd>
					</div>
				)}
				{project.period && (
					<div>
						<dt>
							<i className="fa-regular fa-calendar" aria-hidden="true" />
						</dt>
						<dd>{project.period}</dd>
					</div>
				)}
				<div>
					<dt>
						<i className="fa-solid fa-code" aria-hidden="true" />
					</dt>
					<dd>{project.language}</dd>
				</div>
			</dl>
			<Links project={project} className="rp-side-links" />
			{project.credits && project.credits.length > 0 && (
				<>
					<h3>Credits</h3>
					<ul className="rp-credits">
						{project.credits.map((credit) => (
							<li key={credit.name}>
								<span className="rp-muted">{credit.role}</span>{' '}
								{credit.href ? (
									<a href={credit.href} {...external}>
										{credit.name}
									</a>
								) : (
									credit.name
								)}{' '}
								<span className="rp-muted">· {credit.by}</span>
							</li>
						))}
					</ul>
				</>
			)}
		</aside>
	</div>
);

/* ─── 터미널 서랍 ─── */

/** 페이지 명령의 결과: 소개·숫자·진행 과정·실습 프로젝트·컨벤션·만든 방식·맡은 일·기술 사양 */
const PageOut: React.FC<{ project: Project; view: PageView }> = ({ project, view }) => {
	switch (view) {
		case 'about':
			return (
				<>
					<p className="rp-t-h"># {project.name}</p>
					<p className="rp-t-strong">{project.tagline}</p>
					<p>{project.description}</p>
				</>
			);
		case 'stat':
			return (
				<dl className="rp-t-pairs">
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
		case 'log':
			return (
				<ol className="rp-t-log">
					{commitsOf(project).map((commit) => (
						<li key={commit.hash}>
							<span className="rp-t-hash">{commit.hash}</span>
							<span className="rp-t-date">{commit.date}</span>
							<span>{commit.message}</span>
						</li>
					))}
				</ol>
			);
		case 'projects':
			return (
				<ul className="rp-t-ls">
					{project.highlights.map((point) => (
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
					{project.conventions?.map((convention) => (
						<li key={convention.type}>
							<span className="rp-badge" style={typeStyle(convention.type)}>
								{convention.type}
							</span>
							<span>{convention.description}</span>
						</li>
					))}
				</ul>
			);
		case 'build':
			return (
				<>
					{project.build.map((point) => (
						<div key={point.title}>
							<p className="rp-t-h">## {point.title}</p>
							<p>{point.body}</p>
						</div>
					))}
				</>
			);
		case 'whoami':
			return (
				<>
					{project.role && <p>{project.role}</p>}
					<ul className="rp-t-list">
						{project.contributions.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</>
			);
		case 'stack':
			return (
				<pre className="rp-t-json">
					{'{\n'}
					{project.specs.map((spec, i) => (
						<React.Fragment key={spec.label}>
							{'  '}
							<span className="rp-t-key">"{spec.label}"</span>
							{': '}
							<span className="rp-t-str">"{spec.value}"</span>
							{i < project.specs.length - 1 ? ',\n' : '\n'}
						</React.Fragment>
					))}
					{'}'}
				</pre>
			);
	}
};

type Entry = { id: number; input: string; cwd: string[]; output: Output };

const OutputView: React.FC<{ project: Project; entry: Entry; run: (text: string) => void }> = ({
	project,
	entry,
	run,
}) => {
	const { output } = entry;
	switch (output.kind) {
		case 'page':
			return (
				<Region label={output.command.label} as="div" className="rp-t-out">
					<PageOut project={project} view={output.command.view} />
				</Region>
			);
		case 'help':
			return (
				<dl className="rp-t-help">
					{pageCommands(project).map((command) => (
						<div key={command.name}>
							<dt>
								<button type="button" onClick={() => run(command.name)}>
									{command.name}
								</button>
							</dt>
							<dd>{command.help}</dd>
						</div>
					))}
					{SHELL_COMMANDS.map((command) => (
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
			return (
				<ul className="rp-t-files">
					{output.items.map((item) => (
						<li key={item.name}>
							<button
								type="button"
								className={item.dir ? 'dir' : ''}
								onClick={() => run(commandFor(item.name, item.dir, output.path, entry.cwd))}
							>
								<i className={fileIcon(item.name, item.dir)} aria-hidden="true" /> {item.name}
								{item.dir ? '/' : ''}
							</button>
						</li>
					))}
				</ul>
			);
		case 'tree':
			return <pre className="rp-t-pre">{output.lines.join('\n')}</pre>;
		case 'file':
			return output.text === null ? (
				<p className="rp-t-err">{output.name}: 그림·바이너리 파일은 터미널에서 열 수 없습니다 (Code 탭에서 보세요)</p>
			) : (
				<pre className="rp-t-pre">{output.text}</pre>
			);
		case 'text':
			return <p>{output.text}</p>;
		case 'error':
			return <p className="rp-t-err">{output.text}</p>;
		case 'links':
			return <Links project={project} className="rp-t-links" />;
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

/** 아래에서 올라오는 터미널: terminalShell.ts의 명령을 받아 결과를 서랍 안에 그린다 */
const Drawer: React.FC<{ project: Project; repo: RepoDir | null; open: boolean; onToggle: () => void }> = ({
	project,
	repo,
	open,
	onToggle,
}) => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [cwd, setCwd] = useState<string[]>([]);
	const [past, setPast] = useState<string[]>([]);
	const [value, setValue] = useState('');
	const [cursor, setCursor] = useState<number | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const body = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	const name = repoName(project);
	const withRepo = hasRepoTree(project);

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
			const simple = runSimple(project, trimmed, cwd, past);
			let output: Output;
			if (simple) output = simple;
			else if (withRepo && !repo)
				output = { kind: 'error', text: '저장소를 아직 불러오는 중입니다. 잠시 뒤 다시 쳐 주세요' };
			else {
				const result = runRepo(repo ?? {}, trimmed, cwd);
				output = result.output;
				setCwd(result.cwd);
			}
			setEntries((list) => [...list, { id: nextId.current++, input: trimmed, cwd, output }]);
		},
		[project, cwd, past, repo, withRepo]
	);

	// 새 결과가 생기면 맨 아래로
	useEffect(() => {
		body.current?.scrollTo({ top: body.current.scrollHeight });
	}, [entries]);

	useEffect(() => {
		if (open) input.current?.focus();
	}, [open]);

	const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Tab') {
			event.preventDefault();
			setValue(complete(project, repo, cwd, value));
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
		}
	};

	return (
		<footer className={`rp-footer${open ? ' open' : ''}`}>
			<div className="rp-drawer" role="region" aria-label="터미널" hidden={!open}>
				<div className="rp-drawer-head">
					<span className="rp-mono">
						<i className="fa-solid fa-terminal" aria-hidden="true" /> {USER}:{promptPath(name, cwd)}
					</span>
					<button type="button" className="rp-drawer-x" aria-label="터미널 닫기" onClick={onToggle}>
						<i className="fa-solid fa-xmark" aria-hidden="true" />
					</button>
				</div>
				<div className="rp-drawer-body" ref={body}>
					<p className="rp-t-hint">
						`help`를 치면 명령 목록이 나옵니다.{withRepo ? ' ls·cd·cat·tree로 저장소를 돌아볼 수 있습니다.' : ''}
					</p>
					{entries.map((entry) => (
						<div key={entry.id} className="rp-t-entry">
							<p className="rp-t-prompt">
								<span className="rp-t-path">{promptPath(name, entry.cwd)}</span>
								<span className="rp-t-dollar">$</span> <code>{entry.input}</code>
							</p>
							<OutputView project={project} entry={entry} run={run} />
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
					{suggested(project, withRepo).map((text) => (
						<button key={text} type="button" onClick={() => run(text)}>
							{text}
						</button>
					))}
				</div>
			</div>
			<div className="rp-statusbar">
				<button type="button" className="rp-term-btn" aria-expanded={open} onClick={onToggle}>
					<i className="fa-solid fa-terminal" aria-hidden="true" /> 터미널
					<i className={`fa-solid fa-chevron-up rp-term-chev${open ? ' open' : ''}`} aria-hidden="true" />
				</button>
				<span className="rp-status-right rp-mono">
					<i className="fa-solid fa-code-branch" aria-hidden="true" /> main
					{project.period && <span>· {project.period}</span>}
				</span>
			</div>
		</footer>
	);
};

/* ─── 페이지 ─── */

const RepoPage: React.FC<{ project: Project }> = ({ project }) => {
	const withRepo = hasRepoTree(project);
	const commits = useMemo(() => commitsOf(project), [project]);
	const tabs = useMemo(() => {
		const list: { id: TabId; label: string; icon: string; count?: number }[] = [];
		if (withRepo) list.push({ id: 'code', label: 'Code', icon: 'fa-solid fa-code' });
		if (commits.length > 0)
			list.push({ id: 'commits', label: 'Commits', icon: 'fa-solid fa-clock-rotate-left', count: commits.length });
		list.push({ id: 'readme', label: 'README', icon: 'fa-solid fa-book' });
		if (project.conventions?.length)
			list.push({
				id: 'conventions',
				label: 'Conventions',
				icon: 'fa-solid fa-tags',
				count: project.conventions.length,
			});
		list.push({ id: 'about', label: 'About', icon: 'fa-solid fa-circle-info' });
		return list;
	}, [withRepo, commits.length, project.conventions]);
	const [active, setActive] = useState<TabId>(tabs[0].id);
	const [drawer, setDrawer] = useState(false);

	// 트리 상태는 탭을 오가도 남는다 (처음 고른 파일은 저장소를 불러올 때 맨 위 README.md로 둔다)
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const [selected, setSelected] = useState<string[] | null>(null);

	// 저장소 트리: 있는 프로젝트만 불러온다
	const [repo, setRepo] = useState<RepoDir | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!withRepo) return;
		let alive = true;
		loadRepo()
			.then((tree) => {
				if (!alive) return;
				setRepo(tree);
				setSelected((current) => current ?? (typeof tree['README.md'] === 'string' ? ['README.md'] : null));
			})
			.catch(
				(cause: unknown) => alive && setError(cause instanceof Error ? cause.message : '저장소를 불러오지 못했습니다')
			);
		return () => {
			alive = false;
		};
	}, [withRepo]);

	const treeState: TreeState = {
		expanded,
		selected,
		toggle: (path) =>
			setExpanded((set) => {
				const next = new Set(set);
				const key = keyOf(path);
				if (next.has(key)) next.delete(key);
				else next.add(key);
				return next;
			}),
		select: (path) => setSelected(path),
	};

	// 움직임 줄이기면 커밋 점·트리 펼침·서랍이 즉시 상태로 (CSS도 막지만 지연 변수를 0으로 두어 확실히)
	const still = prefersReducedMotion();

	return (
		<div className={`rp${still ? ' still' : ''}`}>
			<Head project={project} />
			<Tabs tabs={tabs} active={active} onChange={setActive} />
			<div
				className="rp-main"
				role="region"
				id={`rp-panel-${active}`}
				aria-labelledby={`rp-tab-${active}`}
				key={active}
			>
				{active === 'code' && <CodeTab project={project} repo={repo} error={error} state={treeState} />}
				{active === 'commits' && <CommitsTab project={project} commits={commits} />}
				{active === 'readme' && <ReadmeTab project={project} />}
				{active === 'conventions' && <ConventionsTab project={project} />}
				{active === 'about' && <AboutTab project={project} />}
			</div>
			<Drawer project={project} repo={repo} open={drawer} onToggle={() => setDrawer((value) => !value)} />
		</div>
	);
};

export default RepoPage;

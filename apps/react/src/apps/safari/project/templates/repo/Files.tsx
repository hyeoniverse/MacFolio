// repo 템플릿의 파일 상자 (GitHub 저장소 첫 화면의 파일 목록): 맨 위에 마지막 커밋 줄, 아래에 파일 트리.
// DevCourse처럼 저장소 트리(repo.json)가 있으면 왼쪽 트리와 오른쪽 파일 내용으로 나뉜 탐색기, 아니면 폴더 구조로 만든 트리를 펼쳐 본다.
// 폴더를 누르면 자식이 미끄러져 나오고, 파일을 누르면(탐색기) 내용이 줄 번호와 함께 보인다
import React, { useState } from 'react';
import { entries, isDir, nodeAt, type RepoDir, type RepoNode } from '@/apps/safari/project/terminalRepo';
import { fileIcon, type Commit, type StructureRepo } from './repo';
import { TypeBadge } from './bits';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const keyOf = (path: string[]) => path.join('/');

type TreeState = {
	expanded: Set<string>;
	selected: string[] | null;
	toggle: (path: string[]) => void;
	/** 없으면 파일은 고를 수 없다 (내용이 없는 폴더 구조 트리) */
	select?: (path: string[]) => void;
	notes?: Record<string, string>;
};

/** 폴더 하나의 항목들. 펼친 폴더의 자식은 아래로 미끄러져 나온다 */
const TreeList: React.FC<{ dir: RepoDir; path: string[]; state: TreeState; depth: number; label?: string }> = ({
	dir,
	path,
	state,
	depth,
	label,
}) => (
	<ul className="rp-tree-list" role={depth === 0 ? 'tree' : 'group'} aria-label={label}>
		{entries(dir).map((entry) => {
			const here = [...path, entry.name];
			const key = keyOf(here);
			const open = state.expanded.has(key);
			const selected = state.selected !== null && keyOf(state.selected) === key;
			const note = state.notes?.[key];
			const inner = (
				<>
					<span className="rp-node-name">
						{entry.dir ? (
							<i className={`rp-chev fa-solid fa-chevron-right${open ? ' open' : ''}`} aria-hidden="true" />
						) : (
							<span className="rp-chev" aria-hidden="true" />
						)}
						<i className={`rp-file-icon ${fileIcon(entry.name, entry.dir, open)}`} aria-hidden="true" />
						<span className="rp-node-label">{entry.name}</span>
					</span>
					{note && <span className="rp-node-note">{note}</span>}
				</>
			);
			const style = { '--depth': depth } as React.CSSProperties;
			return (
				<li
					key={entry.name}
					role="treeitem"
					aria-expanded={entry.dir ? open : undefined}
					aria-selected={state.select ? selected : undefined}
				>
					{entry.dir || state.select ? (
						<button
							type="button"
							className={`rp-node${selected ? ' selected' : ''}`}
							style={style}
							data-path={key}
							onClick={() => (entry.dir ? state.toggle(here) : state.select?.(here))}
						>
							{inner}
						</button>
					) : (
						<span className="rp-node" style={style} data-path={key}>
							{inner}
						</span>
					)}
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

/** 파일 내용 칸: 글은 줄마다, 그림은 열지 않고 GitHub 링크, 폴더는 안내 */
const FileView: React.FC<{ href?: string; path: string[]; node: RepoNode | undefined }> = ({ href, path, node }) => {
	const name = path[path.length - 1] ?? '';
	const blob = href ? `${href.replace(/\/+$/, '')}/blob/main/${path.map(encodeURIComponent).join('/')}` : undefined;
	if (node === undefined || isDir(node))
		return <p className="rp-empty">왼쪽에서 파일을 고르면 여기에 내용이 보입니다.</p>;
	if (node === null)
		return (
			<p className="rp-empty">
				<i className="fa-regular fa-file-image" aria-hidden="true" /> 그림이나 바이너리 파일은 여기서 열지 않습니다.{' '}
				{blob && (
					<a href={blob} {...external}>
						GitHub에서 열기
					</a>
				)}
			</p>
		);
	return (
		<>
			<div className="rp-file-bar">
				<span className="rp-mono">
					{node.split('\n').length} lines · {new Blob([node]).size} Bytes
				</span>
				{blob && (
					<a href={blob} {...external}>
						Raw <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
					</a>
				)}
			</div>
			<FileText text={node} markdown={/\.md$/i.test(name)} />
		</>
	);
};

/** 트리를 불러오는 동안의 자리표 */
const Skeleton: React.FC<{ rows: number }> = ({ rows }) => (
	<div className="rp-skeleton" aria-hidden="true">
		{Array.from({ length: rows }, (_, i) => (
			<span key={i} style={{ '--i': i, '--w': `${40 + ((i * 37) % 50)}%` } as React.CSSProperties} />
		))}
	</div>
);

/** 마지막 커밋 줄: 아바타, owner, 메시지, 해시, 날짜, 커밋 수 */
const LatestCommit: React.FC<{
	owner: string;
	icon?: string;
	commit: Commit;
	count: number;
	onCommits?: () => void;
}> = ({ owner, icon, commit, count, onCommits }) => (
	<div className="rp-latest">
		<span className="rp-latest-who">
			{icon ? (
				<img className="rp-avatar rp-avatar-sm" src={icon} alt="" />
			) : (
				<span className="rp-avatar rp-avatar-sm rp-avatar-blank" aria-hidden="true">
					<i className="fa-solid fa-user" />
				</span>
			)}
			<strong>{owner}</strong>
		</span>
		<span className="rp-latest-msg">
			{commit.type && <TypeBadge type={commit.type} />}
			{commit.message}
		</span>
		<span className="rp-latest-meta">
			<code className="rp-mono">{commit.hash}</code>
			{commit.date && (
				<>
					<span aria-hidden="true">·</span>
					<time>{commit.date}</time>
				</>
			)}
		</span>
		{onCommits && (
			<button type="button" className="rp-latest-count" onClick={onCommits}>
				<i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
				<strong>{count}</strong> Commits
			</button>
		)}
	</div>
);

export type FileSource =
	{ kind: 'browser'; repo: RepoDir | null; error: string | null } | { kind: 'list'; structure?: StructureRepo };

/** 파일 상자 */
export const Files: React.FC<{
	source: FileSource;
	owner: string;
	icon?: string;
	name: string;
	href?: string;
	latest: Commit;
	count: number;
	onCommits?: () => void;
	/** README.md 줄을 누르면 (README 상자로 내려간다) */
	onReadme?: () => void;
}> = ({ source, owner, icon, name, href, latest, count, onCommits, onReadme }) => {
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	const [picked, setPicked] = useState<string[] | null>(null);
	const toggle = (path: string[]) =>
		setExpanded((set) => {
			const next = new Set(set);
			const key = keyOf(path);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	const head = <LatestCommit owner={owner} icon={icon} commit={latest} count={count} onCommits={onCommits} />;

	if (source.kind === 'browser') {
		const { repo, error } = source;
		// 처음에는 맨 위의 README.md를 골라 둔다
		const selected = picked ?? (repo && typeof repo['README.md'] === 'string' ? ['README.md'] : null);
		const node = repo && selected ? nodeAt(repo, selected) : undefined;
		return (
			<div className="rp-files rp-browser">
				{head}
				<nav className="rp-crumbs" aria-label="경로">
					<button type="button" className="rp-crumb" onClick={() => setPicked([])}>
						{name}
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
				<div className="rp-browser-grid">
					<div className="rp-tree">
						{repo ? (
							<TreeList
								dir={repo}
								path={[]}
								state={{ expanded, selected, toggle, select: setPicked }}
								depth={0}
								label="파일"
							/>
						) : error ? (
							<p className="rp-empty">{error}</p>
						) : (
							<Skeleton rows={9} />
						)}
					</div>
					<figure className="rp-file" aria-label="파일 내용">
						{repo ? (
							<FileView href={href} path={selected ?? []} node={selected?.length ? node : undefined} />
						) : (
							<Skeleton rows={12} />
						)}
					</figure>
				</div>
			</div>
		);
	}

	const dir: RepoDir = { ...(source.structure?.dir ?? {}) };
	return (
		<div className="rp-files">
			{head}
			<div className="rp-list">
				{Object.keys(dir).length > 0 && (
					<TreeList
						dir={dir}
						path={[]}
						state={{ expanded, selected: null, toggle, notes: source.structure?.notes }}
						depth={0}
						label="파일"
					/>
				)}
				<button type="button" className="rp-node rp-readme-row" onClick={onReadme} disabled={!onReadme}>
					<span className="rp-node-name">
						<span className="rp-chev" aria-hidden="true" />
						<i className="rp-file-icon fa-regular fa-file-lines" aria-hidden="true" />
						<span className="rp-node-label">README.md</span>
					</span>
					<span className="rp-node-note">{latest.message}</span>
				</button>
			</div>
		</div>
	);
};

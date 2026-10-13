// repo 템플릿: GitHub 저장소 화면을 흉내 낸다. 맨 위는 가벼운 첫 화면(배지, 큰 제목, 링크와 복사되는 clone 명령, 브라우저 창 속 대표 화면,
// 그림이 없으면 README.md를 쓰는 편집기), 그 아래 저장소 머리(owner / 이름, Public, Code 단추)와 탭 줄(Code · Commits · Conventions).
// Code 탭은 저장소 첫 화면이다: 마지막 커밋 줄과 파일 트리(DevCourse는 실제 저장소 탐색기, 다른 프로젝트는 폴더 구조), README(모든 랜딩 구역),
// 옆 칸(About·Releases·Languages). Commits 탭은 진행 과정을 커밋 그래프로 그리고 타입으로 거른다. Conventions 탭은 커밋 규칙 표.
// 맨 아래 상태 줄의 터미널 단추를 누르면 서랍이 올라온다. Safari 창의 탭(role=tab)과 섞이지 않게 저장소 탭은 nav와 단추(aria-current)다.
// 계약은 templates/README.md
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	LandingLinks,
	Media,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingSection,
	type SectionOf,
} from '@/apps/safari/project/landing';
import { loadRepo, type RepoDir } from '@/apps/safari/project/terminalRepo';
import { repoAccent } from './accent';
import { CopyButton, TypeBadge } from './bits';
import { Files, type FileSource } from './Files';
import { ReadmeSections } from './Readme';
import { Terminal } from './Terminal';
import {
	cloneUrl,
	commitsOf,
	fakeHash,
	LANGUAGE_COLORS,
	readmeSource,
	repoOf,
	structureRepo,
	tagsOf,
	typeStyle,
	type Commit,
} from './repo';
import './Page.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 저장소 트리(repo.json)가 있는 프로젝트: 파일 상자가 실제 저장소 탐색기가 된다 */
const hasRepoTree = (project: Project) => project.id === 'devcourse';

const find = <K extends LandingSection['kind']>(landing: Landing, kind: K) =>
	landing.sections.find((section): section is SectionOf<K> => section.kind === kind);

/* ─── 첫 화면 ─── */

/** 그림이 없을 때 첫 화면 창에 보이는 편집기: README.md 원문을 줄 번호와 함께 (장식) */
const Editor: React.FC<{ lines: string[] }> = ({ lines }) => (
	<div className="rp-editor" aria-hidden="true">
		<div className="rp-editor-tabs">
			<span className="rp-editor-tab">
				<i className="fa-regular fa-file-lines" />
				README.md
			</span>
		</div>
		<pre className="rp-editor-code">
			{lines.map((line, i) => (
				<span key={i} className="rp-editor-line" data-kind={/^#/.test(line) ? 'h' : /^[->`]/.test(line) ? 'm' : ''}>
					<span className="rp-ln">{i + 1}</span>
					<span className="rp-lc">{line || ' '}</span>
				</span>
			))}
		</pre>
	</div>
);

const Hero: React.FC<{ landing: Landing; language?: string; host: string; clone?: string }> = ({
	landing,
	language,
	host,
	clone,
}) => {
	const { hero } = landing;
	const badge = [language, hero.meta.context].filter(Boolean).join(' · ');
	return (
		<header className="rp-hero">
			<p className="rp-hero-badge">
				<span className="rp-hero-badge-tag">
					<i className="fa-brands fa-github" aria-hidden="true" /> Public
				</span>
				{badge || hero.name}
			</p>
			<h1>{hero.headline}</h1>
			{hero.subhead && <p className="rp-hero-lead">{hero.subhead}</p>}
			{(hero.links.length > 0 || clone) && (
				<div className="rp-hero-actions">
					<LandingLinks links={hero.links} className="rp-links" />
					{clone && (
						<span className="rp-clone-line">
							<span className="rp-clone-prompt" aria-hidden="true">
								$
							</span>
							<code className="rp-clone-text">git clone {clone}</code>
							<CopyButton text={`git clone ${clone}`} label="clone 명령 복사" className="rp-icon-btn" />
						</span>
					)}
				</div>
			)}
			<div className="rp-window" data-reveal="zoom">
				<div className="rp-window-bar" aria-hidden="true">
					<span className="rp-window-dots">
						<span />
						<span />
						<span />
					</span>
					<span className="rp-window-url">
						<i className="fa-solid fa-lock" />
						{host}
					</span>
				</div>
				<div className="rp-window-body">
					{hero.image ? (
						<Media media={hero.image} eager className="rp-window-media" />
					) : (
						<Editor lines={readmeSource(landing, clone)} />
					)}
				</div>
			</div>
		</header>
	);
};

/* ─── 저장소 머리 ─── */

/** owner / 이름, Public, 'Code ▾' 단추(누르면 clone 주소) */
const RepoHead: React.FC<{ owner?: string; name: string; icon?: string; href?: string; clone?: string }> = ({
	owner,
	name,
	icon,
	href,
	clone,
}) => {
	const [open, setOpen] = useState(false);
	const wrap = useRef<HTMLDivElement>(null);

	// 바깥을 누르거나 Esc를 누르면 닫힌다
	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (!wrap.current?.contains(event.target as Node)) setOpen(false);
		};
		const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', escape);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', escape);
		};
	}, [open]);

	return (
		<div className="rp-head-row">
			<p className="rp-title">
				{icon ? (
					<img className="rp-avatar" src={icon} alt="" />
				) : (
					<span className="rp-avatar rp-avatar-blank" aria-hidden="true">
						<i className="fa-regular fa-bookmark" />
					</span>
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
				{href ? (
					<a className="rp-repo" href={href} {...external}>
						{name}
					</a>
				) : (
					<strong className="rp-repo">{name}</strong>
				)}
				<span className="rp-visibility">Public</span>
			</p>
			{clone && (
				<div className="rp-actions" ref={wrap}>
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
								<CopyButton text={clone} label="clone 주소 복사" />
							</div>
							<p className="rp-pop-note">HTTPS 주소로 저장소를 내려받을 수 있습니다.</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

/* ─── 탭 ─── */

type TabId = 'code' | 'commits' | 'conventions';
type Tab = { id: TabId; label: string; icon: string; count?: number };

/** 탭 줄. 고른 탭 밑의 밑줄은 자리와 너비를 재서 미끄러진다 */
const Tabs: React.FC<{ tabs: Tab[]; active: TabId; onChange: (id: TabId) => void }> = ({ tabs, active, onChange }) => {
	const list = useRef<HTMLElement>(null);
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
		list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
	};

	return (
		<nav className="rp-tabs" aria-label="저장소 탭" ref={list}>
			{tabs.map((tab, index) => (
				<button
					key={tab.id}
					type="button"
					data-tab={tab.id}
					aria-current={active === tab.id ? 'page' : undefined}
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

/* ─── Code 탭의 옆 칸 ─── */

/** GitHub 저장소 첫 화면의 옆 칸: 소개와 주소·주제, 마지막 릴리스, 언어 */
const Side: React.FC<{ landing: Landing; language?: string; demo?: string }> = ({ landing, language, demo }) => {
	const { hero } = landing;
	const tech = find(landing, 'tech');
	const timeline = find(landing, 'timeline');
	const topics = tech?.stack ?? [];
	const meta = [
		hero.meta.context && { icon: 'fa-solid fa-circle-info', text: hero.meta.context, label: '프로젝트' },
		hero.meta.role && { icon: 'fa-regular fa-user', text: hero.meta.role, label: '역할' },
		hero.meta.period && { icon: 'fa-regular fa-calendar', text: hero.meta.period, label: '기간' },
	].filter(Boolean) as { icon: string; text: string; label: string }[];
	const about = Boolean(hero.subhead || demo || topics.length || meta.length);
	const last = timeline?.entries[timeline.entries.length - 1];
	if (!about && !last && !language) return null;
	return (
		<div className="rp-side">
			{about && (
				<div className="rp-side-box">
					<h2>About</h2>
					{hero.subhead && <p className="rp-side-desc">{hero.subhead}</p>}
					{demo && (
						<a className="rp-side-link" href={demo} {...external}>
							<i className="fa-solid fa-link" aria-hidden="true" />
							{demo.replace(/^https?:\/\//, '').replace(/\/+$/, '')}
						</a>
					)}
					{topics.length > 0 && (
						<ul className="rp-topics rp-topics-sm" aria-label="주제">
							{topics.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
					{meta.length > 0 && (
						<dl className="rp-side-meta">
							{meta.map((item) => (
								<div key={item.label}>
									<dt>
										<i className={item.icon} aria-hidden="true" />
										<span className="visually-hidden">{item.label}</span>
									</dt>
									<dd>{item.text}</dd>
								</div>
							))}
						</dl>
					)}
				</div>
			)}
			{timeline && last && (
				<div className="rp-side-box">
					<h2>
						Releases <span className="rp-count">{timeline.entries.length}</span>
					</h2>
					<p className="rp-side-release">
						<i className="fa-solid fa-tag" aria-hidden="true" />
						<span>
							<span className="rp-side-release-name">
								<strong>{tagsOf(timeline.entries.length).pop()}</strong>
								<span className="rp-latest-badge">Latest</span>
							</span>
							<span className="rp-side-release-label">{last.label}</span>
							<time>{last.date}</time>
						</span>
					</p>
				</div>
			)}
			{language && (
				<div className="rp-side-box">
					<h2>Languages</h2>
					<span
						className="rp-lang-bar"
						style={{ background: LANGUAGE_COLORS[language] ?? 'var(--tpl-accent)' }}
						aria-hidden="true"
					/>
					<p className="rp-lang">
						<i
							className="rp-dot"
							style={{ background: LANGUAGE_COLORS[language] ?? 'var(--tpl-accent)' }}
							aria-hidden="true"
						/>
						<strong>{language}</strong>
						<span className="rp-muted">100%</span>
					</p>
				</div>
			)}
		</div>
	);
};

/* ─── Commits 탭 ─── */

const CommitsTab: React.FC<{ commits: Commit[]; owner: string; icon?: string }> = ({ commits, owner, icon }) => {
	const [filter, setFilter] = useState<string | null>(null);
	const types = useMemo(
		() => Array.from(new Set(commits.map((commit) => commit.type).filter((type): type is string => Boolean(type)))),
		[commits]
	);
	// 최근 커밋이 위로 (GitHub 커밋 목록처럼)
	const recent = useMemo(() => [...commits].reverse(), [commits]);
	const shown = filter ? recent.filter((commit) => commit.type === filter) : recent;
	return (
		<div className="rp-commits">
			<div className="rp-commits-bar">
				<span className="rp-branch">
					<i className="fa-solid fa-code-branch" aria-hidden="true" /> main
				</span>
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
			</div>
			<ol className="rp-log" aria-label="커밋 목록" key={filter ?? '*'}>
				{shown.map((commit, i) => (
					<li key={commit.hash} className="rp-commit" style={{ '--i': i } as React.CSSProperties}>
						<span className="rp-graph-dot" aria-hidden="true" />
						<div className="rp-commit-card">
							<p className="rp-commit-msg">
								{commit.type && <TypeBadge type={commit.type} />}
								{commit.message}
							</p>
							<p className="rp-commit-meta">
								{icon ? (
									<img className="rp-avatar rp-avatar-xs" src={icon} alt="" />
								) : (
									<span className="rp-avatar rp-avatar-xs rp-avatar-blank" aria-hidden="true">
										<i className="fa-solid fa-user" />
									</span>
								)}
								<strong>{owner}</strong> committed on <time>{commit.date}</time>
							</p>
						</div>
						<code className="rp-hash">{commit.hash}</code>
					</li>
				))}
			</ol>
			{shown.length === 0 && <p className="rp-empty">이 타입의 커밋이 없습니다.</p>}
		</div>
	);
};

/* ─── Conventions 탭 ─── */

const ConventionsTab: React.FC<{ conventions: { type: string; description: string }[] }> = ({ conventions }) => (
	<div className="rp-conventions">
		<p className="rp-lead">
			커밋 메시지는 <code>type: 요약</code> 꼴로 쓰고, 타입은 아래 표에서 고릅니다.
		</p>
		<table className="rp-table">
			<thead>
				<tr>
					<th scope="col">type</th>
					<th scope="col">설명</th>
				</tr>
			</thead>
			<tbody>
				{conventions.map((convention) => (
					<tr key={convention.type}>
						<td>
							<TypeBadge type={convention.type} />
						</td>
						<td>{convention.description}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/* ─── 페이지 ─── */

const RepoPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = repoAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const repoLink = hero.links.find((link) => link.kind === 'repo');
	const demoLink = hero.links.find((link) => link.kind === 'demo');
	const href = repoLink?.kind === 'repo' ? repoLink.href : undefined;
	const demo = demoLink?.kind === 'demo' ? demoLink.href : undefined;
	const clone = href ? cloneUrl(href) : undefined;
	const { owner, name } = repoOf(href, hero.name);
	const host = href ? href.replace(/^https?:\/\//, '').replace(/\/+$/, '') : `github.com/${name}`;
	const language = project.language?.trim() || undefined;
	const conventions = useMemo(() => project.conventions ?? [], [project.conventions]);
	const timeline = find(landing, 'timeline');
	const tech = find(landing, 'tech');
	const commits = useMemo(() => commitsOf(timeline?.entries ?? [], conventions), [timeline, conventions]);
	const latest: Commit = commits[commits.length - 1] ?? {
		hash: fakeHash(hero.name),
		date: hero.meta.period?.split(/\s*[–~-]\s*/)[0] ?? '',
		message: 'Initial commit',
	};

	const tabs = useMemo(() => {
		const list: Tab[] = [{ id: 'code', label: 'Code', icon: 'fa-solid fa-code' }];
		if (commits.length)
			list.push({ id: 'commits', label: 'Commits', icon: 'fa-solid fa-clock-rotate-left', count: commits.length });
		if (conventions.length)
			list.push({ id: 'conventions', label: 'Conventions', icon: 'fa-solid fa-tags', count: conventions.length });
		return list;
	}, [commits.length, conventions.length]);
	const [active, setActive] = useState<TabId>('code');
	const [drawer, setDrawer] = useState(false);

	// 저장소 트리: 있는 프로젝트만 불러온다. 없으면 폴더 구조로 만든 트리
	const withTree = hasRepoTree(project);
	const [repo, setRepo] = useState<RepoDir | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!withTree) return;
		let alive = true;
		loadRepo()
			.then((tree) => alive && setRepo(tree))
			.catch(
				(cause: unknown) => alive && setError(cause instanceof Error ? cause.message : '저장소를 불러오지 못했습니다.')
			);
		return () => {
			alive = false;
		};
	}, [withTree]);
	const structureText = tech?.structure;
	const structure = useMemo(() => (structureText ? structureRepo(structureText) : undefined), [structureText]);
	const source: FileSource = withTree ? { kind: 'browser', repo, error } : { kind: 'list', structure };
	const shellRepo = withTree ? repo : (structure?.dir ?? {});

	const readme = useRef<HTMLDivElement>(null);
	const hasReadme = Boolean(hero.subhead || landing.sections.length);
	const shell = useMemo(() => ({ landing, conventions }), [landing, conventions]);

	return (
		<div ref={root} className="tpl tpl-repo" style={accent}>
			<Hero landing={landing} language={language} host={host} clone={clone} />

			<div className="rp-chrome">
				<div className="rp-chrome-inner">
					<RepoHead owner={owner} name={name} icon={hero.icon} href={href} clone={clone} />
					<Tabs tabs={tabs} active={active} onChange={setActive} />
				</div>
			</div>

			<div className="rp-main" key={active} data-tab={active}>
				{active === 'code' && (
					<div className="rp-home">
						<div className="rp-home-main">
							<Files
								source={source}
								owner={owner ?? name}
								icon={hero.icon}
								name={name}
								href={href}
								latest={latest}
								count={commits.length}
								onCommits={commits.length ? () => setActive('commits') : undefined}
								onReadme={hasReadme ? () => readme.current?.scrollIntoView({ block: 'start' }) : undefined}
							/>
							{hasReadme && (
								<div className="rp-readme" ref={readme}>
									<div className="rp-readme-bar">
										<i className="fa-solid fa-book-open" aria-hidden="true" /> README
									</div>
									<div className="rp-md">
										<p className="rp-md-title">
											{hero.logo ? <img className="rp-md-logo" src={hero.logo} alt={hero.name} /> : hero.name}
										</p>
										{hero.subhead && <p className="rp-md-lead">{hero.subhead}</p>}
										<ReadmeSections landing={landing} />
									</div>
								</div>
							)}
						</div>
						<Side landing={landing} language={language} demo={demo} />
					</div>
				)}
				{active === 'commits' && <CommitsTab commits={commits} owner={owner ?? name} icon={hero.icon} />}
				{active === 'conventions' && <ConventionsTab conventions={conventions} />}
			</div>

			<div className="rp-closing" data-reveal="">
				<span className="rp-closing-icon" aria-hidden="true">
					<i className="fa-brands fa-github" />
				</span>
				<h2>{closing.title}</h2>
				{closing.lead && <p className="rp-closing-lead">{closing.lead}</p>}
				<LandingLinks links={closing.links} className="rp-links" />
			</div>

			<Terminal
				data={shell}
				name={name}
				repo={shellRepo}
				loading={withTree && !repo && !error}
				period={hero.meta.period}
				open={drawer}
				onToggle={() => setDrawer((value) => !value)}
			/>
		</div>
	);
};

export default RepoPage;

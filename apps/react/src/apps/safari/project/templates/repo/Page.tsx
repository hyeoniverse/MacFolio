// repo 템플릿: GitHub 저장소 화면 그대로 열린다 (랜딩식 첫 화면 없음). 맨 위는 저장소 머리(owner / 이름, Public, Watch·Fork·Star)와
// 탭 줄(Code · Commits · Conventions). Code 탭은 저장소 첫 화면이다: 가지 줄(main, 가지·태그 수, 초록 Code 버튼과 clone 창),
// 마지막 커밋 줄과 파일 트리(DevCourse는 실제 저장소 탐색기, 다른 프로젝트는 폴더 구조와 README.md·docs/),
// README 상자(위의 문서 탭으로 README.md와 docs/*.md를 바꿔 연다. 구역마다 문서 하나, 한 번에 한 문서만 보인다. README 첫머리가 h1),
// 옆 칸(About·랜딩 링크·Releases·Deployments·Contributors·Languages: API가 GitHub에서 받은 실제 언어 비율, 받지 못하면 주 언어 하나). Commits 탭은 진행 과정을 커밋 그래프로 그리고 타입으로 거른다. Conventions 탭은 커밋 규칙 표.
// 맨 아래 마무리 줄과 상태 줄의 터미널 버튼(누르면 서랍이 올라온다). Safari 창의 탭(role=tab)과 섞이지 않게 저장소 탭과 문서 탭은 nav와 버튼(aria-current)다.
// 계약은 templates/README.md
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	FaIcon,
	LandingLinks,
	Media,
	MemberAvatar,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingSection,
	type SectionOf,
} from '@/apps/safari/project/landing';
import { loadRepo, type RepoDir } from '@/apps/safari/project/terminalRepo';
import { scrollParent } from '@/apps/safari/project/scroll';
import { repoAccent } from './accent';
import { CopyButton, TypeBadge } from './bits';
import { Files, type FileSource } from './Files';
import { DocSections } from './Readme';
import { Terminal } from './Terminal';
import {
	cloneUrl,
	commitsOf,
	docPath,
	docsOf,
	docsTree,
	fakeHash,
	languageColor,
	mergeTree,
	repoOf,
	structureRepo,
	tagsOf,
	typeStyle,
	type Commit,
	type RepoDoc,
} from './repo';
import { percentText, useRepoLanguages, type RepoLanguage } from './languages';
import './Page.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 저장소 트리(repo.json)가 있는 프로젝트: 파일 상자가 실제 저장소 탐색기가 된다 */
const hasRepoTree = (project: Project) => project.id === 'devcourse';

const find = <K extends LandingSection['kind']>(landing: Landing, kind: K) =>
	landing.sections.find((section): section is SectionOf<K> => section.kind === kind);

/* ─── 저장소 머리 ─── */

/** owner / 이름, Public, 그리고 GitHub 저장소면 Watch·Fork·Star (숫자 없이 그 저장소의 해당 화면으로 가는 링크) */
const RepoHead: React.FC<{ owner?: string; name: string; icon?: string; href?: string }> = ({
	owner,
	name,
	icon,
	href,
}) => {
	const github = owner && href ? href.replace(/\/+$/, '').replace(/\.git$/, '') : undefined;
	const actions = github
		? [
				{ label: 'Watch', icon: 'fa-regular fa-eye', href: `${github}/watchers` },
				{ label: 'Fork', icon: 'fa-solid fa-code-fork', href: `${github}/fork` },
				{ label: 'Star', icon: 'fa-regular fa-star', href: `${github}/stargazers` },
			]
		: [];
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
			{actions.length > 0 && (
				<ul className="rp-head-actions" aria-label="저장소 동작">
					{actions.map((action) => (
						<li key={action.label}>
							<a className="rp-btn" href={action.href} {...external}>
								<i className={action.icon} aria-hidden="true" />
								{action.label}
							</a>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

/* ─── Code 탭의 가지 줄 ─── */

/** 초록 'Code ▾' 버튼: 누르면 clone 주소와 복사 버튼이 든 작은 창. 바깥을 누르거나 Esc를 누르면 닫힌다 */
const CodeMenu: React.FC<{ clone: string }> = ({ clone }) => {
	const [open, setOpen] = useState(false);
	const wrap = useRef<HTMLDivElement>(null);

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
	);
};

/** 파일 상자 위의 줄: 가지(main), 가지와 태그 수, Code 버튼 */
const BranchRow: React.FC<{ tags: number; clone?: string }> = ({ tags, clone }) => (
	<div className="rp-branch-row">
		<span className="rp-branch-pick">
			<i className="fa-solid fa-code-branch" aria-hidden="true" />
			<strong>main</strong>
			<i className="fa-solid fa-caret-down" aria-hidden="true" />
		</span>
		<span className="rp-branch-stat">
			<i className="fa-solid fa-code-branch" aria-hidden="true" />
			<strong>1</strong> Branch
		</span>
		{tags > 0 && (
			<span className="rp-branch-stat">
				<i className="fa-solid fa-tag" aria-hidden="true" />
				<strong>{tags}</strong> Tags
			</span>
		)}
		{clone && <CodeMenu clone={clone} />}
	</div>
);

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
		list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus({ preventScroll: true });
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

/**
 * GitHub 저장소 첫 화면의 옆 칸: About(한 줄 소개, 랜딩 링크 버튼, 데모 주소, 주제, 프로젝트·역할·기간), 마지막 릴리스, 배포 결과물(Deployments),
 * 팀원 사진(Contributors), 언어.
 * 랜딩 링크(여기서 열기·새 탭·GitHub)는 여기와 맨 아래 마무리 줄에 같은 묶음으로 있다
 */
const Side: React.FC<{ landing: Landing; language?: string; languages: RepoLanguage[] | null; demo?: string }> = ({
	landing,
	language,
	languages,
	demo,
}) => {
	const { hero } = landing;
	// GitHub에서 받은 언어 비율. 받는 동안이나 받지 못하면 프로젝트의 주 언어 하나 (100%)
	const shares = languages ?? (language ? [{ name: language, bytes: 0, percent: 100 }] : []);
	const tech = find(landing, 'tech');
	const timeline = find(landing, 'timeline');
	const topics = tech?.stack ?? [];
	const meta = [
		hero.meta.context && { icon: 'fa-solid fa-circle-info', text: hero.meta.context, label: '프로젝트' },
		hero.meta.role && { icon: 'fa-regular fa-user', text: hero.meta.role, label: '역할' },
		hero.meta.period && { icon: 'fa-regular fa-calendar', text: hero.meta.period, label: '기간' },
	].filter(Boolean) as { icon: string; text: string; label: string }[];
	// 설명은 한 줄(tagline), 없으면 소개 글
	const description = hero.headline !== hero.name ? hero.headline : hero.subhead;
	const about = Boolean(description || hero.links.length || demo || topics.length || meta.length);
	const last = timeline?.entries[timeline.entries.length - 1];
	const team = find(landing, 'team');
	const deployments = find(landing, 'deployments');
	if (!about && !last && !shares.length && !team && !deployments) return null;
	return (
		<div className="rp-side">
			{about && (
				<div className="rp-side-box">
					<h2>About</h2>
					{description && <p className="rp-side-desc">{description}</p>}
					<LandingLinks links={hero.links} className="rp-links rp-side-links" />
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
			{deployments && (
				<div className="rp-side-box">
					<h2>
						Deployments <span className="rp-count">{deployments.items.length}</span>
					</h2>
					<ul className="rp-side-deploys">
						{deployments.items.map((item) => (
							<li key={item.label}>
								<FaIcon icon={item.icon} />
								{item.url ? (
									<a href={item.url} {...external}>
										{item.label}
									</a>
								) : (
									<span>{item.label}</span>
								)}
								{item.platform && <span className="rp-muted">{item.platform}</span>}
							</li>
						))}
					</ul>
				</div>
			)}
			{team && (
				<div className="rp-side-box">
					<h2>
						Contributors <span className="rp-count">{team.members.length}</span>
					</h2>
					<ul className="rp-side-people" aria-label="팀원">
						{team.members.map((member) => (
							<li key={member.name} title={`${member.name} · ${member.role}`}>
								{member.url ? (
									<a href={member.url} aria-label={member.name} {...external}>
										<MemberAvatar member={member} className="rp-side-avatar" />
									</a>
								) : (
									<span role="img" aria-label={member.name}>
										<MemberAvatar member={member} className="rp-side-avatar" />
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
			{shares.length > 0 && (
				<div className="rp-side-box">
					<h2>Languages</h2>
					<span className="rp-lang-bar" aria-hidden="true">
						{shares.map((item) => (
							<span
								key={item.name}
								style={{ flexGrow: item.percent, background: languageColor(item.name) }}
								title={`${item.name} ${percentText(item.percent)}`}
							/>
						))}
					</span>
					<ul className="rp-langs">
						{shares.map((item) => (
							<li key={item.name} className="rp-lang">
								<i className="rp-dot" style={{ background: languageColor(item.name) }} aria-hidden="true" />
								<strong>{item.name}</strong>
								<span className="rp-muted">{percentText(item.percent)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

/* ─── README 상자: 문서 탭 ─── */

/** GitHub의 README 상자처럼 위에 문서 탭(README · 주요 기능 · …), 그 아래 파일 경로 줄, 고른 문서 하나의 내용 */
const DocBox = React.forwardRef<
	HTMLDivElement,
	{ landing: Landing; docs: RepoDoc[]; active: RepoDoc; name: string; onOpen: (doc: RepoDoc, scroll: boolean) => void }
>(({ landing, docs, active, name, onOpen }, ref) => {
	const { hero } = landing;
	const nav = useRef<HTMLElement>(null);
	const others = docs.filter((doc) => doc.id !== 'readme');

	// 고른 탭이 탭 줄 밖에 있으면 가로로만 밀어 보이게 한다 (페이지는 움직이지 않는다)
	useEffect(() => {
		const list = nav.current;
		const node = list?.querySelector<HTMLElement>('[aria-current="page"]');
		if (!list || !node) return;
		if (node.offsetLeft < list.scrollLeft) list.scrollLeft = node.offsetLeft - 8;
		else if (node.offsetLeft + node.offsetWidth > list.scrollLeft + list.clientWidth)
			list.scrollLeft = node.offsetLeft + node.offsetWidth - list.clientWidth + 8;
	}, [active.id]);

	const onKey = (event: React.KeyboardEvent, index: number) => {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		const next = docs[(index + step + docs.length) % docs.length];
		onOpen(next, false);
		nav.current?.querySelector<HTMLElement>(`[data-doc="${next.id}"]`)?.focus({ preventScroll: true });
	};

	return (
		<div className="rp-readme" ref={ref}>
			<nav className="rp-doc-tabs" aria-label="문서" ref={nav}>
				{docs.map((doc, index) => (
					<button
						key={doc.id}
						type="button"
						data-doc={doc.id}
						aria-current={doc.id === active.id ? 'page' : undefined}
						tabIndex={doc.id === active.id ? 0 : -1}
						onClick={() => onOpen(doc, false)}
						onKeyDown={(event) => onKey(event, index)}
					>
						<i className={doc.icon} aria-hidden="true" />
						{doc.label}
					</button>
				))}
			</nav>
			<p className="rp-doc-bar">
				<i className="fa-regular fa-file-lines" aria-hidden="true" />
				<span className="rp-doc-crumbs">
					<span className="rp-muted">{name}</span>
					{active.path.map((part, i) => (
						<React.Fragment key={part}>
							<span className="rp-slash" aria-hidden="true">
								/
							</span>
							{i === active.path.length - 1 ? <strong>{part}</strong> : <span className="rp-muted">{part}</span>}
						</React.Fragment>
					))}
				</span>
				<code className="rp-doc-blob">blob/main/{docPath(active)}</code>
			</p>
			<div className="rp-md" key={active.id} data-doc={active.id}>
				{active.id === 'readme' && (
					<>
						{hero.logo && <img className="rp-md-logo" src={hero.logo} alt={hero.name} />}
						<h1 className="rp-md-title">{hero.headline}</h1>
						{hero.subhead && <p className="rp-md-lead">{hero.subhead}</p>}
						{hero.image && (
							<figure className="rp-md-hero">
								<Media media={hero.image} eager />
							</figure>
						)}
					</>
				)}
				<DocSections landing={landing} sections={active.sections} />
				{active.id === 'readme' && others.length > 0 && (
					<div className="rp-toc">
						<h2>목차</h2>
						<ul>
							{others.map((doc) => (
								<li key={doc.id}>
									<button type="button" onClick={() => onOpen(doc, false)}>
										<i className={doc.icon} aria-hidden="true" />
										<span className="rp-toc-label">{doc.label}</span>
										<code>{docPath(doc)}</code>
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
});
DocBox.displayName = 'DocBox';

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
	const language = project.language?.trim() || undefined;
	const languages = useRepoLanguages(href);
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

	// 문서: README.md와 구역마다의 docs/*.md. 처음에는 README
	const docs = useMemo(() => docsOf(landing), [landing]);
	const files = useMemo(() => docsTree(landing, docs), [landing, docs]);
	const notes = useMemo(() => Object.fromEntries(docs.map((doc) => [docPath(doc), doc.label])), [docs]);
	const [docId, setDocId] = useState<RepoDoc['id']>('readme');
	const doc = docs.find((item) => item.id === docId) ?? docs[0];
	const readme = useRef<HTMLDivElement>(null);
	const openDoc = useCallback((next: RepoDoc, scroll: boolean) => {
		setDocId(next.id);
		// scrollIntoView는 Safari 창을 품은 바깥 상자까지 밀어 올려 터미널 줄 아래가 빈다. 페이지의 스크롤 상자만 움직인다
		const box = readme.current;
		const scroller = box && scrollParent(box);
		if (scroll && box && scroller) {
			const top = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
			scroller.scrollTo({ top: Math.max(0, top) });
		}
	}, []);
	const openPath = useCallback(
		(path: string[]) => {
			const next = docs.find((item) => docPath(item) === path.join('/'));
			if (next) openDoc(next, true);
		},
		[docs, openDoc]
	);

	// 터미널은 폴더 구조에 README.md와 docs/를 더한 트리를 돌아본다 (DevCourse는 실제 저장소 그대로)
	const shellRepo = withTree ? repo : mergeTree(structure?.dir ?? {}, files);
	const shell = useMemo(() => ({ landing, conventions }), [landing, conventions]);

	return (
		<div ref={root} className="tpl tpl-repo" style={accent}>
			{/* 큰 제목(h1)은 README 첫머리에 있다. README가 안 보이는 동안에도 페이지의 h1이 하나 있게 숨긴 제목을 둔다 */}
			{!(active === 'code' && doc?.id === 'readme') && <h1 className="visually-hidden">{hero.headline}</h1>}
			<div className="rp-chrome">
				<div className="rp-chrome-inner">
					<RepoHead owner={owner} name={name} icon={hero.icon} href={href} />
					<Tabs tabs={tabs} active={active} onChange={setActive} />
				</div>
			</div>

			<div className="rp-main" key={active} data-tab={active}>
				{active === 'code' && (
					<div className="rp-home">
						<div className="rp-home-main">
							<BranchRow tags={timeline?.entries.length ?? 0} clone={clone} />
							<Files
								source={source}
								owner={owner ?? name}
								icon={hero.icon}
								name={name}
								href={href}
								latest={latest}
								count={commits.length}
								onCommits={commits.length ? () => setActive('commits') : undefined}
								docs={doc ? { tree: files, notes, current: doc.path, open: openPath } : undefined}
							/>
							{doc && <DocBox ref={readme} landing={landing} docs={docs} active={doc} name={name} onOpen={openDoc} />}
						</div>
						<Side landing={landing} language={language} languages={languages} demo={demo} />
					</div>
				)}
				{active === 'commits' && <CommitsTab commits={commits} owner={owner ?? name} icon={hero.icon} />}
				{active === 'conventions' && <ConventionsTab conventions={conventions} />}
			</div>

			<div className="rp-closing" data-reveal="">
				<span className="rp-closing-icon" aria-hidden="true">
					<i className="fa-brands fa-github" />
				</span>
				<div className="rp-closing-text">
					<h2>{closing.title}</h2>
					{closing.lead && <p className="rp-closing-lead">{closing.lead}</p>}
				</div>
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

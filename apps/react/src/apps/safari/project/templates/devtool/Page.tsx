// devtool 템플릿: Vercel·Next.js 문서 사이트처럼. 위에 고정된 막대(로고와 이름, Docs·Showcase·GitHub, ⌘K 검색), 왼쪽에 묶음별
// 문서 목차, 가운데 글(이동 경로, 제목, 빠른 시작과 복사되는 git clone 명령, 알림 상자, 이전·다음 페이지), 오른쪽에 '이 페이지에서' 목차가
// 읽는 위치를 따라간다. 구역은 목차가 바꾸는 가상의 문서 페이지에 나뉘어 한 번에 한 페이지만 보인다 (README의 '열면 보이는' 변형).
// 검색(⌘K)은 페이지와 그 안의 제목을 고르는 명령 팔레트다. 좁은 창에서는 목차가 ☰ 단추 뒤로 접힌다. 계약은 templates/README.md
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, scrollParent } from '@/apps/safari/project/scroll';
import {
	FaIcon,
	iconOf,
	LandingSections,
	Media,
	MemberAvatar,
	shortLink,
	troubleIcon,
	troubleSteps,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionOf,
	type SectionRenderers,
	type TroubleStepKey,
} from '@/apps/safari/project/landing';
import { devtoolAccent } from './accent';
import { cloneCommand, commitHash, contributionGraph, parseTree } from './code';
import { CommandBox, DevLinks, Tree } from './Parts';
import './Page.css';

type Kind = LandingSectionKind;

/** 구역마다의 문서 페이지 제목과 첫 문장 (구역 이름은 aria-label로 그대로 남는다) */
const DOCS: Record<Kind, { title: string; lead: string }> = {
	stats: { title: '주요 지표', lead: '' },
	features: { title: '주요 기능', lead: '제품이 하는 일을 기능 단위로 하나씩 설명합니다.' },
	screens: { title: '화면 모음', lead: '실제 화면을 모아 두었습니다. 그림마다 어떤 화면인지 적었습니다.' },
	steps: { title: '쓰는 법', lead: '처음 쓰는 사람이 따라 할 순서를 차례대로 정리했습니다.' },
	built: { title: '구현 방법', lead: '핵심 동작을 어떻게 구현했는지 설명합니다.' },
	troubleshooting: { title: '트러블슈팅', lead: '개발 중에 만난 문제와 원인, 해결 과정을 기록했습니다.' },
	stories: { title: '개발 이야기', lead: '만들게 된 배경과 그 뒤의 이야기를 담았습니다.' },
	controls: { title: '단축키', lead: '키보드로 쓸 수 있는 동작의 목록입니다.' },
	tech: { title: '기술 사양', lead: '사용한 기술과 실행 환경, 폴더 구조를 정리한 참조 문서입니다.' },
	team: { title: '팀', lead: '프로젝트를 함께 만든 사람과 각자 맡은 일입니다.' },
	role: { title: '내 역할', lead: '이 프로젝트에서 직접 맡아 만든 부분입니다.' },
	timeline: { title: '진행 과정', lead: '프로젝트가 진행된 순서를 날짜별로 기록했습니다.' },
	deployments: { title: '배포', lead: '공개된 결과물과 각각이 올라가 있는 곳입니다.' },
	credits: { title: '출처', lead: '사용한 자료와 도구의 출처입니다.' },
};

/** 문서 목차의 묶음. intro·install은 소개 페이지, structure는 기술 사양 페이지의 폴더 구조 제목이다 */
type Entry = Kind | 'intro' | 'install' | 'structure';
const GROUPS: { label: string; entries: Entry[] }[] = [
	{ label: '시작하기', entries: ['intro', 'install', 'steps'] },
	{ label: '기능', entries: ['features', 'screens', 'controls'] },
	{ label: '아키텍처', entries: ['built', 'troubleshooting', 'stories'] },
	{ label: '레퍼런스', entries: ['tech', 'structure', 'credits'] },
	{ label: '프로젝트', entries: ['team', 'role', 'timeline', 'deployments'] },
];

const INTRO = 'intro';
const QUICK_START = 'dv-quick-start';
const STRUCTURE = 'dv-structure';

interface NavItem {
	label: string;
	page: string;
	anchor?: string;
}

interface DocPage {
	id: string;
	group: string;
	title: string;
}

/** 목차 묶음과 페이지 차례 (내용이 있는 구역만) */
function buildNav(landing: Landing, quickStart: boolean) {
	const has = (kind: Kind) => landing.sections.some((section) => section.kind === kind);
	const structure = landing.sections.some((section) => section.kind === 'tech' && section.structure);
	const groups = GROUPS.map(({ label, entries }) => ({
		label,
		items: entries.flatMap((entry): NavItem[] => {
			if (entry === 'intro') return [{ label: '소개', page: INTRO }];
			if (entry === 'install') return quickStart ? [{ label: '설치', page: INTRO, anchor: QUICK_START }] : [];
			if (entry === 'structure') return structure ? [{ label: '폴더 구조', page: 'tech', anchor: STRUCTURE }] : [];
			return has(entry) ? [{ label: DOCS[entry].title, page: entry }] : [];
		}),
	})).filter((group) => group.items.length > 0);
	const pages: DocPage[] = [];
	for (const group of groups)
		for (const item of group.items)
			if (!item.anchor && !pages.some((page) => page.id === item.page))
				pages.push({ id: item.page, group: group.label, title: item.label });
	return { groups, pages };
}

/** 검색 팔레트에서 고를 수 있는 것: 페이지와 그 안의 제목 */
interface SearchEntry {
	label: string;
	hint: string;
	page: string;
	anchor?: string;
}

const h3Id = (kind: Kind, index: number) => `dv-${kind}-${index}`;

function searchEntries(landing: Landing, pages: DocPage[], quickStart: boolean): SearchEntry[] {
	const entries: SearchEntry[] = [];
	for (const page of pages) {
		entries.push({ label: page.title, hint: page.group, page: page.id });
		if (page.id === INTRO && quickStart)
			entries.push({ label: '빠른 시작', hint: '소개', page: INTRO, anchor: QUICK_START });
		const section = landing.sections.find((item) => item.kind === page.id);
		if (!section) continue;
		const titles: string[] =
			section.kind === 'features' || section.kind === 'steps' || section.kind === 'built'
				? section.items.map((point) => point.title)
				: section.kind === 'troubleshooting'
					? section.items.map((item) => item.title)
					: section.kind === 'stories'
						? section.stories.map((story) => story.title)
						: [];
		titles.forEach((title, index) =>
			entries.push({ label: title, hint: page.title, page: page.id, anchor: h3Id(section.kind, index) })
		);
		if (section.kind === 'tech' && section.structure)
			entries.push({ label: '폴더 구조', hint: page.title, page: page.id, anchor: STRUCTURE });
	}
	return entries;
}

/* ─── 작은 조각 ─── */

/** 페이지 제목(h2)과 첫 문장 */
const Title: React.FC<{ section: LandingSection }> = ({ section }) => (
	<header className="dv-page-head">
		<h2 className="dv-page-title" id={`dv-${section.kind}`} tabIndex={-1}>
			{DOCS[section.kind].title}
		</h2>
		{DOCS[section.kind].lead && <p className="dv-page-lead">{DOCS[section.kind].lead}</p>}
	</header>
);

/** 오른쪽 목차에 오르는 작은 제목 */
const H3: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className }) => (
	<h3 id={id} data-toc="3" className={['dv-h3', className].filter(Boolean).join(' ')}>
		{children}
	</h3>
);

type CalloutKind = 'note' | 'warning' | 'tip' | 'success';
const CALLOUTS: Record<CalloutKind, { icon: string; label: string }> = {
	note: { icon: 'fa-solid fa-circle-info', label: '참고' },
	warning: { icon: 'fa-solid fa-triangle-exclamation', label: '주의' },
	tip: { icon: 'fa-solid fa-lightbulb', label: '팁' },
	success: { icon: 'fa-solid fa-circle-check', label: '결과' },
};

/** 알림 상자: 왼쪽 아이콘, 굵은 이름표, 내용 */
const Callout: React.FC<{ kind: CalloutKind; label?: string; children: React.ReactNode }> = ({
	kind,
	label,
	children,
}) => (
	<div className="dv-callout" data-kind={kind}>
		<i className={`${CALLOUTS[kind].icon} dv-callout-icon`} aria-hidden="true" />
		<div className="dv-callout-body">
			<p className="dv-callout-label">{label ?? CALLOUTS[kind].label}</p>
			{children}
		</div>
	</div>
);

/** 트러블슈팅 단계마다의 알림 상자 */
const STEP_CALLOUT: Record<TroubleStepKey, CalloutKind> = {
	problem: 'warning',
	cause: 'note',
	solution: 'tip',
	result: 'success',
};

/** 테두리 상자에 담은 그림 한 장 */
const Shot: React.FC<{ media: LandingMedia; className?: string }> = ({ media, className }) => (
	<div className={['dv-shot', className].filter(Boolean).join(' ')}>
		<Media media={media} />
	</div>
);

/** 항목의 그림 전부: 첫 장은 크게, 나머지는 작은 줄 */
const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) => {
	const [first, ...more] = point.media;
	if (!first) return null;
	return (
		<div className="dv-media">
			<Shot media={first} />
			{more.length > 0 && (
				<ul className="dv-thumbs" aria-label={`${point.title} 화면 더 보기`}>
					{more.map((media) => (
						<li key={media.src}>
							<Shot media={media} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const Facts: React.FC<{ facts: ProjectFact[]; className?: string }> = ({ facts, className = 'dv-metrics' }) => (
	<dl className={className} data-count={Math.min(facts.length, 4)}>
		{facts.map((fact) => (
			<div key={fact.label}>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/* ─── 구역 ─── */

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="dv-h2" id="dv-stats" data-toc="2">
				{DOCS.stats.title}
			</h2>
			<Facts facts={section.facts} />
		</>
	),
	features: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-blocks">
				{section.items.map((point, index) => (
					<div key={point.title} className="dv-block" data-reveal="">
						<H3 id={h3Id('features', index)}>
							<span className="dv-h3-icon" aria-hidden="true">
								<i className={`fa-solid ${iconOf(point, index)}`} />
							</span>
							{point.title}
						</H3>
						{point.group && <p className="dv-badge">{point.group}</p>}
						<p>{point.body}</p>
						{point.detail && <p className="dv-quiet">{point.detail}</p>}
						<PointMedia point={point} />
					</div>
				))}
			</div>
		</>
	),
	screens: ({ section }) => (
		<>
			<Title section={section} />
			<ul className="dv-shots">
				{section.shots.map((shot) => (
					<li key={shot.src} data-reveal="">
						<figure>
							<Shot media={shot} />
							<figcaption>{shot.caption}</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Title section={section} />
			<ol className="dv-steps">
				{section.items.map((point, index) => (
					<li key={point.title}>
						<H3 id={h3Id('steps', index)}>
							{point.icon && <i className={`fa-solid ${point.icon} dv-inline-icon`} aria-hidden="true" />}
							{point.title}
						</H3>
						<p>{point.body}</p>
						{point.detail && <p className="dv-quiet">{point.detail}</p>}
						<PointMedia point={point} />
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-blocks">
				{section.items.map((point, index) => (
					<div key={point.title} className="dv-block" data-reveal="">
						<H3 id={h3Id('built', index)}>
							<span className="dv-h3-icon" aria-hidden="true">
								<i className={`fa-solid ${iconOf(point, index + 2)}`} />
							</span>
							{point.title}
						</H3>
						<p className="dv-commit-line">
							<i className="fa-solid fa-code-commit" aria-hidden="true" />
							<code className="dv-hash">{commitHash(point.title)}</code>
						</p>
						<p>{point.body}</p>
						{point.detail && (
							<Callout kind="note" label="자세히">
								<p>{point.detail}</p>
							</Callout>
						)}
						<PointMedia point={point} />
					</div>
				))}
			</div>
		</>
	),
	troubleshooting: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-blocks">
				{section.items.map((item, index) => (
					<div key={item.title} className="dv-block" data-reveal="">
						<H3 id={h3Id('troubleshooting', index)}>
							<span className="dv-h3-icon" aria-hidden="true">
								<FaIcon icon={troubleIcon(item)} />
							</span>
							{item.title}
						</H3>
						{troubleSteps(item).map((step) => (
							<Callout key={step.key} kind={STEP_CALLOUT[step.key]} label={step.label}>
								<p>{step.text}</p>
							</Callout>
						))}
						{item.image && <Shot media={item.image} className="dv-figure" />}
					</div>
				))}
			</div>
		</>
	),
	stories: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-blocks">
				{section.stories.map((story, index) => (
					<article key={story.title} className="dv-block" aria-label={story.title} data-reveal="">
						<H3 id={h3Id('stories', index)}>{story.title}</H3>
						{story.lead && <blockquote className="dv-quote">{story.lead}</blockquote>}
						{story.facts.length > 0 && <Facts facts={story.facts} className="dv-metrics dv-metrics-sm" />}
						{story.points.length > 0 && (
							<ul className="dv-bullets">
								{story.points.map((point) => (
									<li key={point.title}>
										<strong>{point.title}</strong> {point.body}
										{point.detail && <span className="dv-quiet"> {point.detail}</span>}
										<PointMedia point={point} />
									</li>
								))}
							</ul>
						)}
						{story.image && (
							<figure className="dv-figure-box">
								<Shot media={story.image} />
								<figcaption>{story.image.alt}</figcaption>
							</figure>
						)}
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-table-wrap">
				<table className="dv-table">
					<thead>
						<tr>
							<th scope="col">키</th>
							<th scope="col">동작</th>
						</tr>
					</thead>
					<tbody>
						{section.controls.map((control, index) => (
							<tr key={`${control.label}-${index}`}>
								<td className="dv-keys">
									{control.keys.map((key, k) => (
										<kbd key={`${key}-${k}`} className="dv-kbd">
											{key}
										</kbd>
									))}
								</td>
								<td>{control.label}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	),
	tech: ({ section }) => {
		const rows = section.structure ? parseTree(section.structure) : [];
		return (
			<>
				<Title section={section} />
				{section.stack.length > 0 && (
					<>
						<H3 id="dv-tech-stack">사용 기술</H3>
						<ul className="dv-stack" aria-label="쓴 기술">
							{section.stack.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</>
				)}
				{section.specs.length > 0 && (
					<>
						<H3 id="dv-tech-specs">실행 환경</H3>
						<div className="dv-table-wrap">
							<table className="dv-table">
								<thead>
									<tr>
										<th scope="col">분류</th>
										<th scope="col">값</th>
									</tr>
								</thead>
								<tbody>
									{section.specs.map((spec) => (
										<tr key={spec.label}>
											<th scope="row">{spec.label}</th>
											<td>
												<code className="dv-code-inline">{spec.value}</code>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
				{section.structure && (
					<>
						<H3 id={STRUCTURE}>폴더 구조</H3>
						<figure className="dv-codeblock">
							<figcaption className="dv-codeblock-bar">
								<i className="fa-regular fa-folder-open" aria-hidden="true" />
								<span>폴더 구조</span>
							</figcaption>
							{rows.length > 0 ? <Tree rows={rows} /> : <pre className="dv-pre">{section.structure}</pre>}
						</figure>
					</>
				)}
			</>
		);
	},
	team: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-table-wrap">
				<table className="dv-table">
					<thead>
						<tr>
							<th scope="col">이름</th>
							<th scope="col">역할</th>
							<th scope="col">링크</th>
						</tr>
					</thead>
					<tbody>
						{section.members.map((member) => (
							<tr key={member.name} data-me={member.me || undefined}>
								<td>
									<span className="dv-person">
										<MemberAvatar member={member} className="dv-avatar" />
										<strong>{member.name}</strong>
										{member.me && <span className="dv-badge dv-badge-accent">나</span>}
									</span>
								</td>
								<td>{member.role}</td>
								<td>
									{member.url && (
										<a className="dv-link" href={member.url} title={member.url} {...external}>
											{shortLink(member.url)}
										</a>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	),
	role: ({ section }) => (
		<>
			<Title section={section} />
			{(section.role || section.context || section.period) && (
				<Callout kind="note" label="맡은 자리">
					{section.role && <p className="dv-strong">{section.role}</p>}
					{(section.context || section.period) && (
						<p>{[section.context, section.period].filter(Boolean).join(' · ')}</p>
					)}
				</Callout>
			)}
			{section.contributions.length > 0 && (
				<>
					<H3 id="dv-role-list">맡은 일</H3>
					<ul className="dv-checks">
						{section.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</>
			)}
		</>
	),
	timeline: ({ section }) => <Timeline section={section} />,
	deployments: ({ section }) => (
		<>
			<Title section={section} />
			<ul className="dv-deploys">
				{section.items.map((item, index) => (
					<li key={item.label} className="dv-deploy" data-reveal="">
						<div className="dv-deploy-cover">
							{item.image ? (
								<Media media={item.image} />
							) : (
								<span className="dv-deploy-art" aria-hidden="true">
									<FaIcon icon={item.icon} />
								</span>
							)}
						</div>
						<div className="dv-deploy-body">
							<H3 id={h3Id('deployments', index)} className="dv-deploy-title">
								<FaIcon icon={item.icon} className="dv-inline-icon" />
								{item.url ? (
									<a className="dv-link" href={item.url} {...external}>
										{item.label}
									</a>
								) : (
									item.label
								)}
							</H3>
							<p className="dv-deploy-meta">
								<span className="dv-status" data-live={item.url ? '' : undefined}>
									{item.url ? '공개' : '링크 없음'}
								</span>
								{item.platform && <span className="dv-badge">{item.platform}</span>}
								{item.host && <code className="dv-code-inline">{item.host}</code>}
							</p>
							{item.note && <p className="dv-quiet">{item.note}</p>}
						</div>
					</li>
				))}
			</ul>
		</>
	),
	credits: ({ section }) => (
		<>
			<Title section={section} />
			<div className="dv-table-wrap">
				<table className="dv-table">
					<thead>
						<tr>
							<th scope="col">분류</th>
							<th scope="col">이름</th>
							<th scope="col">만든 곳</th>
						</tr>
					</thead>
					<tbody>
						{section.credits.map((credit) => (
							<tr key={`${credit.role}-${credit.name}`}>
								<td className="dv-quiet">{credit.role}</td>
								<td>
									{credit.href ? (
										<a className="dv-link" href={credit.href} {...external}>
											{credit.name}
										</a>
									) : (
										<strong>{credit.name}</strong>
									)}
									{credit.note && <span className="dv-cell-note">{credit.note}</span>}
								</td>
								<td>{credit.by}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	),
};

/** 진행 과정: 날짜로 짠 기여 그래프와 변경 기록. 날짜를 읽지 못하면 기록만 */
const Timeline: React.FC<{ section: SectionOf<'timeline'> }> = ({ section }) => {
	const graph = useMemo(() => contributionGraph(section.entries), [section.entries]);
	return (
		<>
			<Title section={section} />
			{graph && (
				<div className="dv-graph" aria-hidden="true">
					<p className="dv-graph-total">
						이 기간에 <strong>{graph.total}</strong>번 기여했습니다.
					</p>
					<div className="dv-graph-scroll">
						<div className="dv-graph-grid" style={{ '--weeks': graph.weeks.length } as React.CSSProperties}>
							<div className="dv-graph-months">
								{graph.months.map((month) => (
									<span key={`${month.week}-${month.label}`} style={{ gridColumn: month.week + 1 }}>
										{month.label}
									</span>
								))}
							</div>
							<div className="dv-graph-cells">
								{graph.weeks.map((week, w) =>
									week.map((cell, d) => (
										<span
											key={cell.date}
											data-level={cell.level}
											data-milestone={cell.milestone || undefined}
											style={{ gridColumn: w + 1, gridRow: d + 1 }}
										/>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			)}
			<ol className="dv-changelog">
				{section.entries.map((entry, index) => (
					<li key={`${entry.date}-${entry.label}`}>
						<time>{entry.date}</time>
						<H3 id={h3Id('timeline', index)} className="dv-changelog-title">
							{entry.label}
						</H3>
					</li>
				))}
			</ol>
		</>
	);
};

/* ─── 검색 팔레트 ─── */

const Palette: React.FC<{
	entries: SearchEntry[];
	onPick: (entry: SearchEntry) => void;
	onClose: () => void;
}> = ({ entries, onPick, onClose }) => {
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const input = useRef<HTMLInputElement>(null);
	const list = useRef<HTMLUListElement>(null);
	const found = useMemo(() => {
		const words = query.trim().toLowerCase();
		return words ? entries.filter((entry) => `${entry.label} ${entry.hint}`.toLowerCase().includes(words)) : entries;
	}, [entries, query]);
	const current = Math.min(active, Math.max(found.length - 1, 0));
	useEffect(() => input.current?.focus(), []);
	useEffect(() => {
		list.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
	}, [current]);
	const onKey = (event: React.KeyboardEvent) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!found.length) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			setActive((current + step + found.length) % found.length);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (found[current]) onPick(found[current]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		} else if (event.key === 'Tab') {
			// 팔레트 안에서 초점이 가는 곳은 입력칸 하나다
			event.preventDefault();
		}
	};
	return (
		<div className="dv-palette-layer">
			<div className="dv-palette-scrim" aria-hidden="true" onClick={onClose} />
			<div className="dv-palette" role="dialog" aria-modal="true" aria-label="문서 검색" onKeyDown={onKey}>
				<div className="dv-palette-field">
					<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
					<input
						ref={input}
						type="text"
						role="combobox"
						aria-label="문서 검색어"
						aria-expanded="true"
						aria-controls="dv-palette-list"
						aria-autocomplete="list"
						aria-activedescendant={found.length ? `dv-option-${current}` : undefined}
						placeholder="문서를 검색합니다."
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
					/>
					<kbd className="dv-kbd">esc</kbd>
				</div>
				{found.length > 0 ? (
					<ul ref={list} id="dv-palette-list" role="listbox" aria-label="검색 결과" className="dv-palette-list">
						{found.map((entry, index) => (
							<li
								key={`${entry.page}-${entry.anchor ?? ''}-${entry.label}`}
								id={`dv-option-${index}`}
								role="option"
								aria-selected={index === current}
								data-index={index}
								onMouseMove={() => setActive(index)}
								onClick={() => onPick(entry)}
							>
								<i className={entry.anchor ? 'fa-solid fa-hashtag' : 'fa-regular fa-file-lines'} aria-hidden="true" />
								<span className="dv-option-label">{entry.label}</span>
								<span className="dv-option-hint">{entry.hint}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="dv-palette-empty" role="status">
						찾는 문서가 없습니다.
					</p>
				)}
				<p className="dv-palette-foot" aria-hidden="true">
					<span>
						<kbd className="dv-kbd">↑</kbd>
						<kbd className="dv-kbd">↓</kbd>
						이동
					</span>
					<span>
						<kbd className="dv-kbd">↵</kbd>
						열기
					</span>
				</p>
			</div>
		</div>
	);
};

/* ─── 페이지 ─── */

interface TocItem {
	id: string;
	text: string;
	level: string;
}

/** 위 막대 높이: 목차·제목으로 내려갈 때 그 아래에 놓이게 */
const TOP = 64;

const DevtoolPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = devtoolAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const repo = hero.links.find((link) => link.kind === 'repo');
	const repoHref = repo?.kind === 'repo' ? repo.href : undefined;
	const quickStart = Boolean(repoHref || hero.links.length);
	const { groups, pages } = useMemo(() => buildNav(landing, quickStart), [landing, quickStart]);
	const search = useMemo(() => searchEntries(landing, pages, quickStart), [landing, pages, quickStart]);

	const [pageId, setPageId] = useState(INTRO);
	const page = pages.find((item) => item.id === pageId) ?? pages[0];
	const pageIndex = pages.indexOf(page);
	const [tick, setTick] = useState(0);
	const pending = useRef<{ anchor?: string } | null>(null);
	const [drawer, setDrawer] = useState(false);
	const [palette, setPalette] = useState(false);
	const [toc, setToc] = useState<TocItem[]>([]);
	const [activeToc, setActiveToc] = useState('');
	const menuButton = useRef<HTMLButtonElement>(null);
	const searchButton = useRef<HTMLButtonElement>(null);

	const language = project.language?.trim() || undefined;
	const showcase = pages.find((item) => item.id === 'screens') ?? pages.find((item) => item.id === 'features');
	const intro = page.id === INTRO;
	const pageLanding = useMemo(
		() => ({
			...landing,
			sections: landing.sections.filter((section) => (intro ? section.kind === 'stats' : section.kind === page.id)),
		}),
		[landing, intro, page.id]
	);

	const scrollToTarget = useCallback(
		(target: HTMLElement | null) => {
			const el = root.current;
			if (!el) return;
			const scroller = scrollParent(el);
			const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
			const node = target ?? el;
			if (!scroller) {
				node.scrollIntoView({ behavior, block: 'start' });
				return;
			}
			const offset = target ? TOP + 16 : 0;
			const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset;
			scroller.scrollTo({ top: Math.max(top, 0), behavior });
		},
		[root]
	);

	/** 목차·팔레트·이전·다음: 그 페이지를 열고, 제목이 있으면 그리로, 없으면 맨 위로 내려가 초점을 둔다 */
	const go = useCallback((target: string, anchor?: string) => {
		pending.current = { anchor };
		setPageId(target);
		setTick((value) => value + 1);
		setDrawer(false);
		setPalette(false);
	}, []);

	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		// 이 페이지의 목차 (h2·h3에 data-toc)
		setToc(
			[...el.querySelectorAll<HTMLElement>('.dv-doc [data-toc]')].map((node) => ({
				id: node.id,
				text: node.textContent ?? '',
				level: node.dataset.toc ?? '3',
			}))
		);
		const request = pending.current;
		if (!request) return;
		pending.current = null;
		const target = request.anchor ? el.querySelector<HTMLElement>(`#${request.anchor}`) : null;
		scrollToTarget(target);
		const focus = target ?? el.querySelector<HTMLElement>('.dv-page-title, .dv-intro-title');
		if (focus) {
			if (!focus.hasAttribute('tabindex')) focus.setAttribute('tabindex', '-1');
			focus.focus({ preventScroll: true });
		}
	}, [page.id, tick, root, scrollToTarget]);

	// 스크롤 상자의 높이(--dv-view)와 지금 읽는 제목 (오른쪽 목차의 표시)
	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		return onScrollFrame(el, (scroller) => {
			el.style.setProperty('--dv-view', `${scroller ? scroller.clientHeight : window.innerHeight}px`);
			const line = (scroller?.getBoundingClientRect().top ?? 0) + TOP + 40;
			const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
			// 끝까지 내려 더 내려갈 수 없으면, 화면 안의 마지막 제목을 읽는 중으로 본다
			const end = Boolean(
				scroller && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
			);
			let current = '';
			el.querySelectorAll<HTMLElement>('.dv-doc [data-toc]').forEach((node) => {
				const top = node.getBoundingClientRect().top;
				if (top <= line || (end && top < bottom)) current = node.id;
			});
			setActiveToc(current);
		});
	}, [root, page.id]);

	// ⌘K·Ctrl+K: 이 Safari 창에 초점이 있을 때 검색 팔레트를 연다. Esc는 서랍을 닫는다
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const el = root.current;
			if (!el || !el.isConnected || el.offsetParent === null) return;
			if ((event.metaKey || event.ctrlKey) && (event.code === 'KeyK' || event.key.toLowerCase() === 'k')) {
				const scope = el.closest('[data-app]') ?? document.body;
				const focused = document.activeElement;
				if (focused && focused !== document.body && !scope.contains(focused)) return;
				event.preventDefault();
				setDrawer(false);
				setPalette(true);
			} else if (event.key === 'Escape' && drawer) {
				setDrawer(false);
				menuButton.current?.focus();
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [root, drawer]);

	const closePalette = useCallback(() => {
		setPalette(false);
		searchButton.current?.focus();
	}, []);

	const anchorActive = groups.some((group) =>
		group.items.some((item) => item.page === page.id && item.anchor && item.anchor === activeToc)
	);
	const isCurrent = (item: NavItem) =>
		item.page === page.id && (item.anchor ? item.anchor === activeToc : !anchorActive);
	const prev = pages[pageIndex - 1];
	const next = pages[pageIndex + 1];
	const nextSteps = groups.flatMap((group) => {
		const first = group.items.find((item) => item.page !== INTRO && !item.anchor);
		return first ? [{ ...first, group: group.label }] : [];
	});
	const props = [
		{ label: '프로젝트', value: hero.meta.context },
		{ label: '역할', value: hero.meta.role },
		{ label: '기간', value: hero.meta.period },
		{ label: '언어', value: language },
	].filter((row) => row.value);

	return (
		<div ref={root} className="tpl tpl-devtool" style={accent} data-drawer={drawer || undefined}>
			<header className="dv-top">
				<div className="dv-top-inner">
					<button
						ref={menuButton}
						type="button"
						className="dv-icon-btn dv-menu"
						aria-label="문서 목차 열기"
						aria-expanded={drawer}
						aria-controls="dv-sidebar"
						onClick={() => setDrawer((open) => !open)}
					>
						<i className={drawer ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} aria-hidden="true" />
					</button>
					<button type="button" className="dv-brand" onClick={() => go(INTRO)}>
						{hero.icon ? (
							<img className="dv-brand-icon" src={hero.icon} alt="" />
						) : (
							<span className="dv-brand-icon dv-brand-blank" aria-hidden="true">
								▲
							</span>
						)}
						{hero.logo ? (
							<img className="dv-logo" src={hero.logo} alt={hero.name} />
						) : (
							<span className="dv-brand-name">{hero.name}</span>
						)}
					</button>
					<nav className="dv-tabs" aria-label="사이트">
						<button type="button" aria-current="page" onClick={() => go(INTRO)}>
							Docs
						</button>
						{showcase && (
							<button type="button" onClick={() => go(showcase.id)}>
								Showcase
							</button>
						)}
						{repoHref && (
							<a href={repoHref} {...external}>
								GitHub
								<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
							</a>
						)}
					</nav>
					<button
						ref={searchButton}
						type="button"
						className="dv-search"
						aria-haspopup="dialog"
						aria-keyshortcuts="Meta+K Control+K"
						onClick={() => {
							setDrawer(false);
							setPalette(true);
						}}
					>
						<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
						<span className="dv-search-text">문서 검색</span>
						<kbd className="dv-kbd" aria-hidden="true">
							⌘K
						</kbd>
					</button>
				</div>
				{palette && (
					<Palette entries={search} onPick={(entry) => go(entry.page, entry.anchor)} onClose={closePalette} />
				)}
			</header>

			<div className="dv-layout">
				<div className="dv-rail">
					<div className="dv-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />
					<nav className="dv-sidebar" id="dv-sidebar" aria-label="문서 목차">
						{groups.map((group) => (
							<div key={group.label} className="dv-side-group">
								<p className="dv-side-label">{group.label}</p>
								<ul>
									{group.items.map((item) => (
										<li key={`${item.page}-${item.anchor ?? ''}`}>
											<button
												type="button"
												className="dv-side-item"
												aria-current={isCurrent(item) ? 'page' : undefined}
												onClick={() => go(item.page, item.anchor)}
											>
												{item.label}
											</button>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				</div>

				<div className="dv-doc">
					<nav className="dv-crumbs" aria-label="이동 경로">
						<ol>
							<li>Docs</li>
							<li>{page.group}</li>
							<li aria-current="page">{page.title}</li>
						</ol>
					</nav>

					{intro ? (
						<header className="dv-intro">
							<p className="dv-eyebrow">
								{language && <span className="dv-badge dv-badge-accent">{language}</span>}
								<span>{hero.name}</span>
							</p>
							<h1 className="dv-intro-title" tabIndex={-1}>
								{hero.headline}
							</h1>
							{hero.subhead && <p className="dv-page-lead">{hero.subhead}</p>}
							{hero.image && (
								<figure className="dv-figure-box dv-hero-figure">
									<Shot media={hero.image} />
								</figure>
							)}
							{props.length > 0 && (
								<Callout kind="note" label="이 문서에 대하여">
									<dl className="dv-props">
										{props.map((row) => (
											<div key={row.label}>
												<dt>{row.label}</dt>
												<dd>{row.value}</dd>
											</div>
										))}
									</dl>
								</Callout>
							)}
							{quickStart && (
								<div className="dv-quick">
									<h2 className="dv-h2" id={QUICK_START} data-toc="2">
										빠른 시작
									</h2>
									<p>아래 순서를 따르면 바로 살펴볼 수 있습니다.</p>
									<ol className="dv-steps">
										{repoHref && (
											<li>
												<h3 className="dv-h3">저장소 내려받기</h3>
												<p>다음 명령으로 저장소를 내려받습니다.</p>
												<CommandBox command={cloneCommand(repoHref)} />
											</li>
										)}
										{hero.links.length > 0 && (
											<li>
												<h3 className="dv-h3">바로 열어 보기</h3>
												<p>설치하지 않고도 아래 링크에서 바로 확인할 수 있습니다.</p>
												<DevLinks links={hero.links} />
											</li>
										)}
									</ol>
								</div>
							)}
						</header>
					) : (
						<h1 className="visually-hidden">{hero.headline}</h1>
					)}

					<LandingSections landing={pageLanding} renderers={RENDERERS} className="dv-section" />

					{intro && nextSteps.length > 0 && (
						<div className="dv-next">
							<h2 className="dv-h2" id="dv-next-steps" data-toc="2">
								다음 단계
							</h2>
							<ul className="dv-cards">
								{nextSteps.map((item) => (
									<li key={item.page}>
										<button type="button" className="dv-card" onClick={() => go(item.page)}>
											<span className="dv-card-group">{item.group}</span>
											<strong>{item.label}</strong>
											<span className="dv-card-text">{DOCS[item.page as Kind]?.lead}</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}

					{(prev || next) && (
						<nav className="dv-pager" aria-label="이전 페이지와 다음 페이지">
							{prev ? (
								<button type="button" className="dv-pager-link" data-dir="prev" onClick={() => go(prev.id)}>
									<span className="dv-pager-dir">
										<i className="fa-solid fa-chevron-left" aria-hidden="true" />
										이전
									</span>
									<strong>{prev.title}</strong>
								</button>
							) : (
								<span />
							)}
							{next && (
								<button type="button" className="dv-pager-link" data-dir="next" onClick={() => go(next.id)}>
									<span className="dv-pager-dir">
										다음
										<i className="fa-solid fa-chevron-right" aria-hidden="true" />
									</span>
									<strong>{next.title}</strong>
								</button>
							)}
						</nav>
					)}

					<footer className="dv-closing">
						<h2>{closing.title}</h2>
						{closing.lead && <p>{closing.lead}</p>}
						<DevLinks links={closing.links} />
					</footer>
				</div>

				<aside className="dv-toc" aria-label="이 페이지에서">
					{toc.length > 0 && (
						<>
							<p className="dv-toc-title">이 페이지에서</p>
							<ul>
								{toc.map((item) => (
									<li key={item.id} data-level={item.level}>
										<a
											href={`#${item.id}`}
											aria-current={activeToc === item.id ? 'location' : undefined}
											onClick={(event) => {
												event.preventDefault();
												const target = root.current?.querySelector<HTMLElement>(`#${item.id}`) ?? null;
												scrollToTarget(target);
											}}
										>
											{item.text}
										</a>
									</li>
								))}
							</ul>
						</>
					)}
					<button type="button" className="dv-totop" onClick={() => scrollToTarget(null)}>
						<i className="fa-solid fa-arrow-up" aria-hidden="true" />맨 위로
					</button>
				</aside>
			</div>
		</div>
	);
};

export default DevtoolPage;

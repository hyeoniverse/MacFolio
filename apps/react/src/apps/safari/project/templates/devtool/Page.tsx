// devtool 템플릿: Vercel·GitHub의 개발자 제품 페이지처럼. 1px 선으로 짠 가운데 틀 위에, 첫 화면은 가운데 정렬한 고정폭 배지와 한 줄 제목, 단추,
// 그 아래 넓은 터미널 창(복사되는 git clone 명령과 설치·실행 명령, 짧은 출력)이다. 대표 화면은 주요 기능 구역의 첫 그림(편집기 창)으로 옮긴다.
// 구역 머리는 '/features'처럼 경로 모양의 고정폭 이름과 한 줄 설명이다. 숫자는 지표 막대, 기능은 features/01 머리의 카드(그림이 없으면 diff),
// 쓰는 법은 터미널, 만든 방식은 커밋 목록, 진행 과정은 기여 그래프와 git log, 기술은 문법 색이 있는 package.json과 트리,
// 맡은 일은 CODEOWNERS, 마무리는 배포 띠. 빛 번짐·그라데이션 글자 없이 선과 단색 면만. 계약은 templates/README.md
import React, { useMemo } from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	iconOf,
	LandingSections,
	Media,
	TeamList,
	TroubleList,
	useLanding,
	useLandingAccent,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type Landing,
	type SectionOf,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { devtoolAccent } from './accent';
import {
	cloneCommand,
	commitHash,
	contributionGraph,
	featureDiff,
	packageEntries,
	parseTree,
	type JsonValue,
} from './code';
import { DevLinks, Editor, HeroTerminal, JsonView, Tree } from './Hero';
import './Page.css';

/* ─── 작은 조각 ─── */

const pad = (n: number) => String(n).padStart(2, '0');

/** 숫자 값을 숫자와 단위로 (120개 → 120, 개). 숫자로 시작하지 않으면 통째로 */
function splitValue(value: string): { number: string; unit: string } {
	const match = /^([+\-−]?[\d.,]+)\s*(.*)$/.exec(value.trim());
	return match ? { number: match[1], unit: match[2] } : { number: value, unit: '' };
}

const Value: React.FC<{ value: string; className?: string }> = ({ value, className = 'dv-value' }) => {
	const { number, unit } = splitValue(value);
	return (
		<strong className={className}>
			<span className="dv-value-num">{number}</span>
			{unit && <span className="dv-unit">{unit}</span>}
		</strong>
	);
};

const Icon: React.FC<{ point: Pick<LandingPoint, 'icon'>; index: number; className?: string }> = ({
	point,
	index,
	className = 'dv-icon',
}) => (
	<span className={className} aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 구역마다의 경로 이름 (개발 문서 사이트의 주소처럼) */
const ROUTES: Record<LandingSection['kind'], string> = {
	stats: 'stats',
	features: 'features',
	screens: 'previews',
	steps: 'getting-started',
	built: 'architecture',
	troubleshooting: 'issues',
	stories: 'docs',
	controls: 'keybindings',
	tech: 'stack',
	team: 'contributors',
	role: 'owners',
	timeline: 'changelog',
	deployments: 'deployments',
	credits: 'credits',
};

/** 구역마다 개발 문서 말투의 한 줄 설명 (공용 sectionTitle 대신) */
function describe(section: LandingSection): string {
	switch (section.kind) {
		case 'features':
			return '자주 쓰는 기능을 하나씩 살펴봅니다.';
		case 'screens':
			return '배포된 화면을 미리 볼 수 있습니다.';
		case 'steps':
			return section.items.length > 1
				? `터미널을 열고 ${section.items.length}단계로 시작합니다.`
				: '터미널에서 바로 시작합니다.';
		case 'built':
			return '내부 구현을 커밋 단위로 정리했습니다.';
		case 'troubleshooting':
			return '해결한 이슈와 그 과정을 남겨 두었습니다.';
		case 'stories':
			return '설계 문서에 남긴 이야기입니다.';
		case 'controls':
			return '단축키로 더 빠르게 다룰 수 있습니다.';
		case 'tech':
			return '의존성과 실행 환경을 한 파일에 정리했습니다.';
		case 'team':
			return '이 저장소에 기여한 사람들입니다.';
		case 'role':
			return '맡은 영역과 기여한 내용을 정리했습니다.';
		case 'timeline':
			return '첫 커밋부터 릴리스까지의 기록입니다.';
		case 'deployments':
			return '배포된 환경은 다음과 같습니다.';
		case 'credits':
			return '빌려 쓴 자료와 그 출처입니다.';
		default:
			return '';
	}
}

/** 구역 머리: '/features'처럼 경로 모양의 고정폭 이름(h2의 이름은 구역 이름), 아래 한 줄 설명 */
const Head: React.FC<{ section: LandingSection }> = ({ section }) => (
	<header className="dv-head" data-reveal="">
		<h2 className="dv-title">
			<span className="dv-route" aria-hidden="true">
				<span className="dv-route-slash">/</span>
				{ROUTES[section.kind]}
			</span>
			<span className="dv-route-label">{section.label}</span>
		</h2>
		<p className="dv-desc">{describe(section)}</p>
	</header>
);

/** 편집기 창에 넘길 프로젝트 내용 (주 언어는 기술 목록의 맨 앞) */
function editorProps(landing: Landing) {
	const tech = landing.sections.find((section): section is SectionOf<'tech'> => section.kind === 'tech');
	const features = landing.sections.find((section): section is SectionOf<'features'> => section.kind === 'features');
	const repo = landing.hero.links.find((link) => link.kind === 'repo');
	const [language, ...stack] = tech?.stack ?? [];
	return {
		hero: landing.hero,
		language,
		stack,
		features: features?.items ?? [],
		structure: tech?.structure,
		repo: repo?.kind === 'repo' ? repo.href : undefined,
	};
}

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

/** 그림이 없는 기능 카드의 diff 창 (장식) */
const Diff: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="dv-diff" aria-hidden="true">
		<div className="dv-diff-bar">
			<i className="fa-regular fa-file-code" />
			<span>features.ts</span>
			<span className="dv-diff-count">
				<span className="dv-add">+4</span>
				<span className="dv-del">−1</span>
			</span>
		</div>
		<pre>
			{featureDiff(point, index).map((line, i) => (
				<span key={i} className="dv-diff-line" data-sign={line.sign}>
					<span className="dv-diff-sign">{line.sign === '@' ? '' : line.sign}</span>
					{line.text}
				</span>
			))}
		</pre>
	</div>
);

/* ─── 구역 ─── */

const Stat: React.FC<{ fact: ProjectFact; index: number }> = ({ fact, index }) => (
	<li className="dv-metric" data-reveal="" style={{ '--d': index } as React.CSSProperties}>
		<span className="dv-metric-label">{fact.label}</span>
		<Value value={fact.value} />
	</li>
);

const FeatureCard: React.FC<{ point: LandingPoint; index: number; wide: boolean }> = ({ point, index, wide }) => (
	<li className="dv-card" data-wide={wide || undefined} data-reveal="">
		<div className="dv-card-head">
			<span className="dv-path">
				features/<b>{pad(index + 1)}</b>
			</span>
			<Icon point={point} index={index} className="dv-icon dv-icon-quiet" />
		</div>
		<div className="dv-card-body">
			<div className="dv-card-text">
				<h3>{point.title}</h3>
				<p className="dv-body">{point.body}</p>
				{point.detail && <p className="dv-detail">{point.detail}</p>}
			</div>
			{point.media.length ? <PointMedia point={point} /> : <Diff point={point} index={index} />}
		</div>
	</li>
);

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="dv-metrics" data-count={section.facts.length}>
				{section.facts.map((fact, i) => (
					<Stat key={fact.label} fact={fact} index={i} />
				))}
			</ul>
		</>
	),
	features: ({ section, landing }) => (
		<>
			<Head section={section} />
			{landing.hero.image && (
				<div className="dv-preview-editor">
					<Editor {...editorProps(landing)} />
				</div>
			)}
			<ul className="dv-cards">
				{section.items.map((point, i) => (
					<FeatureCard
						key={point.title}
						point={point}
						index={i}
						// 홀수 개면 마지막 카드가 한 줄을 다 쓴다 (빈 칸이 남지 않게)
						wide={section.items.length % 2 === 1 && i === section.items.length - 1}
					/>
				))}
			</ul>
		</>
	),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="dv-previews" data-count={section.shots.length}>
				{section.shots.map((shot, i) => (
					<li key={shot.src} className="dv-preview" data-reveal="">
						<figure>
							<div className="dv-preview-bar" aria-hidden="true">
								<span className="dv-path">preview-{pad(i + 1)}</span>
								<span className="dv-ready">
									<span className="dv-ready-dot" />
									준비됨
								</span>
							</div>
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
			<Head section={section} />
			<div className="dv-terminal" data-reveal="">
				<div className="dv-terminal-bar" aria-hidden="true">
					<span className="dv-dots">
						<span />
						<span />
						<span />
					</span>
					<span>zsh</span>
				</div>
				<ol className="dv-steps">
					{section.items.map((point, i) => (
						<li key={point.title} className="dv-step">
							<div className="dv-step-line">
								<span className="dv-prompt" aria-hidden="true">
									$
								</span>
								<span className="dv-step-cmd">step {i + 1}</span>
								<span className="dv-step-dash" aria-hidden="true">
									—
								</span>
								<h3>{point.title}</h3>
								<Icon point={point} index={i} className="dv-icon dv-icon-inline" />
							</div>
							<p className="dv-step-out">{point.body}</p>
							{point.detail && <p className="dv-step-out dv-step-detail">{point.detail}</p>}
							{point.media.length > 0 && <PointMedia point={point} />}
						</li>
					))}
				</ol>
				<p className="dv-step-done" aria-hidden="true">
					<span className="dv-prompt">$</span>
					<span className="dv-caret" />
				</p>
			</div>
		</>
	),
	built: ({ section }) => (
		<>
			<Head section={section} />
			<div className="dv-commits" data-reveal="">
				<div className="dv-box-head">
					<i className="fa-solid fa-code-commit" aria-hidden="true" />
					<span className="dv-mono">main</span>
					<span className="dv-muted">커밋 {section.items.length}개</span>
				</div>
				<ol>
					{section.items.map((point, i) => (
						<li key={point.title} className="dv-commit" data-media={point.media.length ? '' : undefined}>
							<span className="dv-commit-dot" aria-hidden="true" />
							<div className="dv-commit-main">
								<h3>{point.title}</h3>
								<p className="dv-body">{point.body}</p>
								{point.detail && <p className="dv-detail">{point.detail}</p>}
								{point.media.length > 0 && <PointMedia point={point} />}
							</div>
							<div className="dv-commit-side">
								<Icon point={point} index={i + 2} className="dv-icon dv-icon-quiet" />
								<code className="dv-hash">{commitHash(point.title)}</code>
							</div>
						</li>
					))}
				</ol>
			</div>
		</>
	),
	troubleshooting: ({ section }) => (
		<>
			<Head section={section} />
			<TroubleList items={section.items} prefix="dv" />
		</>
	),
	stories: ({ section }) => (
		<>
			<Head section={section} />
			<div className="dv-stories">
				{section.stories.map((story, n) => (
					<article
						key={story.title}
						className="dv-story"
						aria-label={story.title}
						data-image={story.image ? '' : undefined}
						data-reveal=""
					>
						<div className="dv-box-head">
							<i className="fa-regular fa-file-lines" aria-hidden="true" />
							<span className="dv-mono">docs/{pad(n + 1)}.md</span>
						</div>
						<div className="dv-story-body">
							<div className="dv-story-text">
								<h3 className="dv-story-title">{story.title}</h3>
								{story.lead && <p className="dv-body dv-lead">{story.lead}</p>}
								{story.facts.length > 0 && (
									<dl className="dv-story-facts">
										{story.facts.map((fact) => (
											<div key={fact.label}>
												<dt>{fact.label}</dt>
												<dd>
													<Value value={fact.value} className="dv-value dv-value-sm" />
												</dd>
											</div>
										))}
									</dl>
								)}
								{story.points.length > 0 && (
									<ul className="dv-story-points">
										{story.points.map((point, i) => (
											<li key={point.title}>
												<Icon point={point} index={i} className="dv-icon dv-icon-sm" />
												<div>
													<h4>{point.title}</h4>
													<p>{point.body}</p>
													{point.detail && <p className="dv-detail">{point.detail}</p>}
													{point.media.length > 0 && <PointMedia point={point} />}
												</div>
											</li>
										))}
									</ul>
								)}
							</div>
							{story.image && <Shot media={story.image} className="dv-story-image" />}
						</div>
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<Head section={section} />
			<dl className="dv-keys" data-reveal="">
				{section.controls.map((control, i) => (
					<div key={`${control.label}-${i}`}>
						<dt>
							{control.keys.map((key, k) => (
								<kbd key={`${key}-${k}`} className="dv-kbd">
									{key}
								</kbd>
							))}
						</dt>
						<dd>{control.label}</dd>
					</div>
				))}
			</dl>
		</>
	),
	timeline: ({ section }) => <Timeline section={section} />,
	tech: ({ section, landing }) => {
		const rows = section.structure ? parseTree(section.structure) : [];
		const entries: [string, JsonValue][] = [['name', landing.hero.name]];
		if (section.stack.length) entries.push(['dependencies', section.stack]);
		if (section.specs.length)
			entries.push(['environment', { entries: section.specs.map((spec) => [spec.label, spec.value]) }]);
		return (
			<>
				<Head section={section} />
				<div className="dv-tech" data-reveal="" data-tree={section.structure ? '' : undefined}>
					{(section.stack.length > 0 || section.specs.length > 0) && (
						<div className="dv-panel dv-panel-json">
							<div className="dv-box-head">
								<i className="fa-brands fa-npm" aria-hidden="true" />
								<span className="dv-mono">package.json</span>
								<span className="dv-muted dv-box-end">JSON</span>
							</div>
							<JsonView entries={entries} />
						</div>
					)}
					{section.structure && (
						<figure className="dv-panel">
							<figcaption className="dv-box-head">
								<i className="fa-regular fa-folder-open" aria-hidden="true" />
								<span className="dv-mono">폴더 구조</span>
							</figcaption>
							{rows.length > 0 ? <Tree rows={rows} /> : <pre className="dv-code">{section.structure}</pre>}
						</figure>
					)}
				</div>
			</>
		);
	},
	team: ({ section }) => (
		<>
			<Head section={section} />
			<TeamList members={section.members} prefix="dv" />
		</>
	),
	role: ({ section }) => (
		<>
			<Head section={section} />
			<div className="dv-owners" data-reveal="">
				<div className="dv-box-head">
					<i className="fa-solid fa-user-shield" aria-hidden="true" />
					<span className="dv-mono">.github/CODEOWNERS</span>
				</div>
				{(section.role || section.context || section.period) && (
					<dl className="dv-owners-meta">
						{section.role && (
							<div>
								<dt># 역할</dt>
								<dd>{section.role}</dd>
							</div>
						)}
						{section.context && (
							<div>
								<dt># 프로젝트</dt>
								<dd>{section.context}</dd>
							</div>
						)}
						{section.period && (
							<div>
								<dt># 기간</dt>
								<dd className="dv-mono">{section.period}</dd>
							</div>
						)}
					</dl>
				)}
				{section.contributions.length > 0 && (
					<ul className="dv-owners-list">
						{section.contributions.map((item, i) => (
							<li key={item}>
								<span className="dv-ln" aria-hidden="true">
									{pad(i + 1)}
								</span>
								<span className="dv-owners-text">{item}</span>
								<i className="fa-solid fa-check dv-owners-check" aria-hidden="true" />
							</li>
						))}
					</ul>
				)}
			</div>
		</>
	),
	deployments: ({ section }) => (
		<>
			<Head section={section} />
			<DeployList items={section.items} prefix="dv" />
		</>
	),
	credits: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="dv-credits" data-reveal="">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="dv-credit-role">{credit.role}</span>
						<span className="dv-credit-name">
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
									<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
								</a>
							) : (
								<strong>{credit.name}</strong>
							)}
							<span className="dv-muted">{credit.by}</span>
						</span>
						{credit.note && <span className="dv-credit-note">{credit.note}</span>}
					</li>
				))}
			</ul>
		</>
	),
};

/** 진행 과정: 날짜로 짠 기여 그래프와 git log 모양의 커밋 기록(최근 것이 위, 맨 위에 HEAD 표시). 날짜를 읽지 못하면 기록만 */
const Timeline: React.FC<{ section: SectionOf<'timeline'> }> = ({ section }) => {
	const graph = useMemo(() => contributionGraph(section.entries), [section.entries]);
	return (
		<>
			<Head section={section} />
			<div className="dv-activity" data-reveal="" data-graph={graph ? '' : undefined}>
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
						<p className="dv-graph-legend">
							<span>적음</span>
							{[0, 1, 2, 3, 4].map((level) => (
								<span key={level} className="dv-graph-key" data-level={level} />
							))}
							<span>많음</span>
						</p>
					</div>
				)}
				<div className="dv-log-box">
					<p className="dv-log-head" aria-hidden="true">
						<span className="dv-command-prompt">$</span>
						git log --oneline
					</p>
					<ol className="dv-log" reversed>
						{[...section.entries].reverse().map((entry, i) => (
							<li key={`${entry.date}-${entry.label}`}>
								<code className="dv-hash">{commitHash(`${entry.date}${entry.label}`)}</code>
								<span className="dv-log-label">
									{i === 0 && (
										<span className="dv-log-ref" aria-hidden="true">
											HEAD → main
										</span>
									)}
									{entry.label}
								</span>
								<time>{entry.date}</time>
							</li>
						))}
					</ol>
				</div>
			</div>
		</>
	);
};

/* ─── 페이지 ─── */

/** 마무리 띠의 배포 기록 (장식): 주소는 데모, 없으면 저장소 */
const DeployLog: React.FC<{ name: string; href?: string }> = ({ name, href }) => {
	const host = href?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	return (
		<div className="dv-deploy" aria-hidden="true">
			<p>
				<span className="dv-deploy-tri">▲</span>
				<span>{name}</span>
			</p>
			<p>
				<i className="fa-solid fa-check" />
				<span>빌드를 마쳤습니다.</span>
				<span className="dv-deploy-time">12s</span>
			</p>
			<p>
				<i className="fa-solid fa-check" />
				<span>배포를 마쳤습니다.</span>
				<span className="dv-deploy-time">3s</span>
			</p>
			{host && (
				<p className="dv-deploy-url">
					<span className="dv-ready-dot" />
					<span>{host}</span>
				</p>
			)}
		</div>
	);
};

const DevtoolPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = devtoolAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const find = <K extends LandingSection['kind']>(kind: K) =>
		landing.sections.find((section): section is SectionOf<K> => section.kind === kind);
	const features = find('features')?.items ?? [];
	const tech = find('tech');
	const repo = hero.links.find((link) => link.kind === 'repo');
	const demo = hero.links.find((link) => link.kind === 'demo');
	const language = project.language?.trim() || undefined;
	const stack = tech?.stack ?? [];

	return (
		<div ref={root} className="tpl tpl-devtool" style={accent}>
			<div className="dv-frame">
				<header className="dv-hero">
					<p className="dv-brand">
						{hero.icon ? (
							<img className="dv-app-icon" src={hero.icon} alt="" />
						) : (
							<span className="dv-app-icon dv-app-icon-blank" aria-hidden="true">
								▲
							</span>
						)}
						{hero.logo ? <img className="dv-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
					</p>
					{(language || hero.meta.context) && (
						<p className="dv-badge">
							<span className="dv-badge-dot" aria-hidden="true" />
							{language && <span className="dv-mono">{language}</span>}
							{language && hero.meta.context && (
								<span className="dv-badge-sep" aria-hidden="true">
									/
								</span>
							)}
							{hero.meta.context && <span>{hero.meta.context}</span>}
						</p>
					)}
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="dv-subhead">{hero.subhead}</p>}
					<DevLinks links={hero.links} className="dv-hero-links" />
					{hero.meta.role && (
						<p className="dv-hero-role">
							<i className="fa-regular fa-user" aria-hidden="true" />
							{hero.meta.role}
						</p>
					)}
					<HeroTerminal
						command={repo?.kind === 'repo' ? cloneCommand(repo.href) : undefined}
						repo={repo?.kind === 'repo' ? repo.href : undefined}
						json={packageEntries({
							name: hero.name,
							description: hero.subhead,
							language,
							stack: stack.filter((item) => item !== language),
							features,
							repo: undefined,
						})}
						language={language}
						period={hero.meta.period}
					/>
					{/* 대표 화면은 주요 기능 구역의 첫 그림으로 옮긴다. 그 구역이 없으면 여기에 둔다 */}
					{hero.image && !find('features') && (
						<div className="dv-preview-editor">
							<Editor {...editorProps(landing)} />
						</div>
					)}
				</header>

				<LandingSections landing={landing} renderers={RENDERERS} className="dv-section" />

				<footer className="dv-closing">
					<div className="dv-closing-band" data-reveal="">
						<div className="dv-closing-text">
							<h2>{closing.title}</h2>
							{closing.lead && <p className="dv-subhead">{closing.lead}</p>}
							<DevLinks links={closing.links} />
						</div>
						<DeployLog
							name={hero.name}
							href={demo?.kind === 'demo' ? demo.href : repo?.kind === 'repo' ? repo.href : undefined}
						/>
					</div>
				</footer>
			</div>
		</div>
	);
};

export default DevtoolPage;

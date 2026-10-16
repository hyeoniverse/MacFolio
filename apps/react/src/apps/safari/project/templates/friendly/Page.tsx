// friendly 템플릿: Stripe의 제품 소개처럼 밝고 또렷하게. 남색 제목과 회청색 본문, 강조색 하나(탁하면 Stripe 남보라, accent.ts).
// 맨 위에 붙는 막대(Nav.tsx), 넓은 단색 띠 위의 첫 화면(왼쪽 큰 제목, 오른쪽 소개와 단추, 그 아래 띠를 넘어 내려오는 큰 창),
// 그리고 이 페이지의 중심인 기능 탐색기(Explorer.tsx: 왼쪽 기능 목록, 오른쪽 그 기능의 화면이 바뀌는 큰 창).
// 아래로는 가로 단계, 남색 띠의 구현 카드, 사례를 펼치는 트러블슈팅, 로고 벽 같은 기술, 고객 사례 같은 팀과 역할,
// 가로 로드맵, 연동 카드 같은 배포 결과물, 남색 마무리 띠. 구역 제목은 얻는 것을 말하는 문장이다.
// 그림이 없으면 창 안에 프로젝트 내용으로 만든 앱 화면 모형(Mock.tsx, Explorer의 기능 모형)을 그려 새 프로젝트의 기본 모양으로도 꽉 차 보인다.
// 계약은 templates/README.md
import React, { useRef } from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	FaIcon,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	MemberAvatar,
	shortLink,
	troubleIcon,
	troubleSteps,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { friendlyAccent } from './accent';
import { Explorer } from './Explorer';
import { addressOf } from './address';
import { Frame, Window } from './Frame';
import { HeroMock } from './Mock';
import { Nav } from './Nav';
import './Page.css';

/** 구역 제목: 이 구역을 읽으면 얻는 것을 말하는 문장 */
function titleOf(section: LandingSection): string {
	switch (section.kind) {
		case 'stats':
			return '숫자가 먼저 성과를 말해 줍니다.';
		case 'features':
			return '필요한 기능을 하나씩 살펴보세요.';
		case 'screens':
			return '실제 화면에서 흐름을 확인하세요.';
		case 'steps':
			return section.items.length > 1
				? `${section.items.length}단계면 바로 시작할 수 있습니다.`
				: '한 번에 바로 시작할 수 있습니다.';
		case 'built':
			return '보이지 않는 곳까지 단단하게 만들었습니다.';
		case 'troubleshooting':
			return '문제를 만나면 원인부터 찾아 해결했습니다.';
		case 'stories':
			return '만들게 된 까닭과 그 뒤의 이야기입니다.';
		case 'controls':
			return '손에 익는 단축키로 더 빠르게 움직입니다.';
		case 'tech':
			return '검증된 기술 위에 세웠습니다.';
		case 'team':
			return '각자의 강점을 모아 함께 만들었습니다.';
		case 'role':
			return '맡은 일을 처음부터 끝까지 책임졌습니다.';
		case 'timeline':
			return '계획한 차례대로 한 단계씩 완성했습니다.';
		case 'deployments':
			return '지금 바로 연결해 볼 수 있습니다.';
		case 'credits':
			return '좋은 도구와 자료 덕분에 완성했습니다.';
	}
}

const Head: React.FC<{ section: LandingSection; lead?: string; tone?: 'center' }> = ({ section, lead, tone }) => (
	<header className="fr-head" data-tone={tone} data-reveal="">
		<p className="fr-eyebrow">{section.label}</p>
		<h2 tabIndex={-1}>{titleOf(section)}</h2>
		{lead && <p className="fr-lead">{lead}</p>}
	</header>
);

/** 아이콘 칸: 강조색을 옅게 깐 둥근 네모 */
const IconTile: React.FC<{ point: Pick<LandingPoint, 'icon'>; index: number }> = ({ point, index }) => (
	<span className="fr-icon" aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 한 줄에 놓을 칸 수: 마지막 줄이 가장 덜 비는 수 (같으면 큰 수) */
function columnsFor(count: number, choices: number[]) {
	if (count <= choices[0]) return Math.max(count, 1);
	let best = choices[0];
	let empty = Infinity;
	for (const c of choices) {
		const rest = (c - (count % c)) % c;
		if (rest < empty) {
			best = c;
			empty = rest;
		}
	}
	return best;
}

/** 남색 띠의 구현 카드: 그림이 있는 항목은 한 줄 전체에 글과 창을 나란히, 나머지는 아이콘 카드 격자 */
const BuiltCards: React.FC<{ items: LandingPoint[] }> = ({ items }) => {
	const plain = items.filter((point) => point.media.length === 0).length;
	return (
		<ul className="fr-built" style={{ '--n': columnsFor(plain, [3, 2]) } as React.CSSProperties}>
			{items.map((point, i) => (
				<li key={point.title} data-media={point.media.length ? '' : undefined} data-reveal="">
					<div className="fr-built-text">
						<IconTile point={point} index={i + 3} />
						<h3>{point.title}</h3>
						<p>{point.body}</p>
						{point.detail && <p className="fr-detail">{point.detail}</p>}
					</div>
					{point.media.length > 0 && (
						<div className="fr-built-media">
							{point.media.map((media) => (
								<Window key={media.src} media={media} />
							))}
						</div>
					)}
				</li>
			))}
		</ul>
	);
};

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<div className="fr-wrap fr-stats-wrap">
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="fr-stats" data-count={Math.min(section.facts.length, 4)}>
				{section.facts.map((fact) => (
					<li key={fact.label} data-reveal="">
						<strong>{fact.value}</strong>
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		</div>
	),
	features: ({ section, landing }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<Explorer items={section.items} address={addressOf(landing)} name={landing.hero.name} />
		</div>
	),
	screens: ({ section, landing }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<ul className="fr-screens" data-count={section.shots.length}>
				{section.shots.map((shot, i) => (
					<li key={shot.src} data-reveal="">
						<Window media={shot} address={addressOf(landing)} />
						<p>
							<span className="fr-num">{String(i + 1).padStart(2, '0')}</span>
							{shot.caption}
						</p>
					</li>
				))}
			</ul>
		</div>
	),
	steps: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} tone="center" />
			<ol className="fr-steps" data-count={Math.min(section.items.length, 4)}>
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="">
						<span className="fr-step-mark" aria-hidden="true">
							{index + 1}
						</span>
						<div className="fr-step-card">
							<IconTile point={point} index={index} />
							<h3>{point.title}</h3>
							<p>{point.body}</p>
							{point.detail && <p className="fr-detail">{point.detail}</p>}
							{point.media.map((media) => (
								<Window key={media.src} media={media} className="fr-step-media" />
							))}
						</div>
					</li>
				))}
			</ol>
		</div>
	),
	built: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<BuiltCards items={section.items} />
		</div>
	),
	troubleshooting: ({ section }) => (
		<div className="fr-wrap fr-split">
			<Head section={section} lead="사례를 누르면 문제에서 결과까지의 과정을 펼쳐 볼 수 있습니다." />
			<div className="fr-cases" data-reveal="">
				{section.items.map((item, i) => (
					<details key={item.title} className="fr-case" open={i === 0}>
						<summary>
							<span className="fr-case-icon" aria-hidden="true">
								<FaIcon icon={troubleIcon(item)} />
							</span>
							<span className="fr-num">{String(i + 1).padStart(2, '0')}</span>
							<h3>{item.title}</h3>
							<i className="fa-solid fa-chevron-down fr-case-chevron" aria-hidden="true" />
						</summary>
						<div className="fr-case-body" data-image={item.image ? '' : undefined}>
							<ol className="fr-case-steps">
								{troubleSteps(item).map((step) => (
									<li key={step.key} data-step={step.key}>
										<span className="fr-case-label">{step.label}</span>
										<p>{step.text}</p>
									</li>
								))}
							</ol>
							{item.image && <Window media={item.image} className="fr-case-image" />}
						</div>
					</details>
				))}
			</div>
		</div>
	),
	stories: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<div className="fr-stories">
				{section.stories.map((story, i) => (
					<article
						key={story.title}
						className="fr-story"
						aria-label={story.title}
						data-image={story.image ? '' : undefined}
						data-flip={i % 2 === 1 ? '' : undefined}
						data-reveal=""
					>
						<div className="fr-story-text">
							<span className="fr-num">{String(i + 1).padStart(2, '0')}</span>
							<h3>{story.title}</h3>
							{story.lead && <p className="fr-story-lead">{story.lead}</p>}
							{story.facts.length > 0 && (
								<ul className="fr-story-facts">
									{story.facts.map((fact) => (
										<li key={fact.label}>
											<strong>{fact.value}</strong>
											<span>{fact.label}</span>
										</li>
									))}
								</ul>
							)}
						</div>
						{story.points.length > 0 && (
							<ul className="fr-story-points">
								{story.points.map((point) => (
									<li key={point.title}>
										<i className="fa-solid fa-check" aria-hidden="true" />
										<div>
											<strong>{point.title}</strong>
											<p>{point.body}</p>
											{point.detail && <p className="fr-detail">{point.detail}</p>}
											{point.media.map((media) => (
												<Media key={media.src} media={media} className="fr-story-point-media" />
											))}
										</div>
									</li>
								))}
							</ul>
						)}
						{story.image && <Window media={story.image} className="fr-story-image" />}
					</article>
				))}
			</div>
		</div>
	),
	controls: ({ section }) => (
		<div className="fr-wrap fr-split">
			<Head section={section} />
			<dl className="fr-controls" data-reveal="">
				{section.controls.map((control) => (
					<div key={control.label}>
						<dt>
							{control.keys.map((key) => (
								<kbd key={key}>{key}</kbd>
							))}
						</dt>
						<dd>{control.label}</dd>
					</div>
				))}
			</dl>
		</div>
	),
	tech: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} tone="center" />
			{section.stack.length > 0 && (
				<ul
					className="fr-wall"
					aria-label="쓴 기술"
					style={{ '--n': columnsFor(section.stack.length, [6, 5, 4]) } as React.CSSProperties}
					data-reveal=""
				>
					{section.stack.map((item, i) => (
						<li key={item} data-mono={Array.from(item)[0]} data-main={i === 0 ? '' : undefined}>
							{item}
						</li>
					))}
				</ul>
			)}
			{(section.specs.length > 0 || section.structure) && (
				<div className="fr-tech" data-structure={section.structure ? '' : undefined} data-reveal="">
					{section.specs.length > 0 && (
						<dl className="fr-specs">
							{section.specs.map((spec) => (
								<div key={spec.label}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
					)}
					{section.structure && (
						<figure className="fr-code">
							<figcaption>
								<i className="fa-solid fa-folder-tree" aria-hidden="true" />
								폴더 구조
							</figcaption>
							<pre>{section.structure}</pre>
						</figure>
					)}
				</div>
			)}
		</div>
	),
	team: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<ul className="fr-team" data-count={Math.min(section.members.length, 4)}>
				{section.members.map((member) => (
					<li key={member.name} data-me={member.me ? '' : undefined} data-reveal="">
						<MemberAvatar member={member} className="fr-avatar" />
						<h3>
							{member.name}
							{member.me && <span className="fr-me">나</span>}
						</h3>
						<p className="fr-member-role">{member.role}</p>
						{member.url && (
							<a
								className="fr-member-link"
								href={member.url}
								title={member.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								<FaIcon icon={/github\.com/.test(member.url) ? 'fa-github' : 'fa-link'} />
								<span>{shortLink(member.url)}</span>
							</a>
						)}
					</li>
				))}
			</ul>
		</div>
	),
	role: ({ section }) => (
		<div className="fr-wrap">
			<div className="fr-role" data-reveal="">
				<div className="fr-role-quote">
					<p className="fr-eyebrow">{section.label}</p>
					<h2 tabIndex={-1}>{section.role ?? titleOf(section)}</h2>
					{(section.context || section.period) && (
						<dl className="fr-role-meta">
							{section.context && (
								<div>
									<dt>프로젝트</dt>
									<dd>{section.context}</dd>
								</div>
							)}
							{section.period && (
								<div>
									<dt>기간</dt>
									<dd>{section.period}</dd>
								</div>
							)}
						</dl>
					)}
				</div>
				{section.contributions.length > 0 && (
					<ul className="fr-checks">
						{section.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-check" aria-hidden="true" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	),
	timeline: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<ol className="fr-roadmap" data-count={section.entries.length} data-reveal="">
				{section.entries.map((entry, i) => (
					<li key={`${entry.date}-${entry.label}`} data-last={i === section.entries.length - 1 ? '' : undefined}>
						<time>{entry.date}</time>
						<span className="fr-roadmap-dot" aria-hidden="true" />
						<span className="fr-roadmap-label">{entry.label}</span>
					</li>
				))}
			</ol>
		</div>
	),
	deployments: ({ section }) => (
		<div className="fr-wrap">
			<Head section={section} />
			<ul className="fr-integrations" data-count={Math.min(section.items.length, 3)}>
				{section.items.map((item) => (
					<li key={item.label} data-live={item.url ? '' : undefined} data-reveal="">
						<div className="fr-int-top">
							<span className="fr-int-icon" aria-hidden="true">
								<FaIcon icon={item.icon} />
							</span>
							<span className="fr-int-status">{item.url ? '공개' : '링크 없음'}</span>
						</div>
						<h3>
							{item.url ? (
								<a href={item.url} target="_blank" rel="noopener noreferrer">
									{item.label}
								</a>
							) : (
								item.label
							)}
						</h3>
						{(item.platform || item.host) && (
							<p className="fr-int-meta">{[item.platform, item.host].filter(Boolean).join(' · ')}</p>
						)}
						{item.note && <p className="fr-int-note">{item.note}</p>}
						{item.image && (
							<figure className="fr-int-image">
								<Media media={item.image} />
							</figure>
						)}
						{item.url && (
							<span className="fr-int-go" aria-hidden="true">
								열어 보기 <i className="fa-solid fa-arrow-right" />
							</span>
						)}
					</li>
				))}
			</ul>
		</div>
	),
	credits: ({ section }) => (
		<div className="fr-wrap fr-split">
			<Head section={section} />
			<ul className="fr-credits" data-reveal="">
				{section.credits.map((credit) => (
					<li key={`${credit.role}-${credit.name}`}>
						<span className="fr-credit-role">{credit.role}</span>
						<strong>
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
									<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
								</a>
							) : (
								credit.name
							)}
						</strong>
						<span className="fr-credit-by">{credit.by}</span>
						{credit.note && <span className="fr-credit-note">{credit.note}</span>}
					</li>
				))}
			</ul>
		</div>
	),
};

/** 마무리 띠 오른쪽의 짧은 글: 어떤 프로젝트·맡은 일·기간 가운데 있는 것 (없으면 띠는 한 단) */
function closingNotesOf(landing: Landing) {
	const { meta } = landing.hero;
	return [
		meta.context && { icon: 'fa-users', title: '어떤 프로젝트', body: meta.context },
		meta.role && { icon: 'fa-user-pen', title: '맡은 일', body: meta.role },
		meta.period && { icon: 'fa-calendar', title: '기간', body: meta.period },
	].filter((note): note is { icon: string; title: string; body: string } => Boolean(note));
}

const FriendlyPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const title = useRef<HTMLHeadingElement>(null);
	const accent = friendlyAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const address = addressOf(landing);
	const notes = closingNotesOf(landing);

	return (
		<div ref={root} className="tpl tpl-friendly" style={accent}>
			<Nav landing={landing} sentinel={title} />
			<header className="fr-hero">
				<span className="fr-band" aria-hidden="true">
					<i />
					<i />
					<i />
				</span>
				<div className="fr-hero-inner">
					<p className="fr-pill">
						{hero.icon && <img className="fr-brand-icon" src={hero.icon} alt="" />}
						{hero.logo ? (
							<img className="fr-logo" src={hero.logo} alt={hero.name} />
						) : (
							<span className="fr-pill-name">{hero.name}</span>
						)}
						{hero.meta.context && <span className="fr-pill-context">{hero.meta.context}</span>}
					</p>
					<div className="fr-hero-grid" data-side={hero.subhead || hero.links.length ? '' : undefined}>
						<h1 ref={title}>{hero.headline}</h1>
						<div className="fr-hero-side">
							{hero.subhead && <p className="fr-subhead">{hero.subhead}</p>}
							<LandingLinks links={hero.links} className="fr-links" />
						</div>
					</div>
					<div className="fr-hero-art" data-reveal="zoom">
						{hero.image ? (
							<Window media={hero.image} eager address={address} />
						) : (
							<Frame address={address} className="fr-window-mock">
								<HeroMock landing={landing} />
							</Frame>
						)}
					</div>
				</div>
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="fr-section" />

			<footer className="fr-closing">
				<div className="fr-closing-inner" data-notes={notes.length ? '' : undefined} data-reveal="">
					<div className="fr-closing-text">
						{closing.lead && <p className="fr-eyebrow">{closing.lead}</p>}
						<h2>{closing.title}</h2>
						<LandingLinks links={closing.links} className="fr-links fr-closing-links" />
					</div>
					{notes.length > 0 && (
						<ul className="fr-closing-notes">
							{notes.map((note) => (
								<li key={note.title}>
									<span className="fr-icon" aria-hidden="true">
										<i className={`fa-solid ${note.icon}`} />
									</span>
									<strong>{note.title}</strong>
									<p>{note.body}</p>
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="fr-footer">
					<span>{hero.name}</span>
					{hero.meta.period && <span>{hero.meta.period}</span>}
				</div>
			</footer>
		</div>
	);
};

export default FriendlyPage;

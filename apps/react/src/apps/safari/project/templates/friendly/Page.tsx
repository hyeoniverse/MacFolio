// friendly 템플릿: Stripe처럼 밝고 또렷하게. 남색 제목과 회청색 본문, 강조색 하나(탁하면 Stripe 남보라, accent.ts).
// 첫 화면은 비스듬히 잘린 옅은 색 띠와 그 끝을 따라 놓인 단색 줄무늬, 띠를 넘어 내려오는 큰 창과 그 위에 겹친 작은 UI 카드 둘(Cards.tsx).
// 첫 화면 아래에는 쓴 기술 이름을 회색 글자 로고처럼 늘어놓은 줄. 구역 머리는 Stripe의 구역 소개처럼 왼쪽에 강조색 구역 이름과 두 줄 제목,
// 오른쪽 단에 짧은 본문(copy.ts). 주요 기능은 첫 카드가 두 줄 높이로 그림을 담는 3열 아이콘 판, 아래로는 왼쪽 강조선이 달린 숫자,
// 선으로 이은 단계 띠, 남색 띠의 만든 방식, 비스듬한 남색 마무리 띠.
// 그림이 없으면 창 안에 프로젝트 내용으로 만든 앱 화면 모형(Mock.tsx)을 그려 새 프로젝트의 기본 모양으로도 꽉 차 보인다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	TeamList,
	TroubleList,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionOf,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { friendlyAccent } from './accent';
import { HeroCards } from './Cards';
import { headCopyOf } from './copy';
import { HeroMock } from './Mock';
import './Page.css';

/**
 * 구역 머리 (Stripe의 구역 소개): 왼쪽에 강조색의 짧은 구역 이름과 두 줄로 끊은 큰 제목, 오른쪽 단에 짧은 본문.
 * 두 단 구역(fr-split) 안에서는 한 단으로 쌓인다 (CSS)
 */
const Head: React.FC<{ section: LandingSection; title?: string }> = ({ section, title }) => {
	const copy = headCopyOf(section);
	return (
		<header className="fr-head" data-lead={copy.lead ? '' : undefined} data-reveal="">
			<div className="fr-head-title">
				<p className="fr-eyebrow">{section.label}</p>
				<h2>
					{title ?? (
						<>
							<span>{copy.title[0]}</span> <span>{copy.title[1]}</span>
						</>
					)}
				</h2>
			</div>
			{copy.lead && <p className="fr-lead">{copy.lead}</p>}
		</header>
	);
};

/** 창 틀 위 막대에 보일 주소: 데모나 저장소의 호스트, 없으면 이름 */
function addressOf(landing: Landing) {
	for (const link of landing.hero.links) {
		if (link.kind === 'app' || link.kind === 'slides') continue;
		try {
			return new URL(link.href).host;
		} catch {
			// 주소가 아니면 다음 링크
		}
	}
	return landing.hero.name;
}

/** 브라우저 창 틀: 점 셋과 주소 칸 (장식) */
const Frame: React.FC<{ address?: string; className?: string; children: React.ReactNode }> = ({
	address,
	className,
	children,
}) => (
	<figure className={['fr-window', className].filter(Boolean).join(' ')}>
		<span className="fr-window-bar" aria-hidden="true">
			<i />
			<i />
			<i />
			{address && <span className="fr-window-address">{address}</span>}
		</span>
		<div className="fr-window-body">{children}</div>
	</figure>
);

const Window: React.FC<{ media: LandingMedia; eager?: boolean; className?: string; address?: string }> = ({
	media,
	eager,
	className,
	address,
}) => (
	<Frame address={address} className={className}>
		<Media media={media} eager={eager} />
	</Frame>
);

/** 아이콘 칸: 강조색을 옅게 깐 둥근 네모 */
const IconTile: React.FC<{ point: Pick<LandingPoint, 'icon'>; index: number }> = ({ point, index }) => (
	<span className="fr-icon" aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 12칸 격자에서 한 항목이 차지할 칸 수: 셋씩 놓고(넷이면 넷 모두 한 줄), 마지막 줄이 비지 않게 남은 항목을 넓힌다 */
function spanOf(index: number, count: number) {
	if (count === 1) return 12;
	if (count === 2) return 6;
	if (count === 4) return 3;
	const rest = count % 3;
	// 3n+1개: 마지막 네 항목을 둘씩 두 줄로
	if (rest === 1 && index >= count - 4) return 6;
	if (rest === 2 && index >= count - 2) return 6;
	return 4;
}

/** 그림이 있는 항목: 글과 큰 그림을 나란히 (화면이 여러 장이면 창 여러 개) */
const FeatureRow: React.FC<{ point: LandingPoint; index: number; flip: boolean }> = ({ point, index, flip }) => (
	<li className="fr-row" data-flip={flip ? '' : undefined} data-reveal="">
		<div className="fr-row-text">
			<IconTile point={point} index={index} />
			<h3>{point.title}</h3>
			<p className="fr-row-body">{point.body}</p>
			{point.detail && <p className="fr-detail">{point.detail}</p>}
		</div>
		<div className="fr-row-media" data-count={Math.min(point.media.length, 3)}>
			{point.media.map((media) => (
				<Window key={media.src} media={media} />
			))}
		</div>
	</li>
);

/** 그림이 없는 항목: 아이콘, 제목(왼쪽 강조 선), 설명 */
const FeatureCell: React.FC<{ point: LandingPoint; index: number; span: number }> = ({ point, index, span }) => (
	<li className="fr-cell" data-span={span} data-reveal="">
		<IconTile point={point} index={index} />
		<h3>{point.title}</h3>
		<p>{point.body}</p>
		{point.detail && <p className="fr-detail">{point.detail}</p>}
	</li>
);

/**
 * 주요 기능·만든 방식: 그림이 있는 항목은 글과 창을 나란히 큰 줄로 먼저, 나머지는 아이콘 격자로.
 * 그림 있는 항목이 없고 셋 이하면 제목을 왼쪽에, 항목을 오른쪽에 두는 두 단 (짧은 페이지도 빈 여백이 남지 않게)
 */
const Features: React.FC<{ section: LandingSection; items: LandingPoint[]; iconOffset?: number }> = ({
	section,
	items,
	iconOffset = 0,
}) => {
	const indexed = items.map((point, i) => ({ point, index: i + iconOffset }));
	const rows = indexed.filter(({ point }) => point.media.length > 0);
	const cells = indexed.filter(({ point }) => point.media.length === 0);
	const split = rows.length === 0 && cells.length <= 3;
	const grid = cells.length > 0 && (
		<ul className="fr-cells" data-count={cells.length}>
			{cells.map(({ point, index }, i) => (
				<FeatureCell
					key={point.title}
					point={point}
					index={index}
					span={split ? 12 / Math.min(cells.length, 2) : spanOf(i, cells.length)}
				/>
			))}
		</ul>
	);
	if (split)
		return (
			<div className="fr-split" data-wide={cells.length > 1 ? '' : undefined}>
				<Head section={section} />
				{grid}
			</div>
		);
	return (
		<>
			<Head section={section} />
			{rows.length > 0 && (
				<ul className="fr-rows">
					{rows.map(({ point, index }, i) => (
						<FeatureRow key={point.title} point={point} index={index} flip={i % 2 === 1} />
					))}
				</ul>
			)}
			{grid}
		</>
	);
};

/**
 * 주요 기능 판의 자리 (6칸 격자에서 각 칸의 너비): 첫 카드는 두 줄 높이로 왼쪽 3분의 1을 차지하고,
 * 그 옆 두 줄에 넷까지(2칸씩, 셋이면 아랫줄 하나가 4칸, 둘이면 4칸씩), 그 아래는 셋씩 놓되 마지막 줄이 비지 않게 넓힌다
 */
function boardSpansOf(count: number): number[] {
	const beside = Math.min(count - 1, 4);
	const spans = beside === 4 ? [2, 2, 2, 2] : beside === 3 ? [2, 2, 4] : beside === 2 ? [4, 4] : [4];
	const rest = count - 1 - beside;
	for (let i = 0; i < rest; i++) {
		const left = rest % 3;
		const inLast = i >= rest - left;
		spans.push(inLast ? 6 / left : 2);
	}
	return spans.slice(0, count - 1);
}

/**
 * 주요 기능 판 (이 템플릿의 대표 구역): 3열 아이콘 격자에 첫 기능은 두 줄 높이의 큰 카드로, 그 기능의 그림(없으면 큰 아이콘 면)을 담는다.
 * 나머지 카드도 그림이 있으면 카드 아래에 작은 창으로 단다
 */
const FeatureBoard: React.FC<{ section: SectionOf<'features'> }> = ({ section }) => {
	const [lead, ...others] = section.items;
	const spans = boardSpansOf(section.items.length);
	return (
		<>
			<Head section={section} />
			<ul className="fr-board">
				<li className="fr-tile fr-tile-lead" data-reveal="">
					<div className="fr-tile-text">
						<IconTile point={lead} index={0} />
						<h3>{lead.title}</h3>
						<p className="fr-tile-body">{lead.body}</p>
						{lead.detail && <p className="fr-detail">{lead.detail}</p>}
					</div>
					{lead.media.length > 0 ? (
						<div className="fr-tile-media" data-count={Math.min(lead.media.length, 3)}>
							{lead.media.map((media) => (
								<Window key={media.src} media={media} />
							))}
						</div>
					) : (
						<span className="fr-tile-art" aria-hidden="true">
							<i className={`fa-solid ${iconOf(lead, 0)}`} />
						</span>
					)}
				</li>
				{others.map((point, i) => (
					<li
						key={point.title}
						className="fr-tile"
						style={{ '--span': spans[i] } as React.CSSProperties}
						data-media={point.media.length ? '' : undefined}
						data-reveal=""
					>
						<div className="fr-tile-text">
							<IconTile point={point} index={i + 1} />
							<h3>{point.title}</h3>
							<p className="fr-tile-body">{point.body}</p>
							{point.detail && <p className="fr-detail">{point.detail}</p>}
						</div>
						{point.media.length > 0 && (
							<div className="fr-tile-media" data-count={Math.min(point.media.length, 3)}>
								{point.media.map((media) => (
									<Window key={media.src} media={media} />
								))}
							</div>
						)}
					</li>
				))}
			</ul>
		</>
	);
};

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="fr-stats" data-count={Math.min(section.facts.length, 4)}>
				{section.facts.map((fact) => (
					<li key={fact.label} data-reveal="">
						<strong>{fact.value}</strong>
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section }) =>
		section.items.length >= 3 ? (
			<FeatureBoard section={section} />
		) : (
			<Features section={section} items={section.items} />
		),
	screens: ({ section }) => (
		<>
			<Head section={section} />
			<ul className="fr-screens" data-count={section.shots.length}>
				{section.shots.map((shot, i) => (
					<li key={shot.src} data-reveal="">
						<Window media={shot} />
						<p>
							<span className="fr-num">{String(i + 1).padStart(2, '0')}</span>
							{shot.caption}
						</p>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<Head section={section} />
			<ol className="fr-steps" data-count={Math.min(section.items.length, 4)}>
				{section.items.map((point, index) => (
					<li key={point.title} data-reveal="">
						<span className="fr-step-mark" aria-hidden="true">
							<span className="fr-step-num">{index + 1}</span>
						</span>
						<div className="fr-step-title">
							<IconTile point={point} index={index} />
							<h3>{point.title}</h3>
						</div>
						<p>{point.body}</p>
						{point.detail && <p className="fr-detail">{point.detail}</p>}
						{point.media.map((media) => (
							<Window key={media.src} media={media} className="fr-step-media" />
						))}
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => <Features section={section} items={section.items} iconOffset={3} />,
	troubleshooting: ({ section }) => (
		<>
			<Head section={section} />
			<TroubleList items={section.items} prefix="fr" />
		</>
	),
	stories: ({ section }) => (
		<>
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
		</>
	),
	controls: ({ section }) => (
		<div className="fr-split">
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
	timeline: ({ section }) => (
		<div className="fr-split">
			<Head section={section} />
			<ol className="fr-timeline">
				{section.entries.map((entry, i) => (
					<li
						key={`${entry.date}-${entry.label}`}
						data-last={i === section.entries.length - 1 ? '' : undefined}
						data-reveal=""
					>
						<time>{entry.date}</time>
						<span>{entry.label}</span>
					</li>
				))}
			</ol>
		</div>
	),
	tech: ({ section }) => (
		<>
			<Head section={section} />
			<div className="fr-tech" data-structure={section.structure ? '' : undefined} data-reveal="">
				<div className="fr-tech-groups">
					{section.stack.length > 0 && (
						<div className="fr-tech-group">
							<p className="fr-tech-label">사용한 기술</p>
							<ul className="fr-chips" aria-label="쓴 기술">
								{section.stack.map((item, i) => (
									<li key={item} data-mono={Array.from(item)[0]} data-main={i === 0 ? '' : undefined}>
										{item}
									</li>
								))}
							</ul>
						</div>
					)}
					{section.specs.map((spec) => (
						<div key={spec.label} className="fr-tech-group">
							<p className="fr-tech-label">{spec.label}</p>
							<ul className="fr-chips" aria-label={spec.label}>
								{spec.value
									.split(/,\s*/)
									.filter(Boolean)
									.map((item, i, items) => (
										<li key={item} data-mono={Array.from(item)[0]}>
											{item}
											{/* 칩으로 나눠도 글로는 원문 그대로 읽힌다 (화면에는 숨긴 쉼표) */}
											{i < items.length - 1 && <span className="fr-sep">, </span>}
										</li>
									))}
							</ul>
						</div>
					))}
				</div>
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
		</>
	),
	team: ({ section }) => (
		<>
			<Head section={section} />
			<TeamList members={section.members} prefix="fr" />
		</>
	),
	role: ({ section }) => (
		<div className="fr-split">
			<Head section={section} title={section.role} />
			<div className="fr-role" data-reveal="">
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
	deployments: ({ section }) => (
		<>
			<Head section={section} />
			<DeployList items={section.items} prefix="fr" />
		</>
	),
	credits: ({ section }) => (
		<div className="fr-split">
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

/** 마무리 띠 오른쪽의 짧은 글 둘: 어떤 프로젝트·맡은 일·기간 가운데 앞의 둘 (없으면 띠는 한 단) */
function closingNotesOf(landing: Landing) {
	const { meta } = landing.hero;
	const notes = [
		meta.context && { icon: 'fa-users', title: '어떤 프로젝트', body: meta.context },
		meta.role && { icon: 'fa-user-pen', title: '맡은 일', body: meta.role },
		meta.period && { icon: 'fa-calendar', title: '기간', body: meta.period },
	].filter((note): note is { icon: string; title: string; body: string } => Boolean(note));
	return notes.slice(0, 2);
}

const FriendlyPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = friendlyAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const address = addressOf(landing);
	const meta = [
		hero.meta.role && { label: '맡은 일', value: hero.meta.role },
		hero.meta.period && { label: '기간', value: hero.meta.period },
	].filter((item): item is { label: string; value: string } => Boolean(item));
	const notes = closingNotesOf(landing);
	// 첫 화면 아래 로고 줄처럼 늘어놓는 기술 이름 (기술 사양의 쓴 기술과 같은 목록, 여덟 개까지)
	const stack = (landing.sections.find((s): s is SectionOf<'tech'> => s.kind === 'tech')?.stack ?? []).slice(0, 8);

	return (
		<div ref={root} className="tpl tpl-friendly" style={accent}>
			<header className="fr-hero">
				{/* 비스듬히 잘린 옅은 띠와 그 끝을 따라 놓인 단색 줄무늬 (장식) */}
				<span className="fr-sky" aria-hidden="true">
					<span className="fr-sky-band">
						<i data-stripe="1" />
						<i data-stripe="2" />
						<i data-stripe="3" />
						<i data-stripe="4" />
					</span>
				</span>
				<div className="fr-hero-inner">
					<div className="fr-hero-text">
						<p className="fr-pill">
							{hero.icon && <img className="fr-brand-icon" src={hero.icon} alt="" />}
							{hero.logo ? (
								<img className="fr-logo" src={hero.logo} alt={hero.name} />
							) : (
								<span className="fr-pill-name">{hero.name}</span>
							)}
							{hero.meta.context && <span className="fr-pill-context">{hero.meta.context}</span>}
						</p>
						<h1>{hero.headline}</h1>
						{hero.subhead && <p className="fr-subhead">{hero.subhead}</p>}
						<LandingLinks links={hero.links} className="fr-links" />
						{meta.length > 0 && (
							<dl className="fr-meta">
								{meta.map((item) => (
									<div key={item.label}>
										<dt>{item.label}</dt>
										<dd>{item.value}</dd>
									</div>
								))}
							</dl>
						)}
					</div>
					<div className="fr-hero-art" data-reveal="zoom">
						{hero.image ? (
							<Window media={hero.image} eager address={address} />
						) : (
							<Frame address={address} className="fr-window-mock">
								<HeroMock landing={landing} />
							</Frame>
						)}
						<HeroCards landing={landing} />
					</div>
				</div>
			</header>
			{stack.length > 0 && (
				<div className="fr-stackline" data-reveal="">
					<p>이 기술들로 만들었습니다.</p>
					<ul aria-label="첫 화면의 기술 목록">
						{stack.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
			)}

			<LandingSections landing={landing} renderers={RENDERERS} className="fr-section" />

			<footer className="fr-closing">
				<div className="fr-closing-inner" data-notes={notes.length ? '' : undefined} data-reveal="">
					<div className="fr-closing-text">
						<div className="fr-closing-title">
							{closing.lead && <p className="fr-eyebrow">{closing.lead}</p>}
							<h2>{closing.title}</h2>
						</div>
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
			</footer>
		</div>
	);
};

export default FriendlyPage;

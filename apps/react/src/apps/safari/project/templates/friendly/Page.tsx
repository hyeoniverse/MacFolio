// friendly 템플릿: Stripe처럼 밝고 또렷하게. 흰 바탕에 아주 옅은 세로 격자선, 왼쪽 정렬 첫 화면과 오른쪽 브라우저 창,
// 그 뒤의 강조색 옅은 사선 띠 하나. 아이콘 칸이 달린 기능 격자, 선으로 이은 단계, 큰 숫자, 짙은 남색 마무리 띠.
// 그림이 없으면 창 안에 프로젝트 내용으로 만든 앱 화면 모형(Mock.tsx)을 그려 새 프로젝트의 기본 모양으로도 꽉 차 보인다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	sectionTitle,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { HeroMock } from './Mock';
import './Page.css';

const Head: React.FC<{ section: LandingSection; title?: string; lead?: string }> = ({ section, title, lead }) => (
	<header className="fr-head" data-reveal="">
		<p className="fr-eyebrow">{section.label}</p>
		<h2>{title ?? sectionTitle(section)}</h2>
		{lead && <p className="fr-lead">{lead}</p>}
	</header>
);

/** 창 틀 위 막대에 보일 주소: 데모나 저장소의 호스트, 없으면 이름 */
function addressOf(landing: Landing) {
	for (const link of landing.hero.links) {
		if (link.kind === 'app') continue;
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

/** 6칸 격자에서 한 항목이 차지할 칸 수: 셋씩 놓고, 마지막 줄이 비지 않게 남은 항목을 넓힌다 (넷이면 둘씩) */
function spanOf(index: number, count: number) {
	if (count === 1) return 6;
	if (count === 2 || count === 4) return 3;
	const rest = count % 3;
	const lastRow = index >= count - rest;
	if (rest === 1 && lastRow) return 6;
	if (rest === 2 && lastRow) return 3;
	return 2;
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

/** 주요 기능·만든 방식: 그림이 있는 항목은 큰 줄로 먼저, 나머지는 세 칸 격자로 */
const Features: React.FC<{ items: LandingPoint[]; iconOffset?: number }> = ({ items, iconOffset = 0 }) => {
	const indexed = items.map((point, i) => ({ point, index: i + iconOffset }));
	const rows = indexed.filter(({ point }) => point.media.length > 0);
	const cells = indexed.filter(({ point }) => point.media.length === 0);
	return (
		<>
			{rows.length > 0 && (
				<ul className="fr-rows">
					{rows.map(({ point, index }, i) => (
						<FeatureRow key={point.title} point={point} index={index} flip={i % 2 === 1} />
					))}
				</ul>
			)}
			{cells.length > 0 && (
				<ul className="fr-cells">
					{cells.map(({ point, index }, i) => (
						<FeatureCell key={point.title} point={point} index={index} span={spanOf(i, cells.length)} />
					))}
				</ul>
			)}
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
	features: ({ section }) => (
		<>
			<Head section={section} />
			<Features items={section.items} />
		</>
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
							<IconTile point={point} index={index} />
						</span>
						<h3>{point.title}</h3>
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
	built: ({ section }) => (
		<>
			<Head section={section} />
			<Features items={section.items} iconOffset={3} />
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
		<>
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
		</>
	),
	timeline: ({ section }) => (
		<>
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
		</>
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
	role: ({ section }) => (
		<>
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
		</>
	),
	credits: ({ section }) => (
		<>
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
		</>
	),
};

const FriendlyPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = useLandingAccent(project.icon);
	const { hero, closing } = landing;
	const tech = landing.sections.find((section) => section.kind === 'tech')?.stack ?? [];
	const address = addressOf(landing);
	const meta = [
		hero.meta.role && { label: '맡은 일', value: hero.meta.role },
		hero.meta.period && { label: '기간', value: hero.meta.period },
	].filter((item): item is { label: string; value: string } => Boolean(item));

	return (
		<div ref={root} className="tpl tpl-friendly" style={accent}>
			<header className="fr-hero">
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
					{tech.length > 0 && (
						<ul className="fr-hero-chips" aria-label="기술">
							{tech.slice(0, 6).map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					)}
				</div>
				<div className="fr-hero-art" data-reveal="zoom">
					<span className="fr-band" aria-hidden="true" />
					{hero.image ? (
						<Window media={hero.image} eager address={address} />
					) : (
						<Frame address={address} className="fr-window-mock">
							<HeroMock landing={landing} />
						</Frame>
					)}
				</div>
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="fr-section" />

			<footer className="fr-closing">
				<div className="fr-closing-inner" data-reveal="">
					<div className="fr-closing-text">
						<p className="fr-eyebrow">{hero.name}</p>
						<h2>{closing.title}</h2>
						{closing.lead && <p className="fr-closing-lead">{closing.lead}</p>}
					</div>
					<LandingLinks links={closing.links} className="fr-links fr-closing-links" />
				</div>
			</footer>
		</div>
	);
};

export default FriendlyPage;

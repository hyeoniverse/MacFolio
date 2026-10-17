// playful 템플릿: Figma·Arc 출시 페이지처럼 밝고 즐겁게. 따뜻한 크림 바탕에 고정 팔레트(산호·해바라기·보라·민트·분홍·하늘)의
// 납작한 색 면, 큼직한 둥근 도형, 살짝 기운 스티커 라벨, 2px 잉크 테두리. 첫 화면은 가운데의 큰 둥근 색 포스터(한 낱말 밑에 손글씨 물결, 버튼)와
// 그 둘레의 기술 스티커, 한쪽 모서리에서 비스듬히 내민 폴라로이드 사진이다. 구역 머리는 색 알약 이름표와 큰 문장, 기능은 엇갈려 쌓인 색 카드,
// 숫자는 둥근 배지, 단계는 굽이치는 길의 번호 동그라미, 기술은 사탕색 칩, 맡은 일은 붙임쪽지, 마무리는 큰 산호색 면.
// 그림이 없으면 도형과 큰 아이콘으로 채운다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	iconOf,
	LandingLinks,
	LandingSections,
	Media,
	sectionTitle,
	TeamList,
	TroubleList,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingHero,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { playfulAccent } from './accent';
import './Page.css';

/** 팔레트 차례: 카드·배지·칩이 돌아가며 쓴다 (산호는 마무리와 물결에 아껴 둔다) */
const TONES = ['sun', 'sky', 'pink', 'mint', 'lilac'] as const;
type Tone = (typeof TONES)[number] | 'coral';
const toneOf = (index: number, offset = 0): Tone => TONES[(index + offset) % TONES.length];

/** 스티커의 기울기: 3도 안쪽에서 번갈아 */
const TILTS = [-3, 2, -1.5, 2.5, -2];
const tilt = (index: number) => ({ '--tilt': `${TILTS[index % TILTS.length]}deg` }) as React.CSSProperties;

/** 나타나는 차례 (0부터): 목록 안에서 조금씩 늦게 */
const delay = (index: number) => ({ '--d': Math.min(index, 4) }) as React.CSSProperties;

const Sticker: React.FC<{ tone: Tone; index?: number; className?: string; children: React.ReactNode }> = ({
	tone,
	index = 0,
	className,
	children,
}) => (
	<span className={['pf-sticker', className].filter(Boolean).join(' ')} data-tone={tone} style={tilt(index)}>
		{children}
	</span>
);

/** 구역마다 밝은 말투의 큰 문장 (공용 sectionTitle 대신) */
function playfulTitle(section: LandingSection): string {
	switch (section.kind) {
		case 'features':
			return '즐겁게 쓸 수 있는 기능을 가득 담았습니다.';
		case 'screens':
			return '화면을 하나씩 구경해 보세요.';
		case 'steps':
			return section.items.length > 1
				? `${section.items.length}걸음이면 바로 시작할 수 있습니다.`
				: '한 걸음이면 바로 시작할 수 있습니다.';
		case 'built':
			return '보이지 않는 안쪽도 꼼꼼하게 만들었습니다.';
		case 'troubleshooting':
			return '막힌 곳을 하나씩 풀어 왔습니다.';
		case 'stories':
			return '들려 드리고 싶은 이야기가 더 있습니다.';
		case 'controls':
			return '이 키만 알면 충분합니다.';
		case 'tech':
			return '이런 재료로 만들었습니다.';
		case 'team':
			return '함께 만든 친구들을 소개합니다.';
		case 'timeline':
			return '지나온 길을 함께 돌아봅니다.';
		case 'deployments':
			return '지금 바로 만나 볼 수 있습니다.';
		case 'credits':
			return '고마운 분들의 도움을 받았습니다.';
		default:
			return sectionTitle(section);
	}
}

/** 구역 머리: 색 알약 이름표(점과 구역 이름)와 왼쪽 정렬의 큰 문장 */
const Head: React.FC<{ section: LandingSection; index: number; title?: string; lead?: string }> = ({
	section,
	index,
	title,
	lead,
}) => (
	<header className="pf-head" data-reveal="">
		<p className="pf-pill" data-tone={toneOf(index, 2)}>
			{section.label}
		</p>
		<h2>{title ?? playfulTitle(section)}</h2>
		{lead && <p className="pf-lead">{lead}</p>}
	</header>
);

/** 손글씨 물결 (장식): 낱말 밑에 늘어나 붙는다 */
const Squiggle: React.FC = () => (
	<svg className="pf-squiggle" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
		<path
			d="M3 8 Q 10.5 2 18 7 T 33 7 T 48 7 T 63 7 T 78 7 T 93 7 T 108 7 T 117 6"
			fill="none"
			vectorEffect="non-scaling-stroke"
		/>
	</svg>
);

/**
 * 큰 제목의 낱말 하나에 물결을 긋는다. 우리말 문장이 '~니다.'로 끝나면 그 앞 낱말(문장의 알맹이)에, 아니면 마지막 낱말에.
 * 글은 그대로 두고 그 낱말만 감싼다 (화면 읽기와 시험이 읽는 글은 같다)
 */
const Headline: React.FC<{ text: string }> = ({ text }) => {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length < 2) return <>{text}</>;
	const last = words.length - 1;
	const pick = words.length >= 3 && /다[.!?]?$/.test(words[last]) ? last - 1 : last;
	const word = words[pick];
	// 물결은 낱말의 글자에만 (끝의 문장 부호는 밖으로)
	const match = /^(.*?)([.,!?…]*)$/.exec(word);
	const core = match?.[1] || word;
	const tail = match?.[1] ? match[2] : '';
	return (
		<>
			{words.slice(0, pick).join(' ')}{' '}
			<span className="pf-mark">
				{core}
				<Squiggle />
			</span>
			{tail}
			{pick < last ? ` ${words.slice(pick + 1).join(' ')}` : ''}
		</>
	);
};

/** "1,800명", "92%", "4주"를 앞말·숫자·뒷말로 (숫자는 크게, 단위는 작게) */
const splitValue = (text: string) => {
	const match = /^(\D*?)([\d.,]+)(\D*)$/.exec(text.trim());
	return match ? { before: match[1], value: match[2], after: match[3] } : null;
};

const Figure: React.FC<{ value: string; className?: string }> = ({ value, className = 'pf-figure' }) => {
	const parts = splitValue(value);
	if (!parts) return <strong className={className}>{value}</strong>;
	return (
		<strong className={className}>
			{parts.before && <span className="pf-unit">{parts.before}</span>}
			{parts.value}
			{parts.after && <span className="pf-unit">{parts.after}</span>}
		</strong>
	);
};

/** 아이콘 동그라미 (장식) */
const Glyph: React.FC<{ point: LandingPoint; index: number; tone?: Tone; className?: string }> = ({
	point,
	index,
	tone,
	className,
}) => (
	<span className={['pf-glyph', className].filter(Boolean).join(' ')} data-tone={tone} aria-hidden="true">
		<i className={`fa-solid ${iconOf(point, index)}`} />
	</span>
);

/** 항목의 글: 묶음, 제목, 설명, 이어 읽는 설명 */
const PointText: React.FC<{ point: LandingPoint; level?: 'h3' | 'h4' }> = ({ point, level = 'h3' }) => {
	const Title = level;
	return (
		<>
			{point.group && <p className="pf-group">{point.group}</p>}
			<Title className="pf-point-title">{point.title}</Title>
			<p className="pf-body">{point.body}</p>
			{point.detail && <p className="pf-detail">{point.detail}</p>}
		</>
	);
};

/** 둥근 액자에 담긴 그림 */
const Frame: React.FC<{ media: LandingMedia; className?: string; eager?: boolean }> = ({ media, className, eager }) => (
	<figure className={['pf-frame', className].filter(Boolean).join(' ')}>
		<Media media={media} eager={eager} />
	</figure>
);

/** 항목의 둘째 그림부터: 작은 액자 줄 */
const Thumbs: React.FC<{ point: LandingPoint; media: LandingMedia[] }> = ({ point, media }) =>
	media.length > 0 ? (
		<ul className="pf-thumbs" aria-label={`${point.title} 화면 더 보기`}>
			{media.map((item) => (
				<li key={item.src}>
					<Frame media={item} />
				</li>
			))}
		</ul>
	) : null;

/** 기능 카드 하나: 팔레트 색 면에 아이콘, 글, 첫 그림은 크게, 나머지는 작은 액자 줄 */
const FeatureCard: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => {
	const [first, ...more] = point.media;
	return (
		<li
			className="pf-card"
			data-tone={toneOf(index)}
			data-media={first ? '' : undefined}
			data-reveal=""
			style={delay(index)}
		>
			<div className="pf-card-top">
				<Glyph point={point} index={index} />
				<span className="pf-card-num" aria-hidden="true">
					{String(index + 1).padStart(2, '0')}
				</span>
			</div>
			<PointText point={point} />
			{first && <Frame media={first} className="pf-card-frame" />}
			<Thumbs point={point} media={more} />
		</li>
	);
};

/** 카드의 대강의 높이 (그림이 있으면 크게): 두 줄에 고르게 나누는 데 쓴다 */
const weightOf = (point: LandingPoint) =>
	2 + (point.media.length ? 4 : 0) + (point.media.length > 1 ? 1.5 : 0) + (point.detail ? 1 : 0);

/**
 * 주요 기능: 엇갈려 쌓인 두 줄의 색 카드. 차례를 지키며 지금 더 짧은 줄에 다음 카드를 놓고, 오른쪽 줄은 조금 내려 시작한다.
 * 줄 안의 차례는 원래 차례 그대로다
 */
const Features: React.FC<{ items: LandingPoint[] }> = ({ items }) => {
	if (items.length === 1)
		return (
			<ul className="pf-masonry" data-single="">
				<FeatureCard point={items[0]} index={0} />
			</ul>
		);
	const columns: { point: LandingPoint; index: number }[][] = [[], []];
	const heights = [0, 0.8];
	items.forEach((point, index) => {
		const target = heights[0] <= heights[1] ? 0 : 1;
		columns[target].push({ point, index });
		heights[target] += weightOf(point);
	});
	return (
		<div className="pf-masonry">
			{columns.map((column, c) => (
				<ul key={c} className="pf-masonry-col">
					{column.map(({ point, index }) => (
						<FeatureCard key={point.title} point={point} index={index} />
					))}
				</ul>
			))}
		</div>
	);
};

/** 단계·만든 방식의 그림들 */
const PointMedia: React.FC<{ point: LandingPoint }> = ({ point }) =>
	point.media.length > 0 ? (
		<div className="pf-point-media" data-count={Math.min(point.media.length, 2)}>
			{point.media.map((media) => (
				<Frame key={media.src} media={media} />
			))}
		</div>
	) : null;

/**
 * 만든 방식 카드의 너비 (여섯 칸 격자): 그림이 있으면 한 줄 가득, 그림이 없는 것은 셋이나 둘씩.
 * 둘씩 놓다 하나가 남으면 마지막 하나를 가득 채워 줄이 비지 않게 한다
 */
const spanOf = (items: LandingPoint[], order: number): 'full' | 'half' | 'third' => {
	if (items[order].media.length) return 'full';
	const plain = items.filter((item) => !item.media.length);
	const nth = plain.indexOf(items[order]);
	if (plain.length === 1) return 'full';
	if (plain.length % 3 === 0) return 'third';
	return plain.length % 2 === 1 && nth === plain.length - 1 ? 'full' : 'half';
};

/** 굽이치는 길: 번호 동그라미를 위아래로 번갈아 놓고 점선 곡선으로 잇는다 (네 단계까지, 장식) */
const Path: React.FC<{ count: number }> = ({ count }) => {
	if (count < 2 || count > 4) return null;
	// 동그라미 가운데: 가로는 칸의 가운데, 세로는 높은 칸 40·낮은 칸 88 (viewBox 높이 128)
	const points = Array.from({ length: count }, (_, i) => ({ x: ((i + 0.5) / count) * 100, y: i % 2 ? 88 : 40 }));
	const d = points
		.map((p, i) => {
			if (i === 0) return `M ${p.x} ${p.y}`;
			const prev = points[i - 1];
			const mid = (prev.x + p.x) / 2;
			return `C ${mid} ${prev.y} ${mid} ${p.y} ${p.x} ${p.y}`;
		})
		.join(' ');
	return (
		<svg className="pf-path" viewBox="0 0 100 128" preserveAspectRatio="none" aria-hidden="true" focusable="false">
			<path d={d} fill="none" vectorEffect="non-scaling-stroke" />
		</svg>
	);
};

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<ul className="pf-badges" data-count={Math.min(section.facts.length, 4)}>
				{section.facts.map((fact, index) => (
					<li key={fact.label} data-reveal="" style={delay(index)}>
						<span className="pf-badge" data-tone={toneOf(index)} style={tilt(index)}>
							<Figure value={fact.value} />
							<span className="pf-badge-label">{fact.label}</span>
						</span>
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<Features items={section.items} />
		</>
	),
	screens: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ul className="pf-screens" data-count={Math.min(section.shots.length, 4)}>
				{section.shots.map((shot, order) => (
					<li key={shot.src} data-reveal="" style={{ ...delay(order), ...tilt(order + 1) }}>
						<Frame media={shot} />
						<Sticker tone={toneOf(order, 1)} index={order} className="pf-caption">
							{shot.caption}
						</Sticker>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<div className="pf-steps-wrap" data-count={section.items.length}>
				<Path count={section.items.length} />
				<ol className="pf-steps" data-count={Math.min(section.items.length, 4)}>
					{section.items.map((point, order) => (
						<li key={point.title} data-reveal="" style={delay(order)}>
							<span className="pf-step-num" data-tone={toneOf(order, 3)} aria-hidden="true">
								{order + 1}
								<span className="pf-step-icon">
									<i className={`fa-solid ${iconOf(point, order)}`} />
								</span>
							</span>
							<p className="visually-hidden">{order + 1}단계</p>
							<PointText point={point} />
							<PointMedia point={point} />
						</li>
					))}
				</ol>
			</div>
		</>
	),
	built: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ul className="pf-built">
				{section.items.map((point, order) => (
					<li key={point.title} data-reveal="" style={delay(order % 3)} data-span={spanOf(section.items, order)}>
						<Glyph point={point} index={order} tone={toneOf(order, 1)} />
						<div className="pf-built-text">
							<PointText point={point} />
						</div>
						<PointMedia point={point} />
					</li>
				))}
			</ul>
		</>
	),
	troubleshooting: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<TroubleList items={section.items} prefix="pf" />
		</>
	),
	stories: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<div className="pf-stories">
				{section.stories.map((story, number) => (
					<article
						key={story.title}
						className="pf-story"
						aria-label={story.title}
						data-tone={toneOf(number, 4)}
						data-image={story.image ? '' : undefined}
						data-flip={number % 2 ? '' : undefined}
						data-reveal=""
					>
						<div className="pf-story-text">
							<div className="pf-story-intro">
								<Sticker tone="coral" index={number + 1} className="pf-story-num">
									이야기 {String(number + 1).padStart(2, '0')}
								</Sticker>
								<h3>{story.title}</h3>
								{story.lead && <p className="pf-story-lead">{story.lead}</p>}
							</div>
							{(story.facts.length > 0 || story.points.length > 0) && (
								<div className="pf-story-body">
									{story.facts.length > 0 && (
										<ul className="pf-mini-stats">
											{story.facts.map((fact) => (
												<li key={fact.label}>
													<Figure value={fact.value} className="pf-mini-figure" />
													<span>{fact.label}</span>
												</li>
											))}
										</ul>
									)}
									{story.points.length > 0 && (
										<ul className="pf-story-points">
											{story.points.map((point, order) => (
												<li key={point.title}>
													<Glyph point={point} index={order + 3} />
													<div>
														<PointText point={point} level="h4" />
														<PointMedia point={point} />
													</div>
												</li>
											))}
										</ul>
									)}
								</div>
							)}
						</div>
						{story.image && <Frame media={story.image} className="pf-story-image" />}
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<dl className="pf-controls" data-count={Math.min(section.controls.length, 4)}>
				{section.controls.map((control, order) => (
					<div key={control.label} data-reveal="" style={delay(order)}>
						<dt>
							{control.keys.map((key, k) => (
								<kbd key={key} data-tone={toneOf(order + k, 1)}>
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
	timeline: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ol className="pf-timeline">
				{section.entries.map((entry, order) => (
					<li key={`${entry.date}-${entry.label}`} data-reveal="" style={delay(order % 3)}>
						<span className="pf-node" data-tone={toneOf(order)} aria-hidden="true">
							{order + 1}
						</span>
						<div className="pf-entry">
							<time>{entry.date}</time>
							<span className="pf-entry-label">{entry.label}</span>
						</div>
					</li>
				))}
			</ol>
		</>
	),
	tech: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			{section.stack.length > 0 && (
				<ul className="pf-chips" aria-label="쓴 기술" data-reveal="">
					{section.stack.map((item, order) => (
						<li key={item} data-tone={order === 0 ? 'coral' : toneOf(order - 1)}>
							{item}
						</li>
					))}
				</ul>
			)}
			{(section.specs.length > 0 || section.structure) && (
				<div className="pf-tech" data-split={section.specs.length > 0 && section.structure ? '' : undefined}>
					{section.specs.length > 0 && (
						<dl className="pf-specs" data-reveal="">
							{section.specs.map((spec) => (
								<div key={spec.label}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
					)}
					{section.structure && (
						<figure className="pf-tree" data-reveal="">
							<figcaption>
								<span className="pf-dots" aria-hidden="true">
									<i />
									<i />
									<i />
								</span>
								폴더 구조
							</figcaption>
							<pre>{section.structure}</pre>
						</figure>
					)}
				</div>
			)}
		</>
	),
	team: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<TeamList members={section.members} prefix="pf" />
		</>
	),
	role: ({ section, index }) => (
		<div className="pf-role">
			<Head section={section} index={index} />
			<div className="pf-note" data-reveal="">
				<span className="pf-tape" aria-hidden="true" />
				{section.role && <p className="pf-note-role">{section.role}</p>}
				{(section.context || section.period) && (
					<dl className="pf-note-meta">
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
					<ul className="pf-checks">
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
	deployments: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<DeployList items={section.items} prefix="pf" />
		</>
	),
	credits: ({ section, index }) => (
		<>
			<Head section={section} index={index} />
			<ul className="pf-credits">
				{section.credits.map((credit, order) => (
					<li key={`${credit.role}-${credit.name}`} data-reveal="" style={delay(order)}>
						<Sticker tone={toneOf(order, 3)} index={order}>
							{credit.role}
						</Sticker>
						<p className="pf-credit-name">
							{credit.href ? (
								<a href={credit.href} target="_blank" rel="noopener noreferrer">
									{credit.name}
									<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
								</a>
							) : (
								credit.name
							)}
						</p>
						<p className="pf-credit-by">{credit.by}</p>
						{credit.note && <p className="pf-credit-note">{credit.note}</p>}
					</li>
				))}
			</ul>
		</>
	),
};

/** 첫 화면 스티커: 기술 이름 셋, 없으면 기능 제목 둘 */
const stickersOf = (landing: Landing): string[] => {
	for (const section of landing.sections) {
		if (section.kind === 'tech' && section.stack.length) return section.stack.slice(0, 3);
	}
	for (const section of landing.sections) {
		if (section.kind === 'features') return section.items.slice(0, 2).map((item) => item.title);
	}
	return [];
};

/** 첫 화면 모서리의 폴라로이드: 대표 화면(없으면 앱 아이콘, 첫 기능 아이콘, 이름 첫 글자)을 흰 테두리 사진처럼 비스듬히 */
const Polaroid: React.FC<{ hero: LandingHero; first?: LandingPoint }> = ({ hero, first }) =>
	hero.image ? (
		<figure className="pf-polaroid">
			<Media media={hero.image} eager className="pf-polaroid-photo" />
			<figcaption>{hero.image.alt}</figcaption>
		</figure>
	) : (
		<div className="pf-polaroid pf-polaroid-art" aria-hidden="true">
			<div className="pf-hero-art">
				{hero.icon ? (
					<img className="pf-hero-icon" src={hero.icon} alt="" />
				) : first ? (
					<i className={`fa-solid ${iconOf(first, 0)}`} />
				) : (
					<span className="pf-initial">{Array.from(hero.name.trim())[0] ?? ''}</span>
				)}
			</div>
		</div>
	);

const PlayfulPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = playfulAccent(useLandingAccent(project.icon));
	const { hero, closing } = landing;
	const meta = [hero.meta.context, hero.meta.role, hero.meta.period].filter(Boolean) as string[];
	const features = landing.sections.find((section) => section.kind === 'features');
	const firstPoint = features?.kind === 'features' ? features.items[0] : undefined;
	const stickers = stickersOf(landing);

	return (
		<div ref={root} className="tpl tpl-playful" style={accent}>
			<header className="pf-hero" data-image={hero.image ? '' : undefined}>
				<div className="pf-stage">
					<div className="pf-poster" data-reveal="">
						<p className="pf-brand">
							{hero.icon && hero.image && <img className="pf-icon" src={hero.icon} alt="" />}
							{hero.logo ? <img className="pf-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
						</p>
						<h1>
							<Headline text={hero.headline} />
						</h1>
						{hero.subhead && <p className="pf-subhead">{hero.subhead}</p>}
						<LandingLinks links={hero.links} className="pf-links" />
						{meta.length > 0 && (
							<ul className="pf-meta" aria-label="프로젝트 정보">
								{meta.map((item, index) => (
									<li key={item} data-tone={(['coral', 'lilac', 'mint'] as const)[index]}>
										{item}
									</li>
								))}
							</ul>
						)}
					</div>
					{stickers.length > 0 && (
						<ul className="pf-hero-stickers" aria-hidden="true">
							{stickers.map((item, index) => (
								<li key={item} data-slot={index}>
									<Sticker tone={(['pink', 'sky', 'mint'] as const)[index % 3]} index={index}>
										{item}
									</Sticker>
								</li>
							))}
						</ul>
					)}
					<Polaroid hero={hero} first={firstPoint} />
				</div>
			</header>

			<LandingSections landing={landing} renderers={RENDERERS} className="pf-section" />

			<footer className="pf-closing" data-reveal="">
				<span className="pf-closing-shape pf-closing-sun" aria-hidden="true" />
				<span className="pf-closing-shape pf-closing-lilac" aria-hidden="true" />
				<span className="pf-closing-shape pf-closing-mint" aria-hidden="true" />
				<div className="pf-closing-text">
					{closing.lead && (
						<Sticker tone="sun" index={1}>
							{closing.lead}
						</Sticker>
					)}
					<h2>{closing.title}</h2>
					<LandingLinks links={closing.links} className="pf-links" />
				</div>
			</footer>
		</div>
	);
};

export default PlayfulPage;

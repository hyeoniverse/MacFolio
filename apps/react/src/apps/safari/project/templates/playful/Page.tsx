// playful 템플릿: Figma·Arc 출시 페이지처럼 밝고 즐겁게. 따뜻한 크림 바탕에 고정 팔레트(산호·해바라기·보라·민트·분홍·하늘)의
// 납작한 색 면, 큼직한 둥근 도형, 살짝 기운 스티커 라벨, 몇몇 카드의 2px 잉크 테두리. 첫 화면은 왼쪽 큰 제목(한 낱말 밑에 손글씨 물결),
// 오른쪽은 색 도형 위에 얹은 화면과 기술 스티커. 기능은 색 카드, 숫자는 둥근 배지, 단계는 굽이치는 길의 번호 동그라미,
// 기술은 사탕색 칩, 맡은 일은 붙임쪽지, 마무리는 큰 산호색 면. 그림이 없으면 도형과 큰 아이콘으로 채운다. 계약은 templates/README.md
import React from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	LandingLinks,
	LandingSections,
	Media,
	iconOf,
	sectionTitle,
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

/** 구역 머리: 기운 스티커(구역 이름)와 큰 문장 */
const Head: React.FC<{ section: LandingSection; index: number; title?: string; lead?: string }> = ({
	section,
	index,
	title,
	lead,
}) => (
	<header className="pf-head" data-reveal="">
		<Sticker tone={toneOf(index, 2)} index={index}>
			{section.label}
		</Sticker>
		<h2>{title ?? sectionTitle(section)}</h2>
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

/** 그림이 없는 넓은 카드의 오른쪽: 큰 도형 위에 큰 아이콘 */
const ShapeArt: React.FC<{ point: LandingPoint; index: number; tone: Tone }> = ({ point, index, tone }) => (
	<div className="pf-shape-art" aria-hidden="true">
		<span className="pf-blob" data-tone={tone === 'sun' ? 'coral' : 'sun'} />
		<span className="pf-blob pf-blob-2" data-tone={tone === 'lilac' ? 'mint' : 'lilac'} />
		<span className="pf-shape-icon">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
	</div>
);

/** 넓은 기능 카드: 글과 그림(없으면 도형)이 좌우로, 그림 쪽은 번갈아 */
const WideCard: React.FC<{ point: LandingPoint; index: number; flip: boolean }> = ({ point, index, flip }) => {
	const [first, ...more] = point.media;
	const tone = toneOf(index);
	return (
		<li className="pf-card pf-card-wide" data-tone={tone} data-flip={flip ? '' : undefined} data-reveal="">
			<div className="pf-card-text">
				<Glyph point={point} index={index} />
				<PointText point={point} />
				<Thumbs point={point} media={more} />
			</div>
			<div className="pf-card-visual">
				{first ? <Frame media={first} /> : <ShapeArt point={point} index={index} tone={tone} />}
			</div>
		</li>
	);
};

const SmallCard: React.FC<{ point: LandingPoint; index: number; order: number }> = ({ point, index, order }) => (
	<li className="pf-card pf-card-small" data-tone={toneOf(index)} data-reveal="" style={delay(order)}>
		<Glyph point={point} index={index} />
		<PointText point={point} />
	</li>
);

type Run =
	| { kind: 'wide'; point: LandingPoint; index: number }
	| { kind: 'grid'; items: { point: LandingPoint; index: number }[] };

/**
 * 기능을 줄로 나눈다: 그림이 있는 것은 넓은 카드 하나씩, 그림이 없는 것이 이어지면 작은 카드 격자로.
 * 하나만 남거나 홀수로 남아 줄이 비면 첫 하나를 넓은 카드(도형 그림)로 꺼낸다
 */
function runsOf(items: LandingPoint[]): Run[] {
	const runs: Run[] = [];
	let plain: { point: LandingPoint; index: number }[] = [];
	const flush = () => {
		if (plain.length === 0) return;
		const n = plain.length;
		if (n === 1 || (n % 2 === 1 && n % 3 !== 0)) {
			const [head, ...rest] = plain;
			runs.push({ kind: 'wide', ...head });
			if (rest.length) runs.push({ kind: 'grid', items: rest });
		} else runs.push({ kind: 'grid', items: plain });
		plain = [];
	};
	items.forEach((point, index) => {
		if (point.media.length) {
			flush();
			runs.push({ kind: 'wide', point, index });
		} else plain.push({ point, index });
	});
	flush();
	return runs;
}

const Features: React.FC<{ items: LandingPoint[] }> = ({ items }) => {
	let wide = 0;
	return (
		<div className="pf-features">
			{runsOf(items).map((run) =>
				run.kind === 'wide' ? (
					<ul key={run.point.title} className="pf-cards">
						<WideCard point={run.point} index={run.index} flip={wide++ % 2 === 1} />
					</ul>
				) : (
					<ul
						key={run.items[0].point.title}
						className="pf-cards pf-cards-grid"
						data-cols={run.items.length % 3 === 0 ? 3 : 2}
					>
						{run.items.map(({ point, index }, order) => (
							<SmallCard key={point.title} point={point} index={index} order={order} />
						))}
					</ul>
				)
			)}
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

/** 첫 화면 오른쪽: 색 도형 위에 화면(없으면 앱 아이콘이나 큰 글자), 둘레에 스티커 */
const Collage: React.FC<{ hero: LandingHero; stickers: string[]; first?: LandingPoint }> = ({
	hero,
	stickers,
	first,
}) => (
	<div className="pf-collage" data-art={hero.image ? undefined : ''} data-reveal="">
		<span className="pf-shape pf-shape-sun" aria-hidden="true" />
		<span className="pf-shape pf-shape-lilac" aria-hidden="true" />
		<span className="pf-shape pf-shape-mint" aria-hidden="true" />
		{hero.image ? (
			<figure className="pf-window">
				<div className="pf-window-bar" aria-hidden="true">
					<span className="pf-dots">
						<i />
						<i />
						<i />
					</span>
				</div>
				<Media media={hero.image} eager className="pf-window-screen" />
			</figure>
		) : (
			<div className="pf-hero-art" aria-hidden="true">
				{hero.icon ? (
					<img className="pf-hero-icon" src={hero.icon} alt="" />
				) : first ? (
					<i className={`fa-solid ${iconOf(first, 0)}`} />
				) : (
					<span className="pf-initial">{Array.from(hero.name.trim())[0] ?? ''}</span>
				)}
			</div>
		)}
		{stickers.length > 0 && (
			<ul className="pf-hero-stickers" aria-hidden="true">
				{stickers.map((item, index) => (
					<li key={item} data-slot={index}>
						<Sticker tone={(['pink', 'sky', 'sun'] as const)[index % 3]} index={index}>
							{item}
						</Sticker>
					</li>
				))}
			</ul>
		)}
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

	return (
		<div ref={root} className="tpl tpl-playful" style={accent}>
			<header className="pf-hero">
				<div className="pf-hero-text" data-reveal="">
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
				<Collage hero={hero} stickers={stickersOf(landing)} first={firstPoint} />
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

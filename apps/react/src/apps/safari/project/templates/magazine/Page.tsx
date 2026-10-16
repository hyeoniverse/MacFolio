// magazine 템플릿: 책상 위에 놓인 인쇄 잡지 한 권. 따뜻한 종이와 검은 잉크, 붉은 잉크 하나, 명조 제목과 고딕 본문.
// 표지(제호는 프로젝트 이름, 호수 줄, 표지 문구, 큰 사진이나 활자 표지) → 차례 펼침면(번호 붙은 차례, 편집자의 글과 숫자 곁상자) →
// 구역마다의 펼침면(왼쪽·오른쪽 쪽, 가운데 접힘, 아래 쪽 번호) → 뒤표지(마무리와 링크) 차례로 넘긴다.
// 구역은 생김새마다 다르게 펼친다: 기능은 글 쪽과 사진 쪽, 화면 모음은 화보, 트러블슈팅은 문답, 이야기는 큰 인용구,
// 구현 방법은 두 단 본문과 머리글자. 나머지 한 쪽짜리 구역은 둘씩 짝지어 한 펼침면에 놓고, 짝이 없으면 두 단으로 펼친다.
// 좁은 창에서는 쪽을 한 장씩 위아래로 쌓는다. 계약은 templates/README.md
import React, { useCallback } from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import {
	FaIcon,
	iconOf,
	LandingLinks,
	Media,
	MemberAvatar,
	shortLink,
	troubleIcon,
	useLanding,
	useLandingAccent,
	type Landing,
	type LandingHero,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionOf,
} from '@/apps/safari/project/landing';
import { magazineAccent } from './accent';
import { issueOf, mastOf } from './issue';
import './Page.css';

const pad = (n: number) => String(n).padStart(2, '0');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 구역마다의 잡지 제목(헤드라인)과 그 아래 한 줄(덱) */
const EDITORIAL: Record<LandingSectionKind, { headline: string; deck: string }> = {
	stats: { headline: '숫자가 먼저 말해 줍니다.', deck: '이번 호에 담긴 기록을 숫자로 먼저 살펴봅니다.' },
	features: {
		headline: '하나씩 펼쳐 보는 주요 기능입니다.',
		deck: '기능마다 한 쪽씩, 만든 사람의 설명을 곁들여 실었습니다.',
	},
	screens: { headline: '화면이 직접 이야기합니다.', deck: '실제로 쓰이는 화면을 화보로 엮었습니다.' },
	steps: { headline: '처음 쓰는 분을 위한 안내입니다.', deck: '차례대로 따라 하면 바로 시작할 수 있습니다.' },
	built: {
		headline: '보이지 않는 곳의 설계를 들여다봅니다.',
		deck: '화면 뒤에서 일하는 구조와 그렇게 고른 까닭을 적었습니다.',
	},
	troubleshooting: {
		headline: '막혔던 순간을 직접 물었습니다.',
		deck: '문제와 원인, 해결과 결과를 문답으로 정리했습니다.',
	},
	stories: {
		headline: '기록에 다 담지 못한 이야기입니다.',
		deck: '만드는 동안의 배경과 그 뒤의 변화를 따로 실었습니다.',
	},
	controls: { headline: '손에 익는 단축키입니다.', deck: '자주 쓰는 동작을 글쇠 몇 개로 부를 수 있습니다.' },
	tech: { headline: '어떤 재료로 만들었는지 밝힙니다.', deck: '쓴 기술과 사양, 폴더 구조를 한곳에 모았습니다.' },
	team: { headline: '이번 호를 만든 사람들입니다.', deck: '각자 맡은 몫을 이름 옆에 함께 적었습니다.' },
	role: { headline: '제가 맡은 몫을 적었습니다.', deck: '' },
	timeline: { headline: '날짜로 되짚어 본 여정입니다.', deck: '처음부터 마지막까지를 날짜 차례로 적었습니다.' },
	deployments: { headline: '결과물이 놓인 곳을 안내합니다.', deck: '공개된 결과물의 주소를 모았습니다.' },
	credits: { headline: '도움 받은 것들을 밝혀 둡니다.', deck: '이번 호에 쓰인 자료와 도구의 출처입니다.' },
};

/** 표지 문구: 구역에서 뽑은 서너 줄 (머리말과 한 줄) */
function coverLines(landing: Landing): { kicker: string; text: string }[] {
	const lines: { kicker: string; text: string }[] = [];
	for (const section of landing.sections) {
		if (section.kind === 'features') lines.push({ kicker: '커버스토리', text: section.items[0].title });
		if (section.kind === 'troubleshooting') lines.push({ kicker: '문답', text: section.items[0].title });
		if (section.kind === 'stories') lines.push({ kicker: '이야기', text: section.stories[0].title });
		if (section.kind === 'built') lines.push({ kicker: '설계', text: section.items[0].title });
		if (section.kind === 'team') lines.push({ kicker: '만든 사람들', text: `${section.members.length}명의 이야기` });
		if (section.kind === 'screens') lines.push({ kicker: '화보', text: `화면 ${section.shots.length}장` });
	}
	return lines.slice(0, 4);
}

/* ─── 작은 조각 ─── */

/** 구역 머리: 붉은 머리말(구역 이름), 명조 헤드라인, 덱 */
const Head: React.FC<{ section: LandingSection; deck?: string }> = ({ section, deck }) => {
	const words = EDITORIAL[section.kind];
	const text = deck ?? words.deck;
	return (
		<header className="mg-head" data-reveal="ink">
			<p className="mg-rubric">{section.label}</p>
			<h2>{words.headline}</h2>
			{text && <p className="mg-deck">{text}</p>}
		</header>
	);
};

/** 사진 한 장과 번호 붙은 설명 (번호는 CSS 카운터) */
const Figure: React.FC<{ media: LandingMedia; caption?: string; size?: 'bleed' | 'page' | 'small' }> = ({
	media,
	caption,
	size = 'page',
}) => (
	<figure className="mg-figure" data-size={size} data-reveal="">
		<div className="mg-plate">
			<Media media={media} />
		</div>
		{caption && <figcaption>{caption}</figcaption>}
	</figure>
);

const Numbers: React.FC<{ facts: ProjectFact[]; className?: string }> = ({ facts, className }) => (
	<dl className={['mg-numbers', className].filter(Boolean).join(' ')}>
		{facts.map((fact) => (
			<div key={`${fact.value}-${fact.label}`}>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		))}
	</dl>
);

/** 머리 제목이 붙은 짧은 글 (구현 방법, 이야기의 항목) */
const RunIn: React.FC<{ point: LandingPoint; icon?: string; dropcap?: boolean }> = ({ point, icon, dropcap }) => (
	<div className="mg-runin">
		<h3>
			{icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
			{point.title}
		</h3>
		<p data-dropcap={dropcap ? '' : undefined}>{point.body}</p>
		{point.detail && <p className="mg-runin-more">{point.detail}</p>}
		{point.media.map((item) => (
			<Figure key={item.src} media={item} caption={item.alt} size="small" />
		))}
	</div>
);

/** 쪽 번호 줄: 펼침면 아래의 왼쪽·오른쪽 쪽 번호와 머리글 (장식) */
const Folios: React.FC<{ page: number; mast: string; label: string }> = ({ page, mast, label }) => (
	<div className="mg-folios" aria-hidden="true">
		<span>
			<b>{page}</b> {mast}
		</span>
		<span>
			{label} <b>{page + 1}</b>
		</span>
	</div>
);

/* ─── 기능: 글 쪽과 사진 쪽 ─── */

/** 기능의 글: 번호, 아이콘, 제목, 리드(그림이 없으면 인용구가 따로 놓인다), 이어 읽는 글 */
const FeatureText: React.FC<{ point: LandingPoint; index: number; quoteElsewhere: boolean; quote?: boolean }> = ({
	point,
	index,
	quoteElsewhere,
	quote = false,
}) => (
	<div className="mg-feature" data-reveal="ink">
		<p className="mg-feature-no" aria-hidden="true">
			{pad(index + 1)}
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</p>
		{point.group && <p className="mg-feature-group">{point.group}</p>}
		<h3>{point.title}</h3>
		{quote ? (
			<blockquote className="mg-pull mg-pull-small">
				<p>{point.body}</p>
			</blockquote>
		) : (
			!quoteElsewhere && (
				<p className="mg-standfirst" data-dropcap="">
					{point.body}
				</p>
			)
		)}
		{point.detail && (
			<p className="mg-prose" data-dropcap={quoteElsewhere ? '' : undefined}>
				{point.detail}
			</p>
		)}
	</div>
);

/** 기능의 그림 쪽: 첫 그림을 쪽 가득, 나머지는 작게. 그림이 없으면 리드를 큰 인용구로 */
const FeatureVisual: React.FC<{ point: LandingPoint }> = ({ point }) => {
	const [lead, ...rest] = point.media;
	if (!lead)
		return (
			<blockquote className="mg-pull" data-reveal="ink">
				<p>{point.body}</p>
			</blockquote>
		);
	return (
		<>
			<Figure media={lead} caption={lead.alt} size="page" />
			{rest.length > 0 && (
				<div className="mg-figs">
					{rest.map((item) => (
						<Figure key={item.src} media={item} caption={item.alt} size="small" />
					))}
				</div>
			)}
		</>
	);
};

/** 기능 한 쪽: 그림이 있으면 그림 → 글, 없으면 글과 인용구 */
const FeaturePage: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => {
	const [lead, ...rest] = point.media;
	return (
		<div className="mg-page">
			{lead && <Figure media={lead} caption={lead.alt} size="page" />}
			<FeatureText point={point} index={index} quoteElsewhere={!lead} quote={!lead} />
			{rest.length > 0 && (
				<div className="mg-figs">
					{rest.map((item) => (
						<Figure key={item.src} media={item} caption={item.alt} size="small" />
					))}
				</div>
			)}
		</div>
	);
};

/* ─── 펼침면 계획: 구역마다 몇 쪽을 차지하는지 ─── */

/** 쪽 구역(짝지어 한 펼침면에 둘), 여러 펼침면 구역, 두 단으로 흐르는 펼침면 구역 */
type Plan =
	| { type: 'pair'; sections: [LandingSection, LandingSection]; page: number }
	| { type: 'solo'; section: LandingSection; page: number }
	| { type: 'run'; section: LandingSection; page: number; spreads: number }
	| { type: 'last'; section: LandingSection; page: number };

const RUN_KINDS = new Set<LandingSectionKind>(['features', 'screens', 'stories']);
const FLOW_KINDS = new Set<LandingSectionKind>(['built', 'troubleshooting']);

const spreadsOf = (section: LandingSection) => {
	if (section.kind === 'features') return 1 + Math.ceil((section.items.length - 1) / 2);
	if (section.kind === 'stories') return section.stories.length;
	return 1;
};

/** 차례 펼침면 다음(4쪽)부터 구역을 펼침면에 나눈다. 짝 없는 마지막 쪽 구역은 뒤표지와 한 펼침면에 놓는다 */
function planOf(sections: LandingSection[], firstPage: number): Plan[] {
	const plans: Plan[] = [];
	let page = firstPage;
	for (let i = 0; i < sections.length; i++) {
		const section = sections[i];
		if (RUN_KINDS.has(section.kind)) {
			const spreads = spreadsOf(section);
			plans.push({ type: 'run', section, page, spreads });
			page += spreads * 2;
			continue;
		}
		const next = sections[i + 1];
		const isPage = !FLOW_KINDS.has(section.kind);
		if (isPage && next && !RUN_KINDS.has(next.kind) && !FLOW_KINDS.has(next.kind)) {
			plans.push({ type: 'pair', sections: [section, next], page });
			i++;
		} else if (isPage && !next) plans.push({ type: 'last', section, page });
		else plans.push({ type: 'solo', section, page });
		page += 2;
	}
	return plans;
}

/* ─── 구역 몸통 (한 쪽, 또는 두 단으로 흐르는 펼침면) ─── */

type Body<K extends LandingSectionKind> = React.FC<{ section: SectionOf<K> }>;

const Steps: Body<'steps'> = ({ section }) => (
	<>
		<Head section={section} />
		<ol className="mg-steps">
			{section.items.map((point, index) => (
				<li key={point.title} data-reveal="">
					<span className="mg-step-no" aria-hidden="true">
						{index + 1}
					</span>
					<div>
						<h3>
							{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
							{point.title}
						</h3>
						<p>{point.body}</p>
						{point.detail && <p className="mg-step-more">{point.detail}</p>}
						{point.media.map((item) => (
							<Figure key={item.src} media={item} caption={item.alt} size="small" />
						))}
					</div>
				</li>
			))}
		</ol>
	</>
);

const Built: Body<'built'> = ({ section }) => (
	<>
		<Head section={section} />
		<div className="mg-columns">
			{section.items.map((point, index) => (
				<RunIn key={point.title} point={point} icon={iconOf(point, index + 2)} dropcap={index === 0} />
			))}
		</div>
	</>
);

/** 트러블슈팅: 인터뷰처럼 묻고 답한다 */
const QUESTIONS = {
	problem: '문제는 무엇이었나요?',
	cause: '원인은 어디에 있었나요?',
	solution: '어떻게 해결했나요?',
	result: '그 뒤에는 어떻게 되었나요?',
} as const;

const Trouble: Body<'troubleshooting'> = ({ section }) => (
	<>
		<Head section={section} />
		<div className="mg-columns mg-qa-flow">
			{section.items.map((item, index) => (
				<article key={item.title} className="mg-qa" aria-label={item.title} data-reveal="">
					<p className="mg-qa-no" aria-hidden="true">
						<FaIcon icon={troubleIcon(item)} />
						문답 {pad(index + 1)}
					</p>
					<h3>{item.title}</h3>
					<dl>
						{(['problem', 'cause', 'solution', 'result'] as const).map((key) =>
							item[key] ? (
								<div key={key} data-step={key}>
									<dt>
										<span aria-hidden="true">Q. </span>
										{QUESTIONS[key]}
									</dt>
									<dd>
										<span aria-hidden="true">A. </span>
										{item[key]}
									</dd>
								</div>
							) : null
						)}
					</dl>
					{item.image && <Figure media={item.image} caption={item.image.alt || item.title} size="small" />}
				</article>
			))}
		</div>
	</>
);

const Controls: Body<'controls'> = ({ section }) => (
	<>
		<Head section={section} />
		<dl className="mg-keys">
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
);

const Tech: Body<'tech'> = ({ section }) => (
	<>
		<Head section={section} />
		{section.stack.length > 0 && (
			<div className="mg-stack">
				<h3>쓴 기술</h3>
				<ul>
					{section.stack.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</div>
		)}
		{section.specs.length > 0 && (
			<dl className="mg-specs">
				{section.specs.map((spec) => (
					<div key={spec.label}>
						<dt>{spec.label}</dt>
						<dd>{spec.value}</dd>
					</div>
				))}
			</dl>
		)}
		{section.structure && (
			<figure className="mg-tree">
				<figcaption>폴더 구조</figcaption>
				<pre>{section.structure}</pre>
			</figure>
		)}
	</>
);

/** 팀원: 잡지의 기고자 쪽 */
const Team: Body<'team'> = ({ section }) => (
	<>
		<Head section={section} />
		<ul className="mg-contributors">
			{section.members.map((member) => (
				<li key={member.name} data-me={member.me ? '' : undefined} data-reveal="">
					<MemberAvatar member={member} className="mg-avatar" />
					<div>
						<h3>
							{member.name}
							{member.me && <span className="mg-me">나</span>}
						</h3>
						<p>{member.role}</p>
						{member.url && (
							<a href={member.url} title={member.url} {...external}>
								<FaIcon icon={/github\.com/.test(member.url) ? 'fa-github' : 'fa-link'} />
								{shortLink(member.url)}
							</a>
						)}
					</div>
				</li>
			))}
		</ul>
	</>
);

const Role: Body<'role'> = ({ section }) => (
	<>
		<Head section={section} deck={section.role ?? ''} />
		{(section.context || section.period) && (
			<p className="mg-role-meta">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
		)}
		{section.contributions.length > 0 && (
			<ul className="mg-role-list">
				{section.contributions.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		)}
	</>
);

/** 진행 과정: 날짜가 앞에 선 연대기 단 */
const Timeline: Body<'timeline'> = ({ section }) => (
	<>
		<Head section={section} />
		<ol className="mg-chrono">
			{section.entries.map((entry) => (
				<li key={`${entry.date}-${entry.label}`}>
					<time>{entry.date}</time>
					<span>{entry.label}</span>
				</li>
			))}
		</ol>
	</>
);

const Deployments: Body<'deployments'> = ({ section }) => (
	<>
		<Head section={section} />
		<ul className="mg-where">
			{section.items.map((item) => (
				<li key={item.label} data-reveal="">
					{item.image && (
						<div className="mg-where-image">
							<Media media={item.image} />
						</div>
					)}
					<p className="mg-where-top">
						<FaIcon icon={item.icon} />
						{[item.platform, item.host].filter(Boolean).join(' · ')}
					</p>
					<h3>
						{item.url ? (
							<a href={item.url} {...external}>
								{item.label}
							</a>
						) : (
							item.label
						)}
					</h3>
					{item.note && <p>{item.note}</p>}
					<p className="mg-where-status">{item.url ? '공개되어 있습니다.' : '공개된 주소가 없습니다.'}</p>
				</li>
			))}
		</ul>
	</>
);

const Credits: Body<'credits'> = ({ section }) => (
	<>
		<Head section={section} />
		<ol className="mg-notes">
			{section.credits.map((credit) => (
				<li key={`${credit.role}-${credit.name}`}>
					<span className="mg-note-role">{credit.role}</span>{' '}
					{credit.href ? (
						<a href={credit.href} {...external}>
							{credit.name}
						</a>
					) : (
						<cite>{credit.name}</cite>
					)}
					, {credit.by}.{credit.note && <span className="mg-note-extra"> {credit.note}.</span>}
				</li>
			))}
		</ol>
	</>
);

/** 한 쪽이나 두 단 펼침면으로 그리는 구역의 몸통. 여러 펼침면 구역(기능·화면·이야기)과 숫자는 따로 그린다 */
const BODIES: { [K in LandingSectionKind]?: Body<K> } = {
	steps: Steps,
	built: Built,
	troubleshooting: Trouble,
	controls: Controls,
	tech: Tech,
	team: Team,
	role: Role,
	timeline: Timeline,
	deployments: Deployments,
	credits: Credits,
};

const SectionBody: React.FC<{ section: LandingSection }> = ({ section }) => {
	const Render = BODIES[section.kind] as Body<LandingSection['kind']> | undefined;
	return Render ? <Render section={section as never} /> : null;
};

/** 구역 감싸개: 이름 붙은 <section> (차례에서 찾아가는 id) */
const sectionProps = (section: LandingSection) => ({
	id: `mg-${section.kind}`,
	'aria-label': section.label,
	'data-section': section.kind,
	tabIndex: -1,
});

/* ─── 여러 펼침면 구역 ─── */

const FeaturesRun: React.FC<{ section: SectionOf<'features'>; page: number; mast: string }> = ({
	section,
	page,
	mast,
}) => {
	const [first, ...rest] = section.items;
	const pairs: LandingPoint[][] = [];
	for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));
	return (
		<section className="mg-run" {...sectionProps(section)}>
			<div className="mg-spread">
				<div className="mg-page">
					<Head section={section} />
					<FeatureText point={first} index={0} quoteElsewhere={!first.media[0]} />
				</div>
				<div className="mg-page mg-page-visual" data-bleed={first.media[0] ? '' : undefined}>
					<FeatureVisual point={first} />
				</div>
				<Folios page={page} mast={mast} label={section.label} />
			</div>
			{pairs.map((pair, p) => {
				const at = 1 + p * 2;
				const folio = page + 2 + p * 2;
				if (pair.length === 2)
					return (
						<div key={pair[0].title} className="mg-spread">
							<FeaturePage point={pair[0]} index={at} />
							<FeaturePage point={pair[1]} index={at + 1} />
							<Folios page={folio} mast={mast} label={section.label} />
						</div>
					);
				// 짝이 없는 마지막 기능은 글 쪽과 그림 쪽으로 펼친다
				const [point] = pair;
				return (
					<div key={point.title} className="mg-spread">
						<div className="mg-page">
							<FeatureText point={point} index={at} quoteElsewhere={!point.media[0]} />
						</div>
						<div className="mg-page mg-page-visual" data-bleed={point.media[0] ? '' : undefined}>
							<FeatureVisual point={point} />
						</div>
						<Folios page={folio} mast={mast} label={section.label} />
					</div>
				);
			})}
		</section>
	);
};

/** 화면 모음: 왼쪽 쪽은 첫 화면을 가득, 오른쪽 쪽은 머리와 나머지 화면 */
const ScreensRun: React.FC<{ section: SectionOf<'screens'>; page: number; mast: string }> = ({
	section,
	page,
	mast,
}) => {
	const [first, ...rest] = section.shots;
	return (
		<section className="mg-run" {...sectionProps(section)}>
			<div className="mg-spread">
				<div className="mg-page mg-page-photo">
					<Figure media={first} caption={first.caption} size="bleed" />
				</div>
				<div className="mg-page">
					<Head section={section} />
					{rest.length > 0 && (
						<div className="mg-portfolio" data-count={Math.min(rest.length, 4)}>
							{rest.map((shot) => (
								<Figure key={shot.src} media={shot} caption={shot.caption} size="small" />
							))}
						</div>
					)}
				</div>
				<Folios page={page} mast={mast} label={section.label} />
			</div>
		</section>
	);
};

/** 이야기: 한 장마다 펼침면 하나. 왼쪽은 큰 인용구, 오른쪽은 제목과 글, 숫자와 그림 */
const StoriesRun: React.FC<{ section: SectionOf<'stories'>; page: number; mast: string }> = ({
	section,
	page,
	mast,
}) => (
	<section className="mg-run" {...sectionProps(section)}>
		{section.stories.map((story, index) => (
			<article key={story.title} className="mg-spread" aria-label={story.title}>
				<div className="mg-page mg-page-quote">
					{index === 0 && <Head section={section} />}
					<p className="mg-story-no" aria-hidden="true">
						{roman(index + 1)}
					</p>
					{story.lead ? (
						<blockquote className="mg-pull mg-pull-huge" data-reveal="ink">
							<p>{story.lead}</p>
						</blockquote>
					) : (
						story.facts.length > 0 && <Numbers facts={story.facts} className="mg-numbers-big" />
					)}
				</div>
				<div className="mg-page">
					<h3 className="mg-story-title">{story.title}</h3>
					{story.points.length > 0 && (
						<div className="mg-story-points">
							{story.points.map((point) => (
								<RunIn key={point.title} point={point} />
							))}
						</div>
					)}
					{story.lead && story.facts.length > 0 && (
						<aside className="mg-sidebar" aria-label={`${story.title} 숫자`}>
							<Numbers facts={story.facts} />
						</aside>
					)}
					{story.image && <Figure media={story.image} caption={story.image.alt} size="page" />}
				</div>
				<Folios page={page + index * 2} mast={mast} label={section.label} />
			</article>
		))}
	</section>
);

/* ─── 표지·차례·뒤표지 ─── */

const Cover: React.FC<{ hero: LandingHero; landing: Landing }> = ({ hero, landing }) => {
	const mast = mastOf(hero.name);
	const lines = coverLines(landing);
	return (
		<header className="mg-cover" data-image={hero.image ? '' : undefined}>
			<div className="mg-cover-top">
				{hero.logo ? (
					<img className="mg-logo" src={hero.logo} alt={hero.name} />
				) : (
					<p className="mg-mast">{mast.title}</p>
				)}
				<p className="mg-issue">
					<span>{issueOf(hero.meta.period)}</span>
					{mast.sub && <span>{mast.sub}</span>}
				</p>
			</div>
			<div className="mg-cover-foot">
				{hero.meta.context && <p className="mg-cover-kicker">{hero.meta.context}</p>}
				<h1>{hero.headline}</h1>
				<LandingLinks links={hero.links} className="mg-links" />
			</div>
			<div className="mg-cover-art">
				{hero.image ? (
					<Media media={hero.image} eager className="mg-cover-image" />
				) : (
					<p className="mg-cover-no" aria-hidden="true">
						01
					</p>
				)}
				{lines.length > 0 && (
					<ul className="mg-coverlines">
						{lines.map((line) => (
							<li key={line.kicker}>
								<span>{line.kicker}</span>
								{line.text}
							</li>
						))}
					</ul>
				)}
			</div>
		</header>
	);
};

/** 차례 펼침면: 왼쪽 쪽은 차례, 오른쪽 쪽은 편집자의 글(소개와 맡은 일)과 숫자 곁상자 */
const Contents: React.FC<{
	hero: LandingHero;
	stats?: SectionOf<'stats'>;
	entries: { section: LandingSection; page: number }[];
	mast: string;
	onGo: (kind: LandingSectionKind) => void;
}> = ({ hero, stats, entries, mast, onGo }) => {
	const letter = Boolean(hero.subhead || hero.meta.role || hero.meta.period || stats);
	return (
		<div className="mg-spread mg-contents" data-solo={letter ? undefined : ''}>
			<nav className="mg-page" aria-label="차례">
				<p className="mg-rubric">이번 호</p>
				<p className="mg-contents-title" aria-hidden="true">
					차례
				</p>
				<ol>
					{entries.map(({ section, page }) => (
						<li key={section.kind}>
							<button type="button" onClick={() => onGo(section.kind)}>
								<span className="mg-toc-page">{pad(page)}</span>
								<span className="mg-toc-text">
									<span className="mg-toc-label">{section.label}</span>
									<span className="mg-toc-headline">{EDITORIAL[section.kind].headline}</span>
								</span>
							</button>
						</li>
					))}
				</ol>
			</nav>
			{letter && (
				<div className="mg-page mg-letter">
					<p className="mg-rubric">편집자의 글</p>
					{hero.subhead && (
						<p className="mg-letter-body" data-dropcap="">
							{hero.subhead}
						</p>
					)}
					{(hero.meta.role || hero.meta.period) && (
						<dl className="mg-byline">
							{hero.meta.role && (
								<div>
									<dt>맡은 일</dt>
									<dd>{hero.meta.role}</dd>
								</div>
							)}
							{hero.meta.period && (
								<div>
									<dt>기간</dt>
									<dd>{hero.meta.period}</dd>
								</div>
							)}
						</dl>
					)}
					{stats && (
						<section className="mg-sidebar mg-stats" {...sectionProps(stats)} data-reveal="">
							<h2>{EDITORIAL.stats.headline}</h2>
							<p className="mg-deck">{EDITORIAL.stats.deck}</p>
							<Numbers facts={stats.facts} />
						</section>
					)}
				</div>
			)}
			<Folios page={2} mast={mast} label="차례" />
		</div>
	);
};

const BackCover: React.FC<{ closing: Landing['closing']; hero: LandingHero; single: boolean }> = ({
	closing,
	hero,
	single,
}) => (
	<footer className="mg-page mg-back" data-single={single ? '' : undefined}>
		<p className="mg-rubric">뒤표지</p>
		<h2>{closing.title}</h2>
		{closing.lead && <p className="mg-back-lead">{closing.lead}</p>}
		<LandingLinks links={closing.links} className="mg-links" />
		<div className="mg-back-foot" aria-hidden="true">
			{hero.icon && <img src={hero.icon} alt="" />}
			<span>{mastOf(hero.name).title}</span>
			<span>{issueOf(hero.meta.period)}</span>
			<span className="mg-barcode" />
		</div>
	</footer>
);

/* ─── 페이지 ─── */

const MagazinePage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = magazineAccent(useLandingAccent(project.icon));
	const { hero, closing, sections } = landing;
	const mast = mastOf(hero.name).title;

	const stats = sections.find((s): s is SectionOf<'stats'> => s.kind === 'stats');
	const rest = sections.filter((s) => s.kind !== 'stats');
	const plans = planOf(rest, 4);
	const last = plans[plans.length - 1];
	const entries = [
		...(stats ? [{ section: stats as LandingSection, page: 3 }] : []),
		...plans.flatMap((plan) =>
			plan.type === 'pair'
				? [
						{ section: plan.sections[0], page: plan.page },
						{ section: plan.sections[1], page: plan.page + 1 },
					]
				: [{ section: plan.section, page: plan.page }]
		),
	];

	// 차례에서 고른 구역으로: 페이지의 스크롤 상자만 움직이고 초점을 옮긴다
	const go = useCallback(
		(kind: LandingSectionKind) => {
			const target = root.current?.querySelector<HTMLElement>(`#mg-${kind}`);
			const scroller = target && scrollParent(target);
			if (!target) return;
			if (scroller) {
				const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24;
				scroller.scrollTo({ top: Math.max(0, top) });
			}
			target.focus({ preventScroll: true });
		},
		[root]
	);

	return (
		<div ref={root} className="tpl tpl-magazine" style={accent} data-image={hero.image ? '' : undefined}>
			<Cover hero={hero} landing={landing} />

			{sections.length > 0 && <Contents hero={hero} stats={stats} entries={entries} mast={mast} onGo={go} />}

			{plans.map((plan) => {
				if (plan.type === 'run') {
					const { section } = plan;
					if (section.kind === 'features')
						return <FeaturesRun key={section.kind} section={section} page={plan.page} mast={mast} />;
					if (section.kind === 'screens')
						return <ScreensRun key={section.kind} section={section} page={plan.page} mast={mast} />;
					if (section.kind === 'stories')
						return <StoriesRun key={section.kind} section={section} page={plan.page} mast={mast} />;
					return null;
				}
				if (plan.type === 'pair')
					return (
						<div key={plan.sections[0].kind} className="mg-spread">
							{plan.sections.map((section) => (
								<section key={section.kind} className="mg-page" {...sectionProps(section)}>
									<SectionBody section={section} />
								</section>
							))}
							<Folios page={plan.page} mast={mast} label={plan.sections[1].label} />
						</div>
					);
				if (plan.type === 'last')
					return (
						<div key={plan.section.kind} className="mg-spread mg-spread-end">
							<section className="mg-page" {...sectionProps(plan.section)}>
								<SectionBody section={plan.section} />
							</section>
							<BackCover closing={closing} hero={hero} single={false} />
							<Folios page={plan.page} mast={mast} label="뒤표지" />
						</div>
					);
				return (
					<section key={plan.section.kind} className="mg-spread" data-solo="" {...sectionProps(plan.section)}>
						<div className="mg-page mg-page-flow">
							<SectionBody section={plan.section} />
						</div>
						<Folios page={plan.page} mast={mast} label={plan.section.label} />
					</section>
				);
			})}

			{last?.type !== 'last' && (
				<div className="mg-back-alone">
					<BackCover closing={closing} hero={hero} single />
				</div>
			)}
		</div>
	);
};

export default MagazinePage;

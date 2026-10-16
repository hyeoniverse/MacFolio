// playful 템플릿: 점 찍힌 종이를 깐 큰 게시판(스크랩북)에 물건을 핀과 테이프로 붙여 둔 콜라주.
// 첫 화면은 가운데 포스터(이름표 테이프, 손글씨 물결이 그어진 큰 제목, 링크)와 그 양옆에 핀으로 꽂은 폴라로이드(대표 화면)와 붙임쪽지(맥락·맡은 일·기간).
// 구역은 점선으로 둘러친 이름표 붙은 자리(zone)이고, 자리마다 다른 물건을 붙인다: 숫자는 우표, 기능은 붙임쪽지와 폴라로이드, 화면은 폴라로이드 벽,
// 쓰는 법은 공책 쪽, 구현 방법은 색인 카드, 트러블슈팅은 뒤집는 색인 카드(앞: 문제, 뒤: 해결과 결과), 이야기는 일기장 쪽, 조작법은 글쇠 스티커,
// 기술은 스티커와 꼬리표, 팀원은 사진 부스 띠, 내 역할은 할 일 쪽지, 진행 과정은 손으로 그은 점선 길, 배포 결과물은 입장권, 출처는 영수증,
// 마무리는 엽서. 물건은 정해진 각도로 조금씩 기울어 서로 가리지 않게 흐르며 놓인다. 계약은 templates/README.md
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectFact } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
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
	type LandingTrouble,
	type SectionOf,
} from '@/apps/safari/project/landing';
import { playfulAccent } from './accent';
import './Page.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** 종이 색 차례: 붙임쪽지·우표·스티커가 돌아가며 쓴다 */
const TONES = ['sun', 'pink', 'mint', 'sky', 'lilac'] as const;
type Tone = (typeof TONES)[number] | 'coral';
const toneOf = (index: number, offset = 0): Tone => TONES[(index + offset) % TONES.length];

/** 붙인 물건의 기울기와 위아래 어긋남: 정해진 값을 돌아가며 (매번 같은 자리) */
const TILTS = [-2.5, 1.8, -1.2, 2.6, -1.8, 1.1, -2.2, 2.2];
const NUDGES = [0, 22, 6, 30, 12, 26, 2, 18];
const pinned = (index: number, scale = 1) =>
	({
		'--tilt': `${TILTS[index % TILTS.length] * scale}deg`,
		'--nudge': `${NUDGES[index % NUDGES.length]}px`,
	}) as React.CSSProperties;

/** 구역마다 자리 이름표 아래의 큰 문장 */
const TITLES: Record<LandingSectionKind, string> = {
	stats: '숫자를 우표로 모아 붙였습니다.',
	features: '붙임쪽지에 적어 둔 기능입니다.',
	screens: '찍어 둔 화면을 한데 꽂았습니다.',
	steps: '이 차례대로 시작하면 됩니다.',
	built: '만든 방법을 카드에 적어 두었습니다.',
	troubleshooting: '카드를 뒤집으면 해결이 보입니다.',
	stories: '일기장에 남긴 이야기입니다.',
	controls: '손에 익혀 둘 글쇠입니다.',
	tech: '쓴 기술을 스티커로 붙였습니다.',
	team: '함께 만든 사람들의 사진입니다.',
	role: '제가 맡은 일을 적어 두었습니다.',
	timeline: '지나온 길을 따라가 봅니다.',
	deployments: '바로 가 볼 수 있는 입장권입니다.',
	credits: '고마운 출처를 적어 둡니다.',
};

/** 반쪽 자리: 이웃한 둘이 한 줄에 나란히 선다 (짝이 없으면 한 줄을 다 쓴다) */
const HALF = new Set<LandingSectionKind>(['steps', 'controls', 'tech', 'team', 'role', 'credits']);

/** 구역마다 자리 폭: 반쪽 자리가 이어지면 둘씩 짝짓는다 */
function spansOf(sections: LandingSection[]): Record<string, 'half' | 'full'> {
	const spans: Record<string, 'half' | 'full'> = {};
	for (let i = 0; i < sections.length; i++) {
		const kind = sections[i].kind;
		const next = sections[i + 1]?.kind;
		if (HALF.has(kind) && next && HALF.has(next)) {
			spans[kind] = 'half';
			spans[next] = 'half';
			i++;
		} else spans[kind] = 'full';
	}
	return spans;
}

/* ─── 작은 조각 ─── */

/** 테이프 조각 (장식) */
const Tape: React.FC<{ className?: string }> = ({ className }) => (
	<span className={['pf-tape', className].filter(Boolean).join(' ')} aria-hidden="true" />
);

/** 압정 (장식) */
const Pin: React.FC = () => <span className="pf-pin" aria-hidden="true" />;

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
 * 큰 제목의 낱말 하나에 물결을 긋는다. 우리말 문장이 '~니다.'로 끝나면 그 앞 낱말에, 아니면 마지막 낱말에.
 * 글은 그대로 두고 그 낱말만 감싼다 (화면 읽기와 시험이 읽는 글은 같다)
 */
const Headline: React.FC<{ text: string }> = ({ text }) => {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length < 2) return <>{text}</>;
	const last = words.length - 1;
	const pick = words.length >= 3 && /다[.!?]?$/.test(words[last]) ? last - 1 : last;
	const match = /^(.*?)([.,!?…]*)$/.exec(words[pick]);
	const core = match?.[1] || words[pick];
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

/** 폴라로이드: 흰 틀의 사진과 손글씨 설명, 위에 테이프 */
const Polaroid: React.FC<{
	media: LandingMedia;
	caption?: string;
	index?: number;
	eager?: boolean;
	className?: string;
	reveal?: boolean;
}> = ({ media, caption, index = 0, eager, className, reveal = true }) => (
	<figure
		className={['pf-polaroid', className].filter(Boolean).join(' ')}
		style={pinned(index)}
		data-reveal={reveal ? 'drop' : undefined}
	>
		<Tape />
		<div className="pf-photo">
			<Media media={media} eager={eager} />
		</div>
		{caption && <figcaption>{caption}</figcaption>}
	</figure>
);

/** 구역 자리의 머리: 테이프 이름표(구역 이름)와 손글씨 큰 문장 */
const ZoneHead: React.FC<{ section: LandingSection; index: number }> = ({ section, index }) => (
	<header className="pf-zone-head">
		<span className="pf-label" data-tone={toneOf(index, 1)} style={pinned(index, 0.6)}>
			{section.label}
		</span>
		<h2>{TITLES[section.kind]}</h2>
	</header>
);

/** 우표 묶음 (숫자 구역, 이야기의 숫자) */
const Stamps: React.FC<{ facts: ProjectFact[]; small?: boolean; offset?: number }> = ({ facts, small, offset = 0 }) => (
	<dl className="pf-stamps" data-small={small ? '' : undefined}>
		{facts.map((fact, index) => (
			<div
				key={`${fact.value}-${fact.label}`}
				className="pf-stamp"
				data-tone={toneOf(index, offset)}
				style={pinned(index + offset)}
				data-reveal={small ? undefined : 'drop'}
			>
				<div className="pf-stamp-in">
					<dd>{fact.value}</dd>
					<dt>{fact.label}</dt>
				</div>
			</div>
		))}
	</dl>
);

/** 항목의 글: 묶음, 제목, 설명, 이어 읽는 설명 */
const PointText: React.FC<{ point: LandingPoint; icon?: string; level?: 'h3' | 'h4' }> = ({
	point,
	icon,
	level = 'h3',
}) => {
	const Title = level;
	return (
		<>
			{point.group && <p className="pf-group">{point.group}</p>}
			<Title className="pf-point-title">
				{icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
				{point.title}
			</Title>
			<p className="pf-body">{point.body}</p>
			{point.detail && <p className="pf-detail">{point.detail}</p>}
		</>
	);
};

/* ─── 구역 ─── */

type Body<K extends LandingSectionKind> = React.FC<{ section: SectionOf<K>; index: number }>;

const Stats: Body<'stats'> = ({ section }) => <Stamps facts={section.facts} />;

/** 기능: 붙임쪽지 하나와 그 옆에 꽂은 폴라로이드 */
const Features: Body<'features'> = ({ section }) => (
	<ul className="pf-pins">
		{section.items.map((point, index) => (
			<li key={point.title} className="pf-cluster" data-media={point.media.length ? '' : undefined}>
				<div className="pf-sticky" data-tone={toneOf(index)} style={pinned(index)} data-reveal="drop">
					<Tape />
					<span className="pf-sticky-icon" aria-hidden="true">
						<i className={`fa-solid ${iconOf(point, index)}`} />
					</span>
					<PointText point={point} />
				</div>
				{point.media.map((media, m) => (
					<Polaroid key={media.src} media={media} caption={media.alt} index={index + m + 1} />
				))}
			</li>
		))}
	</ul>
);

const Screens: Body<'screens'> = ({ section }) => (
	<ul className="pf-pins pf-wall">
		{section.shots.map((shot, index) => (
			<li key={shot.src}>
				<Polaroid media={shot} caption={shot.caption} index={index} />
			</li>
		))}
	</ul>
);

/** 쓰는 법: 줄 공책 한 쪽의 번호 목록 */
const Steps: Body<'steps'> = ({ section, index }) => (
	<div className="pf-notebook" style={pinned(index, 0.4)} data-reveal="drop">
		<Tape />
		<ol className="pf-steps">
			{section.items.map((point, i) => (
				<li key={point.title}>
					<span className="pf-step-no" aria-hidden="true">
						{i + 1}
					</span>
					<div>
						<PointText point={point} icon={point.icon} />
						{point.media.map((media, m) => (
							<Polaroid key={media.src} media={media} caption={media.alt} index={m} className="pf-polaroid-small" />
						))}
					</div>
				</li>
			))}
		</ol>
	</div>
);

/** 구현 방법: 압정으로 꽂은 색인 카드, 그림이 있으면 옆에 폴라로이드 */
const Built: Body<'built'> = ({ section }) => (
	<ul className="pf-pins">
		{section.items.map((point, index) => (
			<li key={point.title} className="pf-cluster">
				<div className="pf-card" style={pinned(index + 3, 0.7)} data-reveal="drop">
					<Pin />
					<PointText point={point} icon={iconOf(point, index + 2)} />
				</div>
				{point.media.map((media, m) => (
					<Polaroid key={media.src} media={media} caption={media.alt} index={index + m + 2} />
				))}
			</li>
		))}
	</ul>
);

/** 트러블슈팅 카드 한 장: 앞면은 문제(와 원인), 뒤집으면 해결과 결과. 보이지 않는 면은 inert */
const FlipCard: React.FC<{ item: LandingTrouble; index: number }> = ({ item, index }) => {
	const [flipped, setFlipped] = useState(false);
	const front = useRef<HTMLButtonElement>(null);
	const back = useRef<HTMLButtonElement>(null);
	const moved = useRef(false);
	useEffect(() => {
		// 뒤집은 뒤에는 초점을 보이는 면의 단추로 옮긴다 (처음 그릴 때는 옮기지 않는다)
		if (!moved.current) return;
		(flipped ? back : front).current?.focus();
	}, [flipped]);
	const flip = () => {
		moved.current = true;
		setFlipped((value) => !value);
	};
	return (
		<li className="pf-cluster">
			<div
				className="pf-flip"
				data-flipped={flipped ? '' : undefined}
				style={pinned(index + 1, 0.6)}
				data-reveal="drop"
			>
				<div className="pf-flip-inner">
					<div className="pf-face pf-front" inert={flipped}>
						<Pin />
						<p className="pf-face-tag">
							<FaIcon icon={troubleIcon(item)} />
							문제 {pad(index + 1)}
						</p>
						<h3 className="pf-point-title">{item.title}</h3>
						<p className="pf-body">{item.problem}</p>
						{item.cause && (
							<p className="pf-detail">
								<b>원인</b> {item.cause}
							</p>
						)}
						<button ref={front} type="button" className="pf-flip-button" onClick={flip}>
							뒤집어서 해결 보기 <i className="fa-solid fa-rotate" aria-hidden="true" />
						</button>
					</div>
					<div className="pf-face pf-back" inert={!flipped}>
						<Pin />
						<p className="pf-face-tag">해결 {pad(index + 1)}</p>
						<p className="pf-back-title">{item.title}</p>
						<p className="pf-body">{item.solution}</p>
						{item.result && (
							<p className="pf-result">
								<b>결과</b> {item.result}
							</p>
						)}
						<button ref={back} type="button" className="pf-flip-button" onClick={flip}>
							앞면 다시 보기 <i className="fa-solid fa-rotate-left" aria-hidden="true" />
						</button>
					</div>
				</div>
			</div>
			{item.image && <Polaroid media={item.image} caption={item.image.alt || item.title} index={index + 4} />}
		</li>
	);
};

const Trouble: Body<'troubleshooting'> = ({ section }) => (
	<ul className="pf-pins">
		{section.items.map((item, index) => (
			<FlipCard key={item.title} item={item} index={index} />
		))}
	</ul>
);

/** 이야기: 줄 그은 일기장 한 쪽씩 */
const Stories: Body<'stories'> = ({ section }) => (
	<div className="pf-pins">
		{section.stories.map((story, index) => (
			<article
				key={story.title}
				className="pf-diary"
				aria-label={story.title}
				style={pinned(index + 2, 0.5)}
				data-reveal="drop"
			>
				<Tape />
				{story.image && (
					<Polaroid media={story.image} caption={story.image.alt} index={index + 1} className="pf-polaroid-small" />
				)}
				<p className="pf-diary-no" aria-hidden="true">
					{pad(index + 1)}번째 이야기
				</p>
				<h3 className="pf-diary-title">{story.title}</h3>
				{story.lead && <p className="pf-diary-lead">{story.lead}</p>}
				{story.facts.length > 0 && <Stamps facts={story.facts} small offset={index + 2} />}
				{story.points.length > 0 && (
					<ul className="pf-diary-points">
						{story.points.map((point) => (
							<li key={point.title}>
								<PointText point={point} level="h4" />
								{point.media.map((media, m) => (
									<Polaroid key={media.src} media={media} caption={media.alt} index={m} className="pf-polaroid-small" />
								))}
							</li>
						))}
					</ul>
				)}
			</article>
		))}
	</div>
);

/** 조작법: 글쇠 스티커와 손글씨 설명 */
const Controls: Body<'controls'> = ({ section }) => (
	<dl className="pf-keys">
		{section.controls.map((control, index) => (
			<div key={control.label} style={pinned(index, 0.5)}>
				<dt>
					{control.keys.map((key) => (
						<kbd key={key}>{key}</kbd>
					))}
				</dt>
				<dd>{control.label}</dd>
			</div>
		))}
	</dl>
);

/** 기술: 둥근 스티커(쓴 기술), 꼬리표(사양), 타자로 친 쪽지(폴더 구조) */
const Tech: Body<'tech'> = ({ section }) => (
	<div className="pf-tech">
		{section.stack.length > 0 && (
			<div className="pf-stickers">
				<h3 className="visually-hidden">쓴 기술</h3>
				<ul>
					{section.stack.map((item, index) => (
						<li key={item} data-tone={toneOf(index, 2)} style={pinned(index, 1.6)}>
							{item}
						</li>
					))}
				</ul>
			</div>
		)}
		{section.specs.length > 0 && (
			<dl className="pf-tag" style={pinned(5, 0.5)}>
				<span className="pf-tag-hole" aria-hidden="true" />
				{section.specs.map((spec) => (
					<div key={spec.label}>
						<dt>{spec.label}</dt>
						<dd>{spec.value}</dd>
					</div>
				))}
			</dl>
		)}
		{section.structure && (
			<figure className="pf-typed" style={pinned(2, 0.4)}>
				<Tape />
				<figcaption>폴더 구조</figcaption>
				<pre>{section.structure}</pre>
			</figure>
		)}
	</div>
);

/** 팀원: 사진 부스 띠 한 줄. 칸마다 사진(없으면 이름 첫 글자)과 손글씨 이름 */
const Team: Body<'team'> = ({ section }) => (
	<ul className="pf-booth" style={pinned(1, 0.6)} data-reveal="drop">
		{section.members.map((member, index) => (
			<li key={member.name} data-me={member.me ? '' : undefined}>
				<div className="pf-booth-shot" data-tone={toneOf(index, 3)}>
					<MemberAvatar member={member} className="pf-avatar" />
				</div>
				<h3>
					{member.name}
					{member.me && <span className="pf-me">나</span>}
				</h3>
				<p>{member.role}</p>
				{member.url && (
					<a href={member.url} title={member.url} {...external}>
						<FaIcon icon={/github\.com/.test(member.url) ? 'fa-github' : 'fa-link'} />
						{shortLink(member.url)}
					</a>
				)}
			</li>
		))}
	</ul>
);

/** 내 역할: 할 일 쪽지 */
const Role: Body<'role'> = ({ section, index }) => (
	<div className="pf-todo" data-tone="sun" style={pinned(index, 0.5)} data-reveal="drop">
		<Tape />
		{section.role && <h3 className="pf-point-title">{section.role}</h3>}
		{(section.context || section.period) && (
			<p className="pf-detail">{[section.context, section.period].filter(Boolean).join(' · ')}</p>
		)}
		{section.contributions.length > 0 && (
			<ul>
				{section.contributions.map((item) => (
					<li key={item}>
						<i className="fa-solid fa-check" aria-hidden="true" />
						{item}
					</li>
				))}
			</ul>
		)}
	</div>
);

/** 진행 과정: 손으로 그은 점선 길 위에 날짜 쪽지를 위아래로 번갈아 */
const Timeline: Body<'timeline'> = ({ section }) => (
	<div className="pf-path">
		<svg className="pf-path-line" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
			<path
				d="M0 20 C 60 12, 110 28, 170 20 S 280 12, 340 20 S 450 28, 510 20 S 620 12, 680 20 S 790 28, 850 20 S 960 12, 1000 19"
				fill="none"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
		<ol style={{ '--n': section.entries.length } as React.CSSProperties}>
			{section.entries.map((entry, index) => (
				<li key={`${entry.date}-${entry.label}`} data-side={index % 2 ? 'down' : 'up'}>
					<span className="pf-path-dot" aria-hidden="true" />
					<div className="pf-path-note" style={pinned(index, 0.6)}>
						<time>{entry.date}</time>
						<span>{entry.label}</span>
					</div>
				</li>
			))}
		</ol>
	</div>
);

/** 배포 결과물: 입장권. 주소가 있으면 표 전체가 링크 */
const Deployments: Body<'deployments'> = ({ section }) => (
	<ul className="pf-pins pf-tickets">
		{section.items.map((item, index) => (
			<li
				key={item.label}
				className="pf-ticket"
				data-tone={toneOf(index, 1)}
				data-live={item.url ? '' : undefined}
				style={pinned(index, 0.5)}
				data-reveal="drop"
			>
				<div className="pf-ticket-main">
					{item.image && (
						<div className="pf-ticket-image">
							<Media media={item.image} />
						</div>
					)}
					<p className="pf-ticket-meta">{[item.platform, item.host].filter(Boolean).join(' · ')}</p>
					<h3>
						{item.url ? (
							<a href={item.url} {...external}>
								{item.label}
							</a>
						) : (
							item.label
						)}
					</h3>
					{item.note && <p className="pf-ticket-note">{item.note}</p>}
				</div>
				<div className="pf-ticket-stub" aria-hidden="true">
					<FaIcon icon={item.icon} />
					<span>No. {pad(index + 1)}</span>
					<span>{item.url ? '입장' : '준비 중'}</span>
				</div>
			</li>
		))}
	</ul>
);

/** 출처: 영수증 한 장 */
const Credits: Body<'credits'> = ({ section }) => (
	<div className="pf-receipt" style={pinned(3, 0.4)}>
		<p className="pf-receipt-head" aria-hidden="true">
			출처 영수증
		</p>
		<ol>
			{section.credits.map((credit) => (
				<li key={`${credit.role}-${credit.name}`}>
					<span className="pf-receipt-role">{credit.role}</span>
					<span className="pf-receipt-name">
						{credit.href ? (
							<a href={credit.href} {...external}>
								{credit.name}
							</a>
						) : (
							credit.name
						)}
						<small>
							{credit.by}
							{credit.note && ` · ${credit.note}`}
						</small>
					</span>
				</li>
			))}
		</ol>
		<p className="pf-receipt-foot" aria-hidden="true">
			감사합니다
		</p>
	</div>
);

const BODIES: { [K in LandingSectionKind]: Body<K> } = {
	stats: Stats,
	features: Features,
	screens: Screens,
	steps: Steps,
	built: Built,
	troubleshooting: Trouble,
	stories: Stories,
	controls: Controls,
	tech: Tech,
	team: Team,
	role: Role,
	timeline: Timeline,
	deployments: Deployments,
	credits: Credits,
};

/* ─── 첫 화면과 마무리 ─── */

const Hero: React.FC<{ hero: LandingHero }> = ({ hero }) => {
	const meta = [
		hero.meta.context && { label: '어떤 프로젝트', value: hero.meta.context },
		hero.meta.role && { label: '맡은 일', value: hero.meta.role },
		hero.meta.period && { label: '기간', value: hero.meta.period },
	].filter(Boolean) as { label: string; value: string }[];
	return (
		<header className="pf-hero" data-image={hero.image ? '' : undefined} data-meta={meta.length ? '' : undefined}>
			{hero.image && (
				<Polaroid
					media={hero.image}
					caption={hero.image.alt}
					index={0}
					eager
					reveal={false}
					className="pf-hero-photo"
				/>
			)}
			<div className="pf-poster">
				<Tape className="pf-tape-left" />
				<Tape className="pf-tape-right" />
				<p className="pf-nametag">
					{hero.icon && <img src={hero.icon} alt="" />}
					{hero.logo ? <img className="pf-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
				</p>
				<h1>
					<Headline text={hero.headline} />
				</h1>
				{hero.subhead && <p className="pf-subhead">{hero.subhead}</p>}
				<LandingLinks links={hero.links} className="pf-links" />
			</div>
			{meta.length > 0 && (
				<dl className="pf-sticky pf-hero-meta" data-tone="sun" style={pinned(1)}>
					<Pin />
					{meta.map((item) => (
						<div key={item.label}>
							<dt>{item.label}</dt>
							<dd>{item.value}</dd>
						</div>
					))}
				</dl>
			)}
		</header>
	);
};

const Postcard: React.FC<{ closing: Landing['closing']; hero: LandingHero }> = ({ closing, hero }) => (
	<footer className="pf-postcard" style={pinned(2, 0.4)}>
		<div className="pf-postcard-text">
			<h2>{closing.title}</h2>
			{closing.lead && <p className="pf-subhead">{closing.lead}</p>}
			<LandingLinks links={closing.links} className="pf-links" />
		</div>
		<div className="pf-postcard-side" aria-hidden="true">
			<span className="pf-postcard-stamp" data-tone="coral">
				{hero.icon ? <img src={hero.icon} alt="" /> : <i className="fa-solid fa-heart" />}
			</span>
			<span className="pf-postcard-line">{hero.name}</span>
			<span className="pf-postcard-line" />
			<span className="pf-postcard-line" />
		</div>
	</footer>
);

const PlayfulPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = playfulAccent(useLandingAccent(project.icon));
	const { hero, closing, sections } = landing;
	const spans = spansOf(sections);

	return (
		<div ref={root} className="tpl tpl-playful" style={accent}>
			<Hero hero={hero} />
			{sections.length > 0 && (
				<div className="pf-board">
					{sections.map((section, index) => {
						const Render = BODIES[section.kind] as Body<LandingSection['kind']>;
						return (
							<section
								key={section.kind}
								className="pf-zone"
								aria-label={section.label}
								data-section={section.kind}
								data-span={spans[section.kind]}
							>
								<ZoneHead section={section} index={index} />
								<Render section={section as never} index={index} />
							</section>
						);
					})}
				</div>
			)}
			<Postcard closing={closing} hero={hero} />
		</div>
	);
};

export default PlayfulPage;

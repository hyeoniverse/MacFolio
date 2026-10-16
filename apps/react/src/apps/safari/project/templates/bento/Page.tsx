// bento 템플릿: 한 화면 대시보드. 긴 구역을 차례로 늘어놓지 않고, 프로젝트 전체를 크기가 다른 타일로 빈칸 없이 짠 보드 하나에 담는다 (layout.ts).
// 머리 타일(이름·한 줄·링크) 옆에 대표 화면과 작은 꺾은선이 달린 숫자, 그 아래 기능·화면·단계·구현·사례 넘기기 타일, 넷씩 놓인 작은 타일
// (이야기·단축키·기술·팀·역할·날짜 칸 그래프·상태 점이 달린 배포·출처), 맨 아래 마무리 줄. 타일마다 구역(region)이고,
// 담지 못한 내용은 '더 보기'로 여는 자세히 보기 창(Sheet.tsx, 모달 dialog)에 둔다. 기능 줄을 누르면 그 기능의 자세히 보기가 열린다.
// 1px 선, 고정폭 숫자, 짧은 이름표 같은 제목. 사이트 테마를 따르고 다크에서 가장 또렷하다. 계약은 templates/README.md
import React, { useMemo, useState } from 'react';
import type { Project } from '@/shared/profile';
import { useReveal } from '@/apps/safari/project/reveal';
import {
	DeployList,
	FaIcon,
	iconOf,
	Media,
	MemberAvatar,
	TeamList,
	TroubleList,
	troubleIcon,
	troubleSteps,
	useLanding,
	useLandingAccent,
	type LandingMedia,
	type LandingPoint,
	type LandingSection,
	type LandingSectionKind,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { bentoAccent } from './accent';
import { Graph, Spark } from './charts';
import { graphOf } from './graph';
import { BentoLinks } from './Links';
import { boardOf, placementStyle } from './layout';
import { Sheet } from './Sheet';
import './Page.css';

/** 타일 제목: 대시보드의 짧은 이름표 */
const TILE_TITLES: Record<LandingSectionKind, string> = {
	stats: '숫자',
	features: '기능',
	screens: '화면',
	steps: '시작하기',
	built: '구현',
	troubleshooting: '문제 해결',
	stories: '이야기',
	controls: '단축키',
	tech: '기술',
	team: '팀',
	role: '역할',
	timeline: '타임라인',
	deployments: '배포',
	credits: '출처',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** 타일 머리: 이름표 같은 제목, 개수, 자세히 보기 단추 */
const TileHead: React.FC<{ section: LandingSection; count?: number; onMore?: () => void }> = ({
	section,
	count,
	onMore,
}) => (
	<header className="bt-tile-head">
		<h2>{TILE_TITLES[section.kind]}</h2>
		{count !== undefined && <span className="bt-count">{pad(count)}</span>}
		{onMore && (
			<button
				type="button"
				className="bt-more"
				aria-haspopup="dialog"
				aria-label={`${TILE_TITLES[section.kind]} 더 보기`}
				onClick={onMore}
			>
				더 보기
				<i className="fa-solid fa-arrow-up-right-and-arrow-down-left-from-center" aria-hidden="true" />
			</button>
		)}
	</header>
);

/** 앞뒤로 넘기는 단추 둘 (자세히 보기 창의 머리) */
const Pager: React.FC<{ index: number; count: number; onMove: (index: number) => void }> = ({
	index,
	count,
	onMove,
}) =>
	count > 1 ? (
		<div className="bt-pager">
			<span className="bt-mono">
				{pad(index + 1)} / {pad(count)}
			</span>
			<button
				type="button"
				className="bt-icon-btn"
				aria-label="이전"
				onClick={() => onMove((index - 1 + count) % count)}
			>
				<i className="fa-solid fa-chevron-left" aria-hidden="true" />
			</button>
			<button type="button" className="bt-icon-btn" aria-label="다음" onClick={() => onMove((index + 1) % count)}>
				<i className="fa-solid fa-chevron-right" aria-hidden="true" />
			</button>
		</div>
	) : null;

/** 항목 하나의 자세한 내용: 아이콘, 설명, 긴 설명, 그림 전부 */
const PointDetail: React.FC<{ point: LandingPoint; index: number }> = ({ point, index }) => (
	<div className="bt-detail">
		<span className="bt-icon" aria-hidden="true">
			<i className={`fa-solid ${iconOf(point, index)}`} />
		</span>
		<p className="bt-detail-body">{point.body}</p>
		{point.detail && <p className="bt-detail-more">{point.detail}</p>}
		{point.media.length > 0 && (
			<div className="bt-detail-media" data-count={Math.min(point.media.length, 2)}>
				{point.media.map((media) => (
					<figure key={media.src} className="bt-frame">
						<Media media={media} />
					</figure>
				))}
			</div>
		)}
	</div>
);

/**
 * 항목 목록 타일 (기능·구현·시작하기): 줄마다 아이콘(시작하기는 번호), 제목, 한 줄 설명. 줄을 누르면 그 항목의 자세히 보기가 열리고
 * 창 안에서 앞뒤로 넘긴다. 창에는 모든 항목을 그려 두고 고른 것만 보인다
 */
const PointsTile: React.FC<{
	section: LandingSection;
	items: LandingPoint[];
	numbered?: boolean;
	iconOffset?: number;
}> = ({ section, items, numbered, iconOffset = 0 }) => {
	const [open, setOpen] = useState<number | null>(null);
	const current = open ?? 0;
	return (
		<>
			<TileHead section={section} count={items.length} onMore={() => setOpen(0)} />
			<ol className="bt-points" data-numbered={numbered ? '' : undefined}>
				{items.map((point, i) => (
					<li key={point.title} data-media={point.media.length ? '' : undefined}>
						<span className="bt-point-mark" aria-hidden="true">
							{numbered ? pad(i + 1) : <i className={`fa-solid ${iconOf(point, i + iconOffset)}`} />}
						</span>
						<div className="bt-point-text">
							<h3>
								<button type="button" aria-haspopup="dialog" onClick={() => setOpen(i)}>
									{point.title}
								</button>
							</h3>
							<p>{point.body}</p>
						</div>
						{point.media.length > 0 && (
							<span className="bt-point-badge" aria-hidden="true">
								<i className="fa-regular fa-image" />
								{point.media.length}
							</span>
						)}
					</li>
				))}
			</ol>
			<Sheet
				open={open !== null}
				onClose={() => setOpen(null)}
				kicker={`${TILE_TITLES[section.kind]} ${pad(current + 1)}`}
				title={items[current].title}
				tools={<Pager index={current} count={items.length} onMove={setOpen} />}
			>
				{items.map((point, i) => (
					<div key={point.title} hidden={i !== current}>
						<PointDetail point={point} index={i + iconOffset} />
					</div>
				))}
			</Sheet>
		</>
	);
};

/** 화면 타일: 넉 장까지 작은 격자, 누르면 그 화면을 크게 */
const ScreensTile: React.FC<{ section: Extract<LandingSection, { kind: 'screens' }> }> = ({ section }) => {
	const [open, setOpen] = useState<number | null>(null);
	const current = open ?? 0;
	const shots = section.shots;
	return (
		<>
			<TileHead section={section} count={shots.length} onMore={() => setOpen(0)} />
			<ul className="bt-shots" data-count={Math.min(shots.length, 4)}>
				{shots.map((shot, i) => (
					<li key={shot.src} hidden={i >= 4 ? true : undefined}>
						<button type="button" aria-haspopup="dialog" onClick={() => setOpen(i)}>
							<Media media={shot} />
							<span className="bt-shot-caption">
								<span className="bt-mono">{pad(i + 1)}</span>
								{shot.caption}
							</span>
						</button>
					</li>
				))}
			</ul>
			<Sheet
				open={open !== null}
				onClose={() => setOpen(null)}
				kicker={TILE_TITLES.screens}
				title={shots[current].caption}
				tools={<Pager index={current} count={shots.length} onMove={setOpen} />}
				wide
			>
				{open !== null && (
					<figure className="bt-frame bt-sheet-shot">
						<Media media={shots[current]} />
					</figure>
				)}
			</Sheet>
		</>
	);
};

/** 사례 타일: 사례 번호를 골라 넘기고, 고른 사례의 문제 → 원인 → 해결 → 결과를 세로 단계로 */
const TroubleTile: React.FC<{ section: Extract<LandingSection, { kind: 'troubleshooting' }> }> = ({ section }) => {
	const [active, setActive] = useState(0);
	const [open, setOpen] = useState(false);
	return (
		<>
			<TileHead section={section} count={section.items.length} onMore={() => setOpen(true)} />
			{section.items.length > 1 && (
				<div className="bt-seg" role="group" aria-label="사례 고르기">
					{section.items.map((item, i) => (
						<button key={item.title} type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
							<FaIcon icon={troubleIcon(item)} />
							<span className="bt-mono">{pad(i + 1)}</span>
						</button>
					))}
				</div>
			)}
			{section.items.map((item, i) => (
				<div key={item.title} className="bt-case" hidden={i !== active}>
					<h3>{item.title}</h3>
					<ol className="bt-stepper">
						{troubleSteps(item).map((step) => (
							<li key={step.key} data-step={step.key}>
								<span className="bt-step-label">{step.label}</span>
								<p>{step.text}</p>
							</li>
						))}
					</ol>
				</div>
			))}
			<Sheet open={open} onClose={() => setOpen(false)} kicker={TILE_TITLES.troubleshooting} title="모든 사례" wide>
				<TroubleList items={section.items} prefix="bt" reveal={false} />
			</Sheet>
		</>
	);
};

/** 열고 닫는 자세히 보기 창 하나를 쓰는 타일의 상태 */
function useSheet() {
	const [open, setOpen] = useState(false);
	return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

const StoriesTile: SectionRenderers['stories'] = ({ section }) => {
	const sheet = useSheet();
	return (
		<>
			<TileHead section={section} count={section.stories.length} onMore={sheet.show} />
			<ul className="bt-rows">
				{section.stories.map((story, i) => (
					<li key={story.title}>
						<span className="bt-mono bt-row-num">{pad(i + 1)}</span>
						<div>
							<h3>{story.title}</h3>
							{story.lead && <p className="bt-clamp">{story.lead}</p>}
						</div>
					</li>
				))}
			</ul>
			<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.stories} title="모든 이야기" wide>
				<div className="bt-stories">
					{section.stories.map((story) => (
						<article key={story.title} className="bt-story" aria-label={story.title}>
							<h4>{story.title}</h4>
							{story.lead && <p className="bt-detail-body">{story.lead}</p>}
							{story.facts.length > 0 && (
								<ul className="bt-story-facts">
									{story.facts.map((fact) => (
										<li key={fact.label}>
											<strong className="bt-mono">{fact.value}</strong>
											<span>{fact.label}</span>
										</li>
									))}
								</ul>
							)}
							{story.points.length > 0 && (
								<ul className="bt-checks">
									{story.points.map((point) => (
										<li key={point.title}>
											<i className="fa-solid fa-check" aria-hidden="true" />
											<div>
												<strong>{point.title}</strong>
												<p>{point.body}</p>
												{point.detail && <p className="bt-detail-more">{point.detail}</p>}
												{point.media.map((media) => (
													<figure key={media.src} className="bt-frame">
														<Media media={media} />
													</figure>
												))}
											</div>
										</li>
									))}
								</ul>
							)}
							{story.image && (
								<figure className="bt-frame">
									<Media media={story.image} />
								</figure>
							)}
						</article>
					))}
				</div>
			</Sheet>
		</>
	);
};

const CONTROLS_SHOWN = 4;

const ControlsTile: SectionRenderers['controls'] = ({ section }) => {
	const sheet = useSheet();
	const rows = (controls: typeof section.controls) => (
		<dl className="bt-keys">
			{controls.map((control) => (
				<div key={control.label}>
					<dt>
						{control.keys.map((key) => (
							<kbd key={key} className="bt-kbd">
								{key}
							</kbd>
						))}
					</dt>
					<dd>{control.label}</dd>
				</div>
			))}
		</dl>
	);
	const more = section.controls.length > CONTROLS_SHOWN;
	return (
		<>
			<TileHead section={section} count={section.controls.length} onMore={more ? sheet.show : undefined} />
			{rows(section.controls.slice(0, CONTROLS_SHOWN))}
			{more && (
				<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.controls} title="모든 단축키">
					{rows(section.controls)}
				</Sheet>
			)}
		</>
	);
};

const TechTile: SectionRenderers['tech'] = ({ section }) => {
	const sheet = useSheet();
	const more = section.specs.length > 0 || Boolean(section.structure);
	return (
		<>
			<TileHead section={section} count={section.stack.length || undefined} onMore={more ? sheet.show : undefined} />
			{section.stack.length > 0 ? (
				<ul className="bt-chips" aria-label="쓴 기술">
					{section.stack.map((item, i) => (
						<li key={item} data-main={i === 0 ? '' : undefined}>
							{item}
						</li>
					))}
				</ul>
			) : (
				<ul className="bt-chips">
					{section.specs.map((spec) => (
						<li key={spec.label}>{spec.label}</li>
					))}
				</ul>
			)}
			{more && (
				<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.tech} title="기술 사양">
					{section.specs.length > 0 && (
						<dl className="bt-table">
							{section.specs.map((spec) => (
								<div key={spec.label}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
					)}
					{section.structure && (
						<figure className="bt-code">
							<figcaption className="bt-label">폴더 구조</figcaption>
							<pre>{section.structure}</pre>
						</figure>
					)}
				</Sheet>
			)}
		</>
	);
};

const TEAM_SHOWN = 4;

const TeamTile: SectionRenderers['team'] = ({ section }) => {
	const sheet = useSheet();
	const { members } = section;
	return (
		<>
			<TileHead section={section} count={members.length} onMore={sheet.show} />
			<span className="bt-faces" aria-hidden="true">
				{members.slice(0, 6).map((member) => (
					<MemberAvatar key={member.name} member={member} className="bt-face" />
				))}
			</span>
			<ul className="bt-people">
				{members.slice(0, TEAM_SHOWN).map((member) => (
					<li key={member.name} data-me={member.me ? '' : undefined}>
						<h3>
							{member.name}
							{member.me && <span className="bt-me">나</span>}
						</h3>
						<p>{member.role}</p>
					</li>
				))}
			</ul>
			<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.team} title="함께 만든 사람">
				<TeamList members={members} prefix="bt" reveal={false} />
			</Sheet>
		</>
	);
};

const ROLE_SHOWN = 3;

const RoleTile: SectionRenderers['role'] = ({ section }) => {
	const sheet = useSheet();
	const more = section.contributions.length > ROLE_SHOWN || Boolean(section.context || section.period);
	return (
		<>
			<TileHead section={section} onMore={more ? sheet.show : undefined} />
			{section.role && <h3 className="bt-role">{section.role}</h3>}
			{section.contributions.length > 0 && (
				<ul className="bt-checks bt-checks-tight">
					{section.contributions.slice(0, ROLE_SHOWN).map((item) => (
						<li key={item}>
							<i className="fa-solid fa-check" aria-hidden="true" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			)}
			{more && (
				<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.role} title={section.role ?? '맡은 일'}>
					{(section.context || section.period) && (
						<dl className="bt-table">
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
						<ul className="bt-checks">
							{section.contributions.map((item) => (
								<li key={item}>
									<i className="fa-solid fa-check" aria-hidden="true" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					)}
				</Sheet>
			)}
		</>
	);
};

const TimelineTile: SectionRenderers['timeline'] = ({ section }) => {
	const sheet = useSheet();
	const { entries } = section;
	const graph = useMemo(() => graphOf(entries.map((entry) => entry.date)), [entries]);
	const latest = entries[entries.length - 1];
	return (
		<>
			<TileHead section={section} count={entries.length} onMore={sheet.show} />
			{graph && <Graph weeks={graph.weeks} />}
			<ol className="bt-dates">
				{entries.slice(graph ? -2 : -3).map((entry) => (
					<li key={`${entry.date}-${entry.label}`} data-latest={entry === latest ? '' : undefined}>
						<time className="bt-mono">{entry.date}</time>
						<span>{entry.label}</span>
					</li>
				))}
			</ol>
			<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.timeline} title="진행 과정 전체">
				<ol className="bt-log">
					{entries.map((entry) => (
						<li key={`${entry.date}-${entry.label}`}>
							<time className="bt-mono">{entry.date}</time>
							<span>{entry.label}</span>
						</li>
					))}
				</ol>
			</Sheet>
		</>
	);
};

const DeploymentsTile: SectionRenderers['deployments'] = ({ section }) => {
	const sheet = useSheet();
	return (
		<>
			<TileHead section={section} count={section.items.length} onMore={sheet.show} />
			<ul className="bt-status">
				{section.items.map((item) => (
					<li key={item.label} data-live={item.url ? '' : undefined}>
						<span className="bt-dot" aria-hidden="true" />
						<FaIcon icon={item.icon} className="bt-status-icon" />
						<h3>
							{item.url ? (
								<a href={item.url} target="_blank" rel="noopener noreferrer">
									{item.label}
								</a>
							) : (
								item.label
							)}
						</h3>
						{item.platform && <span className="bt-status-meta">{item.platform}</span>}
					</li>
				))}
			</ul>
			<Sheet open={sheet.open} onClose={sheet.hide} kicker={TILE_TITLES.deployments} title="배포 결과물" wide>
				<DeployList items={section.items} prefix="bt" reveal={false} />
			</Sheet>
		</>
	);
};

const CreditsTile: SectionRenderers['credits'] = ({ section }) => (
	<>
		<TileHead section={section} count={section.credits.length} />
		<ul className="bt-credits">
			{section.credits.map((credit) => (
				<li key={`${credit.role}-${credit.name}`}>
					<span className="bt-label">{credit.role}</span>
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
					<span className="bt-credit-by">
						{credit.by}
						{credit.note && <span className="bt-credit-note"> · {credit.note}</span>}
					</span>
				</li>
			))}
		</ul>
	</>
);

const RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<TileHead section={section} />
			<ul className="bt-stats" data-count={Math.min(section.facts.length, 4)}>
				{section.facts.map((fact) => (
					<li key={fact.label}>
						<strong className="bt-mono">{fact.value}</strong>
						<span>{fact.label}</span>
						<Spark seed={fact.label} />
					</li>
				))}
			</ul>
		</>
	),
	features: ({ section }) => <PointsTile section={section} items={section.items} />,
	screens: ({ section }) => <ScreensTile section={section} />,
	steps: ({ section }) => <PointsTile section={section} items={section.items} numbered />,
	built: ({ section }) => <PointsTile section={section} items={section.items} iconOffset={3} />,
	troubleshooting: ({ section }) => <TroubleTile section={section} />,
	stories: StoriesTile,
	controls: ControlsTile,
	tech: TechTile,
	team: TeamTile,
	role: RoleTile,
	timeline: TimelineTile,
	deployments: DeploymentsTile,
	credits: CreditsTile,
};

/** 대표 화면 타일: 누르면 크게 */
const ShotTile: React.FC<{ media: LandingMedia; name: string; style: React.CSSProperties }> = ({
	media,
	name,
	style,
}) => {
	const sheet = useSheet();
	return (
		<figure className="bt-tile bt-shot" style={style} data-reveal="">
			<button type="button" className="bt-shot-open" aria-haspopup="dialog" onClick={sheet.show}>
				<Media media={media} eager />
				<span className="bt-shot-zoom">
					<i className="fa-solid fa-expand" aria-hidden="true" />
					크게 보기
				</span>
			</button>
			<Sheet open={sheet.open} onClose={sheet.hide} kicker="대표 화면" title={name} wide>
				{sheet.open && (
					<figure className="bt-frame bt-sheet-shot">
						<Media media={media} />
					</figure>
				)}
			</Sheet>
		</figure>
	);
};

const BentoPage: React.FC<{ project: Project }> = ({ project }) => {
	const landing = useLanding(project);
	const root = useReveal<HTMLDivElement>();
	const accent = bentoAccent(useLandingAccent(project.icon));
	const { hero, closing, sections } = landing;
	const board = useMemo(
		() => boardOf({ shot: Boolean(hero.image), sections: sections.map((section) => section.kind) }),
		[hero.image, sections]
	);
	const place = (id: string) => {
		const p = board.get(id);
		return p ? placementStyle(p) : undefined;
	};
	const meta = [
		hero.meta.role && { label: '역할', value: hero.meta.role },
		hero.meta.period && { label: '기간', value: hero.meta.period },
	].filter((item): item is { label: string; value: string } => Boolean(item));

	return (
		<div ref={root} className="tpl tpl-bento" style={accent}>
			<div className="bt-board">
				<header className="bt-tile bt-hero" style={place('hero')} data-reveal="">
					<p className="bt-brand">
						{hero.icon && <img className="bt-brand-icon" src={hero.icon} alt="" />}
						{hero.logo ? <img className="bt-logo" src={hero.logo} alt={hero.name} /> : <span>{hero.name}</span>}
						{hero.meta.context && <span className="bt-tag">{hero.meta.context}</span>}
					</p>
					<h1>{hero.headline}</h1>
					{hero.subhead && <p className="bt-subhead">{hero.subhead}</p>}
					<BentoLinks links={hero.links} />
					{meta.length > 0 && (
						<dl className="bt-hero-meta">
							{meta.map((item) => (
								<div key={item.label}>
									<dt className="bt-label">{item.label}</dt>
									<dd>{item.value}</dd>
								</div>
							))}
						</dl>
					)}
				</header>
				{hero.image && <ShotTile media={hero.image} name={hero.name} style={place('shot') ?? {}} />}
				{sections.map((section, index) => {
					const Render = RENDERERS[section.kind] as React.FC<{
						section: LandingSection;
						landing: typeof landing;
						index: number;
					}>;
					return (
						<section
							key={section.kind}
							aria-label={section.label}
							data-section={section.kind}
							className="bt-tile"
							style={place(section.kind)}
							data-reveal=""
						>
							<Render section={section} landing={landing} index={index} />
						</section>
					);
				})}
				<footer className="bt-tile bt-closing" style={place('closing')} data-reveal="">
					<div>
						{closing.lead && <p className="bt-label">{closing.lead}</p>}
						<h2>{closing.title}</h2>
					</div>
					<BentoLinks links={closing.links} />
				</footer>
			</div>
		</div>
	);
};

export default BentoPage;

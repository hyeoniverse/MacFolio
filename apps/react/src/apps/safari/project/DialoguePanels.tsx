// RPG 대화창(DialoguePage)의 무대 그림판: 주제마다 고전 게임 화면 하나 (타이틀, 퀘스트, 스킬 트리, 전투, 파티, 장비, 상태, 월드 맵, 보물, 기록...).
// 무대는 480×270 게임 화면(DialoguePage.css) 안의 위쪽 칸이고, 크기는 모두 게임 화면의 칸(px) 단위다. 주제마다 큰 그림 하나(몬스터, 사람, 상자, 길...)를
// 가운데에 두고, 글은 짧게(지금 항목과 그 이웃만) 둔다. 자세한 글은 대화 상자에 있으므로 그림판은 꾸밈(aria-hidden)이고,
// 보물 상자의 링크만 실제로 누르고 읽을 수 있다. 틀은 무대에 그리지 않는다 (상자 안의 상자가 되지 않게)
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { PROFILE } from '@/shared/profile';
import { Favicon } from '@/apps/safari/project/parts';
import { deploymentIcon, faClass, iconOf, type TroubleStepKey } from '@/apps/safari/project/landing/content';
import {
	battleHp,
	CHEST_CLOSED,
	CHEST_OPEN,
	letterOf,
	monsterOf,
	PERSON,
	personColors,
	pixelRuns,
	slotIcon,
	splitScore,
	statusStats,
	techIcon,
	troubleKeys,
	windowAround,
} from '@/apps/safari/project/dialogueStage';
import '@/apps/safari/project/DialoguePanels.css';

/** 그림판이 짚을 곳: 주제 id, 그 주제 데이터의 몇 번째 항목인지, 트러블슈팅이면 단계 */
export interface PanelFocus {
	topic: string;
	item?: number;
	step?: TroubleStepKey;
}

/** side: 그림 액자 옆의 좁은 자리 (큰 그림 하나만 남기고 목록은 접는다) */
type PanelProps = { project: Project; focus: PanelFocus; side?: boolean };

/** 칸 그림: 한 칸을 scale 칸(게임 화면의 px)으로 키운 사각형들. 가장자리를 흐리지 않는다 */
const Pixels: React.FC<{
	rows: readonly string[];
	className: string;
	scale: number;
	colors?: Record<string, string>;
}> = ({ rows, className, scale, colors }) => {
	const w = rows[0]?.length ?? 16;
	const h = rows.length;
	return (
		<svg
			className={className}
			width={w * scale}
			height={h * scale}
			viewBox={`0 0 ${w} ${h}`}
			shapeRendering="crispEdges"
			aria-hidden="true"
			focusable="false"
		>
			{pixelRuns(rows, colors).map((run) => (
				<rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.color} />
			))}
		</svg>
	);
};

/** 사람 하나: 이름으로 정한 색의 16×24 픽셀 사람 */
const Person: React.FC<{ name: string; scale: number; className?: string }> = ({ name, scale, className }) => (
	<Pixels rows={PERSON} colors={personColors(name)} scale={scale} className={className ?? 'dlp-person'} />
);

/** 그림판: 머리줄(노란 이름, 오른쪽 회색 셈) 한 줄과 본문. 틀은 없다 */
const Panel: React.FC<{
	kind: string;
	title: string;
	count?: string;
	side?: boolean;
	interactive?: boolean;
	children: React.ReactNode;
}> = ({ kind, title, count, side, interactive, children }) => (
	<div className="dlp" data-panel={kind} data-side={side || undefined} aria-hidden={interactive ? undefined : 'true'}>
		<header className="dlp-head" aria-hidden="true">
			<b>{title}</b>
			{count && <span>{count}</span>}
		</header>
		<div className="dlp-body">{children}</div>
	</div>
);

/** 항목의 상태: 지난 것, 지금, 아직 */
const stateOf = (i: number, at: number) => (at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo');

/** 기술 칸 하나: 아는 기술은 브랜드 아이콘, 아니면 첫 글자 */
const TechIcon: React.FC<{ name: string }> = ({ name }) => {
	const icon = techIcon(name);
	return <span className="dlp-tech">{icon ? <i className={`fa-brands ${icon}`} /> : <b>{letterOf(name)}</b>}</span>;
};

/** 프로젝트의 얼굴: sproutfarm은 게임의 픽셀 캐릭터, 나머지는 아이콘 */
const ProjectFace: React.FC<{ project: Project }> = ({ project }) =>
	project.id === 'sproutfarm' ? <i className="dl-sprite" /> : <Favicon project={project} className="dl-sign-icon" />;

// ─── 타이틀 화면: 큰 아이콘, 큰 이름, PRESS Z. 인사, 링크, 선택지의 링크·돌아가기, 엔딩(앨범이 없을 때) ───
export const TitleScreen: React.FC<{ project: Project; side?: boolean; end?: boolean }> = ({ project, side, end }) => {
	const stack = project.stack.filter((s) => s.trim());
	const team = project.team ?? [];
	const meta = [
		team.length > 0 ? `파티 ${team.length}명` : '',
		stack.length > 0 ? `기술 ${stack.length}개` : '',
		project.period ?? '',
	].filter(Boolean);
	return (
		<div className="dlp dlp-title" data-panel="title" data-side={side || undefined} aria-hidden="true">
			<span className="dlp-title-face">
				<ProjectFace project={project} />
			</span>
			<strong className="dlp-title-name">{project.name}</strong>
			<p className="dlp-press">{end ? 'THE END' : '▶ PRESS Z'}</p>
			{meta.length > 0 && <p className="dlp-title-meta">{meta.join('  ·  ')}</p>}
		</div>
	);
};

// ─── 퀘스트 목록: 주요 기능, 장(chapter)의 항목. 왼쪽에 지금 퀘스트의 큰 아이콘, 오른쪽에 이웃 몇 줄 ───
const QuestLog: React.FC<PanelProps & { points: ProjectPoint[]; title: string }> = ({ points, focus, side, title }) => {
	const at = focus.item ?? -1;
	const shown = at >= 0 ? at : 0;
	const [start, end] = windowAround(points.length, shown, 5);
	const point = points[shown];
	return (
		<Panel
			kind="quests"
			title={title}
			count={at >= 0 ? `${at + 1} / ${points.length}` : `${points.length}개`}
			side={side}
		>
			<div className="dlp-quest">
				{point && (
					<div className="dlp-hero">
						<i className={`fa-solid ${iconOf(point, shown)}`} />
						<small>QUEST {shown + 1}</small>
					</div>
				)}
				<ol className="dlp-list">
					{points.slice(start, end).map((p, k) => {
						const i = start + k;
						const state = stateOf(i, at);
						return (
							<li key={i} data-state={state}>
								<span className="dlp-mark">{state === 'now' ? '♥' : state === 'done' ? '✓' : '·'}</span>
								<span className="dlp-text">{p.title}</span>
							</li>
						);
					})}
				</ol>
			</div>
		</Panel>
	);
};

// ─── 스킬 트리(구현 방법)와 튜토리얼(쓰는 법): 큰 아이콘 칸들을 줄로 잇는다 ───
const NodeRow: React.FC<PanelProps & { points: ProjectPoint[]; kind: 'tree' | 'steps' }> = ({
	project,
	points,
	focus,
	side,
	kind,
}) => {
	const at = focus.item ?? -1;
	const shown = at >= 0 ? at : 0;
	const [start, end] = side ? [shown, shown + 1] : windowAround(points.length, shown, kind === 'tree' ? 4 : 5);
	return (
		<Panel
			kind={kind === 'tree' ? 'skills' : 'tutorial'}
			title={kind === 'tree' ? 'SKILL TREE' : 'TUTORIAL'}
			count={at >= 0 ? `${at + 1} / ${points.length}` : `${points.length}개`}
			side={side}
		>
			<ol className="dlp-nodes" data-kind={kind}>
				{kind === 'tree' && !side && (
					<li className="dlp-root" data-state="done">
						<span className="dlp-node-icon">
							<Favicon project={project} className="dlp-root-icon" />
						</span>
						<span className="dlp-node-name">구현</span>
					</li>
				)}
				{points.slice(start, end).map((p, k) => {
					const i = start + k;
					return (
						<li key={i} data-state={stateOf(i, at)}>
							<span className="dlp-mark">{i === at ? '♥' : ''}</span>
							<span className="dlp-node-icon">
								<i className={`fa-solid ${iconOf(p, i)}`} />
							</span>
							<span className="dlp-node-name">
								<small>{kind === 'steps' ? `STEP ${i + 1}` : `SKILL ${i + 1}`}</small>
								{p.title}
							</span>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
};

// ─── 전투: 트러블슈팅 한 건이 버그 몬스터 하나. 문제(등장) → 원인(살피기) → 해결(싸우기) → 결과(쓰러뜨림) ───
/** 언더테일의 아래 줄처럼 네 칸 (꾸밈): 원인을 살필 때는 '살피기', 해결할 때는 '싸우기'에 하트가 온다 */
const BATTLE_MENU: { label: string; icon: string; on?: TroubleStepKey }[] = [
	{ label: '싸우기', icon: 'fa-hand-fist', on: 'solution' },
	{ label: '살피기', icon: 'fa-magnifying-glass', on: 'cause' },
	{ label: '아이템', icon: 'fa-bag-shopping' },
	{ label: '자비', icon: 'fa-xmark' },
];

const Battle: React.FC<PanelProps> = ({ project, focus, side }) => {
	const items = project.troubleshooting ?? [];
	const at = Math.min(Math.max(0, focus.item ?? 0), items.length - 1);
	const item = items[at];
	if (!item) return null;
	const steps = troubleKeys(item);
	const step = focus.step ?? steps[0];
	const hp = battleHp(steps, step);
	const defeated = hp === 0;
	return (
		<Panel kind="troubleshooting" title="BATTLE" count={`버그 ${at + 1} / ${items.length}`} side={side}>
			<div className="dlp-battle" data-step={step}>
				<div className="dlp-arena" data-defeated={defeated || undefined}>
					<Pixels rows={monsterOf(at)} scale={side ? 2 : 3} className="dlp-monster" />
				</div>
				<div className="dlp-hp" data-hp={hp}>
					<b className="dlp-foe-name">{item.title}</b>
					<em>HP</em>
					<span className="dlp-hp-track">
						<i style={{ width: `${hp}%` }} />
					</span>
					<span className="dlp-hp-num">{hp}</span>
				</div>
				{!side && (
					<ul className="dlp-battle-menu">
						{BATTLE_MENU.map((entry) => {
							const on = entry.on === step;
							return (
								<li key={entry.label} data-on={on || undefined}>
									{on ? <span className="dlp-heart">♥</span> : <i className={`fa-solid ${entry.icon}`} />}
									{entry.label}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</Panel>
	);
};

// ─── 파티: 팀원이 픽셀 사람으로 한 줄에 선다. 지금 사람 위에 ♥, 나는 ★ 나 (사진은 대화 상자의 얼굴 칸에) ───
const Party: React.FC<PanelProps> = ({ project, focus, side }) => {
	const team = project.team ?? [];
	const at = focus.item ?? -1;
	const [start, end] = side
		? windowAround(team.length, Math.max(0, at), 3)
		: windowAround(team.length, Math.max(0, at), 6);
	return (
		<Panel kind="team" title="PARTY" count={`${team.length}명`} side={side}>
			<ul className="dlp-party" style={{ ['--n' as string]: end - start }}>
				{team.slice(start, end).map((member, k) => {
					const i = start + k;
					return (
						<li key={member.name} data-state={stateOf(i, at)} data-me={member.me || undefined}>
							<span className="dlp-mark">{i === at ? '♥' : ''}</span>
							<Person name={member.name} scale={side ? 2 : 3} />
							<b className="dlp-member">{member.name}</b>
							{member.me && <em className="dlp-me">★ 나</em>}
						</li>
					);
				})}
			</ul>
		</Panel>
	);
};

// ─── 장비: 사양은 장착한 장비 칸(큰 아이콘), 쓴 기술은 가방(작은 아이콘 줄) ───
const Equipment: React.FC<PanelProps> = ({ project, focus, side }) => {
	const specs = project.specs;
	const stack = project.stack.filter((s) => s.trim());
	const at = focus.item ?? -1;
	const bag = at >= specs.length && stack.length > 0;
	const [start, end] = side
		? windowAround(specs.length, Math.max(0, at), 3)
		: windowAround(specs.length, Math.max(0, at), 6);
	return (
		<Panel kind="specs" title="EQUIP" count={`장비 ${specs.length} · 가방 ${stack.length}`} side={side}>
			<div className="dlp-equip" data-focus={bag ? 'bag' : 'slots'}>
				{specs.length > 0 && (
					<ol className="dlp-slots" style={{ ['--n' as string]: end - start }}>
						{specs.slice(start, end).map((spec, k) => {
							const i = start + k;
							const slot = slotIcon(spec.label, spec.value);
							return (
								<li key={spec.label} data-state={bag ? 'todo' : stateOf(i, at)}>
									<span className="dlp-slot-icon">
										<i className={`${slot.brand ? 'fa-brands' : 'fa-solid'} ${slot.icon}`} />
									</span>
									<span className="dlp-slot-name">{spec.label}</span>
								</li>
							);
						})}
					</ol>
				)}
				{stack.length > 0 && (
					<div className="dlp-bag" data-on={bag || undefined}>
						<span className="dlp-mark">{bag ? '♥' : ''}</span>
						<small>가방</small>
						<span className="dlp-techs">
							{stack.slice(0, side ? 5 : 12).map((name) => (
								<TechIcon key={name} name={name} />
							))}
						</span>
					</div>
				)}
			</div>
		</Panel>
	);
};

// ─── 상태: 왼쪽에 큰 픽셀 초상, 오른쪽에 이름·직업과 데이터에서 센 능력치 (특기는 맡은 일) ───
const Status: React.FC<PanelProps> = ({ project, focus, side }) => {
	const me = project.team?.find((m) => m.me);
	const name = me?.name ?? PROFILE.name;
	const role = project.role ?? me?.role;
	// 대사의 첫 장이 맡은 역할이면 그 장은 -1, 맡은 일은 0부터
	const at = focus.item ?? -2;
	const stats = statusStats(project);
	const list = project.contributions;
	return (
		<Panel kind="contributions" title="STATUS" side={side}>
			<div className="dlp-status">
				<div className="dlp-portrait">
					<Person name={name} scale={side ? 2 : 4} />
				</div>
				<div className="dlp-sheet">
					<b className="dlp-sheet-name">{name}</b>
					{role && (
						<p className="dlp-role" data-now={at === -1 || undefined}>
							<small>직업</small>
							<span>{role}</span>
						</p>
					)}
					{stats.length > 0 && (
						<dl className="dlp-stats">
							{stats.slice(0, side ? 2 : 6).map((stat) => (
								<div key={stat.label}>
									<dt>{stat.label}</dt>
									<dd>{stat.value}</dd>
								</div>
							))}
						</dl>
					)}
					{list.length > 0 && (
						<p className="dlp-skill" data-now={at >= 0 || undefined}>
							<span className="dlp-mark">{at >= 0 ? '♥' : '✦'}</span>
							<small>특기</small>
							<span>{at >= 0 ? `${at + 1} / ${list.length}` : `${list.length}가지`}</span>
						</p>
					)}
				</div>
			</div>
		</Panel>
	);
};

// ─── 월드 맵: 진행 과정의 날짜를 굽은 길 위의 칸으로. 지금 칸 위에 내가 서 있다 ───
/** 지도 칸의 자리(게임 화면 px): 폭에 고르게, 한 줄 길 위에 */
function mapPoints(count: number, width: number): { x: number; y: number }[] {
	const pad = 28;
	const step = count > 1 ? (width - pad * 2) / (count - 1) : 0;
	return Array.from({ length: count }, (_, i) => ({
		x: Math.round(count > 1 ? pad + step * i : width / 2),
		y: 50,
	}));
}

const WorldMap: React.FC<PanelProps> = ({ project, focus, side }) => {
	const nodes = project.timeline ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(nodes.length, Math.max(0, at), side ? 3 : 6);
	const width = side ? 184 : 448;
	const shown = nodes.slice(start, end);
	const points = mapPoints(shown.length, width);
	const me = project.team?.find((m) => m.me)?.name ?? PROFILE.name;
	return (
		<Panel
			kind="timeline"
			title="WORLD MAP"
			count={at >= 0 ? `${at + 1} / ${nodes.length}` : `${nodes.length}곳`}
			side={side}
		>
			<div className="dlp-map" style={{ width }}>
				<svg className="dlp-path" width={width} height={100} viewBox={`0 0 ${width} 100`} aria-hidden="true">
					<polyline
						points={points.map((p) => `${p.x},${p.y}`).join(' ')}
						fill="none"
						stroke="#8c8c8c"
						strokeWidth={2}
						strokeDasharray="4 4"
						shapeRendering="crispEdges"
					/>
				</svg>
				<ol>
					{shown.map((node, k) => {
						const i = start + k;
						const p = points[k];
						return (
							<li key={i} data-state={stateOf(i, at)} style={{ left: p.x, top: p.y }}>
								{i === Math.max(0, at) && <Person name={me} scale={1} className="dlp-walker" />}
								<span className="dlp-node" />
								{i !== Math.max(0, at) && (
									<small className="dlp-flag">{i === 0 ? 'START' : i === nodes.length - 1 ? 'GOAL' : ''}</small>
								)}
								<span className="dlp-date">{node.date}</span>
							</li>
						);
					})}
				</ol>
			</div>
		</Panel>
	);
};

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// ─── 보물: 배포 결과물. 지금 상자는 크게 열리고 결과물의 아이콘이 튀어나온다. 오른쪽 목록의 링크는 실제로 누를 수 있다 ───
const Treasure: React.FC<PanelProps> = ({ project, focus, side }) => {
	const items = project.deployments ?? [];
	const at = focus.item ?? -1;
	const current = items[Math.max(0, at)];
	const open = at >= 0;
	return (
		<Panel kind="deployments" title="TREASURE" count={`${items.length}개`} side={side} interactive>
			<div className="dlp-treasure">
				{current && (
					<div className="dlp-chest-big" aria-hidden="true" data-open={open || undefined}>
						{open && (
							<span className="dlp-loot">
								<i className={faClass(deploymentIcon(current.platform, current.url))} />
							</span>
						)}
						<Pixels rows={open ? CHEST_OPEN : CHEST_CLOSED} scale={side ? 3 : 4} className="dlp-chest" />
					</div>
				)}
				<ul className="dlp-chests">
					{items.map((item, i) => {
						const state = stateOf(i, at);
						return (
							<li key={item.label} data-state={state}>
								<span className="dlp-mark" aria-hidden="true">
									{state === 'now' ? '♥' : state === 'done' ? '✓' : '·'}
								</span>
								<b>{item.label}</b>
								{item.url ? (
									<a href={item.url} target="_blank" rel="noopener noreferrer">
										<span aria-hidden="true">▶ </span>
										{hostOf(item.url)}
										<span className="visually-hidden"> ({item.label}, 새 탭에서 열기)</span>
									</a>
								) : (
									<span className="dlp-soon">링크 준비 중</span>
								)}
							</li>
						);
					})}
				</ul>
			</div>
		</Panel>
	);
};

// ─── 기록: 지금 숫자를 오락실 점수처럼 크게, 아래에 순위표 ───
const Scoreboard: React.FC<PanelProps> = ({ project, focus, side }) => {
	const facts = project.facts;
	const at = focus.item ?? -1;
	const shown = Math.max(0, at);
	const [start, end] = windowAround(facts.length, shown, 4);
	const current = facts[shown];
	const parts = current ? splitScore(current.value) : null;
	return (
		<Panel kind="facts" title="HIGH SCORE" count={`${facts.length}개`} side={side}>
			<div className="dlp-score">
				{current && (
					<div className="dlp-score-big">
						<strong>
							{parts ? (
								<>
									{parts.lead && <span>{parts.lead}</span>}
									<b>{parts.num}</b>
									{parts.tail && <span>{parts.tail}</span>}
								</>
							) : (
								<b>{current.value}</b>
							)}
						</strong>
						<small>{current.label}</small>
					</div>
				)}
				{!side && (
					<ol className="dlp-ranks">
						{facts.slice(start, end).map((fact, k) => {
							const i = start + k;
							return (
								<li key={fact.label} data-state={stateOf(i, at)}>
									<small>{String(i + 1).padStart(2, '0')}</small>
									<b>{fact.value}</b>
									<span>{fact.label}</span>
								</li>
							);
						})}
					</ol>
				)}
			</div>
		</Panel>
	);
};

// ─── 조작법: 픽셀 키 모양과 하는 일 ───
const Controls: React.FC<PanelProps> = ({ project, focus, side }) => {
	const list = project.controls ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(list.length, Math.max(0, at), side ? 3 : 5);
	return (
		<Panel kind="controls" title="CONTROLS" count={`${list.length}개`} side={side}>
			<ol className="dlp-keys">
				{list.slice(start, end).map((control, k) => {
					const i = start + k;
					return (
						<li key={control.label} data-state={stateOf(i, at)}>
							<span className="dlp-mark">{i === at ? '♥' : ''}</span>
							<span className="dlp-caps">
								{control.keys.map((key) => (
									<kbd key={key}>{key}</kbd>
								))}
							</span>
							<span className="dlp-text">{control.label}</span>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
};

// ─── 크레딧: 맡은 부분, 이름, 만든 사람을 가운데 줄로 ───
const Credits: React.FC<PanelProps> = ({ project, focus, side }) => {
	const list = project.credits ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(list.length, Math.max(0, at), side ? 1 : 3);
	return (
		<Panel kind="credits" title="CREDITS" count={`${list.length}개`} side={side}>
			<ol className="dlp-roll">
				{list.slice(start, end).map((credit, k) => {
					const i = start + k;
					return (
						<li key={credit.name} data-state={stateOf(i, at)}>
							<small>{credit.role}</small>
							<span>
								<b>{credit.name}</b> <span>by {credit.by}</span>
							</span>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
};

/** 주제의 그림판. 그릴 것이 없는 주제(화면 모음, 링크 등)는 타이틀 화면 */
export const TopicPanel: React.FC<PanelProps> = (props) => {
	const { project, focus, side } = props;
	const chapter = /^chapter-(\d+)$/.exec(focus.topic);
	if (chapter) {
		const data = project.chapters?.[Number(chapter[1])];
		if (data && data.points.length > 0) return <QuestLog {...props} points={data.points} title={data.title} />;
	}
	switch (focus.topic) {
		case 'highlights':
			return <QuestLog {...props} points={project.highlights} title="QUEST LOG" />;
		case 'build':
			return <NodeRow {...props} points={project.build} kind="tree" />;
		case 'usage':
			return <NodeRow {...props} points={project.usage ?? []} kind="steps" />;
		case 'troubleshooting':
			return <Battle {...props} />;
		case 'team':
			return <Party {...props} />;
		case 'specs':
			return <Equipment {...props} />;
		case 'contributions':
			return <Status {...props} />;
		case 'timeline':
			return <WorldMap {...props} />;
		case 'deployments':
			return <Treasure {...props} />;
		case 'facts':
			return <Scoreboard {...props} />;
		case 'controls':
			return <Controls {...props} />;
		case 'credits':
			return <Credits {...props} />;
		default:
			return <TitleScreen project={project} side={side} />;
	}
};

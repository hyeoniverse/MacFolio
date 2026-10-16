// RPG 대화창(DialoguePage)의 무대 그림판: 주제마다 고전 게임 화면 하나 (타이틀, 퀘스트, 스킬 트리, 전투, 파티, 장비, 상태, 월드 맵, 보물, 기록...).
// 그림은 데이터로만 그리고, 대사가 지금 말하는 항목(item)을 노랗게 짚는다. 같은 글은 대화 상자에 있으므로 그림판은 꾸밈(aria-hidden)이고,
// 보물 상자의 링크만 실제로 누르고 읽을 수 있다
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { PROFILE } from '@/shared/profile';
import { Favicon } from '@/apps/safari/project/parts';
import {
	deploymentIcon,
	faClass,
	iconOf,
	initialsOf,
	type TroubleStepKey,
} from '@/apps/safari/project/landing/content';
import {
	battleHp,
	CHEST_CLOSED,
	CHEST_OPEN,
	letterOf,
	monsterOf,
	pixelRuns,
	rowsFor,
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

/** room: 무대의 높이(px). 목록이 길면 이 높이에 들어가는 만큼만 지금 항목 둘레로 보인다 */
type PanelProps = { project: Project; focus: PanelFocus; side?: boolean; room?: number };

/** 칸 그림 (16칸 격자): 사각형만, 가장자리를 흐리지 않는다 */
const Pixels: React.FC<{ rows: readonly string[]; className: string }> = ({ rows, className }) => (
	<svg
		className={className}
		viewBox={`0 0 ${rows[0]?.length ?? 16} ${rows.length}`}
		shapeRendering="crispEdges"
		aria-hidden="true"
		focusable="false"
	>
		{pixelRuns(rows).map((run) => (
			<rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.color} />
		))}
	</svg>
);

/** 그림판 틀: 흰 테두리 창 하나와 머리줄(이름, 영어 이름, 오른쪽 셈) */
const Panel: React.FC<{
	kind: string;
	title: string;
	en: string;
	count?: string;
	side?: boolean;
	interactive?: boolean;
	children: React.ReactNode;
}> = ({ kind, title, en, count, side, interactive, children }) => (
	<div className="dlp" data-panel={kind} data-side={side || undefined} aria-hidden={interactive ? undefined : 'true'}>
		<header className="dlp-head" aria-hidden="true">
			<b>{title}</b>
			<small>{en}</small>
			{count && <span>{count}</span>}
		</header>
		<div className="dlp-body">{children}</div>
	</div>
);

/** 항목의 상태: 지난 것, 지금, 아직 */
const stateOf = (i: number, at: number) => (at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo');

/** 기술 칸 하나: 아는 기술은 브랜드 아이콘, 아니면 첫 글자 */
const TechTile: React.FC<{ name: string; named?: boolean }> = ({ name, named }) => {
	const icon = techIcon(name);
	return (
		<li className="dlp-tech">
			<span className="dlp-tech-icon">{icon ? <i className={`fa-brands ${icon}`} /> : <b>{letterOf(name)}</b>}</span>
			{named && <span className="dlp-tech-name">{name}</span>}
		</li>
	);
};

/** 프로젝트의 얼굴: sproutfarm은 게임의 픽셀 캐릭터, 나머지는 아이콘 */
const ProjectFace: React.FC<{ project: Project }> = ({ project }) =>
	project.id === 'sproutfarm' ? <i className="dl-sprite" /> : <Favicon project={project} className="dl-sign-icon" />;

/** 지금 항목의 자세한 칸: 아이콘, 제목, 짧은 설명 */
const Detail: React.FC<{ icon: string; title: string; body: string; label?: string }> = ({
	icon,
	title,
	body,
	label,
}) => (
	<div className="dlp-detail">
		<span className="dlp-icon">
			<i className={`fa-solid ${icon}`} />
		</span>
		<div>
			{label && <small>{label}</small>}
			<b>{title}</b>
			<p>{body}</p>
		</div>
	</div>
);

// ─── 타이틀 화면: 인사, 링크, 선택지의 링크·돌아가기, 엔딩(앨범이 없을 때) ───
export const TitleScreen: React.FC<{ project: Project; side?: boolean; end?: boolean }> = ({ project, side, end }) => {
	const stack = project.stack.filter((s) => s.trim());
	const team = project.team ?? [];
	return (
		<div className="dlp dlp-title" data-panel="title" data-side={side || undefined} aria-hidden="true">
			<span className="dlp-title-face">
				<ProjectFace project={project} />
			</span>
			<strong className="dlp-title-name">{project.name}</strong>
			<p className="dlp-press">{end ? 'THE END' : '▶ PRESS Z'}</p>
			<p className="dlp-title-meta">
				{team.length > 0 && (
					<span>
						<i className="dlp-heart">♥</i> 파티 {team.length}명
					</span>
				)}
				{stack.length > 0 && <span>기술 {stack.length}개</span>}
				{project.period && <span>{project.period}</span>}
			</p>
			{stack.length > 0 && (
				<ul className="dlp-techs">
					{stack.slice(0, 8).map((name) => (
						<TechTile key={name} name={name} />
					))}
				</ul>
			)}
		</div>
	);
};

// ─── 퀘스트 목록: 주요 기능, 장(chapter)의 항목 ───
const QuestLog: React.FC<PanelProps & { points: ProjectPoint[]; title: string; en: string }> = ({
	points,
	focus,
	side,
	room,
	title,
	en,
}) => {
	const at = focus.item ?? -1;
	const [start, end] = windowAround(points.length, Math.max(0, at), rowsFor(room, 32, 76, side ? 5 : 7));
	const shown = at >= 0 ? at : 0;
	const point = points[shown];
	return (
		<Panel
			kind="quests"
			title={title}
			en={en}
			count={at >= 0 ? `${at + 1} / ${points.length}` : `${points.length}개`}
			side={side}
		>
			<div className="dlp-quest">
				<ol className="dlp-list">
					{points.slice(start, end).map((p, k) => {
						const i = start + k;
						const state = stateOf(i, at);
						return (
							<li key={i} data-state={state}>
								<span className="dlp-mark">{state === 'now' ? '♥' : state === 'done' ? '✓' : ''}</span>
								<span className="dlp-text">{p.title}</span>
							</li>
						);
					})}
				</ol>
				{point && <Detail icon={iconOf(point, shown)} title={point.title} body={point.body} />}
			</div>
		</Panel>
	);
};

// ─── 스킬 트리(구현 방법)와 튜토리얼(쓰는 법): 칸들을 줄로 잇는다 ───
const NodeRow: React.FC<PanelProps & { points: ProjectPoint[]; kind: 'tree' | 'steps' }> = ({
	project,
	points,
	focus,
	side,
	kind,
}) => {
	const at = focus.item ?? -1;
	const [start, end] = windowAround(points.length, Math.max(0, at), 6);
	const shown = at >= 0 ? at : 0;
	const point = points[shown];
	return (
		<Panel
			kind={kind === 'tree' ? 'skills' : 'tutorial'}
			title={kind === 'tree' ? '스킬 트리' : '튜토리얼'}
			en={kind === 'tree' ? 'SKILL TREE' : 'TUTORIAL'}
			count={at >= 0 ? `${at + 1} / ${points.length}` : `${points.length}개`}
			side={side}
		>
			<div className="dlp-tree" data-kind={kind}>
				{kind === 'tree' && (
					<div className="dlp-root">
						<span className="dlp-node-icon">
							<Favicon project={project} className="dlp-root-icon" />
						</span>
						<small>구현</small>
					</div>
				)}
				<ol className="dlp-nodes" style={{ ['--n' as string]: end - start }}>
					{points.slice(start, end).map((p, k) => {
						const i = start + k;
						return (
							<li key={i} data-state={stateOf(i, at)}>
								<span className="dlp-node-icon">
									<i className={`fa-solid ${iconOf(p, i)}`} />
								</span>
								<span className="dlp-node-name">
									{kind === 'steps' && <small>STEP {i + 1}</small>}
									{p.title}
								</span>
							</li>
						);
					})}
				</ol>
			</div>
			{point && (
				<Detail
					icon={iconOf(point, shown)}
					title={point.title}
					body={point.body}
					label={kind === 'tree' ? `스킬 ${shown + 1}` : `STEP ${shown + 1}`}
				/>
			)}
		</Panel>
	);
};

// ─── 전투: 트러블슈팅 한 건이 버그 몬스터 하나. 문제(등장) → 원인(약점) → 해결(기술) → 결과(쓰러뜨림) ───
const BATTLE_LOG: Record<TroubleStepKey, string> = {
	problem: '* 문제 발생! 버그가 나타났다.',
	cause: '* 원인을 살폈다. 약점을 찾았다!',
	solution: '* 해결책을 썼다. 효과는 굉장했다!',
	result: '* 버그를 물리쳤다!',
};
/** 전투 메뉴 (꾸밈): 원인을 살필 때는 '살피기', 해결할 때는 '싸우기'에 하트가 온다 */
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
	const upTo = steps.indexOf(step);
	const defeated = hp === 0;
	return (
		<Panel kind="troubleshooting" title="전투" en="BATTLE" count={`버그 ${at + 1} / ${items.length}`} side={side}>
			<div className="dlp-battle">
				<ul className="dlp-foes">
					{items.map((foe, i) => (
						<li key={foe.title} data-state={i < at ? 'done' : i === at ? 'now' : 'todo'}>
							<Pixels rows={monsterOf(i)} className="dlp-foe-mini" />
						</li>
					))}
				</ul>
				<div className="dlp-arena" data-defeated={defeated || undefined} data-step={step}>
					<Pixels rows={monsterOf(at)} className="dlp-monster" />
					<b className="dlp-foe-name">{item.title}</b>
					<div className="dlp-hp" data-hp={hp}>
						<em>HP</em>
						<span className="dlp-hp-track">
							<i style={{ width: `${hp}%` }} />
						</span>
						<span className="dlp-hp-num">{hp} / 100</span>
					</div>
				</div>
				<ol className="dlp-log">
					{steps.slice(0, upTo + 1).map((key) => (
						<li key={key} data-now={key === step || undefined}>
							{key === 'result' ? `${BATTLE_LOG.result} 해결한 문제 ${at + 1}/${items.length}` : BATTLE_LOG[key]}
						</li>
					))}
				</ol>
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
			</div>
		</Panel>
	);
};

// ─── 파티: 팀원 카드. 사진이 없으면 첫 글자 칸, 나는 ★ 나 ───
const Party: React.FC<PanelProps> = ({ project, focus, side, room }) => {
	const team = project.team ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(team.length, Math.max(0, at), side ? rowsFor(room, 60, 76, 5) : 4);
	return (
		<Panel kind="team" title="파티" en="PARTY" count={`${team.length}명`} side={side}>
			<ul className="dlp-party" style={{ ['--n' as string]: end - start }}>
				{team.slice(start, end).map((member, k) => {
					const i = start + k;
					return (
						<li key={member.name} data-state={stateOf(i, at)} data-me={member.me || undefined}>
							<span className="dlp-mark">{i === at ? '♥' : ''}</span>
							<span className="dlp-avatar" data-tone={i % 3}>
								{member.avatar ? <img src={member.avatar} alt="" /> : <b>{initialsOf(member.name)}</b>}
							</span>
							<span className="dlp-member">
								<b>
									{member.name}
									{member.me && <em className="dlp-me">★ 나</em>}
								</b>
								<small>직업</small>
								<span className="dlp-role">{member.role}</span>
							</span>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
};

// ─── 장비: 사양은 장착한 장비 칸, 쓴 기술은 가방 ───
const Equipment: React.FC<PanelProps> = ({ project, focus, side, room }) => {
	const specs = project.specs;
	const stack = project.stack.filter((s) => s.trim());
	const at = focus.item ?? -1;
	const bag = at >= specs.length && stack.length > 0;
	const row = side ? 44 : room && room <= 420 ? 36 : 48;
	const [start, end] = windowAround(specs.length, Math.max(0, at), rowsFor(room, row, 76, 6));
	return (
		<Panel kind="specs" title="장비" en="EQUIPMENT" count={`장비 ${specs.length} · 가방 ${stack.length}`} side={side}>
			<div className="dlp-equip" data-focus={bag ? 'bag' : 'slots'}>
				{specs.length > 0 && (
					<section className="dlp-slots">
						<h4>장착 · 기술 사양</h4>
						<ol>
							{specs.slice(start, end).map((spec, k) => {
								const i = start + k;
								const slot = slotIcon(spec.label, spec.value);
								return (
									<li key={spec.label} data-state={bag ? 'todo' : stateOf(i, at)}>
										<span className="dlp-slot-icon">
											<i className={`${slot.brand ? 'fa-brands' : 'fa-solid'} ${slot.icon}`} />
										</span>
										<small>{spec.label}</small>
										<span className="dlp-text">{spec.value}</span>
									</li>
								);
							})}
						</ol>
					</section>
				)}
				{stack.length > 0 && (
					<section className="dlp-bag" data-on={bag || undefined}>
						<h4>가방 · 쓴 기술 {stack.length}개</h4>
						<ul className="dlp-techs" data-named="">
							{stack.map((name) => (
								<TechTile key={name} name={name} named />
							))}
						</ul>
					</section>
				)}
			</div>
		</Panel>
	);
};

// ─── 상태: 캐릭터 시트. 직업은 맡은 역할, 능력치는 데이터에서 센 숫자, 특기는 맡은 일 ───
const Status: React.FC<PanelProps> = ({ project, focus, side, room }) => {
	const me = project.team?.find((m) => m.me);
	const name = me?.name ?? PROFILE.name;
	const role = project.role ?? me?.role;
	// 대사의 첫 장이 맡은 역할이면 그 장은 -1, 맡은 일은 0부터
	const at = focus.item ?? -2;
	const stats = statusStats(project);
	const list = project.contributions;
	// 좁은 창은 시트 아래에 특기가 붙는다 (시트 높이만큼 더 뺀다)
	const [start, end] = windowAround(list.length, Math.max(0, at), rowsFor(room, 26, side ? 180 : 100, 6));
	return (
		<Panel kind="contributions" title="상태" en="STATUS" side={side}>
			<div className="dlp-status">
				<div className="dlp-sheet" data-now={at === -1 || undefined}>
					<span className="dlp-avatar" data-tone={0}>
						{me?.avatar ? <img src={me.avatar} alt="" /> : <b>{initialsOf(name)}</b>}
					</span>
					<div>
						<b className="dlp-sheet-name">{name}</b>
						{role && (
							<p>
								<small>직업</small>
								<span className="dlp-role">{role}</span>
							</p>
						)}
					</div>
				</div>
				{stats.length > 0 && (
					<dl className="dlp-stats">
						{stats.map((stat) => (
							<div key={stat.label}>
								<dt>{stat.label}</dt>
								<dd>{stat.value}</dd>
							</div>
						))}
					</dl>
				)}
				{list.length > 0 && (
					<section className="dlp-abilities">
						<h4>특기 · 맡은 일</h4>
						<ol className="dlp-list">
							{list.slice(start, end).map((text, k) => {
								const i = start + k;
								const state = stateOf(i, at);
								return (
									<li key={i} data-state={state}>
										<span className="dlp-mark">{state === 'now' ? '♥' : '✦'}</span>
										<span className="dlp-text">{text}</span>
									</li>
								);
							})}
						</ol>
					</section>
				)}
			</div>
		</Panel>
	);
};

// ─── 월드 맵: 진행 과정의 날짜를 길 위의 칸으로. 지금 칸이 깜빡인다 ───
const WorldMap: React.FC<PanelProps> = ({ project, focus, side, room }) => {
	const nodes = project.timeline ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(nodes.length, Math.max(0, at), side ? rowsFor(room, 32, 150, 5) : 7);
	const here = nodes[at >= 0 ? at : 0];
	return (
		<Panel kind="timeline" title="월드 맵" en="WORLD MAP" count={`${nodes.length}곳`} side={side}>
			<ol className="dlp-map" style={{ ['--n' as string]: end - start }}>
				{nodes.slice(start, end).map((node, k) => {
					const i = start + k;
					return (
						<li key={i} data-state={stateOf(i, at)}>
							<small className="dlp-flag">{i === 0 ? 'START' : i === nodes.length - 1 ? 'GOAL' : ''}</small>
							<span className="dlp-node" />
							<span className="dlp-date">{node.date}</span>
						</li>
					);
				})}
			</ol>
			{here && (
				<div className="dlp-here">
					<small>{at >= 0 ? `현재 위치 · STAGE ${at + 1}` : 'STAGE 1'}</small>
					<b>{here.label}</b>
				</div>
			)}
		</Panel>
	);
};

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// ─── 보물: 배포 결과물. 열어 본 상자는 열린 그림, 링크는 실제로 누를 수 있다 ───
const Treasure: React.FC<PanelProps> = ({ project, focus, side }) => {
	const items = project.deployments ?? [];
	const at = focus.item ?? -1;
	return (
		<Panel kind="deployments" title="보물" en="TREASURE" count={`${items.length}개`} side={side} interactive>
			<ul className="dlp-chests" style={{ ['--n' as string]: Math.min(items.length, 4) }}>
				{items.map((item, i) => {
					const state = stateOf(i, at);
					return (
						<li key={item.label} data-state={state}>
							<span className="dlp-mark" aria-hidden="true">
								{state === 'now' ? '♥' : ''}
							</span>
							<Pixels rows={state === 'todo' ? CHEST_CLOSED : CHEST_OPEN} className="dlp-chest" />
							<span className="dlp-plat" aria-hidden="true">
								<i className={faClass(deploymentIcon(item.platform, item.url))} />
								{item.platform}
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
		</Panel>
	);
};

// ─── 기록: 숫자를 오락실 점수판처럼 크게 ───
const Scoreboard: React.FC<PanelProps> = ({ project, focus, side }) => {
	const facts = project.facts;
	const at = focus.item ?? -1;
	return (
		<Panel kind="facts" title="기록" en="SCORE" count={`${facts.length}개`} side={side}>
			<ol className="dlp-scores" style={{ ['--n' as string]: Math.min(facts.length, 4) }}>
				{facts.map((fact, i) => {
					const parts = splitScore(fact.value);
					return (
						<li key={fact.label} data-state={stateOf(i, at)}>
							<small>{String(i + 1).padStart(2, '0')}</small>
							<strong>
								{parts ? (
									<>
										{parts.lead && <span>{parts.lead}</span>}
										<b>{parts.num}</b>
										{parts.tail && <span>{parts.tail}</span>}
									</>
								) : (
									<b>{fact.value}</b>
								)}
							</strong>
							<p>{fact.label}</p>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
};

// ─── 조작법: 키 모양 칸 ───
const Controls: React.FC<PanelProps> = ({ project, focus, side }) => {
	const list = project.controls ?? [];
	const at = focus.item ?? -1;
	return (
		<Panel kind="controls" title="조작법" en="CONTROLS" count={`${list.length}개`} side={side}>
			<ol className="dlp-keys">
				{list.map((control, i) => (
					<li key={control.label} data-state={stateOf(i, at)}>
						<span className="dlp-caps">
							{control.keys.map((key) => (
								<kbd key={key}>{key}</kbd>
							))}
						</span>
						<span className="dlp-text">{control.label}</span>
					</li>
				))}
			</ol>
		</Panel>
	);
};

// ─── 크레딧: 맡은 부분, 이름, 만든 사람을 가운데 줄로 ───
const Credits: React.FC<PanelProps> = ({ project, focus, side }) => {
	const list = project.credits ?? [];
	const at = focus.item ?? -1;
	const [start, end] = windowAround(list.length, Math.max(0, at), side ? 2 : 3);
	return (
		<Panel kind="credits" title="크레딧" en="CREDITS" count={`${list.length}개`} side={side}>
			<ol className="dlp-roll">
				{list.slice(start, end).map((credit, k) => {
					const i = start + k;
					return (
						<li key={credit.name} data-state={stateOf(i, at)}>
							<small>{credit.role}</small>
							<b>{credit.name}</b>
							<span>by {credit.by}</span>
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
		if (data && data.points.length > 0)
			return <QuestLog {...props} points={data.points} title={data.title} en={`CHAPTER ${Number(chapter[1]) + 1}`} />;
	}
	switch (focus.topic) {
		case 'highlights':
			return <QuestLog {...props} points={project.highlights} title="퀘스트" en="QUEST LOG" />;
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

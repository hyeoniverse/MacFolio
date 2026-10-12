// 그림이 없을 때 프로젝트 데이터로 그리는 제품 화면: 앱 이름·아이콘이 있는 상단 바, 주요 기능을 메뉴로 한 사이드바,
// 숫자(facts)로 그린 그래프, 항목 제목의 목록. 글은 모두 프로젝트 데이터에서 오고, 나머지는 글 없는 UI 모양(막대·점·아이콘)이다
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { useLandingAccent } from './accent';
import {
	hashString,
	iconOf,
	initialOf,
	mockPoints,
	mockSeries,
	parseTree,
	pickMockKind,
	seriesPath,
	shortName,
	type MockKind,
} from './mock';
import './landing.css';
import './mock.css';

export interface MockScreenProps {
	project: Project;
	/** 화면 종류 (기본: pickMockKind(project)) */
	kind?: MockKind;
	/** 사이드바에서 고른 항목(주요 기능의 차례). 본문 제목이 그 항목이 된다 */
	focus?: number;
	/** 화면 색: light 밝은 앱, dark 어두운 앱 (기본: game은 dark, 나머지는 페이지 테마) */
	tone?: 'light' | 'dark';
	/** 아이콘에서 뽑은 색으로 칠한다 (기본 켬. 끄면 바깥의 --lk-accent) */
	tint?: boolean;
	/** 장식으로만 쓴다 (보조 기술에 숨김. 히어로의 큰 그림 등). 아니면 '○○ 화면 예시'라는 그림 */
	decorative?: boolean;
	className?: string;
	style?: React.CSSProperties;
}

const Icon: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
	<i className={`fa-solid ${name}${className ? ` ${className}` : ''}`} />
);

/** 글 없는 자리 표시 막대 (폭은 0~100) */
const Sk: React.FC<{ w: number; className?: string }> = ({ w, className }) => (
	<span className={`lk-sk${className ? ` ${className}` : ''}`} style={cssVars({ w: `${w}%` })} />
);

/** 앱 아이콘: 그림이 있으면 그림, 없으면 이름 첫 글자 타일 */
const AppIcon: React.FC<{ project: Project; className?: string }> = ({ project, className = 'lk-mock-appicon' }) =>
	project.icon ? (
		<img className={className} src={project.icon} alt="" />
	) : (
		<span className={`${className} lk-mock-initial`}>{initialOf(shortName(project))}</span>
	);

/** 차례에 따라 도는 색 (강조색·둘째 색·초록·주황) */
const dotOf = (i: number) => (['a', 'b', 'c', 'd'] as const)[i % 4];

/** 0~1 값의 작은 막대 그래프 */
const MiniBars: React.FC<{ seed: string; n?: number }> = ({ seed, n = 8 }) => (
	<span className="lk-mock-minibars">
		{mockSeries(seed, n).map((v, i) => (
			<i key={i} style={cssVars({ v })} />
		))}
	</span>
);

/** 면을 칠한 꺾은선 그래프 (SVG). 씨앗이 같으면 늘 같은 모양 */
const AreaChart: React.FC<{ seed: string; n?: number }> = ({ seed, n = 14 }) => {
	const values = mockSeries(seed, n);
	const id = `lk-grad${React.useId().replace(/:/g, '')}`;
	return (
		<svg className="lk-mock-chart" viewBox="0 0 300 100" preserveAspectRatio="none">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" className="lk-mock-stop-top" />
					<stop offset="1" className="lk-mock-stop-bottom" />
				</linearGradient>
			</defs>
			{[25, 50, 75].map((y) => (
				<line key={y} x1="0" x2="300" y1={y} y2={y} className="lk-mock-gridline" />
			))}
			<path d={seriesPath(values, 300, 92, true)} fill={`url(#${id})`} transform="translate(0 8)" />
			<path d={seriesPath(values, 300, 92)} className="lk-mock-line" transform="translate(0 8)" pathLength={1} />
		</svg>
	);
};

const Bar: React.FC<{ project: Project; search?: boolean }> = ({ project, search = true }) => (
	<div className="lk-mock-bar">
		<AppIcon project={project} />
		<b className="lk-mock-appname">{shortName(project)}</b>
		{search && (
			<span className="lk-mock-search">
				<Icon name="fa-magnifying-glass" />
				<Sk w={46} />
			</span>
		)}
		<span className="lk-mock-spacer" />
		<span className="lk-mock-iconbtn">
			<Icon name="fa-bell" />
		</span>
		<span className="lk-mock-avatar" data-dot="b" />
	</div>
);

/** 사이드바 메뉴: 항목 제목(아이콘과 함께). 모자라면 글 없는 자리 표시로 채운다 */
const SideNav: React.FC<{ points: ProjectPoint[]; active: number; min?: number }> = ({ points, active, min = 5 }) => (
	<>
		{points.map((point, i) => (
			<span key={`${point.title}-${i}`} className="lk-mock-nav" data-active={i === active ? '' : undefined}>
				<Icon name={iconOf(point, i)} />
				<span className="lk-mock-ellipsis">{point.title}</span>
			</span>
		))}
		{Array.from({ length: Math.max(0, min - points.length) }, (_, i) => (
			<span key={`sk-${i}`} className="lk-mock-nav">
				<span className="lk-mock-navdot" />
				<Sk w={50 + ((i * 17) % 35)} />
			</span>
		))}
	</>
);

const Tags: React.FC<{ stack: string[] }> = ({ stack }) =>
	stack.length === 0 ? null : (
		<>
			<span className="lk-mock-side-sep" />
			{stack.slice(0, 3).map((item, i) => (
				<span key={item} className="lk-mock-tag">
					<span className="lk-mock-dot" data-dot={dotOf(i)} />
					<span className="lk-mock-ellipsis">{item}</span>
				</span>
			))}
		</>
	);

/* ─── 종류마다 본문 ─── */

const Dashboard: React.FC<{ project: Project; active: number }> = ({ project, active }) => {
	const nav = project.highlights.slice(0, 6);
	const main = nav[active] ?? mockPoints(project)[0];
	const facts = project.facts.slice(0, 3);
	const rows = mockPoints(project)
		.filter((point) => point !== main)
		.slice(0, 4);
	const chartFact = project.facts[0];
	return (
		<>
			<Bar project={project} />
			<div className="lk-mock-body">
				<aside className="lk-mock-side">
					<SideNav points={nav} active={active} />
					<Tags stack={project.stack} />
				</aside>
				<div className="lk-mock-main">
					<div className="lk-mock-head">
						<div className="lk-mock-head-text">
							{main ? <b className="lk-mock-title">{main.title}</b> : <Sk w={40} className="lk-sk-lg" />}
							{main?.body ? <span className="lk-mock-sub lk-mock-ellipsis">{main.body}</span> : <Sk w={60} />}
						</div>
						<span className="lk-mock-iconbtn lk-mock-ghost">
							<Icon name="fa-sliders" />
						</span>
						<span className="lk-mock-primary">
							<Icon name="fa-plus" />
						</span>
					</div>
					<div className="lk-mock-stats" data-count={Math.max(facts.length, 3)}>
						{(facts.length ? facts : [null, null, null]).map((fact, i) => (
							<div key={i} className="lk-mock-card lk-mock-stat">
								{fact ? <span className="lk-mock-label lk-mock-ellipsis">{fact.label}</span> : <Sk w={50} />}
								{fact ? <b className="lk-mock-value">{fact.value}</b> : <Sk w={35} className="lk-sk-lg" />}
								<MiniBars seed={`${project.id}-${fact?.label ?? i}`} />
							</div>
						))}
					</div>
					<div className="lk-mock-split">
						<div className="lk-mock-card lk-mock-chartcard">
							<div className="lk-mock-cardhead">
								{chartFact ? (
									<>
										<span className="lk-mock-label lk-mock-ellipsis">{chartFact.label}</span>
										<b className="lk-mock-value">{chartFact.value}</b>
									</>
								) : (
									<Sk w={40} />
								)}
								<span className="lk-mock-spacer" />
								<span className="lk-mock-seg">
									<i data-on="" />
									<i />
									<i />
								</span>
							</div>
							<AreaChart seed={`${project.id}-${chartFact?.value ?? project.name}`} />
						</div>
						<div className="lk-mock-card lk-mock-feed">
							{rows.map((point, i) => (
								<div key={`${point.title}-${i}`} className="lk-mock-feedrow">
									<span className="lk-mock-tile" data-dot={dotOf(i + 1)}>
										<Icon name={iconOf(point, i + 1)} />
									</span>
									<span className="lk-mock-feedtext">
										<span className="lk-mock-ellipsis">{point.title}</span>
										<span
											className="lk-mock-progress"
											style={cssVars({ v: 0.35 + (hashString(point.title) % 60) / 100 })}
										/>
									</span>
								</div>
							))}
							{rows.length === 0 &&
								[0, 1, 2].map((i) => (
									<div key={i} className="lk-mock-feedrow">
										<span className="lk-mock-tile" data-dot={dotOf(i)} />
										<Sk w={70 - i * 10} />
									</div>
								))}
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

const List: React.FC<{ project: Project; active: number }> = ({ project, active }) => {
	const nav = project.highlights.slice(0, 6);
	const rows = mockPoints(project).slice(0, 7);
	const stack = project.stack;
	return (
		<>
			<Bar project={project} />
			<div className="lk-mock-body">
				<aside className="lk-mock-side">
					<SideNav points={nav} active={active} />
					<Tags stack={stack} />
				</aside>
				<div className="lk-mock-main">
					<div className="lk-mock-head">
						<div className="lk-mock-head-text">
							{nav[active] ? <b className="lk-mock-title">{nav[active].title}</b> : <Sk w={40} className="lk-sk-lg" />}
						</div>
						<span className="lk-mock-primary">
							<Icon name="fa-plus" />
						</span>
					</div>
					{stack.length > 0 && (
						<div className="lk-mock-chips">
							{stack.slice(0, 4).map((item, i) => (
								<span key={item} className="lk-mock-chip" data-on={i === 0 ? '' : undefined}>
									{item}
								</span>
							))}
						</div>
					)}
					<div className="lk-mock-card lk-mock-rows">
						{rows.map((point, i) => {
							const done = hashString(point.title) % 3 === 0;
							return (
								<div key={`${point.title}-${i}`} className="lk-mock-row" data-done={done ? '' : undefined}>
									<span className="lk-mock-check">{done && <Icon name="fa-check" />}</span>
									<span className="lk-mock-rowtext">
										<span className="lk-mock-ellipsis lk-mock-rowtitle">{point.title}</span>
										{point.body && <span className="lk-mock-ellipsis lk-mock-sub">{point.body}</span>}
									</span>
									{stack.length > 0 && (
										<span className="lk-mock-chip" data-dot={dotOf(i)}>
											{stack[i % stack.length]}
										</span>
									)}
									<span className="lk-mock-avatar" data-dot={dotOf(i + 1)} />
								</div>
							);
						})}
						{rows.length === 0 &&
							[0, 1, 2, 3].map((i) => (
								<div key={i} className="lk-mock-row">
									<span className="lk-mock-check" />
									<Sk w={60 - i * 8} />
								</div>
							))}
					</div>
				</div>
			</div>
		</>
	);
};

const Chat: React.FC<{ project: Project; active: number }> = ({ project, active }) => {
	const points = mockPoints(project);
	const threads = points.slice(0, 7);
	const start = Math.min(active, Math.max(0, points.length - 1));
	const pairs = points.slice(start, start + 2);
	return (
		<>
			<Bar project={project} />
			<div className="lk-mock-body">
				<aside className="lk-mock-side lk-mock-threads">
					{threads.map((point, i) => (
						<span key={`${point.title}-${i}`} className="lk-mock-thread" data-active={i === active ? '' : undefined}>
							<span className="lk-mock-tile" data-dot={dotOf(i)}>
								<Icon name={iconOf(point, i)} />
							</span>
							<span className="lk-mock-rowtext">
								<span className="lk-mock-ellipsis lk-mock-rowtitle">{point.title}</span>
								<span className="lk-mock-ellipsis lk-mock-sub">{point.body}</span>
							</span>
						</span>
					))}
					{threads.length === 0 &&
						[0, 1, 2, 3].map((i) => (
							<span key={i} className="lk-mock-thread">
								<span className="lk-mock-tile" data-dot={dotOf(i)} />
								<Sk w={60} />
							</span>
						))}
				</aside>
				<div className="lk-mock-main lk-mock-conv">
					<div className="lk-mock-convhead">
						<AppIcon project={project} className="lk-mock-appicon lk-mock-appicon-sm" />
						<b className="lk-mock-ellipsis">{threads[active]?.title ?? shortName(project)}</b>
						<span className="lk-mock-spacer" />
						<span className="lk-mock-iconbtn">
							<Icon name="fa-ellipsis" />
						</span>
					</div>
					<div className="lk-mock-messages">
						{pairs.map((point, i) => (
							<React.Fragment key={`${point.title}-${i}`}>
								<span className="lk-mock-bubble" data-me="">
									{point.title}
								</span>
								{point.body && (
									<span className="lk-mock-bubble">
										<AppIcon project={project} className="lk-mock-appicon lk-mock-appicon-xs" />
										<span className="lk-mock-clamp">{point.body}</span>
									</span>
								)}
							</React.Fragment>
						))}
						<span className="lk-mock-bubble lk-mock-typing" aria-hidden="true">
							<i />
							<i />
							<i />
						</span>
					</div>
					<div className="lk-mock-composer">
						<Icon name="fa-paperclip" />
						<Sk w={40} />
						<span className="lk-mock-spacer" />
						<span className="lk-mock-primary lk-mock-round">
							<Icon name="fa-arrow-up" />
						</span>
					</div>
				</div>
			</div>
		</>
	);
};

const Editor: React.FC<{ project: Project; active: number }> = ({ project, active }) => {
	const tree = parseTree(project.structure).slice(0, 11);
	const pages = project.highlights.slice(0, 6);
	const doc = pages[active] ?? mockPoints(project)[0];
	const rest = mockPoints(project).filter((point) => point !== doc);
	const bullets = rest.slice(0, 3);
	const next = rest[3];
	return (
		<>
			<Bar project={project} search={false} />
			<div className="lk-mock-body">
				<aside className="lk-mock-side lk-mock-tree">
					{tree.length > 0
						? tree.map((row, i) => (
								<span
									key={`${row.name}-${i}`}
									className="lk-mock-nav lk-mock-file"
									style={cssVars({ depth: row.depth })}
									data-active={i === Math.min(2, tree.length - 1) ? '' : undefined}
								>
									<Icon name={row.name.endsWith('/') ? 'fa-folder' : 'fa-file-lines'} />
									<span className="lk-mock-ellipsis">{row.name}</span>
								</span>
							))
						: pages.map((point, i) => (
								<span key={`${point.title}-${i}`} className="lk-mock-nav" data-active={i === active ? '' : undefined}>
									<Icon name="fa-file-lines" />
									<span className="lk-mock-ellipsis">{point.title}</span>
								</span>
							))}
				</aside>
				<div className="lk-mock-main lk-mock-editor">
					<div className="lk-mock-toolbar">
						{['fa-bold', 'fa-italic', 'fa-heading', 'fa-list-ul', 'fa-link', 'fa-image'].map((name) => (
							<span key={name} className="lk-mock-tool">
								<Icon name={name} />
							</span>
						))}
						<span className="lk-mock-spacer" />
						<span className="lk-mock-people">
							<span className="lk-mock-avatar" data-dot="a" />
							<span className="lk-mock-avatar" data-dot="b" />
							<span className="lk-mock-avatar" data-dot="c" />
						</span>
						<span className="lk-mock-primary">
							<Icon name="fa-share-nodes" />
						</span>
					</div>
					<div className="lk-mock-doc">
						{doc ? <b className="lk-mock-doctitle">{doc.title}</b> : <Sk w={50} className="lk-sk-lg" />}
						{doc?.body && <p className="lk-mock-docp">{doc.body}</p>}
						{project.tagline && (
							<span className="lk-mock-callout">
								<Icon name="fa-lightbulb" />
								<span className="lk-mock-ellipsis">{project.tagline}</span>
							</span>
						)}
						<ul className="lk-mock-bullets">
							{bullets.map((point, i) => (
								<li key={`${point.title}-${i}`}>
									<span className="lk-mock-ellipsis">{point.title}</span>
								</li>
							))}
						</ul>
						<span className="lk-mock-embed">
							<AppIcon project={project} className="lk-mock-appicon lk-mock-embed-icon" />
						</span>
						{next && <b className="lk-mock-dochead">{next.title}</b>}
						{next?.body && <p className="lk-mock-docp">{next.body}</p>}
						<span className="lk-mock-docline">
							<Sk w={72} />
							<span className="lk-mock-caret" data-dot="b" />
						</span>
					</div>
				</div>
			</div>
		</>
	);
};

const Mobile: React.FC<{ project: Project; active: number }> = ({ project, active }) => {
	const fact = project.facts[0];
	const tiles = project.facts.slice(1, 3);
	const rows = mockPoints(project).slice(0, 5);
	const tabs = project.highlights.slice(0, 4);
	return (
		<>
			<div className="lk-mock-status">
				<b>9:41</b>
				<span className="lk-mock-spacer" />
				<Icon name="fa-signal" />
				<Icon name="fa-wifi" />
				<Icon name="fa-battery-full" />
			</div>
			<div className="lk-mock-phone">
				<div className="lk-mock-phonehead">
					<b className="lk-mock-largetitle lk-mock-ellipsis">{shortName(project)}</b>
					<AppIcon project={project} className="lk-mock-appicon lk-mock-appicon-sm" />
				</div>
				<div className="lk-mock-herocard">
					{fact ? (
						<>
							<span className="lk-mock-ellipsis">{fact.label}</span>
							<b>{fact.value}</b>
						</>
					) : (
						<Sk w={50} className="lk-sk-lg" />
					)}
					<AreaChart seed={`${project.id}-${fact?.value ?? project.name}`} n={10} />
				</div>
				{tiles.length > 0 && (
					<div className="lk-mock-tiles">
						{tiles.map((item, i) => (
							<div key={item.label} className="lk-mock-card lk-mock-minitile">
								<span className="lk-mock-dot" data-dot={dotOf(i + 1)} />
								<b className="lk-mock-value">{item.value}</b>
								<span className="lk-mock-label lk-mock-ellipsis">{item.label}</span>
							</div>
						))}
					</div>
				)}
				<div className="lk-mock-card lk-mock-rows">
					{rows.map((point, i) => (
						<div key={`${point.title}-${i}`} className="lk-mock-row">
							<span className="lk-mock-tile" data-dot={dotOf(i)}>
								<Icon name={iconOf(point, i)} />
							</span>
							<span className="lk-mock-rowtext">
								<span className="lk-mock-ellipsis lk-mock-rowtitle">{point.title}</span>
								<span className="lk-mock-ellipsis lk-mock-sub">{point.body}</span>
							</span>
							<Icon name="fa-chevron-right" className="lk-mock-chev" />
						</div>
					))}
				</div>
			</div>
			<div className="lk-mock-tabbar">
				{(tabs.length ? tabs : [undefined, undefined, undefined, undefined]).map((point, i) => (
					<span key={i} className="lk-mock-tab" data-active={i === active % Math.max(1, tabs.length) ? '' : undefined}>
						<Icon name={iconOf(point, i)} />
					</span>
				))}
			</div>
			<span className="lk-mock-homebar" />
		</>
	);
};

const Game: React.FC<{ project: Project }> = ({ project }) => {
	const facts = project.facts.slice(0, 3);
	const controls = project.controls?.slice(0, 4) ?? [];
	const seed = hashString(project.name);
	return (
		<>
			<div className="lk-mock-hud">
				<AppIcon project={project} className="lk-mock-appicon lk-mock-appicon-sm" />
				<b className="lk-mock-ellipsis">{shortName(project)}</b>
				<span className="lk-mock-spacer" />
				{facts.map((fact) => (
					<span key={fact.label} className="lk-mock-hudstat">
						<b>{fact.value}</b>
						<span className="lk-mock-ellipsis">{fact.label}</span>
					</span>
				))}
			</div>
			<div className="lk-mock-scene" style={cssVars({ s: seed % 7 })}>
				<span className="lk-mock-sun" />
				<span className="lk-mock-stars" />
				<span className="lk-mock-hill lk-mock-hill-far" />
				<span className="lk-mock-hill lk-mock-hill-near" />
				<span className="lk-mock-ground" />
				<span className="lk-mock-platform" style={cssVars({ x: 18, y: 38, w: 16 })} />
				<span className="lk-mock-platform" style={cssVars({ x: 50, y: 46, w: 20 })} />
				{[0, 1, 2, 3].map((i) => (
					<span key={i} className="lk-mock-coin" style={cssVars({ x: 53 + i * 4.5, y: 56, i })} />
				))}
				<span className="lk-mock-player" />
				<span className="lk-mock-enemy" />
			</div>
			<div className="lk-mock-controls">
				{controls.length > 0
					? controls.map((control) => (
							<span key={control.label} className="lk-mock-control">
								{control.keys.slice(0, 2).map((key) => (
									<kbd key={key}>{key}</kbd>
								))}
								<span className="lk-mock-ellipsis">{control.label}</span>
							</span>
						))
					: project.stack.slice(0, 4).map((item) => (
							<span key={item} className="lk-mock-control">
								<span className="lk-mock-ellipsis">{item}</span>
							</span>
						))}
			</div>
		</>
	);
};

/**
 * 프로젝트 데이터로 그린 제품 화면. 들어 있는 상자를 꽉 채우고(DeviceFrame 안), 홀로 쓰면 16:10(mobile은 9:19.5).
 * 글자 크기는 화면 폭에 비례해 줄고 늘어 스크린샷처럼 보인다
 */
export const MockScreen: React.FC<MockScreenProps> = ({
	project,
	kind,
	focus = 0,
	tone,
	tint = true,
	decorative = false,
	className,
	style,
}) => {
	const accent = useLandingAccent(tint ? project.icon : undefined);
	const type = kind ?? pickMockKind(project);
	const count = Math.max(1, Math.min(project.highlights.length, 6));
	const active = ((focus % count) + count) % count;
	const resolvedTone = tone ?? (type === 'game' ? 'dark' : undefined);
	return (
		<div
			className={`lk-root lk-mock${className ? ` ${className}` : ''}`}
			data-kind={type}
			data-lk-tone={resolvedTone}
			style={{ ...accent, ...style }}
			{...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${shortName(project)} 화면 예시` })}
		>
			<div className="lk-mock-ui">
				{type === 'dashboard' && <Dashboard project={project} active={active} />}
				{type === 'list' && <List project={project} active={active} />}
				{type === 'chat' && <Chat project={project} active={active} />}
				{type === 'editor' && <Editor project={project} active={active} />}
				{type === 'mobile' && <Mobile project={project} active={active} />}
				{type === 'game' && <Game project={project} />}
			</div>
		</div>
	);
};

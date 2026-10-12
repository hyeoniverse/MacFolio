// checklist 모양: 페이지가 할 일 앱 화면이다. 항목을 체크하면 '읽음'이 '완료'로 쌓이고, 설명과 그림이 그 아래로 펼쳐진다.
// 진행 과정과 맡은 일은 이미 끝낸 일이라 체크된 채로 시작하고 진행 고리에는 세지 않는다
import React, { useMemo, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Favicon, Links, Region } from '@/apps/safari/project/parts';
import { useReveal } from '@/apps/safari/project/reveal';
import { FeatureMedia } from '@/apps/safari/project/CreativeParts';
import {
	CtaBand,
	DeviceFrame,
	MockScreen,
	SectionHeader,
	iconOf,
	useLandingAccent,
} from '@/apps/safari/project/landing';
import '@/apps/safari/project/ChecklistPage.css';

/** 목록 하나의 항목: 제목, 한 줄 설명, 펼치면 보일 것 */
interface Item {
	key: string;
	title: string;
	body?: string;
	/** 날짜 라벨 (진행 과정) */
	date?: string;
	point?: ProjectPoint;
}

/** 목록: 라벨 색, 이미 끝낸 일인지 */
interface List {
	key: string;
	label: string;
	tone: 'red' | 'orange' | 'blue' | 'green' | 'purple' | 'teal' | 'gray';
	done?: boolean;
	/** 목록 이름 아래의 한두 줄 메모 (장 머리말) */
	note?: string;
	items: Item[];
}

const fromPoints = (prefix: string, points: ProjectPoint[] | undefined): Item[] =>
	(points ?? []).map((point, i) => ({ key: `${prefix}-${i}`, title: point.title, body: point.body, point }));

/** 프로젝트 데이터를 할 일 목록들로. 비어 있는 목록은 뺀다 (어떤 프로젝트든 이 모양을 고를 수 있다) */
function buildLists(project: Project): List[] {
	const intro: Item[] = [
		{ key: 'intro-desc', title: '무엇을 만들었나', body: project.description },
		{ key: 'intro-context', title: '어떤 프로젝트인가', body: project.context },
		...(project.role ? [{ key: 'intro-role', title: '맡은 역할', body: project.role }] : []),
		...(project.period ? [{ key: 'intro-period', title: '개발 기간', body: project.period }] : []),
		...project.facts.map((fact, i) => ({ key: `fact-${i}`, title: fact.value, body: fact.label })),
	];
	const lists: List[] = [
		{ key: 'intro', label: '소개', tone: 'red', items: intro },
		{ key: 'highlights', label: '주요 기능', tone: 'orange', items: fromPoints('hl', project.highlights) },
		{ key: 'build', label: '만든 방식', tone: 'blue', items: fromPoints('build', project.build) },
		{ key: 'usage', label: '쓰는 법', tone: 'green', items: fromPoints('usage', project.usage) },
		...(project.chapters ?? []).map<List>((chapter, i) => ({
			key: `chapter-${i}`,
			label: chapter.title,
			tone: i % 2 ? 'teal' : 'purple',
			note: chapter.lead,
			items: fromPoints(`ch${i}`, chapter.points),
		})),
		{
			key: 'specs',
			label: '기술 사양',
			tone: 'gray',
			items: [
				...project.specs.map((spec, i) => ({ key: `spec-${i}`, title: spec.label, body: spec.value })),
				...(project.language ? [{ key: 'spec-language', title: '주 언어', body: project.language }] : []),
				...(project.stack.length ? [{ key: 'spec-stack', title: '쓴 기술', body: project.stack.join(', ') }] : []),
			],
		},
		{
			key: 'timeline',
			label: '진행 과정',
			tone: 'blue',
			done: true,
			items: (project.timeline ?? []).map((step, i) => ({ key: `tl-${i}`, title: step.label, date: step.date })),
		},
		{
			key: 'contributions',
			label: '맡은 일',
			tone: 'green',
			done: true,
			items: project.contributions.map((text, i) => ({ key: `me-${i}`, title: text })),
		},
	];
	return lists.filter((list) => list.items.length > 0);
}

/** 진행 고리: 체크한 비율만큼 색이 차오른다 */
const Ring: React.FC<{ done: number; total: number }> = ({ done, total }) => {
	const r = 26;
	const length = 2 * Math.PI * r;
	const ratio = total ? done / total : 0;
	return (
		<div className="ck-ring" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
			<svg viewBox="0 0 64 64" aria-hidden="true">
				<circle className="ck-ring-track" cx="32" cy="32" r={r} />
				<circle
					className="ck-ring-fill"
					cx="32"
					cy="32"
					r={r}
					strokeDasharray={length}
					strokeDashoffset={length * (1 - ratio)}
				/>
			</svg>
			<strong>{Math.round(ratio * 100)}%</strong>
		</div>
	);
};

/** 다 봤을 때 흩날리는 색종이 (움직임 줄이기에서는 CSS가 숨긴다) */
const Confetti: React.FC = () => (
	<div className="ck-confetti" aria-hidden="true">
		{Array.from({ length: 14 }, (_, i) => (
			<i key={i} style={{ '--i': i } as React.CSSProperties} />
		))}
	</div>
);

/** 히어로 오른쪽 할 일 목록 카드의 줄마다 라벨 색 (목록 색과 같은 줄) */
const HERO_TONES = ['orange', 'blue', 'green'] as const;

/**
 * 맨 위 (Todoist·Things 랜딩처럼): 밝은 바탕에 큰 한 줄, 소개, 단추, 숫자 칩.
 * 오른쪽에는 브라우저 틀에 담긴 대표 화면(없으면 데이터로 그린 목록 화면)과 그 모서리에 걸친 할 일 목록 카드 한 장
 */
const Hero: React.FC<{ project: Project }> = ({ project }) => {
	const tasks = project.highlights.slice(0, 3);
	return (
		<header className="ck-hero">
			<div className="ck-hero-inner">
				<div className="ck-hero-text">
					<p className="ck-hero-eyebrow">
						<Favicon project={project} className="ck-hero-icon" />
						<span>{project.name}</span>
					</p>
					<h2 className="ck-hero-title">{project.tagline || project.name}</h2>
					{project.description && <p className="ck-hero-lead">{project.description}</p>}
					<Links project={project} className="sp-links ck-hero-links" />
					{project.facts.length > 0 && (
						<ul className="ck-hero-facts" aria-label="숫자">
							{project.facts.slice(0, 3).map((fact) => (
								<li key={fact.label}>
									<strong>{fact.value}</strong>
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="ck-hero-art" aria-hidden="true">
					<DeviceFrame kind="browser" url={project.demo} className="ck-hero-device">
						{project.image ? (
							<img className="lk-device-media" src={project.image} alt="" />
						) : (
							<MockScreen project={project} kind="list" tone="light" decorative />
						)}
					</DeviceFrame>
					{tasks.length > 0 && (
						<ul className="ck-hero-tasks">
							{tasks.map((point, index) => (
								<li key={point.title} className={`tone-${HERO_TONES[index]}`} data-done={index === 0 ? '' : undefined}>
									<span className="ck-hero-box">
										<svg viewBox="0 0 16 16">
											<path d="M3.5 8.5l3 3 6-6" />
										</svg>
									</span>
									<span className="ck-hero-task">
										<b>{point.title}</b>
										<small>
											<i className={`fa-solid ${iconOf(point, index)}`} />
											주요 기능
										</small>
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</header>
	);
};

const ChecklistPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const lists = useMemo(() => buildLists(project), [project]);
	const [checked, setChecked] = useState<Set<string>>(() => new Set());
	const [sort, setSort] = useState<'section' | 'priority'>('section');

	// 체크할 수 있는 항목(이미 끝낸 목록은 빼고)
	const open = lists.filter((list) => !list.done);
	const total = open.reduce((n, list) => n + list.items.length, 0);
	const done = open.reduce((n, list) => n + list.items.filter((item) => checked.has(item.key)).length, 0);
	const complete = total > 0 && done === total;

	const toggle = (key: string) =>
		setChecked((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	// 우선순위 정렬: 남은 항목이 많은 목록부터, 끝낸 목록은 맨 뒤
	const ordered =
		sort === 'section'
			? lists
			: [...lists].sort((a, b) => {
					const left = a.done ? -1 : a.items.filter((item) => !checked.has(item.key)).length;
					const right = b.done ? -1 : b.items.filter((item) => !checked.has(item.key)).length;
					return right - left;
				});

	const today = useMemo(
		() => new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }),
		[]
	);

	const accent = useLandingAccent(project.icon);

	return (
		<div className="ck" ref={root} style={accent}>
			<Hero project={project} />
			<section className="ck-demo" aria-label="직접 해 보기">
				<SectionHeader
					eyebrow="직접 해 보기"
					title="하나씩 체크하며 둘러보세요."
					lead="항목을 체크하면 설명과 화면이 펼쳐지고, 진행 고리가 차오릅니다."
				/>
				<div className="ck-app" data-complete={complete || undefined}>
					<header className="ck-head">
						<div className="ck-bar">
							<span className="ck-today">{today}</span>
							<div className="ck-sort" role="group" aria-label="정렬">
								{(['section', 'priority'] as const).map((mode) => (
									<button key={mode} type="button" aria-pressed={sort === mode} onClick={() => setSort(mode)}>
										{mode === 'section' ? '섹션' : '우선순위'}
									</button>
								))}
							</div>
						</div>
						<div className="ck-title">
							<Favicon project={project} className="ck-icon" />
							<div className="ck-title-text">
								<h1>
									<span className="ck-eyebrow">오늘</span>
									{project.name}
								</h1>
								<p className="ck-note">{project.tagline}</p>
							</div>
							<Ring done={done} total={total} />
						</div>
						<p className="ck-count" aria-live="polite">
							{complete ? (
								<>
									다 봤어요 <span aria-hidden="true">🎉</span>
								</>
							) : (
								`${done} / ${total} 완료`
							)}
						</p>
						{complete && <Confetti />}
					</header>

					<div className="ck-lists">
						{ordered.map((list, listIndex) => (
							<Region key={list.key} label={list.label} className={`ck-list tone-${list.tone}`} data-reveal="">
								<h2>
									<i aria-hidden="true" />
									{list.label}
									<small>
										{list.done
											? '완료'
											: `${list.items.filter((item) => checked.has(item.key)).length}/${list.items.length}`}
									</small>
								</h2>
								{list.note && <p className="ck-list-note">{list.note}</p>}
								<ul>
									{list.items.map((item, i) => {
										const isChecked = list.done || checked.has(item.key);
										const titleId = `ck-${project.id}-${item.key}`;
										const detailId = `${titleId}-detail`;
										const expandable = Boolean(item.body || item.point);
										return (
											<li
												key={item.key}
												data-checked={isChecked || undefined}
												data-reveal=""
												style={{ '--d': Math.min(i + listIndex, 6) } as React.CSSProperties}
											>
												<button
													type="button"
													role="checkbox"
													className="ck-check"
													aria-checked={isChecked}
													aria-labelledby={titleId}
													aria-expanded={expandable && !list.done ? isChecked : undefined}
													aria-controls={expandable ? detailId : undefined}
													disabled={list.done}
													onClick={() => toggle(item.key)}
												>
													<svg viewBox="0 0 16 16" aria-hidden="true">
														<path d="M3.5 8.5l3 3 6-6" />
													</svg>
												</button>
												<div className="ck-item-text">
													<div className="ck-item-head">
														{item.date && <time>{item.date}</time>}
														<span id={titleId} className="ck-item-title">
															{item.title}
														</span>
													</div>
													{expandable && (
														<div id={detailId} className="ck-detail">
															<div>
																{item.body && <p>{item.body}</p>}
																{isChecked && item.point?.detail && <p className="ck-more">{item.point.detail}</p>}
																{isChecked && item.point && (
																	<div className="ck-media">
																		<FeatureMedia point={item.point} />
																	</div>
																)}
															</div>
														</div>
													)}
												</div>
											</li>
										);
									})}
								</ul>
							</Region>
						))}
					</div>

					{project.image && (
						<figure className="ck-shot" data-reveal="zoom">
							<img src={project.image} alt={`${project.name} 화면`} loading="lazy" />
						</figure>
					)}
				</div>
			</section>
			<CtaBand project={project} className="ck-cta" />
		</div>
	);
};

export default ChecklistPage;

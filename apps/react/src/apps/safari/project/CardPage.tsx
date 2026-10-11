// 한 장짜리 스펙 시트 (minimal): 큰 여백과 아주 가는 괘선, 작은 대문자 라벨, mono 숫자, 흑백에 강조색 한 점.
// 머리(번호·큰 tagline·메타 표) → 대표 화면 → 숫자 한 줄 → 주요 기능(번호 단계) → 만든 방식(Q&A) → 더 들려줄 장 → 화면 모음 →
// 쓰는 법 → 진행 과정 → 기술 사양 → 맡은 일 → 출처 → 링크. 어떤 프로젝트든 고를 수 있어 없는 필드는 그 구역을 통째로 뺀다.
// 단계와 Q&A는 스크롤에 맞춰 위 항목부터 차례로 열리고(머리가 스크롤 상자 60% 선을 지나면), 다시 올리면 닫힌다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectChapter, ProjectPoint } from '@/shared/profile';
import { FactValue, Facts, Links, Region, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { useReveal } from '@/apps/safari/project/reveal';

/** 항목의 머리가 스크롤 상자 위에서 이 비율만큼 내려온 선을 지나면 연다 (읽는 눈높이쯤) */
const LINE = 0.6;
/** 한 항목씩 열거나 닫는 사이 간격 (ms). 빨리 스크롤해도 한꺼번에가 아니라 차례로 */
const STEP = 200;

/** "01", "02" … 스펙 시트의 번호 */
const num = (i: number) => String(i + 1).padStart(2, '0');

/**
 * 스크롤에 맞춰 위 항목부터 차례로 열고, 다시 올리면 아래 항목부터 차례로 닫는다.
 * 목록 안의 `[data-head]`가 기준선 위로 올라온 수가 목표이고, 지금 열린 수를 한 항목씩 그쪽으로 옮긴다.
 * 눌러서 직접 여닫은 항목은 그 뜻을 지키다가, 스크롤이 그 항목을 다시 지날 때 잊는다
 * (그래서 눌러 닫은 항목은 더 내려가도 닫힌 채이고, 맨 위로 올리면 모두 닫힌다)
 */
function useUnfold(list: React.RefObject<HTMLElement | null>, count: number) {
	const live = typeof window !== 'undefined' && 'requestAnimationFrame' in window;
	const [target, setTarget] = useState(live ? 0 : count);
	const [opened, setOpened] = useState(live ? 0 : count);
	const [manual, setManual] = useState<Record<number, boolean>>({});

	useEffect(() => {
		const root = list.current;
		if (!root || !live) return;
		return onScrollFrame(root, (scroller) => {
			const view = viewOf(scroller);
			const line = view.top + view.height * LINE;
			let reached = 0;
			for (const head of root.querySelectorAll<HTMLElement>('[data-head]')) {
				if (head.getBoundingClientRect().top > line) break;
				reached += 1;
			}
			setTarget(reached);
		});
	}, [list, live]);

	useEffect(() => {
		if (opened === target) return;
		const next = opened + Math.sign(target - opened);
		const timer = window.setTimeout(() => {
			setOpened(next);
			// 스크롤이 지나간 항목은 누른 뜻을 잊는다
			const passed = Math.min(opened, next);
			setManual((prev) => {
				if (!(passed in prev)) return prev;
				const rest = { ...prev };
				delete rest[passed];
				return rest;
			});
		}, STEP);
		return () => window.clearTimeout(timer);
	}, [opened, target]);

	const isOpen = (i: number) => manual[i] ?? i < opened;
	const toggle = (i: number) => setManual((prev) => ({ ...prev, [i]: !isOpen(i) }));
	return { isOpen, toggle };
}

/** 구역 머리: 번호, 영문 라벨, 제목. 괘선 한 줄 위에 */
const Head: React.FC<{ no: string; label: string; title: string }> = ({ no, label, title }) => (
	<div className="ss-head">
		<span className="ss-no">{no}</span>
		<span className="ss-label">{label}</span>
		<h2>{title}</h2>
	</div>
);

/** 주요 기능: 번호 단계 목록. 번호와 제목은 늘 보이고, 본문(과 그림)은 스크롤에 맞춰 차례로 열린다 */
const Steps: React.FC<{ points: ProjectPoint[]; name: string }> = ({ points, name }) => {
	const list = useRef<HTMLOListElement>(null);
	const { isOpen, toggle } = useUnfold(list, points.length);
	return (
		<ol className="ss-steps" ref={list}>
			{points.map((point, i) => {
				const open = isOpen(i);
				return (
					<li key={point.title} data-head="" data-open={open}>
						<span className="ss-step-no" aria-hidden="true">
							{num(i)}
						</span>
						<h3>
							<button type="button" aria-expanded={open} onClick={() => toggle(i)}>
								{point.title}
							</button>
						</h3>
						<div className="ss-fold">
							<div>
								<p>{point.body}</p>
								{point.detail && <p>{point.detail}</p>}
								{point.image && (
									<figure className="ss-frame">
										<img src={point.image} alt={`${name}: ${point.title}`} loading="lazy" />
										<figcaption>
											<span className="ss-label">Fig. {num(i)}</span> {point.title}
										</figcaption>
									</figure>
								)}
							</div>
						</div>
					</li>
				);
			})}
		</ol>
	);
};

/** 만든 방식: 묻고 답하기. 제목이 단추(aria-expanded)이고, 스크롤에 맞춰 차례로 열리며 눌러서 여닫는다 */
const Answers: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLDivElement>(null);
	const { isOpen, toggle } = useUnfold(list, points.length);
	return (
		<div className="ss-qa" ref={list}>
			{points.map((point, i) => {
				const open = isOpen(i);
				return (
					<div key={point.title} className="ss-q" data-head="" data-open={open}>
						<span className="ss-q-mark" aria-hidden="true">
							Q.{num(i)}
						</span>
						<h3>
							<button type="button" aria-expanded={open} onClick={() => toggle(i)}>
								{point.title}
								<span className="ss-q-sign" aria-hidden="true" />
							</button>
						</h3>
						<div className="ss-fold">
							<div>
								<span className="ss-label">A.</span>
								<p>{point.body}</p>
								{point.detail && <p>{point.detail}</p>}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

type SchemaDoc = NonNullable<ProjectChapter['schema']>[number];

/** 데이터베이스 구조: 문서마다 경로, 누가 읽는지, 필드(mono 칩), 한 줄 설명. 하위 문서는 그 문서 아래 들여 쓴다 */
const Schema: React.FC<{ docs: SchemaDoc[] }> = ({ docs }) => {
	const ordered = docs
		.filter((doc) => !doc.parent)
		.flatMap((doc) => [doc, ...docs.filter((child) => child.parent === doc.path)]);
	return (
		<div className="ss-schema" role="group" aria-label="데이터베이스 구조">
			{ordered.map((doc) => (
				<article key={doc.path} data-child={doc.parent ? '' : undefined}>
					<header>
						<code>{doc.path}</code>
						<span className="ss-access" data-locked={doc.locked || undefined}>
							{doc.locked && <i className="fa-solid fa-lock" aria-hidden="true" />}
							{doc.access}
						</span>
					</header>
					<ul aria-label={`${doc.path} 필드`}>
						{doc.fields.map((field) => (
							<li key={field}>{field}</li>
						))}
					</ul>
					<p>{doc.note}</p>
				</article>
			))}
		</div>
	);
};

/** 더 들려줄 장: 첫머리, 숫자, 데이터베이스 구조, 글 묶음(괘선 격자), 전후 비교, 그림 */
const Chapter: React.FC<{ chapter: ProjectChapter; no: string }> = ({ chapter, no }) => (
	<section className="ss-sec" aria-label={chapter.title}>
		<Head no={no} label="Notes" title={chapter.title} />
		{chapter.lead && (
			<p className="ss-lead" data-reveal="">
				{chapter.lead}
			</p>
		)}
		{chapter.facts && (
			<ul className="ss-facts ss-facts-small" data-reveal="">
				{chapter.facts.map((fact) => (
					<li key={fact.label}>
						<FactValue text={fact.value} />
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		)}
		{chapter.schema && <Schema docs={chapter.schema} />}
		<ol className="ss-grid">
			{chapter.points.map((point, i) => (
				<li key={point.title} data-reveal="">
					<span className="ss-label">
						{no}.{num(i)}
					</span>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</li>
			))}
		</ol>
		{chapter.compare && (
			<table className="ss-table" data-reveal="">
				<thead>
					<tr>
						<th scope="col">항목</th>
						<th scope="col">전</th>
						<th scope="col">후</th>
					</tr>
				</thead>
				<tbody>
					{chapter.compare.map((row) => (
						<tr key={row.label}>
							<th scope="row">{row.label}</th>
							<td>
								{row.before}
								{row.unit}
							</td>
							<td>
								{row.after}
								{row.unit}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		)}
		{chapter.image && (
			<figure className="ss-frame" data-reveal="">
				<img src={chapter.image.src} alt={chapter.image.alt} loading="lazy" />
				<figcaption>
					<span className="ss-label">Fig.</span> {chapter.image.alt}
				</figcaption>
			</figure>
		)}
	</section>
);

const CardPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	// 구역 번호는 있는 구역만 세어 매긴다
	let count = 0;
	const next = () => num(count++);
	const meta: [string, string | undefined][] = [
		['Context', project.context],
		['Period', project.period],
		['Role', project.role],
		['Language', project.language],
	];

	return (
		<div className="ss" ref={root}>
			<header className="ss-top">
				<p className="ss-ident">
					<span className="ss-label">
						<b>{project.id}</b> · Spec sheet
					</span>
					<span className="ss-label">{project.name}</span>
				</p>
				<div className="ss-title">
					<div>
						<h1>{project.tagline}</h1>
						<p className="ss-desc">{project.description}</p>
					</div>
					<dl className="ss-meta">
						{meta.map(
							([label, value]) =>
								value && (
									<div key={label}>
										<dt className="ss-label">{label}</dt>
										<dd>{value}</dd>
									</div>
								)
						)}
					</dl>
				</div>
				<Links project={project} className="ss-links" />
			</header>

			{project.image && (
				<div className="ss-hero" data-reveal="zoom">
					<Shot project={project} className="ss-frame" />
					<p className="ss-label">Fig. 00 · {project.name} 화면</p>
				</div>
			)}

			{project.facts.length > 0 && (
				<Region label="한눈에 보기" className="ss-sec ss-sec-facts" data-reveal="">
					<Facts project={project} className="ss-facts" />
				</Region>
			)}

			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="ss-sec">
					<Head no={next()} label="Features" title="주요 기능" />
					<Steps points={project.highlights} name={project.name} />
				</Region>
			)}

			{project.build.length > 0 && (
				<Region label="만든 방식" className="ss-sec">
					<Head no={next()} label="Q & A" title="만든 방식" />
					<Answers points={project.build} />
				</Region>
			)}

			{project.chapters?.map((chapter) => (
				<Chapter key={chapter.title} chapter={chapter} no={next()} />
			))}

			{project.gallery && project.gallery.length > 0 && (
				<Region label="화면 모음" className="ss-sec">
					<Head no={next()} label="Figures" title="화면 모음" />
					<ul className="ss-gallery">
						{project.gallery.map((shot, i) => (
							<li key={shot.src} data-reveal="">
								<figure>
									<img src={shot.src} alt={shot.caption} loading="lazy" />
									<figcaption>
										<span className="ss-label">Fig. {num(i)}</span> {shot.caption}
									</figcaption>
								</figure>
							</li>
						))}
					</ul>
				</Region>
			)}

			{project.usage && project.usage.length > 0 && (
				<Region label="쓰는 법" className="ss-sec">
					<Head no={next()} label="Usage" title="쓰는 법" />
					<dl className="ss-usage">
						{project.usage.map((item) => (
							<div key={item.title} data-reveal="">
								<dt>{item.title}</dt>
								<dd>{item.body}</dd>
							</div>
						))}
					</dl>
				</Region>
			)}

			{project.timeline && project.timeline.length > 0 && (
				<Region label="진행 과정" className="ss-sec">
					<Head no={next()} label="Timeline" title="진행 과정" />
					<ol className="ss-timeline">
						{project.timeline.map((item) => (
							<li key={`${item.date} ${item.label}`} data-reveal="left">
								<time>{item.date}</time>
								<span>{item.label}</span>
							</li>
						))}
					</ol>
				</Region>
			)}

			{project.specs.length > 0 && (
				<Region label="기술 사양" className="ss-sec">
					<Head no={next()} label="Specifications" title="기술 사양" />
					<dl className="ss-specs">
						{project.specs.map((spec, i) => (
							<div key={spec.label} data-reveal="">
								<dt>
									<span className="ss-label">{num(i)}</span>
									{spec.label}
								</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
					{project.stack.length > 0 && (
						<p className="ss-stack">
							{project.stack.map((item) => (
								<code key={item}>{item}</code>
							))}
						</p>
					)}
				</Region>
			)}

			{project.contributions.length > 0 && (
				<Region label="맡은 일" className="ss-sec">
					<Head no={next()} label="Contributions" title="맡은 일" />
					{project.role && <p className="ss-lead">{project.role}</p>}
					<ul className="ss-list">
						{project.contributions.map((item, i) => (
							<li key={item} data-reveal="">
								<span className="ss-label">{num(i)}</span>
								{item}
							</li>
						))}
					</ul>
				</Region>
			)}

			{project.credits && project.credits.length > 0 && (
				<Region label="출처" className="ss-sec">
					<Head no={next()} label="Credits" title="출처" />
					<table className="ss-table">
						<tbody>
							{project.credits.map((credit) => (
								<tr key={`${credit.role} ${credit.name}`}>
									<th scope="row">{credit.role}</th>
									<td>
										{credit.href ? (
											<a href={credit.href} target="_blank" rel="noopener noreferrer">
												{credit.name}
											</a>
										) : (
											credit.name
										)}
										<span> · {credit.by}</span>
										{credit.note && <small>{credit.note}</small>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</Region>
			)}

			<footer className="ss-foot">
				<span className="ss-label">
					<b>{project.id}</b> · End of sheet
				</span>
				<Links project={project} className="ss-links" />
			</footer>
		</div>
	);
};

export default CardPage;

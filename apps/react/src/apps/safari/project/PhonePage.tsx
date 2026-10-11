// 폰 모양(phone): 앱스토어 미리 보기처럼, 가운데 고정된 폰 틀 안의 화면이 왼쪽 이야기가 흐르는 대로 바뀐다
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Favicon, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, scrollParent } from '@/apps/safari/project/scroll';
import '@/apps/safari/project/PhonePage.css';

/** 이야기 한 단계: 폰 화면에 보일 그림과 왼쪽 글 */
interface Step {
	key: string;
	/** 어느 묶음에서 왔나 (소개·주요 기능·쓰는 법·만든 방식·사양) */
	kind: 'intro' | 'highlight' | 'usage' | 'build' | 'specs';
	title: string;
	image?: string;
	point?: ProjectPoint;
}

const isVideo = (src: string) => src.endsWith('.mp4');

/** 단계마다 그림을 하나씩 배정한다: 단계 자신의 그림이 있으면 그것, 없으면 대표 화면·화면 모음에서 차례로(돌아가며) */
function assignImages(steps: Step[], pool: string[]): Step[] {
	let next = 0;
	return steps.map((step) => {
		if (step.image) return step;
		if (pool.length === 0) return step;
		const image = pool[next % pool.length];
		next += 1;
		return { ...step, image };
	});
}

function buildSteps(project: Project): Step[] {
	const gallery = (project.gallery ?? []).map((shot) => shot.src);
	const pool = [...new Set([project.image, ...gallery].filter(Boolean))].filter((src) => !isVideo(src)) as string[];
	const steps: Step[] = [
		{ key: 'intro', kind: 'intro', title: project.name, image: pool[0] },
		...project.highlights.map((point, index) => ({
			key: `h${index}`,
			kind: 'highlight' as const,
			title: point.title,
			image: point.image ?? point.shots?.find((shot) => !isVideo(shot.src))?.src,
			point,
		})),
		...(project.usage ?? []).map((point, index) => ({
			key: `u${index}`,
			kind: 'usage' as const,
			title: point.title,
			image: point.image,
			point,
		})),
		...project.build.map((point, index) => ({
			key: `b${index}`,
			kind: 'build' as const,
			title: point.title,
			image: point.image,
			point,
		})),
	];
	if (project.specs.length > 0 || project.contributions.length > 0)
		steps.push({ key: 'specs', kind: 'specs', title: '기술 사양' });
	// 소개는 대표 화면을 이미 받았으니 나머지는 두 번째 그림부터 돌린다
	return assignImages(steps, pool.length > 1 ? [...pool.slice(1), pool[0]] : pool);
}

const KIND_LABEL: Record<Step['kind'], string> = {
	intro: '소개',
	highlight: '주요 기능',
	usage: '쓰는 법',
	build: '만든 방식',
	specs: '기술 사양',
};

/**
 * 폰 틀: 둥근 베젤·다이내믹 아일랜드 안에 지금 단계의 그림이 세로로 밀려 들어온다.
 * 단계가 바뀔 때 폰이 살짝 기울었다 돌아오고, 마우스를 따라 아주 조금 돈다 (움직임 줄이기에서는 둘 다 없음)
 */
const Phone: React.FC<{ steps: Step[]; active: number; repo: string }> = ({ steps, active, repo }) => {
	const step = steps[active];
	const [outgoing, setOutgoing] = useState<Step | null>(null);
	const [tilting, setTilting] = useState(false);
	const previous = useRef(active);
	const frame = useRef<HTMLDivElement>(null);

	// 바뀐 그림은 뒤에 두고 위로 밀어 올린다. 끝나면 지운다
	useEffect(() => {
		if (previous.current === active) return;
		const from = steps[previous.current];
		previous.current = active;
		if (prefersReducedMotion()) return;
		setOutgoing(from ?? null);
		setTilting(true);
		const timer = window.setTimeout(() => {
			setOutgoing(null);
			setTilting(false);
		}, 620);
		return () => window.clearTimeout(timer);
	}, [active, steps]);

	// 마우스 위치에 따라 살짝 돈다 (CSS 변수로 넘기고 transform은 CSS가)
	const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const node = frame.current;
		if (!node || prefersReducedMotion()) return;
		const box = node.getBoundingClientRect();
		const x = (event.clientX - box.left) / box.width - 0.5;
		const y = (event.clientY - box.top) / box.height - 0.5;
		node.style.setProperty('--ph-rx', `${(-y * 6).toFixed(2)}deg`);
		node.style.setProperty('--ph-ry', `${(x * 8).toFixed(2)}deg`);
	};
	const onLeave = () => {
		frame.current?.style.removeProperty('--ph-rx');
		frame.current?.style.removeProperty('--ph-ry');
	};

	return (
		<div
			ref={frame}
			className={`ph-phone${tilting ? ' ph-tilting' : ''}`}
			onPointerMove={onMove}
			onPointerLeave={onLeave}
		>
			<div className="ph-island" aria-hidden="true" />
			<div className="ph-screen">
				{outgoing?.image && (
					<div className="ph-screen-out" style={{ backgroundImage: `url("${outgoing.image}")` }} aria-hidden="true" />
				)}
				{step.image ? (
					<img
						key={step.key}
						className="ph-screen-img"
						src={step.image}
						alt=""
						aria-label={`폰 화면: ${step.title}`}
						data-step={active}
						draggable={false}
					/>
				) : (
					<div
						key={step.key}
						className="ph-screen-img ph-screen-blank"
						role="img"
						aria-label={`폰 화면: ${step.title}`}
						data-step={active}
					>
						<span>{step.title}</span>
					</div>
				)}
				{step.kind === 'specs' && (
					<div className="ph-repo">
						<span className="ph-repo-eyebrow">저장소</span>
						<a className="ph-repo-url" href={repo} target="_blank" rel="noopener noreferrer">
							{repo.replace(/^https?:\/\//, '')}
						</a>
						<span className="ph-repo-hint">열어서 코드를 봅니다</span>
					</div>
				)}
			</div>
			<div className="ph-home" aria-hidden="true" />
		</div>
	);
};

/** 폰 옆에 떠 있는 숫자 뱃지: 스크롤하면 바깥으로 흩어지며 사라진다 */
const Badges: React.FC<{ project: Project }> = ({ project }) => {
	const ref = useRef<HTMLUListElement>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node || prefersReducedMotion()) return;
		return onScrollFrame(node, (scroller) => {
			const top = scroller?.scrollTop ?? window.scrollY;
			// 머리글을 지나 200px쯤 내리면 다 흩어진다
			node.style.setProperty('--ph-scatter', Math.min(1, top / 480).toFixed(3));
		});
	}, []);
	if (project.facts.length === 0) return null;
	return (
		<ul ref={ref} className="ph-badges" aria-label="한눈에">
			{project.facts.map((fact, index) => (
				<li key={fact.label} style={{ '--i': index } as React.CSSProperties}>
					<FactValue text={fact.value} />
					<span>{fact.label}</span>
				</li>
			))}
		</ul>
	);
};

/** 단계 글 한 칸: 큰 번호, 묶음 이름, 제목, 본문 */
const StepText: React.FC<{ step: Step; index: number; children?: React.ReactNode }> = ({ step, index, children }) => (
	<>
		<span className="ph-num" aria-hidden="true">
			{String(index).padStart(2, '0')}
		</span>
		<span className="ph-kind">{KIND_LABEL[step.kind]}</span>
		<h3>{step.title}</h3>
		{step.point && <p>{step.point.body}</p>}
		{step.point?.detail && <p className="ph-detail">{step.point.detail}</p>}
		{children}
	</>
);

const PhonePage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	const storyRef = useRef<HTMLDivElement>(null);
	const steps = useMemo(() => buildSteps(project), [project]);
	const [active, setActive] = useState(0);

	// 단계가 스크롤 상자의 가운데 띠(위아래 45%를 뺀 곳)에 들어오면 그 단계가 활성
	useEffect(() => {
		const story = storyRef.current;
		if (!story || typeof IntersectionObserver === 'undefined') return;
		const nodes = Array.from(story.querySelectorAll<HTMLElement>('[data-step]'));
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries)
					if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
			},
			{ root: scrollParent(story), rootMargin: '-45% 0px -45% 0px', threshold: 0 }
		);
		nodes.forEach((node) => observer.observe(node));
		return () => observer.disconnect();
	}, [steps]);

	const highlightSteps = steps.filter((step) => step.kind === 'highlight');
	const usageSteps = steps.filter((step) => step.kind === 'usage');
	const buildList = steps.filter((step) => step.kind === 'build');
	const indexOf = (step: Step) => steps.indexOf(step);
	const specsStep = steps.find((step) => step.kind === 'specs');
	const meta = [project.context, project.role, project.period].filter(Boolean);

	return (
		<div ref={root} className="ph">
			<header className="ph-head">
				<div className="ph-head-name">
					<Favicon project={project} className="ph-icon" />
					<span>{project.name}</span>
				</div>
				<h1>{project.tagline}</h1>
				<p className="ph-lead">{project.description}</p>
				<Links project={project} className="ph-links" />
			</header>

			<div className="ph-body">
				{/* 오른쪽(좁은 창은 위) 고정: 폰과 뱃지 */}
				<div className="ph-stage" data-active={active}>
					<div className="ph-stage-inner">
						<Phone steps={steps} active={active} repo={project.url} />
						<Badges project={project} />
					</div>
				</div>

				{/* 왼쪽: 세로로 흐르는 이야기 */}
				<div ref={storyRef} className="ph-story">
					<section className="ph-step" data-step={0} data-reveal="" aria-label="소개">
						<StepText step={steps[0]} index={0}>
							<p>{project.description}</p>
							{meta.length > 0 && (
								<ul className="ph-meta">
									{meta.map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>
							)}
						</StepText>
					</section>

					{highlightSteps.length > 0 && (
						<ol className="ph-steps" aria-label="이야기">
							{highlightSteps.map((step) => (
								<li
									key={step.key}
									className={`ph-step${active === indexOf(step) ? ' ph-active' : ''}`}
									data-step={indexOf(step)}
									data-reveal=""
								>
									<StepText step={step} index={indexOf(step)} />
								</li>
							))}
						</ol>
					)}

					{usageSteps.length > 0 && (
						<Region label="쓰는 법" className="ph-group">
							{usageSteps.map((step) => (
								<div
									key={step.key}
									className={`ph-step${active === indexOf(step) ? ' ph-active' : ''}`}
									data-step={indexOf(step)}
									data-reveal=""
								>
									<StepText step={step} index={indexOf(step)} />
								</div>
							))}
						</Region>
					)}

					{buildList.length > 0 && (
						<Region label="만든 방식" className="ph-group">
							{buildList.map((step) => (
								<div
									key={step.key}
									className={`ph-step${active === indexOf(step) ? ' ph-active' : ''}`}
									data-step={indexOf(step)}
									data-reveal=""
								>
									<StepText step={step} index={indexOf(step)} />
								</div>
							))}
						</Region>
					)}

					{specsStep && (
						<Region
							label="기술 사양"
							className={`ph-step ph-specs${active === indexOf(specsStep) ? ' ph-active' : ''}`}
							data-step={indexOf(specsStep)}
							data-reveal=""
						>
							<StepText step={specsStep} index={indexOf(specsStep)} />
							{project.specs.length > 0 && (
								<dl className="ph-spec-list">
									{project.specs.map((spec) => (
										<div key={spec.label}>
											<dt>{spec.label}</dt>
											<dd>{spec.value}</dd>
										</div>
									))}
								</dl>
							)}
							{project.contributions.length > 0 && (
								<>
									<h4>맡은 일</h4>
									<ul className="ph-contrib">
										{project.contributions.map((line) => (
											<li key={line}>{line}</li>
										))}
									</ul>
								</>
							)}
							{project.timeline && project.timeline.length > 0 && (
								<>
									<h4>진행 과정</h4>
									<ol className="ph-timeline">
										{project.timeline.map((entry) => (
											<li key={`${entry.date}-${entry.label}`}>
												<time>{entry.date}</time>
												<span>{entry.label}</span>
											</li>
										))}
									</ol>
								</>
							)}
						</Region>
					)}
				</div>
			</div>
		</div>
	);
};

export default PhonePage;

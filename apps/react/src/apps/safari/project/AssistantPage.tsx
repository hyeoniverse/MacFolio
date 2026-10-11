// 설정 도우미 모양(assistant): macOS 설정 도우미처럼 흐린 그라데이션 위에 큰 둥근 창 하나가 떠 있고,
// 단계(환영 → 한눈에 → 주요 기능 → … → 완료)마다 한 화면씩 '계속'·'뒤로'(또는 ←→)로 넘긴다.
// 왼쪽(좁은 창에서는 위)의 단계 목록이 지금 단계를 가리킨다. 없는 자료의 단계는 통째로 뺀다
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { Favicon, FactValue, Links } from '@/apps/safari/project/parts';
import { FeatureMedia } from '@/apps/safari/project/CreativeParts';
import Devices from '@/apps/safari/project/product/Devices';
import Pipeline from '@/apps/safari/project/product/Pipeline';
import '@/apps/safari/project/AssistantPage.css';

type StepId =
	'welcome' | 'glance' | 'features' | 'devices' | 'build' | 'usage' | 'timeline' | 'specs' | 'roles' | 'done';

interface Step {
	id: StepId;
	/** 단계 목록과 창 제목에 쓰는 이름 */
	label: string;
	icon: string;
}

/** 프로젝트에 자료가 있는 단계만 차례대로 */
function stepsOf(project: Project): Step[] {
	const macfolio = project.id === 'macfolio';
	const steps: (Step | false)[] = [
		{ id: 'welcome', label: '환영', icon: 'fa-hand' },
		project.facts.length > 0 && { id: 'glance', label: '한눈에 보기', icon: 'fa-chart-simple' },
		project.highlights.length > 0 && { id: 'features', label: '주요 기능', icon: 'fa-wand-magic-sparkles' },
		macfolio && { id: 'devices', label: '어디서 열어도', icon: 'fa-display' },
		(project.build.length > 0 || macfolio) && { id: 'build', label: '만든 방식', icon: 'fa-screwdriver-wrench' },
		(project.usage?.length ?? 0) > 0 && { id: 'usage', label: '쓰는 법', icon: 'fa-book-open' },
		(project.timeline?.length ?? 0) > 0 && { id: 'timeline', label: '진행 과정', icon: 'fa-clock-rotate-left' },
		project.specs.length > 0 && { id: 'specs', label: '기술 사양', icon: 'fa-microchip' },
		project.contributions.length > 0 && { id: 'roles', label: '맡은 일', icon: 'fa-user-check' },
		{ id: 'done', label: '완료', icon: 'fa-check' },
	];
	return steps.filter((step): step is Step => Boolean(step));
}

/** 주요 기능: 왼쪽 목록에서 고르면 오른쪽에 설명과 그림 (macOS '기능 소개' 화면처럼) */
const Features: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const [index, setIndex] = useState(0);
	const point = points[Math.min(index, points.length - 1)];
	return (
		<div className="asst-features">
			<ul className="asst-pick" role="list" aria-label="기능 목록">
				{points.map((item, i) => (
					<li key={item.title}>
						<button type="button" aria-pressed={i === index} onClick={() => setIndex(i)} style={cssVars({ i })}>
							<i className={`fa-solid ${item.icon ?? 'fa-circle-dot'}`} aria-hidden="true" />
							<span>{item.title}</span>
						</button>
					</li>
				))}
			</ul>
			{/* key로 다시 그려 고를 때마다 살짝 밀려 들어온다 */}
			<div className="asst-detail" key={point.title}>
				<h3>{point.title}</h3>
				<p>{point.body}</p>
				{point.detail && <p className="asst-detail-more">{point.detail}</p>}
				<div className="asst-detail-media">
					<FeatureMedia point={point} />
				</div>
			</div>
		</div>
	);
};

/** 만든 방식·쓰는 법: 약관 읽기처럼 긴 목록이 창 안에서 스크롤된다 */
const Terms: React.FC<{ points: ProjectPoint[]; label: string }> = ({ points, label }) => (
	<ol className="asst-terms" aria-label={label}>
		{points.map((point, i) => (
			<li key={point.title} style={cssVars({ i })}>
				<span className="asst-terms-no">{String(i + 1).padStart(2, '0')}</span>
				<div>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
					{point.detail && <p>{point.detail}</p>}
				</div>
			</li>
		))}
	</ol>
);

/** 완료: 원이 그려지고 체크가 찍힌다 */
const Done: React.FC = () => (
	<svg className="asst-done-mark" viewBox="0 0 96 96" aria-hidden="true">
		<circle cx="48" cy="48" r="42" pathLength={1} />
		<path d="M30 49 L43 62 L67 36" pathLength={1} />
	</svg>
);

const AssistantPage: React.FC<{ project: Project }> = ({ project }) => {
	const steps = useMemo(() => stepsOf(project), [project]);
	const [current, setCurrent] = useState(0);
	// 앞으로 갈 때는 오른쪽에서, 뒤로 갈 때는 왼쪽에서 밀려 들어온다
	const [dir, setDir] = useState<'next' | 'back'>('next');
	const pane = useRef<HTMLElement>(null);
	const step = steps[Math.min(current, steps.length - 1)];
	const last = current >= steps.length - 1;

	const go = (to: number) => {
		const clamped = Math.max(0, Math.min(steps.length - 1, to));
		if (clamped === current) return;
		setDir(clamped > current ? 'next' : 'back');
		setCurrent(clamped);
	};

	// 단계가 바뀌면 창 내용은 맨 위부터
	useEffect(() => {
		pane.current?.scrollTo({ top: 0 });
	}, [current]);

	const onKey = (event: React.KeyboardEvent) => {
		// 글 입력 중이나 데모 단추 위에서는 가로채지 않는다
		if ((event.target as HTMLElement).closest('button, a, input, textarea')) return;
		if (event.key === 'ArrowRight') go(current + 1);
		if (event.key === 'ArrowLeft') go(current - 1);
	};

	const body = () => {
		switch (step.id) {
			case 'welcome':
				return (
					<div className="asst-welcome">
						<Favicon project={project} className="asst-icon" />
						<p className="asst-hello">환영합니다</p>
						<h2>{project.tagline}</h2>
						<p className="asst-lead">{project.description}</p>
						<p className="asst-meta">
							{project.context}
							{project.period && <span> · {project.period}</span>}
						</p>
						<Links project={project} className="asst-links" />
					</div>
				);
			case 'glance':
				return (
					<div className="asst-glance">
						<h2>한눈에 보기</h2>
						<ul className="asst-facts">
							{project.facts.map((fact, i) => (
								<li key={fact.label} style={cssVars({ i })}>
									<FactValue text={fact.value} />
									<span>{fact.label}</span>
								</li>
							))}
						</ul>
						{project.role && (
							<p className="asst-meta">
								<i className="fa-solid fa-user" aria-hidden="true" /> {project.role}
							</p>
						)}
					</div>
				);
			case 'features':
				return (
					<>
						<h2>주요 기능</h2>
						<p className="asst-sub">왼쪽에서 하나를 고르면 자세히 보여 줍니다.</p>
						<Features points={project.highlights} />
					</>
				);
			case 'devices':
				return (
					<>
						<h2>어디서 열어도</h2>
						<p className="asst-sub">화면 크기마다 어떻게 보이는지 골라 봅니다.</p>
						<Devices />
					</>
				);
			case 'build':
				return (
					<>
						<h2>만든 방식</h2>
						<p className="asst-sub">끝까지 읽은 뒤 계속하세요 (동의하지 않아도 됩니다).</p>
						{project.id === 'macfolio' && <Pipeline />}
						{project.build.length > 0 && <Terms points={project.build} label="만든 방식 목록" />}
					</>
				);
			case 'usage':
				return (
					<>
						<h2>쓰는 법</h2>
						<Terms points={project.usage ?? []} label="쓰는 법 목록" />
					</>
				);
			case 'timeline':
				return (
					<>
						<h2>진행 과정</h2>
						<ol className="asst-timeline">
							{(project.timeline ?? []).map((entry, i) => (
								<li key={`${entry.date}-${entry.label}`} style={cssVars({ i })}>
									<time>{entry.date}</time>
									<span>{entry.label}</span>
								</li>
							))}
						</ol>
					</>
				);
			case 'specs':
				return (
					<>
						<h2>기술 사양</h2>
						<dl className="asst-specs">
							{project.specs.map((spec, i) => (
								<div key={spec.label} style={cssVars({ i })}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
						{project.stack.length > 0 && (
							<ul className="asst-stack" aria-label="기술">
								{project.stack.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						)}
					</>
				);
			case 'roles':
				return (
					<>
						<h2>맡은 일</h2>
						<ul className="asst-roles">
							{project.contributions.map((item, i) => (
								<li key={item} style={cssVars({ i })}>
									<i className="fa-solid fa-check" aria-hidden="true" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					</>
				);
			case 'done':
				return (
					<div className="asst-finish">
						<Done />
						<h2>설정이 끝났습니다</h2>
						<p className="asst-lead">
							{project.name}
							{project.demo || project.app ? '을(를) 바로 열어 보거나' : '의'} 코드를 GitHub에서 볼 수 있습니다.
						</p>
						<Links project={project} className="asst-links" />
					</div>
				);
		}
	};

	return (
		<div className="asst" onKeyDown={onKey}>
			<div className="asst-sky" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>

			<div className="asst-window" role="group" aria-label={`${project.name} 설정 도우미`}>
				<nav className="asst-steps" aria-label="단계">
					<ol>
						{steps.map((item, i) => (
							<li key={item.id} data-state={i < current ? 'done' : i === current ? 'current' : undefined}>
								<button
									type="button"
									aria-current={i === current ? 'step' : undefined}
									onClick={() => go(i)}
									title={item.label}
								>
									<span className="asst-dot" aria-hidden="true">
										<i className={`fa-solid ${i < current ? 'fa-check' : item.icon}`} />
									</span>
									<span className="asst-step-label">{item.label}</span>
								</button>
							</li>
						))}
					</ol>
				</nav>

				<div className="asst-main">
					{/* key가 바뀌면 다시 그려져 교차 페이드와 밀림이 다시 돈다 */}
					<section aria-label={step.label} className="asst-pane" data-dir={dir} key={step.id} ref={pane}>
						{body()}
					</section>

					<div className="asst-bar">
						<span className="asst-count" aria-live="polite">
							{current + 1} / {steps.length}
						</span>
						<div className="asst-buttons">
							<button type="button" className="asst-btn" onClick={() => go(current - 1)} disabled={current === 0}>
								뒤로
							</button>
							{last ? (
								<button type="button" className="asst-btn primary" onClick={() => go(0)}>
									처음으로
								</button>
							) : (
								<button type="button" className="asst-btn primary" onClick={() => go(current + 1)}>
									계속
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AssistantPage;

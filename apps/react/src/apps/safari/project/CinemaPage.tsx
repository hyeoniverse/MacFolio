// 시네마: 한 화면씩 고정되는 장면. 스크롤 진행도(--p)로 큰 화면이 솟고 밀려나고, 글자가 차례로 떠오른다
import React, { useEffect, useRef } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { cssVars } from '@/shared/lib/cssVars';
import Devices from '@/apps/safari/project/product/Devices';
import Pipeline from '@/apps/safari/project/product/Pipeline';
import {
	BentoGrid,
	CtaBand,
	DeviceFrame,
	FeatureVisual,
	LogoStrip,
	MockScreen,
	SectionHeader,
	shortName,
} from '@/apps/safari/project/landing';
import '@/apps/safari/project/CinemaPage.css';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const isVideo = (src: string) => src.endsWith('.mp4');

/** 칸 n개를 max열 이하 격자에 남는 칸 없이: 열 수와 마지막 칸이 차지할 열 수 */
function fitGrid(n: number, max: number): { cols: number; last: number } {
	const cols = n <= max ? Math.max(1, n) : n % max === 0 ? max : n % 3 === 0 && max >= 3 ? 3 : max;
	const rest = n % cols;
	return { cols, last: rest === 0 ? 1 : cols - rest + 1 };
}

/**
 * 장면 하나: 높이는 화면의 len배, 안쪽 무대는 sticky로 화면에 붙어 있다.
 * 무대가 붙어 있는 동안 지나온 만큼을 --p(0~1)로 넣고, 모양은 CSS가 --p로 정한다. 움직임 줄이기에서는 재지 않는다(CSS가 정적 상태로)
 */
function useScene<T extends HTMLElement>(len: number) {
	const ref = useRef<T>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		node.style.setProperty('--len', String(len));
		if (prefersReducedMotion()) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const box = node.getBoundingClientRect();
			node.style.setProperty('--view', `${view.height}px`);
			node.style.setProperty('--p', clamp((view.top - box.top) / Math.max(1, box.height - view.height)).toFixed(4));
		});
	}, [len]);
	return ref;
}

const Scene: React.FC<{ len: number; className?: string; children: React.ReactNode }> = ({
	len,
	className = '',
	children,
}) => {
	const ref = useScene<HTMLDivElement>(len);
	return (
		<div className={`cn-scene ${className}`} ref={ref}>
			<div className="cn-stage">{children}</div>
		</div>
	);
};

/** 그림이나 짧은 영상. 장면이 밀고 들어올 때 그림이 뒤늦게 뜨면 어색해서 미리 받는다(lazy 아님) */
const Media: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) =>
	isVideo(src) ? (
		<video className={className} src={src} muted loop playsInline autoPlay aria-label={alt} />
	) : (
		<img className={className} src={src} alt={alt} />
	);

/** 제목을 글자마다 span으로 나눈다 (글자마다 --i로 순서를 넘겨 번지듯 차례로 나타난다). 낱말 사이 띄어쓰기는 그대로 둔다 */
const Letters: React.FC<{ text: string }> = ({ text }) => {
	let i = 0;
	return (
		<>
			{text.split(' ').map((word, w) => (
				<React.Fragment key={w}>
					{w > 0 && ' '}
					<span className="cn-word">
						{Array.from(word).map((ch, c) => (
							<span key={c} className="cn-letter" style={cssVars({ i: i++ })}>
								{ch}
							</span>
						))}
					</span>
				</React.Fragment>
			))}
		</>
	);
};

/**
 * 첫 장면 (Apple 제품 페이지의 히어로): 화면 위쪽에 제목이 글자마다 번지듯 나타나고, 아래에서 노트북이 고개를 내밀고 있다.
 * 스크롤하면 제목이 위로 물러나고 노트북이 솟아 화면 가운데를 채운다. 대표 화면이 없으면 프로젝트 데이터로 그린 화면(MockScreen)
 */
const Opening: React.FC<{ project: Project }> = ({ project }) => (
	<Scene len={2.6} className="cn-opening">
		<header className="cn-title">
			<p className="cn-brand">
				{project.icon && <img src={project.icon} alt="" />}
				<span>{project.name}</span>
			</p>
			<h1>
				<Letters text={project.tagline || project.name} />
			</h1>
			{project.description && <p className="cn-lead">{project.description}</p>}
			<Links project={project} className="sp-links cn-hero-links" />
		</header>
		<div className="cn-poster">
			<DeviceFrame kind="laptop" src={project.image} alt={`${project.name} 화면`}>
				{!project.image && <MockScreen project={project} decorative />}
			</DeviceFrame>
		</div>
	</Scene>
);

/** 기능 장면의 번호 (01 / 04) */
const Counter: React.FC<{ index: number; total: number }> = ({ index, total }) => (
	<p className="cn-counter" aria-hidden="true">
		<span>{String(index + 1).padStart(2, '0')}</span>
		<small>/ {String(total).padStart(2, '0')}</small>
	</p>
);

/**
 * 기능 장면 하나: 앞 장면 위로 아래서부터 밀고 들어온다.
 * 그림이 있으면 무대에 꽉 차고 캡션은 그림 위에. 없으면 글과 제품 화면이 좌우로 짝을 짓는다
 * (짝수 차례는 그 기능을 고른 MockScreen을 창 틀에, 홀수 차례는 그 기능의 FeatureVisual을 옅은 판에. 좌우는 번갈아)
 */
const Feature: React.FC<{ project: Project; point: ProjectPoint; index: number; total: number; image?: string }> = ({
	project,
	point,
	index,
	total,
	image,
}) => {
	const caption = (
		<>
			<p className="cn-caption-eyebrow">
				{point.icon && <i className={`fa-solid ${point.icon}`} aria-hidden="true" />}
				{shortName(project)}
			</p>
			<h3>{point.title}</h3>
			<p>{point.body}</p>
			{point.detail && <p className="cn-caption-detail">{point.detail}</p>}
		</>
	);
	if (image)
		return (
			<Scene len={2.2} className="cn-feature">
				<div className="cn-frame">
					<Media src={image} alt="" className="cn-frame-img" />
				</div>
				<Counter index={index} total={total} />
				<div className="cn-caption">{caption}</div>
			</Scene>
		);
	return (
		<Scene len={2.2} className={`cn-feature cn-split${index % 2 ? ' cn-split-flip' : ''}`}>
			<Counter index={index} total={total} />
			<div className="cn-split-text cn-caption">{caption}</div>
			<div className="cn-split-visual">
				{index % 2 === 0 ? (
					<DeviceFrame kind="browser" url={project.demo}>
						<MockScreen project={project} focus={index} decorative />
					</DeviceFrame>
				) : (
					<div className="cn-panel">
						<FeatureVisual point={point} index={index} project={project} />
					</div>
				)}
			</div>
		</Scene>
	);
};

/** 숫자 장면: 숫자가 거대하게, 스크롤하는 만큼 하나씩 바뀐다. 페이지 안에서 하나뿐인 어두운 띠 (키노트의 포인트) */
const Numbers: React.FC<{ project: Project }> = ({ project }) => {
	const n = project.facts.length;
	return (
		<Scene len={1 + n * 0.7} className="cn-numbers">
			<ul style={cssVars({ n })} aria-label="한눈에 보는 숫자">
				{project.facts.map((fact, i) => (
					<li key={fact.label} style={cssVars({ i })}>
						<FactValue text={fact.value} />
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		</Scene>
	);
};

/** 만든 방식 칸 하나 (벤토): 큰 칸·넓은 칸은 위에 그 항목의 비주얼, 작은 칸은 큰 번호와 글만 */
const BuildCard: React.FC<{ project: Project; point: ProjectPoint; index: number; size: 'lg' | 'wide' | 'sm' }> = ({
	project,
	point,
	index,
	size,
}) => (
	<article className="cn-card" data-size={size}>
		{size === 'lg' && (
			<div className="cn-card-visual">
				<FeatureVisual point={point} index={index + 1} project={project} />
			</div>
		)}
		<div className="cn-card-text">
			<span className="cn-no">{String(index + 1).padStart(2, '0')}</span>
			<h3>{point.title}</h3>
			<p>{point.body}</p>
			{point.detail && <p className="cn-detail">{point.detail}</p>}
		</div>
	</article>
);

/**
 * 끝 장면: 만든 방식(벤토), 쓰는 법(거대한 번호), 맡은 일·진행 과정, 기술 사양 표, 흐르는 기술 이름, 마지막 행동 유도 띠
 */
const Credits: React.FC<{ project: Project }> = ({ project }) => {
	const usage = project.usage ?? [];
	const tech =
		project.language && !project.stack.includes(project.language)
			? [project.language, ...project.stack]
			: project.stack;
	const meta = [project.context, project.role, project.period].filter(Boolean).join(' · ');
	return (
		<footer className="cn-credits">
			{project.build.length > 0 && (
				<Region label="만든 방식" className="cn-block">
					<div data-reveal="">
						<SectionHeader eyebrow="설계와 구현" title="만든 방식" align="start" />
					</div>
					{project.id === 'macfolio' && <Pipeline />}
					<div data-reveal="">
						<BentoGrid
							items={project.build}
							label="만든 방식 목록"
							itemKey={(point) => point.title}
							framed={false}
							render={(point, cell, i) => <BuildCard project={project} point={point} index={i} size={cell.size} />}
						/>
					</div>
				</Region>
			)}
			{usage.length > 0 && (
				<Region label="쓰는 법" className="cn-block">
					<div data-reveal="">
						<SectionHeader eyebrow="시작하기" title="쓰는 법" align="start" />
					</div>
					<ol className="cn-steps" style={cssVars(fitGrid(usage.length, 4))}>
						{usage.map((point, i) => (
							<li key={point.title} data-reveal="" style={cssVars({ d: i })}>
								<span className="cn-step-no">{i + 1}</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p className="cn-detail">{point.detail}</p>}
							</li>
						))}
					</ol>
				</Region>
			)}
			<div className="cn-sheet">
				{project.contributions.length > 0 && (
					<Region label="맡은 일" className="cn-block">
						<h2 data-reveal="">맡은 일</h2>
						{project.role && <p className="cn-role">{project.role}</p>}
						<ul className="cn-list">
							{project.contributions.map((item, i) => (
								<li key={item} data-reveal="" style={cssVars({ d: i })}>
									{item}
								</li>
							))}
						</ul>
					</Region>
				)}
				{project.timeline && project.timeline.length > 0 && (
					<Region label="진행 과정" className="cn-block">
						<h2 data-reveal="">진행 과정</h2>
						<ol className="cn-timeline">
							{project.timeline.map((step, i) => (
								<li key={`${step.date}-${step.label}`} data-reveal="" style={cssVars({ d: i })}>
									<time>{step.date}</time>
									<span>{step.label}</span>
								</li>
							))}
						</ol>
					</Region>
				)}
			</div>
			{project.specs.length > 0 && (
				<Region label="기술 사양" className="cn-block">
					<h2 data-reveal="">기술 사양</h2>
					<dl className="cn-specs">
						{project.specs.map((spec, i) => (
							<div key={spec.label} data-reveal="" style={cssVars({ d: i })}>
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</Region>
			)}
			<div className="cn-end" data-reveal="">
				{meta && <p className="cn-end-meta">{meta}</p>}
				<LogoStrip items={tech} caption="만든 기술" marquee />
			</div>
			<CtaBand project={project} className="cn-cta" />
		</footer>
	);
};

const CinemaPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	return (
		<div className="cn" ref={root}>
			<Opening project={project} />
			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="cn-features">
					<h2 className="visually-hidden">주요 기능</h2>
					{project.highlights.map((point, i) => (
						<Feature
							key={point.title}
							project={project}
							point={point}
							index={i}
							total={project.highlights.length}
							image={point.image ?? point.shots?.[0]?.src}
						/>
					))}
				</Region>
			)}
			{project.facts.length > 0 && <Numbers project={project} />}
			{project.id === 'macfolio' && <Devices />}
			<Credits project={project} />
		</div>
	);
};

export default CinemaPage;

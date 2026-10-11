// 시네마: 한 화면씩 고정되는 장면. 스크롤 진행도(--p)로 큰 화면이 솟고 밀려나고, 글자가 차례로 떠오른다
import React, { useEffect, useRef } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { FactValue, Links, Region } from '@/apps/safari/project/parts';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import { cssVars } from '@/shared/lib/cssVars';
import Devices from '@/apps/safari/project/product/Devices';
import Pipeline from '@/apps/safari/project/product/Pipeline';
import '@/apps/safari/project/CinemaPage.css';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const isVideo = (src: string) => src.endsWith('.mp4');

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

/** 첫 장면: 검은 화면에 제목이 글자마다 번지듯 나타나고, 대표 화면이 아래서 솟아 화면을 채운다 */
const Opening: React.FC<{ project: Project }> = ({ project }) => (
	<Scene len={2.8} className="cn-opening">
		<header className="cn-title">
			<p className="cn-brand">
				{project.icon && <img src={project.icon} alt="" />}
				<span>{project.name}</span>
			</p>
			<h1>
				<Letters text={project.tagline || project.name} />
			</h1>
			{project.description && <p className="cn-lead">{project.description}</p>}
		</header>
		{project.image && (
			<figure className="cn-poster">
				<Media src={project.image} alt={`${project.name} 화면`} />
			</figure>
		)}
		<p className="cn-hint" aria-hidden="true">
			<span>스크롤</span>
			<i />
		</p>
	</Scene>
);

/** 기능 장면 하나: 그림이 무대에 꽉 차 있고, 앞 장면 위로 아래서부터 밀고 들어온다. 캡션은 그림 위에 */
const Feature: React.FC<{ point: ProjectPoint; index: number; total: number; image?: string }> = ({
	point,
	index,
	total,
	image,
}) => {
	const stage = useRef<HTMLDivElement>(null);
	// 마우스가 있는 쪽으로 그림이 살짝 기운다 (움직임 줄이기에서는 CSS가 transform을 끈다)
	const tilt = (event: React.MouseEvent<HTMLDivElement>) => {
		const node = stage.current;
		if (!node) return;
		const box = node.getBoundingClientRect();
		node.style.setProperty('--mx', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
		node.style.setProperty('--my', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
	};
	const rest = () => {
		stage.current?.style.setProperty('--mx', '0');
		stage.current?.style.setProperty('--my', '0');
	};
	return (
		<Scene len={2.2} className={`cn-feature ${image ? '' : 'no-image'}`}>
			<div className="cn-frame" ref={stage} onMouseMove={tilt} onMouseLeave={rest}>
				{image ? (
					<Media src={image} alt="" className="cn-frame-img" />
				) : (
					<span className="cn-frame-blank" aria-hidden="true">
						{point.icon ? <i className={`fa-solid ${point.icon}`} /> : String(index + 1).padStart(2, '0')}
					</span>
				)}
			</div>
			<p className="cn-counter" aria-hidden="true">
				<span>{String(index + 1).padStart(2, '0')}</span>
				<small>/ {String(total).padStart(2, '0')}</small>
			</p>
			<div className="cn-caption">
				<h3>{point.title}</h3>
				<p>{point.body}</p>
			</div>
		</Scene>
	);
};

/** 숫자 장면: 숫자가 거대하게, 스크롤하는 만큼 하나씩 바뀐다 */
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

/** 끝 장면: 어두운 평면 표 (만든 방식, 맡은 일, 기술 사양, 진행 과정), 링크 */
const Credits: React.FC<{ project: Project }> = ({ project }) => (
	<footer className="cn-credits">
		{project.build.length > 0 && (
			<Region label="만든 방식" className="cn-block">
				<h2 data-reveal="">만든 방식</h2>
				{project.id === 'macfolio' && <Pipeline />}
				<ol className="cn-build">
					{project.build.map((point, i) => (
						<li key={point.title} data-reveal="" style={cssVars({ d: i })}>
							<span className="cn-no">{String(i + 1).padStart(2, '0')}</span>
							<div>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</div>
						</li>
					))}
				</ol>
			</Region>
		)}
		<div className="cn-sheet">
			{project.contributions.length > 0 && (
				<Region label="맡은 일" className="cn-block">
					<h2 data-reveal="">맡은 일</h2>
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
			<p className="cn-end-meta">{[project.context, project.role, project.period].filter(Boolean).join(' · ')}</p>
			<p className="cn-end-title">{project.name}</p>
			<Links project={project} className="sp-links cn-links" />
		</div>
	</footer>
);

const CinemaPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	// 기능 그림이 없는 항목은 대표 화면으로 대신하고, 그것도 없으면 글만
	const fallback = project.image;
	return (
		<div className="cn" ref={root}>
			<Opening project={project} />
			{project.highlights.length > 0 && (
				<Region label="주요 기능" className="cn-features">
					<h2 className="visually-hidden">주요 기능</h2>
					{project.highlights.map((point, i) => (
						<Feature
							key={point.title}
							point={point}
							index={i}
							total={project.highlights.length}
							image={point.image ?? point.shots?.[0]?.src ?? (i === 0 ? fallback : undefined)}
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

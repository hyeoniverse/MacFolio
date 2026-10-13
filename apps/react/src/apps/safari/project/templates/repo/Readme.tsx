// repo 템플릿의 README: 랜딩 구역을 GitHub가 그리는 마크다운처럼 그린다. 숫자는 README 첫머리의 지표 칸, 기능은 그림 카드,
// 화면은 스크린숏 표, 쓰는 법은 번호 목록, 만든 방식은 카드, 이야기는 인용과 표, 조작법은 글쇠 표, 진행 과정은 릴리스 목록,
// 기술은 Built with 주제와 표와 폴더 구조 코드 블록, 맡은 일은 할 일 목록, 출처는 표
import React from 'react';
import type { ProjectFact } from '@/shared/profile';
import {
	iconOf,
	LandingSections,
	type Landing,
	Media,
	type LandingMedia,
	type LandingPoint,
	type SectionRenderers,
} from '@/apps/safari/project/landing';
import { LANGUAGE_COLORS, tagsOf } from './repo';

/** 항목의 그림 전부: 첫 장은 크게, 나머지는 작은 줄 */
const PointMedia: React.FC<{ point: LandingPoint; className?: string }> = ({ point, className }) => {
	const [first, ...more] = point.media;
	if (!first) return null;
	return (
		<div className={['rp-media', className].filter(Boolean).join(' ')}>
			<div className="rp-shot">
				<Media media={first} />
			</div>
			{more.length > 0 && (
				<ul className="rp-thumbs" aria-label={`${point.title} 화면 더 보기`}>
					{more.map((media) => (
						<li key={media.src} className="rp-shot">
							<Media media={media} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

const Shot: React.FC<{ media: LandingMedia }> = ({ media }) => (
	<div className="rp-shot">
		<Media media={media} />
	</div>
);

const Icon: React.FC<{ point: Pick<LandingPoint, 'icon'>; index: number; className?: string }> = ({
	point,
	index,
	className = 'rp-md-icon',
}) => <i className={`${className} fa-solid ${iconOf(point, index)}`} aria-hidden="true" />;

/** 값을 숫자와 단위로 나눠 숫자를 크게 (120개 → 120 + 개) */
const Figure: React.FC<{ fact: ProjectFact }> = ({ fact }) => {
	const match = /^([+\-−]?[\d.,]+)\s*(.*)$/.exec(fact.value.trim());
	return (
		<strong className="rp-figure">
			{match ? (
				<>
					{match[1]}
					{match[2] && <span className="rp-figure-unit">{match[2]}</span>}
				</>
			) : (
				fact.value
			)}
		</strong>
	);
};

/**
 * 두 칸 격자에서 빈칸이 남지 않게: 그림이 있는 카드는 한 줄을 다 쓰고, 그림 없는 카드가 홀수 개 이어지면 그 마지막 카드가 한 줄을 다 쓴다
 */
const wideOf = (items: LandingPoint[]) =>
	items.map((point, i) => {
		if (point.media.length) return true;
		let start = i;
		while (start > 0 && !items[start - 1].media.length) start -= 1;
		let end = i;
		while (end < items.length - 1 && !items[end + 1].media.length) end += 1;
		return i === end && (end - start + 1) % 2 === 1;
	});

/** 링크가 걸린 이름 (새 탭) */
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const README_RENDERERS: SectionRenderers = {
	stats: ({ section }) => (
		<>
			<h2 className="visually-hidden">{section.label}</h2>
			<dl className="rp-pulse" data-count={section.facts.length}>
				{section.facts.map((fact) => (
					<div key={fact.label}>
						<dt>{fact.label}</dt>
						<dd>
							<Figure fact={fact} />
						</dd>
					</div>
				))}
			</dl>
		</>
	),
	features: ({ section }) => {
		const wide = wideOf(section.items);
		return (
			<>
				<h2>{section.label}</h2>
				<ul className="rp-features">
					{section.items.map((point, i) => (
						<li
							key={point.title}
							className="rp-feature"
							data-media={point.media.length ? '' : undefined}
							data-wide={wide[i] || undefined}
						>
							{point.media.length > 0 && <PointMedia point={point} className="rp-feature-media" />}
							<div className="rp-feature-text">
								<h3>
									<Icon point={point} index={i} />
									{point.title}
								</h3>
								<p>{point.body}</p>
								{point.detail && <p className="rp-md-detail">{point.detail}</p>}
							</div>
						</li>
					))}
				</ul>
			</>
		);
	},
	screens: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			<ul className="rp-screens" data-count={section.shots.length}>
				{section.shots.map((shot) => (
					<li key={shot.src}>
						<figure>
							<Shot media={shot} />
							<figcaption>{shot.caption}</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</>
	),
	steps: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			<ol className="rp-steps">
				{section.items.map((point, i) => (
					<li key={point.title}>
						<h3>
							{point.title}
							<Icon point={point} index={i} className="rp-md-icon rp-md-icon-end" />
						</h3>
						<p>{point.body}</p>
						{point.detail && <p className="rp-md-detail">{point.detail}</p>}
						{point.media.length > 0 && <PointMedia point={point} />}
					</li>
				))}
			</ol>
		</>
	),
	built: ({ section }) => {
		const wide = wideOf(section.items);
		return (
			<>
				<h2>{section.label}</h2>
				<ul className="rp-build">
					{section.items.map((point, i) => (
						<li key={point.title} data-media={point.media.length ? '' : undefined} data-wide={wide[i] || undefined}>
							<span className="rp-build-icon" aria-hidden="true">
								<i className={`fa-solid ${iconOf(point, i + 3)}`} />
							</span>
							<div className="rp-build-text">
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								{point.detail && <p className="rp-md-detail">{point.detail}</p>}
							</div>
							{point.media.length > 0 && <PointMedia point={point} className="rp-build-media" />}
						</li>
					))}
				</ul>
			</>
		);
	},
	stories: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			<div className="rp-stories">
				{section.stories.map((story) => (
					<article key={story.title} className="rp-story" aria-label={story.title}>
						<h3>{story.title}</h3>
						{story.lead && <blockquote className="rp-quote">{story.lead}</blockquote>}
						<div className="rp-story-body" data-image={story.image ? '' : undefined}>
							<div className="rp-story-text">
								{story.facts.length > 0 && (
									<dl className="rp-story-facts">
										{story.facts.map((fact) => (
											<div key={fact.label}>
												<dt>{fact.label}</dt>
												<dd>
													<Figure fact={fact} />
												</dd>
											</div>
										))}
									</dl>
								)}
								{story.points.length > 0 && (
									<ul className="rp-story-points">
										{story.points.map((point, i) => (
											<li key={point.title}>
												<h4>
													<Icon point={point} index={i} />
													{point.title}
												</h4>
												<p>{point.body}</p>
												{point.detail && <p className="rp-md-detail">{point.detail}</p>}
												{point.media.length > 0 && <PointMedia point={point} />}
											</li>
										))}
									</ul>
								)}
							</div>
							{story.image && <Shot media={story.image} />}
						</div>
					</article>
				))}
			</div>
		</>
	),
	controls: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			<table className="rp-table">
				<thead>
					<tr>
						<th scope="col">글쇠</th>
						<th scope="col">하는 일</th>
					</tr>
				</thead>
				<tbody>
					{section.controls.map((control, i) => (
						<tr key={`${control.label}-${i}`}>
							<td>
								{control.keys.map((key, k) => (
									<kbd key={`${key}-${k}`} className="rp-kbd">
										{key}
									</kbd>
								))}
							</td>
							<td>{control.label}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
	timeline: ({ section }) => {
		const tags = tagsOf(section.entries.length);
		// 최근 릴리스가 위로 (GitHub 릴리스 목록처럼)
		const list = section.entries.map((entry, i) => ({ ...entry, tag: tags[i] })).reverse();
		return (
			<>
				<h2>
					{section.label}
					<span className="rp-count">{section.entries.length}</span>
				</h2>
				<ol className="rp-releases">
					{list.map((entry, i) => (
						<li key={`${entry.date}-${entry.label}`} data-latest={i === 0 || undefined}>
							<span className="rp-release-dot" aria-hidden="true" />
							<div className="rp-release-main">
								<p className="rp-release-tag">
									<i className="fa-solid fa-tag" aria-hidden="true" />
									<code>{entry.tag}</code>
									{i === 0 && <span className="rp-latest-badge">Latest</span>}
								</p>
								<p className="rp-release-label">{entry.label}</p>
							</div>
							<time className="rp-release-date">{entry.date}</time>
						</li>
					))}
				</ol>
			</>
		);
	},
	tech: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			{section.stack.length > 0 && (
				<ul className="rp-topics" aria-label="쓴 기술">
					{section.stack.map((item) => (
						<li key={item}>
							{LANGUAGE_COLORS[item] && (
								<i className="rp-dot" style={{ background: LANGUAGE_COLORS[item] }} aria-hidden="true" />
							)}
							{item}
						</li>
					))}
				</ul>
			)}
			{section.specs.length > 0 && (
				<table className="rp-table">
					<thead>
						<tr>
							<th scope="col">분야</th>
							<th scope="col">쓴 것</th>
						</tr>
					</thead>
					<tbody>
						{section.specs.map((spec) => (
							<tr key={spec.label}>
								<th scope="row">{spec.label}</th>
								<td>{spec.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{section.structure && (
				<figure className="rp-code-block">
					<figcaption>
						<i className="fa-regular fa-folder-open" aria-hidden="true" /> 폴더 구조
					</figcaption>
					<pre>
						<code>{section.structure}</code>
					</pre>
				</figure>
			)}
		</>
	),
	role: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			{(section.role || section.context || section.period) && (
				<dl className="rp-role-meta">
					{section.role && (
						<div>
							<dt>역할</dt>
							<dd>{section.role}</dd>
						</div>
					)}
					{section.context && (
						<div>
							<dt>프로젝트</dt>
							<dd>{section.context}</dd>
						</div>
					)}
					{section.period && (
						<div>
							<dt>기간</dt>
							<dd className="rp-mono">{section.period}</dd>
						</div>
					)}
				</dl>
			)}
			{section.contributions.length > 0 && (
				<ul className="rp-tasks">
					{section.contributions.map((item) => (
						<li key={item}>
							<span className="rp-task-box" aria-hidden="true">
								<i className="fa-solid fa-check" />
							</span>
							{item}
						</li>
					))}
				</ul>
			)}
		</>
	),
	credits: ({ section }) => (
		<>
			<h2>{section.label}</h2>
			<table className="rp-table rp-credits">
				<thead>
					<tr>
						<th scope="col">쓴 곳</th>
						<th scope="col">이름</th>
						<th scope="col">만든 곳</th>
					</tr>
				</thead>
				<tbody>
					{section.credits.map((credit) => (
						<tr key={`${credit.role}-${credit.name}`}>
							<td>{credit.role}</td>
							<td>
								{credit.href ? (
									<a href={credit.href} {...external}>
										{credit.name}
									</a>
								) : (
									<strong>{credit.name}</strong>
								)}
								{credit.note && <span className="rp-credit-note">{credit.note}</span>}
							</td>
							<td>{credit.by}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	),
};

/** README 안의 구역들 (모든 랜딩 구역을 차례대로) */
export const ReadmeSections: React.FC<{ landing: Landing }> = ({ landing }) => (
	<LandingSections landing={landing} renderers={README_RENDERERS} className="rp-section" />
);

// 프로젝트 페이지들이 함께 쓰는 조각: 아이콘, 링크 단추, 숫자, 화면 캡처, 이름 붙은 구역
import React from 'react';
import type { Project } from '@/shared/profile';
import { projectAppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/AppStateContext';
import { splitNumber, useCountUp } from '@/apps/safari/project/reveal';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 프로젝트 아이콘. 아이콘이 없는 프로젝트와 시작 페이지는 기본 모양 */
export const Favicon: React.FC<{ project?: Project; className?: string }> = ({
	project,
	className = 'safari-favicon',
}) =>
	project?.icon ? (
		<img src={project.icon} alt="" className={className} />
	) : (
		<span className={`${className} fallback`} aria-hidden="true">
			<i className={project ? 'fa-solid fa-book' : 'fa-regular fa-star'} />
		</span>
	);

/** 여기서 실행, 데모, GitHub 링크 */
export const Links: React.FC<{ project: Project; className?: string }> = ({ project, className = 'sp-links' }) => {
	const { openApp } = useAppState();
	// 이 사이트 안에서 바로 열 수 있는 프로젝트 (데모를 창으로 띄우는 앱, shared/profile.ts의 app)
	const app = projectAppName(project.id);
	const playable = Boolean(app);

	return (
		<div className={className}>
			{playable && (
				<button type="button" className="sp-pill" onClick={() => app && openApp(app)}>
					{project.app?.play ? '여기서 플레이' : '여기서 열기'}
				</button>
			)}
			{project.demo && (
				<a className={playable ? 'sp-link' : 'sp-pill'} href={project.demo} {...external}>
					{playable ? (
						<>
							새 탭에서 열기 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</>
					) : (
						'데모 보기'
					)}
				</a>
			)}
			<a className="sp-link" href={project.url} {...external}>
				GitHub에서 보기 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
			</a>
		</div>
	);
};

/** 큰 숫자와 설명 */
/** 숫자 하나: 화면에 들어오면 세어 올라간다 (숫자가 없는 값은 그대로) */
export const FactValue: React.FC<{ text: string }> = ({ text }) => {
	const parts = splitNumber(text);
	const { ref, value } = useCountUp(parts?.value ?? 0);
	if (!parts) return <strong>{text}</strong>;
	return (
		<strong ref={ref}>
			<span className="visually-hidden">{text}</span>
			<span aria-hidden="true">
				{parts.before}
				{value}
				{parts.after}
			</span>
		</strong>
	);
};

export const Facts: React.FC<{ project: Project; className?: string }> = ({ project, className = 'sp-facts' }) => (
	<ul className={className}>
		{project.facts.map((fact) => (
			<li key={fact.label}>
				<FactValue text={fact.value} />
				<span>{fact.label}</span>
			</li>
		))}
	</ul>
);

/** 화면 캡처 */
export const Shot: React.FC<{ project: Project; className?: string }> = ({ project, className = 'sp-shot' }) => (
	<figure className={className}>
		<img src={project.image} alt={`${project.name} 화면`} />
	</figure>
);

/** 이름 붙은 구역 (보조 기술과 시험이 이름으로 찾는다: 주요 기능, 만든 방식, 맡은 일, 기술 사양 …) */
export const Region: React.FC<
	{ label: string; as?: 'section' | 'aside' | 'div' } & React.HTMLAttributes<HTMLElement>
> = ({ label, as: Tag = 'section', children, ...rest }) => (
	<Tag aria-label={label} role={Tag === 'div' ? 'region' : undefined} {...rest}>
		{children}
	</Tag>
);

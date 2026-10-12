// 항목 하나(point)에 그림이 없을 때 쓰는 비주얼: 큰 아이콘 타일 + 그 항목 제목을 담은 추상 UI 조각(작은 창, 토스트, 토글, 칩, 고리)
import React from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { cssVars } from '@/shared/lib/cssVars';
import { FEATURE_VARIANTS, iconOf, mockSeries, shortName, type FeatureVariant } from './mock';
import './landing.css';
import './feature.css';

export interface FeatureVisualProps {
	point: ProjectPoint;
	/** 항목의 차례: 변형(toast·window·orbit·meter)과 아이콘·색을 고른다 */
	index: number;
	/** 앱 이름·기술 칩을 빌려 올 프로젝트 (없으면 그 조각을 뺀다) */
	project?: Project;
	/** 변형을 직접 고른다 (기본: index로 돌아가며) */
	variant?: FeatureVariant;
	/** 바탕: light 밝게, dark 어둡게 (기본: 페이지 테마) */
	tone?: 'light' | 'dark';
	className?: string;
}

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`fa-solid ${name}`} />;

/** 글 없는 자리 표시 막대 */
const Sk: React.FC<{ w: number }> = ({ w }) => <span className="lk-sk" style={cssVars({ w: `${w}%` })} />;

/** 장식 그림 (보조 기술에는 숨긴다: 제목·설명은 곁의 글이 읽힌다) */
export const FeatureVisual: React.FC<FeatureVisualProps> = ({ point, index, project, variant, tone, className }) => {
	const kind = variant ?? FEATURE_VARIANTS[((index % 4) + 4) % 4];
	const icon = iconOf(point, index);
	const chips = (point.variants?.map((item) => item.label) ?? project?.stack ?? []).slice(0, 5);
	const values = mockSeries(`${point.title}-${index}`, 7);
	return (
		<div
			className={`lk-root lk-feature${className ? ` ${className}` : ''}`}
			data-variant={kind}
			data-lk-tone={tone}
			style={cssVars({ hue: (index * 37) % 360 })}
			aria-hidden="true"
		>
			<span className="lk-feature-bg" />
			{kind === 'toast' && (
				<>
					<span className="lk-feature-card lk-feature-back">
						<span className="lk-feature-back-side">
							<i data-on="" />
							<i />
							<i />
							<i />
						</span>
						<span className="lk-feature-back-main">
							<b>{point.title}</b>
							<Sk w={70} />
							<span className="lk-feature-bars lk-feature-bars-sm">
								{values.map((v, i) => (
									<i key={i} style={cssVars({ v, i })} />
								))}
							</span>
						</span>
					</span>
					<span className="lk-feature-icon">
						<Icon name={icon} />
					</span>
					<span className="lk-feature-toast">
						<span className="lk-feature-toast-icon">
							<Icon name="fa-check" />
						</span>
						<span className="lk-feature-text">
							{project && <small>{shortName(project)}</small>}
							<b>{point.title}</b>
						</span>
					</span>
				</>
			)}
			{kind === 'window' && (
				<>
					<span className="lk-feature-window">
						<span className="lk-feature-window-bar">
							<i />
							<i />
							<i />
						</span>
						<span className="lk-feature-window-body">
							<b>{point.title}</b>
							{[0, 1, 2].map((i) => (
								<span key={i} className="lk-feature-setting">
									<Sk w={[58, 44, 66][i]} />
									<span className="lk-feature-switch" data-on={i !== 1 ? '' : undefined} />
								</span>
							))}
						</span>
					</span>
					<span className="lk-feature-icon lk-feature-icon-float">
						<Icon name={icon} />
					</span>
				</>
			)}
			{kind === 'orbit' && (
				<>
					<span className="lk-feature-ring lk-feature-ring-1" />
					<span className="lk-feature-ring lk-feature-ring-2" />
					<span className="lk-feature-icon lk-feature-icon-center">
						<Icon name={icon} />
					</span>
					{chips.map((chip, i) => (
						<span key={chip} className="lk-feature-chip" style={cssVars({ i, n: chips.length })}>
							{chip}
						</span>
					))}
					{chips.length === 0 && <span className="lk-feature-chip lk-feature-chip-title">{point.title}</span>}
				</>
			)}
			{kind === 'meter' && (
				<>
					<span className="lk-feature-meter" style={cssVars({ v: values[values.length - 1] })}>
						<span className="lk-feature-icon lk-feature-icon-center">
							<Icon name={icon} />
						</span>
					</span>
					<span className="lk-feature-panel">
						<b>{point.title}</b>
						<span className="lk-feature-bars">
							{values.map((v, i) => (
								<i key={i} style={cssVars({ v, i })} />
							))}
						</span>
					</span>
				</>
			)}
		</div>
	);
};

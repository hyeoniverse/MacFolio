// 히어로 뒤에 까는 바탕: 단색 위에 아주 옅은 격자·점 무늬 (가장자리로 갈수록 사라진다). glow를 켜면 강조색 한 덩어리가 옅게 번진다
import React from 'react';
import './landing.css';

export interface GlowBackdropProps {
	/** dark 어두운 바탕, light 밝은 바탕 (기본: 사이트 테마를 따른다) */
	tone?: 'dark' | 'light';
	/** 바탕 무늬: grid 가는 격자(기본), dots 점, none 무늬 없이 단색 */
	pattern?: 'grid' | 'dots' | 'none';
	/** 무늬(와 빛)가 모이는 곳: top 위 가운데(히어로), center 가운데(띠), side 오른쪽(글이 왼쪽인 히어로) */
	focus?: 'top' | 'center' | 'side';
	/** 강조색 빛 한 덩어리를 옅게 (기본 끔: 절제한 단색 바탕) */
	glow?: boolean;
	/** 빛 덩어리가 천천히 움직인다 (glow일 때만, 기본 끔. 움직임 줄이기를 켜면 멈춘다) */
	animate?: boolean;
	className?: string;
}

/** 부모(position: relative) 뒤를 꽉 채우는 장식 층. 부모의 글은 z-index 1 이상으로 올려 둔다 */
export const GlowBackdrop: React.FC<GlowBackdropProps> = ({
	tone,
	pattern = 'grid',
	focus = 'top',
	glow = false,
	animate = false,
	className,
}) => (
	<div
		className={`lk-root lk-glow${className ? ` ${className}` : ''}`}
		data-lk-tone={tone}
		data-pattern={pattern}
		data-focus={focus}
		data-animate={glow && animate ? '' : undefined}
		aria-hidden="true"
	>
		{glow && <span className="lk-glow-blob" />}
		{pattern !== 'none' && <span className="lk-glow-pattern" />}
	</div>
);

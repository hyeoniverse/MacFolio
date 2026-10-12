// 히어로 뒤에 까는 빛: 메시 그라데이션(강조색 둘), 빛 번짐, 가장자리로 갈수록 옅어지는 격자·점 무늬 (Linear·Vercel 풍)
import React from 'react';
import './landing.css';

export interface GlowBackdropProps {
	/** dark 어두운 바탕에 밝은 빛, light 밝은 바탕에 옅은 빛 */
	tone?: 'dark' | 'light';
	/** 바탕 무늬: grid 가는 격자, dots 점, none 무늬 없이 빛만 */
	pattern?: 'grid' | 'dots' | 'none';
	/** 빛이 모이는 곳: top 위 가운데(히어로), center 가운데(띠), side 오른쪽(글이 왼쪽인 히어로) */
	focus?: 'top' | 'center' | 'side';
	/** 빛 덩어리가 천천히 떠다닌다 (움직임 줄이기를 켜면 멈춘다) */
	animate?: boolean;
	className?: string;
}

/** 부모(position: relative) 뒤를 꽉 채우는 장식 층. 부모의 글은 z-index 1 이상으로 올려 둔다 */
export const GlowBackdrop: React.FC<GlowBackdropProps> = ({
	tone = 'dark',
	pattern = 'grid',
	focus = 'top',
	animate = true,
	className,
}) => (
	<div
		className={`lk-root lk-glow${className ? ` ${className}` : ''}`}
		data-lk-tone={tone}
		data-pattern={pattern}
		data-focus={focus}
		data-animate={animate ? '' : undefined}
		aria-hidden="true"
	>
		<span className="lk-glow-blob lk-glow-a" />
		<span className="lk-glow-blob lk-glow-b" />
		<span className="lk-glow-blob lk-glow-c" />
		{pattern !== 'none' && <span className="lk-glow-pattern" />}
		<span className="lk-glow-beam" />
		<span className="lk-glow-noise" />
	</div>
);

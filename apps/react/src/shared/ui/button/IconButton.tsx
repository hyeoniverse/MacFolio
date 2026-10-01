import type { ButtonHTMLAttributes, Ref } from 'react';
import '@/shared/ui/button/IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** 단추 이름 (스크린 리더). title을 따로 주지 않으면 마우스를 올렸을 때도 이 이름이 보인다 */
	label?: string;
	/** Font Awesome 클래스 (예: 'fa-solid fa-trash-can'). 그린 아이콘(SVG)이나 글자는 children으로 */
	icon?: string;
	/** 켜진 상태 (고정됨, 서식 창 열림 등). aria-pressed·aria-expanded는 쓰는 곳에서 따로 준다 */
	on?: boolean;
	/** tool: 도구 막대의 네모난 단추 / float: 떠 있는 동그란 단추 (메일·메시지) */
	variant?: 'tool' | 'float';
	ref?: Ref<HTMLButtonElement>;
}

/**
 * 아이콘 단추. 색은 앱마다 정한 --ui-* 변수를 따른다 (IconButton.css).
 * 앱의 CSS에서 크기 등을 바꿀 수 있다: 이 단추의 CSS는 components 층이라 층 밖의 규칙이 늘 이긴다.
 */
const IconButton = ({
	label,
	icon,
	on = false,
	variant = 'tool',
	className,
	title,
	type = 'button',
	children,
	ref,
	...rest
}: IconButtonProps) => (
	<button
		ref={ref}
		type={type}
		className={['ui-icon-button', variant, on && 'on', className].filter(Boolean).join(' ')}
		aria-label={label}
		title={title ?? label}
		{...rest}
	>
		{icon && <i className={icon} aria-hidden="true" />}
		{children}
	</button>
);

export default IconButton;

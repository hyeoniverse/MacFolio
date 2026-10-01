import type { ButtonHTMLAttributes, Ref } from 'react';
import '@/shared/ui/button/Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** default: 옅은 바탕 / primary: 강조 색 바탕 (보내기, 확인) / danger: 되돌릴 수 없는 일 (삭제) */
	tone?: 'default' | 'primary' | 'danger';
	/** 글자 앞 아이콘 (Font Awesome 클래스) */
	icon?: string;
	ref?: Ref<HTMLButtonElement>;
}

/**
 * 글자가 있는 단추. 모양과 색은 앱마다 정한 --ui-button-*·--ui-accent 변수를 따른다 (Button.css).
 * CSS가 components 층이라 앱의 CSS로 여백·글꼴 등을 덧붙여 바꿀 수 있다.
 */
const Button = ({ tone = 'default', icon, className, type = 'button', children, ref, ...rest }: ButtonProps) => (
	<button
		ref={ref}
		type={type}
		className={['ui-button', tone !== 'default' && tone, className].filter(Boolean).join(' ')}
		{...rest}
	>
		{icon && <i className={icon} aria-hidden="true" />}
		{children}
	</button>
);

export default Button;

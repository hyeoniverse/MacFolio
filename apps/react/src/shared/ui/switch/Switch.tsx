import type { InputHTMLAttributes } from 'react';
import '@/shared/ui/switch/Switch.css';

export interface SwitchProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'type' | 'role' | 'size' | 'onChange'
> {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** regular: 시스템 설정의 스위치 / small: 폼 줄 안의 작은 스위치 (macOS의 mini 크기) */
	size?: 'regular' | 'small';
}

/**
 * 켜고 끄는 스위치 (macOS 토글): role="switch"인 checkbox.
 * 이름은 감싼 label이나 aria-label로 준다. 꺼졌을 때 바탕과 초점 테두리 색은 앱이 정한다 (Switch.css)
 */
const Switch = ({ size = 'regular', className, onChange, ...input }: SwitchProps) => (
	<input
		type="checkbox"
		role="switch"
		className={`ui-switch ${size}${className ? ` ${className}` : ''}`}
		onChange={(event) => onChange(event.target.checked)}
		{...input}
	/>
);

export default Switch;

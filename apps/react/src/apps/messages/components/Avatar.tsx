import { cssVars } from '@/shared/lib/cssVars';
import React from 'react';
import { monogram } from '../conversations';

/** macOS 연락처 아바타: 연보라 그라데이션 위에 이름 글자 */
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
	const text = monogram(name);
	return (
		<span
			className="messages-avatar"
			aria-hidden="true"
			// 크기만 넘기고, 글자 크기는 CSS가 정한다 (두 글자면 작게)
			data-letters={text.length > 1 ? 2 : 1}
			style={cssVars({ size: `${size}px` })}
		>
			{text}
		</span>
	);
};

export default Avatar;

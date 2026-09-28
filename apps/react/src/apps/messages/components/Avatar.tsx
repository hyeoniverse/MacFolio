import React from 'react';
import { monogram } from '../conversations';

/** macOS 연락처 아바타: 연보라 그라데이션 위에 이름 글자 */
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
	const text = monogram(name);
	return (
		<span
			className="messages-avatar"
			aria-hidden="true"
			style={{ width: size, height: size, fontSize: size * (text.length > 1 ? 0.36 : 0.46) }}
		>
			{text}
		</span>
	);
};

export default Avatar;

import React from 'react';
import { avatarGradient } from '../conversations';

/** macOS 연락처 아바타: 이름 첫 글자 + 이름마다 정해진 색 */
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
	const [from, to] = avatarGradient(name);
	return (
		<span
			className="messages-avatar"
			aria-hidden="true"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.42,
				background: `linear-gradient(180deg, ${from}, ${to})`,
			}}
		>
			{Array.from(name)[0]}
		</span>
	);
};

export default Avatar;

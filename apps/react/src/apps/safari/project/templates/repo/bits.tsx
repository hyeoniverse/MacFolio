// repo 템플릿의 작은 조각: 커밋 타입 뱃지, 복사 버튼
import React, { useEffect, useRef, useState } from 'react';
import { typeStyle } from './repo';

export const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
	<span className="rp-badge" style={typeStyle(type)}>
		{type}
	</span>
);

/** 글을 복사하는 버튼: 누르면 클립보드에 넣고 알림 줄에 결과를 적는다 */
export const CopyButton: React.FC<{ text: string; label: string; className?: string; children?: React.ReactNode }> = ({
	text,
	label,
	className,
	children,
}) => {
	const [status, setStatus] = useState('');
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setStatus('복사했습니다.');
		} catch {
			setStatus('복사하지 못했습니다. 글을 직접 선택해 주세요.');
		}
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setStatus(''), 2400);
	};
	return (
		<>
			<button type="button" className={className} onClick={copy} aria-label={label}>
				{children}
				<i className={status === '복사했습니다.' ? 'fa-solid fa-check' : 'fa-regular fa-copy'} aria-hidden="true" />
			</button>
			<span className="visually-hidden" role="status">
				{status}
			</span>
		</>
	);
};

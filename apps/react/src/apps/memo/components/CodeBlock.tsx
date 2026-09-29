import React, { useEffect, useRef, useState } from 'react';

/** 코드 블록: 오른쪽 위의 복사 단추로 코드를 클립보드에 넣는다 (편집기의 코드 블록도 같은 모양) */
const CodeBlock = ({ children, ...props }: React.ComponentProps<'pre'>) => {
	const pre = useRef<HTMLPreElement>(null);
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);

	return (
		<div className="memo-code">
			<pre ref={pre} {...props}>
				{children}
			</pre>
			<button
				type="button"
				className="memo-code-copy"
				aria-label="코드 복사"
				onClick={() => {
					// Markdown 코드 블록은 끝에 줄바꿈이 하나 붙어 있어서 뺀다 (편집기의 복사와 같게)
					void navigator.clipboard?.writeText((pre.current?.textContent ?? '').replace(/\n$/, ''));
					setCopied(true);
				}}
			>
				{copied ? '복사됨' : '복사'}
			</button>
		</div>
	);
};

export default CodeBlock;

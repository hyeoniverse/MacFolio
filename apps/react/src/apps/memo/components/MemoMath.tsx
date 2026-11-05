import { useEffect, useState } from 'react';
import './MemoMath.css';

type Katex = typeof import('katex').default;

/** KaTeX와 그 CSS는 수식이 있는 글을 처음 열 때 한 번만 불러온다 */
let katexLoading: Promise<Katex> | null = null;
const loadKatex = () =>
	(katexLoading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
		([module]) => module.default
	));

/**
 * 본문의 수식 하나 (math.ts가 표시한 <memo-math>). 불러오는 동안과 식이 틀렸을 때는 식을 글자로 보인다.
 * KaTeX는 trust 없이 그리므로 \href 같은 명령은 막히고, 화면 읽기 프로그램을 위해 MathML도 함께 넣는다
 */
const MemoMath = ({ tex, display }: { tex: string; display: boolean }) => {
	const [html, setHtml] = useState<string | null>(null);
	useEffect(() => {
		let alive = true;
		void loadKatex().then((katex) => {
			if (!alive) return;
			try {
				setHtml(katex.renderToString(tex, { displayMode: display, throwOnError: true, output: 'htmlAndMathml' }));
			} catch {
				setHtml(null);
			}
		});
		return () => {
			alive = false;
		};
	}, [tex, display]);

	const Tag = display ? 'div' : 'span';
	if (html === null)
		return (
			<Tag className={`memo-math memo-math-source ${display ? 'memo-math-block' : ''}`}>
				<code>{tex}</code>
			</Tag>
		);
	return <Tag className={`memo-math ${display ? 'memo-math-block' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default MemoMath;

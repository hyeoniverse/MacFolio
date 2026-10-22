import { useState } from 'react';
import { seoulDate } from './model';
import { otherQuoteIndex, QUOTES, quoteIndexOf } from './quotes';
import { useNow } from './useNow';
import type { WidgetSize } from './catalog';

/**
 * 명언: 개발·디자인·만들기에 관한 짧은 말 (날마다 바뀐다, 서울 기준). 누르면 다른 말을 무작위로.
 * 작게는 원문과 말한 사람, 중간은 우리말까지
 */
const QuoteWidget = ({ size }: { size: WidgetSize }) => {
	const now = seoulDate(useNow(60_000));
	const day = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
	// 누르면 고른 말. 고르기 전에는 그날의 말
	const [picked, setPicked] = useState<number | null>(null);
	const index = picked ?? quoteIndexOf(day, 0, QUOTES.length);
	const quote = QUOTES[index];
	return (
		<button
			type="button"
			className="widget-quote-body"
			aria-label={`${quote.text} — ${quote.author}. 다른 말 보기`}
			onClick={() => setPicked(otherQuoteIndex(index, QUOTES.length))}
		>
			<span className="widget-quote-mark" aria-hidden="true">
				“
			</span>
			<span key={index} className="widget-quote-text motion-swap">
				<q lang="en">{quote.text}</q>
				{size === 'medium' && <span className="widget-quote-ko">{quote.ko}</span>}
			</span>
			<span className="widget-note widget-quote-author">— {quote.author}</span>
		</button>
	);
};

export default QuoteWidget;

import { useState } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import { seoulDate } from './model';
import { otherQuoteIndex, QUOTES, quoteIndexOf } from './quotes';
import { useNow } from './useNow';
import type { WidgetSize } from './catalog';

/**
 * 명언: 개발·디자인·만들기에 관한 짧은 말 (날마다 바뀐다, 서울 기준). 누르면 다른 말을 무작위로.
 * 작게는 원문과 말한 사람, 중간은 우리말까지.
 * 판 전체를 단추로 만들지 않는다: 위젯 끌기·오른쪽 클릭 메뉴는 단추 위에서 시작하지 않으므로(DesktopWidgets),
 * 다른 위젯이 빈 곳을 누르면 앱을 여는 것처럼 빈 곳을 누르면 다른 말을 보이고, 키보드로는 오른쪽 위의 단추로 바꾼다
 */
const QuoteWidget = ({ size }: { size: WidgetSize }) => {
	const now = seoulDate(useNow(60_000));
	const day = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
	// 누르면 고른 말. 고르기 전에는 그날의 말
	const [picked, setPicked] = useState<number | null>(null);
	const index = picked ?? quoteIndexOf(day, 0, QUOTES.length);
	const quote = QUOTES[index];
	const another = () => setPicked(otherQuoteIndex(index, QUOTES.length));
	return (
		<div className="widget-quote-body" onClick={another}>
			<span className="widget-quote-mark" aria-hidden="true">
				“
			</span>
			<IconButton
				variant="circle"
				icon="fa-solid fa-shuffle"
				label="다른 말 보기"
				className="widget-quote-next"
				onClick={(event) => {
					// 판의 클릭과 겹쳐 두 번 바뀌지 않게
					event.stopPropagation();
					another();
				}}
			/>
			<blockquote key={index} className="widget-quote-text motion-swap" aria-live="polite">
				<q lang="en">{quote.text}</q>
				{size === 'medium' && <span className="widget-quote-ko">{quote.ko}</span>}
			</blockquote>
			<span className="widget-note widget-quote-author">— {quote.author}</span>
		</div>
	);
};

export default QuoteWidget;

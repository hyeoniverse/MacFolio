/**
 * 공유 아이콘 (iOS·macOS의 공유 모양): 위가 트인 둥근 네모에서 화살표가 올라온다.
 * Font Awesome에는 이 모양이 없어 직접 그린다. 글자 크기(1em)를 따르고 색은 글자색.
 */
const ShareIcon = ({ className }: { className?: string }) => (
	<svg
		className={className}
		width="1em"
		height="1.15em"
		viewBox="0 0 24 27"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		{/* 상자: 위 가운데가 트여 화살표가 지나간다 */}
		<path d="M8 10H6.5A2.5 2.5 0 0 0 4 12.5v9A2.5 2.5 0 0 0 6.5 24h11a2.5 2.5 0 0 0 2.5-2.5v-9a2.5 2.5 0 0 0-2.5-2.5H16" />
		{/* 화살표 */}
		<path d="M12 2.5v14" />
		<path d="M8 6.5l4-4 4 4" />
	</svg>
);

export default ShareIcon;

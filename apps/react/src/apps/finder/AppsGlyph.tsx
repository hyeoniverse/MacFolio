/**
 * 응용 프로그램 위치 아이콘: macOS Finder 사이드바처럼 막대 세 개가 엇갈린 'A' (App Store 모양).
 * 두 다리는 위에서 서로 지나쳐 엇갈리고, 가로 막대는 다리 밖까지 나간다. 글자색(currentColor)을 따르고, 크기는 1em 또는 size
 */
const AppsGlyph = ({ size = '1em', strokeWidth = 2.1 }: { size?: number | string; strokeWidth?: number }) => (
	<svg
		className="apps-glyph"
		width={size}
		height={size}
		viewBox="0 0 18 18"
		fill="none"
		stroke="currentColor"
		strokeWidth={strokeWidth}
		strokeLinecap="round"
		aria-hidden="true"
	>
		<path d="M10.6 2.6 4.2 15.4" />
		<path d="M7.4 2.6 13.8 15.4" />
		<path d="M2.6 11.6h12.8" />
	</svg>
);

export default AppsGlyph;

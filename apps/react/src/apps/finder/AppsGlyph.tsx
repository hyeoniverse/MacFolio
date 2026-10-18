/**
 * 응용 프로그램 위치 아이콘: macOS Finder 사이드바처럼 연필·붓·자로 짠 'A' (SF Symbols의 app.dashed가 아니라 응용 프로그램 폴더 모양).
 * 글자색(currentColor)을 따르고, 크기는 글자 크기(1em) 또는 size
 */
const AppsGlyph = ({ size = '1em', strokeWidth = 1.6 }: { size?: number | string; strokeWidth?: number }) => (
	<svg
		className="apps-glyph"
		width={size}
		height={size}
		viewBox="0 0 18 18"
		fill="none"
		stroke="currentColor"
		strokeWidth={strokeWidth}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		{/* 왼쪽 다리: 연필 (끝이 뾰족) */}
		<path d="M9 2.2 3.4 15.6" />
		<path d="m2.9 13.4 1 2.8 2.2-1.9" />
		{/* 오른쪽 다리: 붓 */}
		<path d="M9 2.2 14.6 15.6" />
		{/* 가로대: 자 (눈금) */}
		<path d="M3.2 11.2h11.6" />
		<path d="M6.2 11.2v1.3M9 11.2v1.3M11.8 11.2v1.3" strokeWidth={strokeWidth * 0.7} />
	</svg>
);

export default AppsGlyph;

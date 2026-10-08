import IconButton from '@/shared/ui/button/IconButton';

/** 사이드바 여닫기 (SF Symbols의 sidebar.left 모양). 메모·사진이 쓴다. 크기는 앱의 CSS가 className으로 정한다 */
const SidebarToggle = ({ open, onToggle, className }: { open: boolean; onToggle: () => void; className?: string }) => (
	<IconButton
		className={className}
		label={open ? '사이드바 가리기' : '사이드바 보기'}
		aria-expanded={open}
		onClick={onToggle}
	>
		<svg viewBox="0 0 20 16" aria-hidden="true">
			<rect x="1" y="1" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<line x1="7.5" y1="1.5" x2="7.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" />
			<line x1="3.2" y1="5" x2="5.3" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="3.2" y1="7.5" x2="5.3" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
		</svg>
	</IconButton>
);

export default SidebarToggle;

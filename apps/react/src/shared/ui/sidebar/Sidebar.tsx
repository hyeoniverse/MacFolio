import type { HTMLAttributes } from 'react';
import '@/shared/ui/sidebar/Sidebar.css';

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
	/**
	 * flat: 창 왼쪽에 붙은 사이드바 (오른쪽 구분선, 사이드바 바탕) /
	 * floating: 창 안에 떠 있는 둥근 판 (macOS 26). 바탕·그림자·폭·여백은 앱이 정한다
	 */
	variant: 'flat' | 'floating';
	/** 목록을 고르는 사이드바는 nav, 그 밖의 칸은 aside */
	as?: 'nav' | 'aside';
}

/** 창 왼쪽 사이드바의 공통 모양 (Sidebar.css). 앱 CSS가 className으로 덧붙인다 */
const Sidebar = ({ variant, as: Tag = 'nav', className, ...props }: SidebarProps) => (
	<Tag className={`ui-sidebar ${variant}${className ? ` ${className}` : ''}`} {...props} />
);

export default Sidebar;

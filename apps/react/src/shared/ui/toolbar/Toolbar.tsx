import type { HTMLAttributes } from 'react';
import '@/shared/ui/toolbar/Toolbar.css';

/**
 * 창 위의 도구 막대: 가로로 늘어놓고 세로 가운데, 높이는 창 제목 막대와 같다 (--toolbar-height).
 * 여백·테두리·바탕은 앱이 className으로 정한다. 화살표 키로 옮기는 막대가 아니므로 role="toolbar"는 붙이지 않는다
 */
const Toolbar = ({ as: Tag = 'div', className, ...props }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'header' }) => (
	<Tag className={`ui-toolbar${className ? ` ${className}` : ''}`} {...props} />
);

export default Toolbar;

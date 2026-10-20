import type { HTMLAttributes } from 'react';
import '@/shared/ui/empty-state/EmptyState.css';

/**
 * 빈 상태·불러오는 중 문구 ("메모 없음", "불러오는 중…"): 흐린 글자, 가운데 정렬.
 * 여백·글자 크기·흐린 색은 앱이 className으로 정한다. 목록 안에서는 as="li"
 */
const EmptyState = ({
	as: Tag = 'p',
	className,
	...props
}: HTMLAttributes<HTMLElement> & { as?: 'p' | 'li' | 'div' }) => (
	<Tag className={`ui-empty${className ? ` ${className}` : ''}`} {...props} />
);

export default EmptyState;

import type { ButtonHTMLAttributes, LiHTMLAttributes } from 'react';

export interface ListRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
	/** 지금 고른 줄 (aria-current). 칠하기는 쓰는 쪽의 className이 한다 */
	current?: boolean;
	/** 줄을 감싼 li에 붙일 속성 (className·aria-hidden 등) */
	item?: LiHTMLAttributes<HTMLLIElement>;
}

/**
 * 목록에서 고르는 한 줄: <li> 안의 버튼. 고른 줄은 aria-current로 알린다.
 * 줄의 구성(아이콘·두 줄 글자·날짜)과 모양은 앱마다 달라서 children과 className으로 정한다
 */
const ListRow = ({ current, item, children, ...button }: ListRowProps) => (
	<li {...item}>
		<button type="button" aria-current={current || undefined} {...button}>
			{children}
		</button>
	</li>
);

export default ListRow;

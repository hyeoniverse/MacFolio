import type { InputHTMLAttributes } from 'react';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
	/** 칸 이름 (스크린 리더). placeholder를 따로 주지 않으면 placeholder로도 쓴다 */
	label: string;
	/** 칸을 감싸는 label에 붙일 이름 (모양은 쓰는 쪽의 CSS) */
	className?: string;
}

/**
 * 돋보기가 붙은 검색 칸: label 안에 돋보기와 type="search" 입력. 지우기(×)는 브라우저의 search 칸이 맡는다.
 * 모양은 앱마다 다르므로 쓰는 쪽 CSS가 className으로 정한다. 나머지 props는 input에 그대로 간다
 */
const SearchField = ({ label, className, placeholder = label, ...input }: SearchFieldProps) => (
	<label className={className}>
		<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
		<input type="search" aria-label={label} placeholder={placeholder} {...input} />
	</label>
);

export default SearchField;

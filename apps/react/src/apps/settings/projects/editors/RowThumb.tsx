/** 줄 오른쪽의 16:10 썸네일 (그림이 없으면 빈 칸) */
export const RowThumb = ({ src }: { src?: string }) => (
	<span className={`projects-row-thumb ${src ? 'filled' : 'empty'}`} aria-hidden="true">
		{src ? <img src={src} alt="" loading="lazy" /> : <i className="fa-regular fa-image" />}
	</span>
);

import type { EmbedBlock } from '../embedBlock';
import MarkdownLink from './MarkdownLink';

/** iframe에 허용하는 기능: 동영상 재생(암호화 미디어, 화면 속 화면, 전체 화면)과 코드 예제의 클립보드 복사 */
export const EMBED_ALLOW = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

/**
 * 주소만 한 줄로 적은 바깥 링크의 임베드 (YouTube·Vimeo·CodePen 등, desktop-core memo/embeds.ts).
 * 화면에 들어올 때 불러오고(loading="lazy"), 아래에 원래 주소로 가는 링크를 둔다.
 * 편집기는 같은 모양을 writer/embedPreview.ts가 DOM으로 그린다
 */
const MemoEmbed = ({ block: { href, embed } }: { block: EmbedBlock }) => (
	<figure className="memo-embed" data-provider={embed.provider}>
		<div
			className="memo-embed-frame"
			style={embed.aspectRatio ? { aspectRatio: embed.aspectRatio } : { height: embed.height }}
		>
			<iframe
				src={embed.src}
				title={`${embed.name} 임베드`}
				loading="lazy"
				allow={EMBED_ALLOW}
				allowFullScreen
				referrerPolicy="strict-origin-when-cross-origin"
			/>
		</div>
		<figcaption>
			<MarkdownLink href={href}>{embed.name}에서 열기</MarkdownLink>
		</figcaption>
	</figure>
);

export default MemoEmbed;

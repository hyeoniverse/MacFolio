import type { MediaBlock } from '../embedBlock';
import MarkdownLink from './MarkdownLink';

/**
 * 글에 넣은 영상·음악 파일의 재생기: 브라우저 기본 <video>·<audio> (controls).
 * 처음에는 길이·첫 장면만 받고(preload="metadata"), 아래에 파일 이름 링크를 둔다 (올린 파일이면 첨부 파일 모양 그대로).
 * 편집기는 같은 모양을 writer/embedPreview.ts가 DOM으로 그린다
 */
const MemoMedia = ({ block: { href, kind, name, title } }: { block: MediaBlock }) => (
	<figure className="memo-media" data-kind={kind}>
		{kind === 'video' ? (
			<video src={href} controls preload="metadata" playsInline aria-label={name} />
		) : (
			<audio src={href} controls preload="metadata" aria-label={name} />
		)}
		<figcaption>
			<MarkdownLink href={href} title={title}>
				{name}
			</MarkdownLink>
		</figcaption>
	</figure>
);

export default MemoMedia;

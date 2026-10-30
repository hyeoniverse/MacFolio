import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import { REMARK_PLUGINS } from '../markdownPlugins';
import { rehypeHighlightCode } from '../highlight';
import MarkdownImage from './MarkdownImage';
import MarkdownLink from './MarkdownLink';
import CodeBlock from './CodeBlock';
import MemoEmbed from './MemoEmbed';
import MemoMedia from './MemoMedia';
import { linkBlockOfParagraph } from '../embedBlock';

/** 코드 블록 문법 강조 (highlight.ts) */
const REHYPE_PLUGINS: Options['rehypePlugins'] = [rehypeHighlightCode];

/** 각주(`[^1]`)의 글 아래 목록 제목과 되돌아가기 링크 이름을 한국어로 (기본값은 영어 "Footnotes") */
const REMARK_REHYPE_OPTIONS: Options['remarkRehypeOptions'] = {
	footnoteLabel: '각주',
	footnoteLabelProperties: { className: ['memo-footnotes-label'] },
	footnoteBackLabel: (index) => `본문의 ${index + 1}번 각주 자리로 돌아가기`,
};

/**
 * 본문 요소 바꾸기. 컴포넌트 밖의 상수여야 한다: 렌더링마다 새 함수를 넘기면
 * react-markdown이 요소를 매번 다시 마운트해서 이미지 크게 보기 같은 상태가 사라진다.
 */
const MARKDOWN_COMPONENTS: Components = {
	// 사이트 안의 글·프로젝트 링크는 사이트 안에서, 바깥 링크는 새 탭에서 연다 (MarkdownLink)
	// 각주 링크는 id(돌아올 자리)와 aria 속성을 그대로 넘긴다
	a: ({ node: _node, href, title, children, ...rest }) => (
		<MarkdownLink href={href} title={title} {...rest}>
			{children}
		</MarkdownLink>
	),
	pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
	// 주소만 한 줄로 적은 YouTube·Vimeo 등의 링크는 임베드로, 영상·음악 파일은 재생기로 (embedBlock.ts)
	p: ({ node, children, ...rest }) => {
		const block = node ? linkBlockOfParagraph(node) : null;
		if (block?.type === 'embed') return <MemoEmbed block={block} />;
		if (block?.type === 'media') return <MemoMedia block={block} />;
		return <p {...rest}>{children}</p>;
	},
	img: ({ src, alt, title }) => (
		<MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
	),
};

/** 메모 본문을 그린다 (읽기 화면, 편집기의 미리 보기, 버전 기록이 같은 모양) */
const MemoMarkdown = ({ children }: { children: string }) => (
	<ReactMarkdown
		remarkPlugins={REMARK_PLUGINS}
		remarkRehypeOptions={REMARK_REHYPE_OPTIONS}
		rehypePlugins={REHYPE_PLUGINS}
		components={MARKDOWN_COMPONENTS}
	>
		{children}
	</ReactMarkdown>
);

export default MemoMarkdown;

import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import { REMARK_PLUGINS } from '../markdownPlugins';
import { rehypeHighlightCode } from '../highlight';
import MarkdownImage from './MarkdownImage';
import MarkdownLink from './MarkdownLink';
import CodeBlock from './CodeBlock';

/** 코드 블록 문법 강조 (highlight.ts) */
const REHYPE_PLUGINS: Options['rehypePlugins'] = [rehypeHighlightCode];

/**
 * 본문 요소 바꾸기. 컴포넌트 밖의 상수여야 한다: 렌더링마다 새 함수를 넘기면
 * react-markdown이 요소를 매번 다시 마운트해서 이미지 크게 보기 같은 상태가 사라진다.
 */
const MARKDOWN_COMPONENTS: Components = {
	// 사이트 안의 글·프로젝트 링크는 사이트 안에서, 바깥 링크는 새 탭에서 연다 (MarkdownLink)
	a: ({ href, title, children }) => (
		<MarkdownLink href={href} title={title}>
			{children}
		</MarkdownLink>
	),
	pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
	img: ({ src, alt, title }) => (
		<MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
	),
};

/** 메모 본문을 그린다 (읽기 화면, 편집기의 미리 보기, 버전 기록이 같은 모양) */
const MemoMarkdown = ({ children }: { children: string }) => (
	<ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
		{children}
	</ReactMarkdown>
);

export default MemoMarkdown;

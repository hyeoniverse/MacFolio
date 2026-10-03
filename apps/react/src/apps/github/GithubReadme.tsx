import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { readmeBlobBase, rehypeGithubReadme } from '@/apps/github/readme';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** 바깥 링크는 새 탭으로 (메일 링크는 그대로) */
const COMPONENTS: Components = {
	a: ({ node: _node, ...props }) => <a {...props} {...(props.href?.startsWith('http') ? external : {})} />,
};

/**
 * 프로필 README를 GitHub처럼 그린다. README의 HTML(가운데 정렬, 표, 그림)은 GitHub와 같은 규칙으로 걸러서
 * (rehype-sanitize의 기본값이 GitHub 규칙이다) 스크립트·이벤트 속성은 그리지 않는다.
 */
const GithubReadme: React.FC<{ markdown: string; login: string; rawBase: string; dark: boolean }> = ({
	markdown,
	login,
	rawBase,
	dark,
}) => (
	<ReactMarkdown
		remarkPlugins={[remarkGfm]}
		rehypePlugins={[
			rehypeRaw,
			rehypeSanitize,
			[rehypeGithubReadme, { rawBase, blobBase: readmeBlobBase(login), dark }],
		]}
		components={COMPONENTS}
	>
		{markdown}
	</ReactMarkdown>
);

export default GithubReadme;

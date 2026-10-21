import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import { rehypeHighlightCode } from '@/apps/memo/highlight';
import { colorSchemeOf, resolveImage, resolveLink } from './repoDocs';
import { DOC_IMAGES, DOC_SOURCES, docSource } from './docsBundle';
import { useResume } from '@/shared/site/resumeStore';
import { projectLinkId } from './resumeModel';
import './DocView.css';

const DOC_SET = new Set(Object.keys(DOC_SOURCES));

/** Mermaid 그림. 라이브러리가 커서 그림이 있는 문서를 처음 열 때 불러온다 */
const MermaidDiagram: React.FC<{ code: string; dark: boolean }> = ({ code, dark }) => {
	const id = `mermaid-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let alive = true;
		import('mermaid')
			.then(async ({ default: mermaid }) => {
				mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
				const { svg: rendered } = await mermaid.render(`${id}-${dark ? 'd' : 'l'}`, code);
				if (alive) setSvg(rendered);
			})
			.catch(() => alive && setFailed(true));
		return () => {
			alive = false;
		};
	}, [code, dark, id]);

	// 그리지 못하면 원문을 그대로 보여 준다
	if (failed) return <pre className="finder-doc-mermaid-source">{code}</pre>;
	if (!svg) return <div className="finder-doc-mermaid loading" aria-label="그림을 그리는 중" />;
	// securityLevel strict: Mermaid가 라벨의 HTML을 걸러서 만든 SVG다
	return <div className="finder-doc-mermaid" role="img" dangerouslySetInnerHTML={{ __html: svg }} />;
};

const codeText = (children: React.ReactNode): string =>
	React.Children.toArray(children)
		.map((child) =>
			typeof child === 'string'
				? child
				: React.isValidElement<{ children?: React.ReactNode }>(child)
					? codeText(child.props.children)
					: ''
		)
		.join('');

interface DocViewProps {
	/** 저장소 경로 (예: docs/deployment.md) */
	path: string;
	dark: boolean;
	/** 다른 문서 링크를 누르면 Finder에서 연다 */
	onOpenDoc: (path: string) => void;
	/** 이력서의 프로젝트 링크를 누르면 Safari에서 연다 */
	onOpenProject?: (id: string) => void;
}

/**
 * 저장소 문서를 GitHub처럼 그린다. 문서 안의 HTML(가운데 정렬, 그림)은 GitHub와 같은 규칙으로 거르고
 * (rehype-sanitize의 기본값), 코드 블록은 메모와 같은 색으로, mermaid 코드 블록은 그림으로 그린다.
 */
const DocView: React.FC<DocViewProps> = ({ path, dark, onOpenDoc, onOpenProject }) => {
	// 이력서는 관리자가 고치면 바로 다시 그린다 (저장소 문서는 바뀌지 않는다)
	useResume();
	const source = docSource(path) ?? '';
	const openDoc = useRef(onOpenDoc);
	const openProject = useRef(onOpenProject);
	useEffect(() => {
		openDoc.current = onOpenDoc;
		openProject.current = onOpenProject;
	});

	// 렌더링마다 새 컴포넌트를 넘기면 react-markdown이 요소를 다시 마운트해서,
	// 창을 누를 때(맨 앞으로 오며 다시 그린다) 링크가 바뀌어 클릭이 사라진다. 문서·화면 모드가 바뀔 때만 새로 만든다
	const components = useMemo<Components>(
		() => ({
			a: ({ node: _node, href = '', children, ...props }) => {
				const projectId = projectLinkId(href);
				if (projectId)
					return (
						<a
							{...props}
							href={href}
							onClick={(event) => {
								event.preventDefault();
								openProject.current?.(projectId);
							}}
						>
							{children}
						</a>
					);
				const target = resolveLink(path, href, DOC_SET);
				if (target.type === 'doc')
					return (
						<a
							{...props}
							href={`#${target.path}`}
							onClick={(event) => {
								event.preventDefault();
								openDoc.current(target.path);
							}}
						>
							{children}
						</a>
					);
				return (
					<a {...props} href={target.url} target="_blank" rel="noopener noreferrer">
						{children}
					</a>
				);
			},
			img: ({ node: _node, src, alt, ...props }) => (
				<img
					{...props}
					src={typeof src === 'string' ? resolveImage(path, src, DOC_IMAGES) : undefined}
					alt={alt ?? ''}
					loading="lazy"
				/>
			),
			// 라이트·다크 그림(<picture>): 사이트의 화면 모드에 맞는 것만 남기고 주소를 묶은 그림으로 바꾼다
			source: ({ node: _node, srcSet, media, ...props }) => {
				const scheme = colorSchemeOf(media);
				if (scheme && scheme !== (dark ? 'dark' : 'light')) return null;
				const src = typeof srcSet === 'string' ? resolveImage(path, srcSet, DOC_IMAGES) : undefined;
				return <source {...props} srcSet={src} media={scheme ? undefined : media} />;
			},
			pre: ({ node, children, ...props }) => {
				const code = node?.children[0];
				const classes =
					code && code.type === 'element' ? (code.properties.className as string[] | undefined) : undefined;
				if (classes?.includes('language-mermaid'))
					return <MermaidDiagram code={codeText(children).trim()} dark={dark} />;
				return <pre {...props}>{children}</pre>;
			},
		}),
		[path, dark]
	);

	return (
		<article key={path} className="finder-doc motion-swap" aria-label={path}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkCjkFriendly]}
				rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlightCode]}
				components={components}
			>
				{source}
			</ReactMarkdown>
		</article>
	);
};

export default DocView;

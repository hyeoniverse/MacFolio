import { useEffect, useRef } from 'react';
import { defaultValueCtx, Editor, editorViewOptionsCtx, remarkStringifyOptionsCtx, rootCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { isInTable } from '@milkdown/kit/prose/tables';
import { trailing } from '@milkdown/kit/plugin/trailing';
import { cursor } from '@milkdown/kit/plugin/cursor';
import { $prose } from '@milkdown/kit/utils';
import type { ElementContent } from 'hast';
import { highlightTree } from '../highlight';
import { uploadAndInsert } from './attachments';
import { handleTableKey } from './tableCommands';
import TableHandles from './TableHandles';
import { findPlugin } from './findPlugin';
import { codeBlockView, imageBlockRemark, imageBlockSchema, imageBlockView, inlineImageView } from './blocks';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { CONTENT_IMAGES } from '../contentImages';
import { editorControls, EMPTY_FORMAT, type Box } from './editorControls';
import { formatStateOf, runFormat } from './formatCommands';
import { fromEditorMarkdown, plainTableAlign, toEditorMarkdown } from './markdownImages';

interface Props {
	/** 처음 본문 (Markdown) */
	markdown: string;
	/** 고칠 때마다 바뀐 본문 (Markdown) */
	onChange: (markdown: string) => void;
	placeholder?: string;
}

/** 체크 항목의 네모(왼쪽 여백)를 눌렀는지 */
const CHECKBOX_HIT_PX = 26;

/** 편집기 기준으로 잰 위치 */
const boxOf = (el: Element, origin: DOMRect): Box => {
	const rect = el.getBoundingClientRect();
	return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
};

/** 커서가 있는 표와 칸의 위치 (표 손잡이용) */
function tableBoxOf(view: EditorView) {
	if (!isInTable(view.state)) return null;
	const root = view.dom.closest('.memo-inline-editor');
	const { node } = view.domAtPos(view.state.selection.from);
	const cell = (node instanceof Element ? node : node.parentElement)?.closest('td, th');
	const table = cell?.closest('table');
	if (!root || !cell || !table) return null;
	const origin = root.getBoundingClientRect();
	// 고른 칸들을 모두 감싸는 사각형 (행·열 전체를 고르면 그 둘레에 테두리를 그린다)
	const selected = [...table.querySelectorAll('.selectedCell')].map((el) => el.getBoundingClientRect());
	const selection =
		selected.length > 0
			? {
					left: Math.min(...selected.map((rect) => rect.left)) - origin.left,
					top: Math.min(...selected.map((rect) => rect.top)) - origin.top,
					width: Math.max(...selected.map((rect) => rect.right)) - Math.min(...selected.map((rect) => rect.left)),
					height: Math.max(...selected.map((rect) => rect.bottom)) - Math.min(...selected.map((rect) => rect.top)),
				}
			: null;
	return { table: boxOf(table, origin), cell: boxOf(cell, origin), selection };
}

const publish = (view: EditorView) =>
	editorControls.setState((current) => ({
		...current,
		state: formatStateOf(view.state),
		tableBox: tableBoxOf(view),
	}));

/** 커서 자리의 서식(과 표 위치)을 도구 막대에 알린다 (글이나 커서가 바뀔 때, 창 크기가 바뀔 때) */
const publishFormat = $prose(
	() =>
		new Plugin({
			view: (view) => {
				publish(view);
				// 표 위치는 그린 뒤에 한 번 더 잰다 (바로 뒤에 글꼴·이미지·위 문단 때문에 자리가 바뀔 수 있다)
				let frame = 0;
				const remeasure = () => {
					cancelAnimationFrame(frame);
					frame = requestAnimationFrame(() => publish(view));
				};
				// 창 크기나 편집기 높이가 바뀌면(이미지를 다 불러오는 등) 다시 잰다
				const resize = new ResizeObserver(remeasure);
				resize.observe(view.dom);
				window.addEventListener('resize', remeasure);
				return {
					update: (next, prev) => {
						if (
							next.state.doc !== prev.doc ||
							!next.state.selection.eq(prev.selection) ||
							next.state.storedMarks !== prev.storedMarks
						) {
							publish(next);
							remeasure();
						}
					},
					destroy: () => {
						cancelAnimationFrame(frame);
						resize.disconnect();
						window.removeEventListener('resize', remeasure);
					},
				};
			},
		})
);

/** 커서가 있는 표에는 칸 선을, 지금 칸에는 옅은 배경을 (읽기 화면에는 없는 편집용 표시) */
const activeTable = $prose(
	() =>
		new Plugin({
			props: {
				decorations: (state) => {
					const { $from } = state.selection;
					const decorations: Decoration[] = [];
					for (let depth = $from.depth; depth > 0; depth--) {
						const name = $from.node(depth).type.name;
						if (name === 'table_cell' || name === 'table_header')
							decorations.push(
								Decoration.node($from.before(depth), $from.after(depth), { class: 'memo-cell-current' })
							);
						if (name === 'table') {
							decorations.push(
								Decoration.node($from.before(depth), $from.after(depth), { class: 'memo-table-active' })
							);
							break;
						}
					}
					return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
				},
			},
		})
);

/** 코드 블록 문법 강조 (읽기 화면과 같은 lowlight, 같은 색). 글이 바뀔 때마다 다시 칠한다 */
function highlightDecorations(doc: Node) {
	const decorations: Decoration[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== 'code_block') return true;
		const tree = highlightTree(node.attrs.language, node.textContent);
		if (!tree) return false;
		let offset = pos + 1;
		const walk = (children: ElementContent[], classes: string[]) => {
			for (const child of children) {
				if (child.type === 'text') {
					if (classes.length)
						decorations.push(Decoration.inline(offset, offset + child.value.length, { class: classes.join(' ') }));
					offset += child.value.length;
				} else if (child.type === 'element') {
					const own = Array.isArray(child.properties.className) ? child.properties.className.map(String) : [];
					walk(child.children, [...classes, ...own]);
				}
			}
		};
		walk(tree.children as ElementContent[], []);
		return false;
	});
	return DecorationSet.create(doc, decorations);
}

const codeHighlight = $prose(
	() =>
		new Plugin<DecorationSet>({
			state: {
				init: (_config, state) => highlightDecorations(state.doc),
				apply: (tr, old) => (tr.docChanged ? highlightDecorations(tr.doc) : old),
			},
			props: {
				decorations(state) {
					return this.getState(state);
				},
			},
		})
);

/** 붙여넣거나 끌어다 놓은 파일 (글자가 함께 있으면 글자를 붙여넣는다: 표 계산 앱은 표 그림도 함께 복사한다) */
const filesOf = (data: DataTransfer | null) => (data && !data.getData('text/plain') ? Array.from(data.files) : []);

const Inner = ({ markdown, onChange }: Props) => {
	const onChangeRef = useRef(onChange);
	useEffect(() => {
		onChangeRef.current = onChange;
	});

	const { get } = useEditor(
		(root) =>
			Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, root);
					// 저장소 글의 상대 경로 이미지도 편집기 안에서 보이게 한다
					ctx.set(defaultValueCtx, toEditorMarkdown(markdown, CONTENT_IMAGES));
					// 목록 기호는 지금 글들처럼 '-'로 쓴다
					ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' as const }));
					// 체크 항목: 네모를 누르면 체크를 켜고 끈다
					ctx.update(editorViewOptionsCtx, (options) => ({
						...options,
						// 표 안의 Enter·Tab (편집기 기본 동작보다 먼저)
						handleKeyDown: (view, event) => handleTableKey(ctx, view, event),
						// 이미지·파일을 붙여넣거나 끌어다 놓으면 올리고 그 자리에 넣는다
						handlePaste: (_view, event) => {
							const files = filesOf(event.clipboardData);
							if (!files.length) return false;
							void uploadAndInsert(files);
							return true;
						},
						handleDrop: (view, event, _slice, moved) => {
							const files = moved ? [] : filesOf(event.dataTransfer);
							if (!files.length) return false;
							event.preventDefault();
							const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
							if (at) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at.pos)));
							void uploadAndInsert(files);
							return true;
						},
						handleClickOn: (view, _pos, node, nodePos, event, direct) => {
							if (!direct || node.type.name !== 'list_item' || node.attrs.checked == null) return false;
							const dom = view.nodeDOM(nodePos) as HTMLElement | null;
							if (!dom || event.clientX - dom.getBoundingClientRect().left > CHECKBOX_HIT_PX) return false;
							view.dispatch(
								view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: !node.attrs.checked })
							);
							return true;
						},
					}));
					ctx.get(listenerCtx).markdownUpdated((_ctx, next, prev) => {
						if (next !== prev) onChangeRef.current(plainTableAlign(fromEditorMarkdown(next, CONTENT_IMAGES)));
					});
				})
				.use(commonmark)
				.use(gfm)
				.use(history)
				.use(clipboard)
				.use(listener)
				.use(imageBlockRemark)
				.use(imageBlockSchema)
				.use(imageBlockView)
				.use(inlineImageView)
				.use(codeBlockView)
				// 글 끝이 이미지·표·코드여도 그 아래에 이어 쓸 빈 문단을 둔다
				.use(trailing)
				// 표·이미지 앞뒤처럼 글자를 쓸 수 없는 자리에도 커서를 둘 수 있게 (틈 커서). 거기서 Backspace로 표를 지운다
				.use(cursor)
				.use(publishFormat)
				.use(activeTable)
				.use(findPlugin)
				.use(codeHighlight),
		[]
	);

	// 도구 막대가 이 편집기에 명령을 보낼 수 있게 한다 (편집기가 사라지면 도구 막대도 숨는다)
	const getRef = useRef(get);
	useEffect(() => {
		getRef.current = get;
	});
	useEffect(() => {
		editorControls.setState({
			run: (action) => getRef.current()?.action((ctx) => runFormat(ctx, action)),
		});
		return () => editorControls.setState({ run: null, state: EMPTY_FORMAT, tableBox: null, find: null });
	}, []);

	return (
		<>
			<Milkdown />
			<TableHandles />
		</>
	);
};

/**
 * 보이는 그대로 고치는 본문 편집기 (Milkdown). 제목·굵게·목록·코드·표를 쓰는 모양 그대로 편집하고, 저장은 Markdown으로 한다.
 * 서식은 창 위 도구 막대(FormatTools)나 단축키(⌘B, ⌘I 등)로 바꾼다.
 * 관리자에게만 필요해서 처음 쓸 때 따로 불러온다 (React.lazy).
 */
const InlineEditor = (props: Props) => (
	<div className="memo-inline-editor memo-markdown" data-placeholder={props.placeholder}>
		<MilkdownProvider>
			<Inner {...props} />
		</MilkdownProvider>
	</div>
);

export default InlineEditor;

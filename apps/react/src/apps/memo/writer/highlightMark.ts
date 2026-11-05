// 형광펜(`==강조==`) 서식: 읽기 화면과 같은 규칙(markdownPlugins.ts의 remarkHighlight)으로 읽고, 저장할 때 `==`로 되돌린다
import { commandsCtx } from '@milkdown/kit/core';
import { markRule } from '@milkdown/kit/prose';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $command, $inputRule, $markSchema, $remark, $useKeymap } from '@milkdown/kit/utils';
import { remarkHighlight } from '../markdownPlugins';

interface PhrasingState {
	containerPhrasing: (node: unknown, info: Record<string, unknown>) => string;
}

/** remark가 형광펜 노드를 `==…==`로 쓰게 한다 (remark-stringify의 확장 handlers) */
function remarkHighlightEditor(this: { data: () => object }) {
	const data = this.data() as { toMarkdownExtensions?: unknown[] };
	const extensions = (data.toMarkdownExtensions ??= []);
	extensions.push({
		handlers: {
			highlight: (node: unknown, _parent: unknown, state: PhrasingState, info: Record<string, unknown>) =>
				`==${state.containerPhrasing(node, { ...info, before: '=', after: '=' })}==`,
		},
	});
	return remarkHighlight();
}

export const highlightRemark = $remark('memoHighlight', () => remarkHighlightEditor);

export const highlightSchema = $markSchema('highlight', () => ({
	parseDOM: [{ tag: 'mark' }],
	toDOM: () => ['mark', { class: 'memo-highlight' }, 0],
	parseMarkdown: {
		match: (node) => node.type === 'highlight',
		runner: (state, node, markType) => {
			state.openMark(markType);
			state.next(node.children);
			state.closeMark(markType);
		},
	},
	toMarkdown: {
		match: (mark) => mark.type.name === 'highlight',
		runner: (state, mark) => {
			state.withMark(mark, 'highlight');
		},
	},
}));

export const toggleHighlightCommand = $command('ToggleHighlight', (ctx) => () => toggleMark(highlightSchema.type(ctx)));

/** `==글자==`를 치면 형광펜으로 (여는 `==` 뒤와 닫는 `==` 앞이 공백이면 그대로 둔다) */
export const highlightInputRule = $inputRule((ctx) =>
	markRule(/(?<!=)==([^\s=]|[^\s=][^=]*[^\s=])==$/, highlightSchema.type(ctx))
);

/** ⌘⇧H: 형광펜을 켜고 끈다 */
export const highlightKeymap = $useKeymap('highlightKeymap', {
	ToggleHighlight: {
		shortcuts: 'Mod-Shift-h',
		command: (ctx) => {
			const commands = ctx.get(commandsCtx);
			return () => commands.call(toggleHighlightCommand.key);
		},
	},
});

export const highlightMark = [
	highlightRemark,
	highlightSchema,
	toggleHighlightCommand,
	highlightInputRule,
	highlightKeymap,
].flat();

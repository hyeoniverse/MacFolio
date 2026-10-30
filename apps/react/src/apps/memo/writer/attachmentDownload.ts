import { $prose } from '@milkdown/kit/utils';
import type { Mark } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { downloadFile } from '../download';
import { ATTACHMENT_TITLE } from './attachments';

/**
 * 첨부 파일 배지 안의 내려받기 버튼 [📎 이름 ⬇] (읽기 화면의 MarkdownLink와 같은 모양·이름).
 * 링크 안에 버튼을 둘 수 없어 링크 바로 뒤에 두고, CSS가 배지 오른쪽 여백 안으로 당긴다 (styles/editor-blocks.css)
 */
export function attachmentDownloadButton(href: string, name: string): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-attachment-download';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', `${name} 내려받기`);
	button.title = '내려받기';
	button.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
	// 편집기의 커서와 포커스를 그대로 둔다
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => void downloadFile(href, name));
	return button;
}

const attachmentLinkOf = (marks: readonly Mark[]) =>
	marks.find((mark) => mark.type.name === 'link' && String(mark.attrs.title ?? '').startsWith(ATTACHMENT_TITLE));

/**
 * 편집기 본문의 첨부 파일 링크(제목 '첨부 파일 · …') 끝에 내려받기 버튼 위젯을 붙인다.
 * 링크가 굵게 등으로 여러 글자 조각에 걸쳐 있으면 조각을 이어 파일 이름을 만들고 마지막 조각 뒤에 붙인다
 */
export const attachmentDownload = $prose(
	() =>
		new Plugin({
			props: {
				decorations: (state) => {
					const decorations: Decoration[] = [];
					let name = '';
					state.doc.descendants((node, pos, parent, index) => {
						if (!node.isText) return true;
						const link = attachmentLinkOf(node.marks);
						if (!link) return false;
						name += node.text ?? '';
						const next = parent?.maybeChild(index + 1);
						if (next && link.isInSet(next.marks)) return false;
						const href = String(link.attrs.href);
						const fileName = name.trim();
						name = '';
						decorations.push(
							Decoration.widget(pos + node.nodeSize, () => attachmentDownloadButton(href, fileName), {
								// 링크(<a>) 안이 아니라 바로 뒤에 그린다. 안에 두면 링크 끝의 커서 위치가 버튼 뒤로 잡힌다
								side: 1,
								marks: [],
								key: `download:${href}:${fileName}`,
								ignoreSelection: true,
								stopEvent: () => true,
							})
						);
						return false;
					});
					return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
				},
			},
		})
);

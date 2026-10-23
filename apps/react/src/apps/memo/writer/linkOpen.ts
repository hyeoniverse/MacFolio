// 편집 중인 본문의 링크를 여는 버튼. 편집기에서는 링크를 눌러도 이동하지 않고 그 자리에 커서가 놓인다 (링크 글자를 고칠 수 있게).
// 마우스를 올린 링크의 끝에 작은 버튼을 글줄 안에 끼워 넣는다(장식, 저장하지 않는다). 떠 있는 상자와 달리 다른 글자를 가리지 않는다.
// 같은 글 안의 자리(#각주)는 누르면 이동하므로(anchors.ts) 버튼을 두지 않는다
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { linkActionLabel, linkTargetOf, type LinkTarget } from '../linkTarget';

/** 링크를 여는 함수. 앱을 여는 일은 React 훅(useOpenLink)이 맡아서, 편집기 컴포넌트가 넣어 둔다 */
export const linkOpener: { current: ((target: LinkTarget) => void) | null } = { current: null };

/** 링크에서 버튼으로 마우스를 옮기는 동안 버튼을 남겨 두는 시간 */
const HIDE_DELAY_MS = 300;

interface Hovered {
	/** 링크 글자의 끝 (버튼을 끼울 자리) */
	to: number;
	href: string;
}

const key = new PluginKey<Hovered | null>('memo-link-open');
const hideTimers = new WeakMap<EditorView, number>();

const show = (view: EditorView, hovered: Hovered | null) => {
	window.clearTimeout(hideTimers.get(view));
	const current = key.getState(view.state);
	if (current?.to === hovered?.to && current?.href === hovered?.href) return;
	view.dispatch(view.state.tr.setMeta(key, hovered));
};

const hideSoon = (view: EditorView) => {
	window.clearTimeout(hideTimers.get(view));
	hideTimers.set(
		view,
		window.setTimeout(() => {
			if (!view.isDestroyed && key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, null));
		}, HIDE_DELAY_MS)
	);
};

/** 본문의 링크 요소 (같은 글 안의 자리는 뺀다) */
const linkOf = (view: EditorView, node: EventTarget | null) => {
	const link = node instanceof Element ? node.closest<HTMLAnchorElement>('a[href]') : null;
	const href = link?.getAttribute('href');
	return link && href && !href.startsWith('#') && view.dom.contains(link) ? { link, href } : null;
};

function buttonFor(view: EditorView, hovered: Hovered) {
	const target = linkTargetOf(hovered.href);
	const label = linkActionLabel(target);
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'memo-link-open';
	button.contentEditable = 'false';
	button.setAttribute('aria-label', `${label}: ${hovered.href}`);
	button.title = `${label} (${hovered.href})`;
	const icon = document.createElement('i');
	icon.className = target.kind === 'external' ? 'fa-solid fa-arrow-up-right-from-square' : 'fa-solid fa-arrow-right';
	icon.setAttribute('aria-hidden', 'true');
	button.append(icon);
	// 편집기의 커서와 포커스는 그대로 둔다
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		linkOpener.current?.(target);
		show(view, null);
	});
	button.addEventListener('mouseenter', () => window.clearTimeout(hideTimers.get(view)));
	button.addEventListener('mouseleave', () => hideSoon(view));
	return button;
}

export const linkOpenPlugin = $prose(
	() =>
		new Plugin<Hovered | null>({
			key,
			state: {
				init: () => null,
				apply(tr, value) {
					const meta = tr.getMeta(key) as Hovered | null | undefined;
					if (meta !== undefined) return meta;
					// 글을 고치면 버튼을 거둔다 (링크 자리가 바뀐다)
					return tr.docChanged ? null : value;
				},
			},
			props: {
				decorations(state) {
					const hovered = key.getState(state);
					if (!hovered || hovered.to > state.doc.content.size) return null;
					return DecorationSet.create(state.doc, [
						Decoration.widget(hovered.to, (view) => buttonFor(view, hovered), {
							side: 1,
							ignoreSelection: true,
							stopEvent: () => true,
							key: `${hovered.to}:${hovered.href}`,
						}),
					]);
				},
				handleDOMEvents: {
					mouseover(view, event) {
						const hit = linkOf(view, event.target);
						if (!hit) return false;
						show(view, { to: view.posAtDOM(hit.link, hit.link.childNodes.length), href: hit.href });
						return false;
					},
					mouseout(view, event) {
						const from = linkOf(view, event.target);
						if (!from || linkOf(view, event.relatedTarget)?.link === from.link) return false;
						if ((event.relatedTarget as Element | null)?.closest?.('.memo-link-open')) return false;
						hideSoon(view);
						return false;
					},
				},
				// ⌘·Ctrl을 누르고 링크를 누르면 버튼 없이 바로 연다
				handleClick(view, _pos, event) {
					if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false;
					const hit = linkOf(view, event.target);
					if (!hit) return false;
					linkOpener.current?.(linkTargetOf(hit.href));
					return true;
				},
			},
		})
);

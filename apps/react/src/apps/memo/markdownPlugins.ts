import type { Options } from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';

/**
 * 글을 읽을 때 쓰는 Markdown 규칙: 표 · 취소선 · 체크 목록(GFM), 그리고 한국어 사이의 굵게·기울임.
 * CommonMark 규칙만으로는 `**취소(cancelled)**가`처럼 문장부호 뒤의 `**`에 조사가 바로 붙으면 굵게가 끝나지 않는다.
 * 편집기(writer/InlineEditor.tsx)에도 같은 규칙을 건다.
 */
export const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkCjkFriendly];

// 저장소 글의 원문 (파일 경로 → Markdown). index.ts가 처음 목록을 물을 때 따로 불러온다
export { default as created } from 'virtual:post-created';
export const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });

// 블로그 글 저장소 인터페이스. 지금은 저장소 안의 Markdown 파일을 읽고,
// 관리자 글쓰기(#9)가 생기면 API 구현체를 추가한다.
import type { Post } from '../posts';

export interface PostRepository {
	/** 최신 글이 위로 정렬된 글 목록 */
	list(): Promise<Post[]>;
}

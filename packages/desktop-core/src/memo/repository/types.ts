// 블로그 글 저장소 인터페이스. 지금은 저장소 안의 Markdown 파일을 읽는다 (서버에 쓴 글은 그 위에 겹친다).
import type { Post } from '../posts';

export interface PostRepository {
	/** 최신 글이 위로 정렬된 글 목록 */
	list(): Promise<Post[]>;
}

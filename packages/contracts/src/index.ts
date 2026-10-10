// API 요청·응답의 모양. 스키마(값)와 타입이 같은 이름이라, 서버는 `parse(CommentInput, body)`로 검사하고 화면은 `type Comment`로 쓴다
export { parse, requestBody, type Parsed } from './parse.js';
export { Comment, CommentInput, COMMENT_BODY_MAX, Likes, PostStats } from './comments.js';
export { AdminPost, PostContent, postInput, type PostInput, Revision, RevisionSummary, ServerPost } from './posts.js';
export { Message, MessageInput, PINNED_THREAD_ID, Thread, ThreadCreated } from './messages.js';
export {
	CONTACT_LIMITS,
	ContactInput,
	type ContactFields,
	ContactMail,
	ContactSent,
	ContactStatus,
	contactText,
	REPLY_LIMIT,
	ReplyInput,
} from './contact.js';
export { cleanWallpaperName, Wallpaper, WALLPAPER_NAME_MAX, WallpaperRename } from './wallpapers.js';

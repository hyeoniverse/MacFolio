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
export { IMAGE_TYPES, MAX_UPLOAD_BYTES, Upload, UPLOAD_ID, uploadIdsIn, UploadUsage } from './files.js';
export {
	ADMIN_ONLY_BREAKDOWNS,
	APP_NAME,
	AppViews,
	type Breakdown,
	BREAKDOWNS,
	EVENT_TYPES,
	type EventType,
	EventBatch,
	EventInput,
	LiveVisit,
	MAX_DURATION_MS,
	MAX_EVENTS,
	StatRow as SummaryRow,
	Summary,
	TodayVisitors,
	Totals,
} from './analytics.js';
export { parseProfile, ProfileInput, readProfile, SiteView } from './site.js';

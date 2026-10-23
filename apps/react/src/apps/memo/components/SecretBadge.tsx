/** 본문 위 날짜 줄의 비밀 글 표시 (관리자에게만 보이는 글). 읽기 화면과 편집기가 함께 쓴다 */
const SecretBadge = () => (
	<span className="memo-secret-badge" title="관리자에게만 보입니다. 방문자 목록·검색·RSS·사이트맵에 나오지 않습니다">
		<i className="fa-solid fa-user-lock" aria-hidden="true" /> 비밀 글
	</span>
);

export default SecretBadge;

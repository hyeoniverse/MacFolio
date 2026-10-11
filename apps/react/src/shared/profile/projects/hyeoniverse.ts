import type { Project } from '../types';
import { projectImage } from './projectImage';

export const HYEONIVERSE: Project = {
	id: 'hyeoniverse',
	name: 'HYEONIVERSE',
	look: 'creative',
	tagline: '작업물과 글을, 움직이는 화면으로.',
	description:
		'작업물과 글을 보여 주는 공개 화면부터, 그 글을 직접 쓰고 고치는 관리자 화면까지 한 저장소에 담은 개인 포트폴리오',
	context: '개인 프로젝트 (Next.js 풀스택)',
	role: '기획·디자인, 프론트엔드, Supabase 설계, 관리자 화면',
	period: '2026.02.05 – 운영 중',
	facts: [
		{ value: '97점', label: 'Lighthouse 성능 (LCP 0.7초)' },
		{ value: '100점', label: '접근성 · SEO' },
		{ value: '33건', label: '디자인 결정 기록' },
	],
	highlights: [
		{
			title: '스크롤에 반응하는 첫 화면',
			body: '무한 스크롤 루프, 마우스 패럴랙스, 글자마다 그려지는 외곽선, Three.js 토러스와 커피잔이 스크롤과 마우스를 따라 움직입니다.',
			scrollFrames: ['scroll-1', 'scroll-2', 'scroll-3'].map((name) =>
				projectImage('hyeoniverse', `shots/${name}.jpg`)
			),
			image: projectImage('hyeoniverse', 'shots/home-light.jpg'),
			imageDark: projectImage('hyeoniverse', 'shots/home-dark.jpg'),
		},
		{
			title: '여섯 가지 작업물 레이아웃',
			body: 'Flow, Grid, Cylinder, Fullscreen, Cinematic, Split 중 하나를 관리자 설정이나 ?layout= 주소로 골라 바꿔 끼웁니다.',
			variants: [
				{ label: 'Flow', note: '가로로 끝없이 흐르는 갤러리. 마우스를 따라 기울어진다' },
				{ label: 'Grid', note: '크기가 다른 칸을 12칸 격자에 채운 벤토' },
				{ label: 'Cylinder', note: 'Three.js 원통에 작업물을 감아 돌린다' },
				{ label: 'Fullscreen', note: '화면 가득 배경이 겹쳐 바뀌고, 네 귀퉁이에 시계·FPS HUD' },
				{ label: 'Cinematic', note: '층마다 다른 속도로 움직이는 패럴랙스 영화' },
				{ label: 'Split', note: '왼쪽 정보는 멈추고 오른쪽 작업물만 스크롤' },
			],
		},
		{
			title: '글과 시리즈',
			body: 'SSR과 ISR로 글을 보여 주고, 시리즈와 배너, 여섯 가지 목록 모양, 마크다운 게스트 댓글이나 giscus를 고릅니다.',
			image: projectImage('hyeoniverse', 'shots/posts.jpg'),
		},
		{
			title: '스크롤을 시간축으로',
			body: 'About 페이지는 스크롤을 영상의 재생 막대처럼 써서, 제작 과정을 담은 14개 패널의 장면이 스크롤하는 만큼 이어서 넘어갑니다. 가로로 넘기는 영역에서도 휠이 세로 스크롤과 엉키지 않아, 보고 있던 자리를 잃지 않습니다.',
			video: projectImage('hyeoniverse', 'shots/about-tour.mp4'),
		},
	],
	chapters: [
		{
			title: '한눈에 보는 구조',
			look: 'architecture',
			lead: '방문자와 관리자·저자는 모두 Next.js 16 App Router 한 곳으로 들어옵니다. 데이터와 권한은 Supabase(PostgreSQL과 행 단위 보안)가 맡고, 번역·요약과 메일·분석은 바깥 공급자에게 맡기되 하나가 실패하면 다음으로 넘어갑니다.',
			facts: [
				{ value: '113개', label: 'API 라우트' },
				{ value: '4단계', label: '권한 (DB 규칙)' },
				{ value: '816개', label: '단위 테스트' },
			],
			points: [],
		},
		{
			title: '관리자와 CMS',
			look: 'showcase',
			lead: '글과 작업물을 쓰고, 고치고, 발행하고, 지우는 일을 모두 관리자 화면에서 합니다. 글 한 편이 쓰여 발행되고 휴지통을 거쳐 사라지기까지의 길을 따라, 사이트 문구와 권한까지 코드 배포 없이 바꿉니다.',
			points: [
				{
					title: '세 겹 자동 저장과 버전 확인',
					group: '쓰기',
					body: '입력하는 즉시 브라우저에 초안을 두고, 3초 동안 입력이 없으면 서버에 리비전을 쌓고, 페이지를 떠날 때는 sendBeacon으로 마지막 변경을 보냅니다. 저장할 때는 불러온 버전과 지금 버전을 비교해, 다른 화면이 먼저 저장했으면 409로 돌려보내 덮어쓰지 않습니다.',
					demo: 'autosave',
				},
				{
					title: '하나의 편집기',
					group: '쓰기',
					body: 'Plate.js 편집기에서 마크다운과 리치 텍스트를 오가며 씁니다. 제목·목록·표·코드·각주·콜아웃과 글자색, 형광을 쓰고, 오디오·파일 첨부까지 두 형식 사이에서 그대로 옮겨집니다. 투표·탭·캘린더 블록은 직접 만들어 더했고, 미리보기는 실제 게시 화면과 같은 컴포넌트로 그려 보이는 그대로 발행됩니다.',
					image: projectImage('hyeoniverse', 'shots/cms-editor.jpg'),
				},
				{
					title: '요소마다 떠 있는 도구 막대',
					group: '쓰기',
					body: '노션처럼 고친 그 자리에서 꾸밉니다. 글자를 고르면 문단 모양·굵게·색·배경을 바꾸는 막대가, 이미지를 고르면 인라인·블록·플로트 배치와 정렬, 캡션, 교체를 하는 막대가 그 요소 위에 뜹니다.',
					image: projectImage('hyeoniverse', 'shots/cms-toolbar.jpg'),
				},
				{
					title: '글 한 편의 일생',
					group: '발행과 정리',
					body: '초안은 예약하면 DB 안의 pg_cron이 매분 확인해 그 시각에 발행하고, 발행된 글은 저장할 때마다 버전이 오릅니다. 지운 글은 휴지통에서 복구할 수 있고, 30일(인기 글 다섯 개는 90일)이 지나면 매일 도는 정리 작업이 영구 삭제합니다. 글과 작업물이 중심인 테이블 25개 위에서 돕니다.',
					demo: 'lifecycle',
				},
				{
					title: '목록에서 한 번에',
					group: '발행과 정리',
					body: '글 목록에서 여러 개를 골라 한 번에 발행하거나 지우고, 상태 칩을 누르면 그 자리에서 발행과 미발행이 바뀝니다. 필터·검색 줄은 스크롤해도 위에 붙어 있고, 행마다 공개 페이지 바로가기와 .md 내보내기가 있습니다. 작업물은 행 번호를 눌러 새 순서를 적으면 바로 옮겨집니다.',
					image: projectImage('hyeoniverse', 'shots/cms-posts.jpg'),
				},
				{
					title: '글과 작업물 잇기',
					group: '발행과 정리',
					body: '작업물에는 관련 글과 시리즈를, 글에는 관련 프로젝트를 검색해 붙입니다. 미발행 항목은 Draft로 표시되고, 고른 칩은 끌어서 순서를 바꾸며 공개 상세의 정보 칸에 그대로 나옵니다.',
					image: projectImage('hyeoniverse', 'cms/relations.jpg'),
				},
				{
					title: 'SEO 점검',
					group: '발행과 정리',
					body: '편집기 오른쪽 아래의 SEO 점검 알약이 제목·슬러그·요약(30자 이상)·커버·카테고리·태그 여섯 가지를 세어 5/6처럼 보여 줍니다. 펼쳐서 모자란 항목을 누르면 그 칸으로 데려가 깜빡여 줍니다.',
					image: projectImage('hyeoniverse', 'cms/seo.jpg'),
				},
				{
					title: '대시보드',
					group: '운영',
					body: '관리자 첫 화면은 운영 현황 한 장입니다. 빠른 작업(새 글·새 프로젝트·설정·신고·알림, 대기 중인 신고와 안 읽은 알림 수는 배지로) 아래로 최근 24시간 서비스 호출과 실패 수, 총 조회수와 지난 7일 대비 변화, 발행·초안 수가 놓입니다. 일별 조회수는 기간을 골라 곡선으로 보고, 달력에서 날짜를 누르면 그날의 순위와 많이 본 글이 열립니다.',
					image: projectImage('hyeoniverse', 'cms/dashboard.jpg'),
				},
				{
					title: '알림',
					group: '운영',
					body: '새 댓글·답글·신고·권한 요청·새 기기 로그인·방문 급증과 AI 공급자 실패·메일 발송 실패·예약 작업 오류 같은 시스템 알림을 전체·댓글·시스템·신고 네 탭에서 받습니다. 처리가 필요한 것은 따로 묶이고, 알림을 눌러 넘어간 항목은 잠시 깜빡여 어디로 왔는지 알려 줍니다.',
					image: projectImage('hyeoniverse', 'cms/notifications.jpg'),
				},
				{
					title: '서비스 호출 기록',
					group: '운영',
					body: 'AI 번역·요약·TTS·커버, 이미지 검색, 메일, GitHub API, 예약 작업의 성공과 실패를 새것부터 남깁니다. 위에는 공급자마다 성공·실패 수와 마지막 실패 원인(키 없음·한도·결제·서버 오류)이, 아래에는 기록 줄이 있어 어느 키가 만료됐는지 바로 보입니다.',
					image: projectImage('hyeoniverse', 'cms/service-log.jpg'),
				},
				{
					title: '로그인 없이 다는 댓글',
					group: '소통',
					body: '방문자는 가입 없이 대댓글까지 답니다. 닉네임은 이모지와 이름을 섞어 고르고, 본문은 마크다운을 DOMPurify로 걸러 그리며, 이모지 반응은 giscus처럼 여덟 가지입니다. 고치고 지우는 권한은 두 길로 확인합니다: 같은 브라우저는 저장해 둔 식별자(SHA-256)로 자동, 다른 기기에서는 쓸 때 정한 비밀번호(Bcrypt)로. 지운 댓글은 원문을 보존해 관리자가 되살릴 수 있고, 설정에서 giscus로 바꿀 수도 있습니다.',
					demo: 'comments',
				},
				{
					title: '메일 (Resend)',
					group: '소통',
					body: '답글 알림(메일을 적어 둔 사람에게만), 작성자 초대, 새 기기 로그인 확인(24시간 링크), 예약 발행과 휴지통 정리 결과를 Resend로 보냅니다. 예약 발행 알림만은 Next.js가 아니라 DB가 pg_net으로 직접 보내고, 키가 없으면 메일만 건너뛰고 DB 작업은 그대로 합니다. 보내지 못하면 관리자 알림에 남습니다.',
					demo: 'mailbox',
				},
				{
					title: '이모지 키친',
					group: '소통',
					body: '설정 › 라이브러리 › 커스텀 이모지의 "조합" 창에서 Google Gboard의 이모지 키친처럼 두 이모지를 섞은 그림을 골라 커스텀 이모지로 들입니다. 이모지 619개와 섞을 수 있는 짝은 빌드 때 meta.json과, 짝마다 3바이트로 줄인 pairs.bin(약 430KB)으로 만들어 두고, 그림 주소는 날짜와 두 코드포인트로 그때그때 만듭니다. 가져올 때는 gstatic 그림을 받아 128px WebP로 우리 저장소에 올려, 바깥 주소가 바뀌어도 글과 댓글 속 이모지가 깨지지 않습니다.',
					demo: 'kitchen',
				},
				{
					title: 'GitHub 로그인과 초대',
					group: '권한과 설정',
					body: '멤버는 GitHub OAuth로 로그인하지만, OAuth는 누구인지만 알려 줍니다. 들여보낼지는 서버의 /auth/callback이 정합니다: 소유자 메일(OWNER_EMAIL)인지, 이미 역할이 있는지, 초대 행이 있는지 차례로 보고, 아니면 그 계정을 지웁니다. 역할은 사용자가 고칠 수 없는 app_metadata에 두고, 초대는 메일을 키로 미리 적어 두었다가 로그인하면 소비합니다.',
					demo: 'invite',
				},
				{
					title: '누가 무엇을 할 수 있나',
					group: '권한과 설정',
					body: '소유자·관리자·저자·방문자 네 단계로 나눠, 저자는 자기 글만, 관리자는 모든 글과 댓글 중재까지, 사이트 설정과 저자 초대는 소유자만 합니다. 판정은 API 코드가 아니라 DB의 RLS 정책 29개가 하고, 역할은 사용자가 고칠 수 없는 JWT의 app_metadata에서 읽습니다. 그래서 API 하나가 확인을 빠뜨려도 DB가 마지막에 막습니다.',
					demo: 'roles',
				},
				{
					title: '코드 배포 없이 사이트 설정',
					group: '권한과 설정',
					body: '사이트 제목과 소개, SEO 메타데이터, 테마 색, 외부 서비스 키를 설정 다섯 탭에서 고칩니다. 비우면 안 되는 값은 화면·API·DB 세 곳에서 막고, About 페이지는 실제 페이지 위에서 글자를 눌러 바로 고칩니다.',
					image: projectImage('hyeoniverse', 'shots/admin-settings.jpg'),
				},
			],
		},
		{
			title: '발표 갤러리와 음성',
			look: 'stage',
			lead: '작업물마다 발표 자료를 슬라이드 갤러리로 올리고, 장마다 음성을 붙여 발표처럼 넘어가게 합니다. 자료를 그림으로 바꾸고 녹음을 다듬는 일까지 편집 화면 안에서 끝나며, 대본을 AI 목소리로 만드는 일은 아래 AI 장에서 직접 들어 볼 수 있습니다.',
			facts: [
				{ value: 'PDF · PPTX', label: '브라우저 안에서 슬라이드로' },
				{ value: '24kHz', label: '마이크 녹음 (모노 WAV)' },
				{ value: '50단계', label: '녹음 편집 되돌리기' },
			],
			points: [
				{
					title: '발표처럼 넘어가는 갤러리',
					body: '가운데 한 장이 크고 양옆이 원근으로 기운 갤러리입니다. 화면에 절반 넘게 들어오면 첫 장부터 읽기 시작해, 음성이 끝나면 다음 장으로 넘어갑니다. 음성 파일이 있으면 그 파일을, 대본만 있으면 방문자 브라우저의 음성 합성을 쓰고, 둘 다 없으면 4초 보여 주고 넘깁니다. 화면 밖으로 나가면 멈췄다가 돌아오면 이어 읽고, 브라우저가 소리를 막으면 음성과 함께 볼지 먼저 묻습니다.',
					demo: 'slides',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/gallery-play.mp4'),
							alt: '재생 중: 음성에 맞춰 자막이 바뀌고 진행 막대가 찬다',
						},
						{ src: projectImage('hyeoniverse', 'cms/gallery.jpg'), alt: '자막을 켠 작업물 상세의 갤러리' },
					],
				},
				{
					title: '녹음하고 파형으로 다듬기',
					body: '편집 화면에서 마이크로 바로 녹음해 24kHz WAV로 만듭니다. 파형을 끌어 구간을 고르고 나누기·잘라내기·복사·붙여넣기·지우기·선택만 남기기·앞뒤 무음 자르기로 다듬으며, 되돌리기는 50단계까지 됩니다. 클립은 끌어서 순서를 바꾸고, 복사한 조각은 다른 장의 녹음에도 붙여 넣습니다. 완료하면 그 장의 음성이 됩니다(최대 6분).',
					demo: 'wave',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/recording.jpg'),
							alt: '녹음 파형 편집기: 클립 세 개로 나눈 녹음',
						},
					],
				},
				{
					title: 'PDF·PPTX를 슬라이드로',
					body: '갤러리에 PDF나 PPTX를 끌어 놓으면 브라우저 안에서 쪽마다 JPEG로 그려 올립니다. PDF는 pdf.js로 그리고, PPTX는 HTML로 그린 뒤 그림으로 굳히며, 발표자 노트는 장마다 음성 대본으로 들어갑니다. 파일이 남의 서버로 나가지 않도록 변환은 서버에서 하지 않습니다.',
					demo: 'convert',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/pptx-import.mp4'),
							alt: 'PPTX를 떨어뜨리면 장마다 그려져 썸네일로 들어온다',
						},
						{ src: projectImage('hyeoniverse', 'cms/pptx-progress.jpg'), alt: '갤러리 제목 줄의 "n/N쪽 그리는 중"' },
						{
							src: projectImage('hyeoniverse', 'cms/pptx-done.jpg'),
							alt: '끝난 뒤: 발표자 노트가 대본으로 들어간 장',
						},
					],
				},
			],
		},
		{
			title: 'AI 번역 · 요약 · 커버 · 음성',
			look: 'bento',
			lead: '글과 작업물은 한국어와 영어 칸을 따로 둡니다. 한쪽만 써도 나머지는 번역이 채우고, 발행하면 두 언어의 요약이 붙고, 커버가 비어 있으면 사진을 찾거나 그리며, 갤러리 대본은 목소리로 읽힙니다. 공급자는 기능마다 고르고, 실패하면 다음 공급자로 넘어갑니다.',
			facts: [
				{ value: '4곳', label: '번역 (DeepL · Google · Gemini · Claude)' },
				{ value: '2–3문장', label: '언어마다 AI 요약' },
				{ value: '3곳', label: '음성 (Fish · Google · Edge)' },
			],
			points: [
				{
					title: '편집 언어를 바꾸면 번역',
					body: '편집기에서 EN으로 바꾸면, 원문이 있고 영어 칸이 모두 비어 있을 때 제목·부제목·설명·본문과 갤러리 대본까지 한 번에 채웁니다. 영어 칸이 일부 차 있으면 재번역 단추에서 범위를 골라 다시 받고, 번역은 폼에만 들어와 저장해야 남습니다. 공급자는 설정 › 서비스에서 기능마다 기본과 대체 순서를 정하고(번역 기본은 DeepL), 같은 원인으로 거듭 실패한 공급자는 잠시 꺼 둡니다.',
					demo: 'translate',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/translate-run.mp4'),
							alt: 'EN으로 바꾸고 재번역 › 전체: "번역 중…" 띠가 뜬 뒤 영어 칸이 채워진다',
						},
						{ src: projectImage('hyeoniverse', 'cms/translate.jpg'), alt: '영어 칸이 채워진 편집기' },
						{
							src: projectImage('hyeoniverse', 'cms/services.jpg'),
							alt: '설정 › 서비스: 기능마다 공급자와 대체 순서',
						},
					],
				},
				{
					title: '발행하면 붙는 AI 요약',
					body: '발행할 때 Gemini가 한국어와 영어 요약을 2–3문장씩 한 번에 만들고, 상세 페이지 위에 접고 펼치는 상자로 보여 줍니다. 상세 페이지의 언어 토글을 따르고, 그 언어 요약이 없으면 다른 언어 요약을 보여 줍니다. 공급자는 OpenAI나 Claude로 바꿀 수 있습니다.',
					demo: 'summary',
				},
				{
					title: '커버가 비어 있으면',
					body: '커버 없이 발행하면 태그·카테고리·제목에서 고른 키워드로 Unsplash에서, 없으면 Pexels에서 사진을 찾아 채웁니다. 이미 발행한 글은 설정의 "적용할 글 확인하기"에서 검색할 키워드를 미리 보고 고른 글에만 넣고, 시리즈 커버도 같은 방식으로 찾아 DB에 남겨 둡니다. 그래도 없으면 글 주소로 고른 그라데이션을 그려, 외부 호출 없이 빈 칸을 메웁니다.',
					image: projectImage('hyeoniverse', 'cms/ai-cover.jpg'),
				},
				{
					title: 'AI로 커버 그리기',
					body: '커버 선택창의 AI 생성 탭에서 제목·태그·요약으로 만든 프롬프트 제안을 고르거나 직접 써서, 열 가지 스타일 가운데 하나로 그립니다. NanoBanana(Gemini)와 Hugging Face FLUX 가운데 기본 공급자를 고르고, 실패하면 대체 순서대로 넘어가며, 같은 원인으로 거듭 실패한 공급자는 잠시 꺼 둡니다. 만든 그림은 저장소에 올라가 바로 커버가 되고, 이전 커버는 이력에서 되돌립니다.',
					demo: 'cover',
				},
				{
					title: '대본을 AI 목소리로',
					body: '장마다 대본을 Fish Audio, Google, Edge 가운데 고른 목소리로 만들고, 실패하면 남은 공급자의 같은 성별 목소리로 넘어갑니다. 영어 대본은 한국어 목소리인 Fish를 건너뜁니다. 읽기 사전으로 Hyeoniverse를 "허니버스"로 읽히고, 대본 안의 [표기|읽을 말]로 그 자리만 따로 정하며, 자막에는 표기가 그대로 남습니다. 만드는 동안에는 대본과 목소리, 이미지 순서가 잠깁니다. 이 페이지에서는 MacFolio 서버가 같은 차례로 실제 음성을 만들어 들려 줍니다 (80자까지, 하루 3번).',
					demo: 'voice',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/narration.jpg'),
							alt: '갤러리 음성 편집기: 왼쪽 슬라이드, 오른쪽 대본, 아래 썸네일 줄',
						},
						{
							src: projectImage('hyeoniverse', 'cms/narration-preview.mp4'),
							alt: '미리 듣기: 재생을 따라 대본이 가사처럼 채워진다',
						},
						{ src: projectImage('hyeoniverse', 'cms/lexicon.jpg'), alt: '읽기 사전: 표기와 읽을 말 짝' },
					],
				},
				{
					title: '공급자 고르기와 대체, 사용량',
					body: '설정 › 서비스에서 기능마다 쓸 AI를 고릅니다: 번역은 DeepL · Google · Gemini · Claude, 요약은 Gemini · OpenAI · Claude, 커버는 NanoBanana · Hugging Face, 음성은 Fish · Google TTS · Edge. 대체를 켜면 기본이 실패할 때 정해 둔 순서대로 다음 공급자로 넘어갑니다. 쓴 양은 공급자마다 이번 달 글자 수·바이트로 세어 무료 한도(Google 번역 50만 자, Google TTS 100만 바이트 가운데 앱 상한 80만)와 견주고, 키 오류·한도·결제 문제로 3번(일시 오류는 5번) 거듭 실패한 공급자는 스스로 꺼서 "AI 상태·사용량"에 이유와 함께 보여 줍니다.',
					demo: 'providers',
				},
				{
					title: '방문자가 누른 번역은 남긴다',
					body: '공개 화면에서 보고 있는 언어의 본문이 없으면 번역 배너가 뜨고, 그 결과를 DB의 그 언어 칸에 저장해 다음 방문자는 기다리지 않습니다. 댓글 번역은 화면에만 두고 저장하지 않습니다.',
					image: projectImage('hyeoniverse', 'cms/translate-banner.jpg'),
				},
			],
		},
		{
			title: '트래픽 분석',
			look: 'dashboard',
			lead: '방문과 조회를 외부 분석 도구에만 맡기지 않고 직접 모아, 관리자의 트래픽 페이지에서 어디서 와서 무엇을 봤는지 봅니다. 방문자 쿠키 없이 IP와 날짜로만 세고, 90일이 지나면 IP를 지웁니다.',
			facts: [
				{ value: '4가지', label: '기간 (7 · 14 · 30 · 90일)' },
				{ value: '6갈래', label: '유입 채널 분류' },
				{ value: '90일', label: '지나면 방문 IP 익명화' },
			],
			points: [
				{
					title: '트래픽 페이지 한 장',
					body: '기간을 바꿔 가며 방문·신규·재방문 비율·방문당 조회·걸러 낸 봇 수를 직전 같은 기간과 비교해 봅니다. 그 아래로 일별 방문 추이, 유입 채널과 기기, 국가별 방문과 랜딩 페이지, 기간 안의 인기 글, 요일×시각 히트맵, UTM 캠페인이 이어집니다.',
					shots: [
						{
							src: projectImage('hyeoniverse', 'cms/traffic.jpg'),
							alt: '트래픽 (30일): 방문 요약, 일별 방문, 유입 경로, 기기',
						},
						{
							src: projectImage('hyeoniverse', 'cms/traffic-ip-utm.jpg'),
							alt: 'IP 분석: 가린 IP별 방문 일수와 내 IP 지정',
						},
						{
							src: projectImage('hyeoniverse', 'cms/dashboard-daily.jpg'),
							alt: '대시보드 일별 조회수: 날짜를 눌러 그날 분석',
						},
					],
				},
				{
					title: '하루 한 번, 랜딩 한 번',
					icon: 'fa-calendar-day',
					body: '페이지를 처음 열 때 한 번만 방문을 보내고, 서버는 (IP, 날짜)를 유일 키로 하루 한 행만 남겨 그날 처음 들어온 페이지를 랜딩으로 삼습니다. 로그인한 관리자와 "내 IP"로 지정한 주소는 세지 않고, 글·작업물 조회수도 한국 시간 기준 하루 한 번만 오르도록 DB 함수 한 번에 처리합니다.',
				},
				{
					title: '봇은 버리지 않고 따로',
					icon: 'fa-robot',
					body: '외부 라이브러리 없이 User-Agent에서 기기 종류·OS·브라우저·모델을 뽑고, 봇으로 보이는 방문은 버리지 않고 봇 표시를 붙여 따로 남깁니다. 집계에서는 빼되 몇 건을 뺐는지는 요약에 보여 줍니다.',
				},
				{
					title: '유입 채널 여섯 갈래',
					icon: 'fa-route',
					body: 'Referer 호스트를 검색·소셜·커뮤니티·개발·직접·기타로 나누고, 채널마다 상위 호스트 8개까지 펼쳐 봅니다. 자기 도메인에서 넘어온 것은 직접으로 셉니다. UTM 링크 생성기로 만든 캠페인 링크는 조합마다 묶여 보입니다.',
				},
				{
					title: 'IP는 가리고, 90일 뒤엔 지운다',
					icon: 'fa-user-secret',
					body: '관리자 화면에도 a.b.x.x처럼 가린 IP와 HMAC 키만 내려가고, 원문 IP는 응답에 실리지 않습니다. 매일 새벽 DB 안의 pg_cron이 90일 지난 방문과 조회 기록의 IP를 익명화하고, 집계에 쓰는 칸은 남깁니다.',
				},
				{
					title: '방문 급증 알림',
					icon: 'fa-bell',
					body: '오늘 방문이 15건을 넘으면서 직전 7일 평균의 3배를 넘으면, 관리자 알림에 "방문 급증"을 하루 한 번 남깁니다.',
				},
				{
					title: '대시보드의 조회 추세',
					icon: 'fa-chart-line',
					body: '차트 라이브러리 없이 SVG로 그린 일별 조회 차트를 선과 달력으로 바꿔 보고, 날짜를 누르면 그날 많이 본 글이 나옵니다. 기록을 시작한 날부터 빈 날은 0으로 채워 최대 730일까지 봅니다.',
				},
			],
		},
		{
			title: '테마',
			look: 'palette',
			lead: '사이트의 색은 코드가 아니라 관리자 설정에서 고릅니다. 아래에서 프리셋을 누르거나 라이트·다크를 바꿔 보면, 같은 화면에서 무엇이 바뀌고 무엇이 남는지 보입니다.',
			facts: [
				{ value: '18개', label: '테마 프리셋' },
				{ value: '5색', label: '테마 하나 (강조 · 바탕 · 글자)' },
				{ value: '2가지', label: '모드 (라이트 · 다크)' },
			],
			image: {
				src: projectImage('hyeoniverse', 'cms/home-presets.jpg'),
				alt: '같은 홈을 Arctic · Rosewood · Meadow로 바꿔 본 모습 (위는 라이트, 아래는 다크)',
			},
			palette: [
				{
					name: 'Default',
					accent: '#d40063',
					lightBg: '#f5f5f0',
					lightText: '#1a1a1a',
					darkBg: '#0a0a0a',
					darkText: '#f5f5f0',
				},
				{
					name: 'Ruby',
					accent: '#9d0208',
					lightBg: '#fbeaea',
					lightText: '#3b0a0a',
					darkBg: '#150404',
					darkText: '#efe4d6',
				},
				{
					name: 'Meadow',
					accent: '#bc4749',
					lightBg: '#f2e8cf',
					lightText: '#2a4e30',
					darkBg: '#141f12',
					darkText: '#a7c957',
				},
				{
					name: 'Coral',
					accent: '#fe5f55',
					lightBg: '#eef5db',
					lightText: '#3d2a1a',
					darkBg: '#1a130c',
					darkText: '#c7efcf',
				},
				{
					name: 'Azure',
					accent: '#fd6b1d',
					lightBg: '#efefd0',
					lightText: '#004e89',
					darkBg: '#0a1a2e',
					darkText: '#efefd0',
				},
				{
					name: 'Sand',
					accent: '#e0af9c',
					lightBg: '#efebce',
					lightText: '#263340',
					darkBg: '#18170e',
					darkText: '#e6eef2',
				},
				{
					name: 'Harvest',
					accent: '#ce965c',
					lightBg: '#fefae0',
					lightText: '#283618',
					darkBg: '#1a1e0e',
					darkText: '#fefae0',
				},
				{
					name: 'Honey',
					accent: '#fbc45d',
					lightBg: '#f7ede2',
					lightText: '#3d2e1e',
					darkBg: '#1c130e',
					darkText: '#f5cac3',
				},
				{
					name: 'Forest',
					accent: '#4d753d',
					lightBg: '#dad7cd',
					lightText: '#2b2c28',
					darkBg: '#1a2e1f',
					darkText: '#e3ded2',
				},
				{
					name: 'Rosewood',
					accent: '#57806d',
					lightBg: '#f8c7cc',
					lightText: '#0e0f19',
					darkBg: '#0e0f19',
					darkText: '#f4c7cc',
				},
				{
					name: 'Dusk',
					accent: '#6abaa3',
					lightBg: '#ffe5d4',
					lightText: '#3d2b33',
					darkBg: '#101c16',
					darkText: '#efc7c2',
				},
				{
					name: 'Arctic',
					accent: '#5aa7c3',
					lightBg: '#cae9ff',
					lightText: '#2a2320',
					darkBg: '#0c1e2e',
					darkText: '#f1ece4',
				},
				{
					name: 'Baltic',
					accent: '#1c5d99',
					lightBg: '#ffffff',
					lightText: '#222222',
					darkBg: '#222222',
					darkText: '#e6e4df',
				},
				{
					name: 'Sorbet',
					accent: '#7aabe9',
					lightBg: '#fcf5c7',
					lightText: '#3a2f2a',
					darkBg: '#0e1e2c',
					darkText: '#ffc09f',
				},
				{
					name: 'Twilight',
					accent: '#6d3fb0',
					lightBg: '#fbf3df',
					lightText: '#2b2630',
					darkBg: '#1b1330',
					darkText: '#f3d9a4',
				},
				{
					name: 'Tropica',
					accent: '#fa5ca4',
					lightBg: '#fce4d8',
					lightText: '#4a1530',
					darkBg: '#1a0a14',
					darkText: '#b5f8fe',
				},
				{
					name: 'Petal',
					accent: '#f8768d',
					lightBg: '#ffe5ec',
					lightText: '#2e2427',
					darkBg: '#1a0810',
					darkText: '#f4ebdf',
				},
				{
					name: 'Slate',
					accent: '#5c677d',
					lightBg: '#eef0f4',
					lightText: '#2a2521',
					darkBg: '#0e1118',
					darkText: '#e8e2d8',
				},
			],
			points: [
				{
					title: '다섯 색이 한 테마',
					icon: 'fa-palette',
					body: '강조색과 라이트·다크 각각의 바탕색·글자색, 다섯 값으로 테마 하나가 정해집니다. 회색 단계와 강조색 면 위의 글자색은 이 다섯 값에서 계산해 고릅니다.',
				},
				{
					title: '색상환 순서의 프리셋',
					icon: 'fa-swatchbook',
					body: '기본 마젠타 다음부터 빨강·주황·초록·파랑·보라 순으로 놓고, 색이 거의 없는 Slate를 맨 뒤에 둡니다. 강조색끼리는 ΔE 20 이상 떨어뜨려 비슷해 보이지 않게 했고, 지금 고른 다섯 색은 +로 내 프리셋에 저장합니다.',
					image: projectImage('hyeoniverse', 'cms/theme-presets.jpg'),
				},
				{
					title: '대비 점검',
					icon: 'fa-circle-half-stroke',
					body: '색을 고르면 라이트와 다크에서 본문·흐린 글자·강조 링크·강조색 그래픽·버튼 글자의 대비와 링크↔본문 색 차이를 바로 세어 표로 보여 줍니다. 강조색이 글자로 쓰일 때 사이트가 명도만 옮겨 4.5:1을 맞춘 값은 "자동 보정"으로 표시됩니다.',
					image: projectImage('hyeoniverse', 'cms/theme-contrast.jpg'),
				},
				{
					title: '색상환 추천과 이미지에서 뽑기',
					icon: 'fa-eye-dropper',
					body: '색상환에서 유사색·보색·분할 보색·삼각·단색 규칙으로 후보를 뽑거나, 이미지를 올려 그 안의 색 여섯을 뽑아 후보로 만듭니다. 이미지는 브라우저 안에서만 읽고 서버에 올리지 않습니다.',
					shots: [
						{ src: projectImage('hyeoniverse', 'cms/theme-wheel.jpg'), alt: '색상환 추천' },
						{ src: projectImage('hyeoniverse', 'cms/theme-image.jpg'), alt: '이미지에서 색 뽑기' },
					],
				},
				{
					title: '로고와 3D도 함께',
					icon: 'fa-cube',
					body: '그림 로고는 테마 색으로 칠할 수 있고, giscus 댓글도 모드마다 테마를 따로 정합니다. 홈의 3D 토러스는 색 프리셋을 따르지 않고 라이트·다크 두 벌의 재질만 오갑니다.',
				},
				{
					title: '시스템 설정을 따르는 모드',
					icon: 'fa-desktop',
					body: '모드는 라이트와 다크 두 가지이고, 방문자가 고른 적이 없으면 운영체제 설정을 따릅니다.',
				},
			],
		},
		{
			title: '성능',
			look: 'gauges',
			lead: '느린 화면을 감으로 고치지 않고, 원인을 나눠 잰 뒤 같은 조건에서 다시 쟀습니다. 운영 사이트를 데스크톱 Lighthouse로 세 번 잰 중앙값입니다.',
			facts: [
				{ value: '97점', label: '성능' },
				{ value: '100점', label: '접근성' },
				{ value: '100점', label: 'SEO' },
				{ value: '0.7초', label: 'LCP' },
			],
			compare: [
				{ label: '프로필 LCP', before: 9.7, after: 2.7, unit: '초' },
				{ label: '글 목록 LCP', before: 7.8, after: 2.9, unit: '초' },
				{ label: '관리자 글 목록 LCP', before: 2.1, after: 1.45, unit: '초' },
				{ label: '홈 다운로드', before: 4.8, after: 1.0, unit: 'MB' },
				{ label: '편집기 입력 지연 (상위 10%)', before: 120, after: 72, unit: 'ms' },
			],
			points: [
				{
					title: '이미 그린 페이지를 다시 만들지 않게',
					body: '모바일에서 화면 너비에 묶인 key 때문에 이미 그린 페이지를 다시 만들고 있었습니다. 경계를 실제로 넘을 때만 바뀌는 key로 고쳤습니다.',
				},
				{
					title: '입력할 때마다 하던 전체 재계산 없애기',
					body: '태그 칩의 :has(:hover)가 입력할 때마다 페이지 전체 스타일을 다시 계산하게 했습니다. 속성으로 바꿔 재계산을 10회에서 0회로 줄였습니다.',
				},
				{
					title: '배너를 서버 HTML에',
					body: 'LCP 요소인 배너가 서버 HTML에 없었고, 데이터를 받은 뒤에도 투명하게 가려져 있었습니다. 두 원인을 각각 고쳤습니다.',
				},
				{
					title: '표시 크기에 맞춘 이미지',
					body: '확장자만 WebP인 3673px JPEG가 3D 반사 이미지로 쓰이고 있었습니다. 실제 표시 크기에 맞춰 다시 만들었습니다.',
				},
			],
		},
		{
			title: '보안과 데이터',
			look: 'shield',
			lead: '권한은 API 코드만 믿지 않고 DB가 마지막에 확인합니다. 지운 데이터는 되돌릴 수 있고, 동시 저장은 충돌로 알아챕니다.',
			points: [
				{
					title: '로그인 보호',
					icon: 'fa-right-to-bracket',
					body: 'API 쓰기 요청은 Origin을 대조해 맞지 않으면 거절합니다. 로그인은 5회 실패하면 15분 잠그고, 처음 보는 기기는 메일로 승인받습니다.',
				},
				{
					title: '댓글 정제',
					icon: 'fa-filter',
					body: '댓글 마크다운은 태그와 속성을 화이트리스트로 거르고, 이미지는 외부 주소만 받습니다. 이모지 반응은 IP 원문이 아니라 해시만 저장합니다.',
				},
				{
					title: '역할은 고칠 수 없는 곳에',
					icon: 'fa-id-badge',
					body: '역할은 사용자가 고칠 수 있는 user_metadata가 아니라 서버만 쓰는 app_metadata에 둡니다. 정책 하나가 잘못 적혀 익명에게 열린 테이블이 생긴 뒤로는 익명 쓰기 권한 자체를 회수했습니다.',
				},
				{
					title: 'DB가 판정하는 권한',
					icon: 'fa-database',
					body: '서버 검사가 빠진 요청으로 비공개 글이 보인 일을 겪은 뒤, 역할을 읽는 RLS 정책으로 판정을 옮겼습니다. 소유자·관리자·저자·방문자 네 단계입니다.',
				},
				{
					title: '정기 작업은 DB 안에서',
					icon: 'fa-clock',
					body: '예약 발행과 휴지통 정리는 인터넷에 열린 cron API 대신 DB 안의 pg_cron이 돌리고, 실패하면 관리자 알림을 남깁니다.',
				},
			],
		},
	],
	timeline: [
		{ date: '02.05', label: '공개 사이트 골격: 홈 애니메이션, 작업물, 3D 토러스' },
		{ date: '02.23', label: '블로그와 관리자 CMS, 시리즈, 자동 번역' },
		{ date: '03.17', label: '리치 텍스트 편집기, 자동 저장, 휴지통, 예약 발행' },
		{ date: '04.27', label: 'CI와 release-please, 로그인 잠금, Next.js 16' },
		{ date: '05.28', label: '편집기 개편, 저장 형식을 마크다운 하나로' },
		{ date: '07.23', label: '새 기능을 멈추고 전면 리팩토링, 권한 판정을 RLS로' },
		{ date: '09.11', label: '성능·접근성·운영 다듬기' },
		{ date: '10.01', label: '디자인 시스템 명세 다시 쓰기' },
	],
	build: [
		{
			title: '이슈에서 릴리스까지',
			body: '2026년 4월 말부터 모든 변경을 이슈, 브랜치, PR로 올리고 release-please로 버전을 매깁니다.',
		},
		{
			title: 'PR마다 거치는 관문',
			body: '타입 검사, ESLint 경고 총량, stylelint 토큰 규칙, Vitest, 등록되지 않은 의존성 0, 타입 커버리지 97.93%를 확인합니다.',
		},
		{
			title: '화면이 깨졌는지 찍어 보기',
			body: '공개 화면 12개를 데스크톱과 모바일로, 관리자 화면 16개를 찍어 모두 40장을 비교합니다.',
		},
		{
			title: '멈추고 정리하기',
			body: '7월 말부터 약 7주 동안 새 기능을 멈추고 커다란 설정 컴포넌트를 나누고, API 안전망 시험 119건을 깔았습니다.',
		},
	],
	contributions: [
		'기획과 화면 디자인, 디자인 시스템',
		'인터랙션과 3D 화면',
		'Supabase 테이블·RLS·Storage 설계',
		'관리자 화면과 편집기',
	],
	specs: [
		{ label: '프레임워크', value: 'Next.js 16 (App Router), React 19, TypeScript' },
		{ label: '스타일', value: 'CSS Modules, 3층 CSS 변수 토큰' },
		{ label: '애니메이션 · 3D', value: 'Framer Motion, GSAP, Lenis, Three.js (React Three Fiber)' },
		{ label: '백엔드', value: 'Supabase (PostgreSQL, Auth, Storage, RLS)' },
		{ label: '편집기', value: 'Plate.js, React Flow, Sandpack, CodeMirror 6, KaTeX' },
		{ label: '시험 · 배포', value: 'Vitest, Playwright, Vercel' },
	],
	stack: ['Next.js', 'React', 'TypeScript', 'Supabase', 'GSAP', 'Three.js'],
	language: 'TypeScript',
	url: 'https://github.com/hyeoniverse/web-portfolio-hyeoniverse',
	demo: 'https://www.hyeoniverse.com',
	icon: projectImage('hyeoniverse', 'icon.svg'),
	app: {
		label: 'HYEONIVERSE',
		icon: 'projects/hyeoniverse/app-icon.png',
		barColor: '#f8f6f0',
		windowSize: { width: 1080, height: 700 },
	},
	image: projectImage('hyeoniverse', 'screenshot.jpg'),
};

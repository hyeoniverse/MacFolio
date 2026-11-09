// 저장소가 정하는 폴더 순서. 같은 층의 폴더는 관리자가 끌어서 정한 순서(Organization.order)를 먼저 따르고,
// 거기 없는 폴더는 이 목록의 순서를, 그래도 없으면 가나다순을 따른다 (buildFolderTree의 order).
// 커리큘럼처럼 이름이 아닌 순서가 의미 있는 폴더를 여기에 적는다. 경로는 글의 category와 같은 모양이다

const DEVCOURSE = '프로젝트/데브코스';

/** 데브코스 커리큘럼 순서 (일일시간표의 단원 순서) */
const DEVCOURSE_CURRICULUM = [
	'웹 서비스 기초',
	'백엔드 기초',
	'백엔드 심화',
	'백엔드 프로젝트',
	'프론트엔드 기초',
	'프론트엔드 심화',
	'프론트엔드 프로젝트',
	'오픈소스',
	'웹 파이프라인',
	'파이프라인 프로젝트',
	'풀 사이클·CS',
	'회고',
];

export const DEFAULT_FOLDER_ORDER: readonly string[] = [
	'프로젝트/MacFolio',
	DEVCOURSE,
	...DEVCOURSE_CURRICULUM.map((name) => `${DEVCOURSE}/${name}`),
];

/** 관리자가 정한 순서 뒤에 저장소의 기본 순서를 잇는다 (관리자 순서가 앞선다) */
export const folderOrderOf = (adminOrder: readonly string[]): string[] => [
	...adminOrder,
	...DEFAULT_FOLDER_ORDER.filter((path) => !adminOrder.includes(path)),
];

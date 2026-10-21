// Finder에서 읽는 문서 하나만 인쇄한다 (이력서의 'PDF로 저장'). 브라우저 인쇄 창에서 PDF로 저장하면 된다.
// 창은 화면 위에 떠 있고 움직이므로 그대로 찍지 않고, 본문을 body 바로 아래로 복사해 그것만 찍는다 (Finder.css의 @media print).

const ROOT_ID = 'finder-print-root';
const PRINTING = 'finder-printing';

/** 문서 본문(article)을 인쇄한다. 저장할 PDF 이름은 title을 따른다 (브라우저가 문서 제목을 파일 이름으로 쓴다) */
export function printDoc(article: HTMLElement, title: string): void {
	document.getElementById(ROOT_ID)?.remove();
	const root = document.createElement('div');
	root.id = ROOT_ID;
	const copy = article.cloneNode(true) as HTMLElement;
	copy.removeAttribute('aria-label');
	root.append(copy);
	document.body.append(root);

	const pageTitle = document.title;
	document.title = title;
	document.documentElement.classList.add(PRINTING);
	const cleanUp = () => {
		document.documentElement.classList.remove(PRINTING);
		document.title = pageTitle;
		root.remove();
		window.removeEventListener('afterprint', cleanUp);
	};
	window.addEventListener('afterprint', cleanUp);
	window.print();
}

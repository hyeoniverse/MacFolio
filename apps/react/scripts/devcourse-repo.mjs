// DevCourse 터미널 페이지가 돌아보는 저장소 파일을 만든다.
// 사용: node scripts/devcourse-repo.mjs <DevCourse-FullStack 저장소 경로>
// 결과: public/imgs/projects/devcourse/repo.json
// 폴더는 객체, 글 파일은 내용(길면 앞부분만), 그림 같은 파일은 null이다.
// node_modules·잠금 파일·.env는 빼고, 코드에 적힌 DB 비밀번호 같은 값은 가린다.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) {
	console.error('저장소 경로를 넘겨 주세요');
	process.exit(1);
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.vscode', 'dist', 'build', '.next']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', '.DS_Store']);
const TEXT = new Set(['.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.txt', '.sql', '.yml', '.yaml']);
const MAX_LINES = 100;
const MAX_CHARS = 4000;

/** password: 'root' 처럼 코드에 적힌 비밀 값은 가린다 */
const redact = (text) => text.replace(/((?:password|secret|private_key)\s*[:=]\s*)(['"`])[^'"`\n]*\2/gi, '$1$2****$2');

function read(file) {
	let text = redact(fs.readFileSync(file, 'utf8'));
	let cut = false;
	const lines = text.split('\n');
	if (lines.length > MAX_LINES) {
		text = lines.slice(0, MAX_LINES).join('\n');
		cut = true;
	}
	if (text.length > MAX_CHARS) {
		text = text.slice(0, MAX_CHARS);
		cut = true;
	}
	return cut ? `${text}\n…` : text;
}

function walk(dir) {
	const out = {};
	for (const name of fs.readdirSync(dir).sort()) {
		const full = path.join(dir, name);
		if (fs.statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(name)) out[name] = walk(full);
		} else if (!SKIP_FILES.has(name) && !name.startsWith('.env')) {
			out[name] = TEXT.has(path.extname(name).toLowerCase()) ? read(full) : null;
		}
	}
	return out;
}

const target = path.join(import.meta.dirname, '../public/imgs/projects/devcourse/repo.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(walk(root)));
console.warn(`${target} (${fs.statSync(target).size} bytes)`);

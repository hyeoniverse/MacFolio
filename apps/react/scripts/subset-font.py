# 본문 글꼴 Pretendard Variable(woff2 2MB, 한글 11,172자)을 웹 글꼴 조각으로 나눈다 (src/styles/fonts.css의 unicode-range).
# 브라우저는 화면에 그 범위의 글자가 있을 때만 그 조각을 받는다. 대부분의 화면은 core만 받는다.
#  - core: 영문·숫자·라틴-1, 문장 부호, 화살표, 한글 자모, 그리고 KS X 1001 완성형 2,350자 중 이 사이트가 쓰는 글자
#    (저장소의 글·화면 문구에 나오는 글자. 2026-10-26 기준 1,093자). 대부분의 화면은 core만 받는다
#  - ksx: KS X 1001 완성형 중 나머지 글자 (방문자 댓글·메시지처럼 저장소 밖 글에 그 글자가 있을 때만 받는다)
#  - ext-0 ~ ext-7: KS X 1001 밖 한글 완성형 8,822자를 코드 순서로 8등분 (똠·햏 같은 드문 글자. 그 글자가 든 조각 하나만 받는다)
# 글을 많이 더해 core에 없는 글자가 늘면 다시 실행한다 (그 글자가 있는 화면은 ksx를 더 받는다. 화면은 그대로다).
# 관리자가 서버에 쓴 글은 저장소에 없다. 2026-10-26 배포 서버의 글·메시지에는 저장소에 없는 글자가 없었다
# 가변 글꼴이라 굵기 45~920이 한 파일에 있다. Pretendard 패키지(npm pretendard, SIL OFL 1.1)의 파일을 원본으로 쓴다.
# 사용: pip install fonttools brotli && python3 scripts/subset-font.py
import re
import subprocess
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'node_modules' / 'pretendard' / 'dist' / 'web' / 'variable' / 'woff2' / 'PretendardVariable.woff2'
TARGET = ROOT / 'src' / 'styles' / 'fonts'
EXT_PARTS = 8


def encodable(code: int) -> bool:
    """KS X 1001 완성형 2,350자인지. 파이썬의 euc_kr은 나머지 글자도 8바이트 조합형으로 쓰므로 2바이트인 것만 센다"""
    try:
        return len(chr(code).encode('euc_kr')) == 2
    except UnicodeEncodeError:
        return False


def site_hangul() -> set[str]:
    """저장소의 글·화면 문구(apps/react/src, desktop-core, index.html, worker)에 나오는 한글 완성형 (시험 파일 제외)"""
    repo = ROOT.parent.parent
    listed = subprocess.run(
        ['git', 'ls-files', 'apps/react/src', 'packages/desktop-core/src', 'apps/react/index.html', 'apps/react/worker'],
        cwd=repo, capture_output=True, text=True, check=True,
    ).stdout.split()
    found: set[str] = set()
    for name in listed:
        if not re.search(r'\.(md|ts|tsx|json|html|css)$', name) or '.test.' in name:
            continue
        text = (repo / name).read_text(encoding='utf-8', errors='ignore')
        found.update(ch for ch in text if '\uac00' <= ch <= '\ud7a3')
    return found


USED = site_hangul()
COMMON_HANGUL = [c for c in range(0xAC00, 0xD7A4) if encodable(c) and chr(c) in USED]
KSX_REST = [c for c in range(0xAC00, 0xD7A4) if encodable(c) and chr(c) not in USED]
REST_HANGUL = [c for c in range(0xAC00, 0xD7A4) if not encodable(c)]
CORE = [
    *range(0x0020, 0x0100),  # 영문·숫자·라틴-1
    *range(0x2000, 0x2070),  # 일반 문장 부호
    0x20A9,  # ₩
    *range(0x2190, 0x2200),  # 화살표
    *range(0x3000, 0x3040),  # 한중일 문장 부호
    *range(0x3131, 0x318F),  # 한글 자모
    *COMMON_HANGUL,
]


def ranges(codes: list[int]) -> str:
    """unicode-range 값 (이어진 코드는 U+AC00-AC0F처럼 묶는다)"""
    parts, start, prev = [], codes[0], codes[0]
    for code in [*codes[1:], None]:
        if code is not None and code == prev + 1:
            prev = code
            continue
        parts.append(f'U+{start:04X}' if start == prev else f'U+{start:04X}-{prev:04X}')
        if code is not None:
            start = prev = code
    return ', '.join(parts)


def write(name: str, codes: list[int]) -> None:
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codes)
    subsetter.subset(font)
    target = TARGET / name
    subset.save_font(font, str(target), options)
    print(f'{target.name}: {target.stat().st_size:,} bytes ({len(codes)} codes)')
    print(f'  unicode-range: {ranges(codes)}' if len(codes) < 400 else f'  {len(codes)} codes, {ranges(codes)[:80]}…')


TARGET.mkdir(parents=True, exist_ok=True)
write('PretendardVariable-core.woff2', CORE)
write('PretendardVariable-ksx.woff2', KSX_REST)
size = -(-len(REST_HANGUL) // EXT_PARTS)
for index in range(EXT_PARTS):
    part = REST_HANGUL[index * size : (index + 1) * size]
    write(f'PretendardVariable-ext-{index}.woff2', part)
    print(f'  first U+{part[0]:04X}, last U+{part[-1]:04X}')

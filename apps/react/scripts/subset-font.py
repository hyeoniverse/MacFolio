# 본문 글꼴(AppleSDGothicNeoR.ttf, 3.8MB)을 웹 글꼴 둘로 나눈다: 자주 쓰는 글자(core)와 나머지 한글(ext).
# 브라우저는 index.css의 unicode-range를 보고 화면에 그 글자가 있을 때만 받는다. 대부분의 화면은 core만 받는다.
#  - core: 영문·숫자·라틴 문자표, 문장 부호, 한글 자모, KS X 1001 완성형 한글 2,350자 (자주 쓰는 글자)
#  - ext: 나머지 한글 완성형 (똠, 햏 같은 드문 글자)
# 사용: pip install fonttools brotli && python3 scripts/subset-font.py
from pathlib import Path

from fontTools import subset

FONTS = Path(__file__).resolve().parent.parent / 'public' / 'fonts'
SOURCE = FONTS / 'AppleSDGothicNeoR.ttf'

def encodable(code: int) -> bool:
    """KS X 1001 완성형 2,350자인지. 파이썬의 euc_kr은 나머지 글자도 8바이트 조합형으로 쓰므로 2바이트인 것만 센다"""
    try:
        return len(chr(code).encode('euc_kr')) == 2
    except UnicodeEncodeError:
        return False


COMMON_HANGUL = [c for c in range(0xAC00, 0xD7A4) if encodable(c)]
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
    target = FONTS / name
    subset.save_font(font, str(target), options)
    print(f'{target.name}: {target.stat().st_size:,} bytes ({len(codes)} codes)')


write('AppleSDGothicNeoR-core.woff2', CORE)
write('AppleSDGothicNeoR-ext.woff2', REST_HANGUL)

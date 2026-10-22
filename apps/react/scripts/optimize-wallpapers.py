# 배경화면(JPG)을 WebP로 바꾼다 (화질 80). 배경화면은 그라데이션이 넓어 WebP가 같은 화질에서 훨씬 작다
# (ios-sky-light 308KB → 59KB). 썸네일(thumbs/)도 같이 바꾸고 원래 JPG는 지운다.
# 주소는 shared/settings/settings.ts의 wallpaperUrl과 styles/tokens/components.css의 기본값이 만든다.
# 사용: pip install pillow && python3 scripts/optimize-wallpapers.py
from pathlib import Path

from PIL import Image

WALLPAPERS = Path(__file__).resolve().parent.parent / 'public' / 'imgs' / 'wallpapers'

before = after = 0
for path in sorted([*WALLPAPERS.glob('*.jpg'), *WALLPAPERS.glob('thumbs/*.jpg')]):
    target = path.with_suffix('.webp')
    Image.open(path).convert('RGB').save(target, 'WEBP', quality=80, method=6)
    before += path.stat().st_size
    after += target.stat().st_size
    print(f'{path.relative_to(WALLPAPERS)}: {path.stat().st_size:,} → {target.stat().st_size:,}')
    path.unlink()
print(f'합계 {before:,} → {after:,}')

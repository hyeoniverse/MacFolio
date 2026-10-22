# 앱 아이콘 PNG를 256px로 줄이고(이름·형식 그대로), 화면이 쓰는 WebP(192px)를 옆에 만든다.
# 아이콘은 Dock에서 64px(커질 때 70px), 휴대폰 홈 화면에서 60px로 보여서 3배 화면에도 192px면 넉넉하다.
# 원본은 2560px(photos.png)까지 있었다. PNG는 서버에 저장된 예전 주소(프로젝트 아이콘 등)를 위해 남긴다.
# 음악 앨범 그림(Album_*.png)도 WebP(512px)를 만든다 (음악 앱의 큰 그림이 240px쯤).
# 사용: pip install pillow && python3 scripts/optimize-icons.py
from io import BytesIO
from pathlib import Path

from PIL import Image

IMGS = Path(__file__).resolve().parent.parent / 'public' / 'imgs'
ICONS = [
    'bin.png',
    'bin-empty.png',
    'finder.png',
    'github.png',
    'launchpad.png',
    'mail.png',
    'memo.png',
    'messages.png',
    'music.png',
    'notion.png',
    'photos.png',
    'safari.png',
    'settings.png',
    *[str(path.relative_to(IMGS)) for path in sorted(IMGS.glob('projects/*/app-icon.png'))],
]
SIZE = 256
WEBP_SIZE = 192
ALBUM_SIZE = 512

total_before = total_after = 0
for name in ICONS:
    path = IMGS / name
    before = path.stat().st_size
    image = Image.open(path)
    image.load()
    if max(image.size) > SIZE:
        image = image.resize((SIZE, round(SIZE * image.height / image.width)), Image.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, 'PNG', optimize=True)
    after = buffer.tell()
    # 다시 압축해서 더 커지면 원래 파일을 둔다 (이미 잘 압축된 작은 아이콘)
    if after >= before:
        print(f'{name}: 그대로 ({before:,})')
        after = before
    else:
        path.write_bytes(buffer.getvalue())
        print(f'{name}: {before:,} → {after:,}')
    total_before += before
    total_after += after
print(f'합계 {total_before:,} → {total_after:,}')


def webp(path: Path, size: int, quality: int) -> int:
    """path 옆에 같은 이름의 .webp (긴 변 size px). 만든 파일 크기"""
    image = Image.open(path)
    image.load()
    if max(image.size) > size:
        scale = size / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    target = path.with_suffix('.webp')
    image.save(target, 'WEBP', quality=quality, method=6)
    return target.stat().st_size


webp_total = sum(webp(IMGS / name, WEBP_SIZE, 85) for name in ICONS)
print(f'아이콘 WebP 합계 {webp_total:,}')
albums = sorted(IMGS.glob('Album_*.png'))
album_before = sum(path.stat().st_size for path in albums)
album_after = sum(webp(path, ALBUM_SIZE, 80) for path in albums)
print(f'앨범 그림 {album_before:,} → WebP {album_after:,}')

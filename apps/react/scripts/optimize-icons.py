# 앱 아이콘 PNG를 256px로 줄인다 (이름·형식은 그대로라 코드는 바꾸지 않는다).
# 아이콘은 Dock에서 64px(커질 때 70px), Launchpad·휴대폰 홈 화면에서도 그보다 작게 보여서 2배 화면에도 256px면 넉넉하다.
# 원본은 2560px(photos.png)까지 있었다. 256px보다 작은 것은 그대로 두고, 무손실로 다시 압축만 한다.
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

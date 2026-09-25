# Builds the SLA Capital Shop (Fourthwall) brand kit from the site's OFFICIAL assets only --
# assets/logo.png, assets/logo-alt.png and the knight in assets/favicon.png. Nothing new is
# drawn as a logo; the banners and gift card only arrange those files with brand colors
# (assets/brand.css) and type.
#   python3 scripts/make-shop-kit.py      ->  assets/shop/*
#
# Output (all under assets/shop/, served at https://slacapital.ai/assets/shop/...):
#   sla-logo-for-light-products.png   dark "SLA" + orange "Capital", transparent, trimmed
#   sla-logo-for-dark-products.png    white "SLA" + orange "Capital", transparent, trimmed
#   sla-knight.png                     the knight, cut out of the favicon's blue square
#   sla-knight-print.png               the knight on a 4500x5400 (15x18 in @300 dpi) print canvas
#   sla-logo-print-dark-ink.png        logo on the same print canvas, for light garments
#   sla-logo-print-white-ink.png       logo on the same print canvas, for dark garments
#   shop-banner-desktop.jpg            2400x900 hero
#   shop-banner-mobile.jpg             1080x1350 hero (host for the Fourthwall section CSS)
#   gift-card.png                      1600x1000 gift card cover
#   shop-logo.png                      header logo for the shop (the light-background logo, trimmed)
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'shop')
os.makedirs(OUT, exist_ok=True)
FONTS = '/mnt/c/Windows/Fonts/'

# brand.css
PLUM = (40, 29, 40)        # --secondary
ORANGE = (218, 114, 56)    # --primary
PEACH = (255, 188, 125)    # --highlight
WHITE = (255, 255, 255)
MUTED = (205, 196, 206)

def font(name, size):
    return ImageFont.truetype(FONTS + name, size)

def trimmed(path):
    im = Image.open(path).convert('RGBA')
    return im.crop(im.getbbox())

# ── 1. the logos, trimmed (the files are already transparent) ──────────────────
logo_light = trimmed(os.path.join(ASSETS, 'logo.png'))       # dark SLA -> light products
logo_dark = trimmed(os.path.join(ASSETS, 'logo-alt.png'))    # white SLA -> dark products
logo_light.save(os.path.join(OUT, 'sla-logo-for-light-products.png'))
logo_dark.save(os.path.join(OUT, 'sla-logo-for-dark-products.png'))
logo_light.save(os.path.join(OUT, 'shop-logo.png'))

# ── 2. the knight, keyed out of the favicon's flat blue square ────────────────
fav = Image.open(os.path.join(ASSETS, 'favicon.png')).convert('RGB')
bg = fav.getpixel((4, 4))
src = fav.load()
W, H = fav.size
knight = Image.new('RGBA', fav.size)
dst = knight.load()
for y in range(H):
    for x in range(W):
        r, g, b = src[x, y]
        d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
        a = max(0, min(255, int((d - 10) * 255 / 50)))
        if a == 0:
            dst[x, y] = (0, 0, 0, 0)
            continue
        f = a / 255.0
        # un-mix the blue out of the anti-aliased edge pixels
        c = tuple(max(0, min(255, int((v - (1 - f) * bv) / f))) for v, bv in zip((r, g, b), bg))
        dst[x, y] = c + (a,)
# The favicon carries faint compression specks in its blue; keep only the knight itself (the
# largest connected shape) and drop near-invisible edge pixels, so the cutout trims cleanly.
_al = knight.split()[3].point(lambda v: 0 if v < 40 else v)
knight.putalpha(_al)
_px = _al.load()
_seen = bytearray(W * H)
_best = []
for _sy in range(H):
    for _sx in range(W):
        if _px[_sx, _sy] == 0 or _seen[_sy * W + _sx]:
            continue
        _blob, _stack = [], [(_sx, _sy)]
        _seen[_sy * W + _sx] = 1
        while _stack:
            _x, _y = _stack.pop()
            _blob.append((_x, _y))
            for _nx, _ny in ((_x + 1, _y), (_x - 1, _y), (_x, _y + 1), (_x, _y - 1)):
                if 0 <= _nx < W and 0 <= _ny < H and not _seen[_ny * W + _nx] and _px[_nx, _ny] > 0:
                    _seen[_ny * W + _nx] = 1
                    _stack.append((_nx, _ny))
        if len(_blob) > len(_best):
            _best = _blob
_keep = Image.new('L', (W, H), 0)
_kp = _keep.load()
for _x, _y in _best:
    _kp[_x, _y] = _px[_x, _y]
knight.putalpha(_keep)
# Every edge pixel of the silhouette is the knight's dark outline: give the semi-transparent
# ones the outline's own color so no blue fringe survives on dark products / backgrounds.
# (The blend of outline + blue is often fully OPAQUE, so recolor the whole outer band -- every
# knight pixel within 2 px of the transparent background; the outline is ~15 px thick.)
from PIL import ImageFilter
_eroded = knight.split()[3].filter(ImageFilter.MinFilter(5)).load()
_rgba = knight.load()
for _x, _y in _best:
    if _eroded[_x, _y] == 0:
        _rgba[_x, _y] = (32, 30, 22, _rgba[_x, _y][3])
knight = knight.crop(knight.getbbox())
knight.save(os.path.join(OUT, 'sla-knight.png'))

# ── 3. print canvases: 15x18 in @300 dpi, art centered in the upper chest area ─
def print_canvas(art, name, max_w, top):
    canvas = Image.new('RGBA', (4500, 5400), (0, 0, 0, 0))
    a = art.copy()
    scale = max_w / a.size[0]
    a = a.resize((int(a.size[0] * scale), int(a.size[1] * scale)), Image.LANCZOS)
    canvas.paste(a, ((4500 - a.size[0]) // 2, top), a)
    canvas.save(os.path.join(OUT, name), dpi=(300, 300))

print_canvas(knight, 'sla-knight-print.png', 2700, 300)
print_canvas(logo_light, 'sla-logo-print-dark-ink.png', 3300, 300)
print_canvas(logo_dark, 'sla-logo-print-white-ink.png', 3300, 300)

# ── 4. banners ────────────────────────────────────────────────────────────────
def fit(img, h):
    return img.resize((int(img.size[0] * h / img.size[1]), h), Image.LANCZOS)

def text_lines(d, x, y, scale, center=False, width=None):
    lines = [
        ('SLA CAPITAL', font('segoeuib.ttf', int(62 * scale)), WHITE, int(8 * scale)),
        ('SHOP', font('georgiab.ttf', int(190 * scale)), ORANGE, int(30 * scale)),
        ('Gear for our team, our borrowers', font('segoeuib.ttf', int(44 * scale)), PEACH, int(8 * scale)),
        ('and our investors.', font('segoeuib.ttf', int(44 * scale)), PEACH, int(22 * scale)),
        ('Printed on demand and shipped to your door.', font('segoeui.ttf', int(36 * scale)), MUTED, 0),
    ]
    for txt, f, color, gap in lines:
        bbox = d.textbbox((0, 0), txt, font=f)
        tx = x + ((width - (bbox[2] - bbox[0])) // 2 if center else 0)
        d.text((tx, y - bbox[1]), txt, font=f, fill=color)
        y += (bbox[3] - bbox[1]) + gap
    return y

def bars(d, x, y0, y1, w, gap):
    # the two orange rules from the logo's dollar sign, as the banner's accent
    d.rectangle([x, y0, x + w, y1], fill=ORANGE)
    d.rectangle([x + w + gap, y0, x + 2 * w + gap, y1], fill=ORANGE)

# desktop 2400x900: text left, knight right
desk = Image.new('RGB', (2400, 900), PLUM)
d = ImageDraw.Draw(desk)
bars(d, 150, 170, 730, 14, 16)
text_lines(d, 230, 205, 1.0)
k = fit(knight, 740)
desk.paste(k, (2400 - k.size[0] - 190, 80), k)
desk.save(os.path.join(OUT, 'shop-banner-desktop.jpg'), quality=90)

# mobile 1080x1350: knight on top, text centered below
mob = Image.new('RGB', (1080, 1350), PLUM)
d = ImageDraw.Draw(mob)
k = fit(knight, 640)
mob.paste(k, ((1080 - k.size[0]) // 2, 130), k)
text_lines(d, 60, 860, 0.82, center=True, width=960)
mob.save(os.path.join(OUT, 'shop-banner-mobile.jpg'), quality=90)

# ── 5. gift card cover 1600x1000 ───────────────────────────────────────────────
card = Image.new('RGB', (1600, 1000), PLUM)
d = ImageDraw.Draw(card)
lg = fit(logo_dark, 420)
card.paste(lg, (110, 110), lg)
k = fit(knight, 560)
card.paste(k, (1600 - k.size[0] - 110, 330), k)
d.rectangle([110, 640, 124, 880], fill=ORANGE)
d.rectangle([140, 640, 154, 880], fill=ORANGE)
f1 = font('georgiab.ttf', 120)
f2 = font('segoeui.ttf', 40)
bb = d.textbbox((0, 0), 'GIFT CARD', font=f1)
d.text((200, 650 - bb[1]), 'GIFT CARD', font=f1, fill=WHITE)
d.text((204, 800), 'Good for anything in the SLA Capital Shop', font=f2, fill=PEACH)
card.save(os.path.join(OUT, 'gift-card.png'))

print('kit ->', OUT)
for n in sorted(os.listdir(OUT)):
    im = Image.open(os.path.join(OUT, n))
    print('  %-34s %s %s' % (n, im.size, im.mode))

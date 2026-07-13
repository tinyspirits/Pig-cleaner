#!/usr/bin/env python3
"""
Cắt sprite + xóa nền ca-rô xám từ sprite sheet heo cute
Input:  src/renderer/assets/Gemini_Generated_Image_57x9jc57x9jc57x9.png (2816x1536)
Output: src/renderer/assets/sprites/*.png  (transparent PNG)
"""
from PIL import Image
import os

INPUT  = "src/renderer/assets/Gemini_Generated_Image_57x9jc57x9jc57x9.png"
OUT    = "src/renderer/assets/sprites"
os.makedirs(OUT, exist_ok=True)

# ── 1. Mở ảnh gốc ──────────────────────────────────────────────────────────
img = Image.open(INPUT).convert("RGBA")
W, H = img.size
print(f"Sprite sheet: {W}x{H}")

# ── 2. Xóa nền ca-rô xám ───────────────────────────────────────────────────
# Ca-rô có 2 tông xám: ~(192,192,192) sáng và ~(128,128,128) tối
# Heo màu hồng → R > G ≈ B, pink_bias cao
# Xám → R ≈ G ≈ B, pink_bias thấp

pixels = img.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = pixels[x, y]
        if a < 200:          # đã transparent → bỏ qua
            continue
        gray_spread  = max(abs(int(r)-int(g)), abs(int(g)-int(b)), abs(int(r)-int(b)))
        pink_bias    = int(r) - max(int(g), int(b))
        brightness   = (int(r)+int(g)+int(b)) // 3
        # Xóa nếu: màu gần xám + không hồng + đủ sáng để là ca-rô
        if gray_spread < 22 and pink_bias < 28 and brightness > 85:
            pixels[x, y] = (r, g, b, 0)

# Lưu clean sheet để kiểm tra
img.save("src/renderer/assets/pig-sprites-clean.png")
print("Saved: pig-sprites-clean.png")

# ── 3. Định nghĩa vùng crop (toạ độ trên ảnh 2816x1536) ───────────────────
#
#  ROW 1  (y 20–385)  : 3 pigs with bow ribbon
#  ROW 2  (y 395–790) : 6 walking pigs
#  ROW 3  (y 800–1155): sniff • sleep-side • [gap] • happy+heart • happy2
#  ROW 4  (y 1160–1536): 4 sleeping pigs
#
crops = {
    # ── ROW 1 ──────────────────────────────
    "idle":       ( 570,  20, 1000,  390),   # bow, cute front
    "idle2":      (1060,  20, 1490,  390),   # bow, wink
    "idle3":      (1540,  20, 1980,  390),   # bow, side

    # ── ROW 2 ──────────────────────────────
    "walk1":      (  20, 395,  400,  790),
    "walk2":      ( 415, 395,  800,  790),
    "walk3":      ( 820, 395, 1175,  790),
    "walk4":      (1190, 395, 1565,  790),
    "walk5":      (1590, 395, 1965,  790),
    "walk6":      (2010, 395, 2360,  790),

    # ── ROW 3 ──────────────────────────────
    "sniff":      (  30, 800,  490, 1130),   # loại bỏ chữ "sniff" bên phải
    "sleep_side": ( 555, 800, 1070, 1155),   # nằm ngang, nháy mắt
    "happy":      (1250, 800, 1800, 1155),   # mồm há + heart
    "happy2":     (1810, 800, 2270, 1155),   # mồm há không heart

    # ── ROW 4 ──────────────────────────────
    "sleep1":     (  20,1160,  570, 1536),   # ngủ + zzz
    "sleep2":     ( 495,1160, 1050, 1536),
    "sleep3":     (1010,1160, 1560, 1536),
    "sleep4":     (1535,1160, 2080, 1536),
}

# ── 4. Crop + auto-trim + scale 50% + lưu ─────────────────────────────────
PAD = 12   # padding xung quanh bbox

for name, (x1, y1, x2, y2) in crops.items():
    region  = img.crop((x1, y1, x2, y2))
    bbox    = region.getbbox()          # auto-trim vùng transparent
    if not bbox:
        print(f"  WARN {name}: empty crop, skip")
        continue
    bx1 = max(0, bbox[0] - PAD)
    by1 = max(0, bbox[1] - PAD)
    bx2 = min(region.width,  bbox[2] + PAD)
    by2 = min(region.height, bbox[3] + PAD)
    trimmed = region.crop((bx1, by1, bx2, by2))
    # Scale xuống 50% (dùng NEAREST để pixel art sắc nét)
    w2, h2 = trimmed.width // 2, trimmed.height // 2
    final  = trimmed.resize((w2, h2), Image.NEAREST)
    out_path = f"{OUT}/{name}.png"
    final.save(out_path)
    print(f"  {name:15s} {final.size}")

print(f"\nDone! {len(crops)} sprites in {OUT}/")

import os
from PIL import Image

img = Image.open('src/renderer/assets/Gemini_Generated_Image_57x9jc57x9jc57x9.png').convert('RGBA')
width, height = img.size
data = img.load()

# Checkerboard colors
c1 = (172, 172, 172)
c2 = (204, 204, 204)

def is_bg(r, g, b, a):
    if a < 128: return True
    if abs(r - c1[0]) < 10 and abs(g - c1[1]) < 10 and abs(b - c1[2]) < 10: return True
    if abs(r - c2[0]) < 10 and abs(g - c2[1]) < 10 and abs(b - c2[2]) < 10: return True
    return False

# Find rows containing content
content_rows = []
for y in range(height):
    has_content = False
    for x in range(width):
        r, g, b, a = data[x, y]
        if not is_bg(r, g, b, a):
            has_content = True
            break
    if has_content:
        content_rows.append(y)

# Group content rows into bands (the 4 rows of pigs)
bands = []
if content_rows:
    start = content_rows[0]
    for i in range(1, len(content_rows)):
        if content_rows[i] > content_rows[i-1] + 10: # gap of 10px
            bands.append((start, content_rows[i-1]))
            start = content_rows[i]
    bands.append((start, content_rows[-1]))

print("Row bands:")
for i, (y1, y2) in enumerate(bands):
    print(f"  Band {i}: y={y1} to {y2} (height {y2-y1})")

# For each band, find content columns (the individual pigs)
pigs = []
for i, (y1, y2) in enumerate(bands):
    content_cols = []
    for x in range(width):
        has_content = False
        for y in range(y1, y2 + 1):
            r, g, b, a = data[x, y]
            if not is_bg(r, g, b, a):
                has_content = True
                break
        if has_content:
            content_cols.append(x)
            
    col_bands = []
    if content_cols:
        start = content_cols[0]
        for j in range(1, len(content_cols)):
            if content_cols[j] > content_cols[j-1] + 10: # gap of 10px
                col_bands.append((start, content_cols[j-1]))
                start = content_cols[j]
        col_bands.append((start, content_cols[-1]))
        
    print(f"Band {i} pigs (count: {len(col_bands)}):")
    for j, (x1, x2) in enumerate(col_bands):
        print(f"  Pig {j}: x={x1} to {x2} (width {x2-x1})")
        pigs.append((x1, y1, x2, y2))

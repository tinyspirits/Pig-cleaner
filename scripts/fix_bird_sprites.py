import os
import colorsys
from PIL import Image

walk_dir = 'src/renderer/assets/bird_walk_aligned'
target_w, target_h = 377, 361
offset_x, offset_y = 38, 59

def process_image(path):
    img = Image.open(path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    # 1. Color correction
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                h_val, s_val, v_val = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
                # Only shift colors that have some saturation and value (ignore black/white outlines/eyes)
                if s_val > 0.05 and v_val > 0.1:
                    h_val = (h_val - (29.5 / 360.0)) % 1.0
                    s_val = min(1.0, max(0.0, s_val + 0.09))
                    r_new, g_new, b_new = colorsys.hsv_to_rgb(h_val, s_val, v_val)
                    pixels[x, y] = (int(r_new * 255), int(g_new * 255), int(b_new * 255), a)
                    
    # 2. Resize and align canvas
    new_img = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    new_img.paste(img, (offset_x, offset_y))
    
    # Save back
    new_img.save(path)

for f in os.listdir(walk_dir):
    if f.endswith('.png'):
        print(f"Processing {f}...")
        process_image(os.path.join(walk_dir, f))

print("Done!")

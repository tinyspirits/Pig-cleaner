import os
import colorsys
from PIL import Image

walk_dir = 'src/renderer/assets/bird_walk_aligned'
target_w, target_h = 377, 361
scale = 0.8

def process_image(path):
    img = Image.open(path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    # 1. Color shift (invert hues to turn orange body to blue, and blue belly to orange)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                h_val, s_val, v_val = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
                if s_val > 0.05 and v_val > 0.1:
                    # Shift hue by 180 degrees (0.5 in 0-1 range)
                    h_val = (h_val + 0.5) % 1.0
                    r_new, g_new, b_new = colorsys.hsv_to_rgb(h_val, s_val, v_val)
                    pixels[x, y] = (int(r_new * 255), int(g_new * 255), int(b_new * 255), a)

    # 2. Scale image
    new_size = (int(img.width * scale), int(img.height * scale))
    scaled_img = img.resize(new_size, Image.NEAREST)
    
    # Get bounding box of scaled image to align it correctly
    bbox = scaled_img.getbbox()
    if not bbox:
        return
        
    scaled_bottom = bbox[3]
    scaled_center_x = (bbox[0] + bbox[2]) / 2.0
    
    # Target alignment: bottom at 274, center_x at 188.5
    offset_y = 274 - scaled_bottom
    offset_x = int(188.5 - scaled_center_x)
    
    # Create new canvas and paste
    new_img = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    new_img.paste(scaled_img, (offset_x, offset_y))
    
    # Save back
    new_img.save(path)

for f in os.listdir(walk_dir):
    if f.endswith('.png'):
        print(f"Processing {f}...")
        process_image(os.path.join(walk_dir, f))

print("Done!")

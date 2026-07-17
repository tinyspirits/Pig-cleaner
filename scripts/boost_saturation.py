import os
import colorsys
from PIL import Image

walk_dir = 'src/renderer/assets/bird_walk_aligned'

def boost_saturation(path):
    img = Image.open(path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                h_val, s_val, v_val = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
                # Boost saturation if it's not a grayscale pixel
                if s_val > 0.05 and v_val > 0.1:
                    s_val = min(1.0, s_val + 0.15) # Boost saturation by 0.15 to make it vibrant
                    r_new, g_new, b_new = colorsys.hsv_to_rgb(h_val, s_val, v_val)
                    pixels[x, y] = (int(r_new * 255), int(g_new * 255), int(b_new * 255), a)
                    
    img.save(path)

for f in os.listdir(walk_dir):
    if f.endswith('.png'):
        print(f"Boosting saturation for {f}...")
        boost_saturation(os.path.join(walk_dir, f))

print("Done!")

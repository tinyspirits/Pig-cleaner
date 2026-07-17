import os
import colorsys
from PIL import Image

fly_dir = 'src/renderer/assets/bird_fly_aligned'
walk_dir = 'src/renderer/assets/bird_walk_aligned'

def get_avg_hue(img_path):
    img = Image.open(img_path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    hues = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 100:  # non-transparent pixels
                h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
                if s > 0.1 and v > 0.2: # filter out white/black/gray (like the eye)
                    hues.append(h * 360)
    
    if not hues:
        return 0
    return sum(hues) / len(hues)

fly_hue = get_avg_hue(os.path.join(fly_dir, 'bird_01.png'))
walk_hue = get_avg_hue(os.path.join(walk_dir, 'bird_walk_01.png'))

print(f"Fly avg hue: {fly_hue}")
print(f"Walk avg hue: {walk_hue}")
print(f"Shift required: {fly_hue - walk_hue}")

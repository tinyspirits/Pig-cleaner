import os
import colorsys
from PIL import Image

fly_dir = 'src/renderer/assets/bird_fly_aligned'
walk_dir = 'src/renderer/assets/bird_walk_aligned'

def get_avg_hsv(img_path):
    img = Image.open(img_path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    hues = []
    sats = []
    vals = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 100:
                h_val, s_val, v_val = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
                if s_val > 0.1 and v_val > 0.2:
                    hues.append(h_val * 360)
                    sats.append(s_val)
                    vals.append(v_val)
                    
    if not hues:
        return 0, 0, 0
    return sum(hues)/len(hues), sum(sats)/len(sats), sum(vals)/len(vals)

f_h, f_s, f_v = get_avg_hsv(os.path.join(fly_dir, 'bird_01.png'))
w_h, w_s, w_v = get_avg_hsv(os.path.join(walk_dir, 'bird_walk_01.png'))

print(f"Fly: H={f_h:.1f}, S={f_s:.2f}, V={f_v:.2f}")
print(f"Walk: H={w_h:.1f}, S={w_s:.2f}, V={w_v:.2f}")
print(f"Diff: dH={f_h - w_h:.1f}, dS={f_s - w_s:.2f}, dV={f_v - w_v:.2f}")

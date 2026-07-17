import os
from PIL import Image

walk_dir = 'src/renderer/assets/bird_walk_aligned'
target_w, target_h = 377, 361
offset_x, offset_y = 38, 59

def process_image(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    
    # Just resize and align canvas, no hue shifting
    new_img = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    new_img.paste(img, (offset_x, offset_y))
    
    # Save back
    new_img.save(path)

for f in os.listdir(walk_dir):
    if f.endswith('.png'):
        print(f"Padding {f}...")
        process_image(os.path.join(walk_dir, f))

print("Done!")

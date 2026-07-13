#!/usr/bin/env python3
import os
from PIL import Image

SPRITES_DIR = 'src/renderer/assets/sprites'
CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200

def get_head_center_x(img):
    """Calculate the average X coordinate of non-transparent pixels in the top half of the pig."""
    data = img.load()
    x_sum = 0
    count = 0
    
    # We only look at the top part of the canvas to avoid the legs which move a lot
    for y in range(0, CANVAS_HEIGHT - 60): 
        for x in range(CANVAS_WIDTH):
            a = data[x, y][3]
            if a > 50:
                x_sum += x
                count += 1
                
    if count == 0:
        return CANVAS_WIDTH // 2
    return x_sum / count

def align_group(group_name, frames):
    print(f"Aligning {group_name}...")
    images = []
    centers = []
    
    for f in frames:
        path = os.path.join(SPRITES_DIR, f)
        img = Image.open(path).convert('RGBA')
        images.append((f, img, path))
        centers.append(get_head_center_x(img))
        
    # Pick the first frame's center as the reference
    ref_center = centers[0]
    
    for i, (fname, img, path) in enumerate(images):
        shift_x = int(ref_center - centers[i])
        print(f"  {fname}: shift X by {shift_x}px")
        
        if shift_x == 0:
            continue
            
        new_img = Image.new('RGBA', (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))
        new_img.paste(img, (shift_x, 0))
        new_img.save(path, 'PNG')

if __name__ == '__main__':
    # Walk frames
    align_group('walking', ['walk1.png', 'walk2.png', 'walk3.png', 'walk4.png', 'walk5.png', 'walk6.png'])
    # Sleep frames
    align_group('sleeping', ['sleep1.png', 'sleep2.png', 'sleep3.png', 'sleep4.png', 'sleep_side.png'])
    # Idle frames
    align_group('idle', ['idle.png', 'idle2.png', 'idle3.png'])

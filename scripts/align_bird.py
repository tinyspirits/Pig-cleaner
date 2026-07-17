import cv2
import numpy as np
import os

os.makedirs('src/renderer/assets/bird_sprites', exist_ok=True)
input_dir = 'src/renderer/assets/bird_fly_frames'

CANVAS_WIDTH = 250
CANVAS_HEIGHT = 250
SCALE = 0.5

for i in range(24):
    img = cv2.imread(f'{input_dir}/frame_{i:02d}.png', cv2.IMREAD_UNCHANGED)
    if img is None:
        continue
    
    # Resize the whole cell
    w = int(img.shape[1] * SCALE)
    h = int(img.shape[0] * SCALE)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    
    # To keep them aligned naturally, we just crop a fixed 250x250 region from the center of the scaled cell.
    # The cell is 234 x 192 (after 0.5 scale). Wait, if the cell is 234x192, it fits inside 250x250 entirely!
    # So we can just place the whole cell in the center of the 250x250 canvas.
    
    canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
    
    final_x = (CANVAS_WIDTH - w) // 2
    final_y = (CANVAS_HEIGHT - h) // 2
    
    canvas[final_y:final_y+h, final_x:final_x+w] = img
    
    cv2.imwrite(f'src/renderer/assets/bird_sprites/bird_fly_{i+1}.png', canvas)

print("Done cutting and aligning bird frames (Fixed alignment)!")

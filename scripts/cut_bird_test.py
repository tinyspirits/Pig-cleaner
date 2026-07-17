import cv2
import numpy as np
import os

img = cv2.imread('src/renderer/assets/bird-fly.png', cv2.IMREAD_UNCHANGED)
H, W = img.shape[:2]
print(f"Image shape: {W}x{H}")

# Try to find a grid. 24 frames could be 6 cols x 4 rows
cols, rows = 6, 4
cw = W // cols
ch = H // rows
print(f"Testing {cols}x{rows} grid: cell size {cw}x{ch}")

out_dir = 'src/renderer/assets/bird_fly_frames'
os.makedirs(out_dir, exist_ok=True)

for r in range(rows):
    for c in range(cols):
        x = c * cw
        y = r * ch
        cell = img[y:y+ch, x:x+cw]
        cv2.imwrite(f"{out_dir}/frame_{r*cols+c:02d}.png", cell)
print("Saved 24 frames to", out_dir)

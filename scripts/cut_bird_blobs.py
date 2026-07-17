import cv2
import numpy as np
import os

input_path = 'src/renderer/assets/bird-fly.png'
out_dir = 'src/renderer/assets/bird_sprites'
os.makedirs(out_dir, exist_ok=True)

for f in os.listdir(out_dir):
    if f.startswith('bird_fly_'):
        os.remove(os.path.join(out_dir, f))

img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
if img.shape[2] == 4:
    alpha = img[:,:,3] / 255.0
    color = img[:,:,:3]
    bg = np.ones_like(color) * 255
    bgr = cv2.convertScaleAbs(color * alpha[:,:,np.newaxis] + bg * (1 - alpha[:,:,np.newaxis]))
else:
    bgr = img.copy()

hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
lower_bound = np.array([0, 30, 80])
upper_bound = np.array([179, 255, 255])
mask = cv2.inRange(hsv, lower_bound, upper_bound)
kernel = np.ones((25,25), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

valid_contours = []
for cnt in cnts:
    x, y, w, h = cv2.boundingRect(cnt)
    area = w * h
    if area > 1000 and w > 40 and h > 40:
        valid_contours.append((x, y, w, h))

valid_contours.sort(key=lambda b: (b[1] // 200, b[0]))

print(f"Extracting {len(valid_contours)} birds...")

CANVAS_SIZE = 250

for i, (x, y, w, h) in enumerate(valid_contours):
    pad = 15
    bx = max(0, x-pad)
    by = max(0, y-pad)
    bw = min(bgr.shape[1]-bx, w+pad*2)
    bh = min(bgr.shape[0]-by, h+pad*2)
    
    crop_bgr = bgr[by:by+bh, bx:bx+bw]
    alpha = np.ones((bh, bw), dtype=np.uint8) * 255
    
    # Transparent background (white)
    white_m = (crop_bgr[:,:,0] > 220) & (crop_bgr[:,:,1] > 220) & (crop_bgr[:,:,2] > 220)
    alpha[white_m] = 0
    
    crop_bgra = np.dstack((crop_bgr, alpha))
    
    # Scale
    scale = 0.5
    nw = int(crop_bgra.shape[1] * scale)
    nh = int(crop_bgra.shape[0] * scale)
    crop_scaled = cv2.resize(crop_bgra, (nw, nh), interpolation=cv2.INTER_AREA)
    
    # Center in CANVAS
    canvas = np.zeros((CANVAS_SIZE, CANVAS_SIZE, 4), dtype=np.uint8)
    
    if nw > CANVAS_SIZE or nh > CANVAS_SIZE:
        s2 = min(CANVAS_SIZE / nw, CANVAS_SIZE / nh) * 0.9
        nw = int(nw * s2)
        nh = int(nh * s2)
        crop_scaled = cv2.resize(crop_scaled, (nw, nh), interpolation=cv2.INTER_AREA)
    
    cx, cy = (CANVAS_SIZE - nw) // 2, (CANVAS_SIZE - nh) // 2
    canvas[cy:cy+nh, cx:cx+nw] = crop_scaled
    
    out_path = os.path.join(out_dir, f'bird_fly_{i+1:02d}.png')
    cv2.imwrite(out_path, canvas)

print("Done extracting and aligning 28 birds!")

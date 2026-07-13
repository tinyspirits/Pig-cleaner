import cv2
import numpy as np
import os

img_path = 'src/renderer/assets/actions.png'
img = cv2.imread(img_path)
if img is None:
    print("Could not read image!")
    exit(1)
    
height, width = img.shape[:2]

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
_, s, _ = cv2.split(hsv)
_, mask = cv2.threshold(s, 15, 255, cv2.THRESH_BINARY)

kernel = np.ones((15, 15), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

rects = []
for c in contours:
    if cv2.contourArea(c) > 5000:
        x, y, w, h = cv2.boundingRect(c)
        pad = 5
        x = max(0, x - pad)
        y = max(0, y - pad)
        w = min(width - x, w + 2*pad)
        h = min(height - y, h + 2*pad)
        rects.append((x, y, w, h))

rects.sort(key=lambda r: (r[1] // (height // 4 if height > 1000 else 200), r[0]))
print(f"Found {len(rects)} pigs!")

out_dir = 'scripts/extracted_new'
os.makedirs(out_dir, exist_ok=True)

for i, (x, y, w, h) in enumerate(rects):
    roi = img[y:y+h, x:x+w]
    roi_mask = mask[y:y+h, x:x+w]
    
    roi_contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_mask = np.zeros_like(roi_mask)
    if roi_contours:
        largest = max(roi_contours, key=cv2.contourArea)
        cv2.drawContours(clean_mask, [largest], -1, 255, -1)
    
    b, g, r = cv2.split(roi)
    rgba = cv2.merge((b, g, r, clean_mask))
    
    cv2.imwrite(f'{out_dir}/pig_{i}.png', rgba)

print("Done extracting new pigs!")

# Map them
gh, gw = 150, 150
cols = 5
rows = (len(rects) + cols - 1) // cols
grid = np.zeros((gh*rows, gw*cols, 4), dtype=np.uint8)

for i in range(len(rects)):
    pimg = cv2.imread(f'{out_dir}/pig_{i}.png', cv2.IMREAD_UNCHANGED)
    pimg = cv2.resize(pimg, (gw, gh), interpolation=cv2.INTER_AREA)
    
    r_idx = i // cols
    c_idx = i % cols
    y_pos = r_idx * gh
    x_pos = c_idx * gw
    
    grid[y_pos:y_pos+gh, x_pos:x_pos+gw] = pimg
    cv2.putText(grid, str(i), (x_pos+10, y_pos+30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255,255), 2)

cv2.imwrite(f'{out_dir}/all_pigs_new.png', grid)
print("Created map!")

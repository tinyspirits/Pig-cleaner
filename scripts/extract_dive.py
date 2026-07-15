import cv2
import numpy as np
import os

img_path = 'src/renderer/assets/dive.png'
out_dir = 'src/renderer/assets/sprites/dive_frames'

img = cv2.imread(img_path)
if img is None:
    print(f"Could not read {img_path}!")
    exit(1)
    
os.makedirs(out_dir, exist_ok=True)

# Quantize colors to find background
img_q = (img // 5) * 5
colors, counts = np.unique(img_q.reshape(-1, 3), axis=0, return_counts=True)
top_colors = colors[np.argsort(-counts)][:5]

# Mask out top 2 colors (checkerboard)
mask = np.ones(img.shape[:2], dtype=bool)
for c in top_colors[:2]:
    dist = np.linalg.norm(img.astype(float) - c.astype(float), axis=2)
    mask = mask & (dist > 25)
    
mask = (mask * 255).astype(np.uint8)
kernel = np.ones((5, 5), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

# Process row by row to prevent vertical merging
height = img.shape[0]
num_rows = 4
row_h = height // num_rows

all_rects = []

for r in range(num_rows):
    y_start = r * row_h
    y_end = (r + 1) * row_h
    row_mask = mask[y_start:y_end, :]
    
    contours, _ = cv2.findContours(row_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Merge overlapping or close bounding boxes in the same row
    boxes = []
    for c in contours:
        if cv2.contourArea(c) > 1000:
            x, y, w, h = cv2.boundingRect(c)
            boxes.append([x, y, w, h])
            
    boxes.sort(key=lambda b: b[0])
    merged_boxes = []
    for b in boxes:
        if not merged_boxes:
            merged_boxes.append(b)
        else:
            last = merged_boxes[-1]
            if b[0] <= last[0] + last[2] + 50:
                new_x = min(last[0], b[0])
                new_y = min(last[1], b[1])
                new_w = max(last[0] + last[2], b[0] + b[2]) - new_x
                new_h = max(last[1] + last[3], b[1] + b[3]) - new_y
                merged_boxes[-1] = [new_x, new_y, new_w, new_h]
            else:
                merged_boxes.append(b)
                
    for bx, by, bw, bh in merged_boxes:
        if bw > 500:
            all_rects.append((bx, y_start + by, bw//2, bh))
            all_rects.append((bx + bw//2, y_start + by, bw - bw//2, bh))
        else:
            all_rects.append((bx, y_start + by, bw, bh))

all_rects.sort(key=lambda r: (r[1] // row_h, r[0]))
print(f"Found {len(all_rects)} dive frames!")

for i, (x, y, w, h) in enumerate(all_rects):
    pad = 10
    x = max(0, x - pad)
    y = max(0, y - pad)
    w = min(img.shape[1] - x, w + 2*pad)
    h = min(img.shape[0] - y, h + 2*pad)
    
    roi = img[y:y+h, x:x+w]
    roi_mask = mask[y:y+h, x:x+w]
    
    roi_contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_mask = np.zeros_like(roi_mask)
    for c in roi_contours:
        if cv2.contourArea(c) > 500:
            cv2.drawContours(clean_mask, [c], -1, 255, -1)
            
    b, g, r_ch = cv2.split(roi)
    rgba = cv2.merge((b, g, r_ch, clean_mask))
    cv2.imwrite(f'{out_dir}/dive_{i}.png', rgba)
    
gh, gw = 150, 150
cols = 6
map_rows = (len(all_rects) + cols - 1) // cols
grid = np.zeros((gh*map_rows, gw*cols, 4), dtype=np.uint8)

for i in range(len(all_rects)):
    pimg = cv2.imread(f'{out_dir}/dive_{i}.png', cv2.IMREAD_UNCHANGED)
    if pimg is not None:
        ph, pw = pimg.shape[:2]
        scale = min(gw/pw, gh/ph)
        new_w, new_h = int(pw*scale), int(ph*scale)
        pimg = cv2.resize(pimg, (new_w, new_h))
        
        r_idx = i // cols
        c_idx = i % cols
        y_pos = r_idx * gh + (gh - new_h)//2
        x_pos = c_idx * gw + (gw - new_w)//2
        
        grid[y_pos:y_pos+new_h, x_pos:x_pos+new_w] = pimg
        cv2.putText(grid, str(i), (c_idx*gw+10, r_idx*gh+30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255,255), 2)

cv2.imwrite(f'{out_dir}/all_dive_pigs.png', grid)
print("Created map all_dive_pigs.png!")

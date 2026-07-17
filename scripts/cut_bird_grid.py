import cv2
import numpy as np
import os

input_path = 'src/renderer/assets/bird-fly.png'
out_dir = 'src/renderer/assets/bird_sprites'
os.makedirs(out_dir, exist_ok=True)

img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
if img.shape[2] == 4:
    alpha = img[:,:,3] / 255.0
    color = img[:,:,:3]
    bg = np.ones_like(color) * 255
    bgr = cv2.convertScaleAbs(color * alpha[:,:,np.newaxis] + bg * (1 - alpha[:,:,np.newaxis]))
else:
    bgr = img.copy()

gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
# Invert to make grid lines white (they are black)
_, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

# Find horizontal lines
horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
detect_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
cnts_h = cv2.findContours(detect_horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnts_h = cnts_h[0] if len(cnts_h) == 2 else cnts_h[1]

# Find vertical lines
vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
detect_vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
cnts_v = cv2.findContours(detect_vertical, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cnts_v = cnts_v[0] if len(cnts_v) == 2 else cnts_v[1]

# Combine
grid = cv2.add(detect_horizontal, detect_vertical)

# Find grid cells
cnts = cv2.findContours(grid, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
cnts = cnts[0] if len(cnts) == 2 else cnts[1]

cells = []
for c in cnts:
    x, y, w, h = cv2.boundingRect(c)
    # The image is 2814 x 1536. 
    # A 7x4 grid means cells are roughly 400x300, or a bit smaller.
    if w > 150 and h > 150 and w < 600 and h < 500:
        cells.append((x, y, w, h))

print(f"Found {len(cells)} cells.")

# Sort cells top-to-bottom, left-to-right
cells.sort(key=lambda b: (b[1] // 100, b[0]))

# We know the first column is text "CHU KỲ BAY" etc.
# We want to skip the first column of the grid.
# Let's group by row.
rows = {}
for b in cells:
    ry = b[1] // 100
    if ry not in rows:
        rows[ry] = []
    rows[ry].append(b)

sorted_rows = sorted(rows.keys())
final_cells = []
for r in sorted_rows:
    row_cells = sorted(rows[r], key=lambda b: b[0])
    # The first cell in the row is the label column.
    if len(row_cells) >= 7:
        final_cells.extend(row_cells[1:8]) # Take the next 7 cells

print(f"Extracted {len(final_cells)} bird frames from grid.")

# Now for each cell, we extract the bird
CANVAS_SIZE = 250
# Clear old
for f in os.listdir(out_dir):
    if f.startswith('bird_fly_'):
        os.remove(os.path.join(out_dir, f))

# We will just take the cell, and find the bird bounding box to center it.
for i, (x, y, w, h) in enumerate(final_cells):
    cell = bgr[y:y+h, x:x+w]
    
    # Create mask for white background
    white_mask = (cell[:,:,0] > 220) & (cell[:,:,1] > 220) & (cell[:,:,2] > 220)
    
    # Also mask out the black text at the bottom.
    # Text is usually black. We can mask out black pixels.
    # Actually, we can just find the bounding box of non-white pixels 
    # that are NOT near the bottom edge. Or we can just find contours of the bird in the cell.
    
    cell_hsv = cv2.cvtColor(cell, cv2.COLOR_BGR2HSV)
    bird_mask = cv2.inRange(cell_hsv, np.array([0, 30, 80]), np.array([179, 255, 255]))
    kernel = np.ones((5,5), np.uint8)
    bird_mask = cv2.morphologyEx(bird_mask, cv2.MORPH_CLOSE, kernel)
    
    cnts_bird, _ = cv2.findContours(bird_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bird_bbox = None
    max_area = 0
    for c in cnts_bird:
        bx, by, bw, bh = cv2.boundingRect(c)
        if bw*bh > max_area:
            max_area = bw*bh
            bird_bbox = (bx, by, bw, bh)
            
    if bird_bbox:
        bx, by, bw, bh = bird_bbox
        pad = 5
        bx = max(0, bx-pad)
        by = max(0, by-pad)
        bw = min(cell.shape[1]-bx, bw+pad*2)
        bh = min(cell.shape[0]-by, bh+pad*2)
        
        crop_bgr = cell[by:by+bh, bx:bx+bw]
        alpha = np.ones((bh, bw), dtype=np.uint8) * 255
        
        # Make white transparent
        white_m = (crop_bgr[:,:,0] > 220) & (crop_bgr[:,:,1] > 220) & (crop_bgr[:,:,2] > 220)
        alpha[white_m] = 0
        
        crop_bgra = np.dstack((crop_bgr, alpha))
        
        scale = 0.5
        nw = int(crop_bgra.shape[1] * scale)
        nh = int(crop_bgra.shape[0] * scale)
        crop_scaled = cv2.resize(crop_bgra, (nw, nh), interpolation=cv2.INTER_AREA)
        
        canvas = np.zeros((CANVAS_SIZE, CANVAS_SIZE, 4), dtype=np.uint8)
        cx, cy = (CANVAS_SIZE - nw) // 2, (CANVAS_SIZE - nh) // 2
        canvas[cy:cy+nh, cx:cx+nw] = crop_scaled
        
        out_path = os.path.join(out_dir, f'bird_fly_{i+1}.png')
        cv2.imwrite(out_path, canvas)
    else:
        print(f"No bird found in frame {i+1}")

print("Done extracting from grid!")

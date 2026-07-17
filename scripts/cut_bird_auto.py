import cv2
import numpy as np
import os

input_path = 'src/renderer/assets/bird-fly.png'
out_dir = 'src/renderer/assets/bird_sprites'
os.makedirs(out_dir, exist_ok=True)

img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
if img is None:
    print("Failed to load image!")
    exit(1)

# The image is likely a screenshot or an AI generated image of a table.
# It has a white background, black text/lines, and a blue/brown bird.
# If it has an alpha channel, we drop it for color processing.
if img.shape[2] == 4:
    # Blend with white background first, just in case
    alpha_channel = img[:,:,3] / 255.0
    color_channels = img[:,:,:3]
    bg = np.ones_like(color_channels) * 255
    bgr = cv2.convertScaleAbs(color_channels * alpha_channel[:,:,np.newaxis] + bg * (1 - alpha_channel[:,:,np.newaxis]))
else:
    bgr = img.copy()

# Convert to HSV to easily isolate the bird
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

# The bird is mostly blue (Hue 100-140) and some orange/brown (Hue 10-30).
# Alternatively, we can just mask out the white background (high value, low saturation) 
# and black grid/text (low value).
# Let's create a mask for non-white and non-black.
# White: S < 30, V > 200
# Black/Gray: V < 100 or S < 30
# So bird is: S > 30 and V > 100
lower_bound = np.array([0, 30, 80])
upper_bound = np.array([179, 255, 255])
mask = cv2.inRange(hsv, lower_bound, upper_bound)

# Morphological operations to clean up noise and connect bird parts
kernel = np.ones((5,5), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Filter contours by area
valid_contours = []
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    area = w * h
    # A bird is likely somewhat large, e.g. > 1000 pixels area
    if area > 1000 and w > 20 and h > 20:
        valid_contours.append((x, y, w, h))

print(f"Found {len(valid_contours)} bird candidates.")

# Sort contours: group by rows (assuming y difference < 100 means same row)
valid_contours.sort(key=lambda b: b[1]) # sort by y first

rows = []
current_row = []
last_y = -1

for b in valid_contours:
    x, y, w, h = b
    if last_y == -1 or abs(y - last_y) < h: # same row
        current_row.append(b)
    else:
        current_row.sort(key=lambda item: item[0]) # sort by x
        rows.append(current_row)
        current_row = [b]
    last_y = y

if current_row:
    current_row.sort(key=lambda item: item[0])
    rows.append(current_row)

sorted_boxes = []
for r in rows:
    sorted_boxes.extend(r)

print(f"Sorted into {len(sorted_boxes)} frames across {len(rows)} rows.")

CANVAS_SIZE = 250
# Remove old frames
for f in os.listdir(out_dir):
    if f.startswith('bird_fly_'):
        os.remove(os.path.join(out_dir, f))

# We also want to remove the white background from the cropped bird to make it transparent!
# We can use the original image if it has alpha, but if it doesn't or if the background is white,
# we need to make white pixels transparent.
for i, (x, y, w, h) in enumerate(sorted_boxes):
    # Add a bit of padding around the bounding box
    pad = 10
    x1, y1 = max(0, x-pad), max(0, y-pad)
    x2, y2 = min(bgr.shape[1], x+w+pad), min(bgr.shape[0], y+h+pad)
    
    crop_bgr = bgr[y1:y2, x1:x2]
    
    # Create alpha channel: fully opaque
    alpha = np.ones((y2-y1, x2-x1), dtype=np.uint8) * 255
    
    # Make white background transparent
    # White is where R>220, G>220, B>220
    white_mask = (crop_bgr[:,:,0] > 220) & (crop_bgr[:,:,1] > 220) & (crop_bgr[:,:,2] > 220)
    
    # We can also make black text transparent if it's near the bird, but maybe the bird has black outlines.
    # Let's just make white transparent.
    # To avoid jagged edges, let's blur the mask or just use a simple threshold.
    alpha[white_mask] = 0
    
    # Reconstruct BGRA
    crop_bgra = np.dstack((crop_bgr, alpha))
    
    # Scale down by 0.5 if it's large
    scale = 0.5
    nw = int(crop_bgra.shape[1] * scale)
    nh = int(crop_bgra.shape[0] * scale)
    crop_scaled = cv2.resize(crop_bgra, (nw, nh), interpolation=cv2.INTER_AREA)
    
    # Center in CANVAS
    canvas = np.zeros((CANVAS_SIZE, CANVAS_SIZE, 4), dtype=np.uint8)
    
    # If the crop is bigger than canvas, resize it further
    if nw > CANVAS_SIZE or nh > CANVAS_SIZE:
        s2 = min(CANVAS_SIZE / nw, CANVAS_SIZE / nh) * 0.9
        nw = int(nw * s2)
        nh = int(nh * s2)
        crop_scaled = cv2.resize(crop_scaled, (nw, nh), interpolation=cv2.INTER_AREA)
    
    cx, cy = (CANVAS_SIZE - nw) // 2, (CANVAS_SIZE - nh) // 2
    canvas[cy:cy+nh, cx:cx+nw] = crop_scaled
    
    out_path = os.path.join(out_dir, f'bird_fly_{i+1}.png')
    cv2.imwrite(out_path, canvas)

print("Extraction and alignment complete!")

import cv2
import numpy as np
import os

img = cv2.imread('src/renderer/assets/Gemini_Generated_Image_57x9jc57x9jc57x9.png')
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

rects.sort(key=lambda r: ((r[1] + r[3]//2) // (height // 4), r[0]))
print(f"Found {len(rects)} pigs!")

os.makedirs('scripts/extracted_pigs', exist_ok=True)

for i, (x, y, w, h) in enumerate(rects):
    roi = img[y:y+h, x:x+w]
    roi_mask = mask[y:y+h, x:x+w]
    
    # Fill the contour to ensure eyes/highlights are opaque
    roi_contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    clean_mask = np.zeros_like(roi_mask)
    if roi_contours:
        largest = max(roi_contours, key=cv2.contourArea)
        cv2.drawContours(clean_mask, [largest], -1, 255, -1)
    
    b, g, r = cv2.split(roi)
    rgba = cv2.merge((b, g, r, clean_mask))
    
    cv2.imwrite(f'scripts/extracted_pigs/pig_{i}.png', rgba)

print("Done extracting pigs!")

import cv2
import numpy as np

# Load all 17 pigs and put them in a grid 4x5
h, w = 150, 150
grid = np.zeros((h*4, w*5, 4), dtype=np.uint8)

for i in range(17):
    img = cv2.imread(f'scripts/extracted_pigs/pig_{i}.png', cv2.IMREAD_UNCHANGED)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    
    row = i // 5
    col = i % 5
    
    y = row * h
    x = col * w
    
    grid[y:y+h, x:x+w] = img
    
    # Add text label
    cv2.putText(grid, str(i), (x+10, y+30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255,255), 2)

cv2.imwrite('scripts/extracted_pigs/all_pigs.png', grid)

import cv2
import numpy as np
import os
from PIL import Image

CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200
SCALE = 0.45

def process_cell(cell_rgba):
    # cell_rgba is numpy array (H, W, 4)
    cell = np.copy(cell_rgba)
    
    # Erase top-left numbers (reduced to avoid clipping the bow)
    cell[0:80, 0:80] = 0
    
    _, alpha = cv2.threshold(cell[:,:,3], 127, 255, cv2.THRESH_BINARY)
    
    # Erode to break thin connections to grid lines
    kernel = np.ones((5,5), np.uint8)
    eroded = cv2.erode(alpha, kernel, iterations=1)
    
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(eroded, connectivity=8)
    valid_stats = stats[1:]
    if len(valid_stats) == 0:
        return None
        
    largest_idx = np.argmax(valid_stats[:, cv2.CC_STAT_AREA]) + 1
    
    # Create mask of the largest component
    duck_mask = (labels == largest_idx).astype(np.uint8) * 255
    
    # Dilate back to restore outline
    duck_mask = cv2.dilate(duck_mask, kernel, iterations=1)
    
    # Mask original cell
    cell[:, :, 3] = cv2.bitwise_and(cell[:, :, 3], cell[:, :, 3], mask=duck_mask)
    
    # Find bounding box of the dilated mask
    x, y, w, h = cv2.boundingRect(duck_mask)
    
    # Tight crop
    cropped = cell[y:y+h, x:x+w]
    return cropped

def main():
    img_pil = Image.open('src/renderer/assets/small_duck.png').convert('RGBA')
    img_np = np.array(img_pil)
    
    H, W, _ = img_np.shape
    cols = 8
    rows = 4
    cell_w = W // cols
    cell_h = H // rows
    
    out_dir = 'src/renderer/assets/duck_sprites'
    os.makedirs(out_dir, exist_ok=True)
    
    tight_crops = {}
    
    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col + 1
            left = col * cell_w
            top = row * cell_h
            cell = img_np[top:top+cell_h, left:left+cell_w]
            
            cropped = process_cell(cell)
            if cropped is not None:
                tight_crops[idx] = cropped
                
    for idx, cropped in tight_crops.items():
        w = int(cropped.shape[1] * SCALE)
        h = int(cropped.shape[0] * SCALE)
        scaled = cv2.resize(cropped, (w, h), interpolation=cv2.INTER_NEAREST)
        
        # Bottom-center alignment
        canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
        
        # Bottom center at (150, 190)
        # So x starts at 150 - w//2
        # y starts at 190 - h
        x = CANVAS_WIDTH // 2 - w // 2
        y = CANVAS_HEIGHT - 10 - h
        
        # For diving/drowning/sink, we might want to center them vertically instead of bottom-aligning
        # because they are swimming.
        # But for now, let's just bottom align everything, since the animation logic in PigPet 
        # already handles the vertical offsets (visualY) based on swimAction!
        
        # Just ensure we don't go out of bounds
        y = max(0, min(CANVAS_HEIGHT - h, y))
        x = max(0, min(CANVAS_WIDTH - w, x))
        
        canvas[y:y+h, x:x+w] = scaled
        cv2.imwrite(f'{out_dir}/duck_{idx}.png', cv2.cvtColor(canvas, cv2.COLOR_RGBA2BGRA))
        
    print("Alignment complete using bottom-center locking!")

if __name__ == '__main__':
    main()

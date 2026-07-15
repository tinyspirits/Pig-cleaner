import cv2
import numpy as np
import os
from PIL import Image

CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200

groups = {
    'idle': [1, 2, 3, 4],
    'walk': [5, 6, 7, 8, 9],
    'eat': [10, 11],
    'sleep': [12, 13, 14, 15],
    'drag': [16, 17, 18],
    'drown': [19, 20, 21],
    'sink': [22, 23, 24],
    'dive': [25, 26, 27, 28, 29, 30, 31, 32]
}

def clean_and_tight_crop(img_rgba):
    # Erase borders
    border = 10
    img_rgba[0:border, :] = 0
    img_rgba[-border:, :] = 0
    img_rgba[:, 0:border] = 0
    img_rgba[:, -border:] = 0
    
    # Erase top-left (for numbers)
    img_rgba[0:120, 0:120] = 0
    
    _, alpha_mask = cv2.threshold(img_rgba[:,:,3], 127, 255, cv2.THRESH_BINARY)
    
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(alpha_mask, connectivity=8)
    if num_labels <= 1:
        return None
        
    # Find largest component
    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    duck_mask = (labels == largest_label).astype(np.uint8) * 255
    
    img_rgba[:, :, 3] = cv2.bitwise_and(img_rgba[:, :, 3], img_rgba[:, :, 3], mask=duck_mask)
    
    x, y, w, h, area = stats[largest_label]
    cropped = img_rgba[y:y+h, x:x+w]
    return cropped

def process_img(cropped_rgba):
    scale = 0.45
    w = int(cropped_rgba.shape[1] * scale)
    h = int(cropped_rgba.shape[0] * scale)
    return cv2.resize(cropped_rgba, (w, h), interpolation=cv2.INTER_NEAREST)

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
            cell = np.copy(img_np[top:top+cell_h, left:left+cell_w])
            
            cropped = clean_and_tight_crop(cell)
            if cropped is not None:
                tight_crops[idx] = cropped
                
    for group_name, frame_ids in groups.items():
        print(f"Aligning group {group_name}...")
        ref_id = frame_ids[0]
        if ref_id not in tight_crops:
            continue
            
        ref_img = process_img(tight_crops[ref_id])
        
        ref_x = (CANVAS_WIDTH - ref_img.shape[1]) // 2
        
        # Determine y position. Usually bottom-aligned, except maybe some specific states?
        # Let's align all to bottom (CANVAS_HEIGHT - 10) like the pig
        ref_y = CANVAS_HEIGHT - ref_img.shape[0] - 10
        
        ref_canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
        ref_canvas[ref_y:ref_y+ref_img.shape[0], ref_x:ref_x+ref_img.shape[1]] = ref_img
        
        # Save as BGRA for cv2.imwrite
        cv2.imwrite(f'{out_dir}/duck_{ref_id}.png', cv2.cvtColor(ref_canvas, cv2.COLOR_RGBA2BGRA))
        
        ref_gray = cv2.cvtColor(ref_img, cv2.COLOR_RGBA2GRAY)
        _, ref_mask = cv2.threshold(ref_img[:,:,3], 127, 255, cv2.THRESH_BINARY)
        ref_gray = cv2.bitwise_and(ref_gray, ref_gray, mask=ref_mask)
        
        for pid in frame_ids[1:]:
            if pid not in tight_crops: continue
            
            img = process_img(tight_crops[pid])
            gray = cv2.cvtColor(img, cv2.COLOR_RGBA2GRAY)
            _, mask = cv2.threshold(img[:,:,3], 127, 255, cv2.THRESH_BINARY)
            gray = cv2.bitwise_and(gray, gray, mask=mask)
            
            pad_size = 500
            ref_padded = np.zeros((pad_size, pad_size), dtype=np.float32)
            img_padded = np.zeros((pad_size, pad_size), dtype=np.float32)
            
            h1, w1 = ref_gray.shape
            h2, w2 = gray.shape
            
            r_y, r_x = pad_size//2 - h1//2, pad_size//2 - w1//2
            i_y, i_x = pad_size//2 - h2//2, pad_size//2 - w2//2
            
            ref_padded[r_y:r_y+h1, r_x:r_x+w1] = ref_gray
            img_padded[i_y:i_y+h2, i_x:i_x+w2] = gray
            
            shift, response = cv2.phaseCorrelate(img_padded, ref_padded)
            dx, dy = shift
            
            final_x = ref_x + (r_x - i_x) - int(round(dx))
            final_y = ref_y + (r_y - i_y) - int(round(dy))
            
            final_x = max(0, min(CANVAS_WIDTH - w2, final_x))
            
            # Allow some vertical shift but bound it
            if group_name in ['dive', 'drown', 'sink']:
                # Allow more vertical movement for swimming
                final_y = max(0, min(CANVAS_HEIGHT - h2, final_y))
            else:
                final_y = max(0, min(CANVAS_HEIGHT - h2, final_y))
            
            canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
            canvas[final_y:final_y+h2, final_x:final_x+w2] = img
            cv2.imwrite(f'{out_dir}/duck_{pid}.png', cv2.cvtColor(canvas, cv2.COLOR_RGBA2BGRA))

if __name__ == '__main__':
    main()

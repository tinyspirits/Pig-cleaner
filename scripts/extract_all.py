import cv2
import numpy as np
import os

def process_image(img_path, out_dir):
    img = cv2.imread(img_path)
    if img is None:
        print(f"Could not read {img_path}!")
        return
        
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
        
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Saturation > 40 safely ignores the grey checkerboard completely
    mask = mask & (hsv[:,:,1] > 40)
        
    mask = (mask * 255).astype(np.uint8)
    kernel_open = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)
    kernel_close = np.ones((15, 15), np.uint8) # merge splashes to pig body
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    all_rects = []
    for c in contours:
        if cv2.contourArea(c) > 10000:
            x, y, w, h = cv2.boundingRect(c)
            # A single pig is around 300px wide. If w > 500, it merged two pigs horizontally
            if w > 550:
                all_rects.append((x, y, w//2, h))
                all_rects.append((x + w//2, y, w - w//2, h))
            else:
                all_rects.append((x, y, w, h))

    # Sort rects mathematically by row (4 rows) and then x
    row_h = img.shape[0] // 4
    all_rects.sort(key=lambda r: ((r[1] + r[3]//2) // row_h, r[0]))
    
    print(f"Found {len(all_rects)} pigs in {img_path}!")

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
        cv2.imwrite(f'{out_dir}/pig_{i}.png', rgba)
        
    # Create Map
    gh, gw = 200, 200
    cols = 8
    map_rows = (len(all_rects) + cols - 1) // cols
    grid = np.zeros((gh*map_rows, gw*cols, 4), dtype=np.uint8)
    
    for i in range(len(all_rects)):
        pimg = cv2.imread(f'{out_dir}/pig_{i}.png', cv2.IMREAD_UNCHANGED)
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

    cv2.imwrite(f'{out_dir}/all_pigs.png', grid)
    print("Done!")

if __name__ == '__main__':
    process_image('src/renderer/assets/dive.png', 'src/renderer/assets/sprites/dive_frames')
    process_image('src/renderer/assets/drowning.png', 'src/renderer/assets/sprites/drowning_frames')

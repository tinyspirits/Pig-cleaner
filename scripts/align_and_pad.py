import cv2
import numpy as np
import os

os.makedirs('src/renderer/assets/sprites', exist_ok=True)

groups = {
    'idle':  [('idle.png', 0), ('idle2.png', 2), ('idle3.png', 3)],
    'walk':  [('walk1.png', 3), ('walk2.png', 4), ('walk3.png', 5), ('walk4.png', 6), ('walk5.png', 7), ('walk6.png', 8)],
    'sleep': [('sleep1.png', 13), ('sleep2.png', 14), ('sleep3.png', 15), ('sleep4.png', 16)],
    'happy': [('happy.png', 11), ('happy2.png', 12)],
    'misc':  [('sniff.png', 9), ('wink.png', 1), ('alert.png', 10)]
}

CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200

def process_img(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    scale = 0.45
    w = int(img.shape[1] * scale)
    h = int(img.shape[0] * scale)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    return img

for group_name, items in groups.items():
    print(f"Aligning {group_name}...")
    
    ref_name, ref_id = items[0]
    ref_img = process_img(f'scripts/extracted_pigs/pig_{ref_id}.png')
    
    ref_x = (CANVAS_WIDTH - ref_img.shape[1]) // 2
    ref_y = CANVAS_HEIGHT - ref_img.shape[0] - 10
    
    ref_canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
    ref_canvas[ref_y:ref_y+ref_img.shape[0], ref_x:ref_x+ref_img.shape[1]] = ref_img
    cv2.imwrite(f'src/renderer/assets/sprites/{ref_name}', ref_canvas)
    
    # We use a thresholded mask of the pig for phase correlation to avoid transparent bg noise
    ref_gray = cv2.cvtColor(ref_img, cv2.COLOR_BGRA2GRAY)
    _, ref_mask = cv2.threshold(ref_img[:,:,3], 127, 255, cv2.THRESH_BINARY)
    ref_gray = cv2.bitwise_and(ref_gray, ref_gray, mask=ref_mask)
    
    for name, pid in items[1:]:
        img = process_img(f'scripts/extracted_pigs/pig_{pid}.png')
        gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
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
        if group_name == 'sleep' or abs(dy) > 20:
            final_y = CANVAS_HEIGHT - h2 - 10
        else:
            final_y = max(0, min(CANVAS_HEIGHT - h2, final_y))
            
        canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
        canvas[final_y:final_y+h2, final_x:final_x+w2] = img
        cv2.imwrite(f'src/renderer/assets/sprites/{name}', canvas)

print("Done padding and aligning!")

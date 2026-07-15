import cv2
import numpy as np
import os

in_dir = 'src/renderer/assets/sprites/drowning_frames'
out_dir = 'src/renderer/assets/sprites/drowning_frames_aligned'
os.makedirs(out_dir, exist_ok=True)

CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200

def process_img(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    scale = 0.45
    w = int(img.shape[1] * scale)
    h = int(img.shape[0] * scale)
    img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    return img

print("Aligning drown frames...")
ref_name = 'pig_11.png'
ref_img = process_img(f'{in_dir}/{ref_name}')

ref_x = (CANVAS_WIDTH - ref_img.shape[1]) // 2
ref_y = CANVAS_HEIGHT - ref_img.shape[0] - 10

ref_canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
ref_canvas[ref_y:ref_y+ref_img.shape[0], ref_x:ref_x+ref_img.shape[1]] = ref_img
cv2.imwrite(f'{out_dir}/{ref_name}', ref_canvas)

ref_gray = cv2.cvtColor(ref_img, cv2.COLOR_BGRA2GRAY)
_, ref_mask = cv2.threshold(ref_img[:,:,3], 127, 255, cv2.THRESH_BINARY)
ref_gray = cv2.bitwise_and(ref_gray, ref_gray, mask=ref_mask)

# frames needed: pig_11 to pig_19
for i in range(12, 20):
    name = f'pig_{i}.png'
    img = process_img(f'{in_dir}/{name}')
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
    final_y = max(0, min(CANVAS_HEIGHT - h2, final_y))
        
    canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
    canvas[final_y:final_y+h2, final_x:final_x+w2] = img
    cv2.imwrite(f'{out_dir}/{name}', canvas)

print("Done padding and aligning drown frames!")

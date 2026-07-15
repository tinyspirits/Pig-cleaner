import cv2
import numpy as np
import glob
import os

ref_path = 'src/renderer/assets/sprites/idle.png'
ref_img = cv2.imread(ref_path, cv2.IMREAD_UNCHANGED)

# We want to match the color distribution. 
# Simplest approach: match mean and std dev of each channel (L*a*b* space is best).

ref_bgr = ref_img[:,:,:3]
ref_mask = ref_img[:,:,3] > 0

ref_lab = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
ref_l, ref_a, ref_b = cv2.split(ref_lab)

mean_l, std_l = np.mean(ref_l[ref_mask]), np.std(ref_l[ref_mask])
mean_a, std_a = np.mean(ref_a[ref_mask]), np.std(ref_a[ref_mask])
mean_b, std_b = np.mean(ref_b[ref_mask]), np.std(ref_b[ref_mask])

def match_image(img_path):
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img is None: return
    
    bgr = img[:,:,:3]
    mask = img[:,:,3] > 0
    
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l, a, b = cv2.split(lab)
    
    l_m, l_s = np.mean(l[mask]), np.std(l[mask])
    a_m, a_s = np.mean(a[mask]), np.std(a[mask])
    b_m, b_s = np.mean(b[mask]), np.std(b[mask])
    
    l[mask] = ((l[mask] - l_m) * (std_l / (l_s + 1e-6))) + mean_l
    a[mask] = ((a[mask] - a_m) * (std_a / (a_s + 1e-6))) + mean_a
    b[mask] = ((b[mask] - b_m) * (std_b / (b_s + 1e-6))) + mean_b
    
    l = np.clip(l, 0, 255)
    a = np.clip(a, 0, 255)
    b = np.clip(b, 0, 255)
    
    matched_lab = cv2.merge((l, a, b)).astype(np.uint8)
    matched_bgr = cv2.cvtColor(matched_lab, cv2.COLOR_LAB2BGR)
    
    out = np.zeros_like(img)
    out[:,:,:3] = matched_bgr
    out[:,:,3] = img[:,:,3]
    
    cv2.imwrite(img_path, out)

prefixes = ['dive_', 'drown', 'struggle']
folder = 'src/renderer/assets/sprites'

for prefix in prefixes:
    for path in glob.glob(f'{folder}/{prefix}*.png'):
        print(f"Matching {path}...")
        match_image(path)

print("Done matching colors!")

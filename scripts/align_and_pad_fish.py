import cv2
import numpy as np
import os

in_dir = 'src/renderer/assets/Fish_swim'
out_dir = 'src/renderer/assets/Fish_swim_aligned'
os.makedirs(out_dir, exist_ok=True)

FRAMES = [f'Fish{i}.png' for i in range(1, 9)]

def tight_bbox(alpha, thresh=20):
    mask = alpha > thresh
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()

# 1. Đọc tất cả frame + tính bbox alpha (bỏ vùng trong suốt thừa quanh cá)
imgs = []
bboxes = []
for name in FRAMES:
    img = cv2.imread(f'{in_dir}/{name}', cv2.IMREAD_UNCHANGED)
    bbox = tight_bbox(img[:, :, 3])
    imgs.append(img)
    bboxes.append(bbox)

# 2. Canvas cố định = kích thước bbox lớn nhất + lề an toàn, giống nhau cho mọi frame
max_w = max(x1 - x0 for x0, y0, x1, y1 in bboxes)
max_h = max(y1 - y0 for x0, y0, x1, y1 in bboxes)
MARGIN = 16
CANVAS_WIDTH = max_w + MARGIN * 2
CANVAS_HEIGHT = max_h + MARGIN * 2

print(f"Canvas: {CANVAS_WIDTH}x{CANVAS_HEIGHT} (fish bbox tối đa {max_w}x{max_h})")

# 3. Canh cá bơi theo TÂM (center) — không neo đáy như heo/vịt đứng đất,
# vì cá lơ lửng trong nước nên phải giữ nguyên vị trí giữa khung hình mỗi frame
# để không bị "nhảy" lên xuống khi chuyển frame.
for name, img, bbox in zip(FRAMES, imgs, bboxes):
    x0, y0, x1, y1 = bbox
    cropped = img[y0:y1 + 1, x0:x1 + 1]
    h, w = cropped.shape[:2]

    canvas = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH, 4), dtype=np.uint8)
    cx = (CANVAS_WIDTH - w) // 2
    cy = (CANVAS_HEIGHT - h) // 2
    canvas[cy:cy + h, cx:cx + w] = cropped

    cv2.imwrite(f'{out_dir}/{name}', canvas)
    print(f"  {name}: cropped {w}x{h} -> centered in canvas")

print("Done aligning & padding fish frames!")

import cv2
import numpy as np
import os
from PIL import Image

SRC = 'src/renderer/assets/bird-walk.png'
OUT_DIR = 'src/renderer/assets/bird_walk_aligned'
os.makedirs(OUT_DIR, exist_ok=True)

# Toạ độ lưới thực tế (đo bằng cách tìm khoảng trống hoàn toàn trong suốt giữa các ô).
# Hàng 1: đi bộ (frame 1-2) -> cất cánh bay (frame 3-7)
# Hàng 2: cúi đầu mổ thóc (frame 1-7)
COL_BOUNDS = [(41, 296), (408, 644), (751, 1022), (1111, 1363), (1471, 1722), (1811, 2064), (2154, 2420)]
ROW_BOUNDS = [(10, 255), (432, 608)]
ROW_NAMES = ['walk', 'peck']

MARGIN = 16


def process_cell(cell_rgba):
    cell = np.copy(cell_rgba)
    alpha = cell[:, :, 3]
    _, mask = cv2.threshold(alpha, 20, 255, cv2.THRESH_BINARY)
    mask = mask.astype(np.uint8)

    kernel = np.ones((5, 5), np.uint8)
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    if num_labels <= 1:
        return None
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_idx = np.argmax(areas) + 1
    bird_mask = (labels == largest_idx).astype(np.uint8) * 255
    bird_mask = cv2.dilate(bird_mask, kernel, iterations=1)

    cell[:, :, 3] = cv2.bitwise_and(cell[:, :, 3], cell[:, :, 3], mask=bird_mask)

    x, y, w, h = cv2.boundingRect(bird_mask)
    if w < 30 or h < 20:
        return None
    return cell[y:y + h, x:x + w]


def main():
    img = np.array(Image.open(SRC).convert('RGBA'))

    crops = []
    for row_name, (y0, y1) in zip(ROW_NAMES, ROW_BOUNDS):
        for i, (x0, x1) in enumerate(COL_BOUNDS):
            cell = img[y0:y1, x0:x1]
            cropped = process_cell(cell)
            if cropped is None:
                print(f'  {row_name}_{i+1:02d}: bo qua (khong ro rang)')
                continue
            crops.append((f'{row_name}_{i+1:02d}', cropped))

    max_w = max(c.shape[1] for _, c in crops)
    max_h = max(c.shape[0] for _, c in crops)
    canvas_w = max_w + MARGIN * 2
    canvas_h = max_h + MARGIN * 2
    print(f'Canvas: {canvas_w}x{canvas_h}, tong {len(crops)} frame')

    # Canh giua (center) vi chim di chuyen tu do, khong neo mat dat co dinh.
    for name, cropped in crops:
        h, w = cropped.shape[:2]
        canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
        cx = (canvas_w - w) // 2
        cy = (canvas_h - h) // 2
        canvas[cy:cy + h, cx:cx + w] = cropped
        cv2.imwrite(f'{OUT_DIR}/bird_{name}.png', canvas)

    print('Done aligning & padding bird-walk frames!')


if __name__ == '__main__':
    main()

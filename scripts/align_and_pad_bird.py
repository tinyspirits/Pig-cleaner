import cv2
import numpy as np
import os
from PIL import Image

SRC = 'src/renderer/assets/bird-fly.png'
RAW_DIR = 'src/renderer/assets/bird_fly_raw'
OUT_DIR = 'src/renderer/assets/bird_fly_aligned'
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

# Toạ độ lưới thực tế (đo bằng cách tìm các đường viền lưới alpha=255 xuyên suốt
# chiều rộng/chiều cao). Cột đầu tiên (6-349) là cột số thứ tự/legend, bị vỡ vụn
# thành nhiều mảnh nhỏ (không phải hình chim) nên bỏ qua, chỉ lấy 7 cột nội dung còn lại.
COL_BOUNDS = [(356, 701), (708, 1052), (1060, 1404), (1412, 1757), (1764, 2108), (2116, 2460), (2468, 2809)]
ROW_BOUNDS = [(96, 453), (460, 815), (822, 1175), (1182, 1535)]

CANVAS_SIZE = None  # tính sau khi biết bbox lớn nhất
MARGIN = 16


def process_cell(cell_rgba):
    cell = np.copy(cell_rgba)
    alpha = cell[:, :, 3]
    _, mask = cv2.threshold(alpha, 20, 255, cv2.THRESH_BINARY)
    mask = mask.astype(np.uint8)

    # Đóng các khe hở nhỏ trong lông/cánh trước khi tìm khối lớn nhất,
    # tránh bị vỡ thành nhiều mảnh do nét vẽ mảnh.
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
    idx = 0
    for (y0, y1) in ROW_BOUNDS:
        for (x0, x1) in COL_BOUNDS:
            idx += 1
            cell = img[y0:y1, x0:x1]
            cropped = process_cell(cell)
            if cropped is None:
                print(f'  frame {idx:02d}: bo qua (khong tim thay hinh chim ro rang)')
                continue
            crops.append((idx, cropped))
            cv2.imwrite(f'{RAW_DIR}/bird_{idx:02d}.png', cv2.cvtColor(cropped, cv2.COLOR_RGBA2BGRA))

    max_w = max(c.shape[1] for _, c in crops)
    max_h = max(c.shape[0] for _, c in crops)
    canvas_w = max_w + MARGIN * 2
    canvas_h = max_h + MARGIN * 2
    print(f'Canvas: {canvas_w}x{canvas_h} (bird bbox toi da {max_w}x{max_h}), tong {len(crops)} frame hop le')

    # Canh giua (center) vi chim bay tu do trong khong trung, khong neo mat dat.
    for idx, cropped in crops:
        h, w = cropped.shape[:2]
        canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
        cx = (canvas_w - w) // 2
        cy = (canvas_h - h) // 2
        canvas[cy:cy + h, cx:cx + w] = cropped
        cv2.imwrite(f'{OUT_DIR}/bird_{idx:02d}.png', canvas)

    print('Done aligning & padding bird frames!')


if __name__ == '__main__':
    main()

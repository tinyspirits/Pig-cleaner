"""
Sửa lỗi "cắt vào thịt": khi 1 sprite bị cắt bởi 1 đường thẳng đứng cố định
(thường do lúc xoá logo/chữ dùng 1 hình chữ nhật cố định), trong khi con heo
có đường cong tự nhiên (má, hàm...) lấn qua đường cắt đó.

Cách dùng:
    python3 scripts/fix_flesh_cut.py <đường_dẫn_ảnh.png> <x_bắt_đầu> <x_kết_thúc> <y_bắt_đầu> <y_kết_thúc>

Ví dụ (đúng như trường hợp sniff.png vừa gặp):
    python3 scripts/fix_flesh_cut.py src/renderer/assets/sprites/sniff.png 190 260 140 190

Cách hoạt động:
    Với mỗi hàng (row) trong vùng nghi ngờ, script tìm pixel "màu da heo"
    (hồng thật, kênh đỏ cao hơn hẳn xanh lá/xanh dương) cuối cùng theo
    hướng từ trái sang phải, rồi CHỈ xoá phần bên phải điểm đó (+ 2px đệm).
    Nhờ vậy phần thịt/má/hàm luôn được giữ lại đúng hình dạng cong tự nhiên,
    thay vì bị 1 đường thẳng cố định cắt ngang.

Sau khi chạy xong, script sẽ lưu đè lên chính file ảnh đó và in ra bbox
mới để bạn kiểm tra nhanh (so với bbox cũ) xem có bị cắt hụt/thừa không.
"""
import sys
from PIL import Image


def fix_flesh_cut(path, x_start, x_end, y_start, y_end, pad=2,
                   pink_r_minus_g=35, pink_r_minus_b=25, alpha_thresh=80):
    img = Image.open(path).convert('RGBA')
    px = img.load()
    w, h = img.size

    old_bbox = img.getbbox()

    for y in range(y_start, min(y_end, h)):
        last_pig_x = None
        for x in range(x_start, min(x_end, w)):
            r, g, b, a = px[x, y]
            if a > alpha_thresh and ((r - g) > pink_r_minus_g or (r - b) > pink_r_minus_b):
                last_pig_x = x
        cut_x = (last_pig_x + pad) if last_pig_x is not None else x_start
        for x in range(cut_x, min(x_end, w)):
            px[x, y] = (0, 0, 0, 0)

    img.save(path)
    print(f"Đã lưu: {path}")
    print(f"bbox cũ: {old_bbox}")
    print(f"bbox mới: {img.getbbox()}")
    print("=> Mở lại ảnh để kiểm tra bằng mắt trước khi commit!")


if __name__ == '__main__':
    if len(sys.argv) != 6:
        print(__doc__)
        sys.exit(1)
    path, x_start, x_end, y_start, y_end = sys.argv[1:6]
    fix_flesh_cut(path, int(x_start), int(x_end), int(y_start), int(y_end))

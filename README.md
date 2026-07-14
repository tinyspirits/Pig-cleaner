# Pig Cleaner 🐷

Pig Cleaner là một ứng dụng dọn dẹp hệ thống (System Cleaner) kết hợp thú cưng ảo (Desktop Pet) siêu dễ thương dành riêng cho macOS. Chú heo con sẽ đi dạo dưới đáy màn hình của bạn và giúp bạn dọn dẹp rác, cache để giải phóng dung lượng ổ cứng. Bạn càng dọn nhiều rác, heo sẽ càng ăn no và lớn nhanh!

## ✨ Tính năng chính

- **Nuôi heo bằng rác:** Dọn dẹp thùng rác (Trash) để "cho heo ăn". Thùng rác càng đầy, heo ăn càng no và lớn phổng phao.
- **Dọn dẹp Cache thông minh:** Hỗ trợ quét và dọn dẹp an toàn các loại cache phổ biến chiếm nhiều dung lượng:
  - System & Temp Files
  - Trình duyệt (Chrome, Safari, Firefox)
  - Lập trình (npm, yarn, pip, Homebrew, Xcode DerivedData, VS Code, Gradle, Docker)
- **Tự động dọn dẹp:** Thiết lập khoảng thời gian để heo tự động đi ăn rác (30 phút, 1 tiếng, 2 tiếng, 6 tiếng).
- **Thú cưng tương tác:** Heo có các trạng thái tự nhiên (đi dạo, khịt mũi ngửi rác, ngủ khò, no căng bụng). Bạn cũng có thể dùng chuột kéo thả heo đi dạo, ném heo từ trên cao xuống.
- **Minh bạch & An toàn:** Giao diện xem thống kê chi tiết lượng rác đã dọn, dung lượng từng thư mục cache trước khi quyết định xóa.

## 🚀 Cài đặt & Sử dụng

**Yêu cầu hệ thống:** macOS, Node.js (v18+).

```bash
# Clone repository
git clone https://github.com/tinyspirits/Pig-cleaner.git
cd Pig-cleaner

# Cài đặt thư viện
npm install

# Khởi chạy chế độ Development
npm run dev
```

> **⚠️ Lưu ý cấp quyền (Permissions):** Để dọn dẹp một số thư mục hệ thống (như Safari Cache hoặc Xcode DerivedData), ứng dụng cần được cấp quyền **Full Disk Access**.
> *Vào System Settings → Privacy & Security → Full Disk Access → Thêm ứng dụng / Terminal của bạn vào.*

## 🎨 Hướng dẫn Custom Sprite (Tự thiết kế heo của bạn)

Bạn hoàn toàn có thể thay đổi hình ảnh chú heo thành nhân vật yêu thích của mình (mèo, chó, capybara...) bằng cách thay thế các file ảnh (sprite) trong mã nguồn.

1. **Chuẩn bị ảnh (Sprites):** 
   Bạn cần chuẩn bị các khung hình (frames) có định dạng PNG nền trong suốt (khuyến nghị kích thước `150x150` hoặc tương đương).
2. **Thay thế file ảnh:** 
   Copy đè các file ảnh mới của bạn vào thư mục `src/renderer/assets/sprites/`. Các file mặc định được đặt tên theo hành động, ví dụ:
   - Đi bộ: `walk1.png` đến `walk6.png`
   - Đứng im / Ngửi rác: `idle1.png`, `sniff.png`
   - Ăn / No: `happy1.png`, `happy2.png`
   - Ngủ: `sleep1.png` đến `sleep4.png`
   - Bị nhấc lên (Kéo thả): `drag1.png`, `drag2.png`, `drag3.png`
3. **Tuỳ chỉnh Animation (Tốc độ, Frame):**
   Nếu bạn có số lượng khung hình khác hoặc muốn chỉnh sửa tốc độ (fps) của từng hoạt ảnh, hãy mở file `src/renderer/components/PigPet.jsx` và chỉnh sửa biến `ANIMATIONS`:
   ```javascript
   const ANIMATIONS = {
     idle: { frames: [idle1, idle1, idle1, sniff], fps: 2, loop: true },
     walking: { frames: [walk3, walk4, walk5, walk1, walk6, walk2], fps: 10, loop: true },
     eating: { frames: [happy1, happy2, happy1, happy2], fps: 6, loop: true },
     // ... chỉnh sửa cấu hình tại đây
   }
   ```

## ☕️ Ủng hộ dự án (Donate)

Nếu bạn thấy chú heo này hữu ích và giúp máy Mac của bạn sạch sẽ, mượt mà hơn, hãy ủng hộ tác giả một ly cà phê nhé! Sự ủng hộ của bạn là động lực rất lớn để tôi duy trì và phát triển thêm nhiều tính năng hay ho cho dự án. ❤️

- **Momo:** `0359233523`
- **PayPal:** `paypal.me/pigtiny`

---
*Developed with ❤️ by [tinyspirits](https://github.com/tinyspirits)*

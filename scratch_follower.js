// Lịch sử vị trí để heo con đi theo
const HISTORY_SIZE = 400; // Đủ lưu 400 frames (khoảng 6 giây ở 60fps)
// Dùng biến cục bộ ngoài component để tránh re-render phức tạp, vì chỉ 1 heo mẹ trên màn hình.
let historyBuffer = [];

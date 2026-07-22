import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "title": "Character Maker Tool",
      "subtitle": "Auto center & remove background for game sprites",
      "batchMode": "Multiple Images (Batch)",
      "sliceSpriteSheet": "Slice Sprite Sheet",
      "uploadBatch": "Upload single or multiple images (Batch)",
      "uploadBatchDesc": "Supports JPG, PNG. Click to select files.",
      "uploadSpriteSheet": "Upload 1 Sprite Sheet",
      "uploadSpriteSheetDesc": "The tool will help you automatically slice into multiple frames.",
      "downloadSample": "Download Sample Chick Image to test slicing",
      "sliceType": "Slice Method",
      "byCount": "By Count (Cols/Rows)",
      "bySize": "By Size (Width/Height)",
      "columns": "Columns",
      "rows": "Rows",
      "width": "Width (px)",
      "height": "Height (px)",
      "sliceFrames": "Slice Frames",
      "cancel": "Cancel",
      "addImages": "+ Add Images",
      "removeSolidBg": "Remove Solid BG",
      "removeAiBg": "Remove BG (AI)",
      "eraser": "Eraser",
      "undo": "Undo",
      "autoAlign": "Auto Align",
      "saveZip": "Save ZIP All (150x150)",
      "savePng": "Save PNG (150x150)",
      "deleteAll": "Delete All",
      "instructions": "Instruction: Crop this image, settings will apply to ALL {{count}} images.",
      "imageProgress": "Image {{current}} / {{total}}",
      "zoom": "Zoom:",
      "slicing": "Slicing image...",
      "removingSolidBg": "Removing solid background...",
      "removingSolidBgProgress": "Removing solid background for image {{current}}/{{total}}...",
      "autoAlignDone": "Auto aligned and added safe margin!",
      "exporting": "Processing images for download...",
      "language": "Language"
    }
  },
  vi: {
    translation: {
      "title": "Character Maker Tool",
      "subtitle": "Tự động căn giữa & Xoá nền cho game sprite",
      "batchMode": "Nhiều Ảnh (Batch)",
      "sliceSpriteSheet": "Cắt Sprite Sheet",
      "uploadBatch": "Tải một hoặc nhiều ảnh lên (Batch)",
      "uploadBatchDesc": "Hỗ trợ JPG, PNG. Bấm để chọn file.",
      "uploadSpriteSheet": "Tải lên 1 Sprite Sheet",
      "uploadSpriteSheetDesc": "Tool sẽ giúp bạn cắt thành nhiều ảnh nhỏ tự động.",
      "downloadSample": "Tải ảnh Gà Con (Mẫu) để cắt thử",
      "sliceType": "Cách chia (Slice Type)",
      "byCount": "Theo Số Lượng (Cột/Hàng)",
      "bySize": "Theo Kích Thước (Width/Height)",
      "columns": "Số cột (Columns)",
      "rows": "Số hàng (Rows)",
      "width": "Chiều rộng (px)",
      "height": "Chiều cao (px)",
      "sliceFrames": "Cắt Frames",
      "cancel": "Huỷ",
      "addImages": "+ Thêm ảnh",
      "removeSolidBg": "Xoá Màu Nền",
      "removeAiBg": "Tách Nền Bằng AI",
      "eraser": "Tẩy (Eraser)",
      "undo": "Hoàn tác (Undo)",
      "autoAlign": "Auto Align",
      "saveZip": "Lưu ZIP tất cả (150x150)",
      "savePng": "Lưu PNG (150x150)",
      "deleteAll": "Xoá toàn bộ",
      "instructions": "Hướng dẫn: Căn chỉnh ảnh này, cài đặt sẽ áp dụng cho TOÀN BỘ {{count}} ảnh.",
      "imageProgress": "Ảnh {{current}} / {{total}}",
      "zoom": "Zoom:",
      "slicing": "Đang cắt ảnh...",
      "removingSolidBg": "Đang xoá nền đơn sắc...",
      "removingSolidBgProgress": "Đang xoá nền đơn sắc ảnh {{current}}/{{total}}...",
      "autoAlignDone": "Đã tự động căn giữa và thêm lề an toàn!",
      "exporting": "Đang xử lý ảnh để tải về...",
      "language": "Ngôn ngữ"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "vi", // Default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

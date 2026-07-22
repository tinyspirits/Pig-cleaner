import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { removeBackground } from '@imgly/background-removal';
import Cropper from 'react-easy-crop';
import { UploadCloud, Wand2, Download, RefreshCcw, ChevronLeft, ChevronRight, Trash2, GripHorizontal, Scissors, PaintBucket, Images, Eraser, AlignCenter, Undo2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './App.css';
import sampleSprite from './assets/sample_sprite.png';

const PIG_WIDTH = 150;
const PIG_HEIGHT = 150;

function App() {
  const { t, i18n } = useTranslation();
  const [uploadMode, setUploadMode] = useState('batch'); // 'batch' | 'spritesheet'
  const [images, setImages] = useState([]); // { file, originalUrl, processedUrl, status: 'idle' | 'processing' | 'done' | 'error' }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState('');
  const [history, setHistory] = useState([]); // Store previous states of images

  // Eraser States
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const eraserCanvasRef = useRef(null);
  const lastPos = useRef(null);
  const strokePath = useRef([]);

  const currentImage = images[currentIndex];
  const activeImageSrc = currentImage ? (currentImage.processedUrl || currentImage.originalUrl) : null;

  // Sprite Sheet Slicer States
  const [spriteSheetSrc, setSpriteSheetSrc] = useState(null);
  const [sliceMode, setSliceMode] = useState('count'); // 'count' | 'size'
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(1);
  const [cellWidth, setCellWidth] = useState(150);
  const [cellHeight, setCellHeight] = useState(150);
  const [spriteSheetImageObj, setSpriteSheetImageObj] = useState(null);

  // Cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);
  const spriteInputRef = useRef(null);
  const gridCanvasRef = useRef(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const handleBatchFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files).map(file => ({
        file,
        name: file.name,
        originalUrl: URL.createObjectURL(file),
        processedUrl: null,
        status: 'idle'
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const handleSpriteSheetChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setSpriteSheetSrc(url);
      const img = await createImage(url);
      setSpriteSheetImageObj(img);
    }
  };

  // Draw Grid Lines on Sprite Sheet Preview
  useEffect(() => {
    if (spriteSheetSrc && spriteSheetImageObj && gridCanvasRef.current) {
      const canvas = gridCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const imgWidth = spriteSheetImageObj.width;
      const imgHeight = spriteSheetImageObj.height;

      canvas.width = imgWidth;
      canvas.height = imgHeight;

      ctx.clearRect(0, 0, imgWidth, imgHeight);

      let computedCols = cols;
      let computedRows = rows;
      let cw = imgWidth / computedCols;
      let ch = imgHeight / computedRows;

      if (sliceMode === 'size') {
        cw = cellWidth;
        ch = cellHeight;
        computedCols = Math.floor(imgWidth / cw);
        computedRows = Math.floor(imgHeight / ch);
      }

      ctx.beginPath();
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = Math.max(1, imgWidth / 500); // Scale line width

      for (let i = 1; i <= computedCols; i++) {
        ctx.moveTo(i * cw, 0);
        ctx.lineTo(i * cw, imgHeight);
      }
      for (let j = 1; j <= computedRows; j++) {
        ctx.moveTo(0, j * ch);
        ctx.lineTo(imgWidth, j * ch);
      }

      ctx.stroke();
    }
  }, [spriteSheetSrc, spriteSheetImageObj, cols, rows, sliceMode, cellWidth, cellHeight]);

  const checkEmptyFrame = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) { // If alpha > 0, it has content
        return false;
      }
    }
    return true; // Completely transparent
  };

  const handleSliceSprite = async () => {
    if (!spriteSheetImageObj) return;

    setIsProcessing(true);
    setGlobalProgress('Đang cắt ảnh...');

    const imgWidth = spriteSheetImageObj.width;
    const imgHeight = spriteSheetImageObj.height;

    let computedCols = cols;
    let computedRows = rows;
    let cw = imgWidth / computedCols;
    let ch = imgHeight / computedRows;

    if (sliceMode === 'size') {
      cw = cellWidth;
      ch = cellHeight;
      computedCols = Math.floor(imgWidth / cw);
      computedRows = Math.floor(imgHeight / ch);
    }

    const newImages = [];

    for (let r = 0; r < computedRows; r++) {
      for (let c = 0; c < computedCols; c++) {
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.drawImage(
          spriteSheetImageObj,
          c * cw, r * ch, cw, ch,
          0, 0, cw, ch
        );

        if (!checkEmptyFrame(ctx, cw, ch)) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          const url = URL.createObjectURL(blob);
          newImages.push({
            file: new File([blob], `frame_${r}_${c}.png`, { type: 'image/png' }),
            name: `frame_${r}_${c}.png`,
            originalUrl: url,
            processedUrl: null,
            status: 'idle'
          });
        }
      }
    }

    setImages(prev => [...prev, ...newImages]);
    setSpriteSheetSrc(null);
    setSpriteSheetImageObj(null);
    setIsProcessing(false);
    setGlobalProgress('');
  };

  const colorMatch = (a, b, tolerance = 0) => {
    return Math.abs(a[0] - b[0]) <= tolerance &&
           Math.abs(a[1] - b[1]) <= tolerance &&
           Math.abs(a[2] - b[2]) <= tolerance &&
           Math.abs(a[3] - b[3]) <= tolerance;
  };

  const processSolidBgForUrl = async (url) => {
    const imageObj = await createImage(url);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;
    ctx.drawImage(imageObj, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Check 4 corners to find background colors
    const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    const stack = [];
    const visited = new Uint8Array(width * height);

    for (const [cx, cy] of corners) {
      const idx = (cy * width + cx) * 4;
      if (data[idx + 3] > 0 && visited[cy * width + cx] === 0) {
        stack.push([cx, cy, [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]]);
        visited[cy * width + cx] = 1;
      }
    }

    while (stack.length > 0) {
      const [x, y, targetColor] = stack.pop();
      const idx = (y * width + x) * 4;
      data[idx + 3] = 0; // Make transparent

      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          const nColor = [data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3]];
          if (visited[ny * width + nx] === 0 && colorMatch(targetColor, nColor, 15)) {
            visited[ny * width + nx] = 1;
            stack.push([nx, ny, targetColor]);
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return URL.createObjectURL(blob);
  };

  const handleRemoveSolidBackground = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setGlobalProgress(t('removingSolidBg'));

    const historySnapshot = images.map(img => ({ ...img }));
    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];

      updatedImages[i].status = 'processing';
      setImages([...updatedImages]);
      setGlobalProgress(t('removingSolidBgProgress', { current: i + 1, total: updatedImages.length }));

      try {
        const sourceUrl = img.processedUrl || img.originalUrl;
        const newUrl = await processSolidBgForUrl(sourceUrl);
        updatedImages[i].processedUrl = newUrl;
        updatedImages[i].status = 'done';
      } catch (error) {
        console.error('Error removing solid bg for', img.name, error);
        updatedImages[i].status = 'error';
      }
      setImages([...updatedImages]);
    }

    setHistory(prev => [...prev, historySnapshot]);
    setGlobalProgress('');
    setIsProcessing(false);
  };

  const handleRemoveBackground = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setGlobalProgress(t('removingAiBg', 'Đang tải Model AI...'));

    const historySnapshot = images.map(img => ({ ...img }));
    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];

      updatedImages[i].status = 'processing';
      setImages([...updatedImages]);
      setGlobalProgress(t('removingAiBgProgress', { current: i + 1, total: updatedImages.length, defaultValue: `Đang tách nền ảnh ${i + 1}/${updatedImages.length}...` }));

      try {
        const sourceUrl = img.processedUrl || img.originalUrl;
        const config = {
          progress: (key, current, total) => {
            if (key === 'compute:inference' || key === 'fetch:model') {
              setGlobalProgress(`[AI] ${key}: ${i + 1}/${updatedImages.length}... ${Math.round((current / total) * 100)}%`);
            }
          }
        };
        
        let newUrl;
        try {
          const blob = await removeBackground(sourceUrl, config);
          newUrl = URL.createObjectURL(blob);
        } catch (aiError) {
          const fallbackUrl = img.processedUrl || img.originalUrl;
          newUrl = await processSolidBgForUrl(fallbackUrl);
        }

        updatedImages[i].processedUrl = newUrl;
        updatedImages[i].status = 'done';
      } catch (error) {
        console.error('Error removing bg for', img.name, error);
        updatedImages[i].status = 'error';
      }
      setImages([...updatedImages]);
    }

    setHistory(prev => [...prev, historySnapshot]);
    setGlobalProgress('');
    setIsProcessing(false);
  };

  // ERASER LOGIC
  useEffect(() => {
    if (isErasing && eraserCanvasRef.current && activeImageSrc) {
      const canvas = eraserCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = activeImageSrc;
    }
  }, [isErasing, activeImageSrc]);

  const getCanvasMousePos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;
    let renderWidth, renderHeight, offsetX = 0, offsetY = 0;
    if (rectAspect > canvasAspect) {
      renderHeight = rect.height;
      renderWidth = rect.height * canvasAspect;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      renderWidth = rect.width;
      renderHeight = rect.width / canvasAspect;
      offsetY = (rect.height - renderHeight) / 2;
    }
    const scaleX = canvas.width / renderWidth;
    const scaleY = canvas.height / renderHeight;
    return {
      x: (e.clientX - rect.left - offsetX) * scaleX,
      y: (e.clientY - rect.top - offsetY) * scaleY
    };
  };

  const handleEraserMouseDown = (e) => {
    setIsDrawing(true);
    const canvas = eraserCanvasRef.current;
    const { x, y } = getCanvasMousePos(e, canvas);
    
    lastPos.current = { x, y };
    strokePath.current = [{ x, y }];
    
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleEraserMouseMove = (e) => {
    if (!isDrawing) return;
    const canvas = eraserCanvasRef.current;
    const { x, y } = getCanvasMousePos(e, canvas);
    
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastPos.current = { x, y };
    strokePath.current.push({ x, y });
  };

  const handleEraserMouseUp = async () => {
    setIsDrawing(false);
    if (strokePath.current.length === 0) return;
    
    setIsProcessing(true);
    setGlobalProgress('Đang áp dụng tẩy cho tất cả ảnh...');
    
    const historySnapshot = images.map(img => ({ ...img }));
    const path = [...strokePath.current];
    strokePath.current = []; // reset immediately
    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];
      const imageObj = await createImage(img.processedUrl || img.originalUrl);
      const canvas = document.createElement('canvas');
      canvas.width = imageObj.width;
      canvas.height = imageObj.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageObj, 0, 0);
      
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 30;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let j = 1; j < path.length; j++) {
        ctx.lineTo(path[j].x, path[j].y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(path[0].x, path[0].y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      updatedImages[i].processedUrl = URL.createObjectURL(blob);
    }
    
    setHistory(prev => [...prev, historySnapshot]);
    setImages(updatedImages);
    setGlobalProgress('');
    setIsProcessing(false);
  };

  const handleAutoAlign = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setGlobalProgress('Đang tự động căn giữa toàn bộ khung hình...');

    const historySnapshot = images.map(img => ({ ...img }));
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    let hasPixels = false;
    const imageObjects = [];

    // Phase 1: Find global bounding box
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imageObj = await createImage(img.processedUrl || img.originalUrl);
      imageObjects.push(imageObj);

      const canvas = document.createElement('canvas');
      canvas.width = imageObj.width;
      canvas.height = imageObj.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageObj, 0, 0);

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            hasPixels = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    if (!hasPixels) {
      setGlobalProgress('Không tìm thấy hình ảnh nào để căn giữa!');
      setTimeout(() => setGlobalProgress(''), 3000);
      setIsProcessing(false);
      return;
    }

    // Phase 2: Create new centered images
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const targetSize = Math.max(contentWidth, contentHeight) * 1.25; // 25% padding
    
    const destX = (targetSize - contentWidth) / 2;
    const destY = (targetSize - contentHeight) / 2;

    const updatedImages = [...images];
    for (let i = 0; i < images.length; i++) {
      const imageObj = imageObjects[i];
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(
        imageObj,
        minX, minY, contentWidth, contentHeight,
        destX, destY, contentWidth, contentHeight
      );

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      updatedImages[i].processedUrl = URL.createObjectURL(blob);
    }

    // Reset crop and zoom so it shows perfectly
    setCrop({ x: 0, y: 0 });
    setZoom(1);

    setHistory(prev => [...prev, historySnapshot]);
    setImages(updatedImages);
    setGlobalProgress('Đã tự động căn giữa và thêm lề an toàn!');
    setTimeout(() => setGlobalProgress(''), 3000);
    setIsProcessing(false);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setImages(previousState);
    setHistory(prev => prev.slice(0, prev.length - 1));
  };

  const handleExport = async () => {
    if (images.length === 0 || !croppedAreaPixels) return;

    setGlobalProgress('Đang xử lý ảnh để tải về...');
    const zip = new JSZip();
    let hasFiles = false;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const sourceUrl = img.processedUrl || img.originalUrl;

      try {
        const imageObj = await createImage(sourceUrl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = PIG_WIDTH;
        canvas.height = PIG_HEIGHT;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(
          imageObj,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          PIG_WIDTH,
          PIG_HEIGHT
        );

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        zip.file(`frame_${i + 1}.png`, blob);
        hasFiles = true;
      } catch (e) {
        console.error('Failed to export image', img.name, e);
      }
    }

    if (hasFiles) {
      if (images.length === 1) {
        zip.file("frame_1.png").async("blob").then((blob) => {
          saveAs(blob, "custom_frame.png");
        });
      } else {
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, "custom_frames.zip");
      }
    }
    setGlobalProgress('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🐷 {t('title')}</h1>
        <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)} style={{ padding: '8px', borderRadius: '4px', background: '#222', color: 'white', border: '1px solid #444' }}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="card">
        {images.length === 0 && !spriteSheetSrc ? (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
              <button
                className={`btn-primary ${uploadMode === 'batch' ? '' : 'inactive'}`}
                style={{ opacity: uploadMode === 'batch' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => setUploadMode('batch')}
              >
                <Images size={18} />
                {t('batchMode', 'Nhiều Ảnh (Batch)')}
              </button>
              <button
                className={`btn-primary ${uploadMode === 'spritesheet' ? '' : 'inactive'}`}
                style={{ opacity: uploadMode === 'spritesheet' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => setUploadMode('spritesheet')}
              >
                <GripHorizontal size={18} />
                {t('sliceSpriteSheet', 'Cắt Sprite Sheet')}
              </button>
            </div>

            {uploadMode === 'batch' ? (
              <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={48} color="#b882ff" style={{ marginBottom: 16 }} />
                <h3>{t('uploadBatch', 'Tải một hoặc nhiều ảnh lên (Batch)')}</h3>
                <p style={{ color: '#aaa' }}>{t('uploadBatchDesc', 'Hỗ trợ JPG, PNG. Bấm để chọn file.')}</p>
                <input type="file" multiple ref={fileInputRef} onChange={handleBatchFileChange} accept="image/*" style={{ display: 'none' }} />
              </div>
            ) : (
              <div className="dropzone" onClick={() => spriteInputRef.current?.click()}>
                <GripHorizontal size={48} color="#b882ff" style={{ marginBottom: 16 }} />
                <h3>{t('uploadSpriteSheet', 'Tải lên 1 Sprite Sheet')}</h3>
                <p style={{ color: '#aaa' }}>{t('uploadSpriteSheetDesc', 'Tool sẽ giúp bạn cắt thành nhiều ảnh nhỏ tự động.')}</p>
                <input type="file" ref={spriteInputRef} onChange={handleSpriteSheetChange} accept="image/*" style={{ display: 'none' }} />
                <a
                  href={sampleSprite}
                  download="sample_sprite.png"
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '15px', color: '#10b981', textDecoration: 'underline', fontSize: '14px', zIndex: 10 }}
                >
                  <Download size={14} /> {t('downloadSample', 'Tải ảnh Gà Con (Mẫu) để cắt thử')}
                </a>
              </div>
            )}
          </div>
        ) : spriteSheetSrc ? (
          // SPRITE SHEET SLICER UI
          <div>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#ccc' }}>{t('sliceType')}</label>
                <select value={sliceMode} onChange={e => setSliceMode(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', width: '180px' }}>
                  <option value="count">{t('byCount')}</option>
                  <option value="size">{t('bySize')}</option>
                </select>
              </div>

              {sliceMode === 'count' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#ccc' }}>{t('columns')}</label>
                    <input type="number" min="1" max="100" value={cols} onChange={e => setCols(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', width: '100px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#ccc' }}>{t('rows')}</label>
                    <input type="number" min="1" max="100" value={rows} onChange={e => setRows(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', width: '100px' }} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#ccc' }}>{t('width')}</label>
                    <input type="number" min="1" max="2000" value={cellWidth} onChange={e => setCellWidth(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', width: '100px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#ccc' }}>{t('height')}</label>
                    <input type="number" min="1" max="2000" value={cellHeight} onChange={e => setCellHeight(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', width: '100px' }} />
                  </div>
                </>
              )}

              <button onClick={handleSliceSprite} disabled={isProcessing} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                {isProcessing ? <RefreshCcw className="spinner" size={18} /> : <Scissors size={18} />}
                {t('sliceFrames')}
              </button>
              <button onClick={() => setSpriteSheetSrc(null)} className="btn-primary" style={{ background: '#445', height: '40px' }}>{t('cancel')}</button>
            </div>

            <div style={{ width: '100%', maxHeight: '500px', overflow: 'auto', background: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3hF0AfyKGRgY8Cu+P2hWDBowYMAC5EACR4/61aMBDEZ+BgC62g/xXFj0RQAAAABJRU5ErkJggg==)' }}>
              <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%' }}>
                <img src={spriteSheetSrc} style={{ display: 'block', maxWidth: '100%', height: 'auto', opacity: 0.8 }} />
                <canvas ref={gridCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>
        ) : (
          // MAIN CROPPER & BATCH UI
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => fileInputRef.current?.click()} className="btn-primary" style={{ background: '#445' }}>
                  {t('addImages')}
              </button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleBatchFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button
                onClick={handleRemoveSolidBackground}
                disabled={isProcessing}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#3b82f6' }}
              >
                {isProcessing ? <RefreshCcw className="spinner" size={18} /> : <PaintBucket size={18} />}
                {t('removeSolidBg')}
              </button>
              <button
                onClick={handleRemoveBackground}
                disabled={isProcessing}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isProcessing ? <RefreshCcw className="spinner" size={18} /> : <Wand2 size={18} />}
                {t('removeAiBg')}
              </button>
              <button
                onClick={() => setIsErasing(!isErasing)}
                disabled={isProcessing}
                className={`btn-primary ${isErasing ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isErasing ? '#b882ff' : '#445' }}
              >
                <Eraser size={18} />
                {t('eraser')}
              </button>
              <button
                onClick={handleUndo}
                disabled={isProcessing || history.length === 0}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: history.length === 0 ? '#333' : '#6b7280', color: history.length === 0 ? '#555' : 'white' }}
                title={t('undo')}
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={handleAutoAlign}
                disabled={isProcessing}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#d97706' }}
              >
                <AlignCenter size={18} />
                {t('autoAlign')}
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleExport}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(90deg, #10b981, #34d399)' }}
              >
                <Download size={18} />
                {images.length > 1 ? t('saveZip') : t('savePng')}
              </button>
              <button onClick={() => { setImages([]); setCurrentIndex(0); }} className="btn-primary" style={{ background: '#d32f2f', padding: '0.6em 0.8em' }} title={t('deleteAll')}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>

            {globalProgress && (
              <div style={{ background: 'rgba(184, 130, 255, 0.1)', color: '#b882ff', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                {globalProgress}
              </div>
            )}

            <div style={{ color: '#ccc', marginBottom: '10px', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {t('instructions', { count: images.length })}
              </span>
              <span>
                {t('imageProgress', { current: currentIndex + 1, total: images.length })}
              </span>
            </div>

            <div className="crop-container" style={{ background: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3hF0AfyKGRgY8Cu+P2hWDBowYMAC5EACR4/61aMBDEZ+BgC62g/xXFj0RQAAAABJRU5ErkJggg==)' }}>
              {isErasing ? (
                <canvas
                  ref={eraserCanvasRef}
                  onMouseDown={handleEraserMouseDown}
                  onMouseMove={handleEraserMouseMove}
                  onMouseUp={handleEraserMouseUp}
                  onMouseLeave={handleEraserMouseUp}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair', display: 'block' }}
                />
              ) : (
                activeImageSrc && (
                  <Cropper
                    image={activeImageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    objectFit="contain"
                  />
                )
              )}

              {images.length > 1 && !isErasing && (
                <div style={{ position: 'absolute', bottom: '10px', left: '0', width: '100%', display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 10 }}>
                  <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    style={{ background: 'rgba(0,0,0,0.6)', padding: '5px 10px' }}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex(prev => Math.min(images.length - 1, prev + 1))}
                    disabled={currentIndex === images.length - 1}
                    style={{ background: 'rgba(0,0,0,0.6)', padding: '5px 10px' }}
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '14px' }}>Zoom:</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={5}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => {
                  setZoom(Number(e.target.value))
                }}
                style={{ flex: 1 }}
              />
            </div>

            {images.length > 1 && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      width: '60px',
                      height: '60px',
                      border: idx === currentIndex ? '2px solid #b882ff' : '1px solid #444',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    <img
                      src={img.processedUrl || img.originalUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#111' }}
                    />
                    {img.status === 'processing' && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', placeItems: 'center', justifyContent: 'center' }}>
                        <RefreshCcw className="spinner" size={16} color="#fff" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default App;

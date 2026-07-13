#!/usr/bin/env python3
"""
Pads all transparent sprites to a uniform canvas size (300x200)
so that they don't change size when rendered with a fixed CSS width.
Aligns each sprite to the bottom-center of the new canvas.
"""

from PIL import Image
import os

SPRITES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'renderer', 'assets', 'sprites')
CANVAS_WIDTH = 300
CANVAS_HEIGHT = 200
BOTTOM_PADDING = 10 # 10 pixels from the bottom

def pad_all_sprites():
    sprite_files = [f for f in os.listdir(SPRITES_DIR) if f.endswith('.png')]
    if not sprite_files:
        print("No PNG sprites found!")
        return

    print(f"Padding {len(sprite_files)} sprites to {CANVAS_WIDTH}x{CANVAS_HEIGHT}...")

    for fname in sorted(sprite_files):
        path = os.path.join(SPRITES_DIR, fname)
        
        # Open the original sprite
        img = Image.open(path).convert('RGBA')
        
        # If it's already the target size, skip
        if img.size == (CANVAS_WIDTH, CANVAS_HEIGHT):
            print(f"  {fname} is already {CANVAS_WIDTH}x{CANVAS_HEIGHT}, skipping.")
            continue
            
        # Get bounding box to remove any existing empty space first
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        # Create new transparent canvas
        canvas = Image.new('RGBA', (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))
        
        # Calculate paste position (bottom-center)
        # x: center horizontally
        x = (CANVAS_WIDTH - img.width) // 2
        
        # y: align to bottom with padding
        y = CANVAS_HEIGHT - img.height - BOTTOM_PADDING
        
        if x < 0 or y < 0:
            print(f"  ⚠️ Warning: {fname} ({img.width}x{img.height}) is larger than canvas!")
            # Still paste, but it might get cropped
            x = max(0, x)
            y = max(0, y)
        
        canvas.paste(img, (x, y), img)
        canvas.save(path, 'PNG', optimize=True)
        print(f"  ✅ {fname} padded to {CANVAS_WIDTH}x{CANVAS_HEIGHT}")

    print("\nDone! All sprites have uniform sizes now.")

if __name__ == '__main__':
    pad_all_sprites()

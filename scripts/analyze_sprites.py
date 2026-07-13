#!/usr/bin/env python3
"""
Inspect and split sprite sheet images that contain multiple frames side by side.
Also cleans up artifacts from bad crops.
"""

from PIL import Image
import os

SPRITES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'renderer', 'assets', 'sprites')

def analyze_sprite(path):
    """Show info about a sprite image."""
    img = Image.open(path).convert('RGBA')
    data = img.load()
    w, h = img.size
    
    # Find bounding box of all non-transparent pixels
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for x in range(w):
        for y in range(h):
            r, g, b, a = data[x, y]
            if a > 10:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    
    print(f"  {os.path.basename(path)}: {w}x{h}, content bbox: ({min_x},{min_y}) -> ({max_x},{max_y})")
    return img, (min_x, min_y, max_x + 1, max_y + 1)

def find_vertical_gap(img, x_start, x_end, threshold=10):
    """Find vertical gaps (columns with no/little content) to split sprites."""
    data = img.load()
    w, h = img.size
    
    gaps = []  # (start, end) of empty column ranges
    in_gap = False
    gap_start = -1
    
    for x in range(x_start, x_end):
        col_has_content = any(
            img.getpixel((x, y))[3] > threshold 
            for y in range(h)
        )
        
        if not col_has_content:
            if not in_gap:
                in_gap = True
                gap_start = x
        else:
            if in_gap:
                in_gap = False
                gap_end = x
                if gap_end - gap_start > 5:  # Significant gap
                    gaps.append((gap_start, gap_end))
    
    return gaps


def split_spritesheet(path, output_prefix, output_dir):
    """Split a sprite sheet into individual frames."""
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    
    gaps = find_vertical_gap(img, 0, w, threshold=5)
    print(f"  Found {len(gaps)} gaps in {os.path.basename(path)}: {gaps}")
    
    if not gaps:
        print(f"  No gaps found, treating as single sprite")
        return [path]
    
    # Split into regions
    regions = []
    prev_end = 0
    for gap_start, gap_end in gaps:
        if gap_start > prev_end:
            regions.append((prev_end, gap_start))
        prev_end = gap_end
    if prev_end < w:
        regions.append((prev_end, w))
    
    print(f"  Splitting into {len(regions)} frames: {regions}")
    
    output_paths = []
    for i, (x_start, x_end) in enumerate(regions):
        frame = img.crop((x_start, 0, x_end, h))
        
        # Trim to content
        bbox = frame.getbbox()
        if bbox:
            frame = frame.crop(bbox)
        
        out_path = os.path.join(output_dir, f"{output_prefix}{i+1}.png")
        frame.save(out_path, 'PNG')
        print(f"    Saved: {os.path.basename(out_path)} ({frame.size[0]}x{frame.size[1]})")
        output_paths.append(out_path)
    
    return output_paths


def fix_sleep_side():
    """Fix sleep_side.png which has text artifact."""
    path = os.path.join(SPRITES_DIR, 'sleep_side.png')
    img = Image.open(path).convert('RGBA')
    data = img.load()
    w, h = img.size
    
    print(f"\nFixing sleep_side.png ({w}x{h})...")
    
    # Find the pig bounding box
    # The pig should be a cluster of pink pixels in the lower right area
    # Text "iff" is in the upper left area
    
    # Strategy: find the main cluster by removing isolated pixels
    # Find all non-transparent pixel columns
    col_density = []
    for x in range(w):
        count = sum(1 for y in range(h) if data[x, y][3] > 10)
        col_density.append(count)
    
    # Find the pig's x range - should be the densest region
    threshold = max(col_density) * 0.3
    pig_columns = [x for x, d in enumerate(col_density) if d >= threshold]
    
    if pig_columns:
        pig_x_start = min(pig_columns)
        pig_x_end = max(pig_columns) + 1
        print(f"  Pig columns: {pig_x_start} to {pig_x_end}")
        
        # Crop to pig region with some padding
        padding = 4
        crop_x_start = max(0, pig_x_start - padding)
        crop_x_end = min(w, pig_x_end + padding)
        
        cropped = img.crop((crop_x_start, 0, crop_x_end, h))
        bbox = cropped.getbbox()
        if bbox:
            cropped = cropped.crop(bbox)
        
        cropped.save(path, 'PNG')
        print(f"  ✅ Fixed: {cropped.size[0]}x{cropped.size[1]}")
    else:
        print(f"  ⚠️ Could not find pig region")


def check_all():
    print("Analyzing all sprites:")
    for fname in sorted(os.listdir(SPRITES_DIR)):
        if fname.endswith('.png'):
            path = os.path.join(SPRITES_DIR, fname)
            analyze_sprite(path)


if __name__ == '__main__':
    print("=== Sprite Analysis ===")
    check_all()
    
    print("\n=== Fixing sleep_side.png ===")
    fix_sleep_side()
    
    print("\n=== Checking multi-frame sprites ===")
    # sleep3 and sleep4 seem to have 2 frames each
    for fname in ['sleep3.png', 'sleep4.png']:
        path = os.path.join(SPRITES_DIR, fname)
        print(f"\nAnalyzing {fname}:")
        gaps = find_vertical_gap(Image.open(path).convert('RGBA'), 0, Image.open(path).size[0])
        print(f"  Gaps found: {gaps}")
    
    print("\nDone!")

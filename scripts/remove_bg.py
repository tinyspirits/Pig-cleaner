#!/usr/bin/env python3
"""
Remove white/near-white background from pig sprites.
Uses a flood-fill approach from corners + alpha threshold.
"""

from PIL import Image
import os
import sys

SPRITES_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'renderer', 'assets', 'sprites')

def remove_white_bg(img_path, tolerance=30, padding=4):
    """
    Remove white/near-white background from a pixel art image.
    
    Strategy:
    1. Convert to RGBA
    2. Flood-fill from corners to find background pixels
    3. Make those pixels transparent
    4. Also handle near-white pixels touching background
    """
    img = Image.open(img_path).convert('RGBA')
    width, height = img.size
    data = img.load()
    
    def is_white(pixel, tol=tolerance):
        r, g, b, a = pixel
        if a < 128:
            return True  # Already transparent
        return r > (255 - tol) and g > (255 - tol) and b > (255 - tol)
    
    def is_near_white(pixel, tol=tolerance + 20):
        r, g, b, a = pixel
        if a < 128:
            return True
        return r > (255 - tol) and g > (255 - tol) and b > (255 - tol)
    
    # Flood fill from all 4 corners + edges
    visited = [[False] * height for _ in range(width)]
    queue = []
    
    # Add border pixels as seeds
    for x in range(width):
        for y in [0, height - 1]:
            if is_white(data[x, y]):
                queue.append((x, y))
                visited[x][y] = True
    for y in range(height):
        for x in [0, width - 1]:
            if is_white(data[x, y]) and not visited[x][y]:
                queue.append((x, y))
                visited[x][y] = True
    
    # BFS flood fill
    while queue:
        x, y = queue.pop(0)
        r, g, b, a = data[x, y]
        data[x, y] = (r, g, b, 0)  # Make transparent
        
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not visited[nx][ny]:
                if is_near_white(data[nx, ny]):
                    visited[nx][ny] = True
                    queue.append((nx, ny))
    
    # Second pass: clean up remaining near-white pixels near transparent areas
    # This helps with anti-aliased edges
    for iteration in range(2):
        for x in range(width):
            for y in range(height):
                if visited[x][y]:
                    continue
                r, g, b, a = data[x, y]
                if a == 0:
                    continue
                # Check if this pixel has transparent neighbors
                has_transparent_neighbor = False
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        nr, ng, nb, na = data[nx, ny]
                        if na == 0:
                            has_transparent_neighbor = True
                            break
                
                if has_transparent_neighbor and is_near_white((r, g, b, a), tolerance + 40):
                    data[x, y] = (r, g, b, 0)
                    visited[x][y] = True
    
    # Crop to content (remove empty border)
    bbox = img.getbbox()
    if bbox:
        # Add a little padding
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(width, bbox[2] + padding)
        bottom = min(height, bbox[3] + padding)
        img = img.crop((left, top, right, bottom))
    
    return img


def process_all_sprites():
    sprite_files = [f for f in os.listdir(SPRITES_DIR) if f.endswith('.png')]
    
    if not sprite_files:
        print("No PNG sprites found!")
        return
    
    print(f"Processing {len(sprite_files)} sprites from: {SPRITES_DIR}")
    
    for fname in sorted(sprite_files):
        path = os.path.join(SPRITES_DIR, fname)
        print(f"  Processing: {fname}", end='... ')
        try:
            result = remove_white_bg(path)
            result.save(path, 'PNG', optimize=True)
            print(f"✅ ({result.size[0]}x{result.size[1]})")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\nDone! All sprites processed.")


if __name__ == '__main__':
    process_all_sprites()

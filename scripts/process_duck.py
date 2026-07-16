import os
from PIL import Image

def get_largest_component_mask(img_data, width, height):
    # img_data is from img.load()
    visited = set()
    components = []
    
    for y in range(height):
        for x in range(width):
            if img_data[x, y][3] > 0 and (x, y) not in visited:
                comp = []
                queue = [(x, y)]
                visited.add((x, y))
                while queue:
                    cx, cy = queue.pop(0)
                    comp.append((cx, cy))
                    for dx, dy in [(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (-1,1), (1,-1), (1,1)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            if img_data[nx, ny][3] > 0 and (nx, ny) not in visited:
                                visited.add((nx, ny))
                                queue.append((nx, ny))
                components.append(comp)
                
    if not components:
        return set()
        
    components.sort(key=len, reverse=True)
    largest_size = len(components[0])
    valid_pixels = set()
    for comp in components:
        if len(comp) > largest_size * 0.05:
            valid_pixels.update(comp)
            
    return valid_pixels

def main():
    img = Image.open('src/renderer/assets/small_duck.png').convert('RGBA')
    W, H = img.size
    cols = 8
    rows = 4
    cell_w = W // cols
    cell_h = H // rows
    
    out_dir = 'src/renderer/assets/duck_sprites'
    os.makedirs(out_dir, exist_ok=True)
    
    cells = []
    
    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col + 1
            left = col * cell_w
            top = row * cell_h
            cell = img.crop((left, top, left + cell_w, top + cell_h))
            
            data = cell.load()
            for y in range(cell_h):
                for x in range(cell_w):
                    r, g, b, a = data[x, y]
                    if a < 128:
                        data[x, y] = (0, 0, 0, 0)
                        
            valid_pixels = get_largest_component_mask(data, cell_w, cell_h)
            for y in range(cell_h):
                for x in range(cell_w):
                    if data[x, y][3] > 0 and (x, y) not in valid_pixels:
                        data[x, y] = (0, 0, 0, 0)
                        
            cells.append(cell)
            
    # Now cells contain cleaned frames (no noise, no numbers)
    # We scale them by 0.45
    scale = 0.45
    scaled_w = int(cell_w * scale)
    scaled_h = int(cell_h * scale)
    
    scaled_cells = []
    for cell in cells:
        scaled = cell.resize((scaled_w, scaled_h), Image.NEAREST)
        scaled_cells.append(scaled)
        
    # Find bounding box of the first cell (idle 1)
    bbox = scaled_cells[0].getbbox()
    duck_bottom_y = bbox[3] if bbox else scaled_h
    
    CANVAS_WIDTH = 300
    CANVAS_HEIGHT = 200
    
    offset_x = (CANVAS_WIDTH - scaled_w) // 2
    offset_y = (CANVAS_HEIGHT - 10) - duck_bottom_y
    
    for i, sc in enumerate(scaled_cells):
        canvas = Image.new('RGBA', (CANVAS_WIDTH, CANVAS_HEIGHT), (0,0,0,0))
        canvas.paste(sc, (offset_x, offset_y), sc)
        canvas.save(f'{out_dir}/duck_{i+1}.png')
        
    print("Duck processed successfully!")

if __name__ == '__main__':
    main()

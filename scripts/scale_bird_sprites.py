import os
from PIL import Image

walk_dir = 'src/renderer/assets/bird_walk_aligned'
target_w, target_h = 377, 361
scale = 0.8

def process_image(path):
    img = Image.open(path).convert('RGBA')
    
    # Scale image
    new_size = (int(img.width * scale), int(img.height * scale))
    scaled_img = img.resize(new_size, Image.NEAREST)
    
    # Get bounding box of scaled image to align it correctly
    bbox = scaled_img.getbbox()
    if not bbox:
        return
        
    scaled_bottom = bbox[3]
    scaled_center_x = (bbox[0] + bbox[2]) / 2.0
    
    # Target alignment: bottom at 274, center_x at 188.5
    offset_y = 274 - scaled_bottom
    offset_x = int(188.5 - scaled_center_x)
    
    # Create new canvas and paste
    new_img = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    new_img.paste(scaled_img, (offset_x, offset_y))
    
    # Save back
    new_img.save(path)

for f in os.listdir(walk_dir):
    if f.endswith('.png'):
        print(f"Scaling and padding {f}...")
        process_image(os.path.join(walk_dir, f))

print("Done!")

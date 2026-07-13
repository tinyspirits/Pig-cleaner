import cv2
import numpy as np

img = cv2.imread('src/renderer/assets/sprites/sniff.png', cv2.IMREAD_UNCHANGED)

# Let's erase the bottom right part of the image
# The image is 300x200
# The pig is around x: 42 to 256. 
# The word sniff is probably around x: 200-256, y: 150-200.
# Let's just zero out everything in x > 200 and y > 150.
# Wait, let's check what's there first to be safe.
alpha = img[:, :, 3]
sniff_region = alpha[150:, 200:]
print("Opaque pixels in bottom right:", np.count_nonzero(sniff_region))

# Actually, the pig's snout might be around x=200 if it's facing right.
# But it's facing left in the original image? Wait, if it's facing left, snout is on the left.
# If it's facing right, snout is on the right.
# Let's just erase it:
img[160:, 200:, :] = 0

cv2.imwrite('src/renderer/assets/sprites/sniff.png', img)
print("Erased bottom right corner!")

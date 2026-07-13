import cv2
img = cv2.imread('src/renderer/assets/actions_no_logo.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]

bg_color = img[0, 0]
img[h-50:h, w-80:w] = bg_color

cv2.imwrite('src/renderer/assets/actions_no_logo.png', img)
print("Removed logo from actions_no_logo.png")

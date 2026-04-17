import os
import shutil
import random

SOURCE = "data/images/all"        
TRAIN_DIR = "data/images/train"
VAL_DIR = "data/images/val"
VAL_RATIO = 0.2  

classes = ["normal", "possible_heat", "health_concern"]

print("=" * 50)
print("📂 STEP 1: ORGANIZING IMAGES")
print("=" * 50)

for cls in classes:
    src_dir = os.path.join(SOURCE, cls)
    train_cls = os.path.join(TRAIN_DIR, cls)
    val_cls = os.path.join(VAL_DIR, cls)
    
    
    os.makedirs(train_cls, exist_ok=True)
    os.makedirs(val_cls, exist_ok=True)
    
    if not os.path.exists(src_dir):
        print(f"⚠️ Folder not found: {src_dir}")
        print(f"   Create it and put {cls} images inside!")
        continue
    
  
    images = [f for f in os.listdir(src_dir) 
              if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp'))]
    
    if len(images) == 0:
        print(f"⚠️ No images in {src_dir}")
        continue
    
   
    random.shuffle(images)
    
    
    val_count = max(1, int(len(images) * VAL_RATIO))
    val_images = images[:val_count]
    train_images = images[val_count:]
    
   
    for img in train_images:
        shutil.copy2(os.path.join(src_dir, img), os.path.join(train_cls, img))
    
    for img in val_images:
        shutil.copy2(os.path.join(src_dir, img), os.path.join(val_cls, img))
    
    print(f"✅ {cls}:")
    print(f"   Total: {len(images)} → Train: {len(train_images)} | Val: {len(val_images)}")

print("\n🎉 Images organized into train/ and val/ folders!")

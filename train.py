import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import matplotlib.pyplot as plt

print("=" * 60)
print("🧠 PASHUMITRA — VISION MODEL TRAINING")
print("=" * 60)

TRAIN_DIR = "data/images/train"
VAL_DIR = "data/images/val"
MODEL_SAVE_DIR = "ml_models"
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20

os.makedirs(MODEL_SAVE_DIR, exist_ok=True)

#LOAD IMAGES

print("\n📸 PART A: Loading images...")

# Training images WITH augmentation (creates variety)
train_datagen = ImageDataGenerator(
    rescale=1.0/255.0,           # Convert pixel values 0-255 → 0-1
    rotation_range=20,            # Randomly rotate up to 20 degrees
    width_shift_range=0.2,        # Randomly shift horizontally
    height_shift_range=0.2,       # Randomly shift vertically
    horizontal_flip=True,         # Randomly flip left-right
    zoom_range=0.2,               # Randomly zoom in/out
    brightness_range=[0.8, 1.2],  # Randomly change brightness
    fill_mode='nearest'           # How to fill empty pixels
)

# Validation images WITHOUT augmentation (pure test)
val_datagen = ImageDataGenerator(
    rescale=1.0/255.0   # Only convert pixel values
)

# Load training images from folders
train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),  # Resize all to 224×224
    batch_size=BATCH_SIZE,
    class_mode='categorical',          # 3 classes → one-hot encoding
    classes=['normal', 'possible_heat', 'health_concern'],
    shuffle=True
)

# Load validation images from folders
val_generator = val_datagen.flow_from_directory(
    VAL_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    classes=['normal', 'possible_heat', 'health_concern'],
    shuffle=False
)

print(f"\n✅ Training images:   {train_generator.samples}")
print(f"✅ Validation images: {val_generator.samples}")
print(f"✅ Classes: {train_generator.class_indices}")
print(f"   0 = normal")
print(f"   1 = possible_heat")  
print(f"   2 = health_concern")


#BUILD THE MODEL

print("\n🏗️ PART B: Building model...")

#Download MobileNetV2 (pre-trained brain)
print("   Downloading MobileNetV2 pre-trained weights...")
base_model = MobileNetV2(
    weights='imagenet',        # Use ImageNet knowledge
    include_top=False,         # Remove original classification head
    input_shape=(224, 224, 3)  # Input: 224×224 RGB image
)

# Freeze the pre-trained layers (don't change them)
base_model.trainable = False
print(f"   ✅ MobileNetV2 loaded: {len(base_model.layers)} layers (all frozen)")

#Add our custom classification head
x = base_model.output
x = GlobalAveragePooling2D()(x)    # Compress features
x = Dense(128, activation='relu')(x)  # Learn patterns (128 neurons)
x = Dropout(0.3)(x)                # Prevent overfitting (drop 30%)
x = Dense(64, activation='relu')(x)   # Learn patterns (64 neurons)
x = Dropout(0.2)(x)                # Prevent overfitting (drop 20%)
predictions = Dense(3, activation='softmax')(x)  # 3 classes output

# Create final model
model = Model(inputs=base_model.input, outputs=predictions)

#Compile (set optimizer and loss function)
model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)


total_params = model.count_params()
trainable_params = sum([tf.keras.backend.count_params(w) for w in model.trainable_weights])
print(f"   ✅ Total parameters:     {total_params:,}")
print(f"   ✅ Trainable parameters: {trainable_params:,}")
print(f"   ✅ Frozen parameters:    {total_params - trainable_params:,}")

# TRAIN THE MODEL

print("\n🚀 PART C: Training model...")
print(f"   Epochs: {EPOCHS}")
print(f"   Batch size: {BATCH_SIZE}")
print(f"   This will take 15-30 minutes...\n")


callbacks = [
    
    ModelCheckpoint(
        os.path.join(MODEL_SAVE_DIR, 'mobilenet_v2.h5'),
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    ),
    
    EarlyStopping(
        monitor='val_accuracy',
        patience=5,
        restore_best_weights=True,
        verbose=1
    )
]


history = model.fit(
    train_generator,
    epochs=EPOCHS,
    validation_data=val_generator,
    callbacks=callbacks,
    verbose=1
)

print("\n✅ Training complete!")


print("\n📊 PART D: Results")
print("=" * 60)

train_acc = history.history['accuracy'][-1]
val_acc = history.history['val_accuracy'][-1]
train_loss = history.history['loss'][-1]
val_loss = history.history['val_loss'][-1]

print(f"\n   📈 Training Accuracy:   {train_acc:.4f} ({train_acc*100:.1f}%)")
print(f"   📈 Validation Accuracy: {val_acc:.4f} ({val_acc*100:.1f}%)")
print(f"   📉 Training Loss:       {train_loss:.4f}")
print(f"   📉 Validation Loss:     {val_loss:.4f}")


best_val_acc = max(history.history['val_accuracy'])
best_epoch = history.history['val_accuracy'].index(best_val_acc) + 1
print(f"\n   🏆 Best Validation Accuracy: {best_val_acc:.4f} ({best_val_acc*100:.1f}%) at Epoch {best_epoch}")


print("\n📊 PART E: Saving charts...")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))


ax1.plot(history.history['accuracy'], label='Train Accuracy', color='#4CAF50', linewidth=2)
ax1.plot(history.history['val_accuracy'], label='Val Accuracy', color='#2196F3', linewidth=2)
ax1.set_title('Model Accuracy', fontsize=14, fontweight='bold')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Accuracy')
ax1.legend()
ax1.grid(True, alpha=0.3)
ax1.set_ylim([0, 1.05])


ax2.plot(history.history['loss'], label='Train Loss', color='#F44336', linewidth=2)
ax2.plot(history.history['val_loss'], label='Val Loss', color='#FF9800', linewidth=2)
ax2.set_title('Model Loss', fontsize=14, fontweight='bold')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Loss')
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(MODEL_SAVE_DIR, 'training_charts.png'), dpi=150)
print(f"   ✅ Chart saved: {MODEL_SAVE_DIR}/training_charts.png")


print("\n🧪 PART F: Testing on validation images...")

from tensorflow.keras.preprocessing import image

CLASS_NAMES = ['normal', 'possible_heat', 'health_concern']

best_model = tf.keras.models.load_model(os.path.join(MODEL_SAVE_DIR, 'mobilenet_v2.h5'))


test_results = []
for cls in CLASS_NAMES:
    cls_dir = os.path.join(VAL_DIR, cls)
    if not os.path.exists(cls_dir):
        continue
    
    images_list = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    if not images_list:
        continue
    
    
    test_img_path = os.path.join(cls_dir, images_list[0])
    
   
    img = image.load_img(test_img_path, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = img_array / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
  
    predictions = best_model.predict(img_array, verbose=0)
    predicted_class = CLASS_NAMES[np.argmax(predictions[0])]
    confidence = np.max(predictions[0])
    
    match = "✅" if predicted_class == cls else "❌"
    
    print(f"   {match} Actual: {cls:20s} | Predicted: {predicted_class:20s} | Confidence: {confidence:.2%}")
    print(f"      Scores: normal={predictions[0][0]:.3f} | heat={predictions[0][1]:.3f} | health={predictions[0][2]:.3f}")


print("\n" + "=" * 60)
print("🎉 VISION MODEL TRAINING COMPLETE!")
print("=" * 60)
print(f"\n   📁 Model saved at: {MODEL_SAVE_DIR}/mobilenet_v2.h5")
print(f"   📊 Charts saved at: {MODEL_SAVE_DIR}/training_charts.png")
print(f"   🏆 Best accuracy: {best_val_acc*100:.1f}%")
print(f"\n   Next step: Run step3_train_xgboost.py")
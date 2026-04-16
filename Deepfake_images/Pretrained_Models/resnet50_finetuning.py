import os
import tensorflow as tf
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

from plot_loss_accuracy_graph import plot_history
from load_pre_trained_models import load_pretrained_models
from data_preprocessing import data_preprocessing


# 📁 Save directory
SAVE_DIR = r"D:\DeepFake-Image\models"
os.makedirs(SAVE_DIR, exist_ok=True)


# 🔹 Load model
resnet50_base = load_pretrained_models("resnet50")

# 🔹 Load data
train_generator, val_generator, test_generator = data_preprocessing()


# 🧠 STEP 1: FREEZE FULL BASE MODEL (IMPORTANT)
for layer in resnet50_base.layers:
    layer.trainable = False


# 🔹 Custom classifier
x = resnet50_base.output
x = GlobalAveragePooling2D()(x)
x = Dense(512, activation='relu')(x)
x = Dropout(0.5)(x)
predictions = Dense(1, activation='sigmoid')(x)

model = Model(inputs=resnet50_base.input, outputs=predictions)


# 🔹 Compile (LOW LR)
model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss='binary_crossentropy',
    metrics=['accuracy']
)


# 🔥 Callbacks
callbacks = [
    EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True),
    ModelCheckpoint(os.path.join(SAVE_DIR, "best_resnet50.keras"),
                    monitor='val_accuracy', save_best_only=True),
    ReduceLROnPlateau(monitor='val_loss', factor=0.3, patience=2, min_lr=1e-6)
]


# 🚀 STEP 2: TRAIN ONLY TOP LAYERS (FAST + STABLE)
history = model.fit(
    train_generator,
    steps_per_epoch=200,          # 🔥 VERY IMPORTANT
    validation_data=val_generator,
    validation_steps=50,
    epochs=5,
    callbacks=callbacks,
    verbose=1
)


# 🧠 STEP 3: FINE-TUNE LAST LAYERS (OPTIONAL BOOST)
for layer in resnet50_base.layers[-10:]:
    layer.trainable = True

model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

history_finetune = model.fit(
    train_generator,
    steps_per_epoch=200,
    validation_data=val_generator,
    validation_steps=50,
    epochs=3,
    callbacks=callbacks,
    verbose=1
)


# 🔹 Evaluate
test_loss, test_accuracy = model.evaluate(test_generator)

print(f"✅ Test Loss: {test_loss:.4f}")
print(f"✅ Test Accuracy: {test_accuracy * 100:.2f}%")


# 🔹 Plot
plot_history(history, "resnet50")


# 💾 Save model
model.save(os.path.join(SAVE_DIR, "resnet50_final.keras"))
model.save(os.path.join(SAVE_DIR, "resnet50_final.h5"))

print("🔥 FINAL MODEL SAVED SUCCESSFULLY!")
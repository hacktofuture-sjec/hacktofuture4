import os
import tensorflow as tf
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

from plot_loss_accuracy_graph import plot_history
from load_pre_trained_models import load_pretrained_models
from data_preprocessing import data_preprocessing


# 📁 Save directory
SAVE_DIR = r"D:\DeepFake-Image\models"
os.makedirs(SAVE_DIR, exist_ok=True)


# 🔹 Load model
inception_base = load_pretrained_models("inception")

# 🔹 Load data
train_generator, val_generator, test_generator = data_preprocessing()


# 🔹 Freeze layers
for layer in inception_base.layers[:-5]:
    layer.trainable = False

for layer in inception_base.layers[-5:]:
    layer.trainable = True


# 🔹 Custom head
x = inception_base.output
x = GlobalAveragePooling2D()(x)
x = Dense(512, activation='relu')(x)   # reduced from 1024
x = Dropout(0.5)(x)

predictions = Dense(1, activation='sigmoid')(x)

model = Model(inputs=inception_base.input, outputs=predictions)


# 🔹 Compile
model.compile(
    optimizer=Adam(learning_rate=1e-4),
    loss='binary_crossentropy',
    metrics=['accuracy']
)


# 🔥 Callbacks (important)
callbacks = [
    EarlyStopping(
        monitor='val_loss',
        patience=3,
        restore_best_weights=True
    ),
    ModelCheckpoint(
        filepath=os.path.join(SAVE_DIR, "best_inception.keras"),
        monitor='val_accuracy',
        save_best_only=True
    )
]


# 🔹 Train
history = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=10,
    callbacks=callbacks,
    verbose=1
)


# 🔹 Evaluate
test_loss, test_accuracy = model.evaluate(test_generator)

print(f"✅ Test Loss: {test_loss:.4f}")
print(f"✅ Test Accuracy: {test_accuracy * 100:.2f}%")


# 🔹 Plot
plot_history(history, "inceptionV3")


# 🔹 Save model (both formats)
model.save(os.path.join(SAVE_DIR, "inception_final.keras"))
model.save(os.path.join(SAVE_DIR, "inception_final.h5"))

print("🔥 Inception model saved successfully!") 
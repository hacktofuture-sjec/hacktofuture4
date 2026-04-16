import os
from data_augmentation import data_augmentation

# 📌 CONFIG (centralized paths)
BASE_DIR = r"D:\DeepFake-Image\real_vs_fake\real-vs-fake"

TRAIN_DIR = os.path.join(BASE_DIR, "train")
TEST_DIR = os.path.join(BASE_DIR, "test")

IMG_WIDTH = 256
IMG_HEIGHT = 256
BATCH_SIZE = 32


def data_preprocessing():

    # Get augmentation generators
    train_datagen, val_datagen, test_datagen = data_augmentation()

    # 🔹 Train + Validation (using split)
    train_generator = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_WIDTH, IMG_HEIGHT),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        subset='training'
    )

    val_generator = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_WIDTH, IMG_HEIGHT),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        subset='validation'
    )

    # 🔹 Test Generator
    test_generator = test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=(IMG_WIDTH, IMG_HEIGHT),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        shuffle=False   # IMPORTANT for evaluation
    )

    return train_generator, val_generator, test_generator
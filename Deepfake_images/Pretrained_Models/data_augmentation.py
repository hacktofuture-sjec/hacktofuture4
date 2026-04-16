from tensorflow.keras.preprocessing.image import ImageDataGenerator


def data_augmentation():

    # 🔹 Train + Validation (with split)
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        shear_range=0.1,
        zoom_range=0.1,
        horizontal_flip=True,
        fill_mode='nearest',
        validation_split=0.2   # ⭐ IMPORTANT
    )

    # 🔹 Test (no augmentation)
    test_datagen = ImageDataGenerator(
        rescale=1./255
    )

    return train_datagen, train_datagen, test_datagen

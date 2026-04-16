from tensorflow.keras.applications import VGG16, VGG19, InceptionV3, ResNet50

# 📌 Global config
IMG_WIDTH = 256
IMG_HEIGHT = 256


def load_pretrained_models(model_name="resnet50"):
    """
    Load a specific pretrained model.
    
    Args:
        model_name (str): 'vgg16', 'vgg19', 'inception', 'resnet50'
    
    Returns:
        model: Keras base model
    """

    input_shape = (IMG_WIDTH, IMG_HEIGHT, 3)

    if model_name == "vgg16":
        return VGG16(weights='imagenet', include_top=False, input_shape=input_shape)

    elif model_name == "vgg19":
        return VGG19(weights='imagenet', include_top=False, input_shape=input_shape)

    elif model_name == "inception":
        return InceptionV3(weights='imagenet', include_top=False, input_shape=input_shape)

    elif model_name == "resnet50":
        return ResNet50(weights='imagenet', include_top=False, input_shape=input_shape)

    else:
        raise ValueError("Invalid model name. Choose from: vgg16, vgg19, inception, resnet50")
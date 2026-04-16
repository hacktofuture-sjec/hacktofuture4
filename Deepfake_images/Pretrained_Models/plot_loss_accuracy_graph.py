import os
import matplotlib.pyplot as plt


# 📁 Save directory for plots
SAVE_DIR = r"D:\DeepFake-Image\plots"
os.makedirs(SAVE_DIR, exist_ok=True)


def plot_history(history, model_name):
    """
    Plot and save training & validation accuracy and loss graphs.
    """

    # Detect keys
    acc = history.history.get('accuracy', history.history.get('acc'))
    val_acc = history.history.get('val_accuracy', history.history.get('val_acc'))
    loss = history.history['loss']
    val_loss = history.history['val_loss']

    # 🔹 Accuracy Plot
    plt.figure(figsize=(8, 5))
    plt.plot(acc, label='Train Accuracy')
    plt.plot(val_acc, label='Validation Accuracy')
    plt.title(f'{model_name} Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True)

    acc_path = os.path.join(SAVE_DIR, f"{model_name}_accuracy.png")
    plt.savefig(acc_path)
    plt.show()

    # 🔹 Loss Plot
    plt.figure(figsize=(8, 5))
    plt.plot(loss, label='Train Loss')
    plt.plot(val_loss, label='Validation Loss')
    plt.title(f'{model_name} Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)

    loss_path = os.path.join(SAVE_DIR, f"{model_name}_loss.png")
    plt.savefig(loss_path)
    plt.show()

    print(f"📊 Plots saved at:")
    print(f"➡ {acc_path}")
    print(f"➡ {loss_path}")
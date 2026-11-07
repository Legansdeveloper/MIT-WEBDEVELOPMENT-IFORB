"""Fine-tune IndoBERT for scam-chat vs. normal-chat classification."""

from pathlib import Path
from typing import Dict, List, Union

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)

CSV_PATH = Path("dataset_chat_penipuan.csv")
BASE_MODEL = "indolem/indobert-base-uncased"
OUTPUT_DIR = Path("./model_deteksi_penipuan")
MAX_LENGTH = 128
LABEL_NAMES = {0: "normal", 1: "penipuan"}


class ChatDataset(Dataset):
    """Tokenized chat messages and their integer class labels."""

    def __init__(self, texts: List[str], labels: List[int], tokenizer):
        self.encodings = tokenizer(
            texts,
            truncation=True,
            padding="max_length",
            max_length=MAX_LENGTH,
        )
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> Dict[str, torch.Tensor]:
        item = {
            key: torch.tensor(value[index], dtype=torch.long)
            for key, value in self.encodings.items()
        }
        item["labels"] = torch.tensor(self.labels[index], dtype=torch.long)
        return item


def compute_metrics(prediction) -> Dict[str, float]:
    predictions = np.argmax(prediction.predictions, axis=1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        prediction.label_ids,
        predictions,
        average="binary",
        zero_division=0,
    )
    return {
        "accuracy": accuracy_score(prediction.label_ids, predictions),
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def load_and_validate_data(csv_path: Path):
    if not csv_path.is_file():
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {csv_path.resolve()}"
        )

    data = pd.read_csv(csv_path)
    # Dataset yang ada memakai kolom ``teks`` dan label berupa nama kelas.
    # Tetap dukung format ``text`` dan label numerik agar skrip juga bisa
    # dipakai dengan dataset lama.
    text_column = "teks" if "teks" in data.columns else "text"
    required_columns = {text_column, "label"}
    missing_columns = required_columns.difference(data.columns)
    if missing_columns:
        raise ValueError(
            f"Kolom wajib tidak ditemukan di CSV: {', '.join(sorted(missing_columns))}"
        )
    if data.empty:
        raise ValueError("Dataset CSV tidak memiliki baris data.")
    if data[[text_column, "label"]].isnull().any().any():
        raise ValueError(f"Kolom '{text_column}' dan 'label' tidak boleh kosong.")

    raw_labels = data["label"].astype(str).str.strip().str.lower()
    label_map = {"normal": 0, "penipuan": 1, "0": 0, "1": 1}
    unknown_labels = sorted(set(raw_labels) - set(label_map))
    if unknown_labels:
        raise ValueError(
            "Label harus berupa normal/penipuan atau angka 0/1; "
            f"ditemukan: {', '.join(unknown_labels)}"
        )
    labels = raw_labels.map(label_map).astype(int)

    if not labels.isin([0, 1]).all():
        raise ValueError("Label hanya boleh 0 (normal) atau 1 (penipuan).")

    texts = data[text_column].astype(str).tolist()
    return texts, labels.tolist()


def train_model() -> None:
    texts, labels = load_and_validate_data(CSV_PATH)
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=2,
        id2label=LABEL_NAMES,
        label2id={name: label for label, name in LABEL_NAMES.items()},
    )

    train_dataset = ChatDataset(train_texts, train_labels, tokenizer)
    test_dataset = ChatDataset(test_texts, test_labels, tokenizer)

    training_args = TrainingArguments(
        output_dir="./hasil_training_indobert",
        num_train_epochs=3,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    print("Evaluasi data uji:")
    print(trainer.evaluate())

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"Model dan tokenizer tersimpan di: {OUTPUT_DIR.resolve()}")


def predict_chat(
    text: str,
    model_dir: Union[str, Path] = OUTPUT_DIR,
) -> Dict[str, Union[str, float, int]]:
    """Predict one new chat using a saved model; returns label and confidence."""
    model_path = Path(model_dir)
    if not model_path.is_dir():
        raise FileNotFoundError(
            f"Folder model tidak ditemukan: {model_path.resolve()}. Jalankan training dahulu."
        )
    if not text or not text.strip():
        raise ValueError("Teks chat tidak boleh kosong.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    model.to(device)
    model.eval()

    inputs = tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        logits = model(**inputs).logits
        probabilities = torch.softmax(logits, dim=-1)[0]

    predicted_label = int(torch.argmax(probabilities).item())
    return {
        "label": predicted_label,
        "kelas": LABEL_NAMES[predicted_label],
        "confidence": float(probabilities[predicted_label].item()),
    }


if __name__ == "__main__":
    train_model()

    

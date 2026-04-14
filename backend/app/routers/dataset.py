import os
import shutil
import threading
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.routers.auth_middleware import require_admin
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    TrainerCallback,
)
from datasets import Dataset
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score
from datetime import datetime
import pytz

router = APIRouter(prefix="/dataset", tags=["dataset"])

MODEL_PATH   = "models/scam-detector"
FALLBACK     = "mrm8488/bert-tiny-finetuned-sms-spam-detection"
TEMP_PATH    = "models/scam-detector-new"
BACKUP_PATH  = "models/scam-detector-backup"

IST = pytz.timezone("Asia/Kolkata")

training_status = {
    "is_training":        False,
    "progress":           "idle",
    "last_trained":       None,
    "last_accuracy":      None,
    "records_trained_on": 0,
}

# Thread-safe stop flag using threading.Event
_stop_event = threading.Event()


def get_ist_now() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def normalize_label(raw: str) -> int | None:
    raw = str(raw).strip().lower()
    if raw in ["spam", "scam", "phishing", "fraud", "1"]:
        return 1
    if raw in ["ham", "legit", "legitimate", "safe", "0"]:
        return 0
    return None


def retrain_model_background(records: list[dict]):
    """Full retraining pipeline with hard stop support."""
    global training_status

    # Clear the stop flag at start
    _stop_event.clear()

    training_status.update({
        "is_training":        True,
        "progress":           "queued",
        "last_trained":       None,
        "last_accuracy":      None,
        "records_trained_on": 0,
    })

    try:
        # ── 1. Prepare dataset ─────────────────────────────────────────
        training_status["progress"] = "Preparing dataset..."
        if _stop_event.is_set():
            _handle_stop()
            return

        labeled = []
        for r in records:
            lbl = normalize_label(r.get("label", ""))
            msg = str(r.get("message", "")).strip()
            if lbl is not None and msg:
                labeled.append({"text": msg, "label": lbl})

        if len(labeled) < 10:
            training_status.update({
                "is_training": False,
                "progress":    "failed: Not enough labeled records (minimum 10 required)",
            })
            return

        # Balance check
        labels_array = np.array([r["label"] for r in labeled])
        unique_labels = np.unique(labels_array)

        # 85/15 split
        split_idx = int(len(labeled) * 0.85)
        train_data = labeled[:split_idx]
        val_data   = labeled[split_idx:] or labeled[:max(1, len(labeled) // 5)]

        train_ds = Dataset.from_list([{"text": r["text"], "label": r["label"]} for r in train_data])
        val_ds   = Dataset.from_list([{"text": r["text"], "label": r["label"]} for r in val_data])

        # ── 2. Load base model ─────────────────────────────────────────
        training_status["progress"] = "Loading base model..."
        if _stop_event.is_set():
            _handle_stop()
            return

        # Always start from base to avoid overfitting cached weights
        source = FALLBACK
        print(f"Fine-tuning from base: {source}")

        tokenizer = AutoTokenizer.from_pretrained(source)
        model     = AutoModelForSequenceClassification.from_pretrained(source, num_labels=2)

        # ── 3. Tokenize ────────────────────────────────────────────────
        training_status["progress"] = "Tokenizing dataset..."
        if _stop_event.is_set():
            _handle_stop()
            return

        def tokenize(batch):
            return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

        train_ds = train_ds.map(tokenize, batched=True)
        val_ds   = val_ds.map(tokenize, batched=True)
        train_ds = train_ds.rename_column("label", "labels")
        val_ds   = val_ds.rename_column("label", "labels")
        train_ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
        val_ds.set_format("torch",   columns=["input_ids", "attention_mask", "labels"])

        if _stop_event.is_set():
            _handle_stop()
            return

        # ── 4. Class weights for imbalanced data ───────────────────────
        class_weights = None
        if len(unique_labels) > 1:
            from sklearn.utils.class_weight import compute_class_weight
            weights = compute_class_weight("balanced", classes=unique_labels, y=labels_array)
            class_weights = torch.tensor(weights, dtype=torch.float)

        # ── 5. Training args ───────────────────────────────────────────
        training_status["progress"] = "Training model..."
        if _stop_event.is_set():
            _handle_stop()
            return

        args = TrainingArguments(
            output_dir              = "models/training-output",
            num_train_epochs        = 3,
            per_device_train_batch_size = 8,
            per_device_eval_batch_size  = 8,
            eval_strategy     = "epoch",
            save_strategy           = "no",
            logging_steps           = 10,
            learning_rate           = 2e-5,
            weight_decay            = 0.01,
            warmup_ratio            = 0.1,
            report_to               = "none",
        )

        # ── 6. Custom trainer with stop support ────────────────────────
        # Capture the module-level stop event explicitly
        _evt = _stop_event

        class StopEarly(TrainerCallback):
            def on_step_end(self, args, state, control, **kwargs):
                if _evt.is_set():
                    print("Stop event detected at step end — halting")
                    control.should_training_stop = True
                    control.should_epoch_stop    = True
                    control.should_save          = False
                    control.should_evaluate      = False
                return control

            def on_epoch_end(self, args, state, control, **kwargs):
                if _evt.is_set():
                    print("Stop event detected at epoch end — halting")
                    control.should_training_stop = True
                return control

        class WeightedTrainer:
            pass

        # Build trainer using HuggingFace Trainer directly
        from transformers import Trainer

        class CustomTrainer(Trainer):
            def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
                labels  = inputs.pop("labels")
                outputs = model(**inputs)
                logits  = outputs.logits
                if class_weights is not None:
                    loss_fn = nn.CrossEntropyLoss(weight=class_weights.to(logits.device))
                else:
                    loss_fn = nn.CrossEntropyLoss()
                loss = loss_fn(logits, labels)
                return (loss, outputs) if return_outputs else loss

        trainer = CustomTrainer(
            model         = model,
            args          = args,
            train_dataset = train_ds,
            eval_dataset  = val_ds,
            callbacks     = [StopEarly()],
        )

        # ── 7. Train ───────────────────────────────────────────────────
        trainer.train()

        if _stop_event.is_set():
            print("Training returned with stop event set")
            _handle_stop()
            return

        # ── 9. Evaluate ────────────────────────────────────────────────
        training_status["progress"] = "Evaluating..."
        if _stop_event.is_set():
            _handle_stop()
            return

        preds_output = trainer.predict(val_ds)
        y_pred = np.argmax(preds_output.predictions, axis=-1)
        y_true = preds_output.label_ids
        acc = round(accuracy_score(y_true, y_pred) * 100, 1)
        f1  = round(f1_score(y_true, y_pred, average="macro", zero_division=0) * 100, 1)

        # ── 10. Save new model ─────────────────────────────────────────
        training_status["progress"] = "Saving model..."
        if _stop_event.is_set():
            _handle_stop()
            return

        os.makedirs(TEMP_PATH, exist_ok=True)
        trainer.save_model(TEMP_PATH)
        tokenizer.save_pretrained(TEMP_PATH)

        # Release current model from memory before file ops
        import app.ml.scanner as scanner_module
        del scanner_module.model
        del scanner_module.tokenizer
        import gc
        gc.collect()

        # Atomic swap: current → backup, new → current
        if os.path.exists(BACKUP_PATH):
            shutil.rmtree(BACKUP_PATH)
        if os.path.exists(MODEL_PATH):
            shutil.move(MODEL_PATH, BACKUP_PATH)
        shutil.move(TEMP_PATH, MODEL_PATH)

        # Reload fresh model
        scanner_module.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        scanner_module.model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        scanner_module.model.eval()

        training_status.update({
            "is_training":        False,
            "progress":           "completed",
            "last_trained":       get_ist_now(),
            "last_accuracy":      f"Accuracy: {acc}% | F1: {f1}%",
            "records_trained_on": len(records),
        })
        print(f"Training complete. Accuracy: {acc}% | F1: {f1}%")

    except Exception as e:
        if _stop_event.is_set():
            _handle_stop()
        else:
            training_status.update({
                "is_training": False,
                "progress":    f"failed: {str(e)}",
            })
        print(f"Training error: {e}")


def _handle_stop():
    """Called whenever stop is detected — reverts to backup weights."""
    global training_status

    print("Handling stop — reverting to previous model weights")
    training_status["progress"] = "Restoring previous weights..."

    try:
        import app.ml.scanner as scanner_module

        # Free current in-memory model
        try:
            del scanner_module.model
            del scanner_module.tokenizer
            import gc
            gc.collect()
        except Exception:
            pass

        # Clean up temp folder if it exists
        if os.path.exists(TEMP_PATH):
            shutil.rmtree(TEMP_PATH, ignore_errors=True)

        # Restore from backup if available, otherwise keep current
        restore_path = BACKUP_PATH if os.path.exists(f"{BACKUP_PATH}/config.json") else MODEL_PATH
        fallback_used = False

        if not os.path.exists(f"{restore_path}/config.json"):
            restore_path  = FALLBACK
            fallback_used = True

        print(f"Restoring from: {restore_path}")
        scanner_module.tokenizer = AutoTokenizer.from_pretrained(restore_path)
        scanner_module.model     = AutoModelForSequenceClassification.from_pretrained(restore_path)
        scanner_module.model.eval()

    except Exception as e:
        print(f"Restore error: {e}")
    finally:
        _stop_event.clear()
        training_status.update({
            "is_training":   False,
            "progress":      "stopped",
            "last_accuracy": "Training stopped — previous model weights restored" + (
                " (using fallback model)" if "fallback_used" in dir() and fallback_used else ""
            ),
            "records_trained_on": 0,
        })


# ── API Routes ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    _:    dict       = Depends(require_admin),
):
    if training_status["is_training"]:
        raise HTTPException(status_code=400, detail="Training already in progress")

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ["csv", "json", "txt"]:
        raise HTTPException(status_code=400, detail="Only CSV, JSON, TXT supported")

    contents = await file.read()
    records: list[dict] = []

    try:
        if ext == "csv":
            import io
            df = pd.read_csv(io.BytesIO(contents))
            # Normalize column names
            df.columns = [c.lower().strip() for c in df.columns]
            if "message" not in df.columns or "label" not in df.columns:
                raise HTTPException(status_code=400, detail="CSV must have 'message' and 'label' columns")
            records = df[["message", "label"]].head(5000).to_dict("records")

        elif ext == "json":
            import json
            data = json.loads(contents.decode("utf-8"))
            if isinstance(data, list):
                records = [{"message": str(r.get("message","")), "label": str(r.get("label",""))} for r in data[:5000]]
            else:
                raise HTTPException(status_code=400, detail="JSON must be an array of objects")

        elif ext == "txt":
            lines = contents.decode("utf-8").strip().split("\n")
            for line in lines[:5000]:
                parts = line.split("\t")
                if len(parts) >= 2:
                    records.append({"message": parts[1].strip(), "label": parts[0].strip()})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    valid = [r for r in records if normalize_label(r.get("label", "")) is not None and str(r.get("message","")).strip()]
    if len(valid) < 10:
        raise HTTPException(status_code=400, detail=f"Need at least 10 valid labeled records. Found {len(valid)}.")

    # Start training in background thread
    thread = threading.Thread(target=retrain_model_background, args=(valid,), daemon=True)
    thread.start()

    return {
        "message":  f"Retraining started on {len(valid)} records",
        "records":  len(valid),
        "filename": file.filename,
        "status":   "training_started",
    }


@router.post("/stop-training")
def stop_training_route(_: dict = Depends(require_admin)):
    # Set the stop event regardless — if training isn't running it's harmless
    _stop_event.set()
    training_status["progress"] = "Stop requested — finishing current step..."
    return {"message": "Stop signal sent. Training will halt and previous weights will be restored."}

@router.get("/training-status")
def get_training_status(_: dict = Depends(require_admin)):
    return training_status


@router.get("/info")
def get_dataset_info(_: dict = Depends(require_admin)):
    from app.database import SessionLocal
    from app.models.scan import Scan

    db    = SessionLocal()
    scans = db.query(Scan).all()
    db.close()

    scam_count  = sum(1 for s in scans if s.risk_level in ["HIGH", "CRITICAL"])
    legit_count = sum(1 for s in scans if s.risk_level in ["LOW"])

    return {
        "total_records":   len(scans),
        "scam_records":    scam_count,
        "legit_records":   legit_count,
        "training_status": training_status,
    }
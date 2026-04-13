from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth_middleware import require_admin
import pandas as pd
import json
import io
import os
import shutil

router = APIRouter(prefix="/dataset", tags=["dataset"])

# Track training status globally
training_status = {
    "is_training":        False,
    "progress":           "idle",
    "last_trained":       None,
    "last_accuracy":      None,
    "records_trained_on": 0,
}

stop_training = {"requested": False, "hard_stop": False}

def retrain_model_background(records: list[dict]):
    """Runs in background thread — retrains XLM-RoBERTa on new data"""
    # Add this at the very start of retrain_model_background, before anything else:
    stop_training["requested"] = False
    stop_training["hard_stop"] = False
    global training_status
    try:
        training_status["is_training"] = True
        training_status["progress"]    = "Preparing dataset..."

        import torch
        import numpy as np
        from transformers import (
            AutoTokenizer,
            AutoModelForSequenceClassification,
            TrainingArguments,
            Trainer,
        )
        from datasets import Dataset
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score, f1_score
        import pandas as pd

        MODEL_PATH = "models/scam-detector"
        FALLBACK   = "xlm-roberta-base"

        df = pd.DataFrame(records)
        df = df.dropna(subset=["message"])
        df["message"] = df["message"].astype(str).str.strip()
        df = df[df["message"].str.len() > 5]

        if len(df) < 10:
            training_status["progress"]    = "Not enough data (minimum 10 records)"
            training_status["is_training"] = False
            return

        # Map labels
        df["label"] = df["label"].map(
            lambda x: 1 if str(x).lower() in
            ["spam", "scam", "1", "1.0", "phishing", "fraud"] else 0
        )

        # Compute class weights to handle imbalance
        from sklearn.utils.class_weight import compute_class_weight
        import torch

        labels_array = np.array([r["label"] for r in records if str(r.get("label","")).lower() not in ["unknown",""]])
        if len(np.unique(labels_array)) > 1:
            weights = compute_class_weight("balanced", classes=np.unique(labels_array), y=labels_array)
            class_weights = torch.tensor(weights, dtype=torch.float)
        else:
            class_weights = None

        # Custom trainer with weighted loss
        from transformers import Trainer as HFTrainer
        import torch.nn as nn

        class WeightedTrainer(HFTrainer):
            def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
                labels = inputs.pop("labels")
                outputs = model(**inputs)
                logits = outputs.logits
                if class_weights is not None:
                    loss_fn = nn.CrossEntropyLoss(weight=class_weights.to(logits.device))
                else:
                    loss_fn = nn.CrossEntropyLoss()
                loss = loss_fn(logits, labels)
                return (loss, outputs) if return_outputs else loss
        training_status["progress"] = "Loading model..."

        # Always start from base model for retraining to avoid overfitting cached weights
        source = FALLBACK
        print(f"Starting fine-tune from base model: {source}")
        tokenizer = AutoTokenizer.from_pretrained(source)
        model     = AutoModelForSequenceClassification.from_pretrained(
            source, num_labels=2,
            id2label={0: "LEGITIMATE", 1: "SCAM"},
            label2id={"LEGITIMATE": 0, "SCAM": 1},
        )

        training_status["progress"] = "Tokenizing..."

        train_df, val_df = train_test_split(
            df, test_size=0.15, random_state=42,
            stratify=df["label"] if df["label"].nunique() > 1 else None
        )

        def tokenize(batch):
            return tokenizer(
                batch["message"],
                truncation=True,
                padding="max_length",
                max_length=128,
            )

        train_ds = Dataset.from_pandas(train_df[["message", "label"]])
        val_ds   = Dataset.from_pandas(val_df[["message", "label"]])
        train_ds = train_ds.map(tokenize, batched=True)
        val_ds   = val_ds.map(tokenize,   batched=True)
        train_ds = train_ds.rename_column("label", "labels")
        val_ds   = val_ds.rename_column("label", "labels")
        train_ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
        val_ds.set_format("torch",   columns=["input_ids", "attention_mask", "labels"])

        def compute_metrics(eval_pred):
            logits, labels = eval_pred
            preds = np.argmax(logits, axis=-1)
            return {
                "accuracy": accuracy_score(labels, preds),
                "f1":       f1_score(labels, preds, average="binary", zero_division=0),
            }

        training_status["progress"] = f"Training on {len(train_df)} samples..."

        USE_GPU = torch.cuda.is_available()

        args = TrainingArguments(
            output_dir               = "models/retrain-checkpoints",
            num_train_epochs         = 3,
            per_device_train_batch_size = 8,
            per_device_eval_batch_size  = 8,
            learning_rate            = 2e-5,
            weight_decay             = 0.05,
            eval_strategy            = "epoch",
            save_strategy            = "no",
            fp16                     = USE_GPU,
            logging_steps            = 10,
            report_to                = "none",
            warmup_ratio             = 0.1,
        )

        # Add custom callback for stop support
        from transformers import TrainerCallback

        class StopCallback(TrainerCallback):
            def on_step_end(self, args, state, control, **kwargs):
                # Check on every step, not just epoch end
                if stop_training["requested"]:
                    control.should_training_stop = True
                    control.should_epoch_stop = True
                return control

            def on_epoch_end(self, args, state, control, **kwargs):
                if stop_training["requested"]:
                    control.should_training_stop = True
                return control

        trainer = WeightedTrainer(
            model           = model,
            args            = args,
            train_dataset   = train_ds,
            eval_dataset    = val_ds,
            compute_metrics = compute_metrics,
            callbacks       = [StopCallback()],
        )

        # Reset stop flag before training
        stop_training["requested"] = False

        trainer.train()

        training_status["progress"] = "Evaluating..."
        metrics = trainer.evaluate(val_ds)
        from sklearn.metrics import accuracy_score, f1_score
        import numpy as np

        # Run fresh prediction on val set for accurate metrics
        preds_output = trainer.predict(val_ds)
        y_pred = np.argmax(preds_output.predictions, axis=-1)
        y_true = preds_output.label_ids
        acc = round(accuracy_score(y_true, y_pred) * 100, 1)
        f1  = round(f1_score(y_true, y_pred, average="macro", zero_division=0) * 100, 1)

        # Check if training was stopped before saving
        if stop_training["requested"]:
            training_status.update({
                "is_training":  False,
                "progress":     "stopped",
                "last_accuracy": "Training stopped by user — previous model weights retained",
                "records_trained_on": 0,
            })
            stop_training["requested"] = False
            stop_training["hard_stop"] = False
            print("Training stopped by user. Reverting to previous weights.")

            # Reload the ORIGINAL model (from backup if exists, else from current)
            import app.ml.scanner as scanner_module
            del scanner_module.model
            del scanner_module.tokenizer
            import gc
            gc.collect()

            restore_path = BACKUP_PATH if os.path.exists(f"{BACKUP_PATH}/config.json") else MODEL_PATH
            scanner_module.tokenizer = AutoTokenizer.from_pretrained(restore_path)
            scanner_module.model     = AutoModelForSequenceClassification.from_pretrained(restore_path)
            scanner_module.model.eval()
            print(f"Reverted to weights from: {restore_path}")
            return  # Don't save new weights

        training_status["progress"] = "Saving model..."
        TEMP_PATH   = "models/scam-detector-new"
        BACKUP_PATH = "models/scam-detector-backup"
        os.makedirs(TEMP_PATH, exist_ok=True)
        trainer.save_model(TEMP_PATH)
        tokenizer.save_pretrained(TEMP_PATH)

        import app.ml.scanner as scanner_module
        del scanner_module.model
        del scanner_module.tokenizer
        import gc
        gc.collect()

        if os.path.exists(BACKUP_PATH):
            shutil.rmtree(BACKUP_PATH)
        if os.path.exists(MODEL_PATH):
            shutil.move(MODEL_PATH, BACKUP_PATH)
        shutil.move(TEMP_PATH, MODEL_PATH)

        scanner_module.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        scanner_module.model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        scanner_module.model.eval()
        
        if USE_GPU:
            scanner_module.model = scanner_module.model.cuda()

        from datetime import datetime
        training_status.update({
            "is_training":        False,
            "progress":           "completed",
            "last_trained":       datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
            "last_accuracy":      f"Accuracy: {acc}% | F1: {f1}%",
            "records_trained_on": len(train_df),
        })

    except Exception as e:
        training_status.update({
            "is_training": False,
            "progress":    f"failed: {str(e)}",
        })
        print(f"Retraining error: {e}")


@router.post("/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _:    dict       = Depends(require_admin),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if training_status["is_training"]:
        raise HTTPException(
            status_code=409,
            detail="Training already in progress. Please wait."
        )

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ["csv", "json", "txt"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Use CSV, JSON, or TXT"
        )

    contents = await file.read()

    try:
        if ext == "csv":
            df = pd.read_csv(io.StringIO(contents.decode("utf-8", errors="ignore")))
        elif ext == "json":
            data = json.loads(contents)
            df   = pd.DataFrame(data if isinstance(data, list) else [data])
        else:
            lines = contents.decode("utf-8", errors="ignore").strip().split("\n")
            df    = pd.DataFrame({
                "message": lines,
                "label":   ["unknown"] * len(lines)
            })

        # Normalize columns
        col_map = {}
        for col in df.columns:
            cl = col.lower()
            if cl in ["message", "text", "sms", "body", "content"]:
                col_map[col] = "message"
            elif cl in ["label", "class", "spam", "category", "type", "target"]:
                col_map[col] = "label"

        df = df.rename(columns=col_map)

        if "message" not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="File must have a 'message' or 'text' column"
            )

        if "label" not in df.columns:
            df["label"] = "unknown"

        df = df.dropna(subset=["message"])
        df["message"] = df["message"].astype(str).str.strip()
        df = df[df["message"].str.len() > 5]

        records = df[["message", "label"]].head(5000).to_dict("records")

        if len(records) < 5:
            raise HTTPException(
                status_code=400,
                detail="File has fewer than 5 valid records"
            )

        # Start background retraining
        background_tasks.add_task(retrain_model_background, records)
        training_status["progress"]    = "queued"
        training_status["is_training"] = True

        return {
            "message":  f"Retraining started on {len(records)} records",
            "records":  len(records),
            "filename": file.filename,
            "status":   "training_started",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


@router.get("/training-status")
def get_training_status(_: dict = Depends(require_admin)):
    return training_status


@router.get("/info")
def dataset_info(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    from app.models.scan import Scan
    total = db.query(Scan).count()
    high  = db.query(Scan).filter(Scan.risk_level.in_(["HIGH", "CRITICAL"])).count()
    low   = db.query(Scan).filter(Scan.risk_level.in_(["LOW", "MEDIUM"])).count()
    return {
        "total_records":    total,
        "scam_records":     high,
        "legit_records":    low,
        "training_status":  training_status,
    }

@router.post("/stop-training")
def stop_training_endpoint(_: dict = Depends(require_admin)):
    if not training_status["is_training"]:
        raise HTTPException(status_code=400, detail="No training in progress")
    stop_training["requested"] = True
    stop_training["hard_stop"] = True
    training_status["progress"] = "Stopping training..."
    return {"message": "Stop requested. Reverting to previous weights after current step."}
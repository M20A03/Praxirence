"""
Praxirence Care-Plan LLM Fine-Tuning Script (QLoRA / 4-bit)
Fine-tunes Mistral-7B or Llama-3-8B on Google Colab T4 GPU (16GB VRAM)
using 4-bit NormalFloat quantization (bitsandbytes) and TRL SFTTrainer.
Saves fine-tuned QLoRA adapter to models/careplan_adapter/.
"""

import os
import json
import logging
import argparse
import torch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.train_llm")

DEFAULT_BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"
DEFAULT_DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "dataset")
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "careplan_adapter")


def load_jsonl_dataset(jsonl_path: str):
    """Loads JSONL instruction dataset into Hugging Face Dataset format"""
    from datasets import Dataset
    data = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    return Dataset.from_list(data)


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Care-Plan 7B LLM with QLoRA on Colab T4")
    parser.add_argument("--base_model", type=str, default=DEFAULT_BASE_MODEL)
    parser.add_argument("--dataset_dir", type=str, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--output_dir", type=str, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--batch_size", type=int, default=1)
    parser.add_argument("--grad_accum", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=1024)
    args = parser.parse_args()

    train_file = os.path.join(args.dataset_dir, "train.jsonl")
    val_file = os.path.join(args.dataset_dir, "val.jsonl")

    if not os.path.exists(train_file):
        logger.error(f"Train dataset not found at {train_file}. Run preprocess_text.py first.")
        return

    os.makedirs(args.output_dir, exist_ok=True)
    is_cuda = torch.cuda.is_available()
    logger.info(f"Targeting device: {'CUDA GPU (T4 16GB)' if is_cuda else 'CPU'}")

    try:
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            TrainingArguments,
            BitsAndBytesConfig
        )
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer
    except ImportError:
        logger.error("transformers, peft, bitsandbytes, and trl required. Install from ml_pipeline/requirements.txt")
        return

    # 1. Configure 4-bit quantization (QLoRA)
    bnb_config = None
    if is_cuda:
        logger.info("Configuring 4-bit NormalFloat (NF4) BitsAndBytes quantization...")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

    # 2. Load Tokenizer
    logger.info(f"Loading tokenizer: {args.base_model}...")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. Load Base Model in 4-bit
    logger.info(f"Loading base LLM: {args.base_model}...")
    model_kwargs = {
        "device_map": "auto" if is_cuda else None,
        "quantization_config": bnb_config,
        "torch_dtype": torch.float16 if is_cuda else torch.float32,
    }
    # If on CPU, omit quantization
    if not is_cuda:
        model_kwargs.pop("quantization_config")
        model_kwargs.pop("device_map")

    model = AutoModelForCausalLM.from_pretrained(args.base_model, **model_kwargs)

    if is_cuda:
        model = prepare_model_for_kbit_training(model)

    # 4. LoRA Configuration targeting all attention & MLP projection layers
    logger.info("Configuring QLoRA adapter layers...")
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. Load Datasets
    train_dataset = load_jsonl_dataset(train_file)
    val_dataset = load_jsonl_dataset(val_file) if os.path.exists(val_file) else None

    # 6. Training Arguments optimized for Google Colab T4 16GB
    training_args = TrainingArguments(
        output_dir=os.path.join(args.output_dir, "checkpoints"),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        logging_steps=5,
        num_train_epochs=args.epochs,
        fp16=is_cuda,
        optim="paged_adamw_8bit" if is_cuda else "adamw_torch",
        save_strategy="no",
        report_to="none"
    )

    # 7. SFTTrainer
    logger.info("Initializing SFTTrainer...")
    sft_kwargs = dict(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        peft_config=peft_config,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        args=training_args,
    )
    try:
        trainer = SFTTrainer(processing_class=tokenizer, **sft_kwargs)
    except TypeError:
        trainer = SFTTrainer(tokenizer=tokenizer, **sft_kwargs)

    logger.info("Starting SFT fine-tuning run...")
    trainer.train()

    # 8. Save adapter and tokenizer
    logger.info(f"Saving fine-tuned QLoRA adapter to: {args.output_dir}")
    trainer.model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    # Save adapter metadata
    meta = {
        "base_model": args.base_model,
        "quantization": "4-bit NF4",
        "lora_r": 16,
        "lora_alpha": 32,
        "task": "clinical_care_plan_extraction"
    }
    with open(os.path.join(args.output_dir, "praxirence_adapter_config.json"), "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("Care-Plan LLM fine-tuning finished successfully!")


if __name__ == "__main__":
    main()

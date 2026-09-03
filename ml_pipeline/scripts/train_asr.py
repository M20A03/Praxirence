"""
Praxirence Whisper ASR Fine-Tuning Script (LoRA / PEFT)
Optimized for Google Colab T4 GPU (16GB VRAM) with FP16 and Seq2SeqTrainer.
Saves fine-tuned LoRA adapter to models/asr_adapter/.
"""

import os
import json
import logging
import argparse
import torch
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.train_asr")

DEFAULT_MODEL_NAME = "openai/whisper-small"
DEFAULT_METADATA = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "metadata.json")
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "asr_adapter")


def build_whisper_dataset(metadata_path: str, processor):
    """Loads audio files and transcripts, converting them into Whisper features and tokens"""
    import wave
    import struct

    with open(metadata_path, "r") as f:
        items = json.load(f)

    dataset_samples = []
    for item in items:
        audio_path = item.get("processed_audio_path") or item.get("audio_path")
        transcript = item.get("transcript", "")
        if not os.path.exists(audio_path):
            continue

        with wave.open(audio_path, "r") as wf:
            num_frames = wf.getnframes()
            raw_bytes = wf.readframes(num_frames)
            num_channels = wf.getnchannels()
            integers = struct.unpack(f"<{num_frames * num_channels}h", raw_bytes)
            # Take mono
            mono = [integers[i] / 32768.0 for i in range(0, len(integers), num_channels)]

        # Extract log-mel spectrogram features (30 sec max)
        input_features = processor.feature_extractor(mono, sampling_rate=16000).input_features[0]
        # Tokenize label transcript
        labels = processor.tokenizer(transcript).input_ids

        dataset_samples.append({
            "input_features": input_features,
            "labels": labels
        })

    logger.info(f"Loaded {len(dataset_samples)} audio-transcript pairs for ASR training.")
    return dataset_samples


class AudioDataset(torch.utils.data.Dataset):
    def __init__(self, samples: List[Dict[str, Any]]):
        self.samples = samples

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return {
            "input_features": torch.tensor(self.samples[idx]["input_features"], dtype=torch.float32),
            "labels": torch.tensor(self.samples[idx]["labels"], dtype=torch.long)
        }


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Whisper with LoRA on Colab T4 GPU")
    parser.add_argument("--base_model", type=str, default=DEFAULT_MODEL_NAME)
    parser.add_argument("--metadata", type=str, default=DEFAULT_METADATA)
    parser.add_argument("--output_dir", type=str, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    args = parser.parse_args()

    # Verify metadata exists
    if not os.path.exists(args.metadata):
        raw_meta = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "metadata.json")
        if os.path.exists(raw_meta):
            args.metadata = raw_meta
        else:
            logger.error(f"Metadata not found. Run data_fetch.py first.")
            return

    os.makedirs(args.output_dir, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    use_fp16 = torch.cuda.is_available()
    logger.info(f"Initializing ASR Training on device: {device.upper()} (FP16: {use_fp16})")

    try:
        from transformers import (
            WhisperForConditionalGeneration,
            WhisperProcessor,
            Seq2SeqTrainingArguments,
            Seq2SeqTrainer
        )
        from peft import LoraConfig, get_peft_model, TaskType
    except ImportError:
        logger.error("transformers and peft required. Install from ml_pipeline/requirements.txt")
        return

    logger.info(f"Loading Whisper processor and base model: {args.base_model}...")
    processor = WhisperProcessor.from_pretrained(args.base_model, language="english", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(
        args.base_model,
        torch_dtype=torch.float16 if use_fp16 else torch.float32,
    )

    # Freeze base parameters
    model.freeze_encoder()
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    # Configure LoRA for Whisper decoder & attention
    logger.info("Configuring LoRA adapter for Whisper...")
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Prepare dataset
    samples = build_whisper_dataset(args.metadata, processor)
    if not samples:
        logger.error("No valid dataset samples found.")
        return
    train_dataset = AudioDataset(samples)

    class DataCollatorSpeechSeq2Seq:
        def __call__(self, features):
            input_features = [f["input_features"] for f in features]
            label_features = [f["labels"] for f in features]

            batch = {
                "input_features": torch.stack(input_features)
            }
            # Pad labels
            max_label_len = max(len(l) for l in label_features)
            padded_labels = []
            for l in label_features:
                remainder = [ -100 ] * (max_label_len - len(l))
                padded_labels.append(torch.cat([l, torch.tensor(remainder, dtype=torch.long)]))
            batch["labels"] = torch.stack(padded_labels)
            return batch

    training_args = Seq2SeqTrainingArguments(
        output_dir=os.path.join(args.output_dir, "checkpoints"),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=2,
        learning_rate=args.lr,
        warmup_steps=10,
        num_train_epochs=args.epochs,
        fp16=use_fp16,
        logging_steps=5,
        save_strategy="no",
        report_to="none"
    )

    trainer_kwargs = dict(
        args=training_args,
        model=model,
        train_dataset=train_dataset,
        data_collator=DataCollatorSpeechSeq2Seq(),
    )
    try:
        trainer = Seq2SeqTrainer(processing_class=processor.feature_extractor, **trainer_kwargs)
    except TypeError:
        try:
            trainer = Seq2SeqTrainer(tokenizer=processor.feature_extractor, **trainer_kwargs)
        except TypeError:
            trainer = Seq2SeqTrainer(**trainer_kwargs)

    logger.info("Starting Seq2SeqTrainer for Whisper LoRA...")
    trainer.train()

    logger.info(f"Saving fine-tuned ASR LoRA adapter to: {args.output_dir}")
    model.save_pretrained(args.output_dir)
    processor.save_pretrained(args.output_dir)
    logger.info("ASR training completed successfully!")


if __name__ == "__main__":
    main()

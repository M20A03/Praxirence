"""
Configuration for Fine-Tuned Whisper ASR and Care-Plan LLM
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "..", "ml_pipeline", "models")

# Whisper ASR Configuration
WHISPER_BASE_MODEL = os.getenv("WHISPER_BASE_MODEL", "openai/whisper-small")
WHISPER_ADAPTER_DIR = os.getenv("WHISPER_ADAPTER_DIR", os.path.join(MODELS_DIR, "asr_adapter"))
SAMPLE_RATE = 16000

# Care-Plan LLM Configuration
LLM_BASE_MODEL = os.getenv("LLM_BASE_MODEL", "mistralai/Mistral-7B-Instruct-v0.2")
LLM_ADAPTER_DIR = os.getenv("LLM_ADAPTER_DIR", os.path.join(MODELS_DIR, "careplan_adapter"))
MAX_NEW_TOKENS = 512
TEMPERATURE = 0.1

try:
    import torch
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    USE_4BIT_QUANTIZATION = torch.cuda.is_available()
except ImportError:
    torch = None
    DEVICE = "cpu"
    USE_4BIT_QUANTIZATION = False

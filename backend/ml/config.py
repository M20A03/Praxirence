"""
Praxirence Modern Clinical ML Configuration
Configured for Whisper-Large-v3-Turbo, Faster-Whisper int8/float16 quantization,
and Dual-Tier LLM Architecture (Gemini 2.5/2.0 Flash Cloud + 4-bit BioMistral Edge).
"""

import os
from typing import Any, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "..", "ml_pipeline", "models")

# Whisper ASR Configuration (Whisper-Large-v3-Turbo with CTranslate2 / Faster-Whisper)
WHISPER_BASE_MODEL = os.getenv("WHISPER_BASE_MODEL", "openai/whisper-large-v3-turbo")
WHISPER_FALLBACK_MODEL = os.getenv("WHISPER_FALLBACK_MODEL", "openai/whisper-small")
WHISPER_ADAPTER_DIR = os.getenv("WHISPER_ADAPTER_DIR", os.path.join(MODELS_DIR, "asr_adapter"))
SAMPLE_RATE = 16000

# Whisper Beam Search, Temperature Fallback & VAD
WHISPER_TEMPERATURES: List[float] = [0.0, 0.2, 0.4, 0.6]
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "2"))
WHISPER_REPETITION_PENALTY = float(os.getenv("WHISPER_REPETITION_PENALTY", "1.2"))
WHISPER_VAD_MIN_SILENCE_MS = 500
WHISPER_VAD_THRESHOLD = 0.45

# Care-Plan LLM Configuration (BioMistral-7B / Mistral-NeMo Edge & QLoRA)
LLM_BASE_MODEL = os.getenv("LLM_BASE_MODEL", "BioMistral/BioMistral-7B")
LLM_ADAPTER_DIR = os.getenv("LLM_ADAPTER_DIR", os.path.join(MODELS_DIR, "careplan_adapter"))
EDGE_GGUF_MODEL_PATH = os.getenv("EDGE_GGUF_MODEL_PATH", os.path.join(MODELS_DIR, "biomistral-7b-q4_k_m.gguf"))
MAX_NEW_TOKENS = 4096
TEMPERATURE = 0.1

torch: Any = None
try:
    import torch  # type: ignore
    DEVICE = "cuda" if (torch and hasattr(torch, "cuda") and torch.cuda.is_available()) else "cpu"
    USE_4BIT_QUANTIZATION = bool(torch and hasattr(torch, "cuda") and torch.cuda.is_available())
except (ImportError, Exception):
    torch = None
    DEVICE = "cpu"
    USE_4BIT_QUANTIZATION = False

# Faster-Whisper Compute Type
if DEVICE == "cuda":
    FASTER_WHISPER_COMPUTE_TYPE = "float16"
else:
    FASTER_WHISPER_COMPUTE_TYPE = "int8"

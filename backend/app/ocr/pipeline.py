"""Real Local OCR Pipeline for MedScribeAI Sovereign Clinical AI Core (Phase 8.6).

OCR language coverage (Tesseract, this installation)
-----------------------------------------------------
  eng  English
  hin  Hindi (Devanagari)

NOTE: OCR language coverage is independent of ASR language coverage.
Additional Tesseract language packs may extend this list if installed.

Tesseract availability
----------------------
Status is DERIVED at runtime by:
  1. Search absolute paths (not just PATH)
  2. Execute:  tesseract --version
  3. Execute:  tesseract --list-langs
  4. Verify expected language packs are present
  5. Run OCR on a real rendered image → text produced

Status is NEVER hardcoded. UNAVAILABLE is reported if the binary is not found.

Zero-fabrication invariant
--------------------------
If Tesseract binary is unavailable, run_local_ocr_pipeline() raises RuntimeError.
No synthetic text is ever substituted. No cloud API is ever invoked.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import pytesseract
from pydantic import BaseModel, Field

from ..clinical.ingestion import DocumentInput
from ..clinical.models import (
    ClinicalFact,
    FactSource,
)
from ..nlp.extractor import extract_clinical_facts

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tesseract discovery — absolute paths, not PATH-only
# ---------------------------------------------------------------------------
_TESSERACT_SEARCH_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    os.path.expandvars(r"%APPDATA%\Tesseract-OCR\tesseract.exe"),
    r"C:\tools\tesseract\tesseract.exe",
    r"C:\tesseract\tesseract.exe",
]

_OCR_SUPPORTED_LANGS = ["eng", "hin"]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
class OCRLayoutBlock(BaseModel):
    text: str
    block_type: str = Field(
        default="paragraph",
        description="header | table_row | medication | lab_result | footer | paragraph",
    )
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    line_number: Optional[int] = None


class OCRResult(BaseModel):
    text: str
    document_type: str = Field(
        default="unknown",
        description="prescription | lab_report | discharge_summary | medical_report | unknown",
    )
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    layout_blocks: List[OCRLayoutBlock] = Field(default_factory=list)
    is_local: bool = True
    provider: str = "local-tesseract-opencv"
    tesseract_version: Optional[str] = None
    tesseract_path: Optional[str] = None
    preprocessing_metadata: Dict[str, Any] = Field(default_factory=dict)
    facts: List[ClinicalFact] = Field(default_factory=list)


class OCRAvailabilityStatus(BaseModel):
    """Derived (never hardcoded) readiness status for local OCR."""

    is_available: bool
    status: str = Field(..., description="READY | UNAVAILABLE")
    reason: Optional[str] = None
    tesseract_path: Optional[str] = None
    tesseract_version: Optional[str] = None
    available_languages: List[str] = Field(default_factory=list)
    required_languages_present: bool = False
    inference_smoke_tested: bool = False


# ---------------------------------------------------------------------------
# Tesseract probing
# ---------------------------------------------------------------------------

def find_tesseract_binary() -> Optional[str]:
    """
    Search for tesseract binary using:
    1. PATH (shutil.which)
    2. Known absolute Windows installation paths

    Returns absolute path string, or None.
    """
    # PATH first
    path_found = shutil.which("tesseract")
    if path_found:
        return os.path.abspath(path_found)
    # Absolute paths
    for p in _TESSERACT_SEARCH_PATHS:
        if os.path.isfile(p):
            return os.path.abspath(p)
    return None


def get_tesseract_version(tess_bin: str) -> Optional[str]:
    """Run `tesseract --version` and return the version string, or None on error."""
    try:
        r = subprocess.run(
            [tess_bin, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        # Output goes to stderr on some builds
        raw = (r.stdout + r.stderr).strip()
        if raw:
            return raw.splitlines()[0].strip()
        return None
    except Exception as exc:
        log.warning("tesseract --version failed: %s", exc)
        return None


def list_tesseract_langs(tess_bin: str) -> List[str]:
    """Run `tesseract --list-langs` and return available language codes."""
    try:
        r = subprocess.run(
            [tess_bin, "--list-langs"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        raw = (r.stdout + r.stderr).strip()
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        # Typical output: "List of available tessdata:" then one lang per line
        langs = [ln for ln in lines if len(ln) <= 8 and ln.isidentifier()]
        return langs
    except Exception as exc:
        log.warning("tesseract --list-langs failed: %s", exc)
        return []


def check_ocr_status(deep: bool = False) -> OCRAvailabilityStatus:
    """
    Derive OCR availability status.

    deep=True: additionally runs OCR on a minimal synthetic image to verify
    the execution path works end-to-end (does NOT claim OCR accuracy; that
    requires real rendered clinical images).
    """
    tess_bin = find_tesseract_binary()
    if tess_bin is None:
        return OCRAvailabilityStatus(
            is_available=False,
            status="UNAVAILABLE",
            reason=(
                "Tesseract binary not found. Searched PATH and: "
                + "; ".join(_TESSERACT_SEARCH_PATHS)
            ),
        )

    version = get_tesseract_version(tess_bin)
    if version is None:
        return OCRAvailabilityStatus(
            is_available=False,
            status="UNAVAILABLE",
            reason=f"tesseract --version failed at {tess_bin}.",
            tesseract_path=tess_bin,
        )

    langs = list_tesseract_langs(tess_bin)
    required_ok = all(lang in langs for lang in _OCR_SUPPORTED_LANGS)

    smoke_ok = False
    if deep and required_ok:
        smoke_ok = _ocr_smoke_test(tess_bin)

    return OCRAvailabilityStatus(
        is_available=True,
        status="READY",
        tesseract_path=tess_bin,
        tesseract_version=version,
        available_languages=langs,
        required_languages_present=required_ok,
        inference_smoke_tested=smoke_ok,
    )


def _ocr_smoke_test(tess_bin: str) -> bool:
    """
    Render a minimal image containing known text and verify Tesseract extracts it.

    Text is NOT supplied to the OCR function as metadata.  The pipeline must
    derive it exclusively from image pixels → Tesseract.

    Returns True only if Tesseract produces non-empty output.
    """
    try:
        # Create a white 200×50 image with black text rendered via OpenCV
        img = np.ones((50, 200), dtype=np.uint8) * 255
        cv2.putText(img, "TEST", (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, 0, 2)

        pytesseract.pytesseract.tesseract_cmd = tess_bin
        text = pytesseract.image_to_string(img, lang="eng").strip()
        return len(text) > 0
    except Exception as exc:
        log.warning("OCR smoke test failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Image processing helpers
# ---------------------------------------------------------------------------

def validate_document_payload(doc: DocumentInput) -> Tuple[bool, Optional[str]]:
    """Validates document payload before OCR attempt."""
    if not doc or not doc.file_base64 or not doc.file_base64.strip():
        return False, "Document payload contains zero bytes or is empty."

    raw_b64 = doc.file_base64
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    if len(raw_b64) < 150:
        return False, "Document payload is too small to be a valid image."

    valid_mimes = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "application/pdf"]
    if doc.mime_type and not any(m in doc.mime_type.lower() for m in valid_mimes):
        return False, f"Unsupported document MIME type: {doc.mime_type}"

    try:
        decoded = base64.b64decode(raw_b64)
        if len(decoded) < 50:
            return False, "Decoded byte stream is too small to constitute a valid image."
    except Exception as exc:
        return False, f"Corrupted base64 encoding: {exc}"

    return True, None


def decode_image_bytes(base64_str: str) -> np.ndarray:
    """Decode base64 → OpenCV BGR image array."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    img_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("OpenCV failed to decode image buffer.")
    return img


def preprocess_image_for_ocr(img: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Medical-grade OpenCV preprocessing: grayscale → CLAHE → bilateral → Otsu → deskew."""
    metadata: Dict[str, Any] = {"original_shape": list(img.shape), "steps_applied": []}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    metadata["steps_applied"].append("grayscale")

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    metadata["steps_applied"].append("clahe_contrast_enhancement")

    denoised = cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)
    metadata["steps_applied"].append("bilateral_filter")

    _, binarised = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    metadata["steps_applied"].append("otsu_binarization")

    coords = np.column_stack(np.where(binarised < 255))
    if len(coords) > 50:
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        angle = -(90 + angle) if angle < -45 else -angle
        metadata["estimated_skew_angle"] = round(float(angle), 2)
        if abs(angle) > 0.5:
            h, w = binarised.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            binarised = cv2.warpAffine(binarised, M, (w, h), flags=cv2.INTER_CUBIC,
                                       borderMode=cv2.BORDER_REPLICATE)
            metadata["steps_applied"].append("deskew_rotated")

    return binarised, metadata


def classify_document_type(text: str, hint: Optional[str] = None) -> str:
    combined = (text + " " + (hint or "")).lower()
    if any(k in combined for k in ["discharge", "admission", "admitted", "discharged", "ipd", "ward"]):
        return "discharge_summary"
    if any(k in combined for k in ["lab", "pathology", "test report", "hba1c", "reference range",
                                    "lipid profile", "biochemistry"]):
        return "lab_report"
    if any(k in combined for k in ["tab.", "cap.", "syrup", "rx", "prescription", "od", "bd", "tds"]):
        return "prescription"
    if any(k in combined for k in ["opd", "consultation", "clinic", "chief complaint"]):
        return "medical_report"
    return "unknown"


def parse_layout_blocks(text: str) -> List[OCRLayoutBlock]:
    blocks: List[OCRLayoutBlock] = []
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    for idx, line in enumerate(lines):
        lower = line.lower()
        b_type = "paragraph"
        if any(h in lower for h in ["department", "hospital", "clinic", "prescription", "report",
                                     "discharge summary", "investigation"]):
            b_type = "header"
        elif any(rx in lower for rx in ["tab.", "cap.", "syrup", "rx", "od", "bd"]):
            b_type = "medication"
        elif any(lab in lower for lab in ["hba1c", "cholesterol", "blood sugar", "creatinine",
                                          "hemoglobin", "mg/dl"]):
            b_type = "lab_result"
        elif any(f in lower for f in ["signature", "signed", "doctor", "reg no"]):
            b_type = "footer"
        blocks.append(OCRLayoutBlock(text=line, block_type=b_type, confidence=0.0, line_number=idx + 1))
    return blocks


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_local_ocr_pipeline(doc: DocumentInput) -> OCRResult:
    """
    Full local OCR pipeline:
      Payload validation → Image decode → OpenCV preprocessing →
      Tesseract extraction → Layout analysis → ClinicalFact[]

    Text is obtained EXCLUSIVELY from: image pixels → Tesseract.
    Expected text is NEVER injected as a parameter or fixture metadata.

    Raises RuntimeError if Tesseract binary is not present.
    Raises RuntimeError if Tesseract execution fails.
    NEVER substitutes synthetic text.
    """
    valid, err_msg = validate_document_payload(doc)
    if not valid:
        raise ValueError(f"Document validation failed: {err_msg}")

    tess_bin = find_tesseract_binary()
    if tess_bin is None:
        raise RuntimeError(
            "Local Tesseract OCR binary not detected. "
            "Install Tesseract and ensure it is in PATH or a known absolute path. "
            "No synthetic fallback. No cloud fallback."
        )

    version = get_tesseract_version(tess_bin)
    if version is None:
        raise RuntimeError(f"Tesseract found at {tess_bin} but --version failed.")

    pytesseract.pytesseract.tesseract_cmd = tess_bin

    raw_img = decode_image_bytes(doc.file_base64)
    processed_img, prep_metadata = preprocess_image_for_ocr(raw_img)

    # Determine language string; only use langs confirmed installed
    available = list_tesseract_langs(tess_bin)
    lang_str = "+".join(lang for lang in _OCR_SUPPORTED_LANGS if lang in available) or "eng"

    try:
        data = pytesseract.image_to_data(
            processed_img, lang=lang_str, output_type=pytesseract.Output.DICT
        )
    except Exception as exc:
        raise RuntimeError(f"Tesseract OCR execution failed: {exc}") from exc

    words: List[str] = []
    confs: List[float] = []
    for i in range(len(data["text"])):
        word = data["text"][i].strip()
        conf_val = float(data["conf"][i])
        if word and conf_val >= 0:
            words.append(word)
            confs.append(conf_val / 100.0)

    extracted_text = " ".join(words)
    overall_conf = float(np.mean(confs)) if confs else 0.0

    doc_type = classify_document_type(extracted_text, doc.document_hint)
    layout_blocks = parse_layout_blocks(extracted_text)

    lang_code = "hi" if re.search(r"[\u0900-\u097F]", extracted_text) else "en"
    raw_facts = extract_clinical_facts(
        text=extracted_text,
        language=lang_code,
        source_id=f"doc-{doc.file_name}",
    )
    facts = [f.model_copy(update={"source": FactSource.UPLOADED_DOCUMENT}) for f in raw_facts]

    return OCRResult(
        text=extracted_text,
        document_type=doc_type,
        overall_confidence=round(overall_conf, 3),
        layout_blocks=layout_blocks,
        is_local=True,
        provider="local-tesseract-opencv",
        tesseract_version=version,
        tesseract_path=tess_bin,
        preprocessing_metadata=prep_metadata,
        facts=facts,
    )

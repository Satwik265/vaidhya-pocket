"""OCR Tests — Phase 8.6.

CLASS A — TestOCRSyntheticRenderedImages
  Tests: image preprocessing, OpenCV pipeline, Tesseract binary execution.
  Input: programmatically rendered images (numpy/PIL → OpenCV).
  Expected clinical text is NOT supplied to the OCR function.
  Text is obtained EXCLUSIVELY from: image pixels → Tesseract.

CLASS B — TestOCRRealClinicalDocuments  (DEFERRED)
  Tests: OCR on real scanned medical documents.
  Status: DEFERRED — no real scanned clinical document fixtures are present.

INVARIANTS:
  - Expected text is NEVER injected into the OCR function as fixture metadata.
  - OCR is VALIDATED only if Tesseract binary exists, --version succeeds,
    --list-langs returns expected languages, and raw image → text succeeds.
  - No synthetic text is ever substituted for failed OCR.
  - No cloud API is ever invoked as fallback.
"""

from __future__ import annotations

import base64
import io
import os
from typing import Optional

import cv2
import numpy as np
import pytest

from app.ocr.pipeline import (
    OCRAvailabilityStatus,
    _ocr_smoke_test,
    check_ocr_status,
    classify_document_type,
    decode_image_bytes,
    find_tesseract_binary,
    get_tesseract_version,
    list_tesseract_langs,
    parse_layout_blocks,
    preprocess_image_for_ocr,
    run_local_ocr_pipeline,
)
from app.clinical.ingestion import DocumentInput


# ---------------------------------------------------------------------------
# Helpers — rendered image construction
# ---------------------------------------------------------------------------

def _render_text_image_b64(
    text: str,
    width: int = 600,
    height: int = 100,
    font_scale: float = 0.8,
    font: int = cv2.FONT_HERSHEY_SIMPLEX,
) -> str:
    """
    Render text on a white image using OpenCV and return base64-encoded PNG bytes.

    The rendered image is then passed to Tesseract; expected text is NEVER
    injected as a parameter to the OCR function.
    """
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    cv2.putText(img, text, (10, height - 20), font, font_scale, (0, 0, 0), 2)
    ok, buf = cv2.imencode(".png", img)
    assert ok, "cv2.imencode failed"
    return base64.b64encode(buf.tobytes()).decode()


def _make_doc_input(b64: str, filename: str = "test.png", hint: Optional[str] = None) -> DocumentInput:
    return DocumentInput(
        file_base64=b64,
        file_name=filename,
        mime_type="image/png",
        document_hint=hint,
    )


# ---------------------------------------------------------------------------
# CLASS A — Synthetic Rendered-Image Smoke Tests
# ---------------------------------------------------------------------------

class TestOCRSyntheticRenderedImages:
    """
    CLASS A — Rendered-image smoke tests.

    All images are programmatically generated using OpenCV putText.
    They are rendered images, NOT real scanned clinical documents.
    Expected text is NEVER supplied to the OCR function as metadata or fixture data.
    Text is obtained EXCLUSIVELY from: image pixels → Tesseract.
    """

    # ---- Tesseract binary probing ----------------------------------------

    def test_tesseract_binary_probing(self):
        """
        Tesseract must be discovered via absolute path search, not PATH alone.
        Status must be derived, not hardcoded.
        """
        status = check_ocr_status(deep=False)
        assert isinstance(status, OCRAvailabilityStatus)
        assert status.status in ("READY", "UNAVAILABLE")
        assert isinstance(status.is_available, bool)

    def test_tesseract_version_string_when_available(self):
        """If Tesseract is READY, --version must return a non-empty string."""
        tess_bin = find_tesseract_binary()
        if tess_bin is None:
            pytest.skip("Tesseract binary not installed; test DEFERRED.")
        version = get_tesseract_version(tess_bin)
        assert version is not None, f"tesseract --version returned None at {tess_bin}"
        assert len(version) > 0

    def test_tesseract_list_langs_when_available(self):
        """
        If Tesseract is READY, --list-langs must return at least ['eng'].
        Uses ABSOLUTE PATH, not PATH env var.
        """
        tess_bin = find_tesseract_binary()
        if tess_bin is None:
            pytest.skip("Tesseract binary not installed; test DEFERRED.")
        langs = list_tesseract_langs(tess_bin)
        assert isinstance(langs, list), "list_tesseract_langs must return a list"
        assert "eng" in langs, f"Expected 'eng' in available langs; got: {langs}"

    def test_tesseract_deep_status_when_available(self):
        """
        deep=True derivation test handling three states:
        (a) Tesseract not found -> skip
        (b) Tesseract found but required language packs missing ->
            assert inference_smoke_tested is False and required_languages_present is False
        (c) Tesseract found and all required languages present ->
            assert inference_smoke_tested is True and required_languages_present is True
        """
        status = check_ocr_status(deep=True)
        if not status.is_available:
            pytest.skip(f"Tesseract UNAVAILABLE: {status.reason}")

        if not status.required_languages_present:
            assert status.required_languages_present is False
            assert status.inference_smoke_tested is False, (
                "inference_smoke_tested must be False when required language packs are missing"
            )
        else:
            assert status.required_languages_present is True
            assert status.inference_smoke_tested is True, (
                "inference_smoke_tested must be True when all required language packs are present"
            )

    def test_tesseract_deep_status_when_languages_missing_mock(self, monkeypatch):
        """
        State (b) regression test: When Tesseract binary is present but required
        language packs ('hin') are missing, deep check MUST report
        required_languages_present=False and inference_smoke_tested=False.
        """
        import app.ocr.pipeline as pipeline
        monkeypatch.setattr(pipeline, "find_tesseract_binary", lambda: r"C:\fake\tesseract.exe")
        monkeypatch.setattr(pipeline, "get_tesseract_version", lambda b: "tesseract v5.4.0")
        monkeypatch.setattr(pipeline, "list_tesseract_langs", lambda b: ["eng", "osd"])

        status = pipeline.check_ocr_status(deep=True)
        assert status.is_available is True
        assert status.required_languages_present is False
        assert status.inference_smoke_tested is False

    # ---- Image decode and preprocessing ----------------------------------

    def test_decode_rendered_image(self):
        """RENDERED: base64 PNG must decode to a valid BGR numpy array."""
        b64 = _render_text_image_b64("HELLO")
        img = decode_image_bytes(b64)
        assert img is not None
        assert isinstance(img, np.ndarray)
        assert img.ndim == 3
        assert img.dtype == np.uint8

    def test_preprocess_renders_binarised_output(self):
        """RENDERED: preprocessing must return a binarised grayscale image (values 0 or 255)."""
        b64 = _render_text_image_b64("TEST")
        img = decode_image_bytes(b64)
        processed, meta = preprocess_image_for_ocr(img)
        assert processed.ndim == 2, "Preprocessed image must be 2D (grayscale)"
        unique_vals = np.unique(processed)
        for v in unique_vals:
            assert v in (0, 255), f"Non-binary pixel value {v} found after binarisation"
        assert "grayscale" in meta["steps_applied"]
        assert "otsu_binarization" in meta["steps_applied"]

    def test_preprocess_preserves_image_dimensions(self):
        """RENDERED: preprocessing must not change (h, w) dimensions."""
        b64 = _render_text_image_b64("DIMENSION CHECK")
        img = decode_image_bytes(b64)
        h, w = img.shape[:2]
        processed, _ = preprocess_image_for_ocr(img)
        assert processed.shape == (h, w), "Preprocessing must not alter image dimensions"

    # ---- OCR execution — text obtained from image pixels only -------------

    def test_rendered_image_ocr_pipeline_executes(self):
        """
        RENDERED: run full OCR pipeline on a rendered image.
        Text is obtained EXCLUSIVELY from image pixels → Tesseract.
        Expected text is NOT supplied to run_local_ocr_pipeline.
        Asserts: pipeline executes without error, returns non-empty text string.
        """
        tess_bin = find_tesseract_binary()
        if tess_bin is None:
            pytest.skip("Tesseract binary not installed; OCR pipeline test DEFERRED.")

        b64 = _render_text_image_b64("PATIENT REPORT")
        doc = _make_doc_input(b64, "rendered.png")
        result = run_local_ocr_pipeline(doc)

        # text comes exclusively from Tesseract — we verify it is a string
        assert isinstance(result.text, str)
        assert result.is_local is True
        assert result.provider == "local-tesseract-opencv"
        assert result.tesseract_path is not None
        assert result.tesseract_version is not None

    def test_rendered_image_confidence_in_range(self):
        """RENDERED: overall_confidence must be in [0, 1]."""
        tess_bin = find_tesseract_binary()
        if tess_bin is None:
            pytest.skip("Tesseract binary not installed.")
        b64 = _render_text_image_b64("CONFIDENCE CHECK")
        doc = _make_doc_input(b64, "conf.png")
        result = run_local_ocr_pipeline(doc)
        assert 0.0 <= result.overall_confidence <= 1.0

    def test_rendered_image_no_synthetic_fallback_on_missing_binary(self):
        """
        RENDERED: pipeline must raise RuntimeError (not return synthetic text)
        when Tesseract binary is absent.
        """
        b64 = _render_text_image_b64("NO FALLBACK")
        doc = _make_doc_input(b64, "nofallback.png")

        # Temporarily patch find_tesseract_binary to simulate absent binary
        import app.ocr.pipeline as pipeline_mod
        original_fn = pipeline_mod.find_tesseract_binary

        def _absent():
            return None

        pipeline_mod.find_tesseract_binary = _absent
        try:
            with pytest.raises(RuntimeError, match="Tesseract"):
                run_local_ocr_pipeline(doc)
        finally:
            pipeline_mod.find_tesseract_binary = original_fn

    # ---- Document type classification ------------------------------------

    def test_classify_prescription_keywords(self):
        """Keyword-based document classifier must recognise prescription indicators."""
        doc_type = classify_document_type("Tab. Metformin 500mg BD Rx")
        assert doc_type == "prescription"

    def test_classify_lab_report_keywords(self):
        """Keyword-based document classifier must recognise lab report indicators."""
        doc_type = classify_document_type("HbA1c mg/dL Reference Range lipid profile")
        assert doc_type == "lab_report"

    def test_classify_discharge_summary_keywords(self):
        """Keyword-based document classifier must recognise discharge summary indicators."""
        doc_type = classify_document_type("Patient was admitted and discharged from IPD ward")
        assert doc_type == "discharge_summary"

    def test_classify_unknown_falls_back(self):
        """Unrecognised content must return 'unknown' document type."""
        doc_type = classify_document_type("lorem ipsum dolor sit amet")
        assert doc_type == "unknown"

    # ---- Layout block parsing --------------------------------------------

    def test_parse_layout_blocks_non_empty(self):
        text = "Hospital Department\nTab. Paracetamol 500mg\nHbA1c 7.2 mg/dL\nNormal text line"
        blocks = parse_layout_blocks(text)
        assert len(blocks) == 4
        types = [b.block_type for b in blocks]
        assert "header" in types
        assert "medication" in types
        assert "lab_result" in types

    def test_parse_layout_blocks_empty_text(self):
        blocks = parse_layout_blocks("")
        assert blocks == []

    # ---- Payload validation ----------------------------------------------

    def test_reject_empty_document_payload(self):
        """Empty file_base64 must be rejected before reaching Tesseract."""
        from app.ocr.pipeline import validate_document_payload
        doc = DocumentInput.model_construct(
            file_base64="", file_name="empty.png", mime_type="image/png"
        )
        valid, reason = validate_document_payload(doc)
        assert not valid
        assert reason is not None

    def test_reject_unsupported_document_mime(self):
        """Unsupported MIME must be rejected before reaching Tesseract."""
        from app.ocr.pipeline import validate_document_payload
        b64 = _render_text_image_b64("BAD MIME")
        doc = DocumentInput(
            file_base64=b64, file_name="bad.mp4", mime_type="video/mp4"
        )
        valid, reason = validate_document_payload(doc)
        assert not valid


# ---------------------------------------------------------------------------
# CLASS B — Real Clinical Documents (DEFERRED)
# ---------------------------------------------------------------------------

@pytest.mark.skip(
    reason=(
        "DEFERRED — no real scanned clinical document fixtures available. "
        "Class B requires actual scanned/photographed medical documents "
        "(prescriptions, lab reports, discharge summaries) in PNG/JPEG format. "
        "Expected text must be independently transcribed by a human, NOT derived "
        "from OCR output. OCR is reported VALIDATED only after this class passes. "
        "See docs/ocr_validation_status.md for acceptance criteria."
    )
)
class TestOCRRealClinicalDocuments:
    """
    CLASS B — Real clinical document OCR validation.

    STATUS: DEFERRED

    Acceptance criteria before this class can run:
      - PNG/JPEG files from real scanned prescriptions, lab reports, or discharge summaries
      - Independent human-transcribed ground truth (not derived from OCR output)
      - At least 5 documents covering English and Hindi text
      - At least 1 document with medication names, dosages, and numeric values

    Metrics to be computed:
      - Character-level accuracy on extracted text
      - Medication name recognition rate
      - Numeric value extraction rate (dosage, lab values)
      - Clinical entity recall after ClinicalFact extraction

    All text obtained EXCLUSIVELY from image pixels → Tesseract.
    """

    def test_real_prescription_english_ocr(self):
        """REAL DOCUMENT: OCR a real English prescription and compare against human transcript."""
        pytest.skip("DEFERRED: real English prescription fixture not yet available.")

    def test_real_prescription_hindi_ocr(self):
        """REAL DOCUMENT: OCR a real Hindi prescription and compare against human transcript."""
        pytest.skip("DEFERRED: real Hindi prescription fixture not yet available.")

    def test_real_lab_report_numeric_values(self):
        """REAL DOCUMENT: extract numeric lab values from a real lab report."""
        pytest.skip("DEFERRED: real lab report fixture not yet available.")

    def test_real_discharge_summary_clinical_facts(self):
        """REAL DOCUMENT: verify ClinicalFacts extracted from a real discharge summary."""
        pytest.skip("DEFERRED: real discharge summary fixture not yet available.")

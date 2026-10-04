import pytest
from app.nlp.language_id import (
    identify_clinical_language,
    SupportedClinicalLanguage,
    ScriptCategory,
)


def test_native_devanagari_hindi():
    res = identify_clinical_language("सीने में दर्द हो रहा है और बुखार भी है")
    assert res.language == SupportedClinicalLanguage.HI
    assert res.locale == "hi-IN"
    assert res.script == ScriptCategory.DEVANAGARI
    assert res.confidence >= 0.90


def test_native_devanagari_marathi():
    res = identify_clinical_language("माझ्या पोटात खूप दुखत आहे आणि खूप त्रास होतोय")
    assert res.language == SupportedClinicalLanguage.MR
    assert res.locale == "mr-IN"
    assert res.script == ScriptCategory.DEVANAGARI
    assert res.confidence >= 0.90


def test_native_tamil():
    res = identify_clinical_language("எனக்கு நெஞ்சில் கடுமையான வலி இருக்கிறது")
    assert res.language == SupportedClinicalLanguage.TA
    assert res.locale == "ta-IN"
    assert res.script == ScriptCategory.TAMIL
    assert res.confidence == 0.98


def test_native_gujarati():
    res = identify_clinical_language("મને છાતીમાં ખૂબ દુખાવો થાય છે")
    assert res.language == SupportedClinicalLanguage.GU
    assert res.locale == "gu-IN"
    assert res.script == ScriptCategory.GUJARATI
    assert res.confidence == 0.98


def test_clinical_english():
    res = identify_clinical_language("Patient reports acute fever and severe headache.")
    assert res.language == SupportedClinicalLanguage.EN
    assert res.script == ScriptCategory.LATIN


def test_code_switching_detection():
    res = identify_clinical_language("mujhe chest pain ho raha hai aur breathing problem hai")
    assert res.is_code_switched is True
    assert res.language == SupportedClinicalLanguage.HI

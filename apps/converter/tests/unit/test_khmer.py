from app.khmer import clean_font_name, detect_order, fix_khmer


def test_logical_text_is_unchanged():
    for text in ["សេចក្ដីជូនដំណឹង", "ព្រះរាជាណាចក្រកម្ពុជា", "ខែតុលា ឆ្នាំ២០២៦", "Hello ខ្មែរ"]:
        assert fix_khmer(text) == text


def test_visual_order_is_repaired():
    # text layer as written by Word: pre-base vowels / coeng ro before the consonant
    assert fix_khmer("េសចក្ដីជូនដំណឹង") == "សេចក្ដីជូនដំណឹង"
    assert fix_khmer("្រពះរាជាណាច្រកកម្ពុជា") == "ព្រះរាជាណាចក្រកម្ពុជា"
    assert fix_khmer("ែខតុលា ឆា្នំ") == "ខែតុលា ឆ្នាំ"
    assert fix_khmer("េឈា្មះ") == "ឈ្មោះ"
    assert fix_khmer("ែខ្មរ") == "ខ្មែរ"


def test_detect_order():
    assert detect_order("េសចក្ដី") == "visual"
    assert detect_order("កេ ") == "logical"


def test_font_names():
    assert clean_font_name("BCDEEE+KhmerOSBattambang-Bold") == ("Khmer OS Battambang", True, False)
    assert clean_font_name("ABCDEF+TimesNewRomanPSMT")[0] == "Times New Roman"
    assert clean_font_name("Khmer OS Muol Light")[0] == "Khmer OS Muol Light"
    assert clean_font_name("BCDGEE+KhmerUI")[0] == "Khmer UI"


def test_correct_text_is_never_reordered_even_if_page_looks_visual():
    # text that is already logical (a vowel ends a word) must survive a page-level "visual" hint
    for text in ["សេចក្ដីជូនដំណឹងថ្ងៃ នេះ", "ធ្វើដំណើរទៅ ផ្ទះ", "បានទៅដល់ហើយទេ។"]:
        assert fix_khmer(text, "visual") == text


def test_split_vowels_rebuilt_from_parts():
    # pre-base part + right/top part, as produced by Khmer OS fonts
    assert fix_khmer("េធ្វើ") == "ធ្វើ"
    assert fix_khmer("េទៅ") == "ទៅ"
    assert fix_khmer("េក្រោយ") == "ក្រោយ"

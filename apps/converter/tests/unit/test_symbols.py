from app.khmer.symbols import to_unicode


def test_wingdings_bullets():
    assert to_unicode("\uf076", "Wingdings-Regular") == "❖"
    assert to_unicode("\uf0d8", "BCEAEE+Wingdings-Regular") == "➢"
    assert to_unicode("\uf0a7", "Wingdings") == "▪"
    assert to_unicode("\uf0fc", "Wingdings") == "✓"


def test_symbol_font_and_plain_text():
    assert to_unicode("\uf0b7", "Symbol") == "•"
    assert to_unicode("ខ្មែរ 123", "KhmerOSBattambang") == "ខ្មែរ 123"

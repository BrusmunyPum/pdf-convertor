# Extra fonts

Put extra `.ttf` / `.otf` fonts here (Khmer OS, Khmer MEF1/MEF2, AKbalthom...). The converter embeds them in DOCX output, so more PDFs keep their exact look.

The font files are not stored in git (size and licensing). Copy them to the server yourself:

```bash
scp -r fonts/*.ttf fonts/*.TTF fonts/*.otf user@SERVER:/opt/digitechkh/pdf-converter/fonts/
```

Then restart the converter: `cd deploy && docker compose restart converter`.

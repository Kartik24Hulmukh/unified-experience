from pypdf import PdfReader

reader = PdfReader('berozgar_platform_audit_report_march_31_2026_2026-03-31.pdf')
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open('audit.txt', 'w', encoding='utf-8') as f:
    f.write(text)

print("Extraction complete.")

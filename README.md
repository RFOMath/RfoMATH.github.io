# Riyaziyyat olimpiadası arxivi

Sayt: https://rfomath.github.io

## Qovluqlar
- `arxiv/` keçmiş illərin PDF-ləri
- `kitablar/` kitablar (eyni adlı `.jpg` üz qabığı olur)
- `data/questions.json` gündəlik suallar
- `data.js` fayl siyahısı (admin paneli və `generate.py` eyni nəticəni yaradır)

## Admin
`/admin.html` səhifəsində arxiv və kitablar üçün PDF yükləmək, əvəz etmək, adını dəyişmək və silmək olur. Kitablara üz qabığı da əlavə edilir.

## Android (APK)
1. pwabuilder.com saytında `https://rfomath.github.io` ünvanını yaz.
2. Package for stores → Android seç və paketi yüklə.
3. Paketdəki `assetlinks.json` faylının məzmununu `.well-known/assetlinks.json` faylına köçür. Bu olmasa tətbiqdə ünvan zolağı görünür.

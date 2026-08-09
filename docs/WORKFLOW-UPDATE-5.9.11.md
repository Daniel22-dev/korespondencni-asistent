# Korespondenční asistent 5.9.11 – stabilní Gmail odkaz a CI test

## Příčina release stopky

GitHub Actions nespadl na sestavení aplikace ani na logice reportéru. Selhal prohlížečový test, protože po kliknutí vyžadoval, aby nová karta zůstala na URL `mail.google.com`. V headless Chromiu se externí stránka může přesměrovat na přihlášení, ochrannou stránku nebo chybový dokument. Test pak chybně oznámil, že žádná karta nevznikla.

Současně byl Gmail odkaz doplňován až uvnitř click handleru. V některých vložených nebo PWA kontextech může prohlížeč cílovou navigaci vyhodnotit dříve, než handler změnu dokončí.

## Oprava

- Kompletní Gmail URL je připravená před kliknutím.
- Odkaz se obnovuje při změně popisu, postupu, screenshotů, metadat aplikace a e-mailu správce.
- Click handler pouze zahájí tvorbu a stažení ZIP; cílovou URL už nemění.
- Test nejprve ověří skutečnou Gmail URL a příjemce.
- Samotné otevření nové karty se testuje lokálním `data:` cílem, takže výsledek nezávisí na síti ani chování Google.

## Ověření

Release gate nadále kontroluje interní testy aplikace, Core konformitu, syntaxi reportéru, životní cyklus konceptu a skutečné kliknutí v Chromiu.

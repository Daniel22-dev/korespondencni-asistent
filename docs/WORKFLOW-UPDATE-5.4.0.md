# Korespondenční asistent 5.4.0 — změny po uživatelském testu

## Provedené změny

1. **Jedno kontrolní pole:** anonymizace a přesný obsah pro Gemini jsou nyní v jednom velkém pracovním okně. Duplicitní textový náhled je skrytý a slouží už jen interním kontrolám.
2. **Výrazné upozornění:** nad odesílaným textem je jasná výzva k přečtení celého obsahu a kontrole osobních a citlivých údajů.
3. **Povinné potvrzení:** checkbox „Zkontrolováno“ zůstává povinný.
4. **Našeptávač:** možné názvy a jména jsou označeny oranžově. Uživatel musí zvolit osobu, instituci, místo, nebo výraz vědomě ponechat. Dokud nejsou všechny návrhy vyřešeny, potvrzení ani odeslání nejsou dostupné.
5. **Oprava jmen v podpisu:** ve větě „Mává Petr H.“ se jako jedna osoba skryje „Petr H.“; slovo „Mává“ zůstane beze změny. Podporovány jsou také tituly a iniciály.
6. **Podpis z profilu:** chybějící značka podpisu se do návrhu automaticky doplní. Aktivní podpis je v editoru viditelný, ale zdroj pro další AI úpravy nadále obsahuje pouze `[podpis]`.
7. **Poznámka pro odpověď:** pole už není uzavřeno v nadbytečném bílém rámečku.
8. **Formulace a podpisy:** dialog je široký a rozdělený do samostatných sekcí. Formulace mají název, kategorii, text a jednoznačné tlačítko „Vložit“. Aktivní podpis je zřetelně označen.
9. **Scénáře školní komunikace:** nahrazuje původní označení „Šablony školních situací“.
10. **Správcovské nástroje:** v produkci se zobrazí pouze při přístupu s rolí `admin` předanou AI Studiem. Běžný parametr `?dev=1` je v produkci neodemkne; funguje pouze na localhostu. Interní testovací režim zůstává dostupný.
11. **Regresní testy:** přidány testy pro `Petr H.`, blokaci nevyřešených návrhů a lokální profilový podpis. Release sada obsahuje 51 interních testů.

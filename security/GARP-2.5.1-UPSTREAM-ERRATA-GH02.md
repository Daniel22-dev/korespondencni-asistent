# GARP 2.5.1 upstream errata — GH-02 checker blind spot

Nezávislá kontrola KS 5.10.24 prokázala, že původní `check-sw-security-freeze.mjs` hledal precache seznamy podle omezené množiny názvů proměnných. `GHRAB_PLATFORM_P3_ASSETS` proto nebyl analyzován a vznikl false negative.

Lokální kopie checkeru v KS 5.10.25 je opravena tak, aby odvozovala precache z použití `cache.add` / `cache.addAll` a jednoduchého datového toku array identifikátorů bez allowlistu názvů. Nová kontrola prokazatelně FAILuje na původním 5.10.24 i po přejmenování precache pole.

Tato oprava má být před auditem dalších aplikací propagována do centrálního GARP 2.5.1 toolingu; samotná existence opravené kopie v KS není důkazem, že původní distribuovaný GARP ZIP byl změněn.

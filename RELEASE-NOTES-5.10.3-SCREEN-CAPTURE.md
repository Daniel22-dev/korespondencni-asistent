# Korespondenční asistent 5.10.3

Datum vydání: 13. srpna 2026

## Opravený problém

Při hlášení chyby a sdílení stejné karty se mohl pomocný živý obraz vložit přímo do stránky jako viditelné video. Protože zachycoval kartu, ve které byl sám zobrazený, vznikala při posouvání stránky rekurzivní „zrcadlová chodba“ s mnohonásobně zopakovaným záhlavím, spodní lištou a ovládáním snímků.

Příčinou byl nesoulad mezi umístěním prvku a CSS selektorem: video se přidávalo vedle kořene reportéru do `body`, zatímco skryté styly byly omezené pouze na video uvnitř reportéru.

## Řešení

- pomocné video se vkládá přímo do kořene reportéru;
- ještě před vložením do dokumentu dostane inline pojistku mimo obrazovku s rozměrem 1 × 1 px, nulovou průhledností a vypnutými událostmi ukazatele;
- CSS stejný stav vynucuje nezávisle pomocí `!important`, včetně `visibility: hidden`;
- prvek je označený `aria-hidden="true"` a nelze jej zaměřit klávesnicí;
- statický test hlídá správné umístění prvku a prohlížečový test po aktivaci sdílení ověřuje jeho vypočtené styly i polohu mimo obrazovku.

## Zachované chování

Samotné pořizování až pěti snímků, návrat do hlášení, ukončení snímání, tvorba diagnostického ZIPu, ruční stažení a následné otevření předvyplněného Gmailu zůstávají funkčně beze změny. Verze 5.10.3 obsahuje také všechny opravy vydání 5.10.2.

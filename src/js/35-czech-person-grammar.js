/* ===================== CZECH PERSON GRAMMAR =====================
   Jediný lokální zdroj pravdy pro české skloňování osobních jmen.
   Běžné a jednoznačné typy řeší automaticky. U jmen závislých na
   výslovnosti, rodinném úzu nebo významovém kontextu vrací návrh,
   ale současně vyžádá lidské potvrzení všech sedmi pádů.
*/
const CZ_PERSON_GRAMMAR=(()=>{
  "use strict";
  const LOCALE="cs-CZ";
  const lower=value=>String(value||"").normalize("NFC").toLocaleLowerCase(LOCALE);
  const words=value=>String(value||"").trim().split(/\s+/).filter(Boolean);
  const titleRe=/^(?:mgr|ing|bc|mudr|rndr|phdr|judr|doc|prof)\.?$/i;
  const particles=new Set("de del della di da dos van von der den la le du st saint bin al el".split(/\s+/));
  const makeDisplayList=value=>words(value);
  const makeSet=value=>new Set(makeDisplayList(value).map(lower));

  // Seznam slouží především k bezpečnému určení rodu a role první části
  // celého jména. Vlastní pádové tvary nadále vytváří jednotný engine níže.
  const maleDisplay=makeDisplayList(
    "Abraham Adam Adolf Alan Albert Aleš Alexandr Alexander Alexej Alois Amos Andrej Antonín Arnold Artur Augustin Bedřich Bohdan Bohumil Boleslav Boris Branislav Bronislav Bruno Břetislav Cyril Čeněk Dalibor Damián Damian Dan Daniel David Denis Derek Dominik Dorian Dušan Eduard Emanuel Emil Erik Ervín Evžen Felix Ferdinand Filip Florián František Frederik Fridrich Gabriel Gustav Hanuš Hubert Hugo Hynek Igor Imrich Ivan Ivo Ján Jáchym Jakub Jan Jaromír Jaroslav Jeroným Jindřich Jiří Jonáš Josef Jozef Kamil Karel Karol Kevin Klaus Kryštof Ladislav Leoš Leopold Libor Lorenc Lubomír Luboš Luděk Ludvík Lukáš Marcel Marek Marian Mario Martin Matěj Matouš Matyáš Max Maxim Maxmilián Michael Michal Mikuláš Milan Miloš Miroslav Mojmír Nikolaj Norbert Oldřich Oliver Ondřej Oskar Otakar Oto Patrik Pavel Peter Petr Prokop Radek Radim Radoslav Rafael René Richard Robert Robin Roman Rostislav Rudolf Samuel Sebastian Sergej Slavomír Stanislav Šimon Štěpán Tadeáš Teodor Tibor Tobiáš Tobias Tomáš Václav Valentin Viktor Vilém Vincent Vít Vítek Vladimír Vlastimil Vojtěch Walter Zbyněk Zdeněk Asterix"
  );
  const femaleDisplay=makeDisplayList(
    "Adéla Adriana Agáta Alena Alexandra Alice Alžběta Amanda Amálie Aneta Anita Antonie Anežka Anna Barbora Beáta Berenika Blanka Bohdana Brenda Cecilia Cecílie Daniela Darina Denisa Diana Dominika Dorota Edita Elena Eliška Ella Ema Emma Ester Eva Evelína Františka Gabriela Gita Greta Hana Helena Ilona Irena Ivana Izabela Jana Jarmila Jaroslava Jindřiška Jiřina Jitka Johana Julie Kamila Karina Karolína Kateřina Klára Kristýna Laura Lea Lenka Libuše Linda Lucie Ludmila Lýdie Magda Magdalena Maja Marcela Marie Marika Markéta Marta Martina Maya Michaela Mia Milada Monika Natálie Nina Noemi Nora Olga Patricie Pavla Petra Radka Renata Romana Sabina Sandra Sára Simona Sofie Soňa Stanislava Stella Sylvie Šárka Štěpánka Tamara Tereza Valerie Valérie Vanessa Veronika Viktorie Viola Vladimíra Zdeňka Zuzana Žaneta Žofie"
  );
  const maleNames=new Set(maleDisplay.map(lower));
  const femaleNames=new Set(femaleDisplay.map(lower));
  const maleA=makeSet("Honza Jarda Jirka Franta Pepa Standa Míra Vojta Kuba Tonda Lojza Ondra Ota");
  const maleO=makeSet("Ivo Oto Laco Kvido Zeno Marko Mario Leo Romeo Bruno Hugo");
  const ambiguousGiven=makeSet("Alex Andrea Kája Kim Míša Nikita Nikola Péťa Saša Sasha Dominique");
  // Pravopis sám nestačí k bezpečné volbě paradigmatu. Například Mia/Maya
  // může v českém úzu kolísat podle výslovnosti a přání nositelky.
  const pronunciationSensitiveGiven=makeSet("Mia Maya");
  const femaleConsonant=makeSet("Dagmar Ingrid Karin Carmen Eleonor Maud Marylin Marilyn Kim Miriam Iris Inez Ines Nives Nikol");
  const trustedMobileEk=makeSet("Marek Radek Hynek Zdeněk Čeněk Luděk Vítek");
  const extraKnownGivenDisplay=makeDisplayList("Honza Jarda Jirka Franta Pepa Standa Míra Vojta Kuba Tonda Lojza Ondra Ota Laco Kvido Zeno Marko Leo Romeo Alex Andrea Kája Kim Míša Nikita Nikola Péťa Saša Sasha Dominique Dagmar Ingrid Karin Carmen Eleonor Maud Marylin Marilyn Miriam Iris Inez Ines Nives Nikol");
  // Frekventovaná česká příjmení pomáhají jen při zpětném rozpoznání pádového
  // tvaru (např. Dvořákovi -> Dvořák, Svobodovi -> Svoboda). Samotný výskyt
  // v seznamu nikdy neobchází kontrolu rodu ani rizikových paradigmat.
  const commonSurnameDisplay=makeDisplayList(
    "Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec Pokorný Marek Pospíšil Hájek Jelínek Král Růžička Beneš Fiala Sedláček Doležal Zeman Kolář Navrátil Čermák Vaněk Urban Blažek Kříž Konečný Sýkora Bartoš Tichý Šimek Pavlík Štěpánek Vlček Matoušek Říha Kovář Polák Musil Holub Čech Šmíd Šťastný Mareš Soukup Ševčík Duda Kadlec Beran Staněk Moravec Vávra Dušek Janda Bureš Hrubý Havlíček Liška Macháček Koubek Bednář Hruška Konečná Malý Růžička Smetana Fojtík Vacek Křížek Vondráček Zelenka Kopecký Konečný Valenta Toman Konečný Šťastný Křížová Pospíšilová Baláž Baran Drastich Faldynová Farnik"
  );
  const commonSurnames=new Set(commonSurnameDisplay.map(lower));

  const preserveCase=(source,value)=>{
    const src=String(source||""),val=String(value||"");
    if(!src||!val)return val;
    if(src===src.toLocaleUpperCase(LOCALE))return val.toLocaleUpperCase(LOCALE);
    const first=src[0];
    if(first===first.toLocaleUpperCase(LOCALE))return val[0].toLocaleUpperCase(LOCALE)+val.slice(1);
    return val.toLocaleLowerCase(LOCALE);
  };
  const result=(source,forms,meta={})=>{
    const src=String(source||"").trim(),out={};
    for(let c=1;c<=7;c++)out[c]=preserveCase(src,String(forms[c]||forms[1]||src));
    out.confidence=meta.confidence||"high";
    out.requiresReview=!!meta.requiresReview;
    out.reviewReasons=[...new Set([].concat(meta.reviewReasons||meta.reason||[]).filter(Boolean))];
    out.gender=meta.gender||"unknown";
    out.role=meta.role||"unknown";
    out.source=meta.source||"rule";
    return out;
  };
  const same=(source,meta={})=>result(source,{1:source,2:source,3:source,4:source,5:source,6:source,7:source},meta);
  const isTitle=value=>titleRe.test(lower(value));
  const isInitial=value=>/^\p{Lu}\.?$/u.test(String(value||""));
  const isParticle=value=>particles.has(lower(String(value||"").replace(/[.,]$/g,"")));

  const feminineDative=stem=>{
    if(stem.endsWith("ch"))return stem.slice(0,-2)+"še";
    const last=stem.slice(-1);
    if(last==="k")return stem.slice(0,-1)+"ce";
    if(last==="g"||last==="h")return stem.slice(0,-1)+"ze";
    if(last==="r")return stem.slice(0,-1)+"ře";
    if(last==="ň")return stem.slice(0,-1)+"ně";
    if(last==="ď")return stem.slice(0,-1)+"dě";
    if(last==="ť")return stem.slice(0,-1)+"tě";
    if(/[dtnbpvfm]$/u.test(stem))return stem+"ě";
    return stem+"e";
  };
  const aGenitive=stem=>stem+(/[cčďjňřšťž]$/u.test(stem)?"i":"y");
  const feminineA=lo=>{
    const st=lo.slice(0,-1),dat=feminineDative(st);
    return {1:lo,2:aGenitive(st),3:dat,4:st+"u",5:st+"o",6:dat,7:st+"ou"};
  };
  const feminineIa=lo=>{const st=lo.slice(0,-1);return {1:lo,2:st+"e",3:st+"i",4:st+"i",5:st+"e",6:st+"i",7:st+"í"};};
  const feminineIe=lo=>{const st=lo.slice(0,-1);return {1:lo,2:lo,3:st+"i",4:st+"i",5:lo,6:st+"i",7:st+"í"};};
  const feminineE=lo=>{const st=lo.slice(0,-1);return {1:lo,2:lo,3:st+"i",4:st+"i",5:lo,6:st+"i",7:st+"í"};};
  const adjectiveHardMale=lo=>{const st=lo.slice(0,-1);return {1:lo,2:st+"ého",3:st+"ému",4:st+"ého",5:lo,6:st+"ém",7:st+"ým"};};
  const adjectiveHardFemale=lo=>{const st=lo.slice(0,-1);return {1:lo,2:st+"é",3:st+"é",4:st+"ou",5:lo,6:st+"é",7:st+"ou"};};
  const adjectiveSoftMale=lo=>{const st=lo.slice(0,-1);return {1:lo,2:st+"ího",3:st+"ímu",4:st+"ího",5:lo,6:st+"ím",7:st+"ím"};};
  const masculineA=lo=>{const st=lo.slice(0,-1);return {1:lo,2:aGenitive(st),3:st+"ovi",4:st+"u",5:st+"o",6:st+"ovi",7:st+"ou"};};
  const masculineO=lo=>{const st=lo.slice(0,-1);return {1:lo,2:st+"a",3:st+"ovi",4:st+"a",5:lo,6:st+"ovi",7:st+"em"};};
  const masculineIY=lo=>({1:lo,2:lo+"ho",3:lo+"mu",4:lo+"ho",5:lo,6:lo+"m",7:lo+"m"});
  const mobileEk=lo=>{
    let prefix=lo.slice(0,-2);
    if(/ěk$/u.test(lo)){
      const soft={d:"ď",t:"ť",n:"ň"},last=prefix.slice(-1);
      if(soft[last])prefix=prefix.slice(0,-1)+soft[last];
    }
    const st=prefix+"k";
    return {1:lo,2:st+"a",3:st+"ovi",4:st+"a",5:st+"u",6:st+"ovi",7:st+"em"};
  };
  const retainedEk=lo=>({1:lo,2:lo+"a",3:lo+"ovi",4:lo+"a",5:lo+"u",6:lo+"ovi",7:lo+"em"});
  const mobileEc=lo=>{
    const st=lo.slice(0,-2)+"c",voc=st.slice(0,-1)+"če";
    return {1:lo,2:st+"e",3:st+"ovi",4:st+"e",5:voc,6:st+"ovi",7:st+"em"};
  };
  const retainedEl=(lo,vocative)=>({1:lo,2:lo+"a",3:lo+"ovi",4:lo+"a",5:lo+(vocative||"e"),6:lo+"ovi",7:lo+"em"});
  const retainedEr=lo=>({1:lo,2:lo+"a",3:lo+"ovi",4:lo+"a",5:lo+"e",6:lo+"ovi",7:lo+"em"});
  const masculineHard=lo=>({1:lo,2:lo+"a",3:lo+"ovi",4:lo+"a",5:/(?:ch|[kgh])$/u.test(lo)?lo+"u":lo+"e",6:lo+"ovi",7:lo+"em"});
  const masculineSoft=lo=>({1:lo,2:lo+"e",3:lo+"ovi",4:lo+"e",5:lo+"i",6:lo+"ovi",7:lo+"em"});

  const exact=new Map();
  const register=(name,forms,meta={})=>exact.set(lower(name),{forms,meta:Object.assign({gender:"male",confidence:"high",source:"exact"},meta)});
  register("Petr",{1:"petr",2:"petra",3:"petrovi",4:"petra",5:"petře",6:"petrovi",7:"petrem"});
  register("Alexandr",{1:"alexandr",2:"alexandra",3:"alexandrovi",4:"alexandra",5:"alexandře",6:"alexandrovi",7:"alexandrem"});
  register("Alexander",{1:"alexander",2:"alexandra",3:"alexandrovi",4:"alexandra",5:"alexandře",6:"alexandrovi",7:"alexandrem"});
  register("Pavel",{1:"pavel",2:"pavla",3:"pavlovi",4:"pavla",5:"pavle",6:"pavlovi",7:"pavlem"});
  register("Karel",{1:"karel",2:"karla",3:"karlovi",4:"karla",5:"karle",6:"karlovi",7:"karlem"});
  register("Havel",{1:"havel",2:"havla",3:"havlovi",4:"havla",5:"havle",6:"havlovi",7:"havlem"});
  register("Daniel",{1:"daniel",2:"daniela",3:"danielovi",4:"daniela",5:"danieli",6:"danielovi",7:"danielem"});
  register("Emanuel",{1:"emanuel",2:"emanuela",3:"emanuelovi",4:"emanuela",5:"emanueli",6:"emanuelovi",7:"emanuelem"});
  register("Gabriel",{1:"gabriel",2:"gabriela",3:"gabrielovi",4:"gabriela",5:"gabrieli",6:"gabrielovi",7:"gabrielem"},{confidence:"medium",requiresReview:true,reason:"U jména Gabriel jsou v úzu přípustné varianty vokativu Gabrieli i Gabriele."});
  register("Samuel",{1:"samuel",2:"samuela",3:"samuelovi",4:"samuela",5:"samueli",6:"samuelovi",7:"samuelem"});
  register("Rafael",{1:"rafael",2:"rafaela",3:"rafaelovi",4:"rafaela",5:"rafaeli",6:"rafaelovi",7:"rafaelem"},{confidence:"medium",requiresReview:true,reason:"U jména Rafael jsou v úzu přípustné varianty vokativu Rafaeli i Rafaele."});
  register("Marcel",{1:"marcel",2:"marcela",3:"marcelovi",4:"marcela",5:"marceli",6:"marcelovi",7:"marcelem"});
  register("Michael",{1:"michael",2:"michaela",3:"michaelovi",4:"michaela",5:"michaeli",6:"michaelovi",7:"michaelem"},{confidence:"medium",requiresReview:true,reason:"Vokativ jména Michael závisí na výslovnosti (Michaeli / Michaele)."});
  register("Oliver",{1:"oliver",2:"olivera",3:"oliverovi",4:"olivera",5:"olivere",6:"oliverovi",7:"oliverem"});
  register("Peter",{1:"peter",2:"petera",3:"peterovi",4:"petera",5:"petere",6:"peterovi",7:"peterem"});
  register("Walter",{1:"walter",2:"waltera",3:"walterovi",4:"waltera",5:"waltere",6:"walterovi",7:"walterem"});
  register("Derek",{1:"derek",2:"dereka",3:"derekovi",4:"dereka",5:"dereku",6:"derekovi",7:"derekem"});
  register("Alois",{1:"alois",2:"aloise",3:"aloisovi",4:"aloise",5:"aloisi",6:"aloisovi",7:"aloisem"});
  register("Klaus",{1:"klaus",2:"klause",3:"klausovi",4:"klause",5:"klausi",6:"klausovi",7:"klausem"});
  register("Asterix",{1:"asterix",2:"asterixe",3:"asterixovi",4:"asterixe",5:"asterixi",6:"asterixovi",7:"asterixem"});
  register("René",{1:"rené",2:"reného",3:"renému",4:"reného",5:"rené",6:"reném",7:"reném"});
  register("Hus",{1:"hus",2:"husa",3:"husovi",4:"husa",5:"huse",6:"husovi",7:"husem"});
  register("Němec",{1:"němec",2:"němce",3:"němcovi",4:"němce",5:"němče",6:"němcovi",7:"němcem"},{confidence:"medium",requiresReview:true,reason:"U příjmení na -ec může 5. pád kolísat; u jména Němec jsou možné tvary Němče i Němci."});
  register("Švec",{1:"švec",2:"švece",3:"švecovi",4:"švece",5:"šveci",6:"švecovi",7:"švecem"},{confidence:"medium",requiresReview:true,reason:"U příjmení Švec záleží na rodinném úzu; vyskytují se také tvary Ševce a Ševče."});

  const inferGender=parts=>{
    const content=parts.filter(p=>!isTitle(p)&&!isParticle(p)&&!isInitial(p));
    const first=lower(content[0]||""),last=lower(content[content.length-1]||"");
    if(!first)return {gender:"unknown",confidence:"low",reason:"Jméno nemá rozpoznatelnou část."};

    const ambiguous=ambiguousGiven.has(first);
    const givenGender=ambiguous?"unknown":
      femaleConsonant.has(first)||femaleNames.has(first)?"female":
      maleNames.has(first)||maleA.has(first)||maleO.has(first)?"male":"unknown";
    const surnameGender=/ová$/u.test(last)||/á$/u.test(last)?"female":/ý$/u.test(last)?"male":"unknown";

    if(content.length>1&&givenGender!=="unknown"&&surnameGender!=="unknown"&&givenGender!==surnameGender){
      return {gender:"unknown",confidence:"low",reason:"Rod křestního jména a příjmení si odporuje; zkontrolujte základní tvar."};
    }
    if(ambiguous){
      if(surnameGender!=="unknown")return {gender:surnameGender,confidence:"medium",reason:""};
      return {gender:"unknown",confidence:"low",reason:"Křestní jméno je rodově nejednoznačné."};
    }
    if(givenGender!=="unknown")return {gender:givenGender,confidence:"high",reason:""};
    if(surnameGender!=="unknown")return {gender:surnameGender,confidence:"medium",reason:""};
    if(/(?:ia|ie|a)$/u.test(first))return {gender:"unknown",confidence:"low",reason:"U neznámého jména na -a, -ia nebo -ie nelze rod bezpečně určit bez dalšího kontextu."};
    return {gender:"unknown",confidence:"low",reason:"Rod osoby nelze ze zápisu spolehlivě určit."};
  };

  const foreignSurnameReason=(lo,gender,role)=>{
    if(gender!=="male"||role!=="surname")return "";
    if(/(?:th|sh|sch|ph|gh|ck|qu|tz|zs|cz|sz|w)/u.test(lo)||/(?:q|es)$/u.test(lo)||/[iy]$/u.test(lo)){
      return "U cizího příjmení může české skloňování záviset na výslovnosti, kterou nelze bezpečně určit jen z pravopisu.";
    }
    return "";
  };

  function declineWord(word,options={}){
    const src=String(word||"").trim(),lo=lower(src),gender=options.gender||"unknown",role=options.role||"unknown";
    const meta=(extra={})=>Object.assign({gender,role},extra);
    const riskReason=foreignSurnameReason(lo,gender,role);
    const finish=(forms,extra={})=>{
      const reasons=[].concat(extra.reviewReasons||extra.reason||[]).filter(Boolean);
      if(riskReason)reasons.push(riskReason);
      return result(src,forms,meta(Object.assign({},extra,{requiresReview:!!extra.requiresReview||!!riskReason,reviewReasons:reasons})));
    };
    if(!lo||lo.length<2)return same(src,meta({confidence:"low",requiresReview:true,reason:"Jméno je příliš krátké.",source:"unresolved"}));
    if(isTitle(src)||isInitial(src)||isParticle(src))return same(src,meta({confidence:"high",source:"fixed"}));
    if(/[\p{Pd}'’ʼ]/u.test(src))return same(src,meta({confidence:"low",requiresReview:true,reason:"Složené nebo apostrofované jméno vyžaduje ruční kontrolu.",source:"unresolved"}));
    const upper=src.toLocaleUpperCase(LOCALE),inner=Array.from(src).slice(1).join("");
    if(src!==upper&&/\p{Lu}/u.test(inner))return same(src,meta({confidence:"low",requiresReview:true,reason:"Jméno s vnitřním velkým písmenem vyžaduje ruční kontrolu, aby se zachoval pravopis a výslovnost.",source:"unresolved"}));

    const exactEntry=exact.get(lo);
    if(exactEntry&&!(gender==="female"&&role==="surname"))return result(src,exactEntry.forms,meta(exactEntry.meta));

    // Jeden zápis typu Andrea nebo Nikola rod sám neurčuje. Kontext celého
    // jména jej může vyřešit; jinak musí uživatel tvary potvrdit.
    if(gender==="unknown"&&role!=="surname"&&ambiguousGiven.has(lo)){
      return same(src,meta({confidence:"low",requiresReview:true,reason:"Křestní jméno je rodově nejednoznačné.",source:"ambiguous-given"}));
    }
    if(role!=="surname"&&pronunciationSensitiveGiven.has(lo)){
      return same(src,meta({confidence:"low",gender:gender==="unknown"?"female":gender,requiresReview:true,reason:"U tohoto jména závisí pádové tvary na výslovnosti a osobním úzu; potvrď všech sedm pádů.",source:"pronunciation-sensitive"}));
    }

    if(gender==="female"&&role==="surname"){
      if(/ová$/u.test(lo)||/á$/u.test(lo))return result(src,adjectiveHardFemale(lo),meta({confidence:"high",source:"female-surname"}));
      if(/í$/u.test(lo))return same(src,meta({confidence:"high",source:"female-soft-surname"}));
      if(/(?:ovou|ou|ové)$/u.test(lo))return same(src,meta({confidence:"low",requiresReview:true,reason:"Zápis příjmení vypadá jako pádový tvar, nikoli bezpečně potvrzený nominativ.",source:"ambiguous-female-surname-form"}));
      return same(src,meta({confidence:"high",source:"female-uninflected-surname"}));
    }

    if(gender!=="male"&&(/ová$/u.test(lo)||/á$/u.test(lo))){
      return result(src,adjectiveHardFemale(lo),meta({confidence:"high",gender:"female",source:"female-adjective"}));
    }

    if(gender==="female"||femaleNames.has(lo)||femaleConsonant.has(lo)){
      if(femaleConsonant.has(lo))return same(src,meta({confidence:"high",gender:"female",source:"female-consonant"}));
      if(/ová$/u.test(lo)||/á$/u.test(lo))return result(src,adjectiveHardFemale(lo),meta({confidence:"high",gender:"female",source:"female-adjective"}));
      if(/ia$/u.test(lo))return result(src,feminineIa(lo),meta({confidence:"high",gender:"female",source:"female-ia"}));
      if(/ie$/u.test(lo))return result(src,feminineIe(lo),meta({confidence:"high",gender:"female",source:"female-ie"}));
      if(/a$/u.test(lo))return result(src,feminineA(lo),meta({confidence:"high",gender:"female",source:"female-a"}));
      if(/e$/u.test(lo)&&femaleNames.has(lo))return result(src,feminineE(lo),meta({confidence:"medium",gender:"female",source:"female-e"}));
      return same(src,meta({confidence:"low",gender:"female",requiresReview:true,reason:"Neobvyklé ženské jméno vyžaduje potvrzení pádů.",source:"unresolved"}));
    }

    const maleContext=gender==="male";
    const knownMale=maleContext||maleNames.has(lo)||maleA.has(lo)||maleO.has(lo);
    const knownMaleGiven=role==="given"&&(maleNames.has(lo)||maleA.has(lo)||maleO.has(lo));
    if(maleA.has(lo)||(knownMale&&/a$/u.test(lo)))return finish(masculineA(lo),{confidence:"high",gender:"male",source:"male-a"});
    if(gender==="unknown"&&/a$/u.test(lo))return result(src,feminineA(lo),meta({confidence:"low",gender:"female",requiresReview:true,reason:"U neznámého jména na -a je nutné potvrdit rod a pády.",source:"inferred-female-a"}));
    if(role==="surname"&&gender==="male"&&/o$/u.test(lo)&&!maleO.has(lo))return finish(masculineO(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"Mužské příjmení na -o může být české i cizí; skloňování je nutné potvrdit podle výslovnosti a úzu nositele.",source:"ambiguous-surname-o"});
    if(maleO.has(lo)||(knownMale&&/o$/u.test(lo)))return finish(masculineO(lo),{confidence:"high",gender:"male",source:"male-o"});
    if(/ý$/u.test(lo))return finish(adjectiveHardMale(lo),{confidence:knownMale?"high":"medium",gender:"male",source:"male-adjective"});
    if(/í$/u.test(lo))return finish(adjectiveSoftMale(lo),{confidence:knownMale?"high":"medium",gender:"male",source:"male-soft-adjective"});
    if(knownMaleGiven&&/[iy]$/u.test(lo))return finish(masculineIY(lo),{confidence:"high",gender:"male",source:"male-i"});
    if(/[iy]$/u.test(lo))return same(src,meta({confidence:"low",gender:knownMale?"male":"unknown",requiresReview:true,reason:"Jméno zakončené na neakcentované -i nebo -y závisí na výslovnosti a původu.",source:"unresolved"}));
    if(/[eé]$/u.test(lo))return same(src,meta({confidence:"low",gender:knownMale?"male":"unknown",requiresReview:true,reason:"Jméno na -e nebo -é závisí na výslovnosti.",source:"unresolved"}));
    if(/[uúů]$/u.test(lo))return same(src,meta({confidence:"low",gender:knownMale?"male":"unknown",requiresReview:true,reason:"Jméno na -u vyžaduje ruční kontrolu.",source:"unresolved"}));

    if(/[eě]k$/u.test(lo)&&lo.length>=4){
      const safe=trustedMobileEk.has(lo)||/ěk$/u.test(lo)||/(?:áček|íček|oušek|íšek|ýšek|eček|ček)$/u.test(lo);
      if(safe)return finish(mobileEk(lo),{confidence:"high",gender:"male",source:"mobile-ek"});
      return finish(mobileEk(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U jména na -ek může být e pohyblivé, ale u cizího jména se může zachovávat.",source:"ambiguous-ek"});
    }
    if(/ec$/u.test(lo)&&lo.length>=4){
      return finish(mobileEc(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U jmen na -ec se může lišit vypouštění e i podoba 5. pádu; rozhoduje také rodinný úzus.",source:"ambiguous-ec"});
    }
    if(/eš$/u.test(lo)&&!knownMaleGiven){
      return finish(masculineSoft(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U některých příjmení na -eš může být e pohyblivé; potvrď tvary podle úzu nositele.",source:"ambiguous-esh"});
    }
    if(/[eě]l$/u.test(lo)&&lo.length>=4){
      return finish(retainedEl(lo,"e"),{confidence:"low",gender:"male",requiresReview:true,reason:"U jmen na -el se může e zachovávat nebo vypouštět a vokativ může kolísat.",source:"ambiguous-el"});
    }
    if(/er$/u.test(lo)&&lo.length>=4){
      return finish(retainedEr(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U některých jmen na -er je pohyblivé e závislé na výslovnosti a rodinném úzu.",source:"ambiguous-er"});
    }
    if(/[^aeiouyáéíóúůý]r$/u.test(lo)&&role!=="given"){
      return finish(masculineHard(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U příjmení zakončeného souhláskou + r může 5. pád kolísat (např. -re / -ře).",source:"ambiguous-r"});
    }
    if(/(?:ius|eus|us|os|es|as)$/u.test(lo)&&!knownMaleGiven){
      return finish(masculineSoft(lo),{confidence:"low",gender:"male",requiresReview:true,reason:"U klasických a cizích jmen se může měnit kmen nebo se zakončení zachovává; bez kontextu nelze zvolit bezpečné paradigma.",source:"classical-or-modern"});
    }
    if(/[ďťň]$/u.test(lo))return same(src,meta({confidence:"low",gender:knownMale?"male":"unknown",requiresReview:true,reason:"Koncová měkká souhláska vyžaduje ruční kontrolu pravopisu pádů.",source:"unresolved"}));
    if(/[cčjřsšzžx]$/u.test(lo))return finish(masculineSoft(lo),{confidence:knownMale?"high":"low",gender:"male",requiresReview:!knownMale,reason:!knownMale?"Rod jednoslovného jména nelze ze zápisu potvrdit.":"",source:"male-soft"});
    if(/[bdfghklmnprtv]$/u.test(lo)||/ch$/u.test(lo))return finish(masculineHard(lo),{confidence:knownMale?"high":"low",gender:"male",requiresReview:!knownMale,reason:!knownMale?"Rod jednoslovného jména nelze ze zápisu potvrdit.":"",source:"male-hard"});

    return same(src,meta({confidence:"low",requiresReview:true,reason:"Pro toto jméno není bezpečné pravidlo skloňování.",source:"unresolved"}));
  }

  function declinePerson(real){
    const source=String(real||"").replace(/[<>]/g," ").replace(/\s+/g," ").trim();
    const parts=words(source),genderInfo=inferGender(parts),contentIndexes=[];
    parts.forEach((part,index)=>{if(!isTitle(part)&&!isParticle(part)&&!isInitial(part))contentIndexes.push(index);});
    const firstContent=contentIndexes[0],lastContent=contentIndexes[contentIndexes.length-1];
    const contexts=parts.map((part,index)=>{
      let role="fixed";
      if(contentIndexes.includes(index)){
        if(contentIndexes.length===1)role=(maleNames.has(lower(part))||femaleNames.has(lower(part))||femaleConsonant.has(lower(part))||maleA.has(lower(part))||maleO.has(lower(part)))?"given":"unknown";
        else if(index===firstContent)role="given";
        else if(index===lastContent)role="surname";
        else role=(maleNames.has(lower(part))||femaleNames.has(lower(part)))?"given":"surname";
      }
      return {gender:genderInfo.gender,role};
    });
    const wordForms=parts.map((part,index)=>declineWord(part,contexts[index]));
    const reviewReasons=[];
    if(genderInfo.reason&&genderInfo.gender==="unknown")reviewReasons.push(genderInfo.reason);
    wordForms.forEach(item=>reviewReasons.push(...(item.reviewReasons||[])));
    const requiresReview=wordForms.some(item=>item.requiresReview)||(genderInfo.gender==="unknown"&&contentIndexes.length>0);
    const confidence=requiresReview?"low":genderInfo.confidence==="medium"||wordForms.some(item=>item.confidence==="medium")?"medium":wordForms.every(item=>item.confidence==="high")?"high":"low";
    const out={confidence,requiresReview,reviewReasons:[...new Set(reviewReasons.filter(Boolean))],gender:genderInfo.gender,wordForms,contexts,parts};
    for(let c=1;c<=7;c++)out[c]=wordForms.map(item=>item[c]).join(" ");
    return out;
  }

  return Object.freeze({
    declineWord,
    declinePerson,
    inferGender,
    isTitle,
    isParticle,
    isInitial,
    knownGivenNames:()=>maleDisplay.concat(femaleDisplay,extraKnownGivenDisplay),
    knownSurnames:()=>commonSurnameDisplay.slice(),
    isKnownSurname:value=>commonSurnames.has(lower(value)),
    version:"1.2.0"
  });
})();
if(typeof window!=="undefined")window.CZ_PERSON_GRAMMAR=CZ_PERSON_GRAMMAR;

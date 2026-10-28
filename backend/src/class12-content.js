import { choice, numeric, verbal, short } from "./starter-content.js";
import { originalPracticePacks } from "./practice-packs.js";
const ten = (fn) => Array.from({ length: 10 }, (_, i) => fn(i + 1));
const original = (key) =>
  originalPracticePacks()
    .find((p) => p.id.endsWith(key))
    .questions.map((q) => ({
      ...q,
      type: "SINGLE_CHOICE",
      maximumMarks: 1,
      negativeMarks: 0,
    }));
export function class12Content(stream) {
  const language = [
    {
      id: "hindi",
      subject: "Hindi",
      title: "अलंकार, रस एवं व्याकरण · अभ्यास 01",
      questions: verbal([
        [
          "'उसका मुख चंद्रमा के समान सुंदर है।' में अलंकार चुनें।",
          "Identify the figure of speech in the explicit comparison to the moon.",
          "उपमा",
          "रूपक",
          "यमक",
          "श्लेष",
        ],
        [
          "'चरण-कमल' में चरणों पर कमल का सीधा आरोप है। अलंकार चुनें।",
          "Identify the figure when feet are directly identified as lotuses.",
          "रूपक",
          "उपमा",
          "यमक",
          "अतिशयोक्ति",
        ],
        [
          "एक ही व्यंजन की आवृत्ति से ध्वनि-सौंदर्य उत्पन्न हो तो कौन-सा अलंकार होता है?",
          "Which figure uses repetition of consonant sounds?",
          "अनुप्रास",
          "श्लेष",
          "यमक",
          "रूपक",
        ],
        [
          "वीर रस का स्थायी भाव चुनें।",
          "Choose the enduring emotion of वीर रस.",
          "उत्साह",
          "शोक",
          "हास",
          "भय",
        ],
        [
          "करुण रस का स्थायी भाव चुनें।",
          "Choose the enduring emotion of करुण रस.",
          "शोक",
          "क्रोध",
          "उत्साह",
          "हास",
        ],
        [
          "'राजपुत्र' का विग्रह 'राजा का पुत्र' हो तो समास कौन-सा है?",
          "Identify the compound in राजा का पुत्र.",
          "षष्ठी तत्पुरुष",
          "द्वंद्व",
          "अव्ययीभाव",
          "बहुव्रीहि",
        ],
        [
          "'नीलकमल' का विग्रह 'नीला है जो कमल' हो तो समास चुनें।",
          "Identify the descriptive compound नीलकमल.",
          "कर्मधारय",
          "द्वंद्व",
          "अव्ययीभाव",
          "द्विगु",
        ],
        [
          "'प्रतिदिन' का विग्रह 'प्रत्येक दिन' हो तो समास चुनें।",
          "Identify the compound प्रतिदिन.",
          "अव्ययीभाव",
          "द्वंद्व",
          "बहुव्रीहि",
          "द्विगु",
        ],
        [
          "'अज्ञान' में उपसर्ग चुनें।",
          "Identify the prefix in अज्ञान.",
          "अ",
          "ज्ञान",
          "आ",
          "अनु",
        ],
        [
          "'मानवता' में प्रत्यय चुनें।",
          "Identify the suffix in मानवता.",
          "ता",
          "मान",
          "वता",
          "अव",
        ],
      ]),
    },
    {
      id: "english",
      subject: "English",
      title: "Advanced grammar · Practice 01",
      questions: verbal([
        [
          "Complete: If I had studied, I ___ the examination.",
          "Third conditional का सही रूप चुनें।",
          "would have passed",
          "will pass",
          "would pass",
          "pass",
        ],
        [
          "Complete: By next June, she ___ the course.",
          "Future perfect का सही रूप चुनें।",
          "will have completed",
          "has completing",
          "had completes",
          "will completed",
        ],
        [
          "Choose reported speech: He said, 'I am tired.'",
          "दिए वाक्य का reported speech चुनें।",
          "He said that he was tired.",
          "He said that I am tired.",
          "He said that he is tiring.",
          "He said he tired is.",
        ],
        [
          "Complete: Neither of the answers ___ correct.",
          "Standard formal English का सही verb चुनें।",
          "is",
          "are",
          "were",
          "be",
        ],
        [
          "Choose the passive: 'They have completed the work.'",
          "दिए वाक्य का passive चुनें।",
          "The work has been completed by them.",
          "The work have completed them.",
          "The work had completing them.",
          "They have been work completed.",
        ],
        [
          "Complete: I wish I ___ more time now.",
          "वर्तमान की अवास्तविक इच्छा का सही रूप चुनें।",
          "had",
          "have",
          "will have",
          "has",
        ],
        [
          "Identify the relative pronoun: 'The book which you lent me is useful.'",
          "Relative pronoun चुनें।",
          "which",
          "book",
          "useful",
          "lent",
        ],
        [
          "Choose a synonym of 'concise'.",
          "'concise' का समानार्थी चुनें।",
          "brief",
          "lengthy",
          "unclear",
          "repetitive",
        ],
        [
          "Choose the antonym of 'scarce'.",
          "'scarce' का विलोम चुनें।",
          "abundant",
          "rare",
          "limited",
          "insufficient",
        ],
        [
          "Complete: No sooner had she arrived ___ it started raining.",
          "सही conjunction चुनें।",
          "than",
          "when",
          "then",
          "that",
        ],
      ]),
    },
  ];
  const economics = {
    id: "economics",
    subject: "Economics",
    title: "Income multiplier · Practice 01",
    questions: ten((i) => {
      const k = i + 1,
        change = i * 100;
      return numeric(
        `In a simple closed economy without government, MPC=${k - 1}/${k}. With spare capacity and fixed prices, autonomous investment rises by ${change} units. Find the equilibrium income increase.`,
        `सरकार-रहित सरल बंद अर्थव्यवस्था में MPC=${k - 1}/${k} है। स्थिर कीमतों और अतिरिक्त उत्पादन क्षमता पर स्वायत्त निवेश ${change} इकाई बढ़ता है। संतुलित आय में वृद्धि?`,
        k * change,
        `k=1/(1−MPC)=${k}. ΔY=kΔI=${k}×${change}=${k * change}.`,
        i,
      );
    }),
  };
  let subjects;
  if (stream === "SCIENCE")
    subjects = [
      {
        id: "physics",
        subject: "Physics",
        title: "Parallel capacitors · Practice 01",
        questions: original("parallel-capacitance"),
      },
      {
        id: "chemistry",
        subject: "Chemistry",
        title: "Solutions & molarity · Practice 01",
        questions: ten((i) =>
          numeric(
            `A solution contains ${i} mol of solute in a final solution volume of 2 L. Find its molarity in mol/L.`,
            `${i} mol विलेय से विलयन का अंतिम आयतन 2 L है। मोलरता (mol/L)?`,
            i / 2,
            `M=n/V=${i}/2=${i / 2} mol/L. Use final solution volume, not solvent volume.`,
            i,
          ),
        ),
      },
      {
        id: "biology",
        subject: "Biology",
        title: "Genetics & molecular biology · Practice 01",
        questions: verbal([
          [
            "In DNA, adenine pairs with which base?",
            "DNA में adenine किस क्षारक से युग्मित होता है?",
            "Thymine / थाइमिन",
            "Uracil / यूरेसिल",
            "Guanine / ग्वानिन",
            "Cytosine / साइटोसिन",
          ],
          [
            "In double-stranded DNA, guanine pairs with which base?",
            "द्विसूत्री DNA में guanine का पूरक क्षारक?",
            "Cytosine / साइटोसिन",
            "Adenine / एडेनिन",
            "Thymine / थाइमिन",
            "Uracil / यूरेसिल",
          ],
          [
            "What does a codon consist of?",
            "एक codon में कितने nucleotide होते हैं?",
            "Three nucleotides / तीन nucleotide",
            "One nucleotide / एक nucleotide",
            "Two nucleotides / दो nucleotide",
            "Four nucleotides / चार nucleotide",
          ],
          [
            "Which enzyme synthesizes DNA from an RNA template?",
            "RNA template से DNA बनाने वाला enzyme?",
            "Reverse transcriptase / रिवर्स ट्रांसक्रिप्टेज",
            "DNA ligase / DNA लाइगेज",
            "Protease / प्रोटीएज",
            "Lipase / लाइपेज",
          ],
          [
            "In an Aa × Aa cross with complete dominance, what fraction of offspring is expected to be aa?",
            "पूर्ण प्रभाविता में Aa × Aa से aa संतति का अपेक्षित अंश?",
            "1/4",
            "1/2",
            "3/4",
            "1",
          ],
          [
            "Which cross is a test cross for an individual showing a dominant phenotype?",
            "प्रभावी phenotype वाले जीव का test cross किससे किया जाता है?",
            "Homozygous recessive / समयुग्मजी अप्रभावी",
            "Homozygous dominant only / केवल समयुग्मजी प्रभावी",
            "Any dominant phenotype / कोई भी प्रभावी phenotype",
            "Itself only / केवल स्वयं से",
          ],
          [
            "Which process produces RNA from a DNA template?",
            "DNA template से RNA बनने की प्रक्रिया?",
            "Transcription / अनुलेखन",
            "Translation / अनुवादन",
            "Replication / प्रतिकृति",
            "Fertilisation / निषेचन",
          ],
          [
            "Which process produces a polypeptide using mRNA information?",
            "mRNA की सूचना से polypeptide बनने की प्रक्रिया?",
            "Translation / अनुवादन",
            "Transcription / अनुलेखन",
            "DNA replication / DNA प्रतिकृति",
            "Osmosis / परासरण",
          ],
          [
            "Which property of the genetic code means multiple codons can specify the same amino acid?",
            "एक amino acid के लिए अनेक codon होने का गुण?",
            "Degeneracy / अपह्रासिता",
            "Ambiguity / अस्पष्टता",
            "Overlap / अतिव्यापन",
            "Randomness / यादृच्छिकता",
          ],
          [
            "How many hydrogen bonds connect a G–C base pair in DNA?",
            "DNA में G–C युग्म के बीच कितने hydrogen bond होते हैं?",
            "3",
            "2",
            "1",
            "4",
          ],
        ]),
      },
      {
        id: "math",
        subject: "Mathematics",
        title: "Differentiation · Practice 01",
        questions: ten((i) =>
          numeric(
            `For y=${i + 2}x²+${i}x, find dy/dx at x=1.`,
            `y=${i + 2}x²+${i}x के लिए x=1 पर dy/dx ज्ञात करें।`,
            3 * i + 4,
            `dy/dx=${2 * (i + 2)}x+${i}. At x=1: ${3 * i + 4}.`,
            i,
          ),
        ),
      },
    ];
  else if (stream === "ARTS")
    subjects = [
      {
        id: "history",
        subject: "History",
        title: "Indian national movement · Practice 01",
        questions: original("history-dates"),
      },
      {
        id: "political",
        subject: "Political Science",
        title: "World politics & institutions · Practice 01",
        questions: verbal([
          [
            "In which year was the United Nations founded?",
            "संयुक्त राष्ट्र की स्थापना किस वर्ष हुई?",
            "1945",
            "1919",
            "1939",
            "1950",
          ],
          [
            "The Cold War primarily involved rivalry between which two superpowers?",
            "शीत युद्ध में मुख्य प्रतिस्पर्धी महाशक्तियाँ कौन थीं?",
            "USA and USSR / अमेरिका और सोवियत संघ",
            "India and Brazil / भारत और ब्राज़ील",
            "Japan and Italy / जापान और इटली",
            "Egypt and Mexico / मिस्र और मेक्सिको",
          ],
          [
            "Which concept emphasizes national independence from rival Cold War military blocs?",
            "शीत युद्ध के प्रतिद्वंद्वी सैन्य गुटों से स्वतंत्र विदेश नीति का विचार?",
            "Non-alignment / गुटनिरपेक्षता",
            "Colonialism / उपनिवेशवाद",
            "Annexation / विलय द्वारा कब्ज़ा",
            "Imperialism / साम्राज्यवाद",
          ],
          [
            "Which UN organ has primary responsibility for international peace and security?",
            "अंतरराष्ट्रीय शांति और सुरक्षा की प्रमुख जिम्मेदारी किस UN अंग की है?",
            "Security Council / सुरक्षा परिषद",
            "UN Secretariat library / UN सचिवालय पुस्तकालय",
            "UNESCO general conference only / केवल यूनेस्को महासम्मेलन",
            "Economic commission only / केवल आर्थिक आयोग",
          ],
          [
            "What does a bipolar international system contain?",
            "द्विध्रुवीय अंतरराष्ट्रीय व्यवस्था में शक्ति के कितने प्रमुख केंद्र होते हैं?",
            "Two / दो",
            "One / एक",
            "None / कोई नहीं",
            "Exactly ten / ठीक दस",
          ],
          [
            "Which term describes the supreme authority of a state over its territory?",
            "अपने क्षेत्र पर राज्य की सर्वोच्च सत्ता को क्या कहते हैं?",
            "Sovereignty / संप्रभुता",
            "Dependency / निर्भरता",
            "Subordination / अधीनता",
            "Protectorate / संरक्षित राज्य",
          ],
          [
            "Which feature is central to a federal system?",
            "संघीय व्यवस्था की केंद्रीय विशेषता चुनें।",
            "Constitutional division of powers / संवैधानिक शक्ति विभाजन",
            "No regional government / क्षेत्रीय सरकार का अभाव",
            "Hereditary executive alone / केवल वंशानुगत कार्यपालिका",
            "No constitution / संविधान का अभाव",
          ],
          [
            "In a parliamentary system, the executive is ordinarily accountable to which institution?",
            "संसदीय व्यवस्था में कार्यपालिका सामान्यतः किसके प्रति जवाबदेह होती है?",
            "Legislature / विधायिका",
            "A private company / निजी कंपनी",
            "A foreign embassy / विदेशी दूतावास",
            "A hereditary guild / वंशानुगत संघ",
          ],
          [
            "Which principle rejects discrimination by the state solely on religious grounds?",
            "केवल धर्म के आधार पर राजकीय भेदभाव को कौन-सा सिद्धांत अस्वीकार करता है?",
            "Secularism / धर्मनिरपेक्षता",
            "Theocracy / धर्मतंत्र",
            "Colonialism / उपनिवेशवाद",
            "Absolutism / निरंकुशता",
          ],
          [
            "Which term describes a group of political parties forming a government together?",
            "कई राजनीतिक दल मिलकर सरकार बनाएँ तो उसे क्या कहते हैं?",
            "Coalition government / गठबंधन सरकार",
            "Military junta / सैन्य शासन",
            "Absolute monarchy / निरंकुश राजतंत्र",
            "Colonial administration / औपनिवेशिक प्रशासन",
          ],
        ]),
      },
      {
        id: "geography",
        subject: "Geography",
        title: "Human geography & development · Practice 01",
        questions: verbal([
          [
            "Which activity is part of the primary sector?",
            "प्राथमिक क्षेत्र की गतिविधि चुनें।",
            "Fishing / मत्स्य पालन",
            "Car manufacturing / कार निर्माण",
            "Banking / बैंकिंग",
            "Software consultancy / सॉफ्टवेयर परामर्श",
          ],
          [
            "Which activity is part of the secondary sector?",
            "द्वितीयक क्षेत्र की गतिविधि चुनें।",
            "Steel manufacturing / इस्पात निर्माण",
            "Fishing / मत्स्य पालन",
            "Mining / खनन",
            "Crop cultivation / फसल उगाना",
          ],
          [
            "Which activity is a tertiary service?",
            "तृतीयक सेवा चुनें।",
            "Transport / परिवहन",
            "Wheat cultivation / गेहूँ उगाना",
            "Coal extraction / कोयला निकालना",
            "Iron smelting / लोहा गलाना",
          ],
          [
            "Population density is normally calculated as what?",
            "जनसंख्या घनत्व की सामान्य गणना कैसे होती है?",
            "Population divided by area / जनसंख्या ÷ क्षेत्रफल",
            "Area divided by population / क्षेत्रफल ÷ जनसंख्या",
            "Births divided by deaths / जन्म ÷ मृत्यु",
            "Migration multiplied by area / प्रवास × क्षेत्रफल",
          ],
          [
            "Which term means a change of residence across a geographical boundary?",
            "भौगोलिक सीमा पार करके निवास बदलने को क्या कहते हैं?",
            "Migration / प्रवास",
            "Weathering / अपक्षय",
            "Erosion / अपरदन",
            "Evaporation / वाष्पीकरण",
          ],
          [
            "Which is usually a push factor for migration?",
            "प्रवास का सामान्य प्रतिकर्ष कारक चुनें।",
            "Lack of employment / रोज़गार का अभाव",
            "Better wages at destination / गंतव्य पर बेहतर वेतन",
            "Better schools at destination / गंतव्य पर बेहतर स्कूल",
            "Attractive destination amenities / गंतव्य की बेहतर सुविधाएँ",
          ],
          [
            "What is international trade?",
            "अंतरराष्ट्रीय व्यापार क्या है?",
            "Exchange of goods/services across countries / देशों के बीच वस्तु-सेवा विनिमय",
            "Trade within one village only / केवल एक गाँव का व्यापार",
            "Household consumption only / केवल घरेलू उपभोग",
            "Unpaid household work / अवैतनिक घरेलू कार्य",
          ],
          [
            "Which mode is especially suitable for moving large bulk cargo across oceans?",
            "महासागरों के पार भारी थोक माल के लिए उपयुक्त परिवहन?",
            "Sea transport / समुद्री परिवहन",
            "Bicycle / साइकिल",
            "Cable car / रोपवे",
            "Local bus / स्थानीय बस",
          ],
          [
            "Which broad dimensions are used in the Human Development Index?",
            "मानव विकास सूचकांक के व्यापक आयाम कौन-से हैं?",
            "Health, education and income / स्वास्थ्य, शिक्षा और आय",
            "Rainfall, soil and wind / वर्षा, मृदा और पवन",
            "Latitude, longitude and altitude / अक्षांश, देशांतर और ऊँचाई",
            "Imports alone / केवल आयात",
          ],
          [
            "What does sustainable development emphasize?",
            "सतत विकास किस बात पर बल देता है?",
            "Present needs with future generations' ability protected / भविष्य की क्षमता बचाते हुए वर्तमान जरूरतें",
            "Unlimited depletion / असीम संसाधन दोहन",
            "Only short-term output / केवल अल्पकालिक उत्पादन",
            "Ignoring environmental effects / पर्यावरणीय प्रभावों की उपेक्षा",
          ],
        ]),
      },
      economics,
    ];
  else if (stream === "COMMERCE")
    subjects = [
      {
        id: "accountancy",
        subject: "Accountancy",
        title: "Partnership profit sharing · Practice 01",
        questions: original("profit-sharing"),
      },
      {
        id: "business",
        subject: "Business Studies",
        title: "Management & business functions · Practice 01",
        questions: verbal([
          [
            "Which function determines objectives and a course of action in advance?",
            "पहले से उद्देश्य और कार्य-मार्ग तय करना कौन-सा प्रबंध कार्य है?",
            "Planning / नियोजन",
            "Controlling only / केवल नियंत्रण",
            "Staffing only / केवल नियुक्ति",
            "Bookkeeping / बहीखाता",
          ],
          [
            "Which function compares actual performance against standards?",
            "वास्तविक निष्पादन की मानकों से तुलना कौन-सा कार्य करता है?",
            "Controlling / नियंत्रण",
            "Recruitment / भर्ती",
            "Packaging / पैकेजिंग",
            "Warehousing / भंडारण",
          ],
          [
            "What is delegation?",
            "प्रत्यायोजन क्या है?",
            "Assigning authority with responsibility for tasks / कार्य हेतु अधिकार और जिम्मेदारी सौंपना",
            "Eliminating all accountability / समस्त जवाबदेही समाप्त करना",
            "Closing the organization / संगठन बंद करना",
            "Removing all managers / सभी प्रबंधक हटाना",
          ],
          [
            "What is the purpose of staffing?",
            "कार्मिक प्रबंध का उद्देश्य क्या है?",
            "Finding and developing suitable people for jobs / उपयुक्त लोगों का चयन और विकास",
            "Only setting product prices / केवल कीमत तय करना",
            "Only moving goods / केवल माल ढोना",
            "Only advertising / केवल विज्ञापन",
          ],
          [
            "Which is part of the traditional marketing mix?",
            "परंपरागत विपणन मिश्रण का घटक चुनें।",
            "Product / उत्पाद",
            "Court judgment / न्यायिक निर्णय",
            "Currency printing / मुद्रा मुद्रण",
            "National census / जनगणना",
          ],
          [
            "Which term describes the name/symbol distinguishing a seller's product?",
            "विक्रेता के उत्पाद को पहचान देने वाला नाम/चिह्न क्या कहलाता है?",
            "Brand / ब्रांड",
            "Ledger / खाता",
            "Debenture / ऋणपत्र",
            "Trial balance / तलपट",
          ],
          [
            "Working capital primarily finances what?",
            "कार्यशील पूँजी मुख्यतः किसका वित्तपोषण करती है?",
            "Day-to-day operations / दैनिक परिचालन",
            "Only permanent land acquisition / केवल स्थायी भूमि खरीद",
            "Only a founder's personal holiday / केवल संस्थापक की निजी छुट्टी",
            "Only long-term patents / केवल दीर्घकालिक पेटेंट",
          ],
          [
            "A budget is usually expressed primarily in what form?",
            "बजट सामान्यतः किस रूप में व्यक्त होता है?",
            "Numerical terms / संख्यात्मक रूप",
            "Only slogans / केवल नारे",
            "Only logos / केवल लोगो",
            "Only oral greetings / केवल मौखिक अभिवादन",
          ],
          [
            "What does coordination aim to achieve?",
            "समन्वय का उद्देश्य क्या है?",
            "Unity of action / कार्यों में एकता",
            "Conflict between every department / विभागों में निरंतर टकराव",
            "Elimination of all objectives / सभी उद्देश्य मिटाना",
            "No communication / संचार का अभाव",
          ],
          [
            "Which process attracts prospective applicants for jobs?",
            "नौकरी के संभावित आवेदकों को आकर्षित करना क्या कहलाता है?",
            "Recruitment / भर्ती",
            "Selection decision / चयन निर्णय",
            "Retirement / सेवानिवृत्ति",
            "Liquidation / परिसमापन",
          ],
        ]),
      },
      economics,
      {
        id: "entrepreneurship",
        subject: "Entrepreneurship",
        title: "Break-even analysis · Practice 01",
        questions: ten((i) => {
          const fixed = (i + 2) * 1000,
            price = (i + 5) * 20,
            variable = (i + 3) * 20;
          return numeric(
            `A single-product venture has fixed cost ₹${fixed}, selling price ₹${price} per unit and variable cost ₹${variable} per unit. Assuming linear costs/revenue, find break-even output in units.`,
            `एक उत्पाद की स्थिर लागत ₹${fixed}, प्रति इकाई विक्रय मूल्य ₹${price} और परिवर्ती लागत ₹${variable} है। रैखिक लागत-आय मानकर लाभ-अलाभ उत्पादन (इकाई)?`,
            fixed / 40,
            `Contribution/unit=${price}−${variable}=40. Break-even units=${fixed}/40=${fixed / 40}.`,
            i,
          );
        }),
      },
    ];
  else throw Error("Unsupported Class 12 stream");
  const result = [...language, ...subjects];
  if (stream === "SCIENCE") result.push(physicsMock());
  return result;
}
function physicsMock() {
  const mcqs = [];
  for (let family = 0; family < 7; family++)
    for (let j = 1; j <= 10; j++) {
      const i = family * 10 + j;
      const items = [
        [
          `Capacitors ${j + 2} μF and ${j + 5} μF are connected in parallel. Find equivalent capacitance in μF.`,
          `${j + 2} μF और ${j + 5} μF समांतर हैं। तुल्य धारिता (μF)?`,
          2 * j + 7,
          `C_eq=C1+C2=${2 * j + 7} μF.`,
        ],
        [
          `Two identical ${4 * j} μF capacitors are in series. Find equivalent capacitance in μF.`,
          `दो समान ${4 * j} μF संधारित्र श्रेणी में हैं। तुल्य धारिता (μF)?`,
          2 * j,
          `C_eq=C/2=${2 * j} μF.`,
        ],
        [
          `A charge of ${j + 1} μC experiences force ${j * (j + 1)} mN. Find electric field magnitude in N/C.`,
          `${j + 1} μC आवेश पर ${j * (j + 1)} mN बल है। विद्युत क्षेत्र का परिमाण (N/C)?`,
          j * 1000,
          `E=F/q. Convert mN to 10⁻³ N and μC to 10⁻⁶ C; E=${j * 1000} N/C.`,
        ],
        [
          `A resistor carries ${j} A with potential difference ${j * (j + 3)} V. Find its resistance in Ω.`,
          `प्रतिरोध में ${j} A धारा और ${j * (j + 3)} V विभवांतर है। प्रतिरोध (Ω)?`,
          j + 3,
          `R=V/I=${j + 3} Ω.`,
        ],
        [
          `A DC device draws ${j} A at 12 V. Find electrical power in W.`,
          `12 V के DC उपकरण में ${j} A धारा है। विद्युत शक्ति (W)?`,
          12 * j,
          `P=VI=12×${j}=${12 * j} W.`,
        ],
        [
          `An object is placed at twice the focal length of a thin convex lens with f=${5 * j} cm. Find the real image distance from the lens in cm.`,
          `f=${5 * j} cm के पतले उत्तल लेंस से वस्तु 2f पर है। वास्तविक प्रतिबिंब की दूरी (cm)?`,
          10 * j,
          `An object at 2f forms an image at 2f; v=${10 * j} cm.`,
        ],
        [
          `A radioactive sample initially has 1024 undecayed nuclei. What is the expected number remaining after ${j} half-lives?`,
          `नमूने में प्रारंभ में 1024 अविघटित नाभिक हैं। ${j} अर्ध-आयु बाद अपेक्षित शेष संख्या?`,
          2 ** (10 - j),
          `Expected N=N0/2^n=1024/2^${j}=${2 ** (10 - j)}.`,
        ],
      ];
      mcqs.push(numeric(...items[family].slice(0, 3), items[family][3], i));
    }
  const shorts = Array.from({ length: 20 }, (_, i) => {
    const j = (i % 10) + 1;
    if (i < 10)
      return short(
        `Capacitors ${2 * j} μF and ${6 * j} μF are in series. Derive the equivalent value using the series relation and calculate it.`,
        `${2 * j} μF और ${6 * j} μF संधारित्र श्रेणी में हैं। श्रेणी सूत्र से तुल्य धारिता निकालें।`,
        `1/C_eq=1/C1+1/C2; C_eq=C1C2/(C1+C2)=${12 * j * j}/${8 * j}=${1.5 * j} μF.`,
        2,
        [
          ["Correct series relation and substitution", 1],
          ["Correct value with capacitance units", 1],
        ],
      );
    return short(
      `Resistors ${3 * j} Ω and ${6 * j} Ω are in parallel. Show the parallel relation and find equivalent resistance.`,
      `${3 * j} Ω और ${6 * j} Ω प्रतिरोध समांतर हैं। सूत्र सहित तुल्य प्रतिरोध निकालें।`,
      `1/R_eq=1/R1+1/R2. R_eq=R1R2/(R1+R2)=${18 * j * j}/${9 * j}=${2 * j} Ω.`,
      2,
      [
        ["Correct parallel relation and substitution", 1],
        ["Correct resistance and units", 1],
      ],
    );
  });
  const longs = Array.from({ length: 6 }, (_, i) => {
    const j = (i % 3) + 1;
    if (i < 3)
      return short(
        `Three identical ${6 * j} μF capacitors are in series across 12 V. Show the series relation, calculate equivalent capacitance, common charge, voltage across each and total stored energy.`,
        `तीन समान ${6 * j} μF संधारित्र 12 V पर श्रेणी में हैं। श्रेणी सूत्र, तुल्य धारिता, सामान्य आवेश, प्रत्येक का विभवांतर और कुल संचित ऊर्जा निकालें।`,
        `1/C_eq=3/C; C_eq=${2 * j} μF. Q=C_eq V=${24 * j} μC (same on each). V_each=Q/C=4 V, and three drops sum to 12 V. U=1/2 C_eq V²=${144 * j} μJ.`,
        5,
        [
          ["Correct series relation", 1],
          ["Correct equivalent capacitance", 1],
          ["Correct common charge", 1],
          ["Each voltage correct with sum check", 1],
          ["Correct total energy and units", 1],
        ],
      );
    return short(
      `An ideal transformer has ${200 * j} primary turns and ${100 * j} secondary turns. Primary voltage is 220 V and primary current ${j} A. Find turns ratio Np/Ns, secondary voltage, input power, secondary current and ideal power loss. State the relations used.`,
      `आदर्श ट्रांसफॉर्मर में प्राथमिक फेरे ${200 * j}, द्वितीयक ${100 * j}, प्राथमिक वोल्टेज 220 V और धारा ${j} A है। Np/Ns, द्वितीयक वोल्टेज, निवेश शक्ति, द्वितीयक धारा और आदर्श शक्ति हानि निकालें।`,
      `Np/Ns=2. Vs/Vp=Ns/Np=1/2, so Vs=110 V. Pin=Vp Ip=${220 * j} W. Ideal Pout=Pin, so Is=Pin/Vs=${2 * j} A. Ideal power loss=0 W.`,
      5,
      [
        ["Correct turns ratio", 1],
        ["Correct secondary voltage using turns relation", 1],
        ["Correct input power", 1],
        ["Correct secondary current from power conservation", 1],
        ["Zero ideal loss with units", 1],
      ],
    );
  });
  return {
    id: "physics-full-mock",
    subject: "Physics",
    title: "Physics · Full mock 01 · 2026 reference layout",
    fullMock: true,
    questions: [...mcqs, ...shorts, ...longs],
    sections: [
      { id: "objective", from: 0, count: 70, maxAnswers: 35 },
      { id: "short", from: 70, count: 20, maxAnswers: 10 },
      { id: "long", from: 90, count: 6, maxAnswers: 3 },
    ],
  };
}

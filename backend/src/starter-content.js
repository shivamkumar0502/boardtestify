import { originalPracticePacks } from "./practice-packs.js";
const choice = (text, translation, answers, index = 0, explanation = "") => {
  const offset = index % 4,
    ordered = [...answers.slice(offset), ...answers.slice(0, offset)];
  return {
    type: "SINGLE_CHOICE",
    text,
    translation,
    options: ordered.map((text, i) => ({ id: "abcd"[i], text: String(text) })),
    correct: ["abcd"[ordered.indexOf(answers[0])]],
    maximumMarks: 1,
    negativeMarks: 0,
    explanation: explanation || `Correct answer / सही उत्तर: ${answers[0]}.`,
  };
};
const numeric = (text, hi, answer, explanation, index) =>
  choice(
    text,
    hi,
    [answer, answer + 1, answer + 3, answer - 2].map(String),
    index,
    explanation,
  );
const verbal = (items) =>
  items.map(([text, translation, right, ...wrong], i) =>
    choice(text, translation, [right, ...wrong], i),
  );
const short = (text, translation, answer, maximumMarks, rubric) => ({
  type: maximumMarks === 5 ? "LONG_ANSWER" : "SHORT_ANSWER",
  text,
  translation,
  options: [],
  correct: [],
  maximumMarks,
  negativeMarks: 0,
  referenceAnswer: answer,
  rubric: rubric.map(([name, marks], i) => ({
    id: `step-${i + 1}`,
    name,
    maximumMarks: marks,
  })),
  explanation: answer,
});
export function starterContent() {
  const originals = originalPracticePacks();
  const packs = [
    {
      id: "math-practice",
      subject: "Mathematics",
      title: "Linear equations · Practice 01",
      questions: originals[0].questions.map((q) => ({
        ...q,
        type: "SINGLE_CHOICE",
        maximumMarks: 1,
        negativeMarks: 0,
      })),
    },
    {
      id: "science-practice",
      subject: "Science",
      title: "Electricity · Practice 01",
      questions: originals[3].questions.map((q) => ({
        ...q,
        type: "SINGLE_CHOICE",
        maximumMarks: 1,
        negativeMarks: 0,
      })),
    },
    {
      id: "hindi-practice",
      subject: "Hindi",
      title: "व्याकरण एवं शब्द ज्ञान · अभ्यास 01",
      questions: verbal([
        [
          "'दिन' का विलोम चुनें।",
          "Choose the antonym of दिन.",
          "रात",
          "सुबह",
          "दोपहर",
          "सवेरा",
        ],
        [
          "'सूर्य' का पर्यायवाची चुनें।",
          "Choose a synonym of सूर्य.",
          "रवि",
          "चंद्रमा",
          "बादल",
          "पवन",
        ],
        [
          "'लड़का' का बहुवचन चुनें।",
          "Choose the plural of लड़का.",
          "लड़के",
          "लड़की",
          "लड़कपन",
          "बालिका",
        ],
        [
          "व्यक्ति, वस्तु, स्थान या भाव के नाम को क्या कहते हैं?",
          "What names a person, thing, place or feeling?",
          "संज्ञा",
          "क्रिया",
          "अव्यय",
          "विशेषण",
        ],
        [
          "'वह पढ़ता है।' में क्रिया कौन-सी है?",
          "Identify the verb phrase in वह पढ़ता है।",
          "पढ़ता है",
          "वह",
          "वह पढ़ता",
          "कोई नहीं",
        ],
        [
          "'मीठा आम' में विशेषण चुनें।",
          "Identify the adjective in मीठा आम.",
          "मीठा",
          "आम",
          "फल",
          "पेड़",
        ],
        [
          "'जल' का पर्यायवाची चुनें।",
          "Choose a synonym of जल.",
          "पानी",
          "अग्नि",
          "धरती",
          "आकाश",
        ],
        [
          "'सत्य' का विलोम चुनें।",
          "Choose the antonym of सत्य.",
          "असत्य",
          "यथार्थ",
          "सच",
          "वास्तविक",
        ],
        [
          "'मैं विद्यालय जाता हूँ।' में सर्वनाम कौन-सा है?",
          "Identify the pronoun in मैं विद्यालय जाता हूँ।",
          "मैं",
          "विद्यालय",
          "जाता",
          "हूँ",
        ],
        [
          "'सुंदर' का भाववाचक संज्ञा रूप चुनें।",
          "Choose the abstract noun formed from सुंदर.",
          "सुंदरता",
          "सुंदरी",
          "सुंदरतम",
          "सुंदरतर",
        ],
      ]),
    },
    {
      id: "english-practice",
      subject: "English",
      title: "Grammar & vocabulary · Practice 01",
      questions: verbal([
        [
          "Choose: She ___ to school every day.",
          "रिक्त स्थान भरें: She ___ to school every day.",
          "goes",
          "go",
          "going",
          "gone",
        ],
        [
          "Choose: I ate ___ apple.",
          "सही article चुनें: I ate ___ apple.",
          "an",
          "a",
          "the only",
          "any an",
        ],
        [
          "What is the past tense of 'go'?",
          "'go' का past tense चुनें।",
          "went",
          "goed",
          "going",
          "goes",
        ],
        [
          "Choose the plural of 'child'.",
          "'child' का बहुवचन चुनें।",
          "children",
          "childs",
          "childes",
          "childrens",
        ],
        [
          "Choose the opposite of 'hot'.",
          "'hot' का विलोम चुनें।",
          "cold",
          "warm",
          "heated",
          "boiling",
        ],
        [
          "Choose a synonym of 'large'.",
          "'large' का समानार्थी चुनें।",
          "big",
          "tiny",
          "small",
          "little",
        ],
        [
          "Choose: The meeting begins ___ five o'clock.",
          "सही preposition चुनें।",
          "at",
          "on",
          "into",
          "over",
        ],
        [
          "Choose the correct sentence.",
          "सही वाक्य चुनें।",
          "They are playing.",
          "They is playing.",
          "They am playing.",
          "They be plays.",
        ],
        [
          "Choose the passive: 'Rina wrote the letter.'",
          "दिए वाक्य का passive चुनें।",
          "The letter was written by Rina.",
          "The letter writes Rina.",
          "Rina was letter written.",
          "The letter is writing Rina.",
        ],
        [
          "Identify the pronoun: 'She reads a book.'",
          "दिए वाक्य में pronoun चुनें।",
          "She",
          "reads",
          "book",
          "a",
        ],
      ]),
    },
    {
      id: "sanskrit-practice",
      subject: "Sanskrit",
      title: "शब्दार्थ एवं सर्वनाम · अभ्यास 01",
      questions: verbal([
        [
          "'अहम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of अहम्.",
          "मैं",
          "तुम",
          "हम",
          "वे",
        ],
        [
          "'त्वम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of त्वम्.",
          "तुम",
          "मैं",
          "हम",
          "यह सब",
        ],
        [
          "'वयम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of वयम्.",
          "हम",
          "मैं",
          "तुम",
          "वह",
        ],
        [
          "'सः' किसके लिए प्रयुक्त होता है?",
          "Identify सः (singular masculine).",
          "वह (पुल्लिंग, एकवचन)",
          "वह (स्त्रीलिंग, एकवचन)",
          "हम",
          "तुम सब",
        ],
        [
          "'सा' किसके लिए प्रयुक्त होता है?",
          "Identify सा (singular feminine).",
          "वह (स्त्रीलिंग, एकवचन)",
          "वह (पुल्लिंग, एकवचन)",
          "हम",
          "मैं",
        ],
        [
          "'जलम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of जलम्.",
          "पानी",
          "आग",
          "पेड़",
          "आकाश",
        ],
        [
          "'वृक्षः' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of वृक्षः.",
          "पेड़",
          "फूल",
          "फल",
          "पत्ता",
        ],
        [
          "'पुस्तकम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of पुस्तकम्.",
          "किताब",
          "कलम",
          "पाठशाला",
          "शिक्षक",
        ],
        [
          "'फलम्' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of फलम्.",
          "फल",
          "फूल",
          "जड़",
          "बीज",
        ],
        [
          "'पठति' का हिन्दी अर्थ चुनें।",
          "Choose the Hindi meaning of पठति.",
          "पढ़ता/पढ़ती है",
          "लिखता/लिखती है",
          "जाता/जाती है",
          "पीता/पीती है",
        ],
      ]),
    },
    {
      id: "social-practice",
      subject: "Social Science",
      title: "History, civics & geography · Practice 01",
      questions: verbal([
        [
          "In which year did India become independent?",
          "भारत किस वर्ष स्वतंत्र हुआ?",
          "1947",
          "1950",
          "1930",
          "1942",
        ],
        [
          "In which year did India become a republic?",
          "भारत किस वर्ष गणतंत्र बना?",
          "1950",
          "1947",
          "1919",
          "1930",
        ],
        [
          "Which movement is associated with the Dandi March?",
          "दांडी मार्च किस आंदोलन से जुड़ा है?",
          "Civil Disobedience / सविनय अवज्ञा",
          "Quit India / भारत छोड़ो",
          "Swadeshi of 1905 / 1905 का स्वदेशी",
          "Non-Cooperation / असहयोग",
        ],
        [
          "Which is the largest continent by area?",
          "क्षेत्रफल में सबसे बड़ा महाद्वीप कौन-सा है?",
          "Asia / एशिया",
          "Europe / यूरोप",
          "Australia / ऑस्ट्रेलिया",
          "Antarctica / अंटार्कटिका",
        ],
        [
          "Which line divides Earth into Northern and Southern hemispheres?",
          "पृथ्वी को उत्तरी और दक्षिणी गोलार्ध में कौन-सी रेखा बाँटती है?",
          "Equator / भूमध्य रेखा",
          "Prime meridian / प्रधान मध्याह्न",
          "Tropic of Cancer / कर्क रेखा",
          "Arctic Circle / आर्कटिक वृत्त",
        ],
        [
          "Which activity belongs to the primary sector?",
          "कौन-सी गतिविधि प्राथमिक क्षेत्र में आती है?",
          "Agriculture / कृषि",
          "Banking / बैंकिंग",
          "Software services / सॉफ्टवेयर सेवा",
          "Car assembly / कार असेंबली",
        ],
        [
          "Which is a renewable energy source?",
          "नवीकरणीय ऊर्जा स्रोत चुनें।",
          "Solar energy / सौर ऊर्जा",
          "Coal / कोयला",
          "Petroleum / पेट्रोलियम",
          "Natural gas / प्राकृतिक गैस",
        ],
        [
          "What is the basic idea of democracy?",
          "लोकतंत्र का मूल विचार क्या है?",
          "Government accountable to the people / जनता के प्रति जवाबदेह शासन",
          "Hereditary rule alone / केवल वंशानुगत शासन",
          "Permanent military rule / स्थायी सैन्य शासन",
          "No representation / प्रतिनिधित्व का अभाव",
        ],
        [
          "Which institution is part of village-level local self-government?",
          "ग्राम स्तर के स्थानीय स्वशासन की संस्था चुनें।",
          "Gram Panchayat / ग्राम पंचायत",
          "Supreme Court / सर्वोच्च न्यायालय",
          "Lok Sabha / लोकसभा",
          "Rajya Sabha / राज्यसभा",
        ],
        [
          "Which action helps conserve soil on slopes?",
          "ढलानों पर मृदा संरक्षण में कौन-सा कार्य सहायक है?",
          "Terrace farming / सीढ़ीदार खेती",
          "Removing all vegetation / सारी वनस्पति हटाना",
          "Uncontrolled grazing / अनियंत्रित चराई",
          "Deforestation / वनों की कटाई",
        ],
      ]),
    },
  ];
  const mcqs = [];
  for (let family = 0; family < 10; family++)
    for (let j = 1; j <= 10; j++) {
      const i = family * 10 + j;
      const cases = [
        [
          `Find the HCF of ${6 * j} and ${9 * j}.`,
          `${6 * j} और ${9 * j} का HCF ज्ञात करें।`,
          3 * j,
          `HCF(6k,9k)=3k. Here k=${j}.`,
        ],
        [
          `Roots are ${j} and ${j + 2}. Find their sum.`,
          `मूल ${j} और ${j + 2} हैं। उनका योग?`,
          2 * j + 2,
          `Sum = ${j}+${j + 2}=${2 * j + 2}.`,
        ],
        [
          `Solve 3x + ${j} = ${4 * j}.`,
          `3x + ${j} = ${4 * j} हल करें।`,
          j,
          `3x=${3 * j}, hence x=${j}.`,
        ],
        [
          `Find the common difference of ${j}, ${j + 4}, ${j + 8}, …`,
          `${j}, ${j + 4}, ${j + 8}, … का सार्व अंतर?`,
          4,
          `d = second term − first term = 4.`,
        ],
        [
          `AP has first term ${j} and common difference 2. Find its tenth term.`,
          `AP का प्रथम पद ${j}, सार्व अंतर 2 है। दसवाँ पद?`,
          j + 18,
          `a10=a+9d=${j}+18=${j + 18}.`,
        ],
        [
          `Distance between (0,0) and (${3 * j},${4 * j})?`,
          `(0,0) और (${3 * j},${4 * j}) की दूरी?`,
          5 * j,
          `sqrt((${3 * j})²+(${4 * j})²)=${5 * j}.`,
        ],
        [
          `A circle has radius ${7 * j} cm. Using π=22/7, find circumference in cm.`,
          `त्रिज्या ${7 * j} cm है। π=22/7 से परिधि (cm)?`,
          44 * j,
          `2πr=2×22/7×${7 * j}=${44 * j}.`,
        ],
        [
          `A cylinder has radius 7 cm and height ${j} cm. With π=22/7, find volume in cm³.`,
          `बेलन की त्रिज्या 7 cm, ऊँचाई ${j} cm। π=22/7 से आयतन?`,
          154 * j,
          `πr²h=(22/7)×49×${j}=${154 * j}.`,
        ],
        [
          `Find the mean of ${j}, ${j + 2} and ${j + 4}.`,
          `${j}, ${j + 2}, ${j + 4} का माध्य?`,
          j + 2,
          `Sum=${3 * j + 6}; divide by 3 to obtain ${j + 2}.`,
        ],
        [
          `A right triangle has perpendicular sides ${3 * j} and ${4 * j} cm. Find hypotenuse in cm.`,
          `समकोण त्रिभुज की लंबवत भुजाएँ ${3 * j}, ${4 * j} cm हैं। कर्ण?`,
          5 * j,
          `Pythagoras: sqrt(9+16)×${j}=${5 * j}.`,
        ],
      ];
      const [text, hi, answer, explanation] = cases[family];
      mcqs.push(numeric(text, hi, answer, explanation, i));
    }
  const shorts = Array.from({ length: 30 }, (_, i) => {
    const k = i + 1;
    if (i < 10)
      return short(
        `Solve 4x − ${k} = ${3 * k}. Show your steps.`,
        `4x − ${k} = ${3 * k} हल करें। चरण दिखाएँ।`,
        `Add ${k} to both sides: 4x=${4 * k}. Divide by 4: x=${k}.`,
        2,
        [
          ["Correct rearrangement", 1],
          ["Correct solution", 1],
        ],
      );
    if (i < 20)
      return short(
        `Find the sum of the first 10 terms of an AP with a=${k} and d=2.`,
        `AP में a=${k}, d=2 है। प्रथम 10 पदों का योग निकालें।`,
        `S10=10/2[2a+9d]=5[${2 * k}+18]=${10 * k + 90}.`,
        2,
        [
          ["Correct AP sum formula and substitution", 1],
          ["Correct evaluated sum", 1],
        ],
      );
    return short(
      `Find the midpoint of (${k},${k + 2}) and (${k + 4},${k + 6}).`,
      `(${k},${k + 2}) और (${k + 4},${k + 6}) का मध्यबिंदु ज्ञात करें।`,
      `Midpoint=((${k}+${k + 4})/2,(${k + 2}+${k + 6})/2)=(${k + 2},${k + 4}).`,
      2,
      [
        ["Correct midpoint formula and substitution", 1],
        ["Both coordinates correct", 1],
      ],
    );
  });
  const longs = Array.from({ length: 8 }, (_, i) => {
    const a = i + 2,
      b = i + 5;
    if (i === 2 || i === 3) {
      const n = i + 8,
        first = 12 + i,
        d = 3,
        last = first + (n - 1) * d,
        total = (n * (first + last)) / 2;
      return short(
        `A hall has ${n} rows. The first row has ${first} seats, and each next row has 3 more seats. Find the last row's seats and the total number of seats. Show formulas and working.`,
        `एक हॉल में ${n} पंक्तियाँ हैं। पहली पंक्ति में ${first} सीटें हैं और प्रत्येक अगली पंक्ति में 3 सीटें अधिक हैं। अंतिम पंक्ति और कुल सीटें ज्ञात करें।`,
        `a=${first}, d=3, n=${n}. Last term a_n=a+(n−1)d=${last}. S_n=n/2(a+a_n)=${n}/2(${first}+${last})=${total}. Therefore the last row has ${last} seats and the hall has ${total} seats.`,
        5,
        [
          ["Identifies AP parameters", 1],
          ["Correct last-term formula and result", 1],
          ["Correct sum formula", 1],
          ["Correct evaluated sum", 1],
          ["States both answers with seat units", 1],
        ],
      );
    }
    if (i === 4 || i === 5) {
      const h = i + 6;
      return short(
        `A solid consists of a cylinder of radius 7 cm and height ${h} cm with a cone of the same base radius and height ${3 * h} cm on top. Find the combined volume using π=22/7.`,
        `एक ठोस में 7 cm त्रिज्या और ${h} cm ऊँचाई का बेलन है, जिसके ऊपर समान आधार त्रिज्या और ${3 * h} cm ऊँचाई का शंकु है। π=22/7 से कुल आयतन निकालें।`,
        `Cylinder volume = πr²h=(22/7)×49×${h}=${154 * h} cm³. Cone volume = πr²H/3=(22/7)×49×${3 * h}/3=${154 * h} cm³. Combined volume=${308 * h} cm³.`,
        5,
        [
          ["Correct cylinder volume formula", 1],
          ["Correct cylinder volume", 1],
          ["Correct cone formula with 1/3 factor", 1],
          ["Correct cone volume", 1],
          ["Correct combined volume with cubic units", 1],
        ],
      );
    }
    if (i === 6 || i === 7) {
      const adults = i + 2,
        children = i + 1,
        total = adults + children,
        amount = 60 * adults + 40 * children;
      return short(
        `A group buys ${total} tickets costing ₹${amount}. An adult ticket costs ₹60 and a child ticket ₹40. Form simultaneous equations and find the numbers of adults and children.`,
        `एक समूह ने ₹${amount} में ${total} टिकट खरीदे। वयस्क का टिकट ₹60 और बच्चे का ₹40 है। युगपत समीकरण बनाकर वयस्कों और बच्चों की संख्या निकालें।`,
        `Let adult tickets=x and child tickets=y. x+y=${total}, 60x+40y=${amount}. Subtract 40(x+y)=${40 * total} from the cost equation: 20x=${20 * adults}. x=${adults}; y=${total}−${adults}=${children}. Check: 60×${adults}+40×${children}=${amount}.`,
        5,
        [
          ["Defines variables", 1],
          ["Forms both correct equations", 1],
          ["Correct elimination", 1],
          ["Finds both nonnegative integer counts", 1],
          ["Verifies total cost", 1],
        ],
      );
    }
    return short(
      `A rectangle has length ${b - a} cm greater than its breadth. Its area is ${a * b} cm². Form a quadratic equation and find both dimensions. Reject any invalid root.`,
      `आयत की लंबाई उसकी चौड़ाई से ${b - a} cm अधिक है तथा क्षेत्रफल ${a * b} cm² है। द्विघात समीकरण बनाकर दोनों विमाएँ ज्ञात करें। अमान्य मूल अस्वीकार करें।`,
      `Let breadth=x, length=x+${b - a}. x(x+${b - a})=${a * b}; x²+${b - a}x−${a * b}=0; (x−${a})(x+${b})=0. Roots are ${a}, −${b}. A dimension cannot be negative; breadth=${a} cm and length=${b} cm. Check ${a}×${b}=${a * b} cm².`,
      5,
      [
        ["Defines variable and forms area equation", 1],
        ["Correct quadratic equation", 1],
        ["Correct factorization and roots", 1],
        ["Rejects negative root and gives both dimensions", 1],
        ["Verifies area with units", 1],
      ],
    );
  });
  packs.push({
    id: "math-full-mock",
    subject: "Mathematics",
    title: "Mathematics · Full mock 01 · 2026 reference layout",
    fullMock: true,
    questions: [...mcqs, ...shorts, ...longs],
    sections: [
      { id: "objective", from: 0, count: 100, maxAnswers: 50 },
      { id: "short", from: 100, count: 30, maxAnswers: 15 },
      { id: "long", from: 130, count: 8, maxAnswers: 4 },
    ],
  });
  return packs;
}

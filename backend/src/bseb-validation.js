export function validateBsebDraft({ questions, source }) {
  const questionTypes = {};
  let missingObjectiveKeys = 0;
  let missingDescriptiveRubrics = 0;

  for (const question of questions) {
    const type = question.data?.type || "UNKNOWN";
    questionTypes[type] = (questionTypes[type] || 0) + 1;
    if (
      ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"].includes(type) &&
      !(question.data?.correct || []).length
    ) {
      missingObjectiveKeys += 1;
    }
    if (
      ["SHORT_ANSWER", "LONG_ANSWER"].includes(type) &&
      (!question.data?.referenceAnswer?.trim() ||
        !(question.data?.rubric || []).length)
    ) {
      missingDescriptiveRubrics += 1;
    }
  }

  const expectedOfferedQuestions = Array.isArray(source.sections) && source.sections.length
    ? source.sections.reduce((total, section) => total + (Number(section.offered) || 0), 0)
    : null;
  const extractedQuestions = questions.length;
  const extractedListedMarks = questions.reduce(
    (total, question) => total + (Number(question.data?.maximumMarks) || 0),
    0,
  );
  const expectedTheoryMarks = Number.isFinite(Number(source.theoryMarks))
    ? Number(source.theoryMarks)
    : null;
  const countDifference = expectedOfferedQuestions === null
    ? null
    : extractedQuestions - expectedOfferedQuestions;
  const warnings = [];

  if (expectedOfferedQuestions !== null && countDifference !== 0) {
    warnings.push(
      `Reference layout lists about ${expectedOfferedQuestions} offered questions/groups, while ${extractedQuestions} complete question records were extracted. Check omitted subparts, merged groups and internal choices against the PDF.`,
    );
  }
  if (missingObjectiveKeys) {
    warnings.push(`${missingObjectiveKeys} objective/numerical questions have no suggested answer key; verify or complete them before publishing.`);
  }
  if (missingDescriptiveRubrics) {
    warnings.push(`${missingDescriptiveRubrics} descriptive questions have incomplete reference answers/rubrics; complete them before publishing.`);
  }
  if (extractedQuestions === 0) {
    warnings.push("No questions were extracted. Do not publish this draft.");
  }

  return {
    status: "REVIEW_REQUIRED",
    extractedQuestions,
    extractedListedMarks,
    expectedTheoryMarks,
    expectedOfferedQuestions,
    countDifference,
    questionTypes,
    missingObjectiveKeys,
    missingDescriptiveRubrics,
    warnings,
  };
}

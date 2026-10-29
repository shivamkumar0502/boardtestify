import { tr, useLanguage } from "@boardtestify/i18n";
export function PaperGuide({ paper }) {
  useLanguage();
  if (!paper) return null;
  return (
    <details className="panel paper-guide">
      <summary>
        {tr("Paper pattern & marks")} · {paper.theoryMarks ?? "—"}{" "}
        {tr("theory marks")} · {tr(paper.label || "2026 model-paper reference")}
      </summary>
      <p>
        {tr(
          paper.paperQuestionLabel ||
            "Offered questions include internal choices.",
        )}
      </p>
      {paper.minimumPassingMarks != null && (
        <p className="small muted">
          {tr("Minimum passing marks in this approved pattern")}: {paper.minimumPassingMarks}
        </p>
      )}
      {paper.durationMinutes != null && (
        <p className="small muted">
          {tr("Writing time")}:{" "}
          {paper.writingMinutes ??
            paper.durationMinutes - (paper.readingMinutes || 0)}{" "}
          {tr("min")} + {paper.readingMinutes || 0} {tr("min reading")}.
          {paper.otherAssessmentMarks != null &&
            ` ${paper.otherAssessmentMarks} ${tr("practical/internal marks separate")}.`}
        </p>
      )}
      {!!paper.sections?.length && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr("Section")}</th>
                <th>{tr("Offered")}</th>
                <th>{tr("Attempt")}</th>
                <th>{tr("Marks each")}</th>
                <th>{tr("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {paper.sections.map((s) => (
                <tr key={s.id}>
                  <td>{tr(s.title)}</td>
                  <td>{s.offered}</td>
                  <td>{s.answerCount}</td>
                  <td>{s.marksEach}</td>
                  <td>{s.answerCount * s.marksEach}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        {tr(
          "Language papers use grouped tasks with subparts and internal choices. Keep passage questions together. Practical/internal assessment is not included in an online theory mock.",
        )}
      </p>
      {paper.sourceUrl && (
        <a href={paper.sourceUrl} target="_blank" rel="noreferrer">
          {tr("Read official model paper")}
        </a>
      )}
    </details>
  );
}

// Generates the formatted intake summary .docx, matching the convention
// used consistently across past client deliverables:
//   green  = score 8-10, selected
//   gray   = score 1, unselected (NOT weak, just not picked)
//   blue   = achievement flagged isReal: true
//   orange = achievement flagged isReal: false (suggested, needs client confirmation)
// Signed "Maride - 360-265-6823", not the business name alone.
//
// Expects a normalized input shape (see generateIntakeDocx jsdoc below).
// Mapping the raw Google Sheet "Job Ratings" / "Essay Answers" cell JSON
// into this shape is NOT done here, that mapping wasn't available to
// verify against the real sheet structure, wire it up in results.js or
// output.js once the actual cell format is confirmed against a live row.

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType
} = require('docx');

const GREEN_FILL = 'D9EAD3';
const GRAY_FILL = 'E8E8E8';
const BLUE_FILL = 'CFE2F3';
const ORANGE_FILL = 'FCE5CD';
const HEADER_FILL = '3B1E6B';

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function scoreFill(score) {
  // Only two states matter per the established convention: selected (8-10)
  // or unselected (1). Anything in between shouldn't occur given the
  // intake tool's slider design, but default to gray rather than guessing
  // at a meaning for it.
  return score >= 8 ? GREEN_FILL : GRAY_FILL;
}

function cell(text, { fill, width, bold = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    borders: allBorders,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold })]
      })
    ]
  });
}

function scoredItemsTable(items, colLabel) {
  const columnWidths = [7200, 1440];
  const headerRow = new TableRow({
    children: [
      cell(colLabel, { fill: HEADER_FILL, width: columnWidths[0], bold: true }),
      cell('Score', { fill: HEADER_FILL, width: columnWidths[1], bold: true })
    ]
  });

  const rows = items.map(
    (item) =>
      new TableRow({
        children: [
          cell(item.text, { width: columnWidths[0] }),
          cell(String(item.score), { fill: scoreFill(item.score), width: columnWidths[1] })
        ]
      })
  );

  return new Table({ columnWidths, rows: [headerRow, ...rows] });
}

function achievementsTable(achievements) {
  const columnWidths = [7200, 1440];
  const headerRow = new TableRow({
    children: [
      cell('Achievement', { fill: HEADER_FILL, width: columnWidths[0], bold: true }),
      cell('Status', { fill: HEADER_FILL, width: columnWidths[1], bold: true })
    ]
  });

  const rows = achievements.map(
    (a) =>
      new TableRow({
        children: [
          cell(a.text, { width: columnWidths[0] }),
          cell(a.isReal ? 'Real' : 'Suggested', {
            fill: a.isReal ? BLUE_FILL : ORANGE_FILL,
            width: columnWidths[1]
          })
        ]
      })
  );

  return new Table({ columnWidths, rows: [headerRow, ...rows] });
}

function legend() {
  const columnWidths = [1800, 1800, 1800, 1800];
  const row = new TableRow({
    children: [
      cell('Score 8-10, selected', { fill: GREEN_FILL, width: columnWidths[0] }),
      cell('Score 1, unselected', { fill: GRAY_FILL, width: columnWidths[1] }),
      cell('Achievement, real', { fill: BLUE_FILL, width: columnWidths[2] }),
      cell('Achievement, suggested', { fill: ORANGE_FILL, width: columnWidths[3] })
    ]
  });
  return new Table({ columnWidths, rows: [row] });
}

/**
 * @param {Object} data
 * @param {string} data.clientName
 * @param {string} data.targetRole
 * @param {Array} data.jobs - [{ title, company, years, skills: [{text, score}], activities: [{text, score}], achievements: [{text, isReal}] }]
 * @param {Array} data.essayQuestions - [{ question, answer }]
 * @returns {Promise<Buffer>}
 */
async function generateIntakeDocx(data) {
  const { clientName, targetRole, jobs, essayQuestions = [] } = data;

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: clientName, bold: true })]
    }),
    new Paragraph({
      children: [new TextRun({ text: `Target role: ${targetRole}`, italics: true })]
    }),
    new Paragraph({ text: '' }),
    legend(),
    new Paragraph({ text: '' })
  ];

  jobs.forEach((job, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: `${job.title}, ${job.company}` })]
      }),
      new Paragraph({
        children: [new TextRun({ text: job.years, italics: true })]
      }),
      new Paragraph({ text: '' })
    );

    if (job.skills?.length) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Skills')] }),
        scoredItemsTable(job.skills, 'Skill'),
        new Paragraph({ text: '' })
      );
    }

    if (job.activities?.length) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Activities')] }),
        scoredItemsTable(job.activities, 'Activity'),
        new Paragraph({ text: '' })
      );
    }

    if (job.achievements?.length) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Achievements')] }),
        achievementsTable(job.achievements),
        new Paragraph({ text: '' })
      );
    }

    if (i < jobs.length - 1) {
      children.push(new Paragraph({ text: '', border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } } }));
    }
  });

  if (essayQuestions.length) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Essay Responses')] }),
      new Paragraph({ text: '' })
    );
    essayQuestions.forEach((qa) => {
      children.push(
        new Paragraph({ children: [new TextRun({ text: qa.question, bold: true })] }),
        new Paragraph({ children: [new TextRun(qa.answer || '[no response]')] }),
        new Paragraph({ text: '' })
      );
    });
  }

  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'Maride - 360-265-6823', italics: true })]
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 } } // US Letter
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateIntakeDocx };

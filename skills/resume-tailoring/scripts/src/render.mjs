import Ajv from 'ajv';
import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink,
  HeadingLevel, LevelFormat, AlignmentType, PageBreak,
} from 'docx';
import schema from '../../references/resume-document.schema.json' with { type: 'json' };

const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);

export function validateModel(model) {
  if (!validate(model)) {
    throw new Error(`Invalid approved resume model: ${new Ajv().errorsText(validate.errors, { separator: '; ' })}`);
  }
}

function escapeMarkdown(text) {
  return text.replace(/[\\`*_{}[\]<>#!|~]/g, '\\$&')
    .replace(/^([-+])(?=\s)/, '\\$1')
    .replace(/^(\d+)([.)])(?=\s)/, '$1\\$2');
}

function markdownRuns(runs) {
  return runs.map(({ text, bold, italic, link }) => {
    let value = escapeMarkdown(text);
    if (bold) value = `**${value}**`;
    if (italic) value = `*${value}*`;
    if (link) value = `[${value}](<${link.replaceAll('>', '%3E').replaceAll('<', '%3C')}>)`;
    return value;
  }).join('');
}

export function renderMarkdown(model) {
  const lines = [`# ${escapeMarkdown(model.name)}`, ''];
  for (const contact of model.contact ?? []) lines.push(markdownRuns(contact), '');
  for (const section of model.sections) {
    lines.push(`## ${escapeMarkdown(section.heading)}`, '');
    for (const block of section.blocks) {
      if (block.type === 'pageBreak') continue;
      const prefix = block.type === 'heading' ? '### ' : block.type === 'bullet' ? '- ' : '';
      lines.push(`${prefix}${markdownRuns(block.runs)}`, '');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function wordRuns(runs) {
  return runs.map(({ text, bold, italic, link }) => {
    const run = new TextRun({ text, bold, italics: italic, ...(link ? { style: 'Hyperlink' } : {}) });
    return link ? new ExternalHyperlink({ link, children: [run] }) : run;
  });
}

export async function renderDocx(model) {
  const format = { paper: 'A4', font: 'Calibri', bodyPt: 11, headingPt: 12, marginInches: 0.75, ...model.format };
  const [width, height] = format.paper === 'Letter' ? [12240, 15840] : [11906, 16838];
  const margin = Math.round(format.marginInches * 1440);
  const children = [new Paragraph({
    children: [new TextRun({ text: model.name, bold: true, size: 32 })],
    keepNext: true,
    spacing: { after: 120 },
  })];
  for (const contact of model.contact ?? []) children.push(new Paragraph({ children: wordRuns(contact), spacing: { after: 80 }, keepNext: true }));
  for (const section of model.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    for (const block of section.blocks) {
      if (block.type === 'pageBreak') {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        continue;
      }
      children.push(new Paragraph({
        children: wordRuns(block.runs),
        ...(block.type === 'heading' ? { heading: HeadingLevel.HEADING_2 } : {}),
        ...(block.type === 'bullet' ? { numbering: { reference: 'resume-bullets', level: 0 } } : {}),
        keepNext: block.keepWithNext ?? block.type === 'heading',
        keepLines: true,
        pageBreakBefore: block.pageBreakBefore ?? false,
        spacing: { after: 80, line: 240 },
      }));
    }
  }
  const headingStyle = (id, name, level) => ({
    id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { font: format.font, size: format.headingPt * 2, bold: true, color: '000000' },
    paragraph: { spacing: { before: 160, after: 100 }, keepNext: true, outlineLevel: level },
  });
  return Packer.toBuffer(new Document({
    creator: 'Resume Tailoring',
    title: `${model.name} - ${model.role}`,
    styles: {
      default: { document: { run: { font: format.font, size: format.bodyPt * 2 }, paragraph: { widowControl: true } } },
      paragraphStyles: [headingStyle('Heading1', 'Heading 1', 0), headingStyle('Heading2', 'Heading 2', 1)],
    },
    numbering: { config: [{
      reference: 'resume-bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 240, hanging: 180 } } },
      }],
    }] },
    sections: [{
      properties: { page: { size: { width, height }, margin: { top: margin, right: margin, bottom: margin, left: margin } } },
      children,
    }],
  }));
}

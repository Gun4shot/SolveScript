const WRITTEN_PAPER_SPECS = [
  // The science practical paper is intentionally omitted: it is a live lab
  // assessment. Paper 5 is a written planning/analysis paper and is included.
  ...['9700', '9701', '9702'].flatMap((syllabusCode) => [
    {
      syllabusCode,
      paperNumber: '2',
      paperType: 'structured',
      title: 'AS Level Structured Questions',
      durationMinutes: 75,
      totalMarks: 60,
    },
    {
      syllabusCode,
      paperNumber: '4',
      paperType: 'structured',
      title: 'A Level Structured Questions',
      durationMinutes: 120,
      totalMarks: 100,
    },
    {
      syllabusCode,
      paperNumber: '5',
      paperType: 'planning-analysis',
      title: 'Planning, Analysis and Evaluation',
      durationMinutes: 75,
      totalMarks: 30,
    },
  ]),
  {
    syllabusCode: '9708',
    paperNumber: '2',
    paperType: 'data-response-essay',
    title: 'AS Level Data Response and Essays',
    durationMinutes: 120,
    totalMarks: 60,
  },
  {
    syllabusCode: '9708',
    paperNumber: '4',
    paperType: 'data-response-essay',
    title: 'A Level Data Response and Essays',
    durationMinutes: 120,
    totalMarks: 90,
  },
  {
    syllabusCode: '9709',
    paperNumber: '1',
    paperType: 'mathematics',
    title: 'Pure Mathematics 1',
    durationMinutes: 110,
    totalMarks: 75,
  },
  {
    syllabusCode: '9709',
    paperNumber: '3',
    paperType: 'mathematics',
    title: 'Pure Mathematics 3',
    durationMinutes: 110,
    totalMarks: 75,
  },
  {
    syllabusCode: '9709',
    paperNumber: '4',
    paperType: 'mathematics',
    title: 'Mechanics',
    durationMinutes: 75,
    totalMarks: 50,
  },
  {
    syllabusCode: '9709',
    paperNumber: '5',
    paperType: 'mathematics',
    title: 'Probability & Statistics 1',
    durationMinutes: 75,
    totalMarks: 50,
  },
  {
    syllabusCode: '9709',
    paperNumber: '6',
    paperType: 'mathematics',
    title: 'Probability & Statistics 2',
    durationMinutes: 75,
    totalMarks: 50,
  },
  {
    syllabusCode: '9231',
    paperNumber: '1',
    paperType: 'further-mathematics',
    title: 'Further Pure Mathematics 1',
    durationMinutes: 120,
    totalMarks: 75,
  },
  {
    syllabusCode: '9231',
    paperNumber: '2',
    paperType: 'further-mathematics',
    title: 'Further Pure Mathematics 2',
    durationMinutes: 120,
    totalMarks: 75,
  },
  {
    syllabusCode: '9231',
    paperNumber: '3',
    paperType: 'further-mathematics',
    title: 'Further Mechanics',
    durationMinutes: 90,
    totalMarks: 50,
  },
  {
    syllabusCode: '9231',
    paperNumber: '4',
    paperType: 'further-mathematics',
    title: 'Further Probability & Statistics',
    durationMinutes: 90,
    totalMarks: 50,
  },
];

const SUBJECT_NAMES = {
  9700: 'Biology',
  9701: 'Chemistry',
  9702: 'Physics',
  9708: 'Economics',
  9709: 'Mathematics',
  9231: 'Further Mathematics',
};

function getWrittenPaperSpec(syllabusCode, component) {
  const paperNumber = String(component || '').slice(0, 1);
  return WRITTEN_PAPER_SPECS.find(
    (spec) => spec.syllabusCode === String(syllabusCode) && spec.paperNumber === paperNumber,
  ) || null;
}

function expectedPaperNumbers(syllabusCode) {
  const written = WRITTEN_PAPER_SPECS
    .filter((spec) => spec.syllabusCode === String(syllabusCode))
    .map((spec) => spec.paperNumber);
  return ['9700', '9701', '9702', '9708'].includes(String(syllabusCode))
    ? ['1', ...written]
    : written;
}

module.exports = { WRITTEN_PAPER_SPECS, SUBJECT_NAMES, expectedPaperNumbers, getWrittenPaperSpec };

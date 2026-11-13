/**
 * Psychometric content rules, ported 1:1 from the standalone platform
 * (routes/adminCRUD.js validators + controllers/adminCRUDController.js). Pure —
 * no DB — so the admin handlers and the migration share one definition.
 */

export const QUESTION_TYPES = [
  'LIKERT_SCALE', 'SITUATIONAL', 'NUMERICAL_ABILITY', 'PERCENTAGE_TYPE',
  'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED',
  'MULTI_SELECT', 'RANKING',
] as const;

export const DIMENSIONS = [
  'Communication', 'Leadership', 'Problem Solving', 'Risk Taking', 'Teamwork',
  'Creativity', 'Financial Awareness', 'Business Mindset', 'Emotional Intelligence',
  'Numerical Ability', 'Logical Ability', 'Verbal Ability',
] as const;

export const SINGLE_CORRECT_TYPES = ['NUMERICAL_ABILITY', 'PERCENTAGE_TYPE', 'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED'];

const isPositiveInt = (v: unknown) => Number.isInteger(typeof v === 'string' ? Number(v) : v) && Number(v) >= 1;
const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

export interface OptionInput {
  _id?: string;
  optionText?: string;
  optionImageUrl?: string;
  score?: number;
  isCorrect?: boolean;
  dimensionScores?: Record<string, number> | null;
  order?: number;
}

/** First validation message for a question create/update body, or null when valid. */
export function validateQuestionBody(body: any): string | null {
  if (isEmpty(body?.typeId)) return 'Category is required.';
  if (isEmpty(body?.text)) return 'Question text is required.';
  if (!isPositiveInt(body?.order)) return 'Display order must be a positive number.';
  if (!QUESTION_TYPES.includes(body?.questionType)) return 'A valid question type is required.';
  if (!isEmpty(body?.language) && !['en', 'ta'].includes(body.language)) return 'Language must be English (en) or Tamil (ta).';
  if (!DIMENSIONS.includes(body?.dimension)) return 'A valid dimension is required.';
  if (!(Number(body?.marks) > 0)) return 'Marks must be a positive number.';
  const options: OptionInput[] = body?.options;
  if (!Array.isArray(options) || options.length < 1) return 'At least one answer option is required.';
  if (body.questionType === 'IMAGE_BASED' && !body.imageUrl) return 'Image-based questions require an image URL.';
  if (body.hasAudio && !body.audioUrl) return 'Enable-audio questions need an uploaded audio file or URL.';
  if (body.audioUrl && String(body.audioUrl).length > 4_600_000) return 'Audio file is too large. Please use a clip under 3 MB.';

  const type = body.questionType;
  if (type === 'LIKERT_SCALE' && options.length < 5) return 'Likert-scale questions need at least 5 scored options.';
  if (SINGLE_CORRECT_TYPES.includes(type) && options.filter((o) => o.isCorrect).length !== 1) return 'Select exactly one correct answer.';
  if (type === 'SITUATIONAL' && !options.every((o) => o.dimensionScores && Object.keys(o.dimensionScores).length)) {
    return 'Every situational option needs at least one dimension score.';
  }
  if (type === 'MULTI_SELECT') {
    if (!['exact', 'partial'].includes(body.scoringMode)) return 'Select a scoring mode (exact or partial) for multi-select questions.';
    if (!options.some((o) => o.isCorrect)) return 'Select at least one correct answer.';
  }
  if (type === 'RANKING' && options.length < 2) return 'Ranking questions need at least 2 items to order.';
  for (const o of options) {
    if (isEmpty(o.optionText)) return 'Option text is required.';
    if (!Number.isFinite(Number(o.score))) return 'Score must be a number.';
  }
  return null;
}

/**
 * The answer key is never trusted from the client (brand-new options have no
 * id yet); it is derived from the saved options: isCorrect flags for
 * single/multi-correct types, and for RANKING the saved option order.
 */
export function deriveAnswerKey(questionType: string, savedOptions: { _id: string; isCorrect: boolean }[]) {
  if (SINGLE_CORRECT_TYPES.includes(questionType)) {
    const correct = savedOptions.find((o) => o.isCorrect);
    return { correctOptionId: correct ? correct._id : null, correctOptionIds: null, idealOrder: null };
  }
  if (questionType === 'MULTI_SELECT') {
    return { correctOptionId: null, correctOptionIds: savedOptions.filter((o) => o.isCorrect).map((o) => o._id), idealOrder: null };
  }
  if (questionType === 'RANKING') {
    return { correctOptionId: null, correctOptionIds: null, idealOrder: savedOptions.map((o) => o._id) };
  }
  return { correctOptionId: null, correctOptionIds: null, idealOrder: null };
}

/** Order-preserving dedupe (a set's questionIds order IS its question order). */
export function dedupeIds(ids: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = String(id);
    if (!seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out;
}

export function validateQuestionSetBody(body: any): string | null {
  if (isEmpty(body?.name)) return 'Set name is required.';
  if (String(body.name).length > 100) return 'Set name must be 100 characters or fewer.';
  if (!isPositiveInt(body?.durationMinutes)) return 'Duration must be a whole number of minutes (at least 1).';
  if (!Array.isArray(body?.questionIds) || body.questionIds.length < 1) return 'Select at least one question for the set.';
  if (body.questionIds.some((id: unknown) => typeof id !== 'string' || !id.trim())) return 'Invalid question reference.';
  return null;
}

export function validateAccessCodeBody(body: any): string | null {
  if (isEmpty(body?.code)) return 'Code is required.';
  if (!/^[A-Za-z0-9]+$/.test(String(body.code))) return 'Code must contain only letters and numbers.';
  if (String(body.code).length < 4 || String(body.code).length > 20) return 'Code must be 4–20 characters.';
  if (isEmpty(body?.label)) return 'Label is required.';
  return null;
}

export function validateQuestionTypeBody(body: any): string | null {
  if (isEmpty(body?.name)) return 'Category name is required.';
  if (!isPositiveInt(body?.order)) return 'Display order must be a positive number.';
  if (isEmpty(body?.description)) return 'Description is required.';
  return null;
}

export function validateMatrixCellBody(body: any): string | null {
  if (isEmpty(body?.rowTypeId)) return 'Row category is required.';
  if (isEmpty(body?.colTypeId)) return 'Column category is required.';
  if (isEmpty(body?.businessName)) return 'Business/role name is required.';
  if (String(body.businessName).length > 80) return 'Business/role name must be 80 characters or fewer.';
  const r = Number(body?.rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return 'Rating must be a number from 1 to 5.';
  return null;
}

// ── Business-matrix sample (utils/businessMatrixSample.js) ─────────────────────
export const MATRIX_TRAITS = [
  'Communication', 'Creativity', 'Problem Solving', 'Leadership',
  'Risk Taking', 'Financial Awareness', 'Business Mindset', 'Teamwork',
  'Numerical Ability', 'Logical Ability', 'Verbal Ability',
];

const GRID8: [string, number][][] = [
  [['Public Relations Agency', 5], ['Advertising & Branding Studio', 4], ['Management Consulting', 4], ['Corporate Training & Coaching', 4], ['Media & PR Startup', 3], ['Investor Relations Firm', 3], ['Sales & Marketing Agency', 5], ['Community Engagement Platform', 4]],
  [['Content & Storytelling Studio', 4], ['Design Studio', 5], ['Product Design Lab', 4], ['Creative Direction Agency', 4], ['Experimental Media Startup', 3], ['Creative Monetization Consultancy', 3], ['Innovation & R&D Venture', 4], ['Collaborative Arts Collective', 3]],
  [['Technical Advisory Services', 4], ['R&D Innovation Lab', 4], ['Analytics & Research Firm', 5], ['Operations Strategy Consulting', 4], ['Deep-Tech Startup', 4], ['Quantitative Analysis Firm', 4], ['Process Optimization Consultancy', 4], ['Engineering Services Company', 4]],
  [['Executive Coaching Practice', 4], ['Creative Agency Leadership', 3], ['Turnaround Management Firm', 4], ['Corporate Strategy Consulting', 5], ['Startup Founder / Venture', 5], ['Private Equity Management', 4], ['Franchise / Business Ownership', 4], ['Team Leadership & HR Consulting', 4]],
  [['Sales-Driven Startup', 3], ['Disruptive Tech Startup', 4], ['FinTech Venture', 4], ['Entrepreneur / Founder', 5], ['Angel Investing & Trading', 5], ['Investment & Trading Firm', 4], ['Startup Incubator', 4], ['Co-Founder Venture Team', 4]],
  [['Financial Advisory Firm', 4], ['FinTech Product Studio', 3], ['Investment Analysis Firm', 5], ['Wealth Management Practice', 4], ['Trading & Investment Desk', 4], ['Accounting & Audit Firm', 5], ['Financial Consulting Business', 4], ['Cooperative Finance / Fund', 3]],
  [['Marketing & Growth Agency', 4], ['Product Startup', 4], ['Business Consulting Firm', 5], ['Enterprise Founder / CEO', 5], ['High-Growth Startup', 5], ['Business Investment Firm', 4], ['Serial Entrepreneurship', 5], ['Franchise Network Business', 4]],
  [['HR & People Operations', 4], ['Creative Studio Collective', 3], ['Agile Engineering Team', 4], ['Team Management Consultancy', 4], ['Startup Co-Founding Team', 3], ['Cooperative Business / Fund', 3], ['Partnership Enterprise', 4], ['Collaborative Services Firm', 5]],
];

const APTITUDE_POOLS: [string, number][][] = [
  [['Data Analytics Firm', 5], ['Financial Modelling Practice', 5], ['Quantitative Trading Desk', 4], ['Actuarial & Risk Services', 4], ['Accounting & Audit Firm', 4], ['Pricing & Revenue Consultancy', 4], ['Statistics & Insights Agency', 4], ['Fintech Analytics Startup', 4], ['Data Science Lab', 5], ['Investment Research Firm', 4], ['Business Intelligence Consultancy', 4]],
  [['Software Engineering Studio', 5], ['Systems Architecture Consultancy', 4], ['Algorithm & Automation Lab', 4], ['Operations Research Firm', 4], ['Cybersecurity Services', 4], ['AI / Machine Learning Lab', 5], ['Process Automation Consultancy', 4], ['Technical Strategy Consulting', 4], ['QA & Testing Services', 3], ['Product Engineering Team', 4], ['IT Solutions Company', 4]],
  [['Content & Copywriting Studio', 5], ['Legal & Compliance Services', 4], ['Editorial & Publishing House', 4], ['Communications Consultancy', 4], ['Translation & Localization', 4], ['Public Speaking & Training', 4], ['Journalism & Media Agency', 3], ['Technical Writing Services', 4], ['Brand Messaging Agency', 4], ['Language Education Startup', 4], ['Corporate Communications Firm', 4]],
];

/** Sample business recommendation for a (row, col) category pair. */
export function sampleMatrixCell(rowName: string, colName: string): [string, number] {
  const ri = MATRIX_TRAITS.indexOf(rowName);
  const ci = MATRIX_TRAITS.indexOf(colName);
  if (ri >= 0 && ri < 8 && ci >= 0 && ci < 8) return GRID8[ri][ci];
  const aptIdx = ri >= 8 ? ri : ci >= 8 ? ci : -1;
  if (aptIdx >= 0) {
    const pool = APTITUDE_POOLS[aptIdx - 8];
    const other = aptIdx === ri ? ci : ri;
    return pool[((other % pool.length) + pool.length) % pool.length];
  }
  return [`${rowName} Venture`.slice(0, 80), 3];
}

/**
 * Psychometric scoring, ported 1:1 from the standalone platform
 * (utils/evaluationEngine.js, utils/scoreCalculator.js,
 * utils/businessRecommendationEngine.js). Pure — results must stay identical to
 * the old platform so migrated and new results are comparable.
 */

export interface ScoringQuestion {
  id: string;
  typeId: string;
  questionType: string;
  dimension: string;
  marks: number;
  correctOptionId?: string | null;
  correctOptionIds?: string[] | null;
  idealOrder?: string[] | null;
  scoringMode?: string | null;
}

export interface ScoringOption {
  id: string;
  score: number;
  dimensionScores?: Record<string, number> | null;
}

export interface Evaluation {
  score: number;
  maxScore: number;
  isCorrect: boolean | null;
  dimensionScores: Record<string, number>;
}

const fixed2 = (n: number) => parseFloat(n.toFixed(2));
const fixed1 = (n: number) => parseFloat(n.toFixed(1));

// ── Evaluators (one per question type) ─────────────────────────────────────

function evaluateLikert(q: ScoringQuestion, options: ScoringOption[], answer: string): Evaluation {
  const chosen = options.find((o) => o.id === String(answer));
  if (!chosen) throw new Error('Invalid answer option for LIKERT_SCALE question.');
  return { score: chosen.score, maxScore: q.marks, isCorrect: null, dimensionScores: { [q.dimension]: chosen.score } };
}

// Correct option → full marks, anything else → 0.
function evaluateSingleCorrect(q: ScoringQuestion, options: ScoringOption[], answer: string): Evaluation {
  const chosenId = String(answer);
  if (!options.some((o) => o.id === chosenId)) throw new Error(`Invalid answer option for ${q.questionType} question.`);
  const isCorrect = !!(q.correctOptionId && String(q.correctOptionId) === chosenId);
  const score = isCorrect ? q.marks : 0;
  return { score, maxScore: q.marks, isCorrect, dimensionScores: { [q.dimension]: score } };
}

// `isReverseScored` is intentionally never read: an option's score already
// reflects the direction (admin-authoring model).

// One option maps to several dimensions; maxScore = the best option's total.
function evaluateSituational(q: ScoringQuestion, options: ScoringOption[], answer: string): Evaluation {
  const chosen = options.find((o) => o.id === String(answer));
  if (!chosen) throw new Error('Invalid answer option for SITUATIONAL question.');
  const sum = (o: ScoringOption) => Object.values(o.dimensionScores || {}).reduce((a, b) => a + b, 0);
  return {
    score: sum(chosen),
    maxScore: Math.max(...options.map(sum), 0),
    isCorrect: null,
    dimensionScores: { ...(chosen.dimensionScores || {}) },
  };
}

// exact: all-or-nothing. partial: marks * max(0, correct - incorrect) / totalCorrect.
function evaluateMultiSelect(q: ScoringQuestion, options: ScoringOption[], answer: string | string[]): Evaluation {
  const selectedIds = (Array.isArray(answer) ? answer : [answer]).map(String);
  if (!selectedIds.length) throw new Error('At least one option must be selected for a MULTI_SELECT question.');
  if (!selectedIds.every((id) => options.some((o) => o.id === id))) throw new Error('Invalid answer option for MULTI_SELECT question.');
  const correctSet = new Set((q.correctOptionIds || []).map(String));
  const correctSelected = selectedIds.filter((id) => correctSet.has(id)).length;
  const incorrectSelected = selectedIds.length - correctSelected;
  const isFullyCorrect = correctSelected === correctSet.size && incorrectSelected === 0;
  let score: number;
  if (q.scoringMode === 'exact') {
    score = isFullyCorrect ? q.marks : 0;
  } else {
    const ratio = correctSet.size ? Math.max(0, correctSelected - incorrectSelected) / correctSet.size : 0;
    score = fixed2(q.marks * ratio);
  }
  return { score, maxScore: q.marks, isCorrect: isFullyCorrect, dimensionScores: { [q.dimension]: score } };
}

// Positions that exactly match idealOrder.
function evaluateRanking(q: ScoringQuestion, options: ScoringOption[], answer: string[]): Evaluation {
  const ranking = Array.isArray(answer) ? answer.map(String) : [];
  const idealOrder = (q.idealOrder || []).map(String);
  if (!idealOrder.length) throw new Error('This RANKING question has no ideal order configured.');
  if (ranking.length !== idealOrder.length || !ranking.every((id) => options.some((o) => o.id === id))) {
    throw new Error('Invalid ranking submitted for RANKING question.');
  }
  const matches = ranking.filter((id, i) => id === idealOrder[i]).length;
  const score = fixed2(q.marks * (matches / idealOrder.length));
  return { score, maxScore: q.marks, isCorrect: matches === idealOrder.length, dimensionScores: { [q.dimension]: score } };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EVALUATORS: Record<string, (q: ScoringQuestion, o: ScoringOption[], a: any) => Evaluation> = {
  LIKERT_SCALE: evaluateLikert,
  NUMERICAL_ABILITY: evaluateSingleCorrect,
  PERCENTAGE_TYPE: evaluateSingleCorrect,
  PUZZLE_TYPE: evaluateSingleCorrect,
  LOGICAL_ABILITY: evaluateSingleCorrect,
  VERBAL_ABILITY: evaluateSingleCorrect,
  IMAGE_BASED: evaluateSingleCorrect,
  SITUATIONAL: evaluateSituational,
  MULTI_SELECT: evaluateMultiSelect,
  RANKING: evaluateRanking,
};

export function evaluateAnswer(q: ScoringQuestion, options: ScoringOption[], answer: unknown): Evaluation {
  const evaluator = EVALUATORS[q.questionType];
  if (!evaluator) throw new Error(`No evaluator registered for questionType "${q.questionType}".`);
  return evaluator(q, options, answer);
}

// ── Business recommendations (rule-based, by dimension %) ──────────────────

export const LOW_RISK_TAKING_THRESHOLD = 40;
const pct = (d: Record<string, number>, dim: string) => d[dim] || 0;

const RULES: { matches: (d: Record<string, number>) => boolean; businesses: string[]; explain: (d: Record<string, number>) => string }[] = [
  {
    matches: (d) => pct(d, 'Communication') >= 75 && pct(d, 'Leadership') >= 70 && pct(d, 'Risk Taking') >= 70,
    businesses: ['Sales Agency', 'Marketing Agency', 'Training Institute', 'Franchise Business'],
    explain: (d) => `Strong Communication (${pct(d, 'Communication')}%), Leadership (${pct(d, 'Leadership')}%) and Risk Taking (${pct(d, 'Risk Taking')}%) point toward customer-facing, growth-driven ventures.`,
  },
  {
    matches: (d) => pct(d, 'Creativity') >= 75 && pct(d, 'Communication') >= 65,
    businesses: ['Branding Agency', 'Content Creation Business', 'Digital Marketing Agency', 'Fashion/Design Business'],
    explain: (d) => `High Creativity (${pct(d, 'Creativity')}%) paired with solid Communication (${pct(d, 'Communication')}%) suits brand- and content-driven businesses.`,
  },
  {
    matches: (d) => pct(d, 'Financial Awareness') >= 75 && pct(d, 'Business Mindset') >= 70,
    businesses: ['Trading Business', 'Distribution Business', 'Finance Consulting', 'Retail Business'],
    explain: (d) => `Strong Financial Awareness (${pct(d, 'Financial Awareness')}%) and Business Mindset (${pct(d, 'Business Mindset')}%) suit margin-driven, numbers-focused businesses.`,
  },
  {
    matches: (d) => pct(d, 'Problem Solving') >= 75 && pct(d, 'Logical Ability') >= 70,
    businesses: ['IT Services', 'Software Startup', 'Tech Support Business', 'Automation Services'],
    explain: (d) => `Strong Problem Solving (${pct(d, 'Problem Solving')}%) and Logical Ability (${pct(d, 'Logical Ability')}%) suit technical, systems-oriented businesses.`,
  },
  {
    matches: (d) => pct(d, 'Teamwork') >= 75 && pct(d, 'Leadership') >= 70,
    businesses: ['Event Management', 'Service Agency', 'HR/Recruitment Agency'],
    explain: (d) => `Strong Teamwork (${pct(d, 'Teamwork')}%) and Leadership (${pct(d, 'Leadership')}%) suit people-management and coordination-heavy businesses.`,
  },
  {
    matches: (d) => pct(d, 'Risk Taking') < LOW_RISK_TAKING_THRESHOLD,
    businesses: ['Franchise', 'Reselling', 'Home-based Business', 'Service-based Small Business'],
    explain: (d) => `Lower Risk Taking (${pct(d, 'Risk Taking')}%) suggests starting with lower-risk, established business models before scaling up.`,
  },
];

const FALLBACK = {
  businesses: ['Freelance Services', 'Small Retail Business', 'Local Service Business'],
  explanation: 'No single dimension stands out strongly yet — starting with a low-commitment, low-risk business while building your strengths is a solid first step.',
};

export function getRecommendations(dimensionPercentages: Record<string, number>) {
  const out: { business: string; explanation: string }[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    if (!rule.matches(dimensionPercentages)) continue;
    const explanation = rule.explain(dimensionPercentages);
    for (const business of rule.businesses) {
      if (seen.has(business)) continue;
      seen.add(business);
      out.push({ business, explanation });
      if (out.length >= 5) return out;
    }
  }
  if (!out.length) for (const business of FALLBACK.businesses) out.push({ business, explanation: FALLBACK.explanation });
  return out.slice(0, 5);
}

// ── Result calculation ─────────────────────────────────────────────────────

const IMPROVEMENT_SUGGESTIONS: Record<string, string> = {
  'Communication': 'Practice public speaking, join groups like Toastmasters, and work on active listening and written communication skills.',
  'Creativity': 'Engage with design thinking exercises, explore creative hobbies, and practice brainstorming techniques daily.',
  'Problem Solving': 'Take up logic puzzles, study case studies, and practice structured problem-solving frameworks like 5 Whys and SWOT.',
  'Leadership': 'Seek leadership roles in groups, study influential leaders, and work on emotional intelligence and conflict resolution.',
  'Risk Taking': 'Start with small calculated risks, study risk management frameworks, and build your risk tolerance incrementally.',
  'Financial Awareness': 'Study personal finance, take basic accounting courses, and practice reading financial statements regularly.',
  'Business Mindset': 'Follow entrepreneurship content, study market trends, and develop a customer-centric thinking approach.',
  'Teamwork': 'Participate in team projects, volunteer for collaborative initiatives, and study team dynamics and group psychology.',
};

export function getLevel(percentage: number) {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Average';
  return 'Needs Improvement';
}

function getLevelExplanation(level: string, highestCategory: string[]) {
  const cat = highestCategory[0] || 'multiple areas';
  const map: Record<string, string> = {
    'Excellent': `Outstanding entrepreneurial potential! You demonstrate strong traits across most dimensions, with particular strength in ${cat}. You are well-positioned to launch and grow a successful business venture.`,
    'Good': `Strong entrepreneurial traits with some areas to develop. Your strength in ${cat} is a solid foundation. With focused development in your lower-scoring areas, you can reach your full entrepreneurial potential.`,
    'Average': `Moderate entrepreneurial potential identified. You show promising traits in ${cat}, but specific areas need focused attention before pursuing entrepreneurial ventures.`,
    'Needs Improvement': `Foundational development is recommended before pursuing entrepreneurship. Focus on the improvement areas below to build the traits needed for business success.`,
  };
  return map[level];
}

const APTITUDE_DIMENSIONS = ['Numerical Ability', 'Logical Ability', 'Verbal Ability'];
const PERSONALITY_DIMENSIONS = ['Communication', 'Leadership', 'Teamwork', 'Creativity', 'Emotional Intelligence'];
const BUSINESS_MINDSET_DIMENSIONS = ['Business Mindset', 'Risk Taking'];
const FINANCIAL_AWARENESS_DIMENSIONS = ['Financial Awareness'];

/** Per-category and per-dimension maxima over the attempt's questions (SITUATIONAL: best option per dimension). */
export function computeQuestionMaxes(
  questions: ScoringQuestion[],
  typeNameById: Record<string, string>,
  situationalOptsByQ: Record<string, ScoringOption[]> = {},
) {
  const categoryQuestionMax: Record<string, number> = {};
  for (const q of questions) {
    const name = typeNameById[q.typeId];
    if (!name) continue;
    categoryQuestionMax[name] = (categoryQuestionMax[name] || 0) + q.marks;
  }
  const dimensionQuestionMax: Record<string, number> = {};
  for (const q of questions) {
    if (q.questionType === 'SITUATIONAL') {
      const opts = situationalOptsByQ[q.id] || [];
      const dims = new Set<string>();
      opts.forEach((o) => Object.keys(o.dimensionScores || {}).forEach((d) => dims.add(d)));
      for (const dim of dims) {
        const maxForDim = Math.max(0, ...opts.map((o) => (o.dimensionScores && o.dimensionScores[dim]) || 0));
        dimensionQuestionMax[dim] = (dimensionQuestionMax[dim] || 0) + maxForDim;
      }
    } else if (q.dimension) {
      dimensionQuestionMax[q.dimension] = (dimensionQuestionMax[q.dimension] || 0) + q.marks;
    }
  }
  return { categoryQuestionMax, dimensionQuestionMax };
}

const avgOf = (d: Record<string, number>, dims: string[]) =>
  dims.length ? fixed1(dims.reduce((a, x) => a + (d[x] || 0), 0) / dims.length) : 0;

export interface ScoredAnswer {
  questionId: string;
  score: number;
  isCorrect: boolean | null;
  dimensionScores: Record<string, number>;
  status?: string;
}

export function calculateResult(
  answers: ScoredAnswer[],
  categoryByQuestionId: Record<string, string | undefined>,
  categoryQuestionMax: Record<string, number>,
  dimensionQuestionMax: Record<string, number>,
  totalQuestions: number,
) {
  const categoryMarks: Record<string, number> = {};
  for (const a of answers) {
    const name = categoryByQuestionId[a.questionId];
    if (!name) continue;
    categoryMarks[name] = (categoryMarks[name] || 0) + a.score;
  }
  const categoryScores: Record<string, number> = {};
  const categoryPercentages: Record<string, number> = {};
  for (const [name, score] of Object.entries(categoryMarks)) {
    categoryScores[name] = score;
    const max = categoryQuestionMax[name] || 0;
    categoryPercentages[name] = max ? fixed1((score / max) * 100) : 0;
  }

  const totalMarks = Object.values(categoryScores).reduce((a, b) => a + b, 0);
  const maxScore = Object.values(categoryQuestionMax).reduce((a, b) => a + b, 0);
  const percentage = maxScore ? fixed1((totalMarks / maxScore) * 100) : 0;
  const level = getLevel(percentage);

  // No positive top score → no dominant category.
  const values = Object.values(categoryScores);
  const top = values.length ? Math.max(...values) : 0;
  const highestCategory = top > 0 ? Object.keys(categoryScores).filter((k) => categoryScores[k] === top) : [];

  const improvementAreas = Object.entries(categoryScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([category, score]) => ({ category, score, suggestion: IMPROVEMENT_SUGGESTIONS[category] || '' }));

  const explanation = getLevelExplanation(level, highestCategory);

  const dimensionMarks: Record<string, number> = {};
  for (const a of answers) for (const [dim, val] of Object.entries(a.dimensionScores || {})) dimensionMarks[dim] = (dimensionMarks[dim] || 0) + val;
  const dimensionScores: Record<string, number> = {};
  const dimensionPercentages: Record<string, number> = {};
  for (const dim of Object.keys(dimensionQuestionMax)) {
    const score = dimensionMarks[dim] || 0;
    const max = dimensionQuestionMax[dim] || 0;
    dimensionScores[dim] = score;
    dimensionPercentages[dim] = max ? fixed1((score / max) * 100) : 0;
  }

  // Only dimensions actually tested (max > 0) rank as strong/weak.
  const tested = Object.entries(dimensionPercentages).filter(([dim]) => dimensionQuestionMax[dim] > 0);
  const sorted = [...tested].sort((a, b) => b[1] - a[1]);
  const strongDimensions = sorted.slice(0, 3).map(([d]) => d);
  const weakDimensions = sorted.slice(-3).reverse().map(([d]) => d);

  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const wrongCount = answers.filter((a) => a.isCorrect === false).length;
  const skippedCount = answers.some((a) => a.status)
    ? answers.filter((a) => a.status === 'skipped' || a.status === 'timeout').length
    : Math.max(0, totalQuestions - answers.length);

  const recommendations = getRecommendations(dimensionPercentages);
  return {
    totalMarks, maxScore, percentage, level,
    categoryScores, categoryPercentages,
    highestCategory, recommendedBusiness: recommendations.map((r) => r.business),
    explanation, improvementAreas,
    dimensionScores, dimensionPercentages,
    correctCount, wrongCount, skippedCount,
    businessReadinessPercent: percentage,
    recommendations,
    strongDimensions, weakDimensions,
    aptitudeScore: avgOf(dimensionPercentages, APTITUDE_DIMENSIONS),
    personalityScore: avgOf(dimensionPercentages, PERSONALITY_DIMENSIONS),
    businessMindsetScore: avgOf(dimensionPercentages, BUSINESS_MINDSET_DIMENSIONS),
    financialAwarenessScore: avgOf(dimensionPercentages, FINANCIAL_AWARENESS_DIMENSIONS),
  };
}

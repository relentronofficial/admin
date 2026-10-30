/**
 * Row → API mappers for the psy_* tables. The admin pages (and the member
 * pages) were written against the standalone platform's Mongo documents, so
 * every object keeps that shape: `_id`, camelCase fields, `order` for
 * sort_order, populated references as nested objects.
 */

type Row = Record<string, any>;

export const questionTypeOut = (r: Row) => ({
  _id: r.id,
  name: r.name,
  description: r.description,
  icon: r.icon,
  color: r.color,
  order: r.sort_order,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** `typeRef`: the populated typeId ({_id,name[,color]}) when the query joined it, else the raw id. */
export const questionOut = (r: Row, opts: { withAudio?: boolean; typeRef?: Row | null } = {}) => ({
  _id: r.id,
  typeId: opts.typeRef ?? r.type_id,
  text: r.text,
  order: r.sort_order,
  isActive: r.is_active,
  questionType: r.question_type,
  language: r.language,
  dimension: r.dimension,
  subDimension: r.sub_dimension,
  difficulty: r.difficulty,
  marks: r.marks,
  timeLimitSeconds: r.time_limit_seconds,
  hasAudio: r.has_audio,
  ...(opts.withAudio ? { audioUrl: r.audio_url } : {}),
  imageUrl: r.image_url,
  instructionText: r.instruction_text,
  isReverseScored: r.is_reverse_scored,
  explanationAudioText: r.explanation_audio_text,
  explanationIsTanglish: r.explanation_is_tanglish,
  correctOptionId: r.correct_option_id,
  explanation: r.explanation,
  ...(r.ideal_order != null ? { idealOrder: r.ideal_order } : {}),
  ...(r.correct_option_ids != null ? { correctOptionIds: r.correct_option_ids } : {}),
  ...(r.scoring_mode != null ? { scoringMode: r.scoring_mode } : {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const optionOut = (r: Row) => ({
  _id: r.id,
  questionId: r.question_id,
  optionText: r.option_text,
  optionImageUrl: r.option_image_url,
  score: r.score,
  isCorrect: r.is_correct,
  ...(r.dimension_scores != null ? { dimensionScores: r.dimension_scores } : {}),
  order: r.sort_order,
  createdAt: r.created_at,
});

export const questionSetOut = (r: Row) => ({
  _id: r.id,
  name: r.name,
  description: r.description,
  durationMinutes: r.duration_minutes,
  questionIds: r.question_ids ?? [],
  isActive: r.is_active,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** `set`: the populated questionSetId ({_id,name,durationMinutes}) when joined, else the raw id. */
export const accessCodeOut = (r: Row, opts: { populate?: boolean } = {}) => ({
  _id: r.id,
  code: r.code,
  label: r.label,
  isActive: r.is_active,
  createdBy: opts.populate ? (r.created_by ? { _id: r.created_by, email: r.created_by_email } : null) : r.created_by,
  usageCount: r.usage_count,
  questionSetId: opts.populate
    ? (r.question_set_id ? { _id: r.question_set_id, name: r.set_name, durationMinutes: r.set_duration } : null)
    : r.question_set_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const matrixCellOut = (r: Row) => ({
  _id: r.id,
  rowTypeId: r.row_type_id,
  colTypeId: r.col_type_id,
  businessName: r.business_name,
  rating: r.rating,
  isActive: r.is_active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const candidateOut = (r: Row) => ({
  _id: r.id,
  memberId: r.member_id,
  source: r.source,
  name: r.name,
  email: r.email,
  phone: r.phone,
  candidateId: r.candidate_code,
  batch: r.batch,
  sharedUserID: r.access_code_id,
  sharedCode: r.access_code,
  hasCompletedAssessment: r.has_completed,
  isVerified: r.is_verified,
  accessExpiry: r.access_expiry,
  restrictedAccess: r.restricted_access,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

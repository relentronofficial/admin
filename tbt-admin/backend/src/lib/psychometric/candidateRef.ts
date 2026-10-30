/** The candidate as the member's own result populates it (old shape: userId → sharedUserID → label). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const candidateRef = (c: Record<string, any>, code?: Record<string, any> | null) => ({
  _id: c.id,
  name: c.name,
  email: c.email,
  sharedCode: c.access_code,
  sharedUserID: code ? { _id: code.id, label: code.label } : c.access_code_id,
});

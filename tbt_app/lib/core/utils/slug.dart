/// Converts [s] to a URL-safe slug.
/// Used in create mode only — never overwrite a slug during edits.
String toSlug(String s) => s
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
    .replaceAll(RegExp(r'(^-|-$)'), '');

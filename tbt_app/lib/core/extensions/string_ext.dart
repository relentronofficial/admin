extension StringExt on String {
  String get capitalised =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';

  bool get isBlank => trim().isEmpty;

  String toSlug() => toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'(^-|-$)'), '');
}

extension NullableStringExt on String? {
  bool get isNullOrBlank => this == null || this!.trim().isEmpty;
  String orEmpty() => this ?? '';
}

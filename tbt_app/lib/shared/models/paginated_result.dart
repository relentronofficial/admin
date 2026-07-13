/// Wraps the standard `{ data: [...], meta: { total, page, limit } }` envelope
/// returned by every paginated backend endpoint.
class PaginatedResult<T> {
  const PaginatedResult({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  final List<T> data;
  final int total;
  final int page;
  final int limit;

  bool get hasMore => (page * limit) < total;

  factory PaginatedResult.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) fromItem,
  ) {
    final meta = json['meta'] as Map<String, dynamic>? ?? {};
    final rawList = json['data'] as List<dynamic>? ?? [];
    final items = rawList.map(fromItem).toList();
    return PaginatedResult(
      data: items,
      total: (meta['total'] as num?)?.toInt() ?? items.length,
      page: (meta['page'] as num?)?.toInt() ?? 1,
      limit: (meta['limit'] as num?)?.toInt() ?? items.length,
    );
  }
}

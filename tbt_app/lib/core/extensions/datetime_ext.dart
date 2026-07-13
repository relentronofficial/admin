import 'package:intl/intl.dart';

extension DateTimeExt on DateTime {
  String get formatted => DateFormat('dd MMM yyyy').format(this);
  String get formattedWithTime => DateFormat('dd MMM yyyy, h:mm a').format(this);
  String get timeOnly => DateFormat('h:mm a').format(this);

  bool get isToday {
    final now = DateTime.now();
    return year == now.year && month == now.month && day == now.day;
  }

  bool get isYesterday {
    final y = DateTime.now().subtract(const Duration(days: 1));
    return year == y.year && month == y.month && day == y.day;
  }

  /// Returns "Today", "Yesterday", or a formatted date string.
  String get relativeDay {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return formatted;
  }
}

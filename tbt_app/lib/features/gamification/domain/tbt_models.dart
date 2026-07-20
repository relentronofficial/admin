// Plain-data models for the TBT gamification feature.

class TbtLevel {
  const TbtLevel({
    required this.id,
    required this.levelNumber,
    required this.name,
    required this.requiredPoints,
    this.description,
    this.reward,
  });
  final String id;
  final int levelNumber;
  final String name;
  final String? description;
  final int requiredPoints;
  final String? reward;

  factory TbtLevel.fromJson(Map<String, dynamic> j) => TbtLevel(
        id: j['id'] as String,
        levelNumber: (j['levelNumber'] as int?) ?? 0,
        name: j['name'] as String,
        description: j['description'] as String?,
        requiredPoints: (j['requiredPoints'] as int?) ?? 0,
        reward: j['reward'] as String?,
      );
}

class TbtTask {
  const TbtTask({
    required this.id,
    required this.taskOrder,
    required this.title,
    required this.rewardPoints,
    required this.status,
    required this.isCompleted,
    required this.isLocked,
    this.description,
    this.requiredAction,
    this.completedAt,
  });
  final String id;
  final int taskOrder;
  final String title;
  final String? description;
  final String? requiredAction;
  final int rewardPoints;
  final String status; // 'completed' | 'current' | 'locked'
  final bool isCompleted;
  final bool isLocked;
  final DateTime? completedAt;

  factory TbtTask.fromJson(Map<String, dynamic> j) => TbtTask(
        id: j['id'] as String,
        taskOrder: (j['taskOrder'] as int?) ?? 0,
        title: j['title'] as String,
        description: j['description'] as String?,
        requiredAction: j['requiredAction'] as String?,
        rewardPoints: (j['rewardPoints'] as int?) ?? 0,
        status: (j['status'] as String?) ?? 'locked',
        isCompleted: (j['isCompleted'] as bool?) ?? false,
        isLocked: (j['isLocked'] as bool?) ?? false,
        completedAt: j['completedAt'] != null ? DateTime.parse(j['completedAt'] as String) : null,
      );
}

class TbtPath {
  const TbtPath({
    required this.totalPoints,
    required this.dailyStreak,
    required this.tasks,
    this.currentLevel,
    this.nextLevel,
  });
  final int totalPoints;
  final int dailyStreak;
  final TbtLevel? currentLevel;
  final TbtLevel? nextLevel;
  final List<TbtTask> tasks;

  int get totalStars => tasks.where((t) => t.isCompleted).length;
  int get progressPercent =>
      tasks.isEmpty ? 0 : ((totalStars / tasks.length) * 100).round();

  /// Progress from current level → next level as a 0..1 ratio, for
  /// the level progress bar. Returns 1 if there's no next level
  /// (member has hit the ceiling).
  double get levelProgress {
    final base = currentLevel?.requiredPoints ?? 0;
    final target = nextLevel?.requiredPoints;
    if (target == null || target <= base) return 1.0;
    final span = target - base;
    final gained = (totalPoints - base).clamp(0, span);
    return (gained / span).clamp(0.0, 1.0);
  }

  factory TbtPath.fromJson(Map<String, dynamic> j) => TbtPath(
        totalPoints: (j['totalPoints'] as int?) ?? 0,
        dailyStreak: (j['dailyStreak'] as int?) ?? 0,
        currentLevel: j['currentLevel'] != null
            ? TbtLevel.fromJson(j['currentLevel'] as Map<String, dynamic>)
            : null,
        nextLevel: j['nextLevel'] != null
            ? TbtLevel.fromJson(j['nextLevel'] as Map<String, dynamic>)
            : null,
        tasks: ((j['tasks'] as List<dynamic>?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(TbtTask.fromJson)
            .toList(),
      );
}

class LeaderboardRow {
  const LeaderboardRow({
    required this.rank,
    required this.memberId,
    required this.totalPoints,
    required this.isMe,
    this.memberName,
    this.memberPhoto,
  });
  final int rank;
  final String memberId;
  final int totalPoints;
  final bool isMe;
  final String? memberName;
  final String? memberPhoto;

  factory LeaderboardRow.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map<String, dynamic>?;
    final name = m == null
        ? null
        : [m['firstName'], m['lastName']]
            .whereType<String>()
            .where((s) => s.isNotEmpty)
            .join(' ')
            .trim();
    return LeaderboardRow(
      rank: (j['rank'] as int?) ?? 0,
      memberId: j['memberId'] as String,
      totalPoints: (j['totalPoints'] as int?) ?? 0,
      isMe: (j['isMe'] as bool?) ?? false,
      memberName: (name != null && name.isNotEmpty) ? name : null,
      memberPhoto: m?['profilePhotoUrl'] as String?,
    );
  }
}

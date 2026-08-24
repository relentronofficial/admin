import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/api/upload_service.dart';
import '../../../shared/models/batch.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/batch_service.dart';
import '../providers/batch_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
import '../../../shared/providers/site_config_provider.dart';
class BatchDayScreen extends ConsumerStatefulWidget {
  const BatchDayScreen({super.key, required this.day});

  final int day;

  @override
  ConsumerState<BatchDayScreen> createState() => _BatchDayScreenState();
}

class _BatchDayScreenState extends ConsumerState<BatchDayScreen> {
  List<BatchTask> _localTasks = [];
  final Map<String, String> _proofPaths = {};       // taskId → display filename
  final Map<String, String> _proofPublicUrls = {};  // taskId → R2 public URL
  // Per-task free-text response (for proofType == 'text' or 'url').
  // A controller per task keeps focus/cursor state stable across rebuilds.
  final Map<String, TextEditingController> _responseCtrls = {};
  String? _uploadingTaskId;
  bool _initialized = false;
  Timer? _debounceTimer;
  bool _savingDraft = false;
  bool _submitting = false;
  bool _marking = false;
  final _notesController = TextEditingController();
  final _journalController = TextEditingController();

  // ── Focus-mode gamification ──────────────────────────────────────────────────
  int _lifelinesLeft = 3;
  static const int _lifelineCoinCost = 50;
  final Set<String> _lockedTaskIds = {};
  bool _spendingCoins = false;
  final Map<String, GlobalKey<_TaskRowState>> _taskRowKeys = {};

  GlobalKey<_TaskRowState> _keyFor(String taskId) =>
      _taskRowKeys.putIfAbsent(taskId, () => GlobalKey<_TaskRowState>());

  String _fmtTimer(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _notesController.dispose();
    _journalController.dispose();
    for (final c in _responseCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _initTasks(BatchDay day) {
    if (_initialized) return;
    _localTasks = List.of(day.tasks);
    final meta = ref.read(batchServiceProvider).taskMeta;
    for (final t in day.tasks) {
      if (t.proofUrl != null) _proofPublicUrls[t.id] = t.proofUrl!;
      // Prefill previously-submitted text/URL responses.
      final prev = meta[t.id]?.responseValue;
      if (prev != null && prev.isNotEmpty) {
        _responseCtrls[t.id] = TextEditingController(text: prev);
      }
    }
    _initialized = true;
  }

  TextEditingController _ctrlFor(String taskId) {
    return _responseCtrls.putIfAbsent(
      taskId,
      () => TextEditingController(),
    );
  }

  void _onTaskToggled(int index) {
    final task = _localTasks[index];
    setState(() {
      _localTasks[index] = task.copyWith(isCompleted: !task.isCompleted);
    });
    _scheduleAutoSave();
  }

  Future<void> _pickProof(String taskId) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    if (file.path == null && file.bytes == null) return;

    setState(() => _uploadingTaskId = taskId);
    try {
      final program = await ref.read(batchProgramProvider.future);
      final batchId = program?.batch.id ?? 'batch';
      final contentType = _guessContentType(file.name);
      final bytes = file.bytes ?? await file.xFile.readAsBytes();

      final svc = ref.read(uploadServiceProvider);
      final presigned = await svc.getPresignedUrl(
        filename: file.name,
        contentType: contentType,
        bucket: 'batch-proofs',
        pathPrefix: '$batchId/day-${widget.day}',
      );
      await svc.uploadToR2(
        uploadUrl: presigned.uploadUrl,
        bytes: bytes,
        contentType: contentType,
      );

      setState(() {
        _proofPaths[taskId] = file.name;
        _proofPublicUrls[taskId] = presigned.publicUrl;
        _uploadingTaskId = null;
      });
      _scheduleAutoSave();
    } catch (e) {
      if (mounted) {
        setState(() => _uploadingTaskId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Upload failed: ${e.toString().replaceFirst('Exception: ', '')}'),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
      }
    }
  }

  void _scheduleAutoSave() {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(seconds: 2), _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (_savingDraft) return;
    setState(() => _savingDraft = true);
    try {
      final completedIds = _localTasks
          .where((t) => t.isCompleted)
          .map((t) => t.id)
          .toList();

      // Build submissions from all three proof-input sources. Each task has a
      // single expected proofType from the backend; text/url store into
      // `value` (which the backend writes to `response_value`), file stores
      // into `url` (which the backend writes to `proof_url`).
      final meta = ref.read(batchServiceProvider).taskMeta;
      final taskSubmissions = <String, Map<String, String?>>{};
      for (final t in _localTasks) {
        final pt = meta[t.id]?.proofType ?? 'watch';
        if (pt == 'file' || pt == 'image' || pt == 'video') {
          final url = _proofPublicUrls[t.id];
          if (url != null && url.isNotEmpty) {
            taskSubmissions[t.id] = {'url': url, 'type': pt};
          }
        } else if (pt == 'text' || pt == 'url') {
          final v = _responseCtrls[t.id]?.text.trim() ?? '';
          if (v.isNotEmpty) {
            // 'url' proof also goes in value — backend stores it in
            // response_value regardless of type.
            taskSubmissions[t.id] = {'value': v, 'type': pt};
          }
        }
      }

      final journal = _journalController.text.trim();
      await ref.read(batchServiceProvider).saveDraft(
            widget.day,
            journalEntry: journal.isEmpty ? null : journal,
            completedTaskIds: completedIds,
            taskSubmissions:
                taskSubmissions.isNotEmpty ? taskSubmissions : null,
          );
    } catch (_) {
      // Silently fail — draft errors do not block the UI
    } finally {
      if (mounted) setState(() => _savingDraft = false);
    }
  }

  Future<void> _submitDay() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.bgModal,
        title: Text(
          'Submit Day?',
          style: TextStyle(
            color: context.tokens.textPrimary,
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Text(
          'Submit Day ${widget.day} for mentor review?\n\nYou will not be able to edit it after submission.',
          style: TextStyle(color: context.tokens.textSecondary, fontSize: 13, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => ctx.pop(false),
            child: Text('Cancel',
                style: TextStyle(color: context.tokens.textMuted)),
          ),
          TextButton(
            onPressed: () => ctx.pop(true),
            child: Text('Submit',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      await ref.read(batchServiceProvider).submitDay(widget.day);
      if (mounted) {
        ref.invalidate(batchProgramProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Day submitted for review!'),
            backgroundColor: Color(0xFF16a34a),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:
                Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _markAttendance() async {
    if (_marking) return;
    setState(() => _marking = true);
    try {
      await ref.read(batchServiceProvider).markAttendance(
            widget.day,
            notes: _notesController.text.trim().isEmpty
                ? null
                : _notesController.text.trim(),
          );
      if (mounted) {
        ref.invalidate(batchProgramProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance marked')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _marking = false);
    }
  }

  // ── Gamification handlers ────────────────────────────────────────────────────

  void _handleTaskTap(int index, String taskId, String taskTitle) {
    final task = _localTasks[index];
    if (task.isCompleted) {
      _onTaskToggled(index);
      return;
    }
    if (_lockedTaskIds.contains(taskId)) return;
    final timerStarted =
        _taskRowKeys[taskId]?.currentState?._timerStarted ?? false;
    if (timerStarted) {
      _onTaskToggled(index);
    } else {
      _showFocusDialog(index, taskId, taskTitle);
    }
  }

  void _onTimerExpired(int index, String taskId) {
    if (_localTasks[index].isCompleted) return;
    setState(() => _lockedTaskIds.add(taskId));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("⏰ Time's up! Use a lifeline to unlock this task."),
        backgroundColor: Color(0xFFdc2626),
        duration: Duration(seconds: 4),
      ),
    );
  }

  void _handleLifeline(String taskId) {
    if (_lifelinesLeft > 0) {
      setState(() {
        _lifelinesLeft--;
        _lockedTaskIds.remove(taskId);
      });
      _taskRowKeys[taskId]?.currentState?._startTimer();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Lifeline used! $_lifelinesLeft free lifeline'
            '${_lifelinesLeft == 1 ? '' : 's'} remaining.',
          ),
          backgroundColor: const Color(0xFF16a34a),
        ),
      );
    } else {
      _showCoinDialog(taskId);
    }
  }

  void _showFocusDialog(int index, String taskId, String taskTitle) {
    final timerSeconds =
        ref.read(siteConfigNotifierProvider).valueOrNull?.taskTimerSeconds ??
            300;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.bgModal,
        title: Row(
          children: [
            Icon(Icons.bolt_rounded,
                color: Theme.of(context).colorScheme.primary, size: 22),
            const SizedBox(width: 8),
            Text(
              'Focus Mode',
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontFamily: 'Rajdhani',
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              taskTitle,
              style: TextStyle(
                color: context.tokens.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'This task will be locked after ${_fmtTimer(timerSeconds)} if not '
              'completed. You have $_lifelinesLeft free '
              'lifeline${_lifelinesLeft != 1 ? "s" : ""} remaining. After that, '
              'each lifeline costs $_lifelineCoinCost TBT coins.',
              style: TextStyle(
                color: context.tokens.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => ctx.pop(),
            child: Text('Cancel',
                style: TextStyle(color: context.tokens.textMuted)),
          ),
          ElevatedButton.icon(
            onPressed: () {
              ctx.pop();
              _onTaskToggled(index);
              _taskRowKeys[taskId]?.currentState?._startTimer();
            },
            icon: const Icon(Icons.bolt_rounded, size: 15),
            label: const Text(
              'Start Focus',
              style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontWeight: FontWeight.w700,
                  fontSize: 14),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }

  void _showCoinDialog(String taskId) {
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          backgroundColor: context.tokens.bgModal,
          title: Row(
            children: [
              const Icon(Icons.monetization_on_rounded,
                  color: Color(0xFFfbbf24), size: 22),
              const SizedBox(width: 8),
              Text(
                'Use TBT Coins?',
                style: TextStyle(
                  color: context.tokens.textPrimary,
                  fontFamily: 'Rajdhani',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFfbbf24).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: const Color(0xFFfbbf24).withValues(alpha: 0.2)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Lifeline cost',
                        style: TextStyle(
                            color: context.tokens.textMuted, fontSize: 13)),
                    const Text('50 coins',
                        style: TextStyle(
                            color: Color(0xFFfbbf24),
                            fontSize: 13,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Spending $_lifelineCoinCost TBT coins resets the focus timer for this task.',
                style: TextStyle(
                    color: context.tokens.textSecondary,
                    fontSize: 13,
                    height: 1.5),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => ctx.pop(),
              child: Text('Cancel',
                  style: TextStyle(color: context.tokens.textMuted)),
            ),
            ElevatedButton.icon(
              onPressed: _spendingCoins
                  ? null
                  : () => _spendCoins(ctx, taskId, setLocal),
              icon: _spendingCoins
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.monetization_on_rounded, size: 15),
              label: Text(
                'Spend $_lifelineCoinCost Coins',
                style: const TextStyle(
                    fontFamily: 'Rajdhani',
                    fontWeight: FontWeight.w700,
                    fontSize: 14),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFd97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _spendCoins(
      BuildContext dialogCtx, String taskId, StateSetter setLocal) async {
    setLocal(() {});
    setState(() => _spendingCoins = true);
    try {
      final remaining =
          await ref.read(batchServiceProvider).spendCoins(_lifelineCoinCost);
      setState(() {
        _spendingCoins = false;
        _lockedTaskIds.remove(taskId);
      });
      if (mounted) Navigator.of(dialogCtx).pop();
      _taskRowKeys[taskId]?.currentState?._startTimer();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Lifeline activated! $_lifelineCoinCost coins deducted. '
              'Remaining: $remaining coins.',
            ),
            backgroundColor: const Color(0xFF16a34a),
          ),
        );
      }
    } catch (e) {
      setState(() => _spendingCoins = false);
      if (mounted) Navigator.of(dialogCtx).pop();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Theme.of(context).colorScheme.primary,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dayAsync = ref.watch(batchDayProvider(widget.day));
    final programAsync = ref.watch(batchProgramProvider);

    final batchDay = dayAsync.whenOrNull(data: (d) => d);
    final isReadOnly = batchDay?.status == BatchDayStatus.approved ||
        batchDay?.status == BatchDayStatus.rejected ||
        batchDay?.status == BatchDayStatus.submitted;
    final hasAnyCompleted = _localTasks.any((t) => t.isCompleted);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'DAY ${widget.day}',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          if (_savingDraft)
            Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: context.tokens.textMuted,
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: batchDay == null || isReadOnly
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed:
                        hasAnyCompleted && !_submitting ? _submitDay : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      disabledBackgroundColor: context.tokens.bgInput,
                      foregroundColor: Colors.white,
                      disabledForegroundColor: context.tokens.textMuted,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Submit Day for Review',
                            style: TextStyle(
                              fontFamily: 'Rajdhani',
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              letterSpacing: 0.5,
                            ),
                          ),
                  ),
                ),
              ),
            ),
      body: dayAsync.when(
        loading: () =>
            const AppLoader.center(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load day',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () =>
                    ref.invalidate(batchDayProvider(widget.day)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (day) {
          if (day == null) {
            return Center(
              child: Text('Day not found',
                  style: TextStyle(color: context.tokens.textMuted)),
            );
          }

          _initTasks(day);

          final readOnly = day.status == BatchDayStatus.approved ||
              day.status == BatchDayStatus.rejected ||
              day.status == BatchDayStatus.submitted;

          final attendance = programAsync.whenOrNull(
            data: (p) => p?.attendance
                .where((a) => a.dayNumber == widget.day)
                .firstOrNull,
          );

          final timerDurationSeconds = ref
              .read(siteConfigNotifierProvider)
              .valueOrNull
              ?.taskTimerSeconds ?? 300;

          final listItems = <Widget>[
            _DayHeader(
              dayNumber: widget.day,
              status: day.status,
              category: day.category,
            ),
            if (readOnly) _ReadOnlyBanner(status: day.status),
            if (_localTasks.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: Text(
                    'No tasks for this day',
                    style:
                        TextStyle(color: context.tokens.textMuted, fontSize: 13),
                  ),
                ),
              )
            else ...[
              // Day description + optional resource link (backend `notes` +
              // `resourceUrl` — surfaced via BatchService.dayMeta).
              _DayNotes(dayNumber: widget.day),
              // TASKS header + lifelines badge
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Text(
                      'TASKS',
                      style: TextStyle(
                        fontFamily: 'Rajdhani',
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        color: context.tokens.textMuted,
                      ),
                    ),
                    const Spacer(),
                    if (!readOnly)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _lifelinesLeft > 0
                              ? const Color(0xFF16a34a).withValues(alpha: 0.12)
                              : const Color(0xFFd97706).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.bolt_rounded,
                                size: 11,
                                color: _lifelinesLeft > 0
                                    ? const Color(0xFF4ade80)
                                    : const Color(0xFFfbbf24)),
                            const SizedBox(width: 4),
                            Text(
                              '$_lifelinesLeft lifeline${_lifelinesLeft != 1 ? "s" : ""}',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: _lifelinesLeft > 0
                                    ? const Color(0xFF4ade80)
                                    : const Color(0xFFfbbf24),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              ..._localTasks.asMap().entries.map((e) {
                final meta =
                    ref.read(batchServiceProvider).taskMeta[e.value.id];
                final pt = meta?.proofType ?? 'watch';
                final needsInput = pt == 'text' || pt == 'url';
                final taskId = e.value.id;
                return _TaskRow(
                  key: _keyFor(taskId),
                  task: e.value,
                  proofName: _proofPaths[taskId],
                  hasPublicUrl: _proofPublicUrls.containsKey(taskId),
                  isUploading: _uploadingTaskId == taskId,
                  readOnly: readOnly,
                  proofType: pt,
                  description: meta?.description,
                  deliverables: meta?.deliverables,
                  timerDurationSeconds: timerDurationSeconds,
                  isLocked: _lockedTaskIds.contains(taskId) &&
                      !e.value.isCompleted,
                  responseController:
                      needsInput ? _ctrlFor(taskId) : null,
                  onResponseChanged:
                      needsInput ? (_) => _scheduleAutoSave() : null,
                  onTaskTap: () =>
                      _handleTaskTap(e.key, taskId, e.value.title),
                  onPickProof: () => _pickProof(taskId),
                  onLifeline: () => _handleLifeline(taskId),
                  onTimerExpired: () => _onTimerExpired(e.key, taskId),
                );
              }),
            ],
            const SizedBox(height: 8),
            if (!readOnly)
              _JournalSection(
                controller: _journalController,
                onChanged: (_) => _scheduleAutoSave(),
              ),
            const SizedBox(height: 8),
            if (!readOnly)
              _AttendanceSection(
                hasAttendance: attendance != null,
                marking: _marking,
                notesController: _notesController,
                onMark: _markAttendance,
              ),
            const SizedBox(height: 32),
          ];
          return ListView.builder(
            itemCount: listItems.length,
            itemBuilder: (_, i) => listItems[i],
          );
        },
      ),
    );
  }
}

String _guessContentType(String filename) {
  final ext = filename.split('.').last.toLowerCase();
  return switch (ext) {
    'pdf' => 'application/pdf',
    'doc' || 'docx' => 'application/msword',
    'png' => 'image/png',
    'jpg' || 'jpeg' => 'image/jpeg',
    'mp4' => 'video/mp4',
    'zip' => 'application/zip',
    _ => 'application/octet-stream',
  };
}

// ── Day header ────────────────────────────────────────────────────────────────

class _DayHeader extends StatelessWidget {
  const _DayHeader({
    required this.dayNumber,
    required this.status,
    required this.category,
  });

  final int dayNumber;
  final BatchDayStatus status;
  final String? category;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.tokens.bgSurface,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Row(
        children: [
          Text(
            'Day $dayNumber',
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          if (category != null && category!.isNotEmpty) ...[
            _Chip(
              label: category!.toUpperCase(),
              bg: context.tokens.bgInput,
              fg: context.tokens.textSecondary,
            ),
            const SizedBox(width: 6),
          ],
          _Chip(
            label: _statusLabel(status),
            bg: _statusColor(context, status).withValues(alpha: 0.15),
            fg: _statusColor(context, status),
          ),
        ],
      ),
    );
  }

  String _statusLabel(BatchDayStatus s) {
    switch (s) {
      case BatchDayStatus.notStarted:
        return 'NOT STARTED';
      case BatchDayStatus.inProgress:
        return 'IN PROGRESS';
      case BatchDayStatus.submitted:
        return 'SUBMITTED';
      case BatchDayStatus.approved:
        return 'APPROVED';
      case BatchDayStatus.rejected:
        return 'REJECTED';
    }
  }

  Color _statusColor(BuildContext context, BatchDayStatus s) {
    switch (s) {
      case BatchDayStatus.notStarted:
        return context.tokens.textMuted;
      case BatchDayStatus.inProgress:
        return const Color(0xFF60a5fa);
      case BatchDayStatus.submitted:
        return const Color(0xFFfbbf24);
      case BatchDayStatus.approved:
        return const Color(0xFF4ade80);
      case BatchDayStatus.rejected:
        return Theme.of(context).colorScheme.primary;
    }
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.bg, required this.fg});

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontFamily: 'Rajdhani',
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

// ── Read-only banner ──────────────────────────────────────────────────────────

class _ReadOnlyBanner extends StatelessWidget {
  const _ReadOnlyBanner({required this.status});

  final BatchDayStatus status;

  @override
  Widget build(BuildContext context) {
    // Semantic accents; the banner background is the same accent at 12%
    // alpha so it reads well in both light and dark themes.
    final (accent, msg) = switch (status) {
      BatchDayStatus.approved => (
          const Color(0xFF16a34a),
          '✓ This day has been approved by your mentor.',
        ),
      BatchDayStatus.submitted => (
          const Color(0xFFd97706),
          'Submitted — awaiting mentor review.',
        ),
      _ => (
          const Color(0xFFdc2626),
          'This day was returned for revision. Check with your mentor.',
        ),
    };

    return Container(
      width: double.infinity,
      color: accent.withValues(alpha: 0.12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child:
          Text(msg, style: TextStyle(color: accent, fontSize: 12, height: 1.4)),
    );
  }
}

// ── Day notes + resource link ─────────────────────────────────────────────────

class _DayNotes extends ConsumerWidget {
  const _DayNotes({required this.dayNumber});
  final int dayNumber;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.read(batchServiceProvider).dayMeta[dayNumber];
    if (meta == null) return const SizedBox.shrink();
    final notes = meta.notes;
    final resource = meta.resourceUrl;
    if ((notes == null || notes.isEmpty) &&
        (resource == null || resource.isEmpty)) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (notes != null && notes.isNotEmpty)
              Text(
                notes,
                style: TextStyle(
                  color: context.tokens.textSecondary,
                  fontSize: 13,
                  height: 1.55,
                ),
              ),
            if (resource != null && resource.isNotEmpty) ...[
              const SizedBox(height: 10),
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => launchUrl(
                  Uri.parse(resource),
                  mode: LaunchMode.externalApplication,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: context.tokens.bgInput,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: context.tokens.borderCard),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.play_circle_outline,
                          size: 16, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Open resource',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Task row ──────────────────────────────────────────────────────────────────

class _TaskRow extends StatefulWidget {
  const _TaskRow({
    super.key,
    required this.task,
    required this.proofName,
    required this.hasPublicUrl,
    required this.isUploading,
    required this.readOnly,
    required this.onTaskTap,
    required this.onPickProof,
    required this.timerDurationSeconds,
    this.isLocked = false,
    this.proofType = 'watch',
    this.description,
    this.deliverables,
    this.responseController,
    this.onResponseChanged,
    this.onLifeline,
    this.onTimerExpired,
  });

  final BatchTask task;
  final String? proofName;
  final bool hasPublicUrl;
  final bool isUploading;
  final bool readOnly;
  final bool isLocked;
  final VoidCallback onTaskTap;
  final VoidCallback onPickProof;
  final VoidCallback? onLifeline;
  final VoidCallback? onTimerExpired;
  final int timerDurationSeconds;
  final String proofType;
  final String? description;
  final String? deliverables;
  final TextEditingController? responseController;
  final ValueChanged<String>? onResponseChanged;

  @override
  State<_TaskRow> createState() => _TaskRowState();
}

class _TaskRowState extends State<_TaskRow> {
  late int _secondsLeft = widget.timerDurationSeconds;
  bool _timerStarted = false;
  Timer? _countdownTimer;

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _countdownTimer?.cancel();
    setState(() {
      _secondsLeft = widget.timerDurationSeconds;
      _timerStarted = true;
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        if (_secondsLeft > 0) {
          _secondsLeft--;
        } else {
          t.cancel();
          if (!widget.task.isCompleted) {
            widget.onTimerExpired?.call();
          }
        }
      });
    });
  }

  String get _timerLabel {
    final m = _secondsLeft ~/ 60;
    final s = _secondsLeft % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  bool get _timerDone => _timerStarted && _secondsLeft == 0;
  bool get _timerWarn => _timerStarted && !_timerDone && _secondsLeft <= 60;

  bool get _isFileProof =>
      widget.proofType == 'file' || widget.proofType == 'image' || widget.proofType == 'video';
  bool get _isTextProof => widget.proofType == 'text';
  bool get _isUrlProof => widget.proofType == 'url';

  @override
  Widget build(BuildContext context) {
    final timerColor = _timerDone
        ? const Color(0xFF22c55e)
        : _timerWarn
            ? Theme.of(context).colorScheme.primary
            : _timerStarted
                ? Theme.of(context).colorScheme.primary
                : context.tokens.textMuted;
    final timerBg = _timerDone
        ? const Color(0xFF22c55e).withValues(alpha: 0.12)
        : _timerWarn
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
            : _timerStarted
                ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.08)
                : context.tokens.bgInput;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: widget.isLocked
            ? const Color(0xFFdc2626).withValues(alpha: 0.05)
            : context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: widget.isLocked
              ? const Color(0xFFdc2626).withValues(alpha: 0.4)
              : context.tokens.borderCard,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: widget.readOnly ? null : widget.onTaskTap,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: widget.isLocked
                        ? const Icon(Icons.lock_outline,
                            size: 18, color: Color(0xFFdc2626))
                        : Checkbox(
                      value: widget.task.isCompleted,
                      onChanged: widget.readOnly ? null : (_) => widget.onTaskTap(),
                      activeColor: Theme.of(context).colorScheme.primary,
                      side: BorderSide(color: context.tokens.borderInput),
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.task.title,
                          style: TextStyle(
                            color: widget.task.isCompleted
                                ? context.tokens.textMuted
                                : context.tokens.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            decoration: widget.task.isCompleted
                                ? TextDecoration.lineThrough
                                : null,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Type + Required/Optional chips
                        Row(
                          children: [
                            Icon(_typeIcon(widget.task.type),
                                size: 12, color: context.tokens.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              _typeLabel(widget.task.type),
                              style: TextStyle(
                                color: context.tokens.textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: widget.task.isRequired
                                    ? Theme.of(context)
                                        .colorScheme
                                        .primary
                                        .withValues(alpha: 0.12)
                                    : context.tokens.bgSurface,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                widget.task.isRequired ? 'Required' : 'Optional',
                                style: TextStyle(
                                  color: widget.task.isRequired
                                      ? Theme.of(context).colorScheme.primary
                                      : context.tokens.textMuted,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // ── 5-minute focus timer ──────────────────────────
                        GestureDetector(
                          onTap: (!widget.readOnly && !_timerDone)
                              ? _startTimer
                              : null,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: timerBg,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.timer_outlined,
                                    size: 10, color: timerColor),
                                const SizedBox(width: 4),
                                Text(
                                  _timerDone
                                      ? "Time's up!"
                                      : _timerStarted
                                          ? _timerLabel
                                          : _timerLabel,
                                  style: TextStyle(
                                    color: timerColor,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // File attach button only for file-shaped proofs.
                  if (!widget.readOnly && _isFileProof)
                    SizedBox(
                      width: 32,
                      height: 32,
                      child: widget.isUploading
                          ? Center(
                              child: SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 1.5,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                            )
                          : IconButton(
                              onPressed: widget.onPickProof,
                              icon: Icon(
                                widget.hasPublicUrl
                                    ? Icons.attach_file
                                    : Icons.upload_file_outlined,
                                color: widget.hasPublicUrl
                                    ? Theme.of(context).colorScheme.primary
                                    : context.tokens.textMuted,
                                size: 18,
                              ),
                              tooltip: 'Attach proof',
                              padding: EdgeInsets.zero,
                              visualDensity: VisualDensity.compact,
                              constraints: const BoxConstraints(),
                            ),
                    ),
                ],
              ),
            ),
          ),
          // Locked banner — shown when timer expired and task not completed
          if (widget.isLocked && !widget.readOnly)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFdc2626).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: const Color(0xFFdc2626).withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline,
                      size: 13, color: Color(0xFFdc2626)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Task locked — timer expired',
                      style: const TextStyle(
                        color: Color(0xFFdc2626),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: widget.onLifeline,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bolt_rounded,
                              size: 12, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            'Get Lifeline',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'Rajdhani',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

          if (widget.proofName != null ||
              (widget.task.proofUrl != null && !widget.readOnly == false))
            Padding(
              padding: const EdgeInsets.fromLTRB(46, 0, 12, 10),
              child: Row(
                children: [
                  const Icon(Icons.check_circle,
                      color: Color(0xFF4ade80), size: 12),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      widget.proofName ?? 'Proof attached',
                      style: const TextStyle(
                          color: Color(0xFF4ade80), fontSize: 10),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

          if (widget.description != null && widget.description!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(46, 0, 12, 6),
              child: Text(
                widget.description!,
                style: TextStyle(
                    color: context.tokens.textMuted,
                    fontSize: 11,
                    height: 1.4),
              ),
            ),
          if (widget.deliverables != null && widget.deliverables!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(46, 0, 12, 6),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: context.tokens.bgInput,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  widget.deliverables!,
                  style: TextStyle(
                      color: context.tokens.textSecondary,
                      fontSize: 11,
                      height: 1.4),
                ),
              ),
            ),

          // Text / URL response input.
          if (!widget.readOnly &&
              (_isTextProof || _isUrlProof) &&
              widget.responseController != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(46, 4, 12, 12),
              child: TextField(
                controller: widget.responseController,
                onChanged: widget.onResponseChanged,
                keyboardType: _isUrlProof
                    ? TextInputType.url
                    : TextInputType.multiline,
                maxLines: _isUrlProof ? 1 : 4,
                minLines: _isUrlProof ? 1 : 2,
                style: TextStyle(
                    color: context.tokens.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  isDense: true,
                  filled: true,
                  fillColor: context.tokens.bgInput,
                  hintText: _isUrlProof
                      ? 'Paste your link (https://…)'
                      : 'Type your response…',
                  hintStyle: TextStyle(
                      color: context.tokens.textMuted, fontSize: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide:
                        BorderSide(color: context.tokens.borderCard),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide:
                        BorderSide(color: context.tokens.borderCard),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                ),
              ),
            ),

          // Read-only display of submitted text/URL response.
          if (widget.readOnly &&
              (_isTextProof || _isUrlProof) &&
              (widget.responseController?.text.isNotEmpty ?? false))
            Padding(
              padding: const EdgeInsets.fromLTRB(46, 0, 12, 12),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: context.tokens.bgInput,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: context.tokens.borderCard),
                ),
                child: Text(
                  widget.responseController!.text,
                  style: TextStyle(
                      color: context.tokens.textSecondary,
                      fontSize: 12,
                      height: 1.4),
                ),
              ),
            ),
        ],
      ),
    );
  }

  IconData _typeIcon(BatchTaskType type) {
    switch (type) {
      case BatchTaskType.watch:
        return Icons.play_circle_outline;
      case BatchTaskType.quiz:
        return Icons.quiz_outlined;
      case BatchTaskType.matching:
        return Icons.compare_arrows;
      case BatchTaskType.written:
        return Icons.edit_outlined;
      case BatchTaskType.flashcard:
        return Icons.style_outlined;
    }
  }

  String _typeLabel(BatchTaskType type) {
    switch (type) {
      case BatchTaskType.watch:
        return 'Watch';
      case BatchTaskType.quiz:
        return 'Quiz';
      case BatchTaskType.matching:
        return 'Matching';
      case BatchTaskType.written:
        return 'Written';
      case BatchTaskType.flashcard:
        return 'Flashcard';
    }
  }
}

// ── Journal section ───────────────────────────────────────────────────────────

class _JournalSection extends StatelessWidget {
  const _JournalSection({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'JOURNAL',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.8,
                color: context.tokens.textMuted,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              onChanged: onChanged,
              minLines: 3,
              maxLines: 8,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: context.tokens.bgInput,
                hintText: 'What did you learn today?',
                hintStyle: TextStyle(color: context.tokens.textMuted),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Attendance section ────────────────────────────────────────────────────────

class _AttendanceSection extends StatelessWidget {
  const _AttendanceSection({
    required this.hasAttendance,
    required this.marking,
    required this.notesController,
    required this.onMark,
  });

  final bool hasAttendance;
  final bool marking;
  final TextEditingController notesController;
  final VoidCallback onMark;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        padding: const EdgeInsets.all(14),
        child: hasAttendance
            ? const Row(
                children: [
                  Icon(Icons.check_circle,
                      color: Color(0xFF4ade80), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'Attendance marked',
                    style: TextStyle(
                      color: Color(0xFF4ade80),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ATTENDANCE',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: context.tokens.textMuted,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notesController,
                    style: TextStyle(
                        color: context.tokens.textPrimary, fontSize: 13),
                    decoration: inputDecorationOf(context, 'Notes (optional)'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: ElevatedButton(
                      onPressed: marking ? null : onMark,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: marking
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Mark Attendance',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                letterSpacing: 0.5,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

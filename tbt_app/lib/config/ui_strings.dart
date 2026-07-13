/// All member-facing UI strings from `GET /api/pub/config/ui-strings → data`.
///
/// Every field is nullable — widgets fall back to a hardcoded English default
/// when a key is absent (backend newly added, API offline, etc.).
class UiStrings {
  const UiStrings({
    this.loading,
    this.noWorkshops,
    this.noResources,
    this.qaLoadingLabel,
    this.errorGeneric,
    this.lockedContentMessage,
    this.countdownDays,
    this.countdownHours,
    this.countdownMins,
    this.countdownSecs,
    this.loginHeading,
    this.loginSubheading,
    this.emailLabel,
    this.emailPlaceholder,
    this.passwordLabel,
    this.passwordPlaceholder,
    this.submitLabel,
    this.profilePersonalLabel,
    this.profileSubscriptionLabel,
    this.profileTiersLabel,
    this.profileSignOutLabel,
    this.profileSaveLabel,
    this.profileFirstNameLabel,
    this.profileLastNameLabel,
    this.profileEmailLabel,
    this.profilePhoneLabel,
    this.profileDobLabel,
    this.profileSubStartLabel,
    this.profileSubEndLabel,
    this.episodeCompleteLabel,
    this.playerAutoLabel,
    this.liveCallJoinLabel,
    this.watchBackLabel,
    this.assignmentCtaLabel,
    this.assignmentSubmitLabel,
    this.assignmentCancelLabel,
    this.notificationsPageTitle,
    this.notificationsUnreadSuffix,
    this.notificationsMarkAllLabel,
    this.notificationsEmptyTitle,
    this.notificationsEmptyDesc,
    this.resourcesDownloadLabel,
    this.paginationPrevLabel,
    this.paginationNextLabel,
    this.messagesPageTitle,
    this.messagesUnreadSuffix,
    this.messagesMarkAllLabel,
    this.messagesEmptyTitle,
    this.messagesEmptyDesc,
    this.chatPageTitle,
    this.chatNewLabel,
    this.chatSubjectLabel,
    this.chatTypingText,
    this.chatClosedLabel,
    this.chatEmptyTitle,
    this.chatEmptyDesc,
    this.chatSelectPrompt,
    this.reflectTitle,
    this.reflectPromptPrefix,
    this.reflectPromptSuffix,
    this.reflectPlaceholder,
    this.reflectSkipLabel,
    this.reflectSaveLabel,
    this.reflectSavedLabel,
    this.batchProgramLabel,
    this.batchNotAssignedMsg,
    this.batchContactMsg,
    this.batchDaysApprovedLabel,
    this.batchAllDaysLabel,
    this.batchStatusNotStarted,
    this.batchStatusInProgress,
    this.batchStatusPendingReview,
    this.batchStatusApproved,
    this.batchStatusNeedsRevision,
    this.batchStatusApprovedCheck,
    this.batchApprovedPillLabel,
    this.batchPendingPillLabel,
    this.batchNeedsRevisionPillLabel,
    this.batchInProgressPillLabel,
    this.batchTodayLabel,
    this.batchNotAssignedNote,
    this.batchRevisionLabel,
    this.batchFutureNote,
    this.batchPendingNote,
    this.batchApprovedNote,
    this.batchOpenResourceLabel,
    this.batchChecklistLabel,
    this.batchDoneLabel,
    this.batchJournalLabel,
    this.batchJournalPlaceholder,
    this.batchSaveDraftLabel,
    this.batchSubmitLabel,
    this.batchProgressSaved,
    this.batchProgressSaveError,
    this.batchSubmitSuccess,
    this.batchBreakReasonLabel,
    this.batchBreakRejectedLabel,
    this.batchBreakSubmitLabel,
    this.pendingApprovalTitle,
    this.pendingApprovalBody,
    this.freeInterceptorTitle,
    this.freeInterceptorBody,
    this.upgradeNowLabel,
    this.dashboardWelcome,
    this.continueWatchingLabel,
    this.recentlyWatchedLabel,
  });

  // ── General ────────────────────────────────────────────────────────────────
  final String? loading;
  final String? noWorkshops;
  final String? noResources;
  final String? qaLoadingLabel;
  final String? errorGeneric;
  final String? lockedContentMessage;

  // ── Countdown ──────────────────────────────────────────────────────────────
  final String? countdownDays;
  final String? countdownHours;
  final String? countdownMins;
  final String? countdownSecs;

  // ── Auth ───────────────────────────────────────────────────────────────────
  final String? loginHeading;
  final String? loginSubheading;
  final String? emailLabel;
  final String? emailPlaceholder;
  final String? passwordLabel;
  final String? passwordPlaceholder;
  final String? submitLabel;

  // ── Profile ────────────────────────────────────────────────────────────────
  final String? profilePersonalLabel;
  final String? profileSubscriptionLabel;
  final String? profileTiersLabel;
  final String? profileSignOutLabel;
  final String? profileSaveLabel;
  final String? profileFirstNameLabel;
  final String? profileLastNameLabel;
  final String? profileEmailLabel;
  final String? profilePhoneLabel;
  final String? profileDobLabel;
  final String? profileSubStartLabel;
  final String? profileSubEndLabel;

  // ── Video player ───────────────────────────────────────────────────────────
  final String? episodeCompleteLabel;
  final String? playerAutoLabel;
  final String? liveCallJoinLabel;
  final String? watchBackLabel;

  // ── Assignments ────────────────────────────────────────────────────────────
  final String? assignmentCtaLabel;
  final String? assignmentSubmitLabel;
  final String? assignmentCancelLabel;

  // ── Notifications ──────────────────────────────────────────────────────────
  final String? notificationsPageTitle;
  final String? notificationsUnreadSuffix;
  final String? notificationsMarkAllLabel;
  final String? notificationsEmptyTitle;
  final String? notificationsEmptyDesc;

  // ── Resources ─────────────────────────────────────────────────────────────
  final String? resourcesDownloadLabel;

  // ── Pagination ────────────────────────────────────────────────────────────
  final String? paginationPrevLabel;
  final String? paginationNextLabel;

  // ── Messages ──────────────────────────────────────────────────────────────
  final String? messagesPageTitle;
  final String? messagesUnreadSuffix;
  final String? messagesMarkAllLabel;
  final String? messagesEmptyTitle;
  final String? messagesEmptyDesc;

  // ── Chat ──────────────────────────────────────────────────────────────────
  final String? chatPageTitle;
  final String? chatNewLabel;
  final String? chatSubjectLabel;
  final String? chatTypingText;
  final String? chatClosedLabel;
  final String? chatEmptyTitle;
  final String? chatEmptyDesc;
  final String? chatSelectPrompt;

  // ── Reflection modal ──────────────────────────────────────────────────────
  final String? reflectTitle;
  final String? reflectPromptPrefix;
  final String? reflectPromptSuffix;
  final String? reflectPlaceholder;
  final String? reflectSkipLabel;
  final String? reflectSaveLabel;
  final String? reflectSavedLabel;

  // ── Batch program ─────────────────────────────────────────────────────────
  final String? batchProgramLabel;
  final String? batchNotAssignedMsg;
  final String? batchContactMsg;
  final String? batchDaysApprovedLabel;
  final String? batchAllDaysLabel;
  final String? batchStatusNotStarted;
  final String? batchStatusInProgress;
  final String? batchStatusPendingReview;
  final String? batchStatusApproved;
  final String? batchStatusNeedsRevision;
  final String? batchStatusApprovedCheck;
  final String? batchApprovedPillLabel;
  final String? batchPendingPillLabel;
  final String? batchNeedsRevisionPillLabel;
  final String? batchInProgressPillLabel;
  final String? batchTodayLabel;
  final String? batchNotAssignedNote;
  final String? batchRevisionLabel;
  final String? batchFutureNote;
  final String? batchPendingNote;
  final String? batchApprovedNote;
  final String? batchOpenResourceLabel;
  final String? batchChecklistLabel;
  final String? batchDoneLabel;
  final String? batchJournalLabel;
  final String? batchJournalPlaceholder;
  final String? batchSaveDraftLabel;
  final String? batchSubmitLabel;
  final String? batchProgressSaved;
  final String? batchProgressSaveError;
  final String? batchSubmitSuccess;
  final String? batchBreakReasonLabel;
  final String? batchBreakRejectedLabel;
  final String? batchBreakSubmitLabel;

  // ── Subscription gate ─────────────────────────────────────────────────────
  final String? pendingApprovalTitle;
  final String? pendingApprovalBody;
  final String? freeInterceptorTitle;
  final String? freeInterceptorBody;
  final String? upgradeNowLabel;

  // ── Dashboard ─────────────────────────────────────────────────────────────
  final String? dashboardWelcome;
  final String? continueWatchingLabel;
  final String? recentlyWatchedLabel;

  factory UiStrings.fromJson(Map<String, dynamic> json) => UiStrings(
        loading: json['loading'] as String?,
        noWorkshops: json['noWorkshops'] as String?,
        noResources: json['noResources'] as String?,
        qaLoadingLabel: json['qaLoadingLabel'] as String?,
        errorGeneric: json['errorGeneric'] as String?,
        lockedContentMessage: json['lockedContentMessage'] as String?,
        countdownDays: json['countdownDays'] as String?,
        countdownHours: json['countdownHours'] as String?,
        countdownMins: json['countdownMins'] as String?,
        countdownSecs: json['countdownSecs'] as String?,
        loginHeading: json['loginHeading'] as String?,
        loginSubheading: json['loginSubheading'] as String?,
        emailLabel: json['emailLabel'] as String?,
        emailPlaceholder: json['emailPlaceholder'] as String?,
        passwordLabel: json['passwordLabel'] as String?,
        passwordPlaceholder: json['passwordPlaceholder'] as String?,
        submitLabel: json['submitLabel'] as String?,
        profilePersonalLabel: json['profilePersonalLabel'] as String?,
        profileSubscriptionLabel:
            json['profileSubscriptionLabel'] as String?,
        profileTiersLabel: json['profileTiersLabel'] as String?,
        profileSignOutLabel: json['profileSignOutLabel'] as String?,
        profileSaveLabel: json['profileSaveLabel'] as String?,
        profileFirstNameLabel: json['profileFirstNameLabel'] as String?,
        profileLastNameLabel: json['profileLastNameLabel'] as String?,
        profileEmailLabel: json['profileEmailLabel'] as String?,
        profilePhoneLabel: json['profilePhoneLabel'] as String?,
        profileDobLabel: json['profileDobLabel'] as String?,
        profileSubStartLabel: json['profileSubStartLabel'] as String?,
        profileSubEndLabel: json['profileSubEndLabel'] as String?,
        episodeCompleteLabel: json['episodeCompleteLabel'] as String?,
        playerAutoLabel: json['playerAutoLabel'] as String?,
        liveCallJoinLabel: json['liveCallJoinLabel'] as String?,
        watchBackLabel: json['watchBackLabel'] as String?,
        assignmentCtaLabel: json['assignmentCtaLabel'] as String?,
        assignmentSubmitLabel: json['assignmentSubmitLabel'] as String?,
        assignmentCancelLabel: json['assignmentCancelLabel'] as String?,
        notificationsPageTitle:
            json['notificationsPageTitle'] as String?,
        notificationsUnreadSuffix:
            json['notificationsUnreadSuffix'] as String?,
        notificationsMarkAllLabel:
            json['notificationsMarkAllLabel'] as String?,
        notificationsEmptyTitle:
            json['notificationsEmptyTitle'] as String?,
        notificationsEmptyDesc:
            json['notificationsEmptyDesc'] as String?,
        resourcesDownloadLabel:
            json['resourcesDownloadLabel'] as String?,
        paginationPrevLabel: json['paginationPrevLabel'] as String?,
        paginationNextLabel: json['paginationNextLabel'] as String?,
        messagesPageTitle: json['messagesPageTitle'] as String?,
        messagesUnreadSuffix: json['messagesUnreadSuffix'] as String?,
        messagesMarkAllLabel: json['messagesMarkAllLabel'] as String?,
        messagesEmptyTitle: json['messagesEmptyTitle'] as String?,
        messagesEmptyDesc: json['messagesEmptyDesc'] as String?,
        chatPageTitle: json['chatPageTitle'] as String?,
        chatNewLabel: json['chatNewLabel'] as String?,
        chatSubjectLabel: json['chatSubjectLabel'] as String?,
        chatTypingText: json['chatTypingText'] as String?,
        chatClosedLabel: json['chatClosedLabel'] as String?,
        chatEmptyTitle: json['chatEmptyTitle'] as String?,
        chatEmptyDesc: json['chatEmptyDesc'] as String?,
        chatSelectPrompt: json['chatSelectPrompt'] as String?,
        reflectTitle: json['reflectTitle'] as String?,
        reflectPromptPrefix: json['reflectPromptPrefix'] as String?,
        reflectPromptSuffix: json['reflectPromptSuffix'] as String?,
        reflectPlaceholder: json['reflectPlaceholder'] as String?,
        reflectSkipLabel: json['reflectSkipLabel'] as String?,
        reflectSaveLabel: json['reflectSaveLabel'] as String?,
        reflectSavedLabel: json['reflectSavedLabel'] as String?,
        batchProgramLabel: json['batchProgramLabel'] as String?,
        batchNotAssignedMsg: json['batchNotAssignedMsg'] as String?,
        batchContactMsg: json['batchContactMsg'] as String?,
        batchDaysApprovedLabel:
            json['batchDaysApprovedLabel'] as String?,
        batchAllDaysLabel: json['batchAllDaysLabel'] as String?,
        batchStatusNotStarted:
            json['batchStatusNotStarted'] as String?,
        batchStatusInProgress:
            json['batchStatusInProgress'] as String?,
        batchStatusPendingReview:
            json['batchStatusPendingReview'] as String?,
        batchStatusApproved: json['batchStatusApproved'] as String?,
        batchStatusNeedsRevision:
            json['batchStatusNeedsRevision'] as String?,
        batchStatusApprovedCheck:
            json['batchStatusApprovedCheck'] as String?,
        batchApprovedPillLabel:
            json['batchApprovedPillLabel'] as String?,
        batchPendingPillLabel:
            json['batchPendingPillLabel'] as String?,
        batchNeedsRevisionPillLabel:
            json['batchNeedsRevisionPillLabel'] as String?,
        batchInProgressPillLabel:
            json['batchInProgressPillLabel'] as String?,
        batchTodayLabel: json['batchTodayLabel'] as String?,
        batchNotAssignedNote: json['batchNotAssignedNote'] as String?,
        batchRevisionLabel: json['batchRevisionLabel'] as String?,
        batchFutureNote: json['batchFutureNote'] as String?,
        batchPendingNote: json['batchPendingNote'] as String?,
        batchApprovedNote: json['batchApprovedNote'] as String?,
        batchOpenResourceLabel:
            json['batchOpenResourceLabel'] as String?,
        batchChecklistLabel: json['batchChecklistLabel'] as String?,
        batchDoneLabel: json['batchDoneLabel'] as String?,
        batchJournalLabel: json['batchJournalLabel'] as String?,
        batchJournalPlaceholder:
            json['batchJournalPlaceholder'] as String?,
        batchSaveDraftLabel: json['batchSaveDraftLabel'] as String?,
        batchSubmitLabel: json['batchSubmitLabel'] as String?,
        batchProgressSaved: json['batchProgressSaved'] as String?,
        batchProgressSaveError:
            json['batchProgressSaveError'] as String?,
        batchSubmitSuccess: json['batchSubmitSuccess'] as String?,
        batchBreakReasonLabel:
            json['batchBreakReasonLabel'] as String?,
        batchBreakRejectedLabel:
            json['batchBreakRejectedLabel'] as String?,
        batchBreakSubmitLabel:
            json['batchBreakSubmitLabel'] as String?,
        // Fields not in DB schema — forward-compatible additions:
        pendingApprovalTitle:
            json['pendingApprovalTitle'] as String?,
        pendingApprovalBody: json['pendingApprovalBody'] as String?,
        freeInterceptorTitle: json['freeInterceptorTitle'] as String?,
        freeInterceptorBody: json['freeInterceptorBody'] as String?,
        upgradeNowLabel: json['upgradeNowLabel'] as String?,
        dashboardWelcome: json['dashboardWelcome'] as String?,
        continueWatchingLabel:
            json['continueWatchingLabel'] as String?,
        recentlyWatchedLabel: json['recentlyWatchedLabel'] as String?,
      );
}

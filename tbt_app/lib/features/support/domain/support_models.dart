// Plain-data models for the support / helpdesk feature.

class HelpdeskSettings {
  const HelpdeskSettings({
    required this.title,
    required this.buttonText,
    this.subtitle,
    this.whatsappNumber,
    this.phoneNumber,
    this.email,
    this.websiteUrl,
    this.supportTiming,
    this.address,
    this.bannerImage,
  });
  final String title;
  final String buttonText;
  final String? subtitle;
  final String? whatsappNumber;
  final String? phoneNumber;
  final String? email;
  final String? websiteUrl;
  final String? supportTiming;
  final String? address;
  final String? bannerImage;

  factory HelpdeskSettings.fromJson(Map<String, dynamic> j) => HelpdeskSettings(
        title: (j['title'] as String?) ?? 'Support Center',
        buttonText: (j['buttonText'] as String?) ?? 'Contact Us',
        subtitle: j['subtitle'] as String?,
        whatsappNumber: j['whatsappNumber'] as String?,
        phoneNumber: j['phoneNumber'] as String?,
        email: j['email'] as String?,
        websiteUrl: j['websiteUrl'] as String?,
        supportTiming: j['supportTiming'] as String?,
        address: j['address'] as String?,
        bannerImage: j['bannerImage'] as String?,
      );
}

class SupportCategory {
  const SupportCategory({
    required this.id,
    required this.name,
    this.description,
    this.icon,
  });
  final String id;
  final String name;
  final String? description;
  final String? icon;

  factory SupportCategory.fromJson(Map<String, dynamic> j) => SupportCategory(
        id: j['id'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        icon: j['icon'] as String?,
      );
}

class Faq {
  const Faq({
    required this.id,
    required this.question,
    required this.answer,
    this.categoryId,
    this.category,
  });
  final String id;
  final String question;
  final String answer;
  final String? categoryId;
  final SupportCategoryRef? category;

  factory Faq.fromJson(Map<String, dynamic> j) => Faq(
        id: j['id'] as String,
        question: j['question'] as String,
        answer: j['answer'] as String,
        categoryId: j['categoryId'] as String?,
        category: j['category'] != null
            ? SupportCategoryRef.fromJson(j['category'] as Map<String, dynamic>)
            : null,
      );
}

class SupportCategoryRef {
  const SupportCategoryRef({required this.id, required this.name, required this.slug});
  final String id;
  final String name;
  final String slug;
  factory SupportCategoryRef.fromJson(Map<String, dynamic> j) => SupportCategoryRef(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: (j['slug'] as String?) ?? '',
      );
}

class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.subject,
    required this.message,
    required this.status,
    required this.createdAt,
    this.category,
    this.attachmentUrl,
    this.adminReply,
    this.adminRepliedAt,
  });
  final String id;
  final String subject;
  final String message;
  final String status; // new | in_progress | resolved | closed
  final DateTime createdAt;
  final SupportCategoryRef? category;
  final String? attachmentUrl;
  final String? adminReply;
  final DateTime? adminRepliedAt;

  bool get hasAdminReply => adminReply != null && adminReply!.trim().isNotEmpty;

  factory SupportTicket.fromJson(Map<String, dynamic> j) => SupportTicket(
        id: j['id'] as String,
        subject: j['subject'] as String,
        message: j['message'] as String,
        status: (j['status'] as String?) ?? 'new',
        createdAt: DateTime.parse(j['createdAt'] as String),
        category: j['category'] != null
            ? SupportCategoryRef.fromJson(j['category'] as Map<String, dynamic>)
            : null,
        attachmentUrl: j['attachmentUrl'] as String?,
        adminReply: j['adminReply'] as String?,
        adminRepliedAt: j['adminRepliedAt'] != null
            ? DateTime.tryParse(j['adminRepliedAt'] as String)
            : null,
      );
}

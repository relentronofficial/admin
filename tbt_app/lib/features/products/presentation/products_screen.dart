import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/theme/design_constants.dart';
import '../data/products_service.dart';
import '../providers/products_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class ProductsScreen extends ConsumerWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: context.tokens.bgSurface,
          elevation: 0,
          scrolledUnderElevation: 0,
          title: Text(
            'PRODUCTS',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 17,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: context.tokens.textPrimary,
            ),
          ),
          bottom: TabBar(
            labelColor: Theme.of(context).colorScheme.primary,
            unselectedLabelColor: context.tokens.textMuted,
            indicatorColor: Theme.of(context).colorScheme.primary,
            indicatorSize: TabBarIndicatorSize.label,
            labelStyle: TextStyle(
              fontFamily: 'Rajdhani',
              fontWeight: FontWeight.w700,
              fontSize: 13,
              letterSpacing: 1,
            ),
            tabs: [
              Tab(text: 'ALL PRODUCTS'),
              Tab(text: 'MY INQUIRIES'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _AllProductsTab(),
            _MyProductsTab(),
          ],
        ),
      ),
    );
  }
}

// ── All Products tab ──────────────────────────────────────────────────────────

class _AllProductsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(productsProvider);

    return async.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
            const SizedBox(height: 12),
            Text('Failed to load products',
                style: TextStyle(color: context.tokens.textSecondary)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(productsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (products) {
        if (products.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.storefront_outlined,
                    color: context.tokens.textMuted, size: 40),
                SizedBox(height: 12),
                Text('No products available',
                    style:
                        TextStyle(color: context.tokens.textSecondary, fontSize: 14)),
              ],
            ),
          );
        }

        // 2 cols on phones, 3 on tablets (matches the web tablet layout).
        final width = MediaQuery.of(context).size.width;
        final cols = width >= 600 ? 3 : 2;
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 0.72,
          ),
          itemCount: products.length,
          itemBuilder: (_, i) => _ProductCard(
            product: products[i],
            onTap: () => _showProductDetail(context, ref, products[i]),
          ),
        );
      },
    );
  }

  void _showProductDetail(
      BuildContext context, WidgetRef ref, Product product) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _ProductDetailSheet(product: product, ref: ref),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: product.title,
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail with category overlay (top-left) to match web.
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(10)),
              child: AspectRatio(
                aspectRatio: 1.1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    product.thumbnailUrl != null
                        ? CachedNetworkImage(
                            imageUrl: product.thumbnailUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              color: context.tokens.bgInput,
                              child: Center(
                                child: Icon(Icons.image_outlined,
                                    color: context.tokens.textMuted, size: 28),
                              ),
                            ),
                            errorWidget: (_, __, ___) => Container(
                              color: context.tokens.bgInput,
                              child: Center(
                                child: Icon(Icons.image_outlined,
                                    color: context.tokens.textMuted, size: 28),
                              ),
                            ),
                          )
                        : Container(
                            color: context.tokens.bgInput,
                            child: Center(
                              child: Icon(Icons.shopping_bag_outlined,
                                  color: context.tokens.textMuted, size: 32),
                            ),
                          ),
                    if (product.category != null)
                      Positioned(
                        top: 6,
                        left: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.local_offer_outlined,
                                  color: Colors.white, size: 9),
                              const SizedBox(width: 4),
                              Text(
                                product.category!.toUpperCase(),
                                style: const TextStyle(
                                  fontFamily: 'Rajdhani',
                                  fontSize: 8,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // (Category is now rendered as an overlay on the thumbnail
                  // above — no duplicate here.)
                  Text(
                    product.title,
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    product.formattedPrice,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}

// ── Product detail bottom sheet ───────────────────────────────────────────────

class _ProductDetailSheet extends StatefulWidget {
  const _ProductDetailSheet({required this.product, required this.ref});

  final Product product;
  final WidgetRef ref;

  @override
  State<_ProductDetailSheet> createState() => _ProductDetailSheetState();
}

class _ProductDetailSheetState extends State<_ProductDetailSheet> {
  bool _submitting = false;
  bool _submitted = false;

  Future<void> _openInquiryDialog() async {
    final controller = TextEditingController();
    final message = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.bgModal,
        title: Text(
          'Send Inquiry',
          style: TextStyle(color: context.tokens.textPrimary, fontFamily: 'Rajdhani',
              fontSize: 18, fontWeight: FontWeight.w700),
        ),
        content: TextField(
          controller: controller,
          maxLines: 4,
          autofocus: true,
          style: TextStyle(color: context.tokens.textPrimary),
          decoration: kInputDecoration('Tell us what you need...'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(color: context.tokens.textMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: Text('Send',
                style: TextStyle(color: Theme.of(context).colorScheme.primary)),
          ),
        ],
      ),
    );

    if (message == null || !mounted) return;

    setState(() => _submitting = true);
    try {
      await widget.ref
          .read(productsFeatureServiceProvider)
          .submitInquiry(widget.product.id, message);
      widget.ref.invalidate(myProductsProvider);
      if (mounted) setState(() { _submitting = false; _submitted = true; });
    } catch (_) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send inquiry')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 24 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: context.tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Thumbnail
          if (product.thumbnailUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedNetworkImage(
                imageUrl: product.thumbnailUrl!,
                height: 180,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          if (product.thumbnailUrl != null) const SizedBox(height: 16),

          // Category + Title
          if (product.category != null)
            Text(
              product.category!.toUpperCase(),
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: context.tokens.textMuted,
              ),
            ),
          Text(
            product.title,
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),

          // Price + stock
          Row(
            children: [
              Text(
                product.formattedPrice,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Rajdhani',
                ),
              ),
              if (product.stockStatus == 'out_of_stock') ...[
                const SizedBox(width: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFdc2626).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'OUT OF STOCK',
                    style: TextStyle(
                      color: Color(0xFFdc2626),
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Description
          if (product.description != null &&
              product.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              product.description!,
              style: TextStyle(
                  color: context.tokens.textSecondary, fontSize: 14, height: 1.5),
            ),
          ],

          const SizedBox(height: 20),

          // CTAs from backend
          ...product.ctas.map(
            (cta) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  onPressed: () async {
                    final uri = Uri.tryParse(cta.url);
                    if (uri != null && cta.url.isNotEmpty) {
                      await launchUrl(uri,
                          mode: LaunchMode.externalApplication);
                    }
                    if (context.mounted) Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        cta.type == 'primary' ? Theme.of(context).colorScheme.primary : context.tokens.bgInput,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: cta.type != 'primary'
                          ? BorderSide(color: context.tokens.borderCard)
                          : BorderSide.none,
                    ),
                  ),
                  child: Text(
                    cta.label,
                    style: const TextStyle(
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

          // Inquire button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: _submitted
                ? Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF16a34a).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: const Color(0xFF16a34a).withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle_outline,
                            color: Color(0xFF16a34a), size: 18),
                        SizedBox(width: 8),
                        Text(
                          'Inquiry Sent',
                          style: TextStyle(
                            color: Color(0xFF16a34a),
                            fontFamily: 'Rajdhani',
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  )
                : ElevatedButton.icon(
                    icon: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.send_outlined, size: 18),
                    label: Text(
                      _submitting ? 'Sending…' : 'Inquire',
                      style: const TextStyle(
                        fontFamily: 'Rajdhani',
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed: _submitting ? null : _openInquiryDialog,
                  ),
          ),
        ],
      ),
    );
  }
}

// ── My Inquiries tab ──────────────────────────────────────────────────────────

class _MyProductsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myProductsProvider);

    return async.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
            const SizedBox(height: 12),
            Text('Failed to load inquiries',
                style: TextStyle(color: context.tokens.textSecondary)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(myProductsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.inbox_outlined, color: context.tokens.textMuted, size: 40),
                SizedBox(height: 12),
                Text(
                  "You haven't inquired about any products yet",
                  style:
                      TextStyle(color: context.tokens.textSecondary, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: items.length,
          itemBuilder: (_, i) => _InquiredProductTile(item: items[i]),
        );
      },
    );
  }
}

class _InquiredProductTile extends StatelessWidget {
  const _InquiredProductTile({required this.item});

  final InquiredProduct item;

  Color get _statusColor {
    return switch (item.inquiryStatus) {
      'approved' => const Color(0xFF16a34a),
      'rejected' => const Color(0xFFdc2626),
      _ => const Color(0xFFd97706),
    };
  }

  String get _statusLabel {
    return switch (item.inquiryStatus) {
      'approved' => 'Approved',
      'rejected' => 'Rejected',
      _ => 'Pending',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Row(
        children: [
          if (item.thumbnailUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: CachedNetworkImage(
                imageUrl: item.thumbnailUrl!,
                width: 52,
                height: 52,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => _PlaceholderBox(),
              ),
            )
          else
            _PlaceholderBox(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.category != null)
                  Text(
                    item.category!.toUpperCase(),
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: context.tokens.textMuted,
                    ),
                  ),
                Text(
                  item.title,
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  item.formattedPrice,
                  style: TextStyle(
                    color: context.tokens.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _statusLabel,
              style: TextStyle(
                color: _statusColor,
                fontFamily: 'Rajdhani',
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaceholderBox extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: context.tokens.bgInput,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Center(
        child: Icon(Icons.shopping_bag_outlined,
            color: context.tokens.textMuted, size: 22),
      ),
    );
  }
}

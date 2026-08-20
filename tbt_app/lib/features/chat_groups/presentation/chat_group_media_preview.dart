import 'dart:io';

import 'package:flutter/material.dart';

import '../../../shared/theme/design_constants.dart';

/// Full-screen preview before sending an image or video.
///
/// Returns `({caption, file})` when the user taps Send,
/// or `null` when they cancel. Documents bypass this screen and upload
/// directly from the picker.
class ChatGroupMediaPreviewScreen extends StatefulWidget {
  const ChatGroupMediaPreviewScreen({
    super.key,
    required this.file,
    required this.mediaType,
  });
  final File file;
  // 'image' | 'video'
  final String mediaType;

  @override
  State<ChatGroupMediaPreviewScreen> createState() =>
      _ChatGroupMediaPreviewScreenState();
}

class _ChatGroupMediaPreviewScreenState
    extends State<ChatGroupMediaPreviewScreen> {
  final _captionCtl = TextEditingController();
  final _captionFocus = FocusNode();

  @override
  void dispose() {
    _captionCtl.dispose();
    _captionFocus.dispose();
    super.dispose();
  }

  void _send() {
    Navigator.of(context).pop(
      (caption: _captionCtl.text.trim(), file: widget.file),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(null),
        ),
        title: Text(
          widget.mediaType == 'video' ? 'Video Preview' : 'Photo Preview',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.send_rounded, color: kColorAccent),
            onPressed: _send,
            tooltip: 'Send',
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Media preview ──────────────────────────────────────────
          Expanded(
            child: Center(
              child: widget.mediaType == 'image'
                  ? InteractiveViewer(
                      child: Image.file(
                        widget.file,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.broken_image_outlined,
                          color: Colors.white24,
                          size: 64,
                        ),
                      ),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.play_circle_outline_rounded,
                            color: Colors.white54, size: 72),
                        const SizedBox(height: 12),
                        Text(
                          widget.file.path.split(Platform.pathSeparator).last,
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
            ),
          ),
          // ── Caption + Send bar ─────────────────────────────────────
          SafeArea(
            top: false,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1a1a1a),
                border: Border(
                    top: BorderSide(color: Colors.white10, width: 0.5)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _captionCtl,
                      focusNode: _captionFocus,
                      maxLines: 3,
                      minLines: 1,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Add a caption…',
                        hintStyle:
                            const TextStyle(color: Colors.white38, fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFF2a2a2a),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _send,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        color: kColorAccent,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.send_rounded,
                          color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

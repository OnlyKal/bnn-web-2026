import 'package:chewie/chewie.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../../app_services.dart';
import '../../../core/theme/app_colors.dart';
import 'viewer_scaffold.dart';

class VideoViewerScreen extends StatefulWidget {
  const VideoViewerScreen({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<VideoViewerScreen> createState() => _VideoViewerScreenState();
}

class _VideoViewerScreenState extends State<VideoViewerScreen> {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _chewie?.dispose();
    _video?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final headers = context.read<AppServices>().files.authHeadersFor(widget.url);
    _chewie?.dispose();
    await _video?.dispose();
    if (!mounted) return;
    setState(() {
      _error = null;
      _chewie = null;
      _video = null;
    });
    final video = VideoPlayerController.networkUrl(Uri.parse(widget.url), httpHeaders: headers);
    try {
      await video.initialize();
      if (!mounted) {
        await video.dispose();
        return;
      }
      setState(() {
        _video = video;
        _chewie = ChewieController(
          videoPlayerController: video,
          autoPlay: true,
          allowFullScreen: true,
          allowMuting: true,
          showOptions: true,
          materialProgressColors: ChewieProgressColors(
            playedColor: AppColors.primary,
            handleColor: AppColors.cyan,
            bufferedColor: Colors.white38,
            backgroundColor: Colors.white12,
          ),
          errorBuilder: (context, message) => Center(
            child: Text('Lecture impossible : $message', style: const TextStyle(color: Colors.white)),
          ),
        );
      });
    } catch (_) {
      await video.dispose();
      if (mounted) setState(() => _error = 'Impossible de lire cette vidéo. Vérifiez votre connexion et réessayez.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final chewie = _chewie;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        systemOverlayStyle: SystemUiOverlayStyle.light,
        shape: const Border(),
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white)),
      ),
      body: _error != null
          ? ColoredBox(color: Colors.white, child: ViewerError(message: _error!, onRetry: _load))
          : chewie == null
              ? const Center(child: CupertinoActivityIndicator(color: Colors.white, radius: 14))
              : SafeArea(child: Center(child: Chewie(controller: chewie))),
    );
  }
}

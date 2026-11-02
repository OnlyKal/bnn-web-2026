import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_utils.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/salon.dart';
import '../../../data/services/salons_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import 'salon_widgets.dart';

class SalonDetailScreen extends StatefulWidget {
  const SalonDetailScreen({super.key, required this.salonId, this.preview});

  final String salonId;
  final Salon? preview;

  @override
  State<SalonDetailScreen> createState() => _SalonDetailScreenState();
}

class _SalonDetailScreenState extends State<SalonDetailScreen> with WidgetsBindingObserver {
  late final SalonsService _service = context.read<AppServices>().salons;
  final _text = TextEditingController();
  Salon? _salon;
  List<SalonMessage> _messages = [];
  List<Json> _members = [];
  List<PickedUpload> _files = [];
  bool _loading = true;
  bool _messagesLoading = false;
  bool _busy = false;
  bool _sending = false;
  String? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _salon = widget.preview;
    WidgetsBinding.instance.addObserver(this);
    _text.addListener(() => setState(() {}));
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _text.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncPolling();
      _fetchNewMessages();
    } else if (state == AppLifecycleState.paused) {
      _poll?.cancel();
    }
  }

  bool get _isCreator => context.read<SessionController>().user?.matches(_salon?.createur) ?? false;

  bool _isOwn(SalonMessage m) =>
      m.isOwnFlag ?? (context.read<SessionController>().user?.matches(personJson(m.author)) ?? false);

  Future<void> _load({bool logHistory = true}) async {
    setState(() {
      _loading = _salon == null;
      _error = null;
    });
    try {
      final salon = await _service.get(widget.salonId);
      if (!mounted) return;
      setState(() => _salon = salon);
      if (logHistory) {
        context.read<HistoryController>().add(
              type: HistoryType.salon,
              title: salon.titre,
              description: salon.description.isEmpty ? 'Discussion consultée' : salon.description,
              target: HistoryTarget.salons,
              metadata: {'salonId': salon.id},
            );
      }
      _loadMembers();
      if (salon.estMembre) await _loadMessages();
      _syncPolling();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMembers() async {
    try {
      final members = await _service.members(widget.salonId);
      if (mounted) setState(() => _members = members);
    } on ApiException {
      if (mounted) setState(() => _members = []);
    }
  }

  Future<void> _loadMessages() async {
    setState(() => _messagesLoading = true);
    try {
      final messages = await _service.messages(widget.salonId);
      if (mounted) setState(() => _messages = messages);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _messagesLoading = false);
    }
  }

  Future<void> _fetchNewMessages() async {
    if (_salon?.estMembre != true) return;
    try {
      final after = _messages.isEmpty ? null : _messages.last.id;
      final fresh = await _service.messages(widget.salonId, afterId: after);
      if (!mounted || fresh.isEmpty) return;
      final known = _messages.map((m) => m.id).toSet();
      final additions = fresh.where((m) => !known.contains(m.id)).toList();
      if (additions.isNotEmpty) setState(() => _messages = [..._messages, ...additions]);
    } on ApiException {
      // Silencieux : nouvel essai au prochain cycle.
    }
  }

  void _syncPolling() {
    _poll?.cancel();
    if (_salon?.estMembre == true) {
      _poll = Timer.periodic(const Duration(seconds: 7), (_) => _fetchNewMessages());
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) showSuccess(context, success);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() => _run(() async {
        await _service.join(widget.salonId);
        await _load(logHistory: false);
      }, 'Vous avez rejoint le salon.');

  Future<void> _quit() async {
    final ok = await confirmAction(
      context,
      title: 'Quitter ce salon ?',
      message: 'Vous ne pourrez plus consulter ni envoyer de messages.',
      confirmLabel: 'Quitter',
      destructive: true,
      icon: CupertinoIcons.square_arrow_left,
    );
    if (!ok) return;
    await _run(() async {
      await _service.quit(widget.salonId);
      _messages = [];
      await _load(logHistory: false);
    }, 'Vous avez quitté le salon.');
  }

  Future<void> _edit() async {
    final salon = _salon!;
    final result = await showModalBottomSheet<SalonFormResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SalonFormSheet(
        mode: SalonFormMode.edit,
        initialTitle: salon.titre,
        initialDescription: salon.description,
      ),
    );
    if (result == null) return;
    await _run(() async {
      await _service.update(widget.salonId, titre: result.titre, description: result.description);
      await _load(logHistory: false);
    }, 'Salon modifié avec succès.');
  }

  Future<void> _addResources() async {
    final result = await showModalBottomSheet<SalonFormResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const SalonFormSheet(mode: SalonFormMode.resources),
    );
    if (result == null) return;
    await _run(() async {
      await _service.addResources(widget.salonId, result.resources);
      await _load(logHistory: false);
    }, 'Ressources ajoutées.');
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      title: 'Supprimer ce salon ?',
      message: 'Le salon « ${_salon!.titre} » et ses messages seront supprimés.',
      confirmLabel: 'Supprimer',
      destructive: true,
      icon: CupertinoIcons.trash,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await _service.delete(widget.salonId);
      if (!mounted) return;
      showSuccess(context, 'Salon supprimé.');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty && _files.isEmpty) {
      showError(context, 'Un message vide sans fichier est refusé.');
      return;
    }
    setState(() => _sending = true);
    try {
      await _service.send(widget.salonId, text: text, files: _files);
      _text.clear();
      setState(() => _files = []);
      await _fetchNewMessages();
      if (_messages.isEmpty) await _loadMessages();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _showInfo() {
    final salon = _salon!;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(15)),
                  child: Text(
                    salon.titre.isNotEmpty ? salon.titre[0].toUpperCase() : '#',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 22),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(salon.titre, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              salon.description.isEmpty ? 'Aucune description disponible.' : salon.description,
              style: const TextStyle(color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 24),
            SectionHeader(
              icon: CupertinoIcons.paperclip,
              title: 'Ressources',
              subtitle: '${salon.ressources.length} partagée(s)',
            ),
            const SizedBox(height: 4),
            if (salon.ressources.isEmpty)
              const Text('Aucune ressource partagée', style: TextStyle(color: AppColors.textMuted))
            else
              for (final r in salon.ressources) SalonResourceTile(resource: r),
            const SizedBox(height: 24),
            SectionHeader(
              icon: CupertinoIcons.person_2,
              title: 'Membres du salon',
              subtitle: '${salon.membresCount ?? _members.length} participant(s)',
            ),
            const SizedBox(height: 4),
            if (_members.isEmpty)
              const Text('Aucun membre affiché', style: TextStyle(color: AppColors.textMuted))
            else
              for (final m in _members)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: UserAvatar(initial: personName(m).characters.first.toUpperCase(), size: 38),
                  title: Text(personName(m)),
                ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final salon = _salon;
    if (salon == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Salon')),
        body: _loading
            ? const Center(child: CupertinoActivityIndicator())
            : StatusView.error(message: _error, onAction: _load),
      );
    }
    final isCreator = _isCreator;
    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: _showInfo,
          borderRadius: BorderRadius.circular(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(salon.titre, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(
                '${salon.membresCount ?? _members.length} participant(s)',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(tooltip: 'Infos du salon', onPressed: _showInfo, icon: const Icon(CupertinoIcons.info_circle)),
          PopupMenuButton<String>(
            enabled: !_busy,
            tooltip: 'Plus d’actions',
            icon: const Icon(CupertinoIcons.ellipsis_circle),
            position: PopupMenuPosition.under,
            onSelected: (value) => switch (value) {
              'refresh' => _loadMessages(),
              'quit' => _quit(),
              'edit' => _edit(),
              'resources' => _addResources(),
              'delete' => _delete(),
              _ => null,
            },
            itemBuilder: (_) => [
              if (salon.estMembre)
                const PopupMenuItem(value: 'refresh', child: ListTile(leading: Icon(CupertinoIcons.arrow_clockwise), title: Text('Actualiser'))),
              if (salon.estMembre && !isCreator)
                const PopupMenuItem(value: 'quit', child: ListTile(leading: Icon(CupertinoIcons.square_arrow_left), title: Text('Quitter'))),
              if (isCreator) ...[
                const PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(CupertinoIcons.pencil), title: Text('Modifier'))),
                const PopupMenuItem(
                  value: 'resources',
                  child: ListTile(leading: Icon(CupertinoIcons.paperclip), title: Text('Ajouter des ressources')),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: ListTile(
                    leading: Icon(CupertinoIcons.trash, color: AppColors.danger),
                    title: Text('Supprimer', style: TextStyle(color: AppColors.danger)),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_busy) const LinearProgressIndicator(minHeight: 2),
          Expanded(child: salon.estMembre ? _buildMessages() : _buildJoin(salon)),
          if (salon.estMembre) _buildComposer(),
        ],
      ),
    );
  }

  Widget _buildJoin(Salon salon) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        SurfaceCard(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: IconTile(CupertinoIcons.chat_bubble_2_fill, size: 60, iconSize: 28, radius: 18)),
              const SizedBox(height: 14),
              Text(salon.titre, textAlign: TextAlign.center, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              const SizedBox(height: 8),
              Text(
                salon.description,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary, height: 1.45),
              ),
              const SizedBox(height: 18),
              const Text(
                'Rejoignez ce salon pour consulter et envoyer des messages.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: _busy ? null : _join,
                icon: const Icon(CupertinoIcons.person_badge_plus, size: 20),
                label: const Text('Rejoindre le salon'),
              ),
            ],
          ),
        ),
        if (salon.ressources.isNotEmpty) ...[
          const SizedBox(height: 24),
          const SectionHeader(title: 'Ressources', icon: CupertinoIcons.paperclip),
          const SizedBox(height: 6),
          SurfaceCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(children: [for (final r in salon.ressources) SalonResourceTile(resource: r)]),
          ),
        ],
      ],
    );
  }

  Widget _buildMessages() {
    if (_messagesLoading && _messages.isEmpty) return const Center(child: CupertinoActivityIndicator());
    if (_messages.isEmpty) {
      return const StatusView(
        icon: CupertinoIcons.chat_bubble,
        title: 'Aucun message pour le moment',
        message: 'Lancez la discussion !',
      );
    }
    final count = _messages.length;
    return ListView.builder(
      reverse: true,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      itemCount: count,
      itemBuilder: (context, reversedIndex) {
        final index = count - 1 - reversedIndex;
        final message = _messages[index];
        final previous = index > 0 ? _messages[index - 1] : null;
        final sameDay = previous?.date != null &&
            message.date != null &&
            DateUtils.isSameDay(previous!.date, message.date);
        final grouped = sameDay && previous.authorId != null && previous.authorId == message.authorId;
        return Column(
          children: [
            if (!sameDay && message.date != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    formatDayLabel(message.date!),
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                  ),
                ),
              ),
            _MessageBubble(message: message, own: _isOwn(message), grouped: grouped),
          ],
        );
      },
    );
  }

  Widget _buildComposer() {
    final canSend = !_sending && (_text.text.trim().isNotEmpty || _files.isNotEmpty);
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_sending) const LinearProgressIndicator(minHeight: 2),
            if (_files.isNotEmpty)
              SizedBox(
                height: 48,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  scrollDirection: Axis.horizontal,
                  itemCount: _files.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) => InputChip(
                    avatar: Icon(_files[index].isImage ? CupertinoIcons.photo : CupertinoIcons.doc_text, size: 16, color: AppColors.primary),
                    deleteIcon: const Icon(CupertinoIcons.xmark, size: 14),
                    label: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 160),
                      child: Text(_files[index].name, overflow: TextOverflow.ellipsis),
                    ),
                    onDeleted: _sending ? null : () => setState(() => _files = [..._files]..removeAt(index)),
                    deleteButtonTooltipMessage: 'Retirer ${_files[index].name}',
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 8, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Joindre un fichier',
                    onPressed: _sending
                        ? null
                        : () async {
                            final picked = await pickUploads(context);
                            if (picked.isNotEmpty) setState(() => _files = [..._files, ...picked]);
                          },
                    icon: const Icon(CupertinoIcons.paperclip, color: AppColors.textMuted),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _text,
                      enabled: !_sending,
                      minLines: 1,
                      maxLines: 5,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'Écrire un message',
                        isDense: true,
                        fillColor: AppColors.fill,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    tooltip: 'Envoyer le message',
                    onPressed: canSend ? _send : null,
                    style: IconButton.styleFrom(
                      disabledBackgroundColor: AppColors.fill,
                      disabledForegroundColor: AppColors.textFaint,
                    ),
                    icon: _sending
                        ? const CupertinoActivityIndicator(color: Colors.white)
                        : const Icon(CupertinoIcons.arrow_up, size: 20),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.own, required this.grouped});

  final SalonMessage message;
  final bool own;
  final bool grouped;

  @override
  Widget build(BuildContext context) {
    final bg = own ? AppColors.primary : Colors.white;
    final fg = own ? Colors.white : AppColors.textPrimary;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(own ? 18 : 4),
      bottomRight: Radius.circular(own ? 4 : 18),
    );
    return Align(
      alignment: own ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        child: Container(
          margin: EdgeInsets.only(top: grouped ? 3 : 10),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: radius,
            border: own ? null : Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!grouped && !own)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    message.authorName,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.primary),
                  ),
                ),
              if (message.contenu.isNotEmpty)
                SelectableText(message.contenu, style: TextStyle(color: fg, height: 1.35, fontSize: 14.5)),
              for (final a in message.attachments)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: a.isImage
                      ? GestureDetector(
                          onTap: () => openSalonFile(context, url: a.url, name: a.name, isImage: true),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: CachedNetworkImage(
                              imageUrl: a.url,
                              httpHeaders: context.read<AppServices>().files.authHeadersFor(a.url),
                              height: 180,
                              fit: BoxFit.cover,
                              placeholder: (_, _) => const SizedBox(height: 180, child: Center(child: CupertinoActivityIndicator())),
                              errorWidget: (_, _, _) => const Icon(CupertinoIcons.photo),
                            ),
                          ),
                        )
                      : InkWell(
                          onTap: () => openSalonFile(context, url: a.url, name: a.name),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: own ? Colors.white.withValues(alpha: 0.15) : AppColors.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(CupertinoIcons.doc_text_fill, size: 20, color: own ? Colors.white : AppColors.primary),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    a.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                ),
              const SizedBox(height: 3),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    message.date == null ? '' : formatTime(message.date!.toIso8601String()),
                    style: TextStyle(fontSize: 11, color: own ? Colors.white70 : AppColors.textFaint),
                  ),
                  if (own) ...[
                    const SizedBox(width: 4),
                    Icon(
                      message.status == MessageStatus.sent ? CupertinoIcons.checkmark_alt : CupertinoIcons.checkmark_alt_circle_fill,
                      size: 14,
                      color: message.status == MessageStatus.read ? AppColors.cyan : Colors.white70,
                      semanticLabel: switch (message.status) {
                        MessageStatus.sent => 'Envoyé',
                        MessageStatus.delivered => 'Reçu',
                        MessageStatus.read => 'Lu',
                      },
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

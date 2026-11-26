import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/json_utils.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/salon.dart';
import '../../../data/services/salon_socket.dart';
import '../../../data/services/salons_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import 'salon_sheets.dart';
import 'salon_widgets.dart';

final _mentionPattern = RegExp(r'@([\w.+-]+)');

class SalonDetailScreen extends StatefulWidget {
  const SalonDetailScreen({super.key, required this.salonId, this.preview});

  final String salonId;
  final Salon? preview;

  @override
  State<SalonDetailScreen> createState() => _SalonDetailScreenState();
}

class _TypingUser {
  _TypingUser(this.name, this.until);

  final String name;
  final DateTime until;
}

class _SalonDetailScreenState extends State<SalonDetailScreen> with WidgetsBindingObserver {
  late final SalonsService _service = context.read<AppServices>().salons;
  final _socket = SalonSocket.instance;
  final _text = TextEditingController();
  final _focus = FocusNode();
  StreamSubscription<SalonSocketEvent>? _socketEvents;
  Salon? _salon;
  List<SalonMessage> _messages = [];
  List<SalonUser> _memberUsers = [];
  List<PickedUpload> _files = [];
  SalonMessage? _replyTo;
  SharedResource? _shared;
  bool _hasMore = false;
  bool _loading = true;
  bool _messagesLoading = false;
  bool _loadingOlder = false;
  bool _busy = false;
  bool _sending = false;
  bool _subscribed = false;
  String? _error;
  String? _mentionQuery;
  Timer? _poll;
  Timer? _markReadDebounce;
  Timer? _typingTick;
  DateTime _lastTypingSent = DateTime.fromMillisecondsSinceEpoch(0);
  final Map<String, _TypingUser> _typing = {};

  @override
  void initState() {
    super.initState();
    _salon = widget.preview;
    WidgetsBinding.instance.addObserver(this);
    _text.addListener(_onTextChanged);
    _socket.acquire(() => context.read<AppServices>().session.authorizationHeader);
    _socketEvents = _socket.events.listen(_onSocketEvent);
    _socket.connected.addListener(_syncPolling);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _markReadDebounce?.cancel();
    _typingTick?.cancel();
    _socket.connected.removeListener(_syncPolling);
    _socketEvents?.cancel();
    if (_subscribed) _socket.unsubscribe(widget.salonId);
    _socket.release();
    _text.dispose();
    _focus.dispose();
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

  bool get _isCreator =>
      (_salon?.estCreateur ?? false) || (context.read<SessionController>().user?.matches(_salon?.createur) ?? false);

  bool _isOwn(SalonMessage m) =>
      m.isOwnFlag ?? (context.read<SessionController>().user?.matches(personJson(m.author)) ?? false);

  // ------------------------------------------------------------------ Chargement

  Future<void> _load({bool logHistory = true}) async {
    setState(() {
      _loading = _salon == null;
      _error = null;
    });
    try {
      final salon = await _service.get(widget.salonId);
      if (!mounted) return;
      setState(() => _salon = salon);
      if (salon.pasEncoreOuvert && salon.dateOuverture != null) {
        showOpeningPopup(context, 'Ce salon ouvre le ${formatOuverture(salon.dateOuverture!)}. Revenez à ce moment-là.');
      }
      if (logHistory) {
        context.read<HistoryController>().add(
              type: HistoryType.salon,
              title: salon.titre,
              description: salon.description.isEmpty ? 'Discussion consultée' : salon.description,
              target: HistoryTarget.salons,
              metadata: {'salonId': salon.id},
            );
      }
      if (salon.estMembre) {
        _follow();
        _loadMemberUsers();
        await _loadMessages();
        // Les notifications de ce salon sont vues.
        _service.markAllRead(salonId: salon.id).catchError((_) {});
      }
      _syncPolling();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Recharge les infos du salon sans toucher aux messages.
  Future<void> _refreshSalon() async {
    try {
      final salon = await _service.get(widget.salonId);
      if (!mounted) return;
      final becameMember = salon.estMembre && !(_salon?.estMembre ?? false);
      setState(() => _salon = salon);
      if (becameMember) {
        _follow();
        _loadMemberUsers();
        _loadMessages();
      } else if (!salon.estMembre) {
        setState(() => _messages = []);
      }
      _syncPolling();
    } on ApiException {
      // Silencieux : l'écran garde l'état connu.
    }
  }

  void _follow() {
    if (_subscribed) {
      _socket.resubscribe(widget.salonId);
      return;
    }
    _subscribed = true;
    _socket.subscribe(widget.salonId);
  }

  Future<void> _loadMemberUsers() async {
    try {
      final members = await _service.members(widget.salonId);
      if (mounted) setState(() => _memberUsers = members.membres.map((m) => m.user).toList());
    } on ApiException {
      // Utilisé seulement pour les suggestions de mentions.
    }
  }

  Future<void> _loadMessages() async {
    setState(() => _messagesLoading = true);
    try {
      final page = await _service.messages(widget.salonId);
      if (mounted) {
        setState(() {
          _messages = page.messages;
          _hasMore = page.hasMore;
        });
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _messagesLoading = false);
    }
  }

  Future<void> _loadOlder() async {
    if (_loadingOlder || !_hasMore || _messages.isEmpty) return;
    setState(() => _loadingOlder = true);
    try {
      final page = await _service.messages(widget.salonId, beforeId: _messages.first.id);
      if (!mounted) return;
      final known = _messages.map((m) => m.id).toSet();
      setState(() {
        _messages = [...page.messages.where((m) => !known.contains(m.id)), ..._messages];
        _hasMore = page.hasMore;
      });
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  Future<void> _fetchNewMessages() async {
    if (_salon?.estMembre != true) return;
    try {
      final after = _messages.isEmpty ? null : _messages.last.id;
      final page = await _service.messages(widget.salonId, afterId: after);
      if (!mounted || page.messages.isEmpty) return;
      _mergeMessages(page.messages);
    } on ApiException {
      // Silencieux : nouvel essai au prochain cycle.
    }
  }

  void _mergeMessages(List<SalonMessage> incoming) {
    final byId = {for (final m in _messages) m.id: m};
    for (final m in incoming) {
      byId[m.id] = m;
    }
    final merged = byId.values.toList()..sort((a, b) => a.numericId.compareTo(b.numericId));
    setState(() => _messages = merged);
  }

  void _replaceMessage(SalonMessage message) {
    if (!_messages.any((m) => m.id == message.id)) return;
    setState(() => _messages = [for (final m in _messages) m.id == message.id ? message : m]);
  }

  /// Sans WebSocket : nouveaux messages toutes les 7 s. Avec : simple filet de sécurité.
  void _syncPolling() {
    _poll?.cancel();
    if (_salon?.estMembre != true) return;
    final period = _socket.connected.value ? const Duration(seconds: 60) : const Duration(seconds: 7);
    _poll = Timer.periodic(period, (_) => _fetchNewMessages());
  }

  void _markReadSoon() {
    _markReadDebounce?.cancel();
    _markReadDebounce = Timer(const Duration(milliseconds: 1500), () {
      _service.markRead(widget.salonId).catchError((_) {});
    });
  }

  // ------------------------------------------------------------------ Temps réel

  void _onSocketEvent(SalonSocketEvent event) {
    if (!mounted || event.salonId != widget.salonId) return;
    switch (event.event) {
      case 'message.created':
        final message = SalonMessage.fromJson(event.payload);
        _typing.remove(message.authorId);
        _mergeMessages([message]);
        if (!_isOwn(message)) _markReadSoon();
      case 'message.updated' || 'message.deleted':
        _replaceMessage(SalonMessage.fromJson(event.payload));
      case 'message.pinned':
        _replaceMessage(SalonMessage.fromJson(event.payload));
        _refreshSalon();
      case 'typing':
        final user = asJson(event.payload['utilisateur']);
        final id = pickString(user, ['id']);
        if (id == null) return;
        setState(() => _typing[id] = _TypingUser(personName(user), DateTime.now().add(const Duration(seconds: 4))));
        _typingTick ??= Timer.periodic(const Duration(seconds: 1), (_) => _expireTyping());
      case 'salon.updated' || 'members.updated' || 'membership.changed':
        _refreshSalon();
        if (event.event == 'members.updated') _loadMemberUsers();
      case 'salon.deleted':
        showInfo(context, 'Ce salon a été supprimé par son créateur.');
        Navigator.of(context).maybePop();
      case 'notification.new':
        _service.markAllRead(salonId: widget.salonId).catchError((_) {});
      default:
        break;
    }
  }

  void _expireTyping() {
    final now = DateTime.now();
    final before = _typing.length;
    _typing.removeWhere((_, t) => t.until.isBefore(now));
    if (_typing.isEmpty) {
      _typingTick?.cancel();
      _typingTick = null;
    }
    if (before != _typing.length && mounted) setState(() {});
  }

  void _onTextChanged() {
    final text = _text.text;
    final cursor = _text.selection.baseOffset < 0 ? text.length : _text.selection.baseOffset;
    final before = text.substring(0, cursor.clamp(0, text.length));
    final match = RegExp(r'(?:^|\s)@([\w.+-]*)$').firstMatch(before);
    final query = match?.group(1);
    if (query != _mentionQuery) setState(() => _mentionQuery = query);
    if (text.trim().isNotEmpty && DateTime.now().difference(_lastTypingSent) > const Duration(seconds: 3)) {
      _lastTypingSent = DateTime.now();
      _socket.typing(widget.salonId);
    }
    setState(() {});
  }

  List<SalonUser> get _mentionSuggestions {
    final q = _mentionQuery?.toLowerCase();
    if (q == null) return const [];
    final me = context.read<SessionController>().user;
    return _memberUsers
        .where((u) => u.username.isNotEmpty && !(me?.matches({'id': u.id}) ?? false))
        .where((u) => u.username.toLowerCase().contains(q) || u.name.toLowerCase().contains(q))
        .take(6)
        .toList();
  }

  void _insertMention(SalonUser user) {
    final text = _text.text;
    final cursor = _text.selection.baseOffset < 0 ? text.length : _text.selection.baseOffset;
    final before = text.substring(0, cursor);
    final start = before.lastIndexOf('@');
    if (start < 0) return;
    final inserted = '@${user.username} ';
    final next = text.replaceRange(start, cursor, inserted);
    _text.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + inserted.length),
    );
  }

  // ------------------------------------------------------------------ Actions du salon

  Future<void> _run(Future<void> Function() action, String? success) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted && success != null) showSuccess(context, success);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (isNotYetOpenError(e)) {
        showOpeningPopup(context, e.message);
      } else {
        showError(context, e.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() => _run(() async {
        final message = await _service.join(widget.salonId);
        if (mounted) showSuccess(context, message);
        await _load(logHistory: false);
      }, null);

  Future<void> _quit({bool cancelRequest = false, bool declineInvite = false}) async {
    final ok = await confirmAction(
      context,
      title: declineInvite
          ? "Refuser l'invitation ?"
          : cancelRequest
              ? 'Annuler votre demande ?'
              : 'Quitter ce salon ?',
      message: declineInvite || cancelRequest
          ? 'Vous pourrez toujours redemander l’accès plus tard.'
          : 'Vous ne pourrez plus consulter ni envoyer de messages.',
      confirmLabel: declineInvite ? 'Refuser' : cancelRequest ? 'Annuler la demande' : 'Quitter',
      destructive: true,
      icon: CupertinoIcons.square_arrow_left,
    );
    if (!ok) return;
    await _run(() async {
      await _service.quit(widget.salonId);
      _messages = [];
      await _load(logHistory: false);
    }, declineInvite ? 'Invitation refusée.' : cancelRequest ? 'Demande annulée.' : 'Vous avez quitté le salon.');
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
        initialPrive: salon.prive,
        initialOuverture: salon.dateOuverture,
      ),
    );
    if (result == null) return;
    await _run(() async {
      await _service.update(
        widget.salonId,
        titre: result.titre,
        description: result.description,
        prive: result.prive,
        ouverture: result.ouverture,
      );
      await _refreshSalon();
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
      await _refreshSalon();
    }, 'Ressources ajoutées.');
  }

  Future<void> _deleteResource(SalonResource resource) async {
    final ok = await confirmAction(
      context,
      title: 'Retirer cette ressource ?',
      message: '« ${resource.title} » ne sera plus proposée dans le salon.',
      confirmLabel: 'Retirer',
      destructive: true,
      icon: CupertinoIcons.trash,
    );
    if (!ok) return;
    await _run(() async {
      await _service.deleteResource(widget.salonId, resource.id);
      await _refreshSalon();
    }, 'Ressource retirée.');
  }

  Future<void> _toggleClosed() async {
    final closing = !_salon!.ferme;
    if (closing) {
      final ok = await confirmAction(
        context,
        title: 'Fermer ce salon ?',
        message: 'Les membres pourront encore relire les messages et ouvrir les fichiers, '
            'mais plus personne ne pourra écrire ni rejoindre le salon. Vous pourrez le rouvrir.',
        confirmLabel: 'Fermer',
        icon: CupertinoIcons.lock,
      );
      if (!ok) return;
    }
    await _run(() async {
      final message = await _service.setClosed(widget.salonId, closed: closing);
      if (mounted) {
        setState(() {
          _replyTo = null;
          _shared = null;
          _files = [];
        });
        showSuccess(context, message);
      }
      await _refreshSalon();
    }, null);
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

  Future<void> _showMembers() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => MembersSheet(salon: _salon!),
    );
    if (mounted) _refreshSalon();
  }

  Future<void> _showReports() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => ReportsSheet(salonId: widget.salonId, onDeleteMessage: _deleteMessageById),
    );
  }

  // ------------------------------------------------------------------ Messages

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty && _files.isEmpty && _shared == null) {
      showError(context, 'Un message vide sans fichier est refusé.');
      return;
    }
    if (text.length > 5000) {
      showError(context, 'Un message ne peut pas dépasser 5000 caractères.');
      return;
    }
    setState(() => _sending = true);
    try {
      final sent = await _service.send(
        widget.salonId,
        text: text,
        files: _files,
        replyTo: _replyTo?.id,
        resource: _shared,
      );
      _text.clear();
      setState(() {
        _files = [];
        _replyTo = null;
        _shared = null;
      });
      if (sent != null) {
        _mergeMessages([sent]);
      } else {
        await _fetchNewMessages();
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickShare() async {
    final resource = await showModalBottomSheet<SharedResource>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const SharePickerSheet(),
    );
    if (resource != null && mounted) setState(() => _shared = resource);
  }

  Future<void> _pickFiles() async {
    final picked = await pickUploads(context);
    if (picked.isEmpty || !mounted) return;
    final all = [..._files, ...picked];
    if (all.length > SalonsService.maxAttachments) {
      showError(context, 'Un message peut contenir ${SalonsService.maxAttachments} pièces jointes maximum.');
    }
    setState(() => _files = all.take(SalonsService.maxAttachments).toList());
  }

  Future<void> _editMessage(SalonMessage message) async {
    final text = await promptText(context, title: 'Modifier le message', initial: message.contenu, confirmLabel: 'Enregistrer');
    if (text == null || text == message.contenu || !mounted) return;
    try {
      final updated = await _service.editMessage(widget.salonId, message.id, text);
      if (updated != null) _replaceMessage(updated);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  Future<bool> _deleteMessageById(String messageId) async {
    final ok = await confirmAction(
      context,
      title: 'Supprimer ce message ?',
      message: 'Le message sera remplacé par « Message supprimé » pour tout le monde.',
      confirmLabel: 'Supprimer',
      destructive: true,
      icon: CupertinoIcons.trash,
    );
    if (!ok) return false;
    try {
      await _service.deleteMessage(widget.salonId, messageId);
      await _fetchChanged(messageId);
      return true;
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
      return false;
    }
  }

  /// Sans WebSocket, recharge la page courante pour refléter une modification.
  Future<void> _fetchChanged(String messageId) async {
    if (_socket.connected.value) return;
    final message = _messages.where((m) => m.id == messageId).firstOrNull;
    if (message == null) return;
    try {
      final page = await _service.messages(widget.salonId, afterId: '${message.numericId - 1}', limit: 1);
      if (mounted && page.messages.isNotEmpty) _replaceMessage(page.messages.first);
    } on ApiException {
      // Le prochain rafraîchissement corrigera l'affichage.
    }
  }

  Future<void> _togglePin(SalonMessage message) async {
    try {
      final pinned = await _service.pinMessage(widget.salonId, message.id, pinned: !message.epingle);
      if (!mounted) return;
      showSuccess(context, pinned ? 'Message épinglé.' : 'Message désépinglé.');
      await _fetchChanged(message.id);
      _refreshSalon();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  Future<void> _report(SalonMessage message) async {
    final motif = await promptText(
      context,
      title: 'Signaler ce message',
      hint: 'Motif (facultatif)',
      confirmLabel: 'Signaler',
      allowEmpty: true,
      maxLines: 3,
    );
    if (motif == null || !mounted) return;
    try {
      final answer = await _service.reportMessage(widget.salonId, message.id, motif);
      if (mounted) showSuccess(context, answer);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  void _showMessageActions(SalonMessage message) {
    if (message.supprime) return;
    final own = _isOwn(message);
    final creator = _isCreator;
    final closed = _salon?.ferme ?? false;
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) {
        void close() => Navigator.of(sheetContext).pop();
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!closed)
                ListTile(
                  leading: const Icon(CupertinoIcons.reply),
                  title: const Text('Répondre'),
                  onTap: () {
                    close();
                    setState(() => _replyTo = message);
                    _focus.requestFocus();
                  },
                ),
              if (message.contenu.isNotEmpty)
                ListTile(
                  leading: const Icon(CupertinoIcons.doc_on_doc),
                  title: const Text('Copier le texte'),
                  onTap: () {
                    close();
                    Clipboard.setData(ClipboardData(text: message.contenu));
                    showInfo(context, 'Texte copié.');
                  },
                ),
              if (own && message.contenu.isNotEmpty && !closed)
                ListTile(
                  leading: const Icon(CupertinoIcons.pencil),
                  title: const Text('Modifier'),
                  onTap: () {
                    close();
                    _editMessage(message);
                  },
                ),
              if (creator && !closed)
                ListTile(
                  leading: Icon(message.epingle ? CupertinoIcons.pin_slash : CupertinoIcons.pin),
                  title: Text(message.epingle ? 'Désépingler' : 'Épingler'),
                  onTap: () {
                    close();
                    _togglePin(message);
                  },
                ),
              if (!own)
                ListTile(
                  leading: const Icon(CupertinoIcons.flag),
                  title: const Text('Signaler'),
                  onTap: () {
                    close();
                    _report(message);
                  },
                ),
              if (creator || (own && !closed))
                ListTile(
                  leading: const Icon(CupertinoIcons.trash, color: AppColors.danger),
                  title: const Text('Supprimer', style: TextStyle(color: AppColors.danger)),
                  onTap: () {
                    close();
                    _deleteMessageById(message.id);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _search() async {
    final query = await promptText(context, title: 'Rechercher dans le salon', hint: 'Mot ou expression', confirmLabel: 'Rechercher', maxLines: 1);
    if (query == null || query.trim().length < 2 || !mounted) return;
    setState(() => _busy = true);
    try {
      final page = await _service.messages(widget.salonId, search: query, limit: 50);
      if (!mounted) return;
      _showMessageList(
        title: 'Résultats pour « $query »',
        icon: CupertinoIcons.search,
        messages: page.messages.reversed.toList(),
        empty: 'Aucun message ne contient ce texte.',
      );
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showPinned() {
    _showMessageList(
      title: 'Messages épinglés',
      icon: CupertinoIcons.pin_fill,
      messages: _salon?.epingles ?? const [],
      empty: 'Aucun message épinglé.',
    );
  }

  void _showMessageList({
    required String title,
    required IconData icon,
    required List<SalonMessage> messages,
    required String empty,
  }) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.95,
        builder: (context, scroll) => Column(
          children: [
            SheetHeader(title: title, subtitle: '${messages.length} message(s)', icon: icon),
            const Divider(),
            Expanded(
              child: messages.isEmpty
                  ? StatusView(icon: icon, title: empty, compact: true)
                  : ListView.separated(
                      controller: scroll,
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: messages.length,
                      separatorBuilder: (_, _) => const Divider(),
                      itemBuilder: (context, index) {
                        final m = messages[index];
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(m.authorName,
                                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 13)),
                                ),
                                if (m.date != null)
                                  Text(
                                    '${formatDayLabel(m.date!)} ${formatTime(m.date!.toIso8601String())}',
                                    style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            if (m.contenu.isNotEmpty) SelectableText(m.contenu, style: const TextStyle(height: 1.4)),
                            if (m.ressource != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: SharedResourceCard(resource: m.ressource!),
                              ),
                            if (m.attachments.isNotEmpty)
                              Text('${m.attachments.length} pièce(s) jointe(s)',
                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5)),
                          ],
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ Infos

  void _showInfo() {
    final salon = _salon!;
    final isCreator = _isCreator;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(salon.titre, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                      const SizedBox(height: 4),
                      Pill(
                        salon.prive ? 'Salon privé' : 'Salon public',
                        color: salon.prive ? AppColors.violet : AppColors.successDark,
                        icon: salon.prive ? CupertinoIcons.lock_fill : CupertinoIcons.globe,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              salon.description.isEmpty ? 'Aucune description disponible.' : salon.description,
              style: const TextStyle(color: AppColors.textSecondary, height: 1.5),
            ),
            if (salon.createur != null) ...[
              const SizedBox(height: 8),
              Text('Créé par ${personName(salon.createur)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
            ],
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
              for (final r in salon.ressources)
                SalonResourceTile(
                  resource: r,
                  onDelete: isCreator && r.id.isNotEmpty
                      ? () {
                          Navigator.of(sheetContext).pop();
                          _deleteResource(r);
                        }
                      : null,
                ),
            const SizedBox(height: 16),
            if (salon.estMembre || isCreator)
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _showMembers();
                },
                icon: const Icon(CupertinoIcons.person_2, size: 19),
                label: Text('Membres (${salon.membresCount ?? _memberUsers.length})'
                    '${isCreator && salon.demandes > 0 ? ' · ${salon.demandes} demande(s)' : ''}'),
              ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ Interface

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
    final typingNames = _typing.values.map((t) => t.name).toList();
    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: _showInfo,
          borderRadius: BorderRadius.circular(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (salon.prive) const Icon(CupertinoIcons.lock_fill, size: 14),
                  if (salon.prive) const SizedBox(width: 4),
                  Flexible(child: Text(salon.titre, maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              ),
              Text(
                typingNames.isNotEmpty
                    ? '${typingNames.join(', ')} ${typingNames.length > 1 ? 'écrivent' : 'écrit'}…'
                    : '${salon.prive ? 'Privé' : 'Public'} · ${salon.membresCount ?? _memberUsers.length} participant(s)',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: typingNames.isNotEmpty ? AppColors.primary : AppColors.textMuted,
                  fontStyle: typingNames.isNotEmpty ? FontStyle.italic : null,
                ),
              ),
            ],
          ),
        ),
        actions: [
          if (salon.estMembre)
            IconButton(tooltip: 'Rechercher', onPressed: _busy ? null : _search, icon: const Icon(CupertinoIcons.search)),
          // Membres à portée d'un geste (équivalent de la colonne de droite sur le web).
          if (salon.estMembre || isCreator)
            IconButton(
              tooltip: 'Membres',
              onPressed: _busy ? null : _showMembers,
              icon: Badge(
                isLabelVisible: isCreator && salon.demandes > 0,
                label: Text('${salon.demandes}'),
                child: const Icon(CupertinoIcons.person_2),
              ),
            ),
          PopupMenuButton<String>(
            enabled: !_busy,
            tooltip: 'Plus d’actions',
            icon: const Icon(CupertinoIcons.ellipsis_circle),
            position: PopupMenuPosition.under,
            onSelected: (value) => switch (value) {
              'info' => _showInfo(),
              'members' => _showMembers(),
              'pinned' => _showPinned(),
              'refresh' => _loadMessages(),
              'quit' => _quit(),
              'edit' => _edit(),
              'resources' => _addResources(),
              'close' => _toggleClosed(),
              'reports' => _showReports(),
              'delete' => _delete(),
              _ => null,
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'info', child: ListTile(leading: Icon(CupertinoIcons.info_circle), title: Text('Infos du salon'))),
              if (salon.estMembre) ...[
                PopupMenuItem(
                  value: 'members',
                  child: ListTile(
                    leading: const Icon(CupertinoIcons.person_2),
                    title: Text(isCreator && salon.demandes > 0 ? 'Membres (${salon.demandes} demande(s))' : 'Membres'),
                  ),
                ),
                const PopupMenuItem(value: 'pinned', child: ListTile(leading: Icon(CupertinoIcons.pin), title: Text('Messages épinglés'))),
                const PopupMenuItem(value: 'refresh', child: ListTile(leading: Icon(CupertinoIcons.arrow_clockwise), title: Text('Actualiser'))),
              ],
              if (salon.estMembre && !isCreator)
                const PopupMenuItem(value: 'quit', child: ListTile(leading: Icon(CupertinoIcons.square_arrow_left), title: Text('Quitter'))),
              if (isCreator) ...[
                if (!salon.ferme) ...[
                  const PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(CupertinoIcons.pencil), title: Text('Modifier'))),
                  const PopupMenuItem(
                    value: 'resources',
                    child: ListTile(leading: Icon(CupertinoIcons.paperclip), title: Text('Ajouter des ressources')),
                  ),
                ],
                PopupMenuItem(
                  value: 'close',
                  child: ListTile(
                    leading: Icon(salon.ferme ? CupertinoIcons.lock_open : CupertinoIcons.lock),
                    title: Text(salon.ferme ? 'Rouvrir le salon' : 'Fermer le salon'),
                  ),
                ),
                const PopupMenuItem(value: 'reports', child: ListTile(leading: Icon(CupertinoIcons.flag), title: Text('Signalements'))),
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
          if (!salon.estOuvert && salon.dateOuverture != null) _buildOpeningBanner(salon, isCreator),
          if (salon.ferme) _buildClosedBanner(salon, isCreator),
          if (salon.estMembre && salon.epingles.isNotEmpty) _buildPinnedBar(salon),
          Expanded(child: salon.estMembre ? _buildMessages() : _buildJoin(salon)),
          if (salon.estMembre && !salon.ferme) _buildComposer(),
        ],
      ),
    );
  }

  Widget _buildOpeningBanner(Salon salon, bool isCreator) {
    return Container(
      width: double.infinity,
      color: AppColors.primarySoft,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(CupertinoIcons.clock_fill, size: 16, color: AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Ouverture le ${formatOuverture(salon.dateOuverture!)} (heure de Kinshasa).'
              '${isCreator ? " D'ici là, vous seul pouvez entrer pour préparer le salon." : " Personne ne peut entrer avant cette heure, même avec un lien d'invitation."}',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClosedBanner(Salon salon, bool isCreator) {
    final since = salon.dateFermeture == null ? '' : ' depuis le ${formatDayLabel(salon.dateFermeture!).toLowerCase()}';
    return Container(
      width: double.infinity,
      color: AppColors.fill,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(CupertinoIcons.lock_fill, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Salon fermé$since : les messages et fichiers restent consultables, mais plus personne ne peut écrire.'
              '${isCreator ? ' Vous pouvez le rouvrir ou le supprimer.' : ''}',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPinnedBar(Salon salon) {
    final last = salon.epingles.first;
    return Material(
      color: AppColors.primarySoft,
      child: InkWell(
        onTap: _showPinned,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 12, 8),
          child: Row(
            children: [
              const Icon(CupertinoIcons.pin_fill, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${last.authorName} : ${last.contenu.isEmpty ? (last.ressource?.titre ?? 'Pièce jointe') : last.contenu}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ),
              if (salon.epingles.length > 1)
                Text('+${salon.epingles.length - 1}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildJoin(Salon salon) {
    final (String message, List<Widget> actions) = switch (salon.statut) {
      _ when salon.ferme => ('Ce salon est fermé : il ne peut plus être rejoint.', <Widget>[]),
      _ when salon.pasEncoreOuvert && salon.dateOuverture != null => (
          'Ce salon ouvre le ${formatOuverture(salon.dateOuverture!)}. Revenez à ce moment-là.',
          <Widget>[],
        ),
      SalonStatut.enAttente => (
          "Votre demande d'accès a été envoyée au créateur du salon. Vous serez notifié dès qu'elle sera traitée.",
          [
            OutlinedButton.icon(
              onPressed: _busy ? null : () => _quit(cancelRequest: true),
              icon: const Icon(CupertinoIcons.xmark, size: 18),
              label: const Text('Annuler la demande'),
            ),
          ],
        ),
      SalonStatut.invite => (
          'Vous avez été invité à rejoindre ce salon.',
          [
            FilledButton.icon(
              onPressed: _busy ? null : _join,
              icon: const Icon(CupertinoIcons.checkmark_alt, size: 20),
              label: const Text("Accepter l'invitation"),
            ),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _busy ? null : () => _quit(declineInvite: true), child: const Text('Refuser')),
          ],
        ),
      SalonStatut.retire => ('Le créateur vous a retiré de ce salon.', <Widget>[]),
      _ => (
          salon.prive
              ? (salon.statut == SalonStatut.refuse
                  ? 'Votre précédente demande a été refusée. Vous pouvez en envoyer une nouvelle.'
                  : 'Ce salon est privé : demandez l’accès à son créateur pour lire et envoyer des messages.')
              : 'Rejoignez ce salon pour consulter et envoyer des messages.',
          [
            FilledButton.icon(
              onPressed: _busy ? null : _join,
              icon: Icon(salon.prive ? CupertinoIcons.lock_open : CupertinoIcons.person_badge_plus, size: 20),
              label: Text(salon.prive ? "Demander l'accès" : 'Rejoindre le salon'),
            ),
          ],
        ),
    };
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        SurfaceCard(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: IconTile(
                  salon.prive ? CupertinoIcons.lock_fill : CupertinoIcons.chat_bubble_2_fill,
                  size: 60,
                  iconSize: 28,
                  radius: 18,
                ),
              ),
              const SizedBox(height: 14),
              Text(salon.titre, textAlign: TextAlign.center, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              const SizedBox(height: 8),
              Text(
                salon.description,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary, height: 1.45),
              ),
              const SizedBox(height: 18),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
              if (actions.isNotEmpty) const SizedBox(height: 14),
              ...actions,
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
    final me = context.read<SessionController>().user;
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.extentAfter < 300) _loadOlder();
        return false;
      },
      child: ListView.builder(
        reverse: true,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        itemCount: count + (_hasMore ? 1 : 0),
        itemBuilder: (context, reversedIndex) {
          if (reversedIndex == count) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: _loadingOlder
                    ? const CupertinoActivityIndicator()
                    : TextButton(onPressed: _loadOlder, child: const Text('Charger les messages précédents')),
              ),
            );
          }
          final index = count - 1 - reversedIndex;
          final message = _messages[index];
          final previous = index > 0 ? _messages[index - 1] : null;
          final sameDay = previous?.date != null &&
              message.date != null &&
              DateUtils.isSameDay(previous!.date, message.date);
          final grouped = sameDay && previous.authorId != null && previous.authorId == message.authorId && message.reponseA == null;
          final mentionsMe = me != null && message.mentions.any((u) => me.matches({'username': u}));
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
              _MessageBubble(
                message: message,
                own: _isOwn(message),
                grouped: grouped,
                mentionsMe: mentionsMe,
                onLongPress: () => _showMessageActions(message),
                onReply: () {
                  if (_salon?.ferme ?? false) return;
                  setState(() => _replyTo = message);
                  _focus.requestFocus();
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildComposer() {
    final canSend = !_sending && (_text.text.trim().isNotEmpty || _files.isNotEmpty || _shared != null);
    final suggestions = _mentionSuggestions;
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
            if (suggestions.isNotEmpty)
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 200),
                child: ListView(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  children: [
                    for (final user in suggestions)
                      ListTile(
                        dense: true,
                        leading: UserAvatar(initial: user.initial, url: user.avatarUrl, size: 30),
                        title: Text(user.name),
                        subtitle: Text('@${user.username}'),
                        onTap: () => _insertMention(user),
                      ),
                  ],
                ),
              ),
            if (_replyTo != null)
              _ComposerBanner(
                icon: CupertinoIcons.reply,
                title: 'Réponse à ${_replyTo!.authorName}',
                text: _replyTo!.contenu.isEmpty ? 'Pièce jointe' : _replyTo!.contenu,
                onClose: () => setState(() => _replyTo = null),
              ),
            if (_shared != null)
              _ComposerBanner(
                icon: CupertinoIcons.book,
                title: 'Ressource ${_shared!.sourceLabel}',
                text: _shared!.titre,
                onClose: () => setState(() => _shared = null),
              ),
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
                  PopupMenuButton<String>(
                    enabled: !_sending,
                    tooltip: 'Joindre',
                    icon: const Icon(CupertinoIcons.plus_circle, color: AppColors.textMuted),
                    position: PopupMenuPosition.over,
                    onSelected: (value) => value == 'file' ? _pickFiles() : _pickShare(),
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'file', child: ListTile(leading: Icon(CupertinoIcons.paperclip), title: Text('Fichier ou image'))),
                      PopupMenuItem(
                        value: 'share',
                        child: ListTile(leading: Icon(CupertinoIcons.book), title: Text('Ressource BNN, HAL, OpenAlex')),
                      ),
                    ],
                  ),
                  Expanded(
                    child: TextField(
                      controller: _text,
                      focusNode: _focus,
                      enabled: !_sending,
                      minLines: 1,
                      maxLines: 5,
                      maxLength: 5000,
                      buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        hintText: 'Écrire un message (@ pour mentionner)',
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

class _ComposerBanner extends StatelessWidget {
  const _ComposerBanner({required this.icon, required this.title, required this.text, required this.onClose});

  final IconData icon;
  final String title;
  final String text;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(10),
        border: const Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.primary)),
                Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Annuler',
            visualDensity: VisualDensity.compact,
            onPressed: onClose,
            icon: const Icon(CupertinoIcons.xmark, size: 16),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.own,
    required this.grouped,
    required this.mentionsMe,
    required this.onLongPress,
    required this.onReply,
  });

  final SalonMessage message;
  final bool own;
  final bool grouped;
  final bool mentionsMe;
  final VoidCallback onLongPress;
  final VoidCallback onReply;

  List<TextSpan> _spans(Color fg) {
    final text = message.contenu;
    final spans = <TextSpan>[];
    var last = 0;
    for (final match in _mentionPattern.allMatches(text)) {
      if (match.start > last) spans.add(TextSpan(text: text.substring(last, match.start)));
      spans.add(TextSpan(
        text: match.group(0),
        style: TextStyle(fontWeight: FontWeight.w700, color: own ? Colors.white : AppColors.primary),
      ));
      last = match.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    final bg = own
        ? AppColors.primary
        : mentionsMe
            ? const Color(0xFFFFF7E0)
            : Colors.white;
    final fg = own ? Colors.white : AppColors.textPrimary;
    final muted = own ? Colors.white70 : AppColors.textFaint;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(own ? 18 : 4),
      bottomRight: Radius.circular(own ? 4 : 18),
    );
    final reply = message.reponseA;
    return Align(
      alignment: own ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        child: GestureDetector(
          onLongPress: onLongPress,
          onHorizontalDragEnd: message.supprime
              ? null
              : (details) {
                  if ((details.primaryVelocity ?? 0).abs() > 300) onReply();
                },
          child: Container(
            margin: EdgeInsets.only(top: grouped ? 3 : 10),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            decoration: BoxDecoration(
              color: message.supprime ? AppColors.fill : bg,
              borderRadius: radius,
              border: own && !message.supprime
                  ? null
                  : Border.all(color: mentionsMe ? AppColors.warning : AppColors.border),
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
                if (message.supprime)
                  const Text('Message supprimé',
                      style: TextStyle(fontStyle: FontStyle.italic, color: AppColors.textMuted, fontSize: 14))
                else ...[
                  if (reply != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                      decoration: BoxDecoration(
                        color: own ? Colors.white.withValues(alpha: 0.15) : AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(8),
                        border: Border(left: BorderSide(color: own ? Colors.white : AppColors.primary, width: 3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(reply.authorName,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: own ? Colors.white : AppColors.primary)),
                          Text(
                            reply.deleted ? 'Message supprimé' : (reply.excerpt.isEmpty ? 'Pièce jointe' : reply.excerpt),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, color: own ? Colors.white70 : AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  if (message.contenu.isNotEmpty)
                    SelectableText.rich(
                      TextSpan(style: TextStyle(color: fg, height: 1.35, fontSize: 14.5), children: _spans(fg)),
                      onTap: null,
                    ),
                  if (message.ressource != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: SharedResourceCard(resource: message.ressource!, onDark: own),
                    ),
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
                                        a.size == null ? a.name : '${a.name} · ${formatFileSize(a.size!) ?? ''}',
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
                ],
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (message.epingle) ...[
                      Icon(CupertinoIcons.pin_fill, size: 11, color: muted, semanticLabel: 'Épinglé'),
                      const SizedBox(width: 4),
                    ],
                    Text(
                      [
                        if (message.date != null) formatTime(message.date!.toIso8601String()),
                        if (message.modifie && !message.supprime) 'modifié',
                      ].join(' · '),
                      style: TextStyle(fontSize: 11, color: message.supprime ? AppColors.textFaint : muted),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

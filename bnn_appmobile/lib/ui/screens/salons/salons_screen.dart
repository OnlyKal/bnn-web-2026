import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/history_item.dart';
import '../../../data/models/salon.dart';
import '../../../data/services/salon_socket.dart';
import '../../../data/services/salons_service.dart';
import '../../../state/history_controller.dart';
import '../../../state/session_controller.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';
import 'salon_detail_screen.dart';
import 'salon_widgets.dart';

class SalonsScreen extends StatefulWidget {
  const SalonsScreen({super.key});

  @override
  State<SalonsScreen> createState() => _SalonsScreenState();
}

class _SalonsScreenState extends State<SalonsScreen> with WidgetsBindingObserver {
  final _search = TextEditingController();
  late final SalonsService _service = context.read<AppServices>().salons;
  final _socket = SalonSocket.instance;
  StreamSubscription<SalonSocketEvent>? _socketEvents;
  List<Salon> _salons = [];
  List<SalonNotification> _notifications = [];
  int _unreadNotifications = 0;
  int _nouveaux = 0;
  SalonFiltre _filtre = SalonFiltre.tous;
  bool _loading = true;
  String? _error;
  bool _creating = false;
  Timer? _searchDebounce;
  Timer? _poll;
  Timer? _reloadDebounce;
  Set<String> _followed = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _socket.acquire(() => context.read<AppServices>().session.authorizationHeader);
    _socketEvents = _socket.events.listen(_onSocketEvent);
    _socket.connected.addListener(_startPolling);
    _load();
    _fetchNotifications();
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchDebounce?.cancel();
    _reloadDebounce?.cancel();
    _poll?.cancel();
    _socket.connected.removeListener(_startPolling);
    _socketEvents?.cancel();
    for (final id in _followed) {
      _socket.unsubscribe(id);
    }
    _socket.release();
    // La liste a été vue : les salons actuels ne sont plus « nouveaux ».
    _service.markSeen().catchError((_) {});
    _search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load(silent: true);
      _fetchNotifications();
      _startPolling();
    } else if (state == AppLifecycleState.paused) {
      _poll?.cancel();
    }
  }

  /// Rafraîchissement de secours : fréquent sans WebSocket, rare avec.
  void _startPolling() {
    _poll?.cancel();
    final period = _socket.connected.value ? const Duration(minutes: 2) : const Duration(seconds: 30);
    _poll = Timer.periodic(period, (_) {
      _load(silent: true);
      _fetchNotifications();
    });
  }

  /// Abonne le socket aux salons dont l'utilisateur est membre (compteurs de non-lus en direct).
  void _follow(List<Salon> salons) {
    final wanted = salons.where((s) => s.estMembre).map((s) => s.id).toSet();
    for (final id in _followed.difference(wanted)) {
      _socket.unsubscribe(id);
    }
    for (final id in wanted.difference(_followed)) {
      _socket.subscribe(id);
    }
    _followed = wanted;
  }

  void _onSocketEvent(SalonSocketEvent event) {
    if (!mounted) return;
    switch (event.event) {
      case 'message.created':
        final message = SalonMessage.fromJson(event.payload);
        final own = context.read<SessionController>().user?.matches(personJson(message.author)) ?? false;
        setState(() {
          _salons = [
            for (final s in _salons)
              s.id == event.salonId
                  ? s.copyWith(messagesCount: s.messagesCount + 1, nonLus: own ? s.nonLus : s.nonLus + 1)
                  : s,
          ];
        });
      case 'notification.new':
        final notification = SalonNotification.fromJson(event.payload);
        setState(() {
          _notifications = [notification, ..._notifications.where((n) => n.id != notification.id)];
          _unreadNotifications++;
        });
      case 'salon.created' || 'salon.updated' || 'salon.deleted' || 'membership.changed' || 'members.updated':
        _reloadSoon();
      default:
        break;
    }
  }

  void _reloadSoon() {
    _reloadDebounce?.cancel();
    _reloadDebounce = Timer(const Duration(milliseconds: 600), () => _load(silent: true));
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final page = await _service.list(search: _search.text, filtre: _filtre);
      if (!mounted) return;
      setState(() {
        _salons = page.salons;
        _nouveaux = page.nouveaux;
        _error = null;
      });
      _follow(page.salons);
    } on ApiException catch (e) {
      if (mounted && !silent) setState(() => _error = e.message);
    } finally {
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  Future<void> _fetchNotifications() async {
    try {
      final page = await _service.notifications();
      if (mounted) {
        setState(() {
          _notifications = page.items;
          _unreadNotifications = page.nonLues;
        });
      }
    } on ApiException {
      // Les notifications sont secondaires : pas d'erreur bloquante.
    }
  }

  void _onSearch(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _load();
      final q = value.trim();
      if (q.length >= 2) {
        context.read<HistoryController>().add(
              type: HistoryType.search,
              title: q,
              description: 'Recherche effectuée dans les salons',
              target: HistoryTarget.salons,
              metadata: {'query': 'salons:$q'},
            );
      }
    });
  }

  Future<void> _open(Salon salon) async {
    setState(() => _salons = [for (final s in _salons) s.id == salon.id ? s.copyWith(nonLus: 0) : s]);
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => SalonDetailScreen(salonId: salon.id, preview: salon)));
    if (mounted) {
      _load(silent: true);
      _fetchNotifications();
    }
  }

  Future<void> _openById(String salonId) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => SalonDetailScreen(salonId: salonId)));
    if (mounted) {
      _load(silent: true);
      _fetchNotifications();
    }
  }

  void _setFiltre(SalonFiltre filtre) {
    if (filtre == _filtre) return;
    setState(() => _filtre = filtre);
    _load();
  }

  Future<void> _create() async {
    final result = await showModalBottomSheet<SalonFormResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const SalonFormSheet(mode: SalonFormMode.create),
    );
    if (result == null || !mounted) return;
    setState(() => _creating = true);
    try {
      final created = await _service.create(
        titre: result.titre,
        description: result.description,
        resources: result.resources,
        prive: result.prive,
      );
      if (!mounted) return;
      showSuccess(context, 'Salon créé avec succès.');
      _search.clear();
      await _load();
      if (created != null && mounted) _open(created);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _showNotifications() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _NotificationsSheet(
        notifications: _notifications,
        unread: _unreadNotifications,
        onMarkAll: () async {
          try {
            await _service.markAllRead();
            if (!mounted) return;
            setState(() {
              _notifications = [for (final n in _notifications) n.markRead()];
              _unreadNotifications = 0;
            });
            if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            showSuccess(context, 'Notifications marquées comme lues.');
          } on ApiException catch (e) {
            if (mounted) showError(context, e.message);
          }
        },
        onOpen: (notification) async {
          Navigator.of(sheetContext).pop();
          if (!notification.lu) {
            _service.markNotificationRead(notification.id).catchError((_) {});
            setState(() => _unreadNotifications = (_unreadNotifications - 1).clamp(0, 1 << 30));
          }
          final salon = _salons.where((s) => s.id == notification.salonId).firstOrNull;
          if (salon != null) {
            _open(salon);
          } else if (notification.salonId != null) {
            _openById(notification.salonId!);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = _unreadNotifications;
    final joined = _salons.where((s) => s.estMembre).length;
    final unreadTotal = _salons.fold<int>(0, (sum, s) => sum + s.nonLus);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _creating ? null : _create,
        icon: _creating
            ? const CupertinoActivityIndicator(color: Colors.white)
            : const Icon(CupertinoIcons.plus),
        label: Text(_creating ? 'Création…' : 'Nouveau salon'),
      ),
      body: Column(
        children: [
          TabHeader(
            eyebrow: 'Communauté',
            title: 'Salons',
            subtitle: 'Échangez autour de sujets thématiques et partagez des ressources avec la communauté.',
            actions: [
              HeaderIconButton(
                icon: CupertinoIcons.bell,
                tooltip: 'Notifications',
                badge: count,
                onPressed: _showNotifications,
              ),
            ],
            bottom: SearchField(controller: _search, hint: 'Rechercher un salon', onChanged: _onSearch, onDark: true),
          ),
          ChipBar(
            itemCount: SalonFiltre.values.length,
            itemBuilder: (context, index) {
              final filtre = SalonFiltre.values[index];
              return ChoiceChip(
                label: Text(switch (filtre) {
                  SalonFiltre.tous => 'Tous',
                  SalonFiltre.mesSalons => 'Mes salons',
                  SalonFiltre.publics => 'Publics',
                  SalonFiltre.prives => 'Privés',
                }),
                selected: _filtre == filtre,
                onSelected: (_) => _setFiltre(filtre),
              );
            },
          ),
          Expanded(
            child: AppRefresh(
              onRefresh: () async {
                await Future.wait([_load(), _fetchNotifications()]);
              },
              child: CustomScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  if (_loading && _salons.isEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: SliverList.separated(
                        itemCount: 4,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, _) => const Skeleton(height: 104, radius: 14),
                      ),
                    )
                  else if (_error != null && _salons.isEmpty)
                    SliverFillRemaining(hasScrollBody: false, child: StatusView.error(message: _error, onAction: _load))
                  else if (_salons.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: StatusView(
                        icon: CupertinoIcons.chat_bubble_2,
                        title: 'Aucun salon trouvé',
                        message: _search.text.isEmpty && _filtre == SalonFiltre.tous
                            ? 'Créez le premier salon de discussion.'
                            : 'Aucun salon ne correspond à votre recherche ou à ce filtre.',
                      ),
                    )
                  else ...[
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          icon: CupertinoIcons.chat_bubble_2,
                          title: 'Salons de discussion',
                          subtitle: [
                            '${_salons.length} ${plural(_salons.length, 'salon')}',
                            if (joined > 0) '$joined rejoint(s)',
                            if (unreadTotal > 0) '$unreadTotal non lu(s)',
                            if (_nouveaux > 0) '$_nouveaux nouveau(x)',
                          ].join(' · '),
                        ),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                      sliver: SliverList.separated(
                        itemCount: _salons.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final salon = _salons[index];
                          return _SalonCard(salon: salon, onTap: () => _open(salon));
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SalonCard extends StatelessWidget {
  const _SalonCard({required this.salon, required this.onTap});

  final Salon salon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = salon.hasUnread;
    return SurfaceCard(
      onTap: onTap,
      borderColor: unread ? AppColors.primary.withValues(alpha: 0.45) : AppColors.border,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: salon.estMembre ? AppColors.primary : AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              salon.titre.isNotEmpty ? salon.titre[0].toUpperCase() : '#',
              style: TextStyle(
                color: salon.estMembre ? Colors.white : AppColors.primary,
                fontWeight: FontWeight.w700,
                fontSize: 20,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (salon.prive)
                      const Padding(
                        padding: EdgeInsets.only(right: 5),
                        child: Icon(CupertinoIcons.lock_fill, size: 14, color: AppColors.textMuted, semanticLabel: 'Salon privé'),
                      ),
                    Expanded(
                      child: Text(
                        salon.titre,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w600, fontSize: 15.5),
                      ),
                    ),
                    if (salon.estNouveau)
                      const Padding(
                        padding: EdgeInsets.only(left: 6),
                        child: Pill('Nouveau', color: AppColors.violet, filled: true),
                      ),
                    if (unread)
                      Semantics(
                        label: '${salon.nonLus} message(s) non lu(s)',
                        child: Container(
                          margin: const EdgeInsets.only(left: 6),
                          constraints: const BoxConstraints(minWidth: 22),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(99)),
                          child: Text(
                            salon.nonLus > 99 ? '99+' : '${salon.nonLus}',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  salon.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _Meta(icon: CupertinoIcons.person_2, label: '${salon.membresCount ?? 0}'),
                    const SizedBox(width: 14),
                    _Meta(icon: CupertinoIcons.chat_bubble, label: '${salon.messagesCount}'),
                    if (salon.estCreateur && salon.demandes > 0) ...[
                      const SizedBox(width: 14),
                      Pill('${salon.demandes} demande(s)', color: AppColors.warning, icon: CupertinoIcons.person_crop_circle_badge_plus),
                    ],
                    const Spacer(),
                    _StatutPill(salon: salon),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatutPill extends StatelessWidget {
  const _StatutPill({required this.salon});

  final Salon salon;

  @override
  Widget build(BuildContext context) {
    if (salon.estCreateur) return const Pill('Créateur', color: AppColors.navy, icon: CupertinoIcons.star_fill);
    return switch (salon.statut) {
      SalonStatut.membre => const Pill('Membre', color: AppColors.successDark, icon: CupertinoIcons.checkmark_alt),
      SalonStatut.enAttente => const Pill('Demande envoyée', color: AppColors.warning, icon: CupertinoIcons.clock),
      SalonStatut.invite => const Pill('Invité', color: AppColors.violet, icon: CupertinoIcons.envelope),
      SalonStatut.retire => const Pill('Retiré', color: AppColors.danger),
      _ => salon.prive
          ? const Pill("Demander l'accès", color: AppColors.primary, icon: CupertinoIcons.lock)
          : const Pill('À rejoindre', color: AppColors.primary, icon: CupertinoIcons.person_badge_plus),
    };
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
      ],
    );
  }
}

class _NotificationsSheet extends StatelessWidget {
  const _NotificationsSheet({
    required this.notifications,
    required this.unread,
    required this.onMarkAll,
    required this.onOpen,
  });

  final List<SalonNotification> notifications;
  final int unread;
  final VoidCallback onMarkAll;
  final ValueChanged<SalonNotification> onOpen;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (context, scroll) => Column(
        children: [
          SheetHeader(
            title: 'Notifications',
            subtitle: unread == 0 ? null : '$unread non lue(s)',
            icon: CupertinoIcons.bell,
            trailing: unread == 0
                ? null
                : TextButton.icon(
                    onPressed: onMarkAll,
                    icon: const Icon(CupertinoIcons.checkmark_alt, size: 17),
                    label: const Text('Tout marquer lu'),
                  ),
          ),
          const Divider(),
          Expanded(
            child: notifications.isEmpty
                ? const StatusView(
                    icon: CupertinoIcons.bell,
                    title: 'Aucune notification',
                    message: 'Vous êtes à jour.',
                    compact: true,
                  )
                : ListView.separated(
                    controller: scroll,
                    itemCount: notifications.length,
                    separatorBuilder: (_, _) => const Divider(indent: 72, endIndent: 20),
                    itemBuilder: (context, index) {
                      final n = notifications[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                        tileColor: n.lu ? null : AppColors.primarySoft,
                        leading: IconTile(_notificationIcon(n.type), size: 40, iconSize: 20),
                        title: Text(
                          n.salonTitre ?? 'Salon',
                          style: TextStyle(fontWeight: n.lu ? FontWeight.w500 : FontWeight.w700),
                        ),
                        subtitle: Text(n.message, maxLines: 2, overflow: TextOverflow.ellipsis),
                        trailing: n.date == null
                            ? null
                            : Text(formatRelativeTime(n.date!), style: const TextStyle(fontSize: 11.5, color: AppColors.textFaint)),
                        onTap: () => onOpen(n),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

IconData _notificationIcon(String type) => switch (type) {
      'mention' => CupertinoIcons.at,
      'reponse' => CupertinoIcons.reply,
      'invitation' => CupertinoIcons.envelope_fill,
      'demande' => CupertinoIcons.person_crop_circle_badge_plus,
      'acceptation' => CupertinoIcons.checkmark_seal_fill,
      'refus' || 'retrait' => CupertinoIcons.xmark_circle_fill,
      'signalement' => CupertinoIcons.flag_fill,
      _ => CupertinoIcons.chat_bubble_2_fill,
    };

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
import '../../../state/history_controller.dart';
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
  List<Salon> _salons = [];
  List<SalonNotification> _notifications = [];
  bool _loading = true;
  String? _error;
  bool _creating = false;
  Timer? _searchDebounce;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _fetchNotifications();
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchDebounce?.cancel();
    _notificationTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetchNotifications();
      _startPolling();
    } else if (state == AppLifecycleState.paused) {
      _notificationTimer?.cancel();
    }
  }

  void _startPolling() {
    _notificationTimer?.cancel();
    _notificationTimer = Timer.periodic(const Duration(seconds: 20), (_) => _fetchNotifications());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final salons = await context.read<AppServices>().salons.list(search: _search.text);
      if (mounted) setState(() => _salons = salons);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fetchNotifications() async {
    try {
      final items = await context.read<AppServices>().salons.notifications();
      if (mounted) setState(() => _notifications = items);
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

  bool _isUnread(Salon salon) =>
      salon.hasUnread || _notifications.any((n) => n.salonId == salon.id);

  Future<void> _open(Salon salon) async {
    setState(() => _notifications = _notifications.where((n) => n.salonId != salon.id).toList());
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => SalonDetailScreen(salonId: salon.id, preview: salon)));
    if (mounted) {
      _load();
      _fetchNotifications();
    }
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
      final created = await context.read<AppServices>().salons.create(
            titre: result.titre,
            description: result.description,
            resources: result.resources,
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
        salons: _salons,
        onMarkAll: () async {
          try {
            await context.read<AppServices>().salons.markAllRead();
            if (!mounted) return;
            setState(() => _notifications = []);
            if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            showSuccess(context, 'Notifications marquées comme lues.');
          } on ApiException catch (e) {
            if (mounted) showError(context, e.message);
          }
        },
        onOpen: (notification) async {
          Navigator.of(sheetContext).pop();
          context.read<AppServices>().salons.markRead(notification.id).catchError((_) {});
          final salon = _salons.where((s) => s.id == notification.salonId).firstOrNull;
          if (salon != null) {
            _open(salon);
          } else if (notification.salonId != null) {
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => SalonDetailScreen(salonId: notification.salonId!)),
            );
            if (mounted) _fetchNotifications();
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = _notifications.length;
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
                        message: _search.text.isEmpty
                            ? 'Créez le premier salon de discussion.'
                            : 'Aucun salon ne correspond à votre recherche.',
                      ),
                    )
                  else ...[
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
                      sliver: SliverToBoxAdapter(
                        child: SectionHeader(
                          icon: CupertinoIcons.chat_bubble_2,
                          title: 'Salons de discussion',
                          subtitle: '${_salons.length} ${plural(_salons.length, 'salon')}'
                              '${_salons.where((s) => s.estMembre).isEmpty ? '' : ' · ${_salons.where((s) => s.estMembre).length} rejoint(s)'}',
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
                          return _SalonCard(salon: salon, unread: _isUnread(salon), onTap: () => _open(salon));
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
  const _SalonCard({required this.salon, required this.unread, required this.onTap});

  final Salon salon;
  final bool unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
                    Expanded(
                      child: Text(
                        salon.titre,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w600, fontSize: 15.5),
                      ),
                    ),
                    if (unread)
                      Semantics(
                        label: 'Nouveaux messages',
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
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
                    const Spacer(),
                    salon.estMembre
                        ? const Pill('Membre', color: AppColors.successDark, icon: CupertinoIcons.checkmark_alt)
                        : const Pill('À rejoindre', color: AppColors.primary, icon: CupertinoIcons.person_badge_plus),
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
    required this.salons,
    required this.onMarkAll,
    required this.onOpen,
  });

  final List<SalonNotification> notifications;
  final List<Salon> salons;
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
            subtitle: notifications.isEmpty ? null : '${notifications.length} non lue(s)',
            icon: CupertinoIcons.bell,
            trailing: notifications.isEmpty
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
                      final salon = salons.where((s) => s.id == n.salonId).firstOrNull;
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                        leading: const IconTile(CupertinoIcons.chat_bubble_2_fill, size: 40, iconSize: 20),
                        title: Text(salon?.titre ?? 'Salon'),
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

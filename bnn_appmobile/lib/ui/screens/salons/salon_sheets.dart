import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app_services.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/models/salon.dart';
import '../../../data/services/openalex_service.dart';
import '../../../data/services/hal_service.dart';
import '../../../data/services/salons_service.dart';
import '../../widgets/common.dart';
import '../../widgets/feedback.dart';
import '../../widgets/states.dart';

/// Saisie d'un texte court (modification d'un message, motif d'un signalement…).
Future<String?> promptText(
  BuildContext context, {
  required String title,
  String initial = '',
  String hint = '',
  String confirmLabel = 'Valider',
  bool allowEmpty = false,
  int maxLines = 5,
}) {
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        minLines: 1,
        maxLines: maxLines,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: hint),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Annuler')),
        FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isEmpty && !allowEmpty) return;
            Navigator.of(dialogContext).pop(value);
          },
          child: Text(confirmLabel),
        ),
      ],
    ),
  ).whenComplete(controller.dispose);
}

// ---------------------------------------------------------------------------
// Partage d'une ressource BNN / HAL / OpenAlex
// ---------------------------------------------------------------------------

/// Recherche une ressource et la renvoie pour l'envoyer dans le salon.
class SharePickerSheet extends StatefulWidget {
  const SharePickerSheet({super.key});

  @override
  State<SharePickerSheet> createState() => _SharePickerSheetState();
}

class _SharePickerSheetState extends State<SharePickerSheet> {
  final _query = TextEditingController();
  String _source = 'bnn';
  List<SharedResource> _results = [];
  bool _loading = false;
  String? _error;
  Timer? _debounce;
  int _generation = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _schedule() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _search);
  }

  Future<void> _search() async {
    final q = _query.text.trim();
    final generation = ++_generation;
    if (q.length < 2) {
      setState(() {
        _results = [];
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final services = context.read<AppServices>();
    try {
      final List<SharedResource> results = switch (_source) {
        'hal' => (await services.hal.ouvrages(HalFilters(q: q), size: 15))
            .items
            .map((r) => SharedResource(source: 'hal', identifiant: r.halId ?? r.id, titre: r.titre, auteurs: r.auteurs))
            .toList(),
        'openalex' => (await services.openAlex.works(
                  OpenAlexCatalog.all,
                  OpenAlexFilters(search: q, pdfOnly: false),
                  perPage: 15,
                ))
            .items
            .map((w) => SharedResource(
                  source: 'openalex',
                  identifiant: w.id,
                  titre: w.title,
                  auteurs: w.authorsLabel.isEmpty ? null : w.authorsLabel,
                ))
            .toList(),
        _ => (await services.ressources.search(q))
            .items
            .map((r) => SharedResource(source: 'bnn', identifiant: r.id, titre: r.titre, auteurs: r.auteurs))
            .toList(),
      };
      if (mounted && generation == _generation) setState(() => _results = results);
    } on ApiException catch (e) {
      if (mounted && generation == _generation) setState(() => _error = e.message);
    } catch (_) {
      if (mounted && generation == _generation) setState(() => _error = 'La recherche a échoué.');
    } finally {
      if (mounted && generation == _generation) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, scroll) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          children: [
            const SheetHeader(title: 'Partager une ressource', icon: CupertinoIcons.book),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Segmented<String>(
                options: const [
                  SegmentOption('bnn', 'BNN'),
                  SegmentOption('hal', 'HAL'),
                  SegmentOption('openalex', 'OpenAlex'),
                ],
                value: _source,
                onChanged: (v) {
                  setState(() => _source = v);
                  _search();
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: SearchField(controller: _query, hint: 'Titre, auteur…', onChanged: (_) => _schedule()),
            ),
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: _error != null
                  ? StatusView.error(message: _error, onAction: _search, compact: true)
                  : _results.isEmpty
                      ? StatusView(
                          icon: CupertinoIcons.search,
                          title: _query.text.trim().length < 2 ? 'Recherchez une ressource' : 'Aucun résultat',
                          message: 'Elle sera partagée dans le salon sous forme de carte.',
                          compact: true,
                        )
                      : ListView.separated(
                          controller: scroll,
                          itemCount: _results.length,
                          separatorBuilder: (_, _) => const Divider(indent: 68),
                          itemBuilder: (context, index) {
                            final r = _results[index];
                            return ListTile(
                              leading: const IconTile(CupertinoIcons.book, size: 38, iconSize: 18),
                              title: Text(r.titre, maxLines: 2, overflow: TextOverflow.ellipsis),
                              subtitle: r.auteurs == null ? null : Text(r.auteurs!, maxLines: 1, overflow: TextOverflow.ellipsis),
                              trailing: const Icon(CupertinoIcons.paperplane, size: 18, color: AppColors.primary),
                              onTap: () => Navigator.of(context).pop(r),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Membres, demandes et invitations
// ---------------------------------------------------------------------------

class MembersSheet extends StatefulWidget {
  const MembersSheet({super.key, required this.salon});

  final Salon salon;

  @override
  State<MembersSheet> createState() => _MembersSheetState();
}

class _MembersSheetState extends State<MembersSheet> {
  late final SalonsService _service = context.read<AppServices>().salons;
  final _search = TextEditingController();
  SalonMembers _members = const SalonMembers();
  List<SalonUser> _found = [];
  bool _loading = true;
  String? _error;
  String? _busyUser;
  Timer? _debounce;

  bool get _isCreator => widget.salon.estCreateur;
  bool get _isPrivate => widget.salon.prive;
  String? _invitationLink;
  bool _linkLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final members = await _service.members(widget.salon.id);
      if (mounted) setState(() => _members = members);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Salon privé : le serveur génère le lien ; pas de liste d'utilisateurs.
  Future<void> _loadInvitationLink() async {
    setState(() => _linkLoading = true);
    try {
      final link = await _service.invitationLink(widget.salon.id);
      if (mounted) setState(() => _invitationLink = link);
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _linkLoading = false);
    }
  }

  Future<void> _copyInvitationLink() async {
    final link = _invitationLink;
    if (link == null) return;
    await Clipboard.setData(ClipboardData(text: link));
    if (mounted) showSuccess(context, "Lien d'invitation copié");
  }

  Widget _invitationSection() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Partagez ce lien : les personnes qui le suivent rejoignent le salon. '
              'Les autres peuvent demander à rejoindre.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 10),
            if (_invitationLink == null)
              OutlinedButton.icon(
                onPressed: _linkLoading ? null : _loadInvitationLink,
                icon: _linkLoading ? const CupertinoActivityIndicator() : const Icon(CupertinoIcons.link),
                label: const Text("Obtenir le lien d'invitation"),
              )
            else ...[
              SelectableText(_invitationLink!, maxLines: 2, style: const TextStyle(fontSize: 12.5)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: _copyInvitationLink,
                    icon: const Icon(CupertinoIcons.doc_on_doc, size: 18),
                    label: const Text('Copier'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => SharePlus.instance.share(ShareParams(
                      text: 'Rejoignez le salon « ${widget.salon.titre} » sur BNN : $_invitationLink',
                    )),
                    icon: const Icon(CupertinoIcons.share, size: 18),
                    label: const Text('Partager'),
                  ),
                ],
              ),
            ],
          ],
        ),
      );

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final users = await _service.searchUsers(value);
        final known = {
          ..._members.membres.map((m) => m.user.id),
          ..._members.invites.map((m) => m.user.id),
        };
        if (mounted) setState(() => _found = users.where((u) => !known.contains(u.id)).toList());
      } on ApiException {
        if (mounted) setState(() => _found = []);
      }
    });
  }

  Future<void> _act(String userId, Future<String?> Function() action) async {
    setState(() => _busyUser = userId);
    try {
      final message = await action();
      if (mounted && message != null) showSuccess(context, message);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    } finally {
      if (mounted) setState(() => _busyUser = null);
    }
  }

  Future<void> _memberAction(SalonMember member, String action, String success) async {
    if (action == 'retirer') {
      final ok = await confirmAction(
        context,
        title: 'Retirer ${member.user.name} ?',
        message: "Cette personne ne pourra plus lire ni écrire dans le salon.",
        confirmLabel: 'Retirer',
        destructive: true,
        icon: CupertinoIcons.person_badge_minus,
      );
      if (!ok) return;
    }
    await _act(member.user.id, () async {
      await _service.memberAction(widget.salon.id, member.user.id, action);
      return success;
    });
  }

  Widget _tile(SalonMember member, {List<Widget> actions = const []}) {
    final busy = _busyUser == member.user.id;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      leading: UserAvatar(initial: member.user.initial, url: member.user.avatarUrl, size: 38),
      title: Text(member.user.name, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(member.estCreateur ? 'Créateur' : '@${member.user.username}'),
      trailing: busy
          ? const CupertinoActivityIndicator()
          : actions.isEmpty
              ? null
              : Row(mainAxisSize: MainAxisSize.min, children: actions),
    );
  }

  Widget _title(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
      );

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          children: [
            SheetHeader(
              title: 'Membres',
              subtitle: '${_members.membres.length} membre(s)',
              icon: CupertinoIcons.person_2,
            ),
            const Divider(),
            Expanded(
              child: _loading
                  ? const Center(child: CupertinoActivityIndicator())
                  : _error != null
                      ? StatusView.error(message: _error, onAction: _load, compact: true)
                      : ListView(
                          controller: scroll,
                          children: [
                            if (_isCreator && _isPrivate) ...[
                              _title("Lien d'invitation"),
                              _invitationSection(),
                            ],
                            if (_isCreator) ...[
                              if (!_isPrivate) ...[
                                _title('Inviter des personnes'),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: SearchField(controller: _search, hint: 'Nom ou identifiant', onChanged: _onSearch),
                                ),
                              ],
                              for (final user in _found)
                                ListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 20),
                                  leading: UserAvatar(initial: user.initial, url: user.avatarUrl, size: 36),
                                  title: Text(user.name),
                                  subtitle: Text('@${user.username}'),
                                  trailing: _busyUser == user.id
                                      ? const CupertinoActivityIndicator()
                                      : TextButton(
                                          onPressed: () => _act(user.id, () async {
                                            final message = await _service.invite(widget.salon.id, [user.id]);
                                            if (mounted) setState(() => _found = _found.where((u) => u.id != user.id).toList());
                                            return message;
                                          }),
                                          child: const Text('Inviter'),
                                        ),
                                ),
                              if (_members.demandes.isNotEmpty) ...[
                                _title("Demandes d'accès (${_members.demandes.length})"),
                                for (final m in _members.demandes)
                                  _tile(m, actions: [
                                    IconButton(
                                      tooltip: 'Accepter',
                                      onPressed: () => _memberAction(m, 'accepter', 'Demande acceptée'),
                                      icon: const Icon(CupertinoIcons.checkmark_circle_fill, color: AppColors.successDark),
                                    ),
                                    IconButton(
                                      tooltip: 'Refuser',
                                      onPressed: () => _memberAction(m, 'refuser', 'Demande refusée'),
                                      icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppColors.danger),
                                    ),
                                  ]),
                              ],
                              if (_members.invites.isNotEmpty) ...[
                                _title('Invitations en attente (${_members.invites.length})'),
                                for (final m in _members.invites)
                                  _tile(m, actions: [
                                    TextButton(
                                      onPressed: () => _memberAction(m, 'annuler-invitation', 'Invitation annulée'),
                                      child: const Text('Annuler'),
                                    ),
                                  ]),
                              ],
                            ],
                            _title('Membres'),
                            for (final m in _members.membres)
                              _tile(m, actions: [
                                if (_isCreator && !m.estCreateur)
                                  IconButton(
                                    tooltip: 'Retirer du salon',
                                    onPressed: () => _memberAction(m, 'retirer', 'Membre retiré'),
                                    icon: const Icon(CupertinoIcons.person_badge_minus, color: AppColors.danger, size: 20),
                                  ),
                              ]),
                            const SizedBox(height: 24),
                          ],
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Signalements (créateur)
// ---------------------------------------------------------------------------

class ReportsSheet extends StatefulWidget {
  const ReportsSheet({super.key, required this.salonId, required this.onDeleteMessage});

  final String salonId;
  final Future<bool> Function(String messageId) onDeleteMessage;

  @override
  State<ReportsSheet> createState() => _ReportsSheetState();
}

class _ReportsSheetState extends State<ReportsSheet> {
  late final SalonsService _service = context.read<AppServices>().salons;
  List<SalonReport> _reports = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final reports = await _service.reports(widget.salonId);
      if (mounted) setState(() => _reports = reports);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resolve(SalonReport report) async {
    try {
      await _service.resolveReport(widget.salonId, report.id);
      if (mounted) setState(() => _reports = _reports.where((r) => r.id != report.id).toList());
    } on ApiException catch (e) {
      if (mounted) showError(context, e.message);
    }
  }

  Future<void> _deleteAndResolve(SalonReport report) async {
    final deleted = await widget.onDeleteMessage(report.messageId);
    if (deleted) await _resolve(report);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.65,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(
        children: [
          SheetHeader(
            title: 'Signalements',
            subtitle: _loading ? null : '${_reports.length} à traiter',
            icon: CupertinoIcons.flag,
          ),
          const Divider(),
          Expanded(
            child: _loading
                ? const Center(child: CupertinoActivityIndicator())
                : _error != null
                    ? StatusView.error(message: _error, onAction: _load, compact: true)
                    : _reports.isEmpty
                        ? const StatusView(
                            icon: CupertinoIcons.checkmark_shield,
                            title: 'Aucun signalement',
                            message: 'Aucun message signalé à traiter.',
                            compact: true,
                          )
                        : ListView.separated(
                            controller: scroll,
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                            itemCount: _reports.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final r = _reports[index];
                              return SurfaceCard(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Message de ${r.authorName}',
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                                    const SizedBox(height: 4),
                                    Text(
                                      r.messageDeleted ? 'Message supprimé' : (r.excerpt.isEmpty ? '(pièce jointe)' : r.excerpt),
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontStyle: r.messageDeleted ? FontStyle.italic : null,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'Signalé par ${r.reporterName}${r.motif.isEmpty ? '' : ' : « ${r.motif} »'}',
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      children: [
                                        if (!r.messageDeleted)
                                          OutlinedButton.icon(
                                            onPressed: () => _deleteAndResolve(r),
                                            icon: const Icon(CupertinoIcons.trash, size: 16, color: AppColors.danger),
                                            label: const Text('Supprimer le message', style: TextStyle(color: AppColors.danger)),
                                          ),
                                        TextButton(onPressed: () => _resolve(r), child: const Text('Marquer traité')),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';

import '../../../core/theme/app_colors.dart';
import '../../../data/models/salon.dart';
import '../../widgets/feedback.dart';

/// Même sujet et même format que le site web (src/salons/MeetingRoom.jsx).
const _chatTopic = 'bnn.chat';
const _handKey = 'main';

bool _handRaised(Participant p) => p.attributes[_handKey] == 'levee';
String _name(Participant p) => p.name.isNotEmpty ? p.name : p.identity;

class _ChatMessage {
  _ChatMessage({required this.id, required this.texte, required this.nom, required this.ts, required this.moi});

  final String id;
  final String texte;
  final String nom;
  final DateTime ts;
  final bool moi;
}

/// Choix du micro et de la caméra avant d'entrer. Renvoie null si annulé.
Future<({bool audio, bool video})?> showMeetingPreJoin(BuildContext context, {required bool starting}) {
  var audio = true;
  var video = false;
  return showDialog<({bool audio, bool video})>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(starting ? 'Démarrer une réunion' : 'Rejoindre la réunion'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: audio,
              onChanged: (v) => setState(() => audio = v),
              title: const Text('Micro activé en entrant'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: video,
              onChanged: (v) => setState(() => video = v),
              title: const Text('Caméra activée en entrant'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          FilledButton(
            onPressed: () => Navigator.pop(context, (audio: audio, video: video)),
            child: Text(starting ? 'Démarrer' : 'Rejoindre'),
          ),
        ],
      ),
    ),
  );
}

/// Salle de réunion vidéo d'un salon (serveur LiveKit de BNN).
class SalonMeetingScreen extends StatefulWidget {
  const SalonMeetingScreen({
    super.key,
    required this.titre,
    required this.acces,
    required this.audio,
    required this.video,
    this.onEndForAll,
  });

  final String titre;
  final SalonReunionAcces acces;
  final bool audio;
  final bool video;

  /// Termine la réunion pour tous (créateur du salon ou personne qui l'a lancée).
  final Future<bool> Function()? onEndForAll;

  @override
  State<SalonMeetingScreen> createState() => _SalonMeetingScreenState();
}

class _SalonMeetingScreenState extends State<SalonMeetingScreen> {
  late final Room _room = Room(roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true));
  EventsListener<RoomEvent>? _listener;
  bool _connecting = true;
  bool _leaving = false;
  final List<_ChatMessage> _messages = [];
  int _unread = 0;
  bool _chatOpen = false;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    _listener = _room.createListener()
      // Arrivées, départs, micros, caméras, partages : on redessine.
      ..listen((_) => _onRoomChanged())
      ..on<RoomDisconnectedEvent>((_) => _close())
      ..on<DataReceivedEvent>(_onData)
      ..on<ParticipantAttributesChanged>((event) {
        if (event.participant is! LocalParticipant && event.attributes[_handKey] == 'levee' && mounted) {
          showInfo(context, '${_name(event.participant)} lève la main');
        }
      });
    _room.addListener(_onRoomChanged);
    try {
      await _room.connect(widget.acces.url, widget.acces.token);
      final local = _room.localParticipant;
      if (widget.audio) await _safely(() => local?.setMicrophoneEnabled(true));
      if (widget.video) await _safely(() => local?.setCameraEnabled(true));
      if (mounted) setState(() => _connecting = false);
    } catch (e) {
      if (!mounted) return;
      showError(context, 'Connexion à la réunion impossible.');
      _close();
    }
  }

  Future<void> _safely(Future<Object?>? Function() action) async {
    try {
      await action();
    } catch (_) {
      if (mounted) showError(context, "Micro ou caméra indisponible : vérifiez l'autorisation dans les réglages.");
    }
  }

  void _onRoomChanged() {
    if (mounted) setState(() {});
  }

  void _onData(DataReceivedEvent event) {
    if (event.topic != _chatTopic) return;
    try {
      final data = jsonDecode(utf8.decode(event.data));
      final texte = (data is Map ? data['texte'] : null)?.toString() ?? '';
      if (texte.isEmpty) return;
      final ts = data['ts'] is int ? DateTime.fromMillisecondsSinceEpoch(data['ts'] as int) : DateTime.now();
      setState(() {
        _messages.add(_ChatMessage(
          id: data['id']?.toString() ?? '${DateTime.now().microsecondsSinceEpoch}',
          texte: texte.length > 1000 ? texte.substring(0, 1000) : texte,
          nom: event.participant != null ? _name(event.participant!) : 'Participant',
          ts: ts,
          moi: false,
        ));
        if (!_chatOpen) _unread++;
      });
    } catch (_) {
      // Message illisible : ignoré.
    }
  }

  Future<void> _sendChat(String texte) async {
    final local = _room.localParticipant;
    if (local == null) return;
    final now = DateTime.now();
    final id = '${local.identity}-${now.millisecondsSinceEpoch}';
    final payload = utf8.encode(jsonEncode({'id': id, 'texte': texte, 'ts': now.millisecondsSinceEpoch}));
    try {
      await local.publishData(payload, reliable: true, topic: _chatTopic);
      setState(() => _messages.add(_ChatMessage(id: id, texte: texte, nom: 'Vous', ts: now, moi: true)));
    } catch (_) {
      if (mounted) showError(context, 'Message non envoyé');
    }
  }

  void _close() {
    if (_leaving) return;
    _leaving = true;
    if (mounted) Navigator.of(context).maybePop();
  }

  Future<void> _leave() async {
    await _room.disconnect();
    _close();
  }

  Future<void> _endForAll() async {
    final ok = await widget.onEndForAll?.call() ?? false;
    if (ok) await _leave();
  }

  @override
  void dispose() {
    _room.removeListener(_onRoomChanged);
    _listener?.dispose();
    unawaited(_room.disconnect().then((_) => _room.dispose()));
    super.dispose();
  }

  List<Participant> get _participants => [
        if (_room.localParticipant != null) _room.localParticipant!,
        ..._room.remoteParticipants.values,
      ];

  @override
  Widget build(BuildContext context) {
    final local = _room.localParticipant;
    final micOn = local?.isMicrophoneEnabled() ?? false;
    final camOn = local?.isCameraEnabled() ?? false;
    final handUp = local != null && _handRaised(local);
    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F1115),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F1115),
          foregroundColor: Colors.white,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.titre, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16)),
              Text('${_participants.length} participant(s)',
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Participants',
              icon: const Icon(CupertinoIcons.person_2),
              onPressed: _showPeople,
            ),
            if (widget.acces.peutTerminer)
              TextButton(
                onPressed: _endForAll,
                child: const Text('Terminer', style: TextStyle(color: Color(0xFFF87171))),
              ),
          ],
        ),
        body: _connecting
            ? const Center(child: CircularProgressIndicator())
            : SafeArea(top: false, child: _buildStage()),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _ControlButton(
                  icon: micOn ? CupertinoIcons.mic_fill : CupertinoIcons.mic_slash_fill,
                  label: 'Micro',
                  active: micOn,
                  onTap: local == null ? null : () => _safely(() => local.setMicrophoneEnabled(!micOn)),
                ),
                _ControlButton(
                  icon: camOn ? CupertinoIcons.videocam_fill : CupertinoIcons.videocam,
                  label: 'Caméra',
                  active: camOn,
                  onTap: local == null ? null : () => _safely(() => local.setCameraEnabled(!camOn)),
                ),
                _ControlButton(
                  icon: CupertinoIcons.hand_raised_fill,
                  label: handUp ? 'Baisser' : 'Main',
                  active: handUp,
                  highlight: handUp,
                  onTap: local == null ? null : () => local.setAttributes({_handKey: handUp ? '' : 'levee'}),
                ),
                _ControlButton(
                  icon: CupertinoIcons.chat_bubble_2_fill,
                  label: 'Discussion',
                  active: true,
                  badge: _unread,
                  onTap: _showChat,
                ),
                _ControlButton(
                  icon: CupertinoIcons.phone_down_fill,
                  label: 'Quitter',
                  active: true,
                  danger: true,
                  onTap: _leave,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStage() {
    // Un partage d'écran passe en grand, les autres en bande en dessous.
    TrackPublication? screen;
    Participant? sharer;
    for (final p in _participants) {
      final pub = p.getTrackPublicationBySource(TrackSource.screenShareVideo);
      if (pub != null && !pub.muted && pub.track != null) {
        screen = pub;
        sharer = p;
        break;
      }
    }
    final participants = _participants;
    if (screen != null) {
      return Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: _Tile(participant: sharer!, track: screen.track as VideoTrack?, fit: VideoViewFit.contain),
            ),
          ),
          SizedBox(
            height: 120,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              children: [
                for (final p in participants)
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: AspectRatio(aspectRatio: 4 / 3, child: _Tile(participant: p)),
                  ),
              ],
            ),
          ),
        ],
      );
    }
    final count = participants.length;
    final columns = count <= 1 ? 1 : (count <= 4 ? 2 : 3);
    return LayoutBuilder(builder: (context, constraints) {
      final rows = (count / columns).ceil().clamp(1, 100);
      final cellHeight = constraints.maxHeight / rows;
      final cellWidth = constraints.maxWidth / columns;
      final ratio = (cellWidth / (cellHeight < 120 ? 120 : cellHeight)).clamp(0.5, 2.0);
      return GridView.count(
        padding: const EdgeInsets.all(6),
        crossAxisCount: columns,
        childAspectRatio: count > 9 ? 3 / 4 : ratio,
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
        children: [for (final p in participants) _Tile(participant: p)],
      );
    });
  }

  void _showPeople() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final list = [..._participants]..sort((a, b) => (_handRaised(b) ? 1 : 0) - (_handRaised(a) ? 1 : 0));
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text('Participants (${list.length})', style: Theme.of(context).textTheme.titleMedium),
              ),
              for (final p in list)
                ListTile(
                  leading: CircleAvatar(child: Text(_name(p).characters.first.toUpperCase())),
                  title: Text('${_name(p)}${p is LocalParticipant ? ' (vous)' : ''}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_handRaised(p)) const Icon(CupertinoIcons.hand_raised_fill, color: AppColors.warning),
                      const SizedBox(width: 8),
                      Icon(p.isMicrophoneEnabled() ? CupertinoIcons.mic_fill : CupertinoIcons.mic_slash_fill, size: 18),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showChat() async {
    setState(() {
      _chatOpen = true;
      _unread = 0;
    });
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _ChatSheet(messages: _messages, onSend: _sendChat, room: _room),
    );
    if (mounted) setState(() => _chatOpen = false);
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.label,
    required this.active,
    this.onTap,
    this.danger = false,
    this.highlight = false,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final bool active;
  final bool danger;
  final bool highlight;
  final int badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final background = danger
        ? AppColors.danger
        : highlight
            ? AppColors.warning
            : active
                ? const Color(0xFF2A2E38)
                : const Color(0xFF4B1F24);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Badge(
            isLabelVisible: badge > 0,
            label: Text('$badge'),
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, color: highlight ? Colors.black : Colors.white),
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
        ],
      ),
    );
  }
}

/// Vignette d'un participant : vidéo, ou initiale quand la caméra est coupée.
class _Tile extends StatelessWidget {
  const _Tile({required this.participant, this.track, this.fit = VideoViewFit.cover});

  final Participant participant;
  final VideoTrack? track;
  final VideoViewFit fit;

  @override
  Widget build(BuildContext context) {
    final pub = participant.getTrackPublicationBySource(TrackSource.camera);
    final video = track ?? (pub != null && !pub.muted ? pub.track as VideoTrack? : null);
    final name = _name(participant);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1C1F27),
          border: Border.all(
            color: participant.isSpeaking ? AppColors.success : Colors.transparent,
            width: 2,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (video != null)
              VideoTrackRenderer(video, fit: fit)
            else
              Center(
                child: CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.primary,
                  child: Text(
                    name.characters.first.toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 22),
                  ),
                ),
              ),
            Positioned(
              left: 6,
              bottom: 6,
              right: 6,
              child: Row(
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!participant.isMicrophoneEnabled())
                            const Padding(
                              padding: EdgeInsets.only(right: 4),
                              child: Icon(CupertinoIcons.mic_slash_fill, size: 12, color: Colors.white),
                            ),
                          Flexible(
                            child: Text(
                              participant is LocalParticipant ? '$name (vous)' : name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_handRaised(participant))
              const Positioned(
                top: 6,
                left: 6,
                child: CircleAvatar(
                  radius: 14,
                  backgroundColor: AppColors.warning,
                  child: Icon(CupertinoIcons.hand_raised_fill, size: 16, color: Colors.black),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ChatSheet extends StatefulWidget {
  const _ChatSheet({required this.messages, required this.onSend, required this.room});

  final List<_ChatMessage> messages;
  final Future<void> Function(String) onSend;
  final Room room;

  @override
  State<_ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends State<_ChatSheet> {
  final _text = TextEditingController();
  EventsListener<RoomEvent>? _listener;

  @override
  void initState() {
    super.initState();
    // Les nouveaux messages arrivent pendant que la feuille est ouverte.
    _listener = widget.room.createListener()
      ..on<DataReceivedEvent>((_) => Future.microtask(() {
            if (mounted) setState(() {});
          }));
  }

  @override
  void dispose() {
    _listener?.dispose();
    _text.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _text.text.trim();
    if (value.isEmpty) return;
    _text.clear();
    await widget.onSend(value);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final messages = widget.messages.reversed.toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text('Discussion', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(
              child: messages.isEmpty
                  ? const Center(
                      child: Text(
                        'Les messages ne sont visibles que pendant la réunion.',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      reverse: true,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: messages.length,
                      itemBuilder: (context, i) {
                        final m = messages[i];
                        final time = '${m.ts.hour.toString().padLeft(2, '0')}:${m.ts.minute.toString().padLeft(2, '0')}';
                        return Align(
                          alignment: m.moi ? Alignment.centerRight : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                            decoration: BoxDecoration(
                              color: m.moi ? AppColors.primary : AppColors.fill,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${m.nom} · $time',
                                  style: TextStyle(fontSize: 11, color: m.moi ? Colors.white70 : AppColors.textMuted),
                                ),
                                Text(m.texte, style: TextStyle(color: m.moi ? Colors.white : AppColors.textPrimary)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      maxLength: 1000,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _submit(),
                      decoration: const InputDecoration(
                        hintText: 'Écrire un message…',
                        counterText: '',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _submit, icon: const Icon(CupertinoIcons.paperplane_fill)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

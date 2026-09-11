/**
 * Transport layer for "Tìm Bò - Let's Save the Cows!"
 * BroadcastChannel with localStorage storage-event fallback for multi-tab communication on same origin.
 * Enforces room isolation, recipient filtering, event deduplication.
 */
(function (global) {
  'use strict';

  function createTransport() {
    let currentRoom = null;
    let currentPlayer = null;
    let channel = null;
    const handlers = new Set();
    const seenEventIds = new Set();
    const MAX_SEEN_IDS = 1000;

    function dedupe(eventId) {
      if (!eventId) return false;
      if (seenEventIds.has(eventId)) return true;
      seenEventIds.add(eventId);
      if (seenEventIds.size > MAX_SEEN_IDS) {
        const first = seenEventIds.values().next().value;
        seenEventIds.delete(first);
      }
      return false;
    }

    function dispatch(envelope) {
      if (!envelope || typeof envelope !== 'object') return;
      if (envelope.roomCode !== currentRoom) return;
      if (dedupe(envelope.eventId)) return;

      // Filter recipient if specified
      if (envelope.recipientId && currentPlayer) {
        if (envelope.recipientId !== currentPlayer.id && envelope.recipientId !== 'all') {
          return;
        }
      }

      handlers.forEach(h => {
        try {
          h(envelope);
        } catch (err) {
          console.error('[Transport] Handler error:', err);
        }
      });
    }

    function onStorageEvent(e) {
      if (!currentRoom) return;
      const keyPrefix = `TIM_BO_EVENT_${currentRoom}_`;
      if (e.key && e.key.startsWith(keyPrefix) && e.newValue) {
        try {
          const envelope = JSON.parse(e.newValue);
          dispatch(envelope);
        } catch (err) {
          console.error('[Transport] Storage parse error:', err);
        }
      }
    }

    function join(roomCode, player) {
      if (!roomCode || typeof roomCode !== 'string') throw new TypeError('Invalid roomCode');
      if (!player || !player.id) throw new TypeError('Invalid player');

      leave();
      currentRoom = roomCode.toUpperCase().trim();
      currentPlayer = { ...player };

      const channelName = `TIM_BO_ROOM_${currentRoom}`;
      if (typeof global.BroadcastChannel === 'function') {
        channel = new global.BroadcastChannel(channelName);
        channel.onmessage = (e) => {
          dispatch(e.data);
        };
      }

      global.addEventListener('storage', onStorageEvent);
      return { roomCode: currentRoom, playerId: currentPlayer.id };
    }

    function send(type, payload, options = {}) {
      if (!currentRoom) throw new Error('Cannot send: not joined to any room');

      const envelope = {
        eventId: 'evt_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
        roomCode: currentRoom,
        roundId: options.roundId || null,
        senderId: currentPlayer ? currentPlayer.id : 'unknown',
        recipientId: options.recipientId || 'all',
        type: type,
        payload: payload,
        timestamp: Date.now()
      };

      // Record own event id so we don't process it twice if BroadcastChannel or storage echoes it
      seenEventIds.add(envelope.eventId);

      // Broadcast to other tabs
      if (channel) {
        try {
          channel.postMessage(envelope);
        } catch (e) {
          console.warn('[Transport] channel.postMessage failed:', e);
        }
      }

      // Also persist to localStorage for fallback and cross-tab storage event
      try {
        const storageKey = `TIM_BO_EVENT_${currentRoom}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        localStorage.setItem(storageKey, JSON.stringify(envelope));
        setTimeout(() => {
          try { localStorage.removeItem(storageKey); } catch {}
        }, 3000);
      } catch (err) {
        console.warn('[Transport] localStorage setItem failed:', err);
      }

      // Also dispatch locally to handlers in current tab that match recipient filter
      if (envelope.recipientId === 'all' || (currentPlayer && envelope.recipientId === currentPlayer.id)) {
        handlers.forEach(h => {
          try {
            h(envelope);
          } catch (err) {
            console.error('[Transport] Local handler error:', err);
          }
        });
      }

      return envelope;
    }

    function onEvent(handler) {
      if (typeof handler !== 'function') throw new TypeError('Handler must be a function');
      handlers.add(handler);
      return () => handlers.delete(handler);
    }

    function leave() {
      if (channel) {
        try { channel.close(); } catch {}
        channel = null;
      }
      global.removeEventListener('storage', onStorageEvent);
      // DO NOT clear handlers here! Handlers are application callbacks that must stay active across joins.
      seenEventIds.clear();
      currentRoom = null;
      currentPlayer = null;
    }

    function destroy() {
      leave();
      handlers.clear();
    }

    return Object.freeze({
      join,
      send,
      onEvent,
      leave,
      destroy,
      getRoomCode: () => currentRoom,
      getPlayer: () => currentPlayer ? { ...currentPlayer } : null
    });
  }

  global.RoomTransport = Object.freeze({
    create: createTransport
  });
})(typeof window !== 'undefined' ? window : this);
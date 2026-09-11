/**
 * Classroom Game Multi-tab Broadcast Transport
 * Provides reliable envelope delivery between tabs on same origin using BroadcastChannel and storage fallback.
 */
(function (global) {
  'use strict';

  function createTransport() {
    const handlers = new Set();
    const seenEventIds = new Set();
    const MAX_SEEN = 300;

    let currentRoomCode = null;
    let currentPlayer = null;
    let channel = null;
    let generation = 0;
    let storageListener = null;

    function recordEventId(eventId) {
      if (!eventId) return false;
      if (seenEventIds.has(eventId)) return true;
      seenEventIds.add(eventId);
      if (seenEventIds.size > MAX_SEEN) {
        const first = seenEventIds.values().next().value;
        seenEventIds.delete(first);
      }
      return false;
    }

    function dispatch(envelope) {
      if (!envelope || typeof envelope !== 'object') return;
      if (envelope.roomCode !== currentRoomCode) return;
      if (recordEventId(envelope.eventId)) return; // duplicate

      // If private message, check recipient
      if (envelope.recipientId && currentPlayer && envelope.recipientId !== currentPlayer.id) {
        return;
      }

      handlers.forEach(h => {
        try {
          h(envelope);
        } catch (err) {
          console.error('[Transport handler error]', err);
        }
      });
    }

    function initStorageFallback() {
      if (storageListener) return;
      storageListener = function (e) {
        if (!e.key || !currentRoomCode) return;
        if (e.key === `classroom_event_${currentRoomCode}` && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            dispatch(data);
          } catch (err) {
            // ignore
          }
        }
      };
      global.addEventListener('storage', storageListener);
    }

    return Object.freeze({
      join(roomCode, player) {
        if (!roomCode) throw new TypeError('roomCode is required');
        this.leave();

        generation++;
        const currentGen = generation;
        currentRoomCode = String(roomCode).toUpperCase();
        currentPlayer = player ? { ...player } : null;

        const channelName = `classroom_room_${currentRoomCode}`;
        if (typeof global.BroadcastChannel === 'function') {
          try {
            channel = new global.BroadcastChannel(channelName);
            channel.onmessage = function (e) {
              if (generation !== currentGen) return;
              dispatch(e.data);
            };
          } catch (e) {
            channel = null;
          }
        }

        initStorageFallback();
        return currentGen;
      },

      send(event) {
        if (!currentRoomCode) throw new Error('Cannot send without joining a room');
        const envelope = {
          eventId: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
          roomCode: currentRoomCode,
          roundId: event.roundId || null,
          senderId: currentPlayer ? currentPlayer.id : 'anonymous',
          recipientId: event.recipientId || null,
          type: event.type,
          payload: event.payload || {},
          sentAt: Date.now()
        };

        // Record to prevent self-loop dedupe
        recordEventId(envelope.eventId);

        if (channel) {
          try {
            channel.postMessage(envelope);
          } catch (err) {
            console.error('[BroadcastChannel postMessage failed]', err);
          }
        }

        // Storage fallback triggering other tabs
        try {
          const key = `classroom_event_${currentRoomCode}`;
          global.localStorage.setItem(key, JSON.stringify(envelope));
          global.localStorage.removeItem(key);
        } catch (err) {
          // ignore quota error
        }

        return envelope.eventId;
      },

      onEvent(handler) {
        if (typeof handler !== 'function') throw new TypeError('Handler must be a function');
        handlers.add(handler);
        return () => handlers.delete(handler);
      },

      leave() {
        generation++;
        if (channel) {
          try {
            channel.close();
          } catch (e) {}
          channel = null;
        }
        currentRoomCode = null;
        currentPlayer = null;
        // NOTE: handlers.clear() is deliberately NOT called per startup-reliability.md
      },

      get currentRoom() {
        return currentRoomCode;
      },

      get player() {
        return currentPlayer ? { ...currentPlayer } : null;
      }
    });
  }

  global.ClassroomTransport = Object.freeze({
    create: createTransport
  });
})(window);

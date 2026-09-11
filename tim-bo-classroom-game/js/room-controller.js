/**
 * Room Controller for "Tìm Bò - Let's Save the Cows!"
 * Handles Teacher Authority (grading, room lifecycle, snapshot, roster)
 * and Student Client sync.
 */
(function (global) {
  'use strict';

  function calculateLeaderboard(rosterMap) {
    const list = Array.from(rosterMap.values()).map(p => ({
      playerId: p.id,
      name: p.name,
      avatar: p.avatar || 'astronaut-1',
      score: p.score || 0,
      cowsRescued: p.cowsRescued || 0,
      correctCount: p.correctCount || 0,
      incorrectCount: p.incorrectCount || 0,
      unansweredCount: p.unansweredCount || 0,
      currentQuestionIndex: p.currentQuestionIndex || 0,
      status: p.status || 'waiting'
    }));

    // Sắp xếp điểm giảm dần; bằng điểm giữ thứ tự ổn định theo playerId
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.playerId.localeCompare(b.playerId);
    });

    // Gán thứ hạng rank (bằng điểm cùng rank)
    let currentRank = 1;
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i].score < list[i - 1].score) {
        currentRank = i + 1;
      }
      list[i].rank = currentRank;
    }

    return list;
  }

  /**
   * Tạo Teacher Authority Controller
   */
  function createTeacherController(transport, contentBank) {
    let roomCode = transport.getRoomCode();
    let roundId = null;
    let status = 'waiting'; // 'waiting' | 'playing' | 'ended'
    let questionBank = contentBank; // Immutable snapshot during playing
    const roster = new Map(); // playerId -> PlayerState
    const answeredKeys = new Set(); // (roundId_playerId_questionId)
    const changeListeners = new Set();

    function notifyChange() {
      changeListeners.forEach(fn => {
        try {
          fn(getSnapshot());
        } catch (e) {
          console.error('[RoomController] Change listener error:', e);
        }
      });
    }

    function getSnapshot() {
      return {
        roomCode,
        roundId,
        status,
        contentVersion: questionBank ? questionBank.contentVersion : null,
        bankTitle: questionBank ? questionBank.title : '',
        totalQuestions: questionBank && questionBank.questions ? questionBank.questions.length : 0,
        roster: Array.from(roster.values()),
        leaderboard: calculateLeaderboard(roster)
      };
    }

    function saveSnapshot() {
      try {
        sessionStorage.setItem(`TIM_BO_ROOM_${roomCode}`, JSON.stringify(getSnapshot()));
      } catch {}
    }

    function broadcastRoster() {
      const lb = calculateLeaderboard(roster);
      transport.send('rosterUpdate', {
        roster: Array.from(roster.values()),
        leaderboard: lb,
        status
      }, { roundId });
      saveSnapshot();
      notifyChange();
    }

    // Lắng nghe sự kiện từ các học sinh
    transport.onEvent((envelope) => {
      const { type, payload, senderId } = envelope;

      if (type === 'playerJoin') {
        const { player } = payload;
        if (!player || !player.id) return;

        // Cho phép tối đa 4 học sinh (thiết kế lớp học 4 bạn)
        if (!roster.has(player.id) && roster.size >= 4) {
          transport.send('joinRejected', { reason: 'Phòng đã đủ 4 học sinh!' }, { recipientId: player.id });
          return;
        }

        const existing = roster.get(player.id) || {};
        const playerState = {
          id: player.id,
          name: player.name || `Phi hành gia ${roster.size + 1}`,
          avatar: player.avatar || `astronaut-${(roster.size % 4) + 1}`,
          score: existing.score || 0,
          cowsRescued: existing.cowsRescued || 0,
          correctCount: existing.correctCount || 0,
          incorrectCount: existing.incorrectCount || 0,
          unansweredCount: existing.unansweredCount || 0,
          currentQuestionIndex: existing.currentQuestionIndex || 0,
          status: status === 'playing' ? 'thinking' : 'waiting',
          answers: existing.answers || {},
          joinedAt: existing.joinedAt || Date.now()
        };

        roster.set(player.id, playerState);
        broadcastRoster();

        // Gửi thông tin phòng cho học sinh vừa vào
        const learnerQuestions = questionBank ? ContentLoader.createLearnerPayload(questionBank.questions) : [];
        transport.send('roomWelcome', {
          roomCode,
          roundId,
          status,
          player: playerState,
          questions: status === 'playing' ? learnerQuestions : [],
          contentVersion: questionBank ? questionBank.contentVersion : null
        }, { recipientId: player.id });

      } else if (type === 'answerAttempt') {
        if (status !== 'playing') return;
        const { questionId, answer, timeMs } = payload;
        const player = roster.get(senderId);
        if (!player) return;

        // Tránh submit trùng lặp cho cùng một câu hỏi
        const answerKey = `${roundId}_${senderId}_${questionId}`;
        if (answeredKeys.has(answerKey)) {
          console.warn('[Teacher Authority] Duplicate answer attempt ignored:', answerKey);
          return;
        }
        answeredKeys.add(answerKey);

        // Authority chấm điểm
        const question = questionBank.questions.find(q => q.id === questionId);
        if (!question) return;

        const isCorrect = (answer === question.correctOptionId);
        const pointsAwarded = isCorrect ? (question.points || 10) : 0;

        player.answers[questionId] = {
          answer,
          isCorrect,
          timeMs,
          correctOptionId: question.correctOptionId
        };

        if (isCorrect) {
          player.score += pointsAwarded;
          player.cowsRescued += 1;
          player.correctCount += 1;
        } else {
          player.incorrectCount += 1;
        }

        player.currentQuestionIndex = (player.currentQuestionIndex || 0) + 1;
        if (player.currentQuestionIndex >= questionBank.questions.length) {
          player.status = 'finished';
        } else {
          player.status = 'thinking';
        }

        // Gửi kết quả chấm riêng cho học sinh này (chỉ reveal đáp án sau khi nộp)
        transport.send('answerResult', {
          questionId,
          answer,
          isCorrect,
          correctOptionId: question.correctOptionId,
          score: player.score,
          delta: pointsAwarded,
          cowsRescued: player.cowsRescued,
          timeMs: timeMs || 0
        }, { recipientId: senderId, roundId });

        broadcastRoster();

        // Kiểm tra xem tất cả học sinh đã hoàn thành chưa
        const allFinished = Array.from(roster.values()).every(p => p.status === 'finished');
        if (roster.size > 0 && allFinished) {
          setTimeout(() => {
            endGame();
          }, 1500);
        }

      } else if (type === 'playerLeave') {
        if (roster.has(senderId)) {
          roster.delete(senderId);
          broadcastRoster();
        }
      }
    });

    function setQuestionBank(bank) {
      if (status === 'playing') {
        console.warn('Không thể đổi ngân hàng câu hỏi khi vòng chơi đang diễn ra.');
        return false;
      }
      questionBank = bank;
      saveSnapshot();
      notifyChange();
      return true;
    }

    function startGame() {
      if (roster.size === 0) {
        throw new Error('Cần ít nhất 1 học sinh tham gia để bắt đầu!');
      }
      if (!questionBank || !questionBank.questions || questionBank.questions.length === 0) {
        throw new Error('Chưa có ngân hàng câu hỏi hợp lệ!');
      }

      roundId = 'rnd_' + Date.now();
      status = 'playing';
      answeredKeys.clear();

      // Reset điểm số và tiến độ từng học sinh
      roster.forEach(p => {
        p.score = 0;
        p.cowsRescued = 0;
        p.correctCount = 0;
        p.incorrectCount = 0;
        p.unansweredCount = 0;
        p.currentQuestionIndex = 0;
        p.answers = {};
        p.status = 'thinking';
      });

      const learnerQuestions = ContentLoader.createLearnerPayload(questionBank.questions);

      // Phát sự kiện bắt đầu trò chơi tới tất cả học sinh
      transport.send('gameStart', {
        roomCode,
        roundId,
        contentVersion: questionBank.contentVersion,
        questions: learnerQuestions
      }, { roundId });

      broadcastRoster();
    }

    function endGame() {
      status = 'ended';
      const totalQ = questionBank ? questionBank.questions.length : 0;
      roster.forEach(p => {
        const answeredCount = (p.correctCount || 0) + (p.incorrectCount || 0);
        p.unansweredCount = Math.max(0, totalQ - answeredCount);
        p.status = 'finished';
      });

      const lb = calculateLeaderboard(roster);

      transport.send('gameEnd', {
        roomCode,
        roundId,
        leaderboard: lb
      }, { roundId });

      broadcastRoster();
    }

    return Object.freeze({
      getSnapshot,
      setQuestionBank,
      startGame,
      endGame,
      getRoster: () => Array.from(roster.values()),
      getLeaderboard: () => calculateLeaderboard(roster),
      getStatus: () => status,
      getQuestionBank: () => questionBank,
      onChange: (fn) => {
        if (typeof fn === 'function') {
          changeListeners.add(fn);
          return () => changeListeners.delete(fn);
        }
      }
    });
  }

  global.RoomController = Object.freeze({
    createTeacherController,
    calculateLeaderboard
  });
})(typeof window !== 'undefined' ? window : this);
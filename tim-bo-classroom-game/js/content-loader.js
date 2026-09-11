/**
 * Content Loader for "Tìm Bò - Let's Save the Cows!"
 * Conforms to external-content.md specification (Schema v1, Content Hash Versioning, Sanitization)
 */
(function (global) {
  'use strict';

  function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return 'v-' + Math.abs(hash).toString(16).padStart(8, '0');
  }

  function validateBank(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Dữ liệu ngân hàng câu hỏi không hợp lệ (không phải object).');
    }
    if (data.schemaVersion !== 1) {
      throw new Error(`Phiên bản schema ${data.schemaVersion} không được hỗ trợ (cần phiên bản 1).`);
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('Danh sách câu hỏi trống hoặc không phải mảng.');
    }

    const qIds = new Set();
    const validatedQuestions = [];

    data.questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (!q || typeof q !== 'object') {
        throw new Error(`Câu hỏi #${qNum} không hợp lệ.`);
      }
      if (!q.id || typeof q.id !== 'string') {
        throw new Error(`Câu hỏi #${qNum} thiếu trường 'id'.`);
      }
      if (qIds.has(q.id)) {
        throw new Error(`Trùng lặp ID câu hỏi '${q.id}' tại câu #${qNum}.`);
      }
      qIds.add(q.id);

      if (!q.prompt || typeof q.prompt !== 'string' || !q.prompt.trim()) {
        throw new Error(`Câu hỏi #${qNum} (${q.id}) có nội dung câu hỏi rỗng.`);
      }

      if (q.type && q.type !== 'single-choice') {
        throw new Error(`Câu hỏi #${qNum} (${q.id}) có dạng '${q.type}' chưa hỗ trợ.`);
      }

      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Câu hỏi #${qNum} (${q.id}) phải có ít nhất 2 lựa chọn.`);
      }

      const optIds = new Set();
      const validatedOptions = [];
      q.options.forEach((opt, optIdx) => {
        if (!opt || typeof opt !== 'object' || !opt.id || typeof opt.text !== 'string') {
          throw new Error(`Lựa chọn #${optIdx + 1} của câu #${qNum} không hợp lệ.`);
        }
        if (optIds.has(opt.id)) {
          throw new Error(`Trùng lặp id lựa chọn '${opt.id}' tại câu #${qNum}.`);
        }
        optIds.add(opt.id);
        validatedOptions.push({
          id: String(opt.id).trim(),
          text: String(opt.text).trim()
        });
      });

      if (!q.correctOptionId || !optIds.has(q.correctOptionId)) {
        throw new Error(`Câu hỏi #${qNum} (${q.id}) có correctOptionId '${q.correctOptionId}' không khớp với bất kỳ lựa chọn nào.`);
      }

      const points = Number.isFinite(q.points) && q.points >= 0 ? q.points : 10;

      validatedQuestions.push({
        id: String(q.id).trim(),
        type: 'single-choice',
        prompt: String(q.prompt).trim(),
        options: validatedOptions,
        correctOptionId: String(q.correctOptionId).trim(),
        points: points
      });
    });

    // Content version hash based on canonical string representation
    const canonicalStr = JSON.stringify(validatedQuestions);
    const contentVersion = simpleHash(canonicalStr);

    return {
      schemaVersion: 1,
      bankId: data.bankId || 'bank-' + contentVersion,
      title: data.title || 'Tìm Bò - Let\'s Save the Cows',
      description: data.description || '',
      contentVersion: contentVersion,
      fetchedAt: new Date().toISOString(),
      questions: validatedQuestions
    };
  }

  /**
   * Tạo bản copy câu hỏi cho học sinh (LOẠI BỎ correctOptionId)
   */
  function createLearnerPayload(questions) {
    return questions.map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options.map(opt => ({ id: opt.id, text: opt.text })),
      points: q.points
    }));
  }

  /**
   * Tải ngân hàng câu hỏi
   * @param {Object} sourceConfig { type: 'local'|'url'|'json', url?: string, rawJson?: string }
   * @param {Object} options { signal?: AbortSignal }
   */
  async function loadQuestionBank(sourceConfig = { type: 'local' }, options = {}) {
    let rawData = null;

    if (sourceConfig.type === 'json' && sourceConfig.rawJson) {
      rawData = JSON.parse(sourceConfig.rawJson);
    } else if (sourceConfig.type === 'url' && sourceConfig.url) {
      const resp = await fetch(sourceConfig.url, {
        signal: options.signal,
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });
      if (!resp.ok) {
        throw new Error(`Không thể tải câu hỏi từ URL (HTTP ${resp.status}: ${resp.statusText})`);
      }
      rawData = await resp.json();
    } else {
      // Default: local fallback content.json
      const resp = await fetch('content.json', {
        signal: options.signal,
        cache: 'no-cache'
      });
      if (!resp.ok) {
        throw new Error(`Không thể tải content.json (HTTP ${resp.status})`);
      }
      rawData = await resp.json();
    }

    return validateBank(rawData);
  }

  // Quản lý cấu hình nguồn câu hỏi lưu ở LocalStorage
  const SOURCE_KEY = 'TIM_BO_CONTENT_SOURCE';
  function getSavedSourceConfig() {
    try {
      const s = localStorage.getItem(SOURCE_KEY);
      return s ? JSON.parse(s) : { type: 'local' };
    } catch {
      return { type: 'local' };
    }
  }

  function saveSourceConfig(cfg) {
    localStorage.setItem(SOURCE_KEY, JSON.stringify(cfg));
  }

  global.ContentLoader = Object.freeze({
    loadQuestionBank,
    createLearnerPayload,
    validateBank,
    getSavedSourceConfig,
    saveSourceConfig
  });
})(typeof window !== 'undefined' ? window : this);

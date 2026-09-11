/**
 * Content Loader for Classroom Game
 * Supports loading question bank from external URL or local fallback (content.json).
 * Validates Schema v1 and generates a deterministic contentVersion hash.
 */

(function (global) {
  'use strict';

  const DEFAULT_FALLBACK_URL = './content.json';
  const STORAGE_KEY_SOURCE_CONFIG = 'classroom_game_source_config';

  /**
   * Fast deterministic hash function (FNV-1a 32-bit variant represented as hex)
   */
  function computeContentHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Validates Schema v1 of the question bank
   */
  function validateQuestionBank(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Dữ liệu câu hỏi không hợp lệ (không phải đối tượng JSON)');
    }
    if (data.schemaVersion !== 1) {
      throw new Error('Phiên bản schema không được hỗ trợ (cần schemaVersion = 1)');
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('Danh sách câu hỏi rỗng hoặc không phải mảng');
    }

    const seenIds = new Set();
    const validatedQuestions = data.questions.map((q, idx) => {
      const pos = `Câu hỏi #${idx + 1}`;
      if (!q || typeof q !== 'object') throw new Error(`${pos}: Dữ liệu câu hỏi bị rỗng`);
      if (!q.id || typeof q.id !== 'string') throw new Error(`${pos}: Thiếu trường 'id' hoặc không phải chuỗi`);
      if (seenIds.has(q.id)) throw new Error(`${pos}: Trùng lặp id câu hỏi '${q.id}'`);
      seenIds.add(q.id);

      if (!q.prompt || typeof q.prompt !== 'string' || !q.prompt.trim()) {
        throw new Error(`${pos}: Nội dung câu hỏi (prompt) bị rỗng`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`${pos}: Cần tối thiểu 2 phương án lựa chọn (options)`);
      }

      const optIds = new Set();
      const options = q.options.map((opt, oIdx) => {
        if (!opt || typeof opt !== 'object') throw new Error(`${pos}, Lựa chọn #${oIdx + 1}: Không hợp lệ`);
        if (!opt.id || typeof opt.id !== 'string') throw new Error(`${pos}, Lựa chọn #${oIdx + 1}: Thiếu id`);
        if (optIds.has(opt.id)) throw new Error(`${pos}: Trùng id lựa chọn '${opt.id}'`);
        optIds.add(opt.id);
        if (typeof opt.text !== 'string' || !opt.text.trim()) throw new Error(`${pos}, Lựa chọn '${opt.id}': Nội dung rỗng`);
        return { id: opt.id, text: String(opt.text).trim() };
      });

      if (!q.correctOptionId || !optIds.has(q.correctOptionId)) {
        throw new Error(`${pos}: Đáp án đúng 'correctOptionId' (${q.correctOptionId}) không khớp với bất kỳ phương án nào`);
      }

      const points = Number.isFinite(q.points) && q.points >= 0 ? q.points : 10;
      const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';

      return {
        id: q.id,
        type: q.type || 'single-choice',
        prompt: q.prompt.trim(),
        options,
        correctOptionId: q.correctOptionId,
        explanation,
        points
      };
    });

    return {
      schemaVersion: 1,
      title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Bộ câu hỏi lớp học',
      questions: validatedQuestions
    };
  }

  /**
   * Filters out answer keys so that student clients cannot inspect correct answers.
   */
  function getLearnerSafeQuestions(questions) {
    return questions.map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options.map(o => ({ id: o.id, text: o.text })),
      points: q.points
    }));
  }

  /**
   * Loads question bank from source URL with fallback to local content.json
   */
  async function loadQuestionBank(sourceConfig = null, options = {}) {
    const signal = options.signal;
    const activeUrl = (sourceConfig && sourceConfig.url) ? sourceConfig.url : DEFAULT_FALLBACK_URL;
    let rawText = '';
    let fetchedFrom = activeUrl;

    try {
      const resp = await fetch(activeUrl, {
        signal,
        cache: 'no-cache',
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      rawText = await resp.text();
    } catch (err) {
      if (activeUrl !== DEFAULT_FALLBACK_URL) {
        console.warn(`Lỗi nạp từ nguồn ngoài (${activeUrl}): ${err.message}. Đang dùng file dự phòng ${DEFAULT_FALLBACK_URL}...`);
        const fallbackResp = await fetch(DEFAULT_FALLBACK_URL, { signal, cache: 'no-cache' });
        if (!fallbackResp.ok) throw new Error(`Không thể nạp file dự phòng: HTTP ${fallbackResp.status}`);
        rawText = await fallbackResp.text();
        fetchedFrom = `${DEFAULT_FALLBACK_URL} (dự phòng do nguồn ngoài lỗi)`;
      } else {
        throw err;
      }
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Dữ liệu nhận được không phải JSON hợp lệ: ${e.message}`);
    }

    const validated = validateQuestionBank(parsedJson);
    const normalizedStr = JSON.stringify(validated);
    const contentVersion = 'v1-' + computeContentHash(normalizedStr);

    return {
      schemaVersion: 1,
      title: validated.title,
      contentVersion,
      fetchedAt: Date.now(),
      sourceUrl: fetchedFrom,
      questions: validated.questions
    };
  }

  function getStoredSourceConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SOURCE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveStoredSourceConfig(config) {
    try {
      if (config) {
        localStorage.setItem(STORAGE_KEY_SOURCE_CONFIG, JSON.stringify(config));
      } else {
        localStorage.removeItem(STORAGE_KEY_SOURCE_CONFIG);
      }
    } catch (e) {
      console.error('Không thể lưu cấu hình nguồn:', e);
    }
  }

  global.ContentLoader = Object.freeze({
    loadQuestionBank,
    validateQuestionBank,
    getLearnerSafeQuestions,
    getStoredSourceConfig,
    saveStoredSourceConfig,
    DEFAULT_FALLBACK_URL
  });

})(typeof window !== 'undefined' ? window : this);

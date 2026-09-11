"""Local preview + read-only Google Docs adapter. No multiplayer server/authentication."""
import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 1_000_000


def parse_document(text):
    questions = []
    current = None
    for line in text.lstrip('\ufeff').splitlines():
        line = line.strip()
        if not line:
            continue
        question = re.fullmatch(r'(\d+)\s*[.)]\s*(.+)', line)
        option = re.fullmatch(r'([a-dA-D])\s*[.)]\s*(.+)', line)
        if question:
            current = {'id': 'house-' + question[1].zfill(3), 'type': 'single-choice',
                       'prompt': question[2], 'options': [], 'points': 10}
            questions.append(current)
        elif option and current is not None:
            label, body = option[1].lower(), option[2]
            correct = '✅' in body
            if correct and 'correctOptionId' in current:
                raise ValueError(f"Câu {current['id']}: có nhiều đáp án đánh dấu ✅.")
            current['options'].append({'id': label, 'text': body.replace('✅', '').strip()})
            if correct:
                current['correctOptionId'] = label
        elif not questions and line.casefold() in {'danh sách câu hỏi', 'house & rooms', 'house and rooms'}:
            continue
        else:
            raise ValueError(f'Dòng chưa đúng định dạng: {line[:100]}')
    if not 1 <= len(questions) <= 100:
        raise ValueError('Tài liệu cần 1–100 câu hỏi.')
    ids = set()
    for q in questions:
        if q['id'] in ids:
            raise ValueError('Số thứ tự câu hỏi bị trùng.')
        ids.add(q['id'])
        labels = [o['id'] for o in q['options']]
        if not 2 <= len(labels) <= 4 or len(set(labels)) != len(labels):
            raise ValueError(f"Câu {q['id']}: cần 2–4 lựa chọn không trùng ký hiệu.")
        if q.get('correctOptionId') not in labels:
            raise ValueError(f"Câu {q['id']}: cần đánh dấu ✅ ở một đáp án đúng.")
        if len(q['prompt']) > 600 or any(not o['text'] or len(o['text']) > 240 for o in q['options']):
            raise ValueError(f"Câu {q['id']}: nội dung trống hoặc quá dài.")
    return {'schemaVersion': 1, 'title': 'House & Rooms · 8 câu hỏi' if len(questions) == 8 else f'House & Rooms · {len(questions)} câu hỏi',
            'questions': questions, 'sourceFetchedAt': int(time.time() * 1000)}


def fetch_document(document_id):
    if not re.fullmatch(r'[A-Za-z0-9_-]{15,150}', document_id):
        raise ValueError('Mã tài liệu Google Docs không hợp lệ.')
    url = f'https://docs.google.com/document/d/{document_id}/export?format=txt'
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'ClassroomGameLocalPreview/1.0'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('Tài liệu vượt 1 MB.')
        return parse_document(data.decode('utf-8-sig'))


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != '/api/google-doc':
            return super().do_GET()
        try:
            document_id = urllib.parse.parse_qs(parsed.query).get('documentId', [''])[0]
            result = fetch_document(document_id)
            status = 200
        except urllib.error.HTTPError as error:
            status = 502
            result = {'error': f'Google Docs trả HTTP {error.code}. Kiểm tra link và quyền đọc tài liệu.'}
        except (urllib.error.URLError, TimeoutError, OSError):
            status = 502
            result = {'error': 'Không đọc được Google Docs. Kiểm tra kết nối mạng hoặc thử lại.'}
        except (ValueError, UnicodeError) as error:
            status = 422
            result = {'error': str(error)}
        body = json.dumps(result, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
    print(f'Game: http://127.0.0.1:{args.port}/index.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

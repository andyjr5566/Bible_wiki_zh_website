"""僅供 R24 本機測試：中文巢狀網址、HTTP 500、實際回應雜湊。"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
from datetime import datetime, timezone
import hashlib
import json
import mimetypes

site = Path(__file__).resolve().parents[3]
dist = (site/'dist').resolve()
log = site/'docs/qa/revamp/r24-http-responses.jsonl'

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        prefix, _, relative = path.lstrip('/').partition('/')
        target = (dist/(relative or 'index.html')).resolve()
        valid = target.is_relative_to(dist)
        fail = (prefix == 'hero-failure' and relative == 'models/tabernacle-main.glb') or (prefix == 'detail-failure' and relative == 'models/altar-burnt-offering.glb')
        status = 500 if fail else 200 if valid and target.is_file() else 404
        body = b'R24 expected injected HTTP 500' if fail else target.read_bytes() if status == 200 else b'Not found'
        self.send_response(status)
        self.send_header('Content-Type', 'model/gltf-binary' if target.suffix == '.glb' else (mimetypes.guess_type(target.name)[0] or 'application/octet-stream'))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)
        with log.open('a',encoding='utf-8') as output:
            output.write(json.dumps({'time':datetime.now(timezone.utc).isoformat(),'url':self.path,'status':status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'injected':fail},ensure_ascii=False)+'\n')
    def log_message(self, *_):
        pass

print('R24 local preview http://127.0.0.1:4179/驗收/ ; fault prefixes hero-failure/detail-failure',flush=True)
ThreadingHTTPServer(('127.0.0.1',4179),Handler).serve_forever()

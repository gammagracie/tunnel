# Dev server for Lumen Rail: static files with Cache-Control: no-cache so the
# browser always revalidates and picks up edits (plain `python3 -m http.server`
# lets browsers reuse stale JS for minutes to hours).
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    root = os.path.dirname(os.path.abspath(__file__))
    server = ThreadingHTTPServer(('', 8935), partial(Handler, directory=root))
    print(f'Serving {root} at http://localhost:8935 (no-cache)')
    server.serve_forever()

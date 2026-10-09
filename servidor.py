# Servidor local mínimo: python servidor.py  ->  http://localhost:8000
import http.server, mimetypes, os, socketserver
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('model/gltf+json', '.gltf')
mimetypes.add_type('model/gltf-binary', '.glb')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8000
with socketserver.TCPServer(('', PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f'Resgate da Princesa rodando em http://localhost:{PORT}')
    httpd.serve_forever()

import http.server
import socketserver
import os

PORT = 8080

class SilenciosoHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Converte a mensagem formatada para string para evitar TypeError com HTTPStatus
        mensagem = str(format % args)
        
        # Silencia requisições do favicon e métodos HEAD
        if 'favicon.ico' in mensagem or 'HEAD' in mensagem:
            return
            
        # Para logar normalmente o resto (ou você pode comentar a linha abaixo para silenciar tudo)
        super().log_message(format, *args)

# Muda para a pasta atual (onde está o Hub.html)
os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')

with socketserver.TCPServer(("", PORT), SilenciosoHandler) as httpd:
    print("=" * 50)
    print(f"🚀 Servidor Evollogic rodando na porta {PORT}!")
    print(f"👉 Acesse: http://localhost:{PORT}/Hub.html")
    print("=" * 50)
    print("Aguardando conexões de forma silenciosa... (CTRL+C para sair)\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")

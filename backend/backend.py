import json
import requests
import base64
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

def safe_dict(obj):
    return obj if isinstance(obj, dict) else {}

class EvollogicBackend(BaseHTTPRequestHandler):

    def call_lootlabs(self, payload, key, title, url, adv_cfg):
        adv_cfg = safe_dict(adv_cfg)
        global_visuals = safe_dict(payload.get('global_visuals', {}))
        
        endpoint = "https://creators.lootlabs.gg/api/public/content_locker"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        
        data = {
            "title": title,
            "url": url,
            "tier_id": adv_cfg.get('tier', 1),
            "number_of_tasks": adv_cfg.get('tasks', 3),
            "theme": adv_cfg.get('theme', 1),
            "thumbnail": global_visuals.get('thumb', '')
        }
        
        response = requests.post(endpoint, json=data, headers=headers, timeout=10)
        if response.status_code in [401, 403]:
            raise ValueError("Chave de API inválida ou não autorizada pelo LootLabs.")
        return response.json()

    def call_workink(self, payload, key, title, url, adv_cfg):
        adv_cfg = safe_dict(adv_cfg)
        endpoint = "https://api.work.ink/v1/links" 
        headers = {"X-API-KEY": key, "Content-Type": "application/json"}
        data = {
            "title": title,
            "url": url,
            "alias": adv_cfg.get('alias', ''),
            "description": adv_cfg.get('desc', ''),
            "social_tasks": {"yt": adv_cfg.get('yt', ''), "dsc": adv_cfg.get('dsc', '')}
        }
        response = requests.post(endpoint, json=data, headers=headers, timeout=10)
        if response.status_code in [401, 403]:
            raise ValueError("Chave de API inválida ou não autorizada pelo Work.ink.")
        return response.json()

    def call_linkvertise(self, payload, key, title, url, adv_cfg):
        user_id = str(key).strip()
        
        if not user_id.isdigit():
            raise ValueError("Para o Linkvertise, a chave deve ser apenas o seu NÚMERO de usuário (Ex: 1285428).")
            
        # 1. Converte para Base64
        base64_url = base64.b64encode(url.encode('utf-8')).decode('utf-8')
        
        # 2. BLINDAGEM: Transforma caracteres especiais (como ==) em formato seguro para URL
        safe_base64 = urllib.parse.quote(base64_url)
        
        # 3. Monta o link dinâmico oficial
        final_url = f"https://linkvertise.com/{user_id}/dynamic?r={safe_base64}"
        
        return {"url": final_url}

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0: raise ValueError("Corpo da requisição está vazio.")
                
            post_data = self.rfile.read(content_length)
            payload = safe_dict(json.loads(post_data))

            order = payload.get('order', [])
            if not isinstance(order, list): order = []
                
            keys = safe_dict(payload.get('api_keys', {}))
            adv_configs = safe_dict(payload.get('advanced_configs', {}))
            global_visuals = safe_dict(payload.get('global_visuals', {}))
            
            raw_title = global_visuals.get('title', 'Link')
            title = (raw_title[:9] + '..') if len(raw_title) > 9 else raw_title
            
            original_url = payload.get('target_url', '')
            if not original_url: raise ValueError("URL ausente.")
            
            current_url = original_url

            for provider in reversed(order):
                if provider not in keys or not keys.get(provider):
                    continue
                    
                try:
                    if provider == 'lootlabs':
                        res = self.call_lootlabs(payload, keys['lootlabs'], title, current_url, adv_configs.get('lootlabs', {}))
                        res = safe_dict(res)
                        msg_data = res.get('message')
                        
                        loot_url = None
                        if isinstance(msg_data, list) and len(msg_data) > 0:
                            loot_url = msg_data[0].get('loot_url')
                        elif isinstance(msg_data, dict):
                            loot_url = msg_data.get('loot_url')
                            
                        if loot_url: current_url = loot_url
                        else: print(f"⚠️ LootLabs recusou, pulando... Erro: {res}")
                            
                    elif provider == 'workink':
                        res = safe_dict(self.call_workink(payload, keys['workink'], title, current_url, adv_configs.get('workink', {})))
                        work_url = res.get('url')
                        if work_url: current_url = work_url
                        else: print(f"⚠️ Workink recusou, pulando... Erro: {res}")
                            
                    elif provider == 'linkvertise':
                        res = safe_dict(self.call_linkvertise(payload, keys['linkvertise'], title, current_url, adv_configs.get('linkvertise', {})))
                        link_url = res.get('url')
                        if link_url: current_url = link_url
                        else: print(f"⚠️ Linkvertise recusou, pulando... Erro: {res}")
                            
                except ValueError as key_err:
                    print(f"❌ Erro de Autenticação: {str(key_err)}")
                    response_payload = {"status": "error", "message": str(key_err)}
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps(response_payload).encode('utf-8'))
                    return

                except requests.exceptions.RequestException as req_err:
                    print(f"⚠️ A API do {provider} está offline devido a problemas de rede. Pulando...")
                    continue
                except Exception as e:
                    print(f"⚠️ Falha geral no {provider}: {str(e)}. Pulando...")
                    continue

            if current_url == original_url:
                response_payload = {"status": "error", "message": "Nenhum provedor configurado conseguiu gerar o link."}
            else:
                response_payload = {"status": "success", "final_url": current_url}
        
        except Exception as e:
            response_payload = {"status": "error", "message": f"Erro interno: {str(e)}"}

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response_payload).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    server = HTTPServer(('localhost', 5000), EvollogicBackend)
    print("🚀 Backend V10 (Linkvertise 100% Seguro) Online na porta 5000!")
    server.serve_forever()

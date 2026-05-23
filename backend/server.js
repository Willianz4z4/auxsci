const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const safeDict = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

const HEADERS_PADRAO = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json"
};

async function callLootlabs(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    const data = {
        title: title || "Link",
        url: url,
        tier_id: parseInt(advCfg.tier) || 1,
        number_of_tasks: parseInt(advCfg.tasks) || 3,
        theme: parseInt(advCfg.theme) || 1
    };

    try {
        const response = await axios.post("https://creators.lootlabs.gg/api/public/content_locker", data, {
            headers: { ...HEADERS_PADRAO, "Authorization": `Bearer ${key}` },
            timeout: 15000
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            let msg = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
            throw new Error(`Status ${error.response.status} - ${msg.substring(0, 50)}`);
        }
        throw new Error(`Falha na Rede: ${error.message}`);
    }
}

async function callWorkink(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    const data = { title: title || "Link", url: url };

    try {
        const response = await axios.post("https://work.ink/api/v1/link", data, {
            headers: {
                ...HEADERS_PADRAO,
                "X-API-KEY": key,
                "Authorization": `Bearer ${key}`
            },
            timeout: 15000
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            let errBody = error.response.data;
            let strBody = typeof errBody === 'string' ? errBody : JSON.stringify(errBody);

            if (strBody.toLowerCase().includes("cloudflare") || strBody.includes("<html")) {
                throw new Error("Bloqueio Cloudflare! O Work.ink está banindo IPs de nuvem (Railway).");
            }
            throw new Error(`Chave Recusada: ${strBody.substring(0, 60)}`);
        }
        throw new Error(`Falha de Conexão: ${error.message}`);
    }
}

app.post('/ping', async (req, res) => {
    const { provider, key } = req.body;
    try {
        if (provider === 'lootlabs') {
            await callLootlabs({}, key, "Ping Test", "https://google.com", {});
            return res.json({ status: "success" });
        }
        if (provider === 'workink') {
            await callWorkink({}, key, "Ping Test", "https://google.com", {});
            return res.json({ status: "success" });
        }
        res.json({ status: "error", message: "Provedor desconhecido" });
    } catch (e) {
        res.json({ status: "error", message: e.message });
    }
});

app.post('/', async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) throw new Error("Corpo vazio.");

        const payload = safeDict(req.body);
        
        // CORREÇÃO 1: Inverte a ordem recebida para gerar a cascata correta de links (de trás para frente)
        const order = Array.isArray(payload.order) ? [...payload.order].reverse() : [];
        
        const keys = safeDict(payload.api_keys);
        const advConfigs = safeDict(payload.advanced_configs);
        const globalVisuals = safeDict(payload.global_visuals);

        const rawTitle = globalVisuals.title || 'Link';
        const title = rawTitle.length > 9 ? rawTitle.substring(0, 9) + '..' : rawTitle;
        const originalUrl = payload.target_url || '';
        if (!originalUrl) throw new Error("URL ausente.");

        let currentUrl = originalUrl;

        for (const provider of order) {
            if (!keys[provider]) continue;
            try {
                if (provider === 'lootlabs') {
                    const result = await callLootlabs(payload, keys.lootlabs, title, currentUrl, advConfigs.lootlabs);
                    let lootUrl = (result.message && Array.isArray(result.message)) ? result.message[0]?.loot_url : result.message?.loot_url;
                    if (lootUrl) currentUrl = lootUrl;
                    else throw new Error("API não retornou a URL.");

                } else if (provider === 'workink') {
                    const result = await callWorkink(payload, keys.workink, title, currentUrl, advConfigs.workink);
                    let wkUrl = result.url || result.data?.url || result.message?.url;
                    if (wkUrl) currentUrl = wkUrl;
                    else throw new Error("API não retornou a URL.");
                }
            } catch (err) {
                // CORREÇÃO 2: Substituído o 'return' por 'continue' para que uma API quebrada não mate os outros links válidos
                console.error(`[${provider.toUpperCase()}] Falha na API: ${err.message}`);
                continue;
            }
        }

        if (currentUrl === originalUrl) {
            res.status(200).json({ status: "error", message: "Nenhuma modificação pôde ser feita devido a falhas nas APIs." });
        } else {
            res.status(200).json({ status: "success", final_url: currentUrl });
        }
    } catch (error) {
        res.status(200).json({ status: "error", message: `Erro interno: ${error.message}` });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Evollogic V10.6 (Raio-X de Erros) na porta ${PORT}!`));

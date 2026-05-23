const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const safeDict = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

// CABEÇALHO DE DISFARCE (Engana o Cloudflare do Work.ink)
const HEADERS_PADRAO = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
};

async function callLootlabs(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    const data = { title: title || "Link", url: url, tier_id: parseInt(advCfg.tier) || 1, number_of_tasks: parseInt(advCfg.tasks) || 3, theme: parseInt(advCfg.theme) || 1 };
    
    const response = await fetch("https://creators.lootlabs.gg/api/public/content_locker", {
        method: "POST",
        headers: { ...HEADERS_PADRAO, "Authorization": `Bearer ${key}` },
        body: JSON.stringify(data)
    });
    
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(resData.message || `Recusado com status ${response.status}`);
    return resData;
}

async function callWorkink(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    const data = { title: title || "Link", url: url };
    
    const response = await fetch("https://api.work.ink/v1/links", {
        method: "POST",
        headers: { ...HEADERS_PADRAO, "X-API-KEY": key },
        body: JSON.stringify(data)
    });
    
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(resData.error || resData.message || `Recusado com status ${response.status}`);
    return resData;
}

// --- ROTA DE PING PARA O SETUP_API ---
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

// --- ROTA PRINCIPAL (FÁBRICA DE LINKS) ---
app.post('/', async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) throw new Error("Corpo vazio.");

        const payload = safeDict(req.body);
        const order = Array.isArray(payload.order) ? payload.order : [];
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
                    else throw new Error("A API não devolveu o link. Resposta: " + JSON.stringify(result));
                } else if (provider === 'workink') {
                    const result = await callWorkink(payload, keys.workink, title, currentUrl, advConfigs.workink);
                    if (result.url) currentUrl = result.url;
                    else throw new Error("A API não devolveu o link. Resposta: " + JSON.stringify(result));
                }
            } catch (err) {
                return res.status(200).json({ status: "error", message: `[${provider.toUpperCase()}] ${err.message}` });
            }
        }

        if (currentUrl === originalUrl) res.status(200).json({ status: "error", message: "Erro de processamento nas chaves." });
        else res.status(200).json({ status: "success", final_url: currentUrl });
        
    } catch (error) {
        res.status(200).json({ status: "error", message: `Erro interno: ${error.message}` });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Evollogic V10.3 (Anti-Bot) na porta ${PORT}!`));

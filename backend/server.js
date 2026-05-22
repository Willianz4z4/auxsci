const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const safeDict = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

async function callLootlabs(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    const globalVisuals = safeDict(payload.global_visuals);
    
    const data = {
        title: title,
        url: url,
        tier_id: advCfg.tier || 1,
        number_of_tasks: advCfg.tasks || 3,
        theme: advCfg.theme || 1,
        thumbnail: globalVisuals.thumb || ''
    };

    const response = await fetch("https://creators.lootlabs.gg/api/public/content_locker", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error("Chave de API inválida ou não autorizada pelo LootLabs.");
    }
    return await response.json();
}

async function callWorkink(payload, key, title, url, advCfg) {
    advCfg = safeDict(advCfg);
    
    const data = {
        title: title,
        url: url,
        alias: advCfg.alias || '',
        description: advCfg.desc || '',
        social_tasks: { yt: advCfg.yt || '', dsc: advCfg.dsc || '' }
    };

    const response = await fetch("https://api.work.ink/v1/links", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error("Chave de API inválida ou não autorizada pelo Work.ink.");
    }
    return await response.json();
}

function callLinkvertise(payload, key, title, url, advCfg) {
    const userId = String(key).trim();
    if (!/^\d+$/.test(userId)) {
        throw new Error("Para o Linkvertise, a chave deve ser apenas o seu NÚMERO de usuário.");
    }
    const base64Url = Buffer.from(url, 'utf-8').toString('base64');
    const safeBase64 = encodeURIComponent(base64Url);
    return { url: `https://linkvertise.com/${userId}/dynamic?r=${safeBase64}` };
}

app.post('/', async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) throw new Error("Corpo da requisição vazio.");

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
        const reversedOrder = [...order].reverse();

        for (const provider of reversedOrder) {
            if (!keys[provider]) continue;

            try {
                if (provider === 'lootlabs') {
                    const result = await callLootlabs(payload, keys.lootlabs, title, currentUrl, advConfigs.lootlabs);
                    let lootUrl = (result.message && Array.isArray(result.message)) ? result.message[0]?.loot_url : result.message?.loot_url;
                    if (lootUrl) currentUrl = lootUrl;
                    else console.log(`⚠️ LootLabs recusou:`, result);
                } else if (provider === 'workink') {
                    const result = await callWorkink(payload, keys.workink, title, currentUrl, advConfigs.workink);
                    if (result.url) currentUrl = result.url;
                    else console.log(`⚠️ Workink recusou:`, result);
                } else if (provider === 'linkvertise') {
                    const result = callLinkvertise(payload, keys.linkvertise, title, currentUrl, advConfigs.linkvertise);
                    if (result.url) currentUrl = result.url;
                }
            } catch (err) {
                if (err.message.includes("inválida") || err.message.includes("NÚMERO")) {
                    console.error(`❌ Erro: ${err.message}`);
                    return res.status(200).json({ status: "error", message: err.message });
                }
                console.log(`⚠️ Falha no ${provider}: ${err.message}. Pulando...`);
            }
        }

        if (currentUrl === originalUrl) {
            res.status(200).json({ status: "error", message: "Nenhum provedor gerou o link." });
        } else {
            res.status(200).json({ status: "success", final_url: currentUrl });
        }

    } catch (error) {
        res.status(200).json({ status: "error", message: `Erro: ${error.message}` });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Evollogic V10 Node.js Online na porta ${PORT}!`);
});

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Certifique-se de que está usando node-fetch@2

const app = express();

// Configuração do CORS para aceitar requisições do seu Frontend
app.use(cors());
app.use(express.json());

// Rota principal para processar o encurtamento em camadas
app.post('/', async (req, res) => {
    const { target_url, order, api_keys, global_visuals } = req.body;

    if (!target_url || !order || order.length === 0) {
        return res.status(400).json({ status: "error", message: "Parâmetros inválidos ou ausentes." });
    }

    let currentUrl = target_url;
    let appliedLayers = [];

    // Processa os encurtadores na ordem estipulada pelo array 'order'
    for (const provider of order) {
        const apiKey = api_keys[provider];
        if (!apiKey) continue;

        try {
            if (provider === "workink") {
                // Rota protegida via Vercel Proxy para evitar bloqueios de IP (Cloudflare)
                const vercelProxyUrl = "https://auxsci-proxy.vercel.app/api/workink";

                const wkRes = await fetch(vercelProxyUrl, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json", 
                        "X-API-KEY": apiKey 
                    },
                    body: JSON.stringify({ 
                        title: global_visuals?.title || "Evollogic Link", 
                        url: currentUrl 
                    })
                });

                const wkData = await wkRes.json();
                if (wkData && wkData.url) {
                    currentUrl = wkData.url;
                    appliedLayers.push("workink");
                } else {
                    console.error("Falha na resposta do Workink via Vercel:", wkData);
                }

            } else if (provider === "lootlabs") {
                // Integração padrão via API GET do Lootlabs
                const lootTitle = encodeURIComponent(global_visuals?.title || "Evollogic Link");
                const lootRes = await fetch(`https://lootlabs.gg/api/v1/shorten?api_key=${apiKey}&url=${encodeURIComponent(currentUrl)}&title=${lootTitle}`);
                
                const lootData = await lootRes.json();
                if (lootData && lootData.url) {
                    currentUrl = lootData.url;
                    appliedLayers.push("lootlabs");
                } else {
                    console.error("Falha na resposta do Lootlabs:", lootData);
                }
            }
        } catch (err) {
            console.error(`Erro ao processar camada ${provider}:`, err.message);
        }
    }

    // Se nenhuma camada funcionar, retorna erro
    if (appliedLayers.length === 0) {
        return res.status(500).json({ status: "error", message: "Nenhum encurtador respondeu com sucesso." });
    }

    // Retorna o link final gerado e a lista de camadas aplicadas com sucesso
    return res.json({
        status: "success",
        final_url: currentUrl,
        applied_layers: appliedLayers
    });
});

// O Render define a porta automaticamente pela variável de ambiente PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Auxsci ativo na porta ${PORT}`));

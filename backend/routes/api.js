const express = require('express');
const router = express.Router();
const { 
    getPlaces, 
    getActivities, 
    updatePlaceFromGoogle, 
    updateImportedStatus, 
    getCities,
    addCity,
    updateCity,
    deleteCity,
    getNeighborhoodsByCity,
    addNeighborhood,
    updateNeighborhood,
    deleteNeighborhood,
    addActivity,
    updateActivity,
    deleteActivity
} = require('../database/mongodb');
const { addToCRMQueue } = require('../crmQueue');
const searchEngine = require('../searchEngine');

// --- PLACES ---
router.post('/places', async (req, res) => {
    try {
        const filters = req.body;
        const places = await getPlaces(filters);
        res.json(places);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/places/update', async (req, res) => {
    try {
        const { placeId } = req.body;
        const result = await updatePlaceFromGoogle(placeId);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/places/update-status', async (req, res) => {
    try {
        const { placeId, status } = req.body;
        const result = await updateImportedStatus(placeId, status);
        if (status === true && result.success) {
            addToCRMQueue(placeId);
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CITIES ---
router.get('/cities', async (req, res) => {
    try { res.json(await getCities()); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cities', async (req, res) => {
    try { res.json(await addCity(req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/cities/:id', async (req, res) => {
    try { res.json(await updateCity(req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/cities/:id', async (req, res) => {
    try { res.json(await deleteCity(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NEIGHBORHOODS ---
router.post('/neighborhoods/search', async (req, res) => {
    try {
        const { municipio, estado } = req.body;
        res.json(await getNeighborhoodsByCity(municipio, estado));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/neighborhoods', async (req, res) => {
    try { res.json(await addNeighborhood(req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/neighborhoods/:id', async (req, res) => {
    try { res.json(await updateNeighborhood(req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/neighborhoods/:id', async (req, res) => {
    try { res.json(await deleteNeighborhood(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ACTIVITIES ---
router.get('/activities', async (req, res) => {
    try { res.json(await getActivities()); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/activities', async (req, res) => {
    try { res.json(await addActivity(req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/activities/:id', async (req, res) => {
    try { res.json(await updateActivity(req.params.id, req.body)); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/activities/:id', async (req, res) => {
    try { res.json(await deleteActivity(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AI GENERATOR ---
router.post('/ai/generate-neighborhoods', async (req, res) => {
    try {
        const { municipio, estado } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.json({ success: false, error: 'Chave OPENAI_API_KEY não encontrada no arquivo .env' });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Você é um assistente especializado em retornar bairros de cidades brasileiras em formato JSON. Retorne estritamente um objeto JSON com uma propriedade 'bairros' contendo um array de objetos. Cada objeto deve ter as propriedades 'bairro' (nome do bairro por extenso, Capitalizado) e 'genero' ('M' para masculino ex: no Centro, 'F' para feminino ex: na Trindade, 'N' para neutro ex: em Coqueiros). Não adicione blocos de código markdown nem explicações adicionais."
                    },
                    {
                        role: "user",
                        content: `Retorne os principais bairros de: ${municipio} - ${estado}.`
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.json({ success: false, error: errData.error?.message || `Erro HTTP ${response.status}` });
        }

        const resData = await response.json();
        const contentStr = resData.choices[0].message.content;
        const parsed = JSON.parse(contentStr);
        let list = [];
        if (Array.isArray(parsed)) {
            list = parsed;
        } else if (parsed.bairros && Array.isArray(parsed.bairros)) {
            list = parsed.bairros;
        } else {
            const keys = Object.keys(parsed);
            if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
                list = parsed[keys[0]];
            }
        }

        if (list.length === 0) {
            return res.json({ success: false, error: 'A IA não retornou nenhum bairro formatado corretamente.' });
        }

        let insertedCount = 0;
        for (const item of list) {
            if (item.bairro) {
                const result = await addNeighborhood({
                    bairro: item.bairro,
                    genero: item.genero || 'N',
                    municipio,
                    estado
                });
                if (result.success) insertedCount++;
            }
        }

        res.json({ success: true, count: insertedCount, data: list });
    } catch (e) {
        console.error('Erro ao gerar bairros com IA:', e);
        res.json({ success: false, error: e.message });
    }
});

// --- SEARCH ENGINE ---
router.post('/engine/start', async (req, res) => {
    try {
        const config = req.body;
        // Obter io do request object
        const io = req.app.get('io');
        const result = await searchEngine.start(config, io);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/engine/pause', async (req, res) => {
    try { res.json(await searchEngine.pause()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/engine/resume', async (req, res) => {
    try {
        const io = req.app.get('io');
        res.json(await searchEngine.resume(io));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/engine/stop', async (req, res) => {
    try { res.json(await searchEngine.stop()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/engine/status', async (req, res) => {
    try { res.json(await searchEngine.getStatus()); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

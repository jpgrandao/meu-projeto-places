const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { 
    getPlaces, 
    getActivities, 
    updatePlaceFromGoogle, 
    updateImportedStatus, 
    getPlaceById,
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
const { addToCRMQueue } = require('./crmQueue');
const searchEngine = require('./searchEngine');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('src/index.html');
}

// Escuta o pedido de busca de dados vindo do Frontend
ipcMain.handle('fetch-places', async (event, filters) => {
    return await getPlaces(filters);
});

// Escuta o pedido de atividades
ipcMain.handle('fetch-activities', async (event) => {
    return await getActivities();
});

// Escuta o pedido de atualização de um local do Google Maps
ipcMain.handle('update-place', async (event, placeId) => {
    return await updatePlaceFromGoogle(placeId);
});
// Escuta o pedido de atualização do status de importação no CRM
ipcMain.handle('update-imported-status', async (event, placeId, status) => {
    const result = await updateImportedStatus(placeId, status);
    if (status === true && result.success) {
        addToCRMQueue(placeId);
    }
    return result;
});

// --- NOVOS IPC HANDLERS PARA CIDADES, BAIRROS E ATIVIDADES ---

// Cidades
ipcMain.handle('fetch-cities', async () => {
    return await getCities();
});
ipcMain.handle('add-city', async (event, city) => {
    return await addCity(city);
});
ipcMain.handle('update-city', async (event, id, city) => {
    return await updateCity(id, city);
});
ipcMain.handle('delete-city', async (event, id) => {
    return await deleteCity(id);
});

// Bairros
ipcMain.handle('fetch-neighborhoods', async (event, municipio, estado) => {
    return await getNeighborhoodsByCity(municipio, estado);
});
ipcMain.handle('add-neighborhood', async (event, neighborhood) => {
    return await addNeighborhood(neighborhood);
});
ipcMain.handle('update-neighborhood', async (event, id, neighborhood) => {
    return await updateNeighborhood(id, neighborhood);
});
ipcMain.handle('delete-neighborhood', async (event, id) => {
    return await deleteNeighborhood(id);
});

// Atividades
ipcMain.handle('fetch-activities-all', async () => {
    return await getActivities();
});
ipcMain.handle('add-activity', async (event, activity) => {
    return await addActivity(activity);
});
ipcMain.handle('update-activity', async (event, id, activity) => {
    return await updateActivity(id, activity);
});
ipcMain.handle('delete-activity', async (event, id) => {
    return await deleteActivity(id);
});

// Gerador IA de Bairros via OpenAI
ipcMain.handle('generate-neighborhoods', async (event, municipio, estado) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'Chave OPENAI_API_KEY não encontrada no arquivo .env' };
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
            return { success: false, error: errData.error?.message || `Erro HTTP ${response.status}` };
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
            return { success: false, error: 'A IA não retornou nenhum bairro formatado corretamente.' };
        }

        let insertedCount = 0;
        for (const item of list) {
            if (item.bairro) {
                const res = await addNeighborhood({
                    bairro: item.bairro,
                    genero: item.genero || 'N',
                    municipio,
                    estado
                });
                if (res.success) insertedCount++;
            }
        }

        return { success: true, count: insertedCount, data: list };
    } catch (e) {
        console.error('Erro ao gerar bairros com IA:', e);
        return { success: false, error: e.message };
    }
});

// --- IPC HANDLERS PARA O MOTOR DE BUSCA (SEARCH ENGINE) ---
ipcMain.handle('engine-start', async (event, config) => {
    return await searchEngine.start(config, event.sender);
});
ipcMain.handle('engine-pause', async () => {
    return searchEngine.pause();
});
ipcMain.handle('engine-resume', async (event) => {
    return searchEngine.resume(event.sender);
});
ipcMain.handle('engine-stop', async () => {
    return searchEngine.stop();
});

ipcMain.handle('engine-status', async () => {
    return searchEngine.getStatus();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
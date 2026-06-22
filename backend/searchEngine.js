const { savePlaceDirectly, getPlaceById } = require('./database/mongodb');

// Estado interno do Motor de Busca
let engineState = {
    status: 'idle', // 'idle' | 'searching' | 'paused'
    queries: [],    // Array de objetos de busca na memória
    currentIndex: 0,
    totalPending: 0,
    processedCount: 0,
    newPlacesCount: 0,
    delayBetweenPlaces: 2000, // ms
    delayBetweenQueries: 4000, // ms
    currentTimeout: null,
    activeSearch: null,
    stopRequested: false,
    logs: []
};

// Limite de logs em memória
const MAX_LOGS = 200;

function addLog(message, type = 'system') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logEntry = { timestamp, message, type };
    engineState.logs.push(logEntry);
    
    if (engineState.logs.length > MAX_LOGS) {
        engineState.logs.shift();
    }
    return logEntry;
}

// Envia o estado atualizado e novos logs para o processo de renderização
function sendProgress(io, newLog = null) {
    if (!io) return;
    
    io.emit('engine-progress', {
        status: engineState.status,
        totalPending: engineState.totalPending,
        processedCount: engineState.processedCount,
        newPlacesCount: engineState.newPlacesCount,
        activeSearch: engineState.activeSearch ? engineState.activeSearch.busca : null,
        newLog: newLog
    });
}

// Função robusta de parser de endereços brasileiros
function parseAddressRobust(addressString) {
    if (!addressString) return {};
    
    let parts = addressString.split(' - ').map(part => part.trim());
    
    let address = null, number = null, complement = null, bairro = null;
    let city = null, state = null, zip_code = null, country = null, building_name = null;

    if (parts.length < 2) {
        const fallback = addressString.split(',').map(p => p.trim());
        return { address: fallback[0] || null };
    }

    // 1. EXTRAIR ESTADO, CEP E PAÍS (Sempre o último bloco)
    const estadoBlock = parts.pop();
    const estadoParts = estadoBlock.split(',').map(p => p.trim());
    state = estadoParts[0] || null;
    zip_code = estadoParts[1] || null;
    country = estadoParts[2] || null;

    // 2. EXTRAIR BAIRRO E CIDADE (Sempre o penúltimo bloco)
    if (parts.length > 0) {
        const bairroBlock = parts.pop();
        const bairroParts = bairroBlock.split(',').map(p => p.trim());
        if (bairroParts.length > 1) {
            bairro = bairroParts[0];
            city = bairroParts[1];
        } else {
            city = bairroParts[0];
        }
    }

    // 3. CORRIGIR ANOMALIAS
    if (parts.length === 2 && !parts[0].includes(',') && parts[1].includes(',')) {
        parts = [ parts[0] + " - " + parts[1] ];
    }

    // 4. PROCESSAR O QUE RESTOU
    if (parts.length === 1) {
        const addrParts = parts[0].split(',');
        address = addrParts[0] ? addrParts[0].trim() : null;
        number = addrParts[1] ? addrParts[1].trim() : null;
    } else if (parts.length === 2) {
        const addrParts = parts[0].split(',');
        address = addrParts[0] ? addrParts[0].trim() : null;
        number = addrParts[1] ? addrParts[1].trim() : null;
        complement = parts[1];
    } else if (parts.length >= 3) {
        building_name = parts[0];
        const addrParts = parts[1].split(',');
        address = addrParts[0] ? addrParts[0].trim() : null;
        number = addrParts[1] ? addrParts[1].trim() : null;
        complement = parts[2];
    }

    return { address, number, complement, bairro, city, state, zip_code, country, building_name };
}

// Loop de Execução Assíncrono
async function runSearchLoop(io) {
    if (engineState.stopRequested) {
        engineState.status = 'idle';
        engineState.activeSearch = null;
        const log = addLog('[Sistema] Busca interrompida pelo usuário.', 'warning');
        sendProgress(io, log);
        return;
    }

    if (engineState.status === 'paused') {
        const log = addLog('[Sistema] Busca pausada.', 'warning');
        sendProgress(io, log);
        return;
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        engineState.status = 'idle';
        engineState.activeSearch = null;
        const log = addLog('[Erro] Chave GOOGLE_MAPS_API_KEY não configurada no arquivo .env.', 'error');
        sendProgress(io, log);
        return;
    }

    if (engineState.currentIndex >= engineState.queries.length) {
        engineState.status = 'idle';
        engineState.activeSearch = null;
        const log = addLog('[Sistema] Concluído! Todas as buscas da lista foram processadas.', 'success');
        sendProgress(io, log);
        
        io.emit('engine-finished-notification', 'A busca de locais do Google Maps foi concluída com sucesso!');
        return;
    }

    const search = engineState.queries[engineState.currentIndex];
    engineState.activeSearch = search;
    const searchStartLog = addLog(`[Busca] Iniciando pesquisa: "${search.busca}"...`, 'query');
    sendProgress(io, searchStartLog);

    try {
        let nextPageToken = null;
        let pageCount = 0;
        const maxPages = 5; // Limite de 5 páginas imposto (até 100 resultados por termo)
        let placesFoundInSearch = 0;

        do {
            if (engineState.stopRequested || engineState.status === 'paused') break;

            const url = 'https://places.googleapis.com/v1/places:searchText';
            const headers = {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.id,places.types,places.businessStatus,nextPageToken,places.rating,places.userRatingCount'
            };

            const payload = { textQuery: search.busca };
            if (nextPageToken) {
                payload.pageToken = nextPageToken;
                payload.pageSize = 20;
            }

            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro API Google Search (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const places = data.places || [];
            nextPageToken = data.nextPageToken || null;
            pageCount++;

            const pageLog = addLog(`[Busca] Página ${pageCount} de max(${maxPages}): Encontrados ${places.length} locais. Processando...`, 'info');
            sendProgress(io, pageLog);

            for (const place of places) {
                if (engineState.stopRequested || engineState.status === 'paused') break;

                const placeName = place.displayName?.text || 'Sem nome';
                
                const existing = await getPlaceById(place.id);
                if (existing && existing.nome) {
                    const skipLog = addLog(`[Pulado] "${placeName}" já existe no banco de dados.`, 'skip');
                    sendProgress(io, skipLog);
                    continue;
                }

                placesFoundInSearch++;

                const detailDelay = engineState.delayBetweenPlaces;
                const delayLog = addLog(`[Aguardando] Esperando ${detailDelay / 1000}s para buscar detalhes de "${placeName}"...`, 'wait');
                sendProgress(io, delayLog);
                await new Promise(resolve => setTimeout(resolve, detailDelay));

                if (engineState.stopRequested || engineState.status === 'paused') break;

                let websiteUri = 'N/A', nationalPhoneNumber = 'N/A', internationalPhoneNumber = 'N/A';

                try {
                    const detailUrl = `https://places.googleapis.com/v1/places/${place.id}`;
                    const detailHeaders = {
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'websiteUri,nationalPhoneNumber,internationalPhoneNumber'
                    };
                    const detailResponse = await fetch(detailUrl, { headers: detailHeaders });
                    if (detailResponse.ok) {
                        const details = await detailResponse.json();
                        websiteUri = details.websiteUri || 'N/A';
                        nationalPhoneNumber = details.nationalPhoneNumber || 'N/A';
                        internationalPhoneNumber = details.internationalPhoneNumber || 'N/A';
                    }
                } catch (err) {
                    console.error(`Falha na API Place Details para ${place.id}:`, err);
                }

                const parsed = parseAddressRobust(place.formattedAddress);

                const placeDoc = {
                    place_id: place.id,
                    nome: placeName,
                    endereco_completo: place.formattedAddress,
                    endereco: parsed.address || null,
                    numero: parsed.number || null,
                    complemento: parsed.complement || null,
                    bairro: parsed.bairro || search.bairro || null,
                    cidade: parsed.city || search.municipio || null,
                    sigla_estado: parsed.state || null,
                    estado: search.estado,
                    cep: parsed.zip_code || null,
                    telefone: nationalPhoneNumber,
                    rating: place.rating || 0,
                    total_avaliacoes: place.userRatingCount || 0,
                    website: websiteUri,
                    tipo: search.atividade,
                    internationalPhoneNumber: internationalPhoneNumber,
                    types: place.types || [],
                    businessStatus: place.businessStatus || 'OPERATIONAL'
                };

                const saveResult = await savePlaceDirectly(placeDoc);
                if (saveResult.success) {
                    engineState.newPlacesCount++;
                    const saveLog = addLog(`[Salvo] "${placeName}" cadastrado com sucesso!`, 'save');
                    sendProgress(io, saveLog);
                } else {
                    const errLog = addLog(`[Erro] Falha ao salvar "${placeName}": ${saveResult.error}`, 'error');
                    sendProgress(io, errLog);
                }
            }

            if (nextPageToken && pageCount < maxPages && !engineState.stopRequested && engineState.status === 'searching') {
                const queryDelay = engineState.delayBetweenQueries;
                const pageWaitLog = addLog(`[Aguardando] Esperando ${queryDelay / 1000}s antes de carregar a próxima página...`, 'wait');
                sendProgress(io, pageWaitLog);
                await new Promise(resolve => setTimeout(resolve, queryDelay));
            }

        } while (nextPageToken && pageCount < maxPages && !engineState.stopRequested && engineState.status === 'searching');

        if (!engineState.stopRequested && engineState.status === 'searching') {
            engineState.processedCount++;
            engineState.currentIndex++;
            
            const searchEndLog = addLog(`[Busca] Finalizada: "${search.busca}". Encontrados ${placesFoundInSearch} novos locais.`, 'query-success');
            sendProgress(io, searchEndLog);

            const queryDelay = engineState.delayBetweenQueries;
            const nextQueryLog = addLog(`[Aguardando] Esperando ${queryDelay / 1000}s para a próxima busca...`, 'wait');
            sendProgress(io, nextQueryLog);

            engineState.currentTimeout = setTimeout(() => {
                runSearchLoop(io);
            }, queryDelay);
        }

    } catch (error) {
        console.error('Erro no loop do motor de busca:', error);
        
        engineState.processedCount++;
        engineState.currentIndex++;
        
        const errLog = addLog(`[Erro] Falha ao rodar busca "${search.busca}": ${error.message}`, 'error');
        sendProgress(io, errLog);
        
        const queryDelay = engineState.delayBetweenQueries;
        engineState.currentTimeout = setTimeout(() => {
            runSearchLoop(io);
        }, queryDelay);
    }
}

// Funções expostas do Motor de Busca
async function start(config, io) {
    if (engineState.status === 'searching') {
        return { success: false, error: 'O motor de busca já está em execução.' };
    }

    if (engineState.status === 'paused') {
        return resume(io);
    }

    try {
        engineState.status = 'searching';
        engineState.stopRequested = false;
        engineState.newPlacesCount = 0;
        engineState.processedCount = 0;
        engineState.currentIndex = 0;
        engineState.logs = [];

        engineState.delayBetweenPlaces = (parseFloat(config.delayBetweenPlaces) || 2) * 1000;
        engineState.delayBetweenQueries = (parseFloat(config.delayBetweenQueries) || 4) * 1000;

        addLog('[Sistema] Configurando fila de busca na memória...', 'system');
        
        const queries = [];
        const configQueries = config.queries || [];

        for (const q of configQueries) {
            if (q.neighborhood) {
                queries.push({
                    busca: `${q.term} em ${q.neighborhood} ${q.city}-${q.state}`,
                    atividade: q.term,
                    estado: q.state,
                    municipio: q.city,
                    bairro: q.neighborhood
                });
            } else {
                queries.push({
                    busca: `${q.term} em ${q.city}-${q.state}`,
                    atividade: q.term,
                    estado: q.state,
                    municipio: q.city,
                    bairro: null
                });
            }
        }

        engineState.queries = queries;
        engineState.totalPending = queries.length;

        const setupLog = addLog(`[Sistema] ${queries.length} buscas na fila de memória prontas para iniciar.`, 'system');
        sendProgress(io, setupLog);

        runSearchLoop(io);
        return { success: true };
    } catch (e) {
        engineState.status = 'idle';
        console.error('Erro ao iniciar o motor:', e);
        return { success: false, error: e.message };
    }
}

function pause() {
    if (engineState.status !== 'searching') {
        return { success: false, error: 'O motor não está em execução.' };
    }
    
    engineState.status = 'paused';
    if (engineState.currentTimeout) {
        clearTimeout(engineState.currentTimeout);
        engineState.currentTimeout = null;
    }
    return { success: true };
}

function resume(io) {
    if (engineState.status !== 'paused') {
        return { success: false, error: 'O motor não está pausado.' };
    }

    engineState.status = 'searching';
    const log = addLog('[Sistema] Retomando buscas da fila...', 'system');
    sendProgress(io, log);
    
    runSearchLoop(io);
    return { success: true };
}

function stop() {
    engineState.status = 'idle';
    engineState.stopRequested = true;
    engineState.activeSearch = null;
    
    if (engineState.currentTimeout) {
        clearTimeout(engineState.currentTimeout);
        engineState.currentTimeout = null;
    }
    return { success: true };
}

function getStatus() {
    return {
        status: engineState.status,
        totalPending: engineState.totalPending,
        processedCount: engineState.processedCount,
        newPlacesCount: engineState.newPlacesCount,
        activeSearch: engineState.activeSearch ? engineState.activeSearch.busca : null,
        logs: engineState.logs
    };
}

module.exports = {
    start,
    pause,
    resume,
    stop,
    getStatus
};

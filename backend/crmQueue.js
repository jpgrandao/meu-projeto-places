const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getPlaceById, updateImportedStatus } = require('./database/mongodb');

const queue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || queue.length === 0) {
        return;
    }

    isProcessing = true;

    while (queue.length > 0) {
        const placeId = queue[0];

        try {
            console.log(`Processando fila CRM para place_id: ${placeId}`);
            const place = await getPlaceById(placeId);

            if (!place) {
                console.error(`Local não encontrado no banco de dados para place_id: ${placeId}`);
                queue.shift();
                continue;
            }

            // Format internationalPhoneNumber
            let contactId = "";
            if (place.internationalPhoneNumber) {
                // Remove spaces and special characters
                contactId = place.internationalPhoneNumber.replace(/\D/g, ''); 
            }

            if (!contactId) {
                console.error(`Local sem telefone válido para ID de contato: ${place.nome}`);
                queue.shift();
                continue;
            }

            const payload = {
                "channel": {
                    "type": process.env.CRM_CHANNEL_TYPE || "WHATSAPP",
                    "id": process.env.CRM_CHANNEL_ID || "554888283608"
                },
                "contact": {
                    "ignoreBot": false,
                    "ignoreLead": true,
                    "lead": true,
                    "fields": [
                        {
                            "name": "campanha",
                            "value": "Google Maps"
                        },
                        {
                            "name": "cidade",
                            "value": place.cidade || ""
                        },
                        {
                            "name": "estado",
                            "value": place.sigla_estado || ""
                        },
                        {
                            "name": "qualificaoGoogle",
                            "value": place.rating ? place.rating.toString() : ""
                        },
                        {
                            "name": "cep",
                            "value": place.cep || ""
                        },
                        {
                            "name": "totalAvaliaes",
                            "value": place.total_avaliacoes ? place.total_avaliacoes.toString() : ""
                        },
                        {
                            "name": "website",
                            "value": place.website && place.website !== 'N/A' ? place.website : ""
                        }
                    ],
                    "name": place.nome || "",
                    "id": contactId
                }
            };

            const response = await fetch("https://api.mz-wlpartners.com/v2/contacts", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "client-token": process.env.CRM_CLIENT_TOKEN,
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            let data = null;
            try {
                data = await response.json();
            } catch (e) {
                data = await response.text();
            }
            
            if (!response.ok) {
                console.error(`Erro ao enviar ${place.nome} para CRM (${response.status}):`, data);
            } else {
                console.log(`Sucesso ao enviar contato para CRM: ${place.nome}`);

                // 1. Criar Atendimento (Ticket)
                const ticketPayload = {
                    "channel": {
                        "type": process.env.CRM_CHANNEL_TYPE || "WHATSAPP",
                        "id": process.env.CRM_CHANNEL_ID || "554888283608"
                    },
                    "contact": {
                        "id": contactId,
                        "name": place.nome || ""
                    },
                    "department": {
                        "uuid": process.env.CRM_DEPARTMENT_UUID
                    },
                    "agent": {
                        "uuid": process.env.CRM_AGENT_UUID
                    }
                };

                const ticketResponse = await fetch("https://api.mz-wlpartners.com/v2/tickets", {
                    method: "POST",
                    headers: {
                        "accept": "application/json",
                        "client-token": process.env.CRM_CLIENT_TOKEN,
                        "content-type": "application/json"
                    },
                    body: JSON.stringify(ticketPayload)
                });

                let ticketData = null;
                try {
                    ticketData = await ticketResponse.json();
                } catch (e) {
                    ticketData = await ticketResponse.text();
                }

                if (!ticketResponse.ok) {
                    console.error(`Erro ao criar atendimento para ${place.nome} (${ticketResponse.status}):`, ticketData);
                } else {
                    const ticketUuid = ticketData.uuid;
                    console.log(`Sucesso ao criar atendimento para ${place.nome} (UUID: ${ticketUuid})`);

                    // 2. Associar TAG ao Atendimento
                    const tagPayload = [
                        {
                            "uuid": process.env.CRM_TAG_UUID
                        }
                    ];

                    const tagResponse = await fetch(`https://api.mz-wlpartners.com/v2/tickets/${ticketUuid}/tags`, {
                        method: "POST",
                        headers: {
                            "accept": "application/json",
                            "client-token": process.env.CRM_CLIENT_TOKEN,
                            "content-type": "application/json"
                        },
                        body: JSON.stringify(tagPayload)
                    });

                    let tagData = null;
                    try {
                        tagData = await tagResponse.json();
                    } catch (e) {
                        tagData = await tagResponse.text();
                    }

                    if (!tagResponse.ok) {
                        console.error(`Erro ao associar TAG ao atendimento ${ticketUuid} (${tagResponse.status}):`, tagData);
                    } else {
                        console.log(`Sucesso ao associar TAG ao atendimento ${ticketUuid}`);
                    }
                }
            }

        } catch (error) {
            console.error(`Erro inesperado ao processar place_id ${placeId} na fila CRM:`, error);
        }

        // Remove from queue after processing (success or failure)
        queue.shift();
        
        // Wait 1 second before processing the next item to avoid rate limit issues
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    isProcessing = false;
}

function addToCRMQueue(placeId) {
    if (!queue.includes(placeId)) {
        queue.push(placeId);
        console.log(`Adicionado à fila do CRM: ${placeId}. Tamanho da fila: ${queue.length}`);
        processQueue(); // Start processing if not already running
    } else {
        console.log(`Place ID ${placeId} já está na fila do CRM.`);
    }
}

module.exports = { addToCRMQueue };

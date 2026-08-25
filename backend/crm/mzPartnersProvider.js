const CRMProviderInterface = require('./crmProviderInterface');

class MzPartnersCRMProvider extends CRMProviderInterface {
    async sendContact(place, config) {
        let contactId = "";
        if (place.internationalPhoneNumber) {
            contactId = place.internationalPhoneNumber.replace(/\D/g, ''); 
        }

        if (!contactId) {
            return { success: false, error: `Local "${place.nome}" não possui número de telefone válido.` };
        }

        const clientToken = config.client_token || process.env.CRM_CLIENT_TOKEN;
        const channelType = config.channel_type || process.env.CRM_CHANNEL_TYPE || "WHATSAPP";
        const channelId = config.channel_id || process.env.CRM_CHANNEL_ID || "554888283608";

        if (!clientToken) {
            return { success: false, error: 'Token do cliente CRM (client_token) não configurado para esta empresa.' };
        }

        const payload = {
            "channel": {
                "type": channelType,
                "id": channelId
            },
            "contact": {
                "ignoreBot": false,
                "ignoreLead": true,
                "lead": true,
                "fields": [
                    { "name": "campanha", "value": "Google Maps" },
                    { "name": "cidade", "value": place.cidade || "" },
                    { "name": "estado", "value": place.sigla_estado || "" },
                    { "name": "qualificaoGoogle", "value": place.rating ? place.rating.toString() : "" },
                    { "name": "cep", "value": place.cep || "" },
                    { "name": "totalAvaliaes", "value": place.total_avaliacoes ? place.total_avaliacoes.toString() : "" },
                    { "name": "website", "value": place.website && place.website !== 'N/A' ? place.website : "" }
                ],
                "name": place.nome || "",
                "id": contactId
            }
        };

        try {
            const response = await fetch("https://api.mz-wlpartners.com/v2/contacts", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "client-token": clientToken,
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            let data = null;
            try { data = await response.json(); } catch (e) { data = await response.text(); }

            if (!response.ok) {
                return { success: false, error: `Erro API MZ (${response.status}): ${typeof data === 'object' ? JSON.stringify(data) : data}` };
            }

            return { success: true, contactId };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async createTicket(place, contactId, config) {
        const clientToken = config.client_token || process.env.CRM_CLIENT_TOKEN;
        const channelType = config.channel_type || process.env.CRM_CHANNEL_TYPE || "WHATSAPP";
        const channelId = config.channel_id || process.env.CRM_CHANNEL_ID || "554888283608";
        const departmentUuid = config.department_uuid || process.env.CRM_DEPARTMENT_UUID;
        const agentUuid = config.agent_uuid || process.env.CRM_AGENT_UUID;

        const payload = {
            "channel": {
                "type": channelType,
                "id": channelId
            },
            "contact": {
                "id": contactId,
                "name": place.nome || ""
            },
            "department": {
                "uuid": departmentUuid
            },
            "agent": {
                "uuid": agentUuid
            }
        };

        try {
            const response = await fetch("https://api.mz-wlpartners.com/v2/tickets", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "client-token": clientToken,
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            let data = null;
            try { data = await response.json(); } catch (e) { data = await response.text(); }

            if (!response.ok) {
                return { success: false, error: `Erro ao criar atendimento (${response.status}): ${typeof data === 'object' ? JSON.stringify(data) : data}` };
            }

            return { success: true, ticketUuid: data.uuid };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async addTag(ticketUuid, config) {
        const clientToken = config.client_token || process.env.CRM_CLIENT_TOKEN;
        const tagUuid = config.tag_uuid || process.env.CRM_TAG_UUID;

        if (!tagUuid) {
            return { success: true }; // Se não configurada tag UUID, ignora associação
        }

        const payload = [{ "uuid": tagUuid }];

        try {
            const response = await fetch(`https://api.mz-wlpartners.com/v2/tickets/${ticketUuid}/tags`, {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "client-token": clientToken,
                    "content-type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return { success: false, error: `Erro ao associar tag (${response.status}): ${JSON.stringify(data)}` };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

module.exports = MzPartnersCRMProvider;

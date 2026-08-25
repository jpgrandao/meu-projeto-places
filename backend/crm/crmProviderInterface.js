/**
 * Interface base para provedores de CRM
 */
class CRMProviderInterface {
    /**
     * Envia os dados do contato para o CRM
     * @param {Object} place - Objeto do local
     * @param {Object} config - Configurações do CRM da empresa
     * @returns {Promise<{ success: boolean, contactId?: string, error?: string }>}
     */
    async sendContact(place, config) {
        throw new Error('Método sendContact() não implementado.');
    }

    /**
     * Cria um atendimento (ticket) para o contato no CRM
     * @param {Object} place - Objeto do local
     * @param {string} contactId - ID do contato criado
     * @param {Object} config - Configurações do CRM da empresa
     * @returns {Promise<{ success: boolean, ticketUuid?: string, error?: string }>}
     */
    async createTicket(place, contactId, config) {
        throw new Error('Método createTicket() não implementado.');
    }

    /**
     * Associa uma Tag ao ticket no CRM
     * @param {string} ticketUuid - UUID do ticket
     * @param {Object} config - Configurações do CRM da empresa
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async addTag(ticketUuid, config) {
        throw new Error('Método addTag() não implementado.');
    }
}

module.exports = CRMProviderInterface;

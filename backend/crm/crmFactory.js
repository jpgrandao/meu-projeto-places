const MzPartnersCRMProvider = require('./mzPartnersProvider');

class CRMFactory {
    /**
     * Retorna a instância do provedor de CRM apropriado
     * @param {string} providerName 
     * @returns {CRMProviderInterface}
     */
    static getProvider(providerName = 'mz_partners') {
        switch (providerName) {
            case 'mz_partners':
            default:
                return new MzPartnersCRMProvider();
        }
    }
}

module.exports = CRMFactory;

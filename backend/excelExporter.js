const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { getPlaces, markPlacesAsExcelExported } = require('./database/mongodb');

const DOWNLOADS_DIR = path.join(__dirname, '../frontend/downloads');

// Garante que o diretório de downloads exista
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

/**
 * Gera um arquivo Excel (.xlsx) contendo até 50.000 locais
 * @param {Object} filters - Filtros de busca
 * @param {string|Array} placeIds - IDs selecionados (opcional)
 * @param {string} companyId - ID da empresa
 * @param {Function} progressCallback - Callback de progresso
 * @returns {Promise<{ success: boolean, fileUrl?: string, totalCount?: number, error?: string }>}
 */
async function generateExcelExport(filters = {}, placeIds = [], companyId, progressCallback = null) {
    try {
        const queryFilters = { ...filters };
        if (Array.isArray(placeIds) && placeIds.length > 0) {
            queryFilters.ids = placeIds;
        }

        // Busca os locais com limite de 50.000
        queryFilters.page = 1;
        queryFilters.limit = 50000;

        const { data: places, total } = await getPlaces(queryFilters, companyId);

        if (!places || places.length === 0) {
            return { success: false, error: 'Nenhum local encontrado para exportar.' };
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Gerenciador de Places';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Locais Exportados');

        // Configuração das colunas
        worksheet.columns = [
            { header: 'Nome do Local', key: 'nome', width: 35 },
            { header: 'Tipo / Categoria', key: 'tipo', width: 25 },
            { header: 'Telefone', key: 'telefone', width: 18 },
            { header: 'Telefone Internacional', key: 'internationalPhoneNumber', width: 22 },
            { header: 'Endereço Completo', key: 'endereco_completo', width: 45 },
            { header: 'Cidade', key: 'cidade', width: 20 },
            { header: 'Estado', key: 'sigla_estado', width: 8 },
            { header: 'Bairro', key: 'bairro', width: 20 },
            { header: 'Avaliação (Rating)', key: 'rating', width: 16 },
            { header: 'Total Avaliações', key: 'total_avaliacoes', width: 16 },
            { header: 'Status Operacional', key: 'businessStatus', width: 20 },
            { header: 'Website', key: 'website', width: 35 },
            { header: 'Enviado CRM?', key: 'crm_exported', width: 14 },
            { header: 'Data de Cadastro', key: 'created_at', width: 20 }
        ];

        // Estilização do cabeçalho
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E3A8A' } // Azul escuro
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // Adiciona linhas
        const exportedPlaceIds = [];
        for (let i = 0; i < places.length; i++) {
            const place = places[i];
            exportedPlaceIds.push(place.place_id);

            const crmStatus = (place.importado || place.crm_exported) ? 'Sim' : 'Não';
            const createdAtStr = place.created_at ? new Date(place.created_at).toLocaleDateString('pt-BR') : 'N/A';

            worksheet.addRow({
                nome: place.nome || '',
                tipo: place.tipo || '',
                telefone: place.telefone || '',
                internationalPhoneNumber: place.internationalPhoneNumber || '',
                endereco_completo: place.endereco_completo || '',
                cidade: place.cidade || '',
                sigla_estado: place.sigla_estado || '',
                bairro: place.bairro || '',
                rating: place.rating || 0,
                total_avaliacoes: place.total_avaliacoes || 0,
                businessStatus: place.businessStatus || '',
                website: (place.website && place.website !== 'N/A') ? place.website : '',
                crm_exported: crmStatus,
                created_at: createdAtStr
            });

            if (progressCallback && (i % 100 === 0 || i === places.length - 1)) {
                progressCallback(i + 1, places.length);
            }
        }

        // Nome do arquivo com timestamp
        const fileName = `export_places_${companyId}_${Date.now()}.xlsx`;
        const filePath = path.join(DOWNLOADS_DIR, fileName);

        await workbook.xlsx.writeFile(filePath);

        // Marca os locais no banco de dados como exportados para Excel
        await markPlacesAsExcelExported(exportedPlaceIds, companyId);

        const fileUrl = `/downloads/${fileName}`;
        return {
            success: true,
            fileUrl,
            fileName,
            totalCount: places.length
        };
    } catch (error) {
        console.error('Erro na geração do arquivo Excel:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove arquivos de exportação com mais de 30 dias
 */
function cleanOldExportFiles() {
    try {
        if (!fs.existsSync(DOWNLOADS_DIR)) return;

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        files.forEach(file => {
            if (file.endsWith('.xlsx')) {
                const filePath = path.join(DOWNLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs < thirtyDaysAgo) {
                    fs.unlinkSync(filePath);
                    console.log(`[CLEANUP] Arquivo antigo removido: ${file}`);
                }
            }
        });
    } catch (error) {
        console.error('Erro na limpeza automática de arquivos Excel antigos:', error);
    }
}

module.exports = {
    generateExcelExport,
    cleanOldExportFiles
};

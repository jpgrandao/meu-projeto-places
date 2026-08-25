const { createExportJob, updateExportJob, getLatestExportJob, getCompanyById, getPlaces, updateImportedStatus } = require('./database/mongodb');
const { generateExcelExport } = require('./excelExporter');
const CRMFactory = require('./crm/crmFactory');

// Estado em memória das filas ativas por empresa
const activeCompanyJobs = new Map(); // companyId => jobId

const COOLDOWN_TIME_MS = 3 * 60 * 1000; // 3 minutos

/**
 * Obtém o Socket.io a partir da instância app
 */
function getSocketIo(app) {
    if (app && app.get) {
        return app.get('io');
    }
    return null;
}

/**
 * Verifica se a empresa está em tempo de cooldown (3 minutos)
 * @param {string} companyId 
 * @returns {Promise<{ isCooldown: boolean, remainingSeconds: number, cooldownUntil?: Date }>}
 */
async function checkCompanyCooldown(companyId) {
    const latestJob = await getLatestExportJob(companyId);
    if (!latestJob || !latestJob.cooldown_until) {
        return { isCooldown: false, remainingSeconds: 0 };
    }

    const cooldownUntil = new Date(latestJob.cooldown_until);
    const now = new Date();

    if (cooldownUntil > now) {
        const remainingSeconds = Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000);
        return { isCooldown: true, remainingSeconds, cooldownUntil };
    }

    return { isCooldown: false, remainingSeconds: 0 };
}

/**
 * Inicia a exportação para Excel com controle de fila e cooldown
 */
async function startExcelExportJob(filters, placeIds, companyId, app) {
    const io = getSocketIo(app);

    // 1. Verifica se a empresa tem exportação em andamento
    if (activeCompanyJobs.has(companyId)) {
        return { success: false, error: 'Já existe uma exportação em andamento para esta empresa. Por favor, aguarde.' };
    }

    // 2. Verifica se a empresa tem permissão para exportar Excel
    const company = await getCompanyById(companyId);
    if (company && company.allow_excel_export === false) {
        return { success: false, error: 'Sua empresa não possui permissão para exportar dados para o Excel.' };
    }

    // 3. Verifica regra de Cooldown de 3 minutos
    const cooldownCheck = await checkCompanyCooldown(companyId);
    if (cooldownCheck.isCooldown) {
        return {
            success: false,
            error: `Aguarde o tempo de descanso entre exportações. Tente novamente em ${cooldownCheck.remainingSeconds} segundos.`,
            isCooldown: true,
            remainingSeconds: cooldownCheck.remainingSeconds
        };
    }

    // 4. Cria o registro do Job
    const jobResult = await createExportJob({
        company_id: companyId,
        type: 'excel',
        filters,
        place_ids: placeIds
    });

    if (!jobResult.success) {
        return { success: false, error: jobResult.error };
    }

    const jobId = jobResult.id;
    activeCompanyJobs.set(companyId, jobId);
    await updateExportJob(jobId, { status: 'processing' });

    // Processamento Assíncrono (Background)
    (async () => {
        try {
            const result = await generateExcelExport(filters, placeIds, companyId, (processed, total) => {
                updateExportJob(jobId, { processed_items: processed, total_items: total });
                if (io) {
                    io.emit(`export-progress-${companyId}`, {
                        jobId,
                        type: 'excel',
                        status: 'processing',
                        processed,
                        total
                    });
                }
            });

            const now = new Date();
            const cooldownUntil = new Date(now.getTime() + COOLDOWN_TIME_MS);

            if (result.success) {
                await updateExportJob(jobId, {
                    status: 'completed',
                    file_url: result.fileUrl,
                    file_path: result.fileName,
                    total_items: result.totalCount,
                    processed_items: result.totalCount,
                    finished_at: now,
                    cooldown_until: cooldownUntil
                });

                if (io) {
                    io.emit(`export-finished-${companyId}`, {
                        jobId,
                        type: 'excel',
                        status: 'completed',
                        fileUrl: result.fileUrl,
                        total: result.totalCount,
                        cooldownUntil
                    });
                }
            } else {
                await updateExportJob(jobId, {
                    status: 'failed',
                    error_message: result.error,
                    finished_at: now,
                    cooldown_until: cooldownUntil
                });

                if (io) {
                    io.emit(`export-error-${companyId}`, {
                        jobId,
                        type: 'excel',
                        error: result.error
                    });
                }
            }
        } catch (err) {
            console.error('Erro ao processar job de Excel:', err);
            const now = new Date();
            const cooldownUntil = new Date(now.getTime() + COOLDOWN_TIME_MS);

            await updateExportJob(jobId, {
                status: 'failed',
                error_message: err.message,
                finished_at: now,
                cooldown_until: cooldownUntil
            });

            if (io) {
                io.emit(`export-error-${companyId}`, {
                    jobId,
                    type: 'excel',
                    error: err.message
                });
            }
        } finally {
            activeCompanyJobs.delete(companyId);
        }
    })();

    return {
        success: true,
        message: 'Exportação para Excel iniciada com sucesso.',
        jobId
    };
}

/**
 * Inicia o envio em lote para o CRM com controle de fila e cooldown
 */
async function startCRMExportJob(filters, placeIds, companyId, app) {
    const io = getSocketIo(app);

    // 1. Verifica se a empresa tem exportação em andamento
    if (activeCompanyJobs.has(companyId)) {
        return { success: false, error: 'Já existe uma exportação ou envio em andamento para esta empresa. Aguarde.' };
    }

    // 2. Verifica se a empresa tem o CRM ativado e obtém configurações
    const company = await getCompanyById(companyId);
    if (!company || !company.crm_enabled) {
        return { success: false, error: 'A integração com o CRM não está ativada para esta empresa.' };
    }

    // 3. Verifica regra de Cooldown de 3 minutos
    const cooldownCheck = await checkCompanyCooldown(companyId);
    if (cooldownCheck.isCooldown) {
        return {
            success: false,
            error: `Aguarde o tempo de descanso entre envios. Tente novamente em ${cooldownCheck.remainingSeconds} segundos.`,
            isCooldown: true,
            remainingSeconds: cooldownCheck.remainingSeconds
        };
    }

    // 4. Busca os locais a serem enviados
    const queryFilters = { ...filters };
    if (Array.isArray(placeIds) && placeIds.length > 0) {
        queryFilters.ids = placeIds;
    }
    queryFilters.page = 1;
    queryFilters.limit = 50000;

    const { data: places } = await getPlaces(queryFilters, companyId);
    if (!places || places.length === 0) {
        return { success: false, error: 'Nenhum local encontrado para envio ao CRM.' };
    }

    // 5. Cria o registro do Job
    const jobResult = await createExportJob({
        company_id: companyId,
        type: 'crm',
        total_items: places.length,
        filters,
        place_ids: placeIds
    });

    if (!jobResult.success) {
        return { success: false, error: jobResult.error };
    }

    const jobId = jobResult.id;
    activeCompanyJobs.set(companyId, jobId);
    await updateExportJob(jobId, { status: 'processing' });

    // Processamento Assíncrono do envio ao CRM
    (async () => {
        try {
            const provider = CRMFactory.getProvider(company.crm_provider || 'mz_partners');
            const crmConfig = company.crm_config || {};

            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < places.length; i++) {
                const place = places[i];

                const contactRes = await provider.sendContact(place, crmConfig);
                if (contactRes.success && contactRes.contactId) {
                    const ticketRes = await provider.createTicket(place, contactRes.contactId, crmConfig);
                    if (ticketRes.success && ticketRes.ticketUuid) {
                        await provider.addTag(ticketRes.ticketUuid, crmConfig);
                    }
                    await updateImportedStatus(place.place_id, true, companyId);
                    successCount++;
                } else {
                    failureCount++;
                }

                await updateExportJob(jobId, { processed_items: i + 1 });

                if (io && (i % 10 === 0 || i === places.length - 1)) {
                    io.emit(`export-progress-${companyId}`, {
                        jobId,
                        type: 'crm',
                        status: 'processing',
                        processed: i + 1,
                        total: places.length
                    });
                }
            }

            const now = new Date();
            const cooldownUntil = new Date(now.getTime() + COOLDOWN_TIME_MS);

            await updateExportJob(jobId, {
                status: 'completed',
                total_items: places.length,
                processed_items: places.length,
                finished_at: now,
                cooldown_until: cooldownUntil
            });

            if (io) {
                io.emit(`export-finished-${companyId}`, {
                    jobId,
                    type: 'crm',
                    status: 'completed',
                    total: places.length,
                    successCount,
                    failureCount,
                    cooldownUntil
                });
            }
        } catch (err) {
            console.error('Erro ao processar envio ao CRM:', err);
            const now = new Date();
            const cooldownUntil = new Date(now.getTime() + COOLDOWN_TIME_MS);

            await updateExportJob(jobId, {
                status: 'failed',
                error_message: err.message,
                finished_at: now,
                cooldown_until: cooldownUntil
            });

            if (io) {
                io.emit(`export-error-${companyId}`, {
                    jobId,
                    type: 'crm',
                    error: err.message
                });
            }
        } finally {
            activeCompanyJobs.delete(companyId);
        }
    })();

    return {
        success: true,
        message: 'Envio ao CRM iniciado com sucesso.',
        jobId
    };
}

module.exports = {
    checkCompanyCooldown,
    startExcelExportJob,
    startCRMExportJob
};

const btnSearch = document.getElementById('btnSearch');
const btnClear = document.getElementById('btnClear');
const placesGrid = document.getElementById('placesGrid');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageIndicator = document.getElementById('pageIndicator');
const filterLimit = document.getElementById('filterLimit');

let currentPage = 1;
let totalResults = 0;
let selectedPlaceIds = new Set();
let cachedCompanyTags = [];
let activeCompanyConfig = { crm_enabled: false, allow_excel_export: true };

function updateCompanyFeaturesUI() {
    const btnBulkCRM = document.getElementById('btnBulkCRM');
    const filterCrmStatusGroup = document.getElementById('filterCrmStatusGroup');
    const btnBulkExcel = document.getElementById('btnBulkExcel');
    const filterExcelStatusGroup = document.getElementById('filterExcelStatusGroup');

    const crmActive = !!activeCompanyConfig.crm_enabled;
    const excelActive = activeCompanyConfig.allow_excel_export !== false;

    if (btnBulkCRM) btnBulkCRM.classList.toggle('hidden', !crmActive);
    if (filterCrmStatusGroup) filterCrmStatusGroup.classList.toggle('hidden', !crmActive);

    if (btnBulkExcel) btnBulkExcel.classList.toggle('hidden', !excelActive);
    if (filterExcelStatusGroup) filterExcelStatusGroup.classList.toggle('hidden', !excelActive);
}

// --- LOCAIS (PLACES) E FILTROS ---

async function loadPlaces(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 1;
        selectedPlaceIds.clear();
        updateSelectedCount();
    }

    const limit = parseInt(filterLimit.value) || 50;

    // Obtém tags selecionadas no filtro
    const filterTagsSelect = document.getElementById('filterTags');
    const selectedTags = filterTagsSelect ? Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value) : [];

    const filters = {
        nome: document.getElementById('filterNome').value,
        tipo: document.getElementById('filterTipo').value,
        cidade: document.getElementById('filterCidade').value,
        bairro: document.getElementById('filterBairro').value,
        crmStatus: document.getElementById('filterCrmStatus') ? document.getElementById('filterCrmStatus').value : '',
        excelStatus: document.getElementById('filterExcelStatus') ? document.getElementById('filterExcelStatus').value : '',
        tags: selectedTags,
        ratingMin: document.getElementById('filterRatingMin').value,
        ratingMax: document.getElementById('filterRatingMax').value,
        totalAvaliacoesMin: document.getElementById('filterTotalMin').value,
        totalAvaliacoesMax: document.getElementById('filterTotalMax').value,
        businessStatus: document.getElementById('filterStatus').value,
        page: currentPage,
        limit: limit
    };

    const response = await window.api.getPlaces(filters);
    const places = response.data || [];
    totalResults = response.total || 0;

    placesGrid.innerHTML = '';

    const chkSelectAll = document.getElementById('chkSelectAll');
    if (chkSelectAll) chkSelectAll.checked = false;

    if (places.length === 0) {
        placesGrid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1 / -1; padding: 2rem;">Nenhum local encontrado para os filtros selecionados.</p>';
        updatePagination(limit);
        return;
    }

    places.forEach(place => {
        const hasValidWebsite = place.website && place.website !== 'N/A';
        const isOperational = place.businessStatus === 'OPERATIONAL';
        const isClosed = place.businessStatus && place.businessStatus.includes('CLOSED');
        
        let statusClass = 'status-other';
        if (isOperational) statusClass = 'status-operational';
        if (isClosed) statusClass = 'status-closed';
        
        const formattedStatus = place.businessStatus ? place.businessStatus.replace(/_/g, ' ') : 'N/A';
        
        const isCrmExported = place.crm_exported || place.importado;
        const isExcelExported = place.excel_exported;
        const isChecked = selectedPlaceIds.has(place.place_id) ? 'checked' : '';

        // Renderiza pílulas de tags do local
        let tagsHtml = '';
        if (place.tags && Array.isArray(place.tags) && place.tags.length > 0 && cachedCompanyTags.length > 0) {
            tagsHtml = '<div class="place-tags-list">';
            place.tags.forEach(tId => {
                const tagObj = cachedCompanyTags.find(t => t._id === tId || t._id === tId._id);
                if (tagObj) {
                    tagsHtml += `<span class="tag-pill" style="background: ${tagObj.color || '#3b82f6'};">🏷️ ${tagObj.name}</span>`;
                }
            });
            tagsHtml += '</div>';
        }

        let crmBadgeHtml = '';
        if (activeCompanyConfig.crm_enabled) {
            crmBadgeHtml = `<span class="badge-status-pill ${isCrmExported ? 'badge-status-active' : 'badge-status-inactive'}" title="${isCrmExported ? 'Enviado para o CRM' : 'Não enviado ao CRM'}">
                ${isCrmExported ? '🟢 CRM' : '⚪ CRM'}
            </span>`;
        }

        let excelBadgeHtml = '';
        if (activeCompanyConfig.allow_excel_export !== false) {
            excelBadgeHtml = `<span class="badge-status-pill ${isExcelExported ? 'badge-status-active' : 'badge-status-inactive'}" title="${isExcelExported ? 'Exportado para Excel' : 'Não exportado para Excel'}">
                ${isExcelExported ? '🟢 Excel' : '⚪ Excel'}
            </span>`;
        }

        const card = `
            <div class="place-card" data-place-id="${place.place_id}">
                <div class="place-card-top-row">
                    <input type="checkbox" class="chk-place-select" data-place-id="${place.place_id}" ${isChecked}>
                    <div style="flex: 1;">
                        <div class="card-header" style="margin-bottom: 0;">
                            <div class="card-header-left">
                                <h3 class="card-title">${place.nome || 'Sem Nome'}</h3>
                                <span class="card-type">${place.tipo || 'N/A'}</span>
                            </div>
                            <div class="card-rating-wrapper">
                                <div class="card-rating">
                                    ⭐ ${place.rating || 'N/A'}
                                </div>
                                <span class="rating-count">(${place.total_avaliacoes || 0} avaliações)</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-icon">📍</span>
                        <span>${place.endereco_completo || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">📞</span>
                        <span>${place.telefone || 'N/A'}</span>
                    </div>
                    ${tagsHtml}
                    ${hasValidWebsite ? `
                    <div class="website-container">
                        <a href="${place.website}" target="_blank" class="website-link">Visitar Site ↗</a>
                    </div>` : ''}
                </div>

                <div class="card-footer">
                    <span class="status-badge ${statusClass}">${formattedStatus}</span>
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        ${crmBadgeHtml}
                        ${excelBadgeHtml}
                    </div>
                    <button class="btn-update" data-place-id="${place.place_id}" title="Atualizar dados do Google Maps" style="margin-left: auto; margin-right: 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-refresh"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.58 5.58"/></svg>
                    </button>
                </div>
            </div>
        `;
        placesGrid.insertAdjacentHTML('beforeend', card);
    });

    // Listeners das seleções individuais
    document.querySelectorAll('.chk-place-select').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const pId = e.target.getAttribute('data-place-id');
            if (e.target.checked) {
                selectedPlaceIds.add(pId);
            } else {
                selectedPlaceIds.delete(pId);
            }
            updateSelectedCount();
        });
    });

    updatePagination(limit);
}

function updateSelectedCount() {
    const badge = document.getElementById('selectedCountBadge');
    if (badge) {
        badge.textContent = `${selectedPlaceIds.size} selecionados`;
    }
}

function updatePagination(limit) {
    pageIndicator.textContent = `Página ${currentPage} (Total: ${totalResults})`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = (currentPage * limit) >= totalResults;
}

function clearFilters() {
    document.getElementById('filterNome').value = '';
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterCidade').value = '';
    document.getElementById('filterBairro').value = '';
    if (document.getElementById('filterCrmStatus')) document.getElementById('filterCrmStatus').value = '';
    if (document.getElementById('filterExcelStatus')) document.getElementById('filterExcelStatus').value = '';
    
    const filterTagsSelect = document.getElementById('filterTags');
    if (filterTagsSelect) {
        Array.from(filterTagsSelect.options).forEach(opt => opt.selected = false);
    }

    document.getElementById('filterRatingMin').value = '';
    document.getElementById('filterRatingMax').value = '';
    document.getElementById('filterTotalMin').value = '';
    document.getElementById('filterTotalMax').value = '';
    document.getElementById('filterStatus').value = '';
    filterLimit.value = '50';
    loadPlaces(true);
}

btnSearch.addEventListener('click', () => loadPlaces(true));
btnClear.addEventListener('click', clearFilters);

placesGrid.addEventListener('click', async (e) => {
    const btnUpdate = e.target.closest('.btn-update');
    if (btnUpdate) {
        const placeId = btnUpdate.getAttribute('data-place-id');
        const icon = btnUpdate.querySelector('.icon-refresh');
        
        btnUpdate.disabled = true;
        icon.classList.add('spin');
        
        try {
            const result = await window.api.updatePlace(placeId);
            if (result.success) {
                await loadPlaces();
            } else {
                alert('Erro ao atualizar: ' + result.error);
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro inesperado ao atualizar local.');
        } finally {
            if (btnUpdate) {
                btnUpdate.disabled = false;
                icon.classList.remove('spin');
            }
        }
    }
});

btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        loadPlaces();
    }
});
btnNext.addEventListener('click', () => {
    currentPage++;
    loadPlaces();
});
filterLimit.addEventListener('change', () => loadPlaces(true));

// --- SELEÇÃO EM LOTE E EXPORTAÇÃO ---

const chkSelectAll = document.getElementById('chkSelectAll');
if (chkSelectAll) {
    chkSelectAll.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.chk-place-select').forEach(chk => {
            chk.checked = isChecked;
            const pId = chk.getAttribute('data-place-id');
            if (isChecked) selectedPlaceIds.add(pId);
            else selectedPlaceIds.delete(pId);
        });
        updateSelectedCount();
    });
}

// Botão Exportar Excel (Ação em Lote)
const btnBulkExcel = document.getElementById('btnBulkExcel');
if (btnBulkExcel) {
    btnBulkExcel.addEventListener('click', async () => {
        const placeIds = Array.from(selectedPlaceIds);
        const filters = getActiveFiltersPayload();

        if (placeIds.length === 0 && !confirm(`Deseja exportar todos os ${totalResults} locais correspondentes ao filtro atual para o Excel?`)) {
            return;
        }

        btnBulkExcel.disabled = true;
        showExportProgressBanner('Gerando Arquivo Excel...', 'Preparando solicitação...', true);

        try {
            const res = await window.api.bulkExportExcel(filters, placeIds);
            if (res.success) {
                showExportProgressBanner('Processando Arquivo Excel...', 'Sua exportação está sendo gerada em background.', true);
            } else {
                alert(res.error || 'Erro ao iniciar exportação para Excel.');
                hideExportProgressBanner();
            }
        } catch (err) {
            alert('Erro ao iniciar exportação para Excel: ' + err.message);
            hideExportProgressBanner();
        } finally {
            btnBulkExcel.disabled = false;
        }
    });
}

// Botão Enviar CRM (Ação em Lote)
const btnBulkCRM = document.getElementById('btnBulkCRM');
if (btnBulkCRM) {
    btnBulkCRM.addEventListener('click', async () => {
        const placeIds = Array.from(selectedPlaceIds);
        const filters = getActiveFiltersPayload();

        if (placeIds.length === 0 && !confirm(`Deseja enviar todos os ${totalResults} locais correspondentes ao filtro atual para a fila do CRM?`)) {
            return;
        }

        btnBulkCRM.disabled = true;
        showExportProgressBanner('Enviando para o CRM...', 'Preparando transmissão de contatos...', true);

        try {
            const res = await window.api.bulkExportCRM(filters, placeIds);
            if (res.success) {
                showExportProgressBanner('Enviando para o CRM...', 'Contatos sendo processados em lote.', true);
            } else {
                alert(res.error || 'Erro ao iniciar envio para o CRM.');
                hideExportProgressBanner();
            }
        } catch (err) {
            alert('Erro ao iniciar envio para o CRM: ' + err.message);
            hideExportProgressBanner();
        } finally {
            btnBulkCRM.disabled = false;
        }
    });
}

function getActiveFiltersPayload() {
    const filterTagsSelect = document.getElementById('filterTags');
    const selectedTags = filterTagsSelect ? Array.from(filterTagsSelect.selectedOptions).map(opt => opt.value) : [];

    return {
        nome: document.getElementById('filterNome').value,
        tipo: document.getElementById('filterTipo').value,
        cidade: document.getElementById('filterCidade').value,
        bairro: document.getElementById('filterBairro').value,
        crmStatus: document.getElementById('filterCrmStatus') ? document.getElementById('filterCrmStatus').value : '',
        excelStatus: document.getElementById('filterExcelStatus') ? document.getElementById('filterExcelStatus').value : '',
        tags: selectedTags,
        ratingMin: document.getElementById('filterRatingMin').value,
        ratingMax: document.getElementById('filterRatingMax').value,
        totalAvaliacoesMin: document.getElementById('filterTotalMin').value,
        totalAvaliacoesMax: document.getElementById('filterTotalMax').value,
        businessStatus: document.getElementById('filterStatus').value
    };
}

// --- BANNER DE PROGRESSO DE EXPORTAÇÃO E SOCKET.IO ---

const exportProgressBanner = document.getElementById('exportProgressBanner');
const exportProgressTitle = document.getElementById('exportProgressTitle');
const exportProgressMsg = document.getElementById('exportProgressMsg');
const exportProgressBarContainer = document.getElementById('exportProgressBarContainer');
const exportProgressBar = document.getElementById('exportProgressBar');
const exportDownloadWrapper = document.getElementById('exportDownloadWrapper');
const btnDownloadExport = document.getElementById('btnDownloadExport');

function showExportProgressBanner(title, msg, showProgressBar = true) {
    if (!exportProgressBanner) return;
    exportProgressTitle.textContent = title;
    exportProgressMsg.textContent = msg;
    exportProgressBanner.classList.remove('hidden');

    if (showProgressBar) {
        exportProgressBarContainer.classList.remove('hidden');
        exportProgressBar.style.width = '5%';
    } else {
        exportProgressBarContainer.classList.add('hidden');
    }
    exportDownloadWrapper.classList.add('hidden');
}

function hideExportProgressBanner() {
    if (exportProgressBanner) {
        exportProgressBanner.classList.add('hidden');
    }
}

function setupExportSocketListeners(companyId) {
    window.api.onExportProgress(companyId, (data) => {
        showExportProgressBanner(
            data.type === 'excel' ? 'Gerando Planilha Excel...' : 'Enviando para o CRM...',
            `Processando ${data.processed} de ${data.total} locais...`,
            true
        );
        const pct = Math.round((data.processed / (data.total || 1)) * 100);
        exportProgressBar.style.width = `${pct}%`;
    });

    window.api.onExportFinished(companyId, (data) => {
        exportProgressBar.style.width = '100%';
        if (data.type === 'excel' && data.fileUrl) {
            exportProgressTitle.textContent = '✅ Exportação Concluída com Sucesso!';
            exportProgressMsg.textContent = `Arquivo gerado contendo ${data.total} locais. O link ficará disponível por 30 dias.`;
            btnDownloadExport.href = data.fileUrl;
            exportDownloadWrapper.classList.remove('hidden');
        } else {
            exportProgressTitle.textContent = '✅ Envio ao CRM Concluído!';
            exportProgressMsg.textContent = `Processados ${data.total} locais. (${data.successCount} com sucesso, ${data.failureCount} falhas).`;
        }

        setTimeout(() => {
            loadPlaces();
        }, 1500);
    });

    window.api.onExportError(companyId, (data) => {
        exportProgressTitle.textContent = '❌ Erro no Processamento';
        exportProgressMsg.textContent = data.error || 'Ocorreu um erro durante a exportação.';
        exportProgressBarContainer.classList.add('hidden');
        exportDownloadWrapper.classList.add('hidden');
    });
}

const btnCloseExportBanner = document.getElementById('btnCloseExportBanner');
if (btnCloseExportBanner) {
    btnCloseExportBanner.addEventListener('click', () => {
        const exportProgressBanner = document.getElementById('exportProgressBanner');
        if (exportProgressBanner) {
            exportProgressBanner.classList.add('hidden');
        }
    });
}

// --- GESTÃO DE TAGS (MODAIS & OPERAÇÕES) ---

const btnManageTags = document.getElementById('btnManageTags');
const tagsModal = document.getElementById('tagsModal');
const closeTagsModal = document.getElementById('closeTagsModal');
const btnCloseTagsModal = document.getElementById('btnCloseTagsModal');
const formCreateTag = document.getElementById('formCreateTag');
const tagsListContainer = document.getElementById('tagsListContainer');

async function reloadCompanyTags() {
    try {
        const res = await window.api.getTags();
        cachedCompanyTags = res.data || [];
        populateFilterTagsSelect();
    } catch (e) {
        console.error('Erro ao carregar tags:', e);
    }
}

function populateFilterTagsSelect() {
    const select = document.getElementById('filterTags');
    if (!select) return;

    const currentSelected = Array.from(select.selectedOptions).map(o => o.value);
    select.innerHTML = '';

    cachedCompanyTags.forEach(t => {
        const isSel = currentSelected.includes(t._id) ? 'selected' : '';
        select.insertAdjacentHTML('beforeend', `<option value="${t._id}" ${isSel}>🏷️ ${t.name}</option>`);
    });
}

function openTagsModal() {
    if (!tagsModal) return;
    tagsModal.style.display = 'flex';
    setTimeout(() => { tagsModal.classList.add('show'); }, 10);
    renderTagsManagerList();
}

function hideTagsModal() {
    if (tagsModal) {
        tagsModal.classList.remove('show');
        setTimeout(() => { tagsModal.style.display = 'none'; }, 300);
    }
}

if (btnManageTags) btnManageTags.addEventListener('click', openTagsModal);
if (closeTagsModal) closeTagsModal.addEventListener('click', hideTagsModal);
if (btnCloseTagsModal) btnCloseTagsModal.addEventListener('click', hideTagsModal);

if (formCreateTag) {
    formCreateTag.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('newTagName');
        const colorInput = document.getElementById('newTagColor');

        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!name) return;

        try {
            const res = await window.api.createTag({ name, color });
            if (res.success) {
                nameInput.value = '';
                await reloadCompanyTags();
                renderTagsManagerList();
                if (document.querySelector('.tab-content.active-content')?.id === 'placesSection') {
                    loadPlaces();
                }
            } else {
                alert('Erro ao criar tag: ' + res.error);
            }
        } catch (err) {
            alert('Erro ao criar tag.');
        }
    });
}

function renderTagsManagerList() {
    if (!tagsListContainer) return;
    tagsListContainer.innerHTML = '';

    if (cachedCompanyTags.length === 0) {
        tagsListContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Nenhuma tag cadastrada.</p>';
        return;
    }

    cachedCompanyTags.forEach(t => {
        const row = `
            <div class="tag-item-row">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="tag-pill" style="background: ${t.color || '#3b82f6'};">🏷️ ${t.name}</span>
                </div>
                <button class="btn-icon btn-icon-delete btn-delete-tag" data-id="${t._id}" data-name="${t.name}" title="Excluir Tag">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
            </div>
        `;
        tagsListContainer.insertAdjacentHTML('beforeend', row);
    });

    tagsListContainer.querySelectorAll('.btn-delete-tag').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            if (confirm(`Excluir a tag "${name}"? Ela será removida de todos os locais.`)) {
                const res = await window.api.deleteTag(id);
                if (res.success) {
                    await reloadCompanyTags();
                    renderTagsManagerList();
                    loadPlaces();
                } else {
                    alert('Erro ao excluir tag: ' + res.error);
                }
            }
        });
    });
}

// Modal Aplicar Tags aos Locais Selecionados
const btnBulkTags = document.getElementById('btnBulkTags');
const applyTagsModal = document.getElementById('applyTagsModal');
const closeApplyTagsModal = document.getElementById('closeApplyTagsModal');
const btnApplyTagsCancel = document.getElementById('btnApplyTagsCancel');
const btnApplyTagsSubmit = document.getElementById('btnApplyTagsSubmit');
const applyTagsSelectContainer = document.getElementById('applyTagsSelectContainer');

function openApplyTagsModal() {
    if (selectedPlaceIds.size === 0) {
        alert('Selecione pelo menos um local para aplicar tags.');
        return;
    }
    if (cachedCompanyTags.length === 0) {
        alert('Nenhuma tag cadastrada. Clique em "⚙️ Tags" para criar sua primeira tag.');
        return;
    }

    document.getElementById('applyTagsSubtitle').textContent = `Selecione as tags a serem associadas a ${selectedPlaceIds.size} locais selecionados:`;
    applyTagsSelectContainer.innerHTML = '';

    cachedCompanyTags.forEach(t => {
        const item = `
            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                <input type="checkbox" class="chk-apply-tag" value="${t._id}" style="width: 18px; height: 18px;">
                <span class="tag-pill" style="background: ${t.color || '#3b82f6'};">🏷️ ${t.name}</span>
            </label>
        `;
        applyTagsSelectContainer.insertAdjacentHTML('beforeend', item);
    });

    applyTagsModal.style.display = 'flex';
    setTimeout(() => { applyTagsModal.classList.add('show'); }, 10);
}

function hideApplyTagsModal() {
    if (applyTagsModal) {
        applyTagsModal.classList.remove('show');
        setTimeout(() => { applyTagsModal.style.display = 'none'; }, 300);
    }
}

if (btnBulkTags) btnBulkTags.addEventListener('click', openApplyTagsModal);
if (closeApplyTagsModal) closeApplyTagsModal.addEventListener('click', hideApplyTagsModal);
if (btnApplyTagsCancel) btnApplyTagsCancel.addEventListener('click', hideApplyTagsModal);

if (btnApplyTagsSubmit) {
    btnApplyTagsSubmit.addEventListener('click', async () => {
        const selectedTagIds = Array.from(document.querySelectorAll('.chk-apply-tag:checked')).map(c => c.value);
        if (selectedTagIds.length === 0) {
            alert('Selecione ao menos uma tag para aplicar.');
            return;
        }

        btnApplyTagsSubmit.disabled = true;
        btnApplyTagsSubmit.textContent = 'Aplicando...';

        try {
            const placeIds = Array.from(selectedPlaceIds);
            const res = await window.api.bulkApplyTags(placeIds, selectedTagIds, 'add');
            if (res.success) {
                hideApplyTagsModal();
                loadPlaces();
            } else {
                alert('Erro ao aplicar tags: ' + res.error);
            }
        } catch (e) {
            alert('Erro ao aplicar tags.');
        } finally {
            btnApplyTagsSubmit.disabled = false;
            btnApplyTagsSubmit.textContent = 'Aplicar Tags';
        }
    });
}

// --- LÓGICA DE GERENCIAMENTO DE ABAS ---
const tabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active-content'));
        
        tab.classList.add('active');
        const targetSection = document.getElementById(tab.getAttribute('data-target'));
        if (targetSection) {
            targetSection.classList.add('active-content');
        }
        
        const targetId = tab.getAttribute('data-target');
        if (targetId === 'activitiesSection') {
            loadActivitiesAdmin();
        } else if (targetId === 'citiesSection') {
            loadCitiesAdmin();
        } else if (targetId === 'placesSection') {
            loadPlaces(true);
        } else if (targetId === 'searchEngineSection') {
            loadEngineConfigData();
        } else if (targetId === 'usersSection') {
            loadUsersAdmin();
        }
    });
});

function reloadCurrentTab() {
    const activeTab = document.querySelector('.nav-tab.active');
    if (!activeTab) return;
    const targetId = activeTab.getAttribute('data-target');
    
    reloadCompanyTags();
    reloadActivitiesFilter();
    
    if (targetId === 'placesSection') {
        loadPlaces(true);
    } else if (targetId === 'activitiesSection') {
        loadActivitiesAdmin();
    } else if (targetId === 'citiesSection') {
        loadCitiesAdmin();
    } else if (targetId === 'searchEngineSection') {
        loadEngineConfigData();
    } else if (targetId === 'usersSection') {
        loadUsersAdmin();
    }
}

// --- CONTROLE GERAL DO MODAL DE EDIÇÃO ---
const editModal = document.getElementById('editModal');
const btnModalSave = document.getElementById('btnModalSave');
const btnModalCancel = document.getElementById('btnModalCancel');
const closeModal = document.querySelector('.close-modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

function showModal(title, bodyHtml, saveCallback) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    
    const newSave = btnModalSave.cloneNode(true);
    btnModalSave.parentNode.replaceChild(newSave, btnModalSave);
    
    const activeSaveBtn = document.getElementById('btnModalSave');
    activeSaveBtn.addEventListener('click', async () => {
        activeSaveBtn.disabled = true;
        const originalText = activeSaveBtn.textContent;
        activeSaveBtn.textContent = 'Salvando...';
        
        try {
            await saveCallback();
            hideModal();
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar as alterações.');
        } finally {
            activeSaveBtn.disabled = false;
            activeSaveBtn.textContent = originalText;
        }
    });
    
    editModal.classList.add('show');
}

function hideModal() {
    editModal.classList.remove('show');
}

if (closeModal) closeModal.addEventListener('click', hideModal);
if (btnModalCancel) btnModalCancel.addEventListener('click', hideModal);

// --- CRUD: ATIVIDADES (TERMOS DE BUSCA) ---
const formActivity = document.getElementById('formActivity');
if (formActivity) {
    formActivity.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nomeInput = document.getElementById('activityNome');
        const ativaSelect = document.getElementById('activityAtiva');
        
        const nome = nomeInput.value.trim();
        const ativa = ativaSelect.value;
        
        if (!nome) return;
        
        try {
            const res = await window.api.addActivity({ nome, ativa });
            if (res.success) {
                nomeInput.value = '';
                await loadActivitiesAdmin();
                await reloadActivitiesFilter();
            } else {
                alert('Erro ao salvar termo: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao cadastrar atividade.');
        }
    });
}

async function loadActivitiesAdmin() {
    const tableBody = document.getElementById('activitiesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1.5rem;">Carregando atividades...</td></tr>';
    
    try {
        let activities = await window.api.getActivitiesList();
        
        const searchInput = document.getElementById('filterActivityName');
        if (searchInput) {
            const term = searchInput.value.trim().toLowerCase();
            if (term) {
                activities = activities.filter(act => act.nome.toLowerCase().includes(term));
            }
        }

        tableBody.innerHTML = '';
        
        if (activities.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1.5rem;">Nenhuma atividade encontrada.</td></tr>';
            return;
        }
        
        activities.forEach(act => {
            const isAtiva = act.ativa === 'V';
            const badgeClass = isAtiva ? 'badge-active' : 'badge-inactive';
            const badgeText = isAtiva ? 'Ativa' : 'Inativa';
            
            const row = `
                <tr data-id="${act._id}">
                    <td><strong>${act.nome}</strong></td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td>
                        <button class="btn-icon btn-icon-edit btn-edit-activity" data-id="${act._id}" data-nome="${act.nome}" data-ativa="${act.ativa}" title="Editar Atividade">
                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                        </button>
                        <button class="btn-icon btn-icon-delete btn-delete-activity" data-id="${act._id}" data-nome="${act.nome}" title="Excluir Atividade">
                            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        document.querySelectorAll('.btn-edit-activity').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const nome = btn.getAttribute('data-nome');
                const ativa = btn.getAttribute('data-ativa');
                openEditActivityModal(id, nome, ativa);
            });
        });
        
        document.querySelectorAll('.btn-delete-activity').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nome = btn.getAttribute('data-nome');
                if (confirm(`Deseja realmente excluir a atividade "${nome}"?`)) {
                    const res = await window.api.deleteActivity(id);
                    if (res.success) {
                        await loadActivitiesAdmin();
                        await reloadActivitiesFilter();
                    } else {
                        alert('Erro ao excluir: ' + res.error);
                    }
                }
            });
        });
        
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Erro ao obter lista do banco de dados.</td></tr>';
    }
}

function openEditActivityModal(id, nome, ativa) {
    const html = `
        <div class="filter-group">
            <label>Termo de Pesquisa</label>
            <input type="text" id="editActivityNome" value="${nome}" required>
        </div>
        <div class="filter-group">
            <label>Status</label>
            <select id="editActivityAtiva">
                <option value="V" ${ativa === 'V' ? 'selected' : ''}>Ativa</option>
                <option value="F" ${ativa === 'F' ? 'selected' : ''}>Inativa</option>
            </select>
        </div>
    `;
    
    showModal("Editar Atividade", html, async () => {
        const updatedNome = document.getElementById('editActivityNome').value.trim();
        const updatedAtiva = document.getElementById('editActivityAtiva').value;
        if (!updatedNome) return;
        
        const res = await window.api.updateActivity(id, { nome: updatedNome, ativa: updatedAtiva });
        if (res.success) {
            await loadActivitiesAdmin();
            await reloadActivitiesFilter();
        } else {
            alert('Erro ao atualizar: ' + res.error);
        }
    });
}

// --- CRUD: CIDADES E BAIRROS ---
const formCity = document.getElementById('formCity');
if (formCity) {
    formCity.addEventListener('submit', async (e) => {
        e.preventDefault();
        const munInput = document.getElementById('cityMunicipio');
        const estInput = document.getElementById('cityEstado');
        const popInput = document.getElementById('cityPopulacao');
        
        const municipio = munInput.value.trim();
        const estado = estInput.value.trim().toUpperCase();
        const populacao = parseInt(popInput.value) || 0;
        
        if (!municipio || !estado) return;
        
        try {
            const res = await window.api.addCity({ municipio, estado, populacao });
            if (res.success) {
                munInput.value = '';
                estInput.value = '';
                popInput.value = '';
                await loadCitiesAdmin();
            } else {
                alert('Erro ao salvar cidade: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao cadastrar cidade.');
        }
    });
}

async function loadCitiesAdmin() {
    const citiesList = document.getElementById('citiesList');
    if (!citiesList) return;
    
    citiesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Carregando cidades...</p>';
    
    try {
        let cities = await window.api.getCities();
        
        const stateSelect = document.getElementById('filterCityState');
        if (stateSelect && cities.length > 0) {
            const states = [...new Set(cities.map(c => c.estado))].sort();
            stateSelect.innerHTML = '<option value="">Todos os Estados</option>';
            states.forEach(st => {
                stateSelect.insertAdjacentHTML('beforeend', `<option value="${st}">${st}</option>`);
            });
        }

        const searchInput = document.getElementById('filterCityName');
        if (searchInput) {
            const term = searchInput.value.trim().toLowerCase();
            if (term) {
                cities = cities.filter(c => c.municipio.toLowerCase().includes(term));
            }
        }
        if (stateSelect) {
            const stTerm = stateSelect.value;
            if (stTerm) {
                cities = cities.filter(c => c.estado === stTerm);
            }
        }

        citiesList.innerHTML = '';
        
        if (cities.length === 0) {
            citiesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhuma cidade encontrada.</p>';
            return;
        }
        
        cities.forEach(city => {
            const hasPopulation = city.populacao ? `${city.populacao.toLocaleString()} hab.` : 'População não informada';
            
            const accordionItem = `
                <div class="accordion-item" id="city-accordion-${city._id}" data-id="${city._id}" data-municipio="${city.municipio}" data-estado="${city.estado}">
                    <div class="accordion-header">
                        <div class="accordion-title-group">
                            <span class="accordion-title">${city.municipio} - ${city.estado}</span>
                            <span class="accordion-meta">${hasPopulation}</span>
                        </div>
                        <div class="accordion-actions">
                            <button class="btn-icon btn-icon-edit btn-edit-city" data-id="${city._id}" data-municipio="${city.municipio}" data-estado="${city.estado}" data-populacao="${city.populacao || 0}" title="Editar Cidade">
                                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                            </button>
                            <button class="btn-icon btn-icon-delete btn-delete-city" data-id="${city._id}" data-municipio="${city.municipio}" data-estado="${city.estado}" title="Excluir Cidade e Bairros">
                                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                            </button>
                            <span class="accordion-toggle-icon">▶</span>
                        </div>
                    </div>
                    <div class="accordion-content">
                        <div class="bairros-panel">
                            <div class="form-container">
                                <h3>Adicionar Bairro Manual</h3>
                                <form class="admin-form form-bairro">
                                    <input type="hidden" class="bairro-city-municipio" value="${city.municipio}">
                                    <input type="hidden" class="bairro-city-estado" value="${city.estado}">
                                    <div class="form-group">
                                        <label>Nome do Bairro</label>
                                        <input type="text" class="bairro-nome-input" placeholder="Ex: Centro" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Gênero Gramatical</label>
                                        <select class="bairro-genero-input">
                                            <option value="M" selected>Masculino (no Centro)</option>
                                            <option value="F">Feminino (na Trindade)</option>
                                            <option value="N">Neutro (em Agronômica)</option>
                                        </select>
                                    </div>
                                    <button type="submit" class="btn-primary btn-small">Salvar Bairro</button>
                                </form>
                                <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                                    <button class="btn-small btn-small-ai btn-generate-bairros-ai" data-municipio="${city.municipio}" data-estado="${city.estado}">
                                        ✨ Gerar Lista Completa de Bairros (IA)
                                    </button>
                                </div>
                            </div>
                            
                            <div class="list-container">
                                <h3>Bairros desta Cidade</h3>
                                <div class="bairros-list-container list-bairros-body">
                                    <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Clique na cidade para carregar.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            citiesList.insertAdjacentHTML('beforeend', accordionItem);
        });
        
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                
                const item = header.closest('.accordion-item');
                const isOpen = item.classList.contains('open');
                
                document.querySelectorAll('.accordion-item').forEach(other => {
                    if (other !== item) other.classList.remove('open');
                });
                
                item.classList.toggle('open', !isOpen);
                
                if (!isOpen) {
                    const municipio = item.getAttribute('data-municipio');
                    const estado = item.getAttribute('data-estado');
                    const listContainer = item.querySelector('.list-bairros-body');
                    loadNeighborhoodsList(municipio, estado, listContainer);
                }
            });
        });
        
        document.querySelectorAll('.btn-edit-city').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const municipio = btn.getAttribute('data-municipio');
                const estado = btn.getAttribute('data-estado');
                const populacao = btn.getAttribute('data-populacao');
                openEditCityModal(id, municipio, estado, populacao);
            });
        });
        
        document.querySelectorAll('.btn-delete-city').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const municipio = btn.getAttribute('data-municipio');
                const estado = btn.getAttribute('data-estado');
                if (confirm(`Deseja realmente excluir a cidade "${municipio} - ${estado}"? Todos os bairros dela também serão apagados.`)) {
                    const res = await window.api.deleteCity(id);
                    if (res.success) {
                        await loadCitiesAdmin();
                    } else {
                        alert('Erro ao excluir: ' + res.error);
                    }
                }
            });
        });
        
        document.querySelectorAll('.form-bairro').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const municipio = form.querySelector('.bairro-city-municipio').value;
                const estado = form.querySelector('.bairro-city-estado').value;
                const inputNome = form.querySelector('.bairro-nome-input');
                const selectGenero = form.querySelector('.bairro-genero-input');
                
                const bairro = inputNome.value.trim();
                const genero = selectGenero.value;
                
                if (!bairro) return;
                
                try {
                    const res = await window.api.addNeighborhood({ bairro, genero, municipio, estado });
                    if (res.success) {
                        inputNome.value = '';
                        const listBody = form.closest('.accordion-content').querySelector('.list-bairros-body');
                        await loadNeighborhoodsList(municipio, estado, listBody);
                    } else {
                        alert('Erro ao cadastrar bairro: ' + res.error);
                    }
                } catch (err) {
                    console.error(err);
                    alert('Erro no cadastro.');
                }
            });
        });
        
        document.querySelectorAll('.btn-generate-bairros-ai').forEach(btn => {
            btn.addEventListener('click', async () => {
                const municipio = btn.getAttribute('data-municipio');
                const estado = btn.getAttribute('data-estado');
                const listBody = btn.closest('.accordion-content').querySelector('.list-bairros-body');
                
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '⌛ Gerando Bairros pela IA (Aguarde)...';
                
                try {
                    const res = await window.api.generateNeighborhoods(municipio, estado);
                    if (res.success) {
                        alert(`Sucesso! Foram salvos ${res.count} bairros gerados pela IA.`);
                        await loadNeighborhoodsList(municipio, estado, listBody);
                    } else {
                        alert('Aviso/Erro na Geração: ' + res.error);
                    }
                } catch (err) {
                    console.error(err);
                    alert('Falha interna ao contatar o backend para geração de bairros.');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        });
        
    } catch (err) {
        console.error(err);
        citiesList.innerHTML = '<p style="color: red; padding: 1.5rem; text-align: center;">Erro ao obter lista de cidades.</p>';
    }
}

function openEditCityModal(id, municipio, estado, populacao) {
    const html = `
        <div class="filter-group">
            <label>Nome do Município</label>
            <input type="text" id="editCityMunicipio" value="${municipio}" required>
        </div>
        <div class="filter-group">
            <label>Estado (UF)</label>
            <input type="text" id="editCityEstado" value="${estado}" maxlength="2" style="text-transform: uppercase;" required>
        </div>
        <div class="filter-group">
            <label>População</label>
            <input type="number" id="editCityPopulacao" value="${populacao}">
        </div>
    `;
    
    showModal("Editar Cidade", html, async () => {
        const updatedMun = document.getElementById('editCityMunicipio').value.trim();
        const updatedEst = document.getElementById('editCityEstado').value.trim().toUpperCase();
        const updatedPop = parseInt(document.getElementById('editCityPopulacao').value) || 0;
        
        if (!updatedMun || !updatedEst) return;
        
        const res = await window.api.updateCity(id, { municipio: updatedMun, estado: updatedEst, populacao: updatedPop });
        if (res.success) {
            await loadCitiesAdmin();
        } else {
            alert('Erro ao atualizar cidade: ' + res.error);
        }
    });
}

async function loadNeighborhoodsList(municipio, estado, containerElement) {
    if (!containerElement) return;
    
    containerElement.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 0.5rem;">Buscando bairros no banco...</p>';
    
    try {
        const bairros = await window.api.getNeighborhoods(municipio, estado);
        containerElement.innerHTML = '';
        
        if (bairros.length === 0) {
            containerElement.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 0.5rem;">Nenhum bairro cadastrado.</p>';
            return;
        }
        
        bairros.forEach(b => {
            const itemHtml = `
                <div class="bairro-item" data-id="${b._id}">
                    <div class="bairro-info">
                        <span class="bairro-name">${b.bairro}</span>
                        <span class="bairro-gender-badge bairro-gender-${b.genero || 'N'}">${b.genero || 'N'}</span>
                    </div>
                    <div class="bairro-actions">
                        <button class="btn-icon btn-icon-edit btn-edit-bairro" data-id="${b._id}" data-bairro="${b.bairro}" data-genero="${b.genero || 'N'}" data-municipio="${municipio}" data-estado="${estado}" title="Editar Bairro">
                            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                        </button>
                        <button class="btn-icon btn-icon-delete btn-delete-bairro" data-id="${b._id}" data-bairro="${b.bairro}" data-municipio="${municipio}" data-estado="${estado}" title="Excluir Bairro">
                            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                    </div>
                </div>
            `;
            containerElement.insertAdjacentHTML('beforeend', itemHtml);
        });
        
        containerElement.querySelectorAll('.btn-edit-bairro').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-bairro');
                const gender = btn.getAttribute('data-genero');
                const mun = btn.getAttribute('data-municipio');
                const est = btn.getAttribute('data-estado');
                openEditBairroModal(id, name, gender, mun, est, containerElement);
            });
        });
        
        containerElement.querySelectorAll('.btn-delete-bairro').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-bairro');
                const mun = btn.getAttribute('data-municipio');
                const est = btn.getAttribute('data-estado');
                if (confirm(`Excluir bairro "${name}"?`)) {
                    const res = await window.api.deleteNeighborhood(id);
                    if (res.success) {
                        await loadNeighborhoodsList(mun, est, containerElement);
                    } else {
                        alert('Erro ao excluir: ' + res.error);
                    }
                }
            });
        });
        
    } catch (err) {
        console.error(err);
        containerElement.innerHTML = '<p style="color: red; padding: 0.5rem; text-align: center;">Erro ao carregar.</p>';
    }
}

function openEditBairroModal(id, name, gender, municipio, estado, listContainer) {
    const html = `
        <div class="filter-group">
            <label>Nome do Bairro</label>
            <input type="text" id="editBairroNome" value="${name}" required>
        </div>
        <div class="filter-group">
            <label>Gênero Gramatical</label>
            <select id="editBairroGenero">
                <option value="M" ${gender === 'M' ? 'selected' : ''}>Masculino (no Centro)</option>
                <option value="F" ${gender === 'F' ? 'selected' : ''}>Feminino (na Trindade)</option>
                <option value="N" ${gender === 'N' ? 'selected' : ''}>Neutro (em Agronômica)</option>
            </select>
        </div>
    `;
    
    showModal("Editar Bairro", html, async () => {
        const updatedBairro = document.getElementById('editBairroNome').value.trim();
        const updatedGenero = document.getElementById('editBairroGenero').value;
        
        if (!updatedBairro) return;
        
        const res = await window.api.updateNeighborhood(id, { bairro: updatedBairro, genero: updatedGenero });
        if (res.success) {
            await loadNeighborhoodsList(municipio, estado, listContainer);
        } else {
            alert('Erro ao atualizar bairro: ' + res.error);
        }
    });
}

async function reloadActivitiesFilter() {
    try {
        const selectTipo = document.getElementById('filterTipo');
        if (!selectTipo) return;
        
        const activities = await window.api.getActivities();
        const currentVal = selectTipo.value;
        
        selectTipo.innerHTML = '<option value="">Qualquer</option>';
        activities.forEach(activity => {
            if (activity.nome) {
                const selected = activity.nome === currentVal ? 'selected' : '';
                selectTipo.insertAdjacentHTML('beforeend', `<option value="${activity.nome}" ${selected}>${activity.nome}</option>`);
            }
        });
    } catch (e) {
        console.error('Erro ao recarregar filtro de atividades:', e);
    }
}

// --- MOTOR DE BUSCA (UI) ---
let isEngineRunning = false;
let isEnginePaused = false;

const engineSelectActivity = document.getElementById('engineSelectActivity');
const engineSelectState = document.getElementById('engineSelectState');
const engineSelectCity = document.getElementById('engineSelectCity');
const engineBairrosList = document.getElementById('engineBairrosList');
const btnEngineStart = document.getElementById('btnEngineStart');
const btnEnginePause = document.getElementById('btnEnginePause');
const btnEngineStop = document.getElementById('btnEngineStop');
const engineCurrentStatus = document.getElementById('engineCurrentStatus');
const engineProgressText = document.getElementById('engineProgressText');
const engineProgressBar = document.getElementById('engineProgressBar');
const engineConsole = document.getElementById('engineConsole');
const btnClearLogs = document.getElementById('btnClearLogs');

async function loadEngineConfigData() {
    try {
        const activities = await window.api.getActivities();
        engineSelectActivity.innerHTML = '<option value="">Selecione uma atividade...</option>';
        activities.forEach(act => {
            if (act.ativa === 'V') {
                engineSelectActivity.insertAdjacentHTML('beforeend', `<option value="${act.nome}">${act.nome}</option>`);
            }
        });

        const cities = await window.api.getCities();
        const states = [...new Set(cities.map(c => c.estado))].sort();
        
        engineSelectState.innerHTML = '<option value="">Selecione um estado...</option>';
        states.forEach(st => {
            engineSelectState.insertAdjacentHTML('beforeend', `<option value="${st}">${st}</option>`);
        });

        engineSelectCity.innerHTML = '<option value="">Selecione um estado primeiro</option>';
        engineSelectCity.disabled = true;
        engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Selecione uma cidade para carregar os bairros...</p>';

        const statusRes = await window.api.getEngineStatus();
        updateEngineUIFromStatus(statusRes);
    } catch (err) {
        console.error('Erro ao carregar dados do Motor de Busca:', err);
    }
}

if (engineSelectState) {
    engineSelectState.addEventListener('change', async () => {
        const st = engineSelectState.value;
        if (!st) {
            engineSelectCity.innerHTML = '<option value="">Selecione um estado primeiro</option>';
            engineSelectCity.disabled = true;
            return;
        }

        const cities = await window.api.getCities();
        const filteredCities = cities.filter(c => c.estado === st);

        engineSelectCity.innerHTML = '<option value="">Todas as Cidades deste Estado</option>';
        filteredCities.forEach(c => {
            engineSelectCity.insertAdjacentHTML('beforeend', `<option value="${c.municipio}">${c.municipio}</option>`);
        });
        engineSelectCity.disabled = false;
        engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Selecione uma cidade específica para carregar os bairros...</p>';
    });
}

if (engineSelectCity) {
    engineSelectCity.addEventListener('change', async () => {
        const city = engineSelectCity.value;
        const state = engineSelectState.value;

        if (!city) {
            engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Todas as cidades serão pesquisadas globalmente no estado. Selecione uma cidade específica para filtrar por bairros.</p>';
            return;
        }

        engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Carregando bairros...</p>';
        const bairros = await window.api.getNeighborhoods(city, state);

        if (bairros.length === 0) {
            engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Nenhum bairro cadastrado para esta cidade.</p>';
            return;
        }

        engineBairrosList.innerHTML = `
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.85rem;">
                <input type="checkbox" id="chkSelectAllBairros" checked style="width: auto;"> Selecionar Todos os Bairros (${bairros.length})
            </label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem; margin-top: 0.5rem;">
                ${bairros.map(b => `
                    <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                        <input type="checkbox" class="chk-bairro-engine" value="${b.bairro}" checked style="width: auto;"> ${b.bairro}
                    </label>
                `).join('')}
            </div>
        `;

        const chkAll = document.getElementById('chkSelectAllBairros');
        if (chkAll) {
            chkAll.addEventListener('change', (e) => {
                document.querySelectorAll('.chk-bairro-engine').forEach(c => c.checked = e.target.checked);
            });
        }
    });
}

function addEngineLog(msg, type = 'info') {
    if (!engineConsole) return;
    const time = new Date().toLocaleTimeString('pt-BR');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${time}] ${msg}`;
    engineConsole.appendChild(entry);
    engineConsole.scrollTop = engineConsole.scrollHeight;
}

if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
        if (engineConsole) engineConsole.innerHTML = '<div class="log-entry log-system">Logs limpos.</div>';
    });
}

if (btnEngineStart) {
    btnEngineStart.addEventListener('click', async () => {
        const activity = engineSelectActivity.value;
        const state = engineSelectState.value;
        const city = engineSelectCity.value;

        if (!activity) {
            alert('Selecione uma atividade para iniciar a busca.');
            return;
        }
        if (!state) {
            alert('Selecione um estado para iniciar a busca.');
            return;
        }

        const selectedBairros = [];
        document.querySelectorAll('.chk-bairro-engine:checked').forEach(c => selectedBairros.push(c.value));

        const queries = [];

        if (city && selectedBairros.length > 0) {
            selectedBairros.forEach(b => {
                queries.push({ term: activity, state, city, neighborhood: b });
            });
        } else if (city) {
            queries.push({ term: activity, state, city, neighborhood: null });
        } else {
            const cities = await window.api.getCities();
            const filteredCities = cities.filter(c => c.estado === state);
            if (filteredCities.length === 0) {
                alert('Nenhuma cidade cadastrada para este estado.');
                return;
            }
            filteredCities.forEach(c => {
                queries.push({ term: activity, state: c.estado, city: c.municipio, neighborhood: null });
            });
        }

        const config = {
            queries,
            delayBetweenPlaces: 2,
            delayBetweenQueries: 4
        };

        const res = await window.api.startEngine(config);
        if (res.success) {
            isEngineRunning = true;
            isEnginePaused = false;
            updateEngineButtons();
            addEngineLog('Motor de busca iniciado com sucesso!', 'system');
        } else {
            alert('Erro ao iniciar motor: ' + res.error);
        }
    });
}

if (btnEnginePause) {
    btnEnginePause.addEventListener('click', async () => {
        if (isEnginePaused) {
            const res = await window.api.resumeEngine();
            if (res.success) {
                isEnginePaused = false;
                updateEngineButtons();
                addEngineLog('Motor de busca retomado.', 'system');
            }
        } else {
            const res = await window.api.pauseEngine();
            if (res.success) {
                isEnginePaused = true;
                updateEngineButtons();
                addEngineLog('Motor de busca pausado.', 'system');
            }
        }
    });
}

if (btnEngineStop) {
    btnEngineStop.addEventListener('click', async () => {
        if (confirm('Deseja realmente parar o motor de busca?')) {
            const res = await window.api.stopEngine();
            if (res.success) {
                isEngineRunning = false;
                isEnginePaused = false;
                updateEngineButtons();
                addEngineLog('Motor de busca parado pelo usuário.', 'warning');
            }
        }
    });
}

function updateEngineButtons() {
    if (!btnEngineStart) return;

    if (isEngineRunning) {
        btnEngineStart.disabled = true;
        btnEnginePause.disabled = false;
        btnEngineStop.disabled = false;
        btnEnginePause.textContent = isEnginePaused ? '▶ Retomar' : '⏸ Pausar';
        engineCurrentStatus.textContent = isEnginePaused ? 'Pausado' : 'Buscando...';
        engineCurrentStatus.className = isEnginePaused ? 'status-badge status-other' : 'status-badge status-operational';
    } else {
        btnEngineStart.disabled = false;
        btnEnginePause.disabled = true;
        btnEngineStop.disabled = true;
        btnEnginePause.textContent = '⏸ Pausar';
        engineCurrentStatus.textContent = 'Parado';
        engineCurrentStatus.className = 'status-badge status-closed';
    }
}

function updateEngineUIFromStatus(data) {
    if (!data) return;
    isEngineRunning = data.status === 'searching' || data.status === 'paused';
    isEnginePaused = data.status === 'paused';

    updateEngineButtons();

    if (data.totalPending > 0) {
        const pct = Math.round((data.processedCount / data.totalPending) * 100);
        engineProgressText.textContent = `${data.processedCount} / ${data.totalPending} (${pct}%)`;
        engineProgressBar.style.width = `${pct}%`;
    } else {
        engineProgressText.textContent = '0 / 0';
        engineProgressBar.style.width = '0%';
    }

    if (data.logs && data.logs.length > 0 && engineConsole.children.length <= 1) {
        engineConsole.innerHTML = '';
        data.logs.forEach(l => addEngineLog(l.message, l.type));
    }
}

window.api.onEngineProgress((data) => {
    if (data.status) {
        isEngineRunning = data.status === 'searching' || data.status === 'paused';
        isEnginePaused = data.status === 'paused';
        updateEngineButtons();
    }

    if (data.totalPending > 0) {
        const pct = Math.round((data.processedCount / data.totalPending) * 100);
        engineProgressText.textContent = `${data.processedCount} / ${data.totalPending} (${pct}%)`;
        engineProgressBar.style.width = `${pct}%`;
    }

    if (data.newLog) {
        addEngineLog(data.newLog.message, data.newLog.type);
    }
});

window.api.onEngineFinished((data) => {
    addEngineLog(`Varredura concluída!`, 'success');
    engineCurrentStatus.textContent = 'Concluído';
    engineCurrentStatus.className = 'status-badge status-operational';
    engineProgressText.textContent = `100%`;
    engineProgressBar.style.width = `100%`;
    
    isEngineRunning = false;
    isEnginePaused = false;
    updateEngineButtons();
});

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
async function init() {
    const overlay = document.getElementById('loginOverlay');
    const usersTabBtn = document.getElementById('usersTabBtn');
    
    try {
        const res = await window.api.checkSession();
        const user = res.user;
        
        overlay.classList.add('hidden');
        
        localStorage.setItem('user', JSON.stringify(user));
        if (user.current_company_id) {
            localStorage.setItem('current_company_id', user.current_company_id);
        }
        
        // Atualizar menu de usuário
        const btnUserMenu = document.getElementById('btnUserMenu');
        const headerUserName = document.getElementById('headerUserName');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');
        
        if (btnUserMenu) {
            btnUserMenu.style.display = 'flex';
            headerUserName.textContent = (user.name || user.email).charAt(0).toUpperCase();
            dropdownUserName.textContent = user.name || 'Usuário';
            dropdownUserEmail.textContent = user.email;
        }

        // Atualizar Badge de Empresa no Header
        const companyBadgeContainer = document.getElementById('companyBadgeContainer');
        const headerCompanyName = document.getElementById('headerCompanyName');
        if (companyBadgeContainer && headerCompanyName) {
            companyBadgeContainer.classList.remove('hidden');
            headerCompanyName.textContent = user.company_name || 'SEO Company';
        }

        // Configuração de recursos ativados para a empresa ativa (CRM, Excel)
        activeCompanyConfig.crm_enabled = !!user.crm_enabled;
        activeCompanyConfig.allow_excel_export = user.allow_excel_export !== false;
        updateCompanyFeaturesUI();

        // Configura Socket.io para exportações da empresa
        if (user.current_company_id) {
            setupExportSocketListeners(user.current_company_id);
        }
        
        // Se for admin/master, exibe opções adicionais
        const isMaster = !!user.is_master;
        if (user.can_create_users || isMaster) {
            if (usersTabBtn) usersTabBtn.classList.remove('hidden');
            const liNewUser = document.getElementById('liNewUser');
            const liAllUsers = document.getElementById('liAllUsers');
            if (liNewUser) liNewUser.classList.remove('hidden');
            if (liAllUsers) liAllUsers.classList.remove('hidden');
        }

        if (isMaster) {
            const liSwitchCompany = document.getElementById('liSwitchCompany');
            const liNewCompany = document.getElementById('liNewCompany');
            const liAllCompanies = document.getElementById('liAllCompanies');
            if (liSwitchCompany) liSwitchCompany.classList.remove('hidden');
            if (liNewCompany) liNewCompany.classList.remove('hidden');
            if (liAllCompanies) liAllCompanies.classList.remove('hidden');

            const thUserCompany = document.getElementById('thUserCompany');
            if (thUserCompany) thUserCompany.classList.remove('hidden');

            const userCompanyGroup = document.getElementById('userCompanyGroup');
            if (userCompanyGroup) userCompanyGroup.classList.remove('hidden');

            loadCompaniesInUserSelect(res.companies || []);
        }
        
        await reloadCompanyTags();
        await reloadActivitiesFilter();
        await loadPlaces(true);
    } catch (error) {
        overlay.classList.remove('hidden');
    }
}

async function loadCompaniesInUserSelect(companiesList = null) {
    const userCompanySelect = document.getElementById('userCompany');
    if (!userCompanySelect) return;

    try {
        const companies = companiesList || (await window.api.getCompanies()).data || [];
        userCompanySelect.innerHTML = '<option value="">Selecione uma empresa...</option>';
        companies.forEach(c => {
            userCompanySelect.insertAdjacentHTML('beforeend', `<option value="${c._id}">${c.name}</option>`);
        });
    } catch (e) {
        console.error('Erro ao carregar lista de empresas para select:', e);
    }
}

// --- GESTÃO DE EMPRESAS (MULTI-TENANT / MASTER) ---

const btnSelectCompany = document.getElementById('btnSelectCompany');
const btnDropdownSwitchCompany = document.getElementById('btnDropdownSwitchCompany');
const btnDropdownNewCompany = document.getElementById('btnDropdownNewCompany');
const btnDropdownAllCompanies = document.getElementById('btnDropdownAllCompanies');

if (btnSelectCompany) {
    btnSelectCompany.addEventListener('click', () => openSwitchCompanyModal());
}
if (btnDropdownSwitchCompany) {
    btnDropdownSwitchCompany.addEventListener('click', () => {
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) userDropdown.classList.add('hidden');
        openSwitchCompanyModal();
    });
}
if (btnDropdownNewCompany) {
    btnDropdownNewCompany.addEventListener('click', () => {
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) userDropdown.classList.add('hidden');
        openCompanyModal();
    });
}
if (btnDropdownAllCompanies) {
    btnDropdownAllCompanies.addEventListener('click', () => {
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) userDropdown.classList.add('hidden');
        openCompaniesListModal();
    });
}

// Modal Trocar de Empresa Ativa
const switchCompanyModal = document.getElementById('switchCompanyModal');
const closeSwitchCompanyModal = document.getElementById('closeSwitchCompanyModal');
const btnSwitchCompanyCancel = document.getElementById('btnSwitchCompanyCancel');
const switchCompanyList = document.getElementById('switchCompanyList');
const searchCompanySwitchInput = document.getElementById('searchCompanySwitchInput');

function hideSwitchCompanyModal() {
    if (switchCompanyModal) {
        switchCompanyModal.classList.remove('show');
        setTimeout(() => { switchCompanyModal.style.display = 'none'; }, 300);
    }
}

async function openSwitchCompanyModal() {
    if (!switchCompanyModal || !switchCompanyList) return;
    
    switchCompanyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Carregando empresas...</p>';
    switchCompanyModal.style.display = 'flex';
    setTimeout(() => { switchCompanyModal.classList.add('show'); }, 10);

    try {
        const res = await window.api.getCompanies();
        const companies = res.data || [];
        renderSwitchCompanyList(companies);

        if (searchCompanySwitchInput) {
            searchCompanySwitchInput.value = '';
            searchCompanySwitchInput.oninput = () => {
                const term = searchCompanySwitchInput.value.trim().toLowerCase();
                const filtered = companies.filter(c => c.name.toLowerCase().includes(term));
                renderSwitchCompanyList(filtered);
            };
        }
    } catch (e) {
        switchCompanyList.innerHTML = '<p style="color: red; text-align: center; padding: 1rem;">Erro ao carregar lista de empresas.</p>';
    }
}

function renderSwitchCompanyList(companies) {
    if (!switchCompanyList) return;
    const currentCompanyId = localStorage.getItem('current_company_id');
    switchCompanyList.innerHTML = '';

    if (companies.length === 0) {
        switchCompanyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">Nenhuma empresa encontrada.</p>';
        return;
    }

    companies.forEach(c => {
        const isActive = c._id === currentCompanyId;
        const activeClass = isActive ? 'active' : '';
        const badgeTag = isActive ? '<span class="badge-active-tag">Ativa</span>' : '';

        const item = `
            <div class="company-select-item ${activeClass}" data-id="${c._id}" data-name="${c.name}">
                <span class="company-select-name">🏢 ${c.name}</span>
                ${badgeTag}
            </div>
        `;
        switchCompanyList.insertAdjacentHTML('beforeend', item);
    });

    switchCompanyList.querySelectorAll('.company-select-item').forEach(el => {
        el.addEventListener('click', async () => {
            const companyId = el.getAttribute('data-id');
            const companyName = el.getAttribute('data-name');

            if (companyId === currentCompanyId) {
                hideSwitchCompanyModal();
                return;
            }

            try {
                const res = await window.api.switchCompany(companyId);
                if (res.success) {
                    if (res.token) localStorage.setItem('token', res.token);
                    localStorage.setItem('current_company_id', companyId);
                    
                    const headerCompanyName = document.getElementById('headerCompanyName');
                    if (headerCompanyName) headerCompanyName.textContent = companyName;

                    if (res.activeCompany) {
                        activeCompanyConfig.crm_enabled = !!res.activeCompany.crm_enabled;
                        activeCompanyConfig.allow_excel_export = res.activeCompany.allow_excel_export !== false;
                        updateCompanyFeaturesUI();
                    }

                    hideSwitchCompanyModal();
                    reloadCurrentTab();
                } else {
                    alert('Erro ao trocar de empresa: ' + res.error);
                }
            } catch (err) {
                alert('Erro ao trocar de empresa.');
            }
        });
    });
}

if (closeSwitchCompanyModal) closeSwitchCompanyModal.addEventListener('click', hideSwitchCompanyModal);
if (btnSwitchCompanyCancel) btnSwitchCompanyCancel.addEventListener('click', hideSwitchCompanyModal);

// Modal Cadastrar / Editar Empresa (Com CRM e Permissões)
const companyModal = document.getElementById('companyModal');
const companyModalTitle = document.getElementById('companyModalTitle');
const closeCompanyModal = document.getElementById('closeCompanyModal');
const btnCompanyCancel = document.getElementById('btnCompanyCancel');
const btnCompanySave = document.getElementById('btnCompanySave');
const formCompany = document.getElementById('formCompany');
const companyError = document.getElementById('companyError');

const companyAllowExcel = document.getElementById('companyAllowExcel');
const companyCrmEnabled = document.getElementById('companyCrmEnabled');
const crmConfigFields = document.getElementById('crmConfigFields');
const companyCrmProvider = document.getElementById('companyCrmProvider');
const companyCrmClientToken = document.getElementById('companyCrmClientToken');
const companyCrmChannelId = document.getElementById('companyCrmChannelId');
const companyCrmDepartmentUuid = document.getElementById('companyCrmDepartmentUuid');
const companyCrmAgentUuid = document.getElementById('companyCrmAgentUuid');
const companyCrmTagUuid = document.getElementById('companyCrmTagUuid');

if (companyCrmEnabled) {
    companyCrmEnabled.addEventListener('change', (e) => {
        crmConfigFields.classList.toggle('hidden', !e.target.checked);
    });
}

function hideCompanyModal() {
    if (companyModal) {
        companyModal.classList.remove('show');
        setTimeout(() => { companyModal.style.display = 'none'; }, 300);
    }
}

async function openCompanyModal(id = null, currentName = '') {
    if (!companyModal) return;
    document.getElementById('companyId').value = id || '';
    document.getElementById('companyName').value = currentName || '';
    companyModalTitle.textContent = id ? 'Editar Cliente (Empresa)' : 'Novo Cliente (Empresa)';
    if (companyError) companyError.classList.add('hidden');

    if (id) {
        try {
            const res = await window.api.getCompany(id);
            const comp = res.data;
            if (comp) {
                companyAllowExcel.checked = comp.allow_excel_export !== false;
                companyCrmEnabled.checked = !!comp.crm_enabled;
                crmConfigFields.classList.toggle('hidden', !comp.crm_enabled);

                const crmConf = comp.crm_config || {};
                companyCrmProvider.value = comp.crm_provider || 'mz_partners';
                companyCrmClientToken.value = crmConf.client_token || '';
                companyCrmChannelId.value = crmConf.channel_id || '';
                companyCrmDepartmentUuid.value = crmConf.department_uuid || '';
                companyCrmAgentUuid.value = crmConf.agent_uuid || '';
                companyCrmTagUuid.value = crmConf.tag_uuid || '';
            }
        } catch (e) {
            console.error('Erro ao buscar empresa:', e);
        }
    } else {
        companyAllowExcel.checked = true;
        companyCrmEnabled.checked = false;
        crmConfigFields.classList.add('hidden');
        companyCrmClientToken.value = '';
        companyCrmChannelId.value = '';
        companyCrmDepartmentUuid.value = '';
        companyCrmAgentUuid.value = '';
        companyCrmTagUuid.value = '';
    }

    companyModal.style.display = 'flex';
    setTimeout(() => { companyModal.classList.add('show'); }, 10);
}

if (closeCompanyModal) closeCompanyModal.addEventListener('click', hideCompanyModal);
if (btnCompanyCancel) btnCompanyCancel.addEventListener('click', hideCompanyModal);

if (btnCompanySave && formCompany) {
    btnCompanySave.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = document.getElementById('companyId').value;
        const name = document.getElementById('companyName').value.trim();

        if (!name) {
            companyError.textContent = 'O nome do cliente/empresa é obrigatório.';
            companyError.classList.remove('hidden');
            return;
        }

        const companyData = {
            name,
            allow_excel_export: companyAllowExcel.checked,
            crm_enabled: companyCrmEnabled.checked,
            crm_provider: companyCrmProvider.value,
            crm_config: {
                client_token: companyCrmClientToken.value.trim(),
                channel_id: companyCrmChannelId.value.trim(),
                channel_type: 'WHATSAPP',
                department_uuid: companyCrmDepartmentUuid.value.trim(),
                agent_uuid: companyCrmAgentUuid.value.trim(),
                tag_uuid: companyCrmTagUuid.value.trim()
            }
        };

        btnCompanySave.disabled = true;
        btnCompanySave.textContent = 'Salvando...';

        try {
            let res;
            if (id) {
                res = await window.api.updateCompany(id, companyData);
            } else {
                res = await window.api.createCompany(companyData);
            }

            if (res.success) {
                hideCompanyModal();
                const companiesListModal = document.getElementById('companiesListModal');
                if (companiesListModal && companiesListModal.classList.contains('show')) {
                    await loadCompaniesAdminTable();
                }
                loadCompaniesInUserSelect();
            } else {
                companyError.textContent = res.error || 'Erro ao salvar cliente.';
                companyError.classList.remove('hidden');
            }
        } catch (err) {
            companyError.textContent = err.message || 'Erro interno ao salvar cliente.';
            companyError.classList.remove('hidden');
        } finally {
            btnCompanySave.disabled = false;
            btnCompanySave.textContent = 'Salvar Cliente';
        }
    });
}

// Modal Gerenciar Todas as Empresas
const companiesListModal = document.getElementById('companiesListModal');
const closeCompaniesListModal = document.getElementById('closeCompaniesListModal');
const btnCloseCompaniesListModal = document.getElementById('btnCloseCompaniesListModal');
const btnOpenNewCompanyModal = document.getElementById('btnOpenNewCompanyModal');

function hideCompaniesListModal() {
    if (companiesListModal) {
        companiesListModal.classList.remove('show');
        setTimeout(() => { companiesListModal.style.display = 'none'; }, 300);
    }
}

async function openCompaniesListModal() {
    if (!companiesListModal) return;
    companiesListModal.style.display = 'flex';
    setTimeout(() => { companiesListModal.classList.add('show'); }, 10);
    await loadCompaniesAdminTable();
}

async function loadCompaniesAdminTable() {
    const tableBody = document.getElementById('companiesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem;">Carregando empresas...</td></tr>';
    
    try {
        const res = await window.api.getCompanies();
        const companies = res.data || [];
        tableBody.innerHTML = '';

        if (companies.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem;">Nenhuma empresa cadastrada.</td></tr>';
            return;
        }

        const currentCompanyId = localStorage.getItem('current_company_id');

        companies.forEach(c => {
            const date = new Date(c.created_at).toLocaleDateString('pt-BR');
            const isActive = c._id === currentCompanyId;

            const crmBadge = c.crm_enabled ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-inactive">Inativo</span>';
            const excelBadge = c.allow_excel_export !== false ? '<span class="badge badge-active">Permitido</span>' : '<span class="badge badge-inactive">Bloqueado</span>';

            const btnSwitch = isActive ? 
                '<span class="badge badge-active">Empresa Ativa</span>' :
                `<button class="btn-primary btn-small btn-switch-company-row" data-id="${c._id}" data-name="${c.name}" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.75rem;">Ativar</button>`;

            const btnEdit = `<button class="btn-icon btn-icon-edit btn-edit-company" data-id="${c._id}" data-name="${c.name}" title="Editar Cliente">
                                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>
                             </button>`;

            const btnDelete = `<button class="btn-icon btn-icon-delete btn-delete-company" data-id="${c._id}" data-name="${c.name}" title="Excluir Cliente e Dados">
                                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                               </button>`;

            const row = `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${crmBadge}</td>
                    <td>${excelBadge}</td>
                    <td>${date}</td>
                    <td>${btnSwitch} ${btnEdit} ${btnDelete}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        tableBody.querySelectorAll('.btn-switch-company-row').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const res = await window.api.switchCompany(id);
                if (res.success) {
                    if (res.token) localStorage.setItem('token', res.token);
                    localStorage.setItem('current_company_id', id);
                    document.getElementById('headerCompanyName').textContent = name;
                    if (res.activeCompany) {
                        activeCompanyConfig.crm_enabled = !!res.activeCompany.crm_enabled;
                        activeCompanyConfig.allow_excel_export = res.activeCompany.allow_excel_export !== false;
                        updateCompanyFeaturesUI();
                    }
                    await loadCompaniesAdminTable();
                    reloadCurrentTab();
                } else {
                    alert('Erro ao ativar empresa: ' + res.error);
                }
            });
        });

        tableBody.querySelectorAll('.btn-edit-company').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openCompanyModal(id, name);
            });
        });

        tableBody.querySelectorAll('.btn-delete-company').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                if (confirm(`ATENÇÃO: Deseja realmente excluir o cliente "${name}"? Todos os locais, cidades e termos associados a este cliente serão PERMANENTEMENTE apagados.`)) {
                    const res = await window.api.deleteCompany(id);
                    if (res.success) {
                        await loadCompaniesAdminTable();
                        loadCompaniesInUserSelect();
                        reloadCurrentTab();
                    } else {
                        alert('Erro ao excluir empresa: ' + res.error);
                    }
                }
            });
        });

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar lista de empresas.</td></tr>';
    }
}

if (closeCompaniesListModal) closeCompaniesListModal.addEventListener('click', hideCompaniesListModal);
if (btnCloseCompaniesListModal) btnCloseCompaniesListModal.addEventListener('click', hideCompaniesListModal);
if (btnOpenNewCompanyModal) btnOpenNewCompanyModal.addEventListener('click', () => openCompanyModal());

// --- AUTENTICAÇÃO E LOGIN ---
const formLogin = document.getElementById('formLogin');
const loginError = document.getElementById('loginError');

if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const btn = formLogin.querySelector('button');
        
        if (!email || !password) return;
        
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        loginError.classList.add('hidden');
        
        try {
            const res = await window.api.login(email, password);
            if (res.token) {
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify(res.user));
                if (res.user.current_company_id) {
                    localStorage.setItem('current_company_id', res.user.current_company_id);
                }
                window.location.reload();
            } else {
                throw new Error(res.error || 'Falha no login');
            }
        } catch (error) {
            loginError.textContent = error.message || 'E-mail ou senha inválidos.';
            loginError.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('current_company_id');
        window.location.reload();
    });
}

// --- MENU DO USUÁRIO E DROPDOWN ---
const btnUserMenu = document.getElementById('btnUserMenu');
const userDropdown = document.getElementById('userDropdown');

if (btnUserMenu && userDropdown) {
    btnUserMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !btnUserMenu.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}

// --- MODAL DE PERFIL ---
const profileModal = document.getElementById('profileModal');
const btnProfile = document.getElementById('btnProfile');
const closeProfileModal = document.getElementById('closeProfileModal');
const btnProfileCancel = document.getElementById('btnProfileCancel');
const formProfile = document.getElementById('formProfile');
const profileError = document.getElementById('profileError');
const profileSuccess = document.getElementById('profileSuccess');

// --- MODAL DE ARQUIVOS, STATUS E VALIDADE DA EMPRESA ---
const btnCompanyFiles = document.getElementById('btnCompanyFiles');
const companyFilesModal = document.getElementById('companyFilesModal');
const closeCompanyFilesModal = document.getElementById('closeCompanyFilesModal');
const btnCloseCompanyFilesModal = document.getElementById('btnCloseCompanyFilesModal');
const companyFilesTableBody = document.getElementById('companyFilesTableBody');

function hideCompanyFilesModal() {
    if (companyFilesModal) {
        companyFilesModal.classList.remove('show');
        setTimeout(() => { companyFilesModal.style.display = 'none'; }, 300);
    }
}

async function openCompanyFilesModal() {
    if (!companyFilesModal || !companyFilesTableBody) return;

    if (userDropdown) userDropdown.classList.add('hidden');
    companyFilesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">Carregando relatórios...</td></tr>';
    companyFilesModal.style.display = 'flex';
    setTimeout(() => { companyFilesModal.classList.add('show'); }, 10);

    try {
        const res = await window.api.getExportJobs();
        const jobs = res.data || [];
        companyFilesTableBody.innerHTML = '';

        if (jobs.length === 0) {
            companyFilesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">Nenhum arquivo ou relatório gerado até o momento.</td></tr>';
            return;
        }

        const now = Date.now();
        const RETENTION_DAYS = 30;

        jobs.forEach(job => {
            const dateStr = job.created_at ? new Date(job.created_at).toLocaleString('pt-BR') : 'N/A';
            const typeLabel = job.type === 'excel' ? '📊 Excel (.xlsx)' : '🚀 Envio CRM';
            const totalStr = `${job.processed_items || 0} / ${job.total_items || 0}`;

            let statusBadge = '<span class="badge badge-inactive">Pendente</span>';
            if (job.status === 'completed') {
                statusBadge = '<span class="badge badge-active">Concluído</span>';
            } else if (job.status === 'processing') {
                statusBadge = '<span class="badge" style="background: #3b82f6; color: white;">Em Progresso...</span>';
            } else if (job.status === 'failed') {
                statusBadge = `<span class="badge" style="background: #ef4444; color: white;" title="${job.error_message || ''}">Falhou</span>`;
            }

            let validityBadge = '<span style="color: var(--text-secondary); font-size: 0.8rem;">-</span>';
            let isDownloadable = false;

            if (job.created_at) {
                const createdAtMs = new Date(job.created_at).getTime();
                const expiresAtMs = createdAtMs + (RETENTION_DAYS * 24 * 60 * 60 * 1000);
                const daysRemaining = Math.ceil((expiresAtMs - now) / (1000 * 60 * 60 * 24));
                const expDateStr = new Date(expiresAtMs).toLocaleDateString('pt-BR');

                if (daysRemaining > 0) {
                    isDownloadable = true;
                    validityBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);" title="Válido até ${expDateStr}">
                        Válido (${daysRemaining}d restantes)
                    </span>`;
                } else {
                    validityBadge = `<span class="badge badge-inactive" title="Expirou em ${expDateStr}">Expirado (+30d)</span>`;
                }
            }

            let downloadBtn = '';
            if (job.type === 'excel' && job.file_url && isDownloadable && job.status === 'completed') {
                downloadBtn = `<a href="${job.file_url}" target="_blank" class="btn-primary btn-small" style="text-decoration: none; padding: 0.3rem 0.68rem; font-size: 0.75rem; width: auto;">📥 Baixar</a>`;
            }

            const deleteBtn = `<button class="btn-icon btn-icon-delete btn-delete-export-job" data-id="${job._id}" title="Excluir Registro">
                                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                              </button>`;

            const row = `
                <tr>
                    <td><strong>${typeLabel}</strong></td>
                    <td style="font-size: 0.85rem;">${dateStr}</td>
                    <td>${totalStr}</td>
                    <td>${statusBadge}</td>
                    <td>${validityBadge}</td>
                    <td>${downloadBtn} ${deleteBtn}</td>
                </tr>
            `;
            companyFilesTableBody.insertAdjacentHTML('beforeend', row);
        });

        companyFilesTableBody.querySelectorAll('.btn-delete-export-job').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (confirm('Deseja excluir este registro de relatório?')) {
                    const res = await window.api.deleteExportJob(id);
                    if (res.success) {
                        await openCompanyFilesModal();
                    } else {
                        alert('Erro ao excluir registro: ' + res.error);
                    }
                }
            });
        });

    } catch (e) {
        console.error(e);
        companyFilesTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar arquivos da empresa.</td></tr>';
    }
}

if (btnCompanyFiles) btnCompanyFiles.addEventListener('click', openCompanyFilesModal);
if (closeCompanyFilesModal) closeCompanyFilesModal.addEventListener('click', hideCompanyFilesModal);
if (btnCloseCompanyFilesModal) btnCloseCompanyFilesModal.addEventListener('click', hideCompanyFilesModal);

function hideProfileModal() {
    profileModal.classList.remove('show');
    setTimeout(() => { profileModal.style.display = 'none'; }, 300);
}

if (btnProfile && profileModal) {
    btnProfile.addEventListener('click', () => {
        userDropdown.classList.add('hidden');
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('profileName').value = currentUser.name || '';
        document.getElementById('profileCurrentPassword').value = '';
        document.getElementById('profileNewPassword').value = '';
        document.getElementById('profileConfirmPassword').value = '';
        profileError.classList.add('hidden');
        profileSuccess.style.display = 'none';
        
        profileModal.style.display = 'flex';
        setTimeout(() => { profileModal.classList.add('show'); }, 10);
    });
    
    closeProfileModal.addEventListener('click', hideProfileModal);
    btnProfileCancel.addEventListener('click', hideProfileModal);
    
    document.getElementById('btnProfileSave').addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const currentPassword = document.getElementById('profileCurrentPassword').value.trim();
        const newPassword = document.getElementById('profileNewPassword').value.trim();
        const confirmPassword = document.getElementById('profileConfirmPassword').value.trim();
        
        profileError.classList.add('hidden');
        profileSuccess.style.display = 'none';
        
        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                profileError.textContent = 'A senha atual é obrigatória para definir uma nova senha.';
                profileError.classList.remove('hidden');
                return;
            }
            if (newPassword !== confirmPassword) {
                profileError.textContent = 'A nova senha e a confirmação não conferem.';
                profileError.classList.remove('hidden');
                return;
            }
        }
        
        try {
            const data = { name, currentPassword, newPassword };
            const res = await window.api.updateProfile(data);
            if (res.success) {
                profileSuccess.style.display = 'block';
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.name = name;
                localStorage.setItem('user', JSON.stringify(user));
                document.getElementById('headerUserName').textContent = (name || user.email).charAt(0).toUpperCase();
                document.getElementById('dropdownUserName').textContent = name || 'Usuário';
                setTimeout(() => { hideProfileModal(); }, 1500);
            } else {
                profileError.textContent = res.error || 'Erro ao atualizar perfil.';
                profileError.classList.remove('hidden');
            }
        } catch (error) {
            profileError.textContent = error.message || 'Erro interno ao atualizar perfil.';
            profileError.classList.remove('hidden');
        }
    });
}

// --- MODAL SOBRE ---
const aboutModal = document.getElementById('aboutModal');
const btnAbout = document.getElementById('btnAbout');
const closeAboutModal = document.getElementById('closeAboutModal');

function hideAboutModal() {
    aboutModal.classList.remove('show');
    setTimeout(() => { aboutModal.style.display = 'none'; }, 300);
}

if (btnAbout && aboutModal) {
    btnAbout.addEventListener('click', () => {
        userDropdown.classList.add('hidden');
        aboutModal.style.display = 'flex';
        setTimeout(() => { aboutModal.classList.add('show'); }, 10);
    });
    closeAboutModal.addEventListener('click', hideAboutModal);
}

// --- DROPDOWN LINKS ADMIN ---
const btnDropdownNewUser = document.getElementById('btnDropdownNewUser');
if (btnDropdownNewUser) {
    btnDropdownNewUser.addEventListener('click', () => {
        userDropdown.classList.add('hidden');
        const usersTabBtn = document.getElementById('usersTabBtn');
        if (usersTabBtn) usersTabBtn.click();
        document.getElementById('userEmail').focus();
    });
}

const btnDropdownAllUsers = document.getElementById('btnDropdownAllUsers');
if (btnDropdownAllUsers) {
    btnDropdownAllUsers.addEventListener('click', () => {
        userDropdown.classList.add('hidden');
        const usersTabBtn = document.getElementById('usersTabBtn');
        if (usersTabBtn) usersTabBtn.click();
        document.querySelector('.admin-table').scrollIntoView({ behavior: 'smooth' });
    });
}

// --- CRUD: USUÁRIOS ---
const formUser = document.getElementById('formUser');
if (formUser) {
    formUser.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('userName');
        const emailInput = document.getElementById('userEmail');
        const passwordInput = document.getElementById('userPassword');
        const canCreateInput = document.getElementById('userCanCreateUsers');
        const userCompanySelect = document.getElementById('userCompany');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const can_create_users = canCreateInput.checked;
        const company_id = userCompanySelect ? userCompanySelect.value : null;
        
        if (!email || !password) return;
        
        const btn = formUser.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        
        try {
            const res = await window.api.createUser({ name, email, password, can_create_users, company_id });
            if (res.success) {
                emailInput.value = '';
                passwordInput.value = '';
                canCreateInput.checked = false;
                await loadUsersAdmin();
            } else {
                alert('Erro ao criar usuário: ' + (res.error || 'Erro desconhecido.'));
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao cadastrar usuário. Verifique se o e-mail já existe.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar Usuário';
        }
    });
}

async function loadUsersAdmin() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">Carregando usuários...</td></tr>';
    
    try {
        const res = await window.api.getUsers();
        const users = res.data || [];
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const isMaster = !!currentUser.is_master;

        const thUserCompany = document.getElementById('thUserCompany');
        if (thUserCompany) {
            thUserCompany.classList.toggle('hidden', !isMaster);
        }

        tableBody.innerHTML = '';
        
        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">Nenhum usuário encontrado.</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const date = new Date(user.created_at).toLocaleDateString('pt-BR');
            const roleBadge = user.is_master ? 
                '<span class="badge badge-master">Master</span>' : 
                (user.can_create_users ? '<span class="badge badge-active">Admin</span>' : '<span class="badge badge-inactive">Comum</span>');
            
            const isSelf = currentUser.email === user.email;
            
            const companyTd = isMaster ? `<td><span class="badge" style="background: rgba(255,255,255,0.08);">${user.company_name || 'N/A'}</span></td>` : '';

            const btnEdit = `<button class="btn-icon btn-icon-edit btn-edit-user" data-id="${user._id}" data-name="${user.name||''}" data-email="${user.email}" data-admin="${user.can_create_users}" data-company="${user.company_id||''}" title="Editar Usuário">
                                <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                             </button>`;

            const btnDelete = isSelf ? 
                '<span style="font-size: 0.8rem; color: var(--text-secondary);">Você</span>' :
                `<button class="btn-icon btn-icon-delete btn-delete-user" data-id="${user._id}" data-email="${user.email}" title="Excluir Usuário">
                    <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                 </button>`;
            
            const row = `
                <tr>
                    <td><strong>${user.name || 'Usuário'}</strong></td>
                    <td>${user.email}</td>
                    ${companyTd}
                    <td>${roleBadge}</td>
                    <td>${date}</td>
                    <td>${btnEdit} ${btnDelete}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const email = btn.getAttribute('data-email');
                if (confirm(`Deseja realmente excluir o usuário "${email}"?`)) {
                    try {
                        const res = await window.api.deleteUser(id);
                        if (res.success || res.message === 'Usuário deletado') {
                            await loadUsersAdmin();
                        } else {
                            alert('Erro ao excluir: ' + (res.error || 'Desconhecido'));
                        }
                    } catch (e) {
                        alert('Erro ao excluir usuário.');
                    }
                }
            });
        });
        
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const email = btn.getAttribute('data-email');
                const isAdmin = btn.getAttribute('data-admin') === 'true';
                const companyId = btn.getAttribute('data-company');
                
                openUserEditModal(id, name, email, isAdmin, companyId);
            });
        });
        
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Erro ao obter lista de usuários.</td></tr>';
    }
}

async function openUserEditModal(id, currentName, currentEmail, currentAdmin, currentCompanyId) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const btnSave = document.getElementById('btnModalSave');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isMaster = !!currentUser.is_master;
    
    modalTitle.textContent = 'Editar Usuário';
    
    let companySelectHtml = '';
    if (isMaster) {
        const companiesRes = await window.api.getCompanies();
        const companies = companiesRes.data || [];
        companySelectHtml = `
            <div class="form-group">
                <label>Empresa / Cliente</label>
                <select id="editUserCompany">
                    ${companies.map(c => `<option value="${c._id}" ${c._id === currentCompanyId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    
    const bodyHtml = `
        <div class="form-group">
            <label>Nome</label>
            <input type="text" id="editUserName" value="${currentName || ''}" placeholder="Nome do usuário">
        </div>
        <div class="form-group">
            <label>E-mail</label>
            <input type="email" id="editUserEmail" value="${currentEmail}" placeholder="Ex: colaborador@empresa.com">
        </div>
        ${companySelectHtml}
        <div class="form-group">
            <label>Nova Senha (Deixe em branco para não alterar)</label>
            <input type="password" id="editUserPassword" placeholder="••••••••">
        </div>
        <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px;">
            <input type="checkbox" id="editUserAdmin" style="width: auto; margin: 0;" ${currentAdmin ? 'checked' : ''}>
            <label for="editUserAdmin" style="margin: 0; font-weight: normal; cursor: pointer;">Administrador</label>
        </div>
        <div id="editUserError" class="login-error hidden" style="margin-top:1rem;"></div>
    `;
    modalBody.innerHTML = bodyHtml;
    
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
    
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);
    
    newBtnSave.addEventListener('click', async () => {
        const name = document.getElementById('editUserName').value.trim();
        const email = document.getElementById('editUserEmail').value.trim();
        const password = document.getElementById('editUserPassword').value.trim();
        const isAdmin = document.getElementById('editUserAdmin').checked;
        const companySelect = document.getElementById('editUserCompany');
        const company_id = companySelect ? companySelect.value : undefined;
        const errDiv = document.getElementById('editUserError');
        
        errDiv.classList.add('hidden');
        newBtnSave.disabled = true;
        newBtnSave.textContent = 'Salvando...';
        
        try {
            const data = { name, email, can_create_users: isAdmin };
            if (password) data.password = password;
            if (company_id) data.company_id = company_id;
            
            const res = await window.api.updateUser(id, data);
            if (res.success) {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
                await loadUsersAdmin();
            } else {
                errDiv.textContent = res.error || 'Erro ao editar usuário.';
                errDiv.classList.remove('hidden');
            }
        } catch (error) {
            errDiv.textContent = 'Erro interno ao editar usuário.';
            errDiv.classList.remove('hidden');
        } finally {
            newBtnSave.disabled = false;
            newBtnSave.textContent = 'Salvar Alterações';
        }
    });
}

// Ligar eventos de filtro das abas administrativas
const filterActivityName = document.getElementById('filterActivityName');
if (filterActivityName) {
    filterActivityName.addEventListener('input', () => loadActivitiesAdmin());
}
const filterCityName = document.getElementById('filterCityName');
if (filterCityName) {
    filterCityName.addEventListener('input', () => loadCitiesAdmin());
}
const filterCityState = document.getElementById('filterCityState');
if (filterCityState) {
    filterCityState.addEventListener('change', () => loadCitiesAdmin());
}

window.onload = init;
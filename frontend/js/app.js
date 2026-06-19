const btnSearch = document.getElementById('btnSearch');
const btnClear = document.getElementById('btnClear');
const placesGrid = document.getElementById('placesGrid');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageIndicator = document.getElementById('pageIndicator');
const filterLimit = document.getElementById('filterLimit');

let currentPage = 1;
let totalResults = 0;

async function loadPlaces(isNewSearch = false) {
    if (isNewSearch) {
        currentPage = 1;
    }

    const limit = parseInt(filterLimit.value) || 50;

    const filters = {
        nome: document.getElementById('filterNome').value,
        tipo: document.getElementById('filterTipo').value,
        cidade: document.getElementById('filterCidade').value,
        bairro: document.getElementById('filterBairro').value,
        ratingMin: document.getElementById('filterRatingMin').value,
        ratingMax: document.getElementById('filterRatingMax').value,
        totalAvaliacoesMin: document.getElementById('filterTotalMin').value,
        totalAvaliacoesMax: document.getElementById('filterTotalMax').value,
        businessStatus: document.getElementById('filterStatus').value,
        page: currentPage,
        limit: limit
    };

    // Chama a função exposta pelo preload.js
    const response = await window.api.getPlaces(filters);
    const places = response.data || [];
    totalResults = response.total || 0;

    placesGrid.innerHTML = ''; // Limpa a lista

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
        const isImported = place.importado ? 'checked' : '';

        const card = `
            <div class="place-card">
                <div class="card-header">
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
                
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-icon">📍</span>
                        <span>${place.endereco_completo || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-icon">📞</span>
                        <span>${place.telefone || 'N/A'}</span>
                    </div>
                    ${hasValidWebsite ? `
                    <div class="website-container">
                        <a href="${place.website}" target="_blank" class="website-link">Visitar Site ↗</a>
                    </div>` : ''}
                </div>

                <div class="card-footer">
                    <span class="status-badge ${statusClass}">${formattedStatus}</span>
                    <label class="imported-checkbox" title="Marcar como importado no CRM">
                        <input type="checkbox" class="chk-imported" data-place-id="${place.place_id}" ${isImported}>
                        <span>CRM</span>
                    </label>
                    <button class="btn-update" data-place-id="${place.place_id}" title="Atualizar dados do Google Maps" style="margin-right: 0;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-refresh"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.58 5.58"/></svg>
                    </button>
                </div>
            </div>
        `;
        placesGrid.insertAdjacentHTML('beforeend', card);
    });

    updatePagination(limit);
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
                await loadPlaces(); // Recarrega para mostrar os novos dados
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

placesGrid.addEventListener('change', async (e) => {
    if (e.target.classList.contains('chk-imported')) {
        const placeId = e.target.getAttribute('data-place-id');
        const isImported = e.target.checked;
        
        try {
            const result = await window.api.updateImportedStatus(placeId, isImported);
            if (!result.success) {
                alert('Erro ao atualizar status no CRM: ' + result.error);
                e.target.checked = !isImported; // Reverte o estado em caso de erro
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro inesperado ao atualizar status.');
            e.target.checked = !isImported; // Reverte o estado em caso de erro
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
        
        // Carrega dados conforme a aba ativa
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
    
    // Clonagem para remover listeners anteriores e evitar duplicidade
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

closeModal.addEventListener('click', hideModal);
btnModalCancel.addEventListener('click', hideModal);
window.addEventListener('click', (e) => {
    if (e.target === editModal) hideModal();
});

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
        
        // Aplica o filtro de pesquisa
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
        
        // Listeners das ações de atividades
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
        
        // Popula o select de estados
        const stateSelect = document.getElementById('filterCityState');
        if (stateSelect && stateSelect.options.length <= 1 && cities.length > 0) {
            const states = [...new Set(cities.map(c => c.estado))].sort();
            states.forEach(st => {
                stateSelect.insertAdjacentHTML('beforeend', `<option value="${st}">${st}</option>`);
            });
        }

        // Aplica os filtros
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
                                        ✨ Auto-Gerar Bairros com IA
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
        
        // Listeners do Accordion
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // ignora botões de editar/excluir
                
                const item = header.closest('.accordion-item');
                const isOpen = item.classList.contains('open');
                
                // Fecha outros
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
        
        // Ações de editar/deletar cidade
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
        
        // Submit dos formulários de bairro individuais
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
        
        // Auto-Geração de Bairros via IA
        document.querySelectorAll('.btn-generate-bairros-ai').forEach(btn => {
            btn.addEventListener('click', async () => {
                const municipio = btn.getAttribute('data-municipio');
                const estado = btn.getAttribute('data-estado');
                const listBody = btn.closest('.accordion-content').querySelector('.list-bairros-body');
                
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '⌛ Gerando Bairros (Aguarde)...';
                
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

// --- CRUD: BAIRROS (DENTRO DA LISTAGEM ACCORDION) ---
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
        
        // Listeners de ações de bairro
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

// --- FUNÇÃO AUXILIAR PARA RECARREGAR SELECT DO FILTRO PRINCIPAL ---
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
        console.error('Erro ao recarregar filtros:', e);
    }
}

const engineSelectActivity = document.getElementById('engineSelectActivity');
const engineSelectState = document.getElementById('engineSelectState');
const engineSelectCity = document.getElementById('engineSelectCity');
const engineBairrosList = document.getElementById('engineBairrosList');
const btnEngineStart = document.getElementById('btnEngineStart');
const btnEnginePause = document.getElementById('btnEnginePause');
const btnEngineStop = document.getElementById('btnEngineStop');
const btnClearLogs = document.getElementById('btnClearLogs');
const engineConsole = document.getElementById('engineConsole');
const engineCurrentStatus = document.getElementById('engineCurrentStatus');
const engineProgressText = document.getElementById('engineProgressText');
const engineProgressBar = document.getElementById('engineProgressBar');

let isEngineRunning = false;
let isEnginePaused = false;

// Helpers de Log
function addEngineLog(message, type = 'system') {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = `[${time}] ${message}`;
    engineConsole.appendChild(div);
    engineConsole.scrollTop = engineConsole.scrollHeight;
}

if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
        engineConsole.innerHTML = '<div class="log-entry log-system">Logs limpos.</div>';
    });
}

// Carregar Dados para o Engine
async function loadEngineConfigData() {
    if (!engineSelectActivity || !engineSelectState) return;
    
    try {
        // Atividades
        const activities = await window.api.getActivitiesList();
        const activeActivities = activities.filter(a => a.ativa === 'V');
        engineSelectActivity.innerHTML = '<option value="">Selecione a Atividade</option>';
        if (activeActivities.length === 0) {
            engineSelectActivity.innerHTML = '<option value="">Nenhuma atividade ativa</option>';
        } else {
            activeActivities.forEach(act => {
                engineSelectActivity.insertAdjacentHTML('beforeend', `<option value="${act.nome}">${act.nome}</option>`);
            });
        }

        // Cidades e Estados
        const cities = await window.api.getCities();
        engineSelectState.innerHTML = '<option value="">Selecione o Estado</option>';
        engineSelectCity.innerHTML = '<option value="">Selecione um estado primeiro</option>';
        engineSelectCity.disabled = true;
        engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Selecione uma cidade para carregar os bairros...</p>';

        if (cities.length === 0) {
            engineSelectState.innerHTML = '<option value="">Nenhuma cidade cadastrada</option>';
        } else {
            const states = [...new Set(cities.map(c => c.estado))].sort();
            states.forEach(st => {
                engineSelectState.insertAdjacentHTML('beforeend', `<option value="${st}">${st}</option>`);
            });

            // Lógica para quando selecionar o Estado
            engineSelectState.addEventListener('change', () => {
                const selectedState = engineSelectState.value;
                engineSelectCity.innerHTML = '<option value="">Selecione a Cidade</option>';
                engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Selecione uma cidade para carregar os bairros...</p>';

                if (selectedState) {
                    const stateCities = cities.filter(c => c.estado === selectedState).sort((a, b) => a.municipio.localeCompare(b.municipio));
                    stateCities.forEach(city => {
                        engineSelectCity.insertAdjacentHTML('beforeend', `<option value="${city.municipio}">${city.municipio}</option>`);
                    });
                    engineSelectCity.disabled = false;
                } else {
                    engineSelectCity.innerHTML = '<option value="">Selecione um estado primeiro</option>';
                    engineSelectCity.disabled = true;
                }
            });

            // Lógica para quando selecionar a Cidade
            engineSelectCity.addEventListener('change', async () => {
                const selectedState = engineSelectState.value;
                const selectedCity = engineSelectCity.value;

                if (selectedCity && selectedState) {
                    engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Carregando bairros...</p>';
                    try {
                        const bairros = await window.api.getNeighborhoods(selectedCity, selectedState);
                        engineBairrosList.innerHTML = '';
                        
                        if (bairros.length === 0) {
                            engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Nenhum bairro cadastrado para esta cidade.</p>';
                        } else {
                            // Adicionar opção de "Selecionar Todos"
                            engineBairrosList.innerHTML = `
                                <label class="engine-checkbox-item" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                                    <input type="checkbox" id="chkSelectAllBairros">
                                    <span style="font-weight: 600;">Selecionar Todos</span>
                                </label>
                            `;
                            
                            bairros.forEach(b => {
                                const item = `
                                    <label class="engine-checkbox-item">
                                        <input type="checkbox" class="chk-engine-bairro" value="${b.bairro}">
                                        <span>${b.bairro} <span style="opacity:0.5; font-size: 0.75rem;">(${b.genero || 'N'})</span></span>
                                    </label>
                                `;
                                engineBairrosList.insertAdjacentHTML('beforeend', item);
                            });

                            // Lógica do Selecionar Todos
                            const chkSelectAll = document.getElementById('chkSelectAllBairros');
                            const chkBairros = document.querySelectorAll('.chk-engine-bairro');
                            
                            chkSelectAll.addEventListener('change', (e) => {
                                const isChecked = e.target.checked;
                                chkBairros.forEach(cb => cb.checked = isChecked);
                            });

                            chkBairros.forEach(cb => {
                                cb.addEventListener('change', () => {
                                    const allChecked = document.querySelectorAll('.chk-engine-bairro:checked').length === chkBairros.length;
                                    chkSelectAll.checked = allChecked;
                                });
                            });
                        }
                    } catch (err) {
                        engineBairrosList.innerHTML = '<p style="color: red; font-size: 0.85rem; padding: 0.5rem;">Erro ao carregar bairros.</p>';
                    }
                } else {
                    engineBairrosList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem;">Selecione uma cidade para carregar os bairros...</p>';
                }
            });
        }
        
        // Atualiza o status atual do backend
        await updateEngineUIStatus();

    } catch (e) {
        console.error('Erro ao carregar dados do Engine:', e);
        engineSelectActivity.innerHTML = '<option value="">Erro ao carregar</option>';
        engineSelectState.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// Atualizar UI com base no Status atual
async function updateEngineUIStatus() {
    try {
        const status = await window.api.getEngineStatus();
        
        if (status.status === 'searching') {
            engineCurrentStatus.textContent = 'Buscando';
            engineCurrentStatus.className = 'status-badge status-operational';
            isEngineRunning = true;
            isEnginePaused = false;
        } else if (status.status === 'paused') {
            engineCurrentStatus.textContent = 'Pausado';
            engineCurrentStatus.className = 'status-badge status-warning';
            isEngineRunning = true;
            isEnginePaused = true;
        } else {
            engineCurrentStatus.textContent = 'Parado';
            engineCurrentStatus.className = 'status-badge status-closed';
            isEngineRunning = false;
            isEnginePaused = false;
        }
        
        if (status.total > 0) {
            engineProgressText.textContent = `${status.completed} / ${status.total}`;
            const pct = Math.floor((status.completed / status.total) * 100);
            engineProgressBar.style.width = `${pct}%`;
        } else {
            engineProgressText.textContent = `0 / 0`;
            engineProgressBar.style.width = `0%`;
        }
        
        updateEngineButtons();
        
        // Se houver logs no status, renderiza
        if (status.logs && status.logs.length > 0) {
            engineConsole.innerHTML = '';
            status.logs.forEach(log => {
                const div = document.createElement('div');
                div.className = `log-entry log-${log.type}`;
                div.textContent = `[${log.time}] ${log.message}`;
                engineConsole.appendChild(div);
            });
            engineConsole.scrollTop = engineConsole.scrollHeight;
        }
    } catch (e) {
        console.error('Erro ao obter status:', e);
    }
}

function updateEngineButtons() {
    if (!isEngineRunning) {
        btnEngineStart.disabled = false;
        btnEngineStart.textContent = '▶ Iniciar Varredura';
        btnEnginePause.disabled = true;
        btnEngineStop.disabled = true;
    } else {
        btnEngineStart.disabled = true;
        btnEngineStop.disabled = false;
        btnEnginePause.disabled = false;
        
        if (isEnginePaused) {
            btnEnginePause.textContent = '▶ Retomar';
        } else {
            btnEnginePause.textContent = '⏸ Pausar';
        }
    }
}

// Ações dos Botões
if (btnEngineStart) {
    btnEngineStart.addEventListener('click', async () => {
        const selectedActivity = engineSelectActivity.value;
        const selectedState = engineSelectState.value;
        const selectedCity = engineSelectCity.value;
        const selectedBairros = Array.from(document.querySelectorAll('.chk-engine-bairro:checked')).map(cb => cb.value);
        
        if (!selectedActivity || !selectedState || !selectedCity) {
            alert('Por favor, selecione a atividade, o estado e a cidade.');
            return;
        }

        if (selectedBairros.length === 0) {
            if (!confirm('Nenhum bairro foi selecionado. Deseja realizar a busca apenas na cidade (sem focar em bairros)?')) {
                return;
            }
        }
        
        const queries = [];
        if (selectedBairros.length > 0) {
            selectedBairros.forEach(bairro => {
                queries.push({
                    term: selectedActivity,
                    city: selectedCity,
                    state: selectedState,
                    neighborhood: bairro
                });
            });
        } else {
            queries.push({
                term: selectedActivity,
                city: selectedCity,
                state: selectedState,
                neighborhood: null
            });
        }
        
        engineConsole.innerHTML = ''; // Limpa logs na nova busca
        addEngineLog(`Iniciando varredura para "${selectedActivity}" em ${selectedCity} - ${selectedState} (${selectedBairros.length > 0 ? selectedBairros.length + ' bairros' : 'cidade inteira'})...`, 'info');
        
        try {
            const res = await window.api.startEngine({
                queries: queries
            });
            
            if (res.success) {
                isEngineRunning = true;
                isEnginePaused = false;
                updateEngineButtons();
            } else {
                addEngineLog(`Erro ao iniciar: ${res.error}`, 'error');
                alert(res.error);
            }
        } catch (e) {
            addEngineLog(`Erro interno: ${e.message}`, 'error');
        }
    });
}

if (btnEnginePause) {
    btnEnginePause.addEventListener('click', async () => {
        if (isEnginePaused) {
            addEngineLog('Retomando varredura...', 'info');
            await window.api.resumeEngine();
            isEnginePaused = false;
        } else {
            addEngineLog('Pausando varredura...', 'warning');
            await window.api.pauseEngine();
            isEnginePaused = true;
        }
        updateEngineButtons();
        await updateEngineUIStatus();
    });
}

if (btnEngineStop) {
    btnEngineStop.addEventListener('click', async () => {
        if (confirm('Deseja realmente parar a varredura atual?')) {
            addEngineLog('Parando motor de busca...', 'warning');
            await window.api.stopEngine();
            isEngineRunning = false;
            isEnginePaused = false;
            updateEngineButtons();
            await updateEngineUIStatus();
        }
    });
}


// Listeners de Eventos IPC
window.api.onEngineProgress((data) => {
    // Atualiza status
    if (data.status) {
        if (data.status === 'searching') {
            engineCurrentStatus.textContent = 'Buscando';
            engineCurrentStatus.className = 'status-badge status-operational';
            isEngineRunning = true;
            isEnginePaused = false;
        } else if (data.status === 'paused') {
            engineCurrentStatus.textContent = 'Pausado';
            engineCurrentStatus.className = 'status-badge status-warning';
            isEngineRunning = true;
            isEnginePaused = true;
        } else if (data.status === 'idle') {
            engineCurrentStatus.textContent = 'Parado';
            engineCurrentStatus.className = 'status-badge status-closed';
            isEngineRunning = false;
            isEnginePaused = false;
        }
        updateEngineButtons();
    }
    
    // Atualiza progresso
    if (data.total !== undefined) {
        engineProgressText.textContent = `${data.completed} / ${data.total}`;
        if (data.total > 0) {
            const pct = Math.floor((data.completed / data.total) * 100);
            engineProgressBar.style.width = `${pct}%`;
        } else {
            engineProgressBar.style.width = `0%`;
        }
    }
    
    // Adiciona log
    if (data.log) {
        addEngineLog(data.log.message, data.log.type);
    }
});

window.api.onEngineFinished((data) => {
    addEngineLog(`Varredura concluída! Locais salvos nesta sessão: ${data.placesSaved}`, 'success');
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
    const btnLogout = document.getElementById('btnLogout');
    const usersTabBtn = document.getElementById('usersTabBtn');
    
    // Tenta validar a sessão
    try {
        const res = await window.api.checkSession();
        const user = res.user;
        // Sessão válida
        overlay.classList.add('hidden');
        
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
        
        // Se for admin, exibe a aba de usuários e as opções no dropdown
        if (user.can_create_users) {
            if (usersTabBtn) usersTabBtn.classList.remove('hidden');
            const liNewUser = document.getElementById('liNewUser');
            const liAllUsers = document.getElementById('liAllUsers');
            if (liNewUser) liNewUser.classList.remove('hidden');
            if (liAllUsers) liAllUsers.classList.remove('hidden');
        }
        
        await reloadActivitiesFilter();
        await loadPlaces(true);
    } catch (error) {
        // Sessão inválida ou não logado
        overlay.classList.remove('hidden');
    }
}

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
                window.location.reload(); // Recarrega para inicializar a aplicação logada
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

    // Fechar ao clicar fora
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
                // Atualizar o name no localStorage e na UI
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
        
        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const can_create_users = canCreateInput.checked;
        
        if (!email || !password) return;
        
        const btn = formUser.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        
        try {
            const res = await window.api.createUser({ name, email, password, can_create_users });
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
    
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem;">Carregando usuários...</td></tr>';
    
    try {
        const res = await window.api.getUsers();
        const users = res.data || [];
        tableBody.innerHTML = '';
        
        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem;">Nenhum usuário encontrado.</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const date = new Date(user.created_at).toLocaleDateString('pt-BR');
            const roleBadge = user.can_create_users ? 
                '<span class="badge badge-active">Sim</span>' : 
                '<span class="badge badge-inactive">Não</span>';
            
            // Não permite deletar a si mesmo (proteção básica front-end)
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const isSelf = currentUser.email === user.email;
            
            const btnEdit = `<button class="btn-icon btn-icon-edit btn-edit-user" data-id="${user._id}" data-name="${user.name||''}" data-email="${user.email}" data-admin="${user.can_create_users}" title="Editar Usuário">
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
                    <td>${roleBadge}</td>
                    <td>${date}</td>
                    <td>${btnEdit} ${btnDelete}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
        
        // Listeners das ações
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
                
                openUserEditModal(id, name, email, isAdmin);
            });
        });
        
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao obter lista de usuários.</td></tr>';
    }
}

function openUserEditModal(id, currentName, currentEmail, currentAdmin) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const btnSave = document.getElementById('btnModalSave');
    
    modalTitle.textContent = 'Editar Usuário';
    
    const bodyHtml = `
        <div class="form-group">
            <label>Nome</label>
            <input type="text" id="editUserName" value="${currentName || ''}" placeholder="Nome do usuário">
        </div>
        <div class="form-group">
            <label>E-mail</label>
            <input type="email" id="editUserEmail" value="${currentEmail}" placeholder="Ex: colaborador@empresa.com">
        </div>
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
    
    // Mostra o modal reutilizando a lógica existente
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
    
    // Define a ação de salvar (removendo event listeners anteriores usando clone)
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);
    
    newBtnSave.addEventListener('click', async () => {
        const name = document.getElementById('editUserName').value.trim();
        const email = document.getElementById('editUserEmail').value.trim();
        const password = document.getElementById('editUserPassword').value.trim();
        const isAdmin = document.getElementById('editUserAdmin').checked;
        const errDiv = document.getElementById('editUserError');
        
        errDiv.classList.add('hidden');
        newBtnSave.disabled = true;
        newBtnSave.textContent = 'Salvando...';
        
        try {
            const data = { name, email, can_create_users: isAdmin };
            if (password) data.password = password;
            
            const res = await window.api.updateUser(id, data);
            if (res.success) {
                // Fecha modal
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
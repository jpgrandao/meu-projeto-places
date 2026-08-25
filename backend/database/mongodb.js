const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://mongo:27017/seo_places';
const client = new MongoClient(uri);

let connectedClient = null;
async function getDb() {
    if (!connectedClient) {
        await client.connect();
        connectedClient = client;
    }
    return connectedClient.db('seo_places');
}

function toObjectId(id) {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    try {
        return new ObjectId(id);
    } catch (e) {
        return null;
    }
}

// --- COMPANIES (EMPRESAS / CLIENTES) ---

async function getCompanies() {
    try {
        const database = await getDb();
        return await database.collection('companies').find({ active: { $ne: false } }).sort({ name: 1 }).toArray();
    } catch (error) {
        console.error('Erro ao buscar empresas:', error);
        return [];
    }
}

async function getCompanyById(id) {
    try {
        const database = await getDb();
        const objId = toObjectId(id);
        if (!objId) return null;
        return await database.collection('companies').findOne({ _id: objId });
    } catch (error) {
        console.error('Erro ao buscar empresa por ID:', error);
        return null;
    }
}

async function createCompany(name, createdBy = null, options = {}) {
    try {
        if (!name || !name.trim()) {
            return { success: false, error: 'Nome da empresa é obrigatório.' };
        }
        const database = await getDb();
        const collection = database.collection('companies');

        const existing = await collection.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
        if (existing) {
            return { success: false, error: 'Já existe uma empresa cadastrada com este nome.' };
        }

        const doc = {
            name: name.trim(),
            active: true,
            allow_excel_export: options.allow_excel_export !== undefined ? !!options.allow_excel_export : true,
            crm_enabled: options.crm_enabled !== undefined ? !!options.crm_enabled : false,
            crm_provider: options.crm_provider || 'mz_partners',
            crm_config: options.crm_config || {
                client_token: '',
                channel_id: '',
                channel_type: 'WHATSAPP',
                department_uuid: '',
                agent_uuid: '',
                tag_uuid: ''
            },
            created_at: new Date(),
            created_by: toObjectId(createdBy)
        };

        const result = await collection.insertOne(doc);
        return { success: true, id: result.insertedId, name: doc.name };
    } catch (error) {
        console.error('Erro ao criar empresa:', error);
        return { success: false, error: error.message };
    }
}

async function updateCompany(id, updates) {
    try {
        const objId = toObjectId(id);
        if (!objId) return { success: false, error: 'ID de empresa inválido.' };

        const database = await getDb();
        const collection = database.collection('companies');

        const setObj = { updated_at: new Date() };
        if (updates.name !== undefined) setObj.name = updates.name.trim();
        if (updates.allow_excel_export !== undefined) setObj.allow_excel_export = !!updates.allow_excel_export;
        if (updates.crm_enabled !== undefined) setObj.crm_enabled = !!updates.crm_enabled;
        if (updates.crm_provider !== undefined) setObj.crm_provider = updates.crm_provider;
        if (updates.crm_config !== undefined) setObj.crm_config = updates.crm_config;

        await collection.updateOne({ _id: objId }, { $set: setObj });
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        return { success: false, error: error.message };
    }
}

async function deleteCompany(id) {
    try {
        const objId = toObjectId(id);
        if (!objId) return { success: false, error: 'ID de empresa inválido.' };

        const database = await getDb();
        
        await database.collection('places').deleteMany({ company_id: objId });
        await database.collection('activities').deleteMany({ company_id: objId });
        await database.collection('cities').deleteMany({ company_id: objId });
        await database.collection('neighborhoods').deleteMany({ company_id: objId });
        await database.collection('tags').deleteMany({ company_id: objId });
        await database.collection('export_jobs').deleteMany({ company_id: objId });
        await database.collection('users').deleteMany({ company_id: objId, is_master: { $ne: true } });
        
        await database.collection('companies').deleteOne({ _id: objId });

        return { success: true };
    } catch (error) {
        console.error('Erro ao excluir empresa:', error);
        return { success: false, error: error.message };
    }
}

// --- TAGS ---

async function getTags(companyId) {
    try {
        const database = await getDb();
        const cId = toObjectId(companyId);
        if (!cId) return [];
        return await database.collection('tags').find({ company_id: cId }).sort({ name: 1 }).toArray();
    } catch (error) {
        console.error('Erro ao buscar tags:', error);
        return [];
    }
}

async function createTag(tagDoc, companyId) {
    try {
        const cId = toObjectId(companyId);
        if (!cId) return { success: false, error: 'Empresa não informada.' };
        if (!tagDoc.name || !tagDoc.name.trim()) return { success: false, error: 'Nome da tag é obrigatório.' };

        const database = await getDb();
        const collection = database.collection('tags');

        const existing = await collection.findOne({ company_id: cId, name: { $regex: `^${tagDoc.name.trim()}$`, $options: 'i' } });
        if (existing) {
            return { success: false, error: 'Já existe uma tag com este nome para sua empresa.' };
        }

        const doc = {
            company_id: cId,
            name: tagDoc.name.trim(),
            color: tagDoc.color || '#3b82f6',
            created_at: new Date()
        };

        const result = await collection.insertOne(doc);
        return { success: true, id: result.insertedId, tag: doc };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateTag(id, updates, companyId) {
    try {
        const cId = toObjectId(companyId);
        const objId = toObjectId(id);
        if (!cId || !objId) return { success: false, error: 'IDs inválidos.' };

        const database = await getDb();
        const setObj = { updated_at: new Date() };
        if (updates.name) setObj.name = updates.name.trim();
        if (updates.color) setObj.color = updates.color;

        await database.collection('tags').updateOne({ _id: objId, company_id: cId }, { $set: setObj });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteTag(id, companyId) {
    try {
        const cId = toObjectId(companyId);
        const objId = toObjectId(id);
        if (!cId || !objId) return { success: false, error: 'IDs inválidos.' };

        const database = await getDb();
        await database.collection('tags').deleteOne({ _id: objId, company_id: cId });
        
        // Remove essa tag dos locais
        await database.collection('places').updateMany(
            { company_id: cId },
            { $pull: { tags: objId } }
        );

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function bulkApplyTags(placeIds = [], tagIds = [], action = 'add', companyId) {
    try {
        const cId = toObjectId(companyId);
        if (!cId) return { success: false, error: 'Empresa não definida.' };
        if (!Array.isArray(placeIds) || placeIds.length === 0) return { success: false, error: 'Nenhum local selecionado.' };
        if (!Array.isArray(tagIds) || tagIds.length === 0) return { success: false, error: 'Nenhuma tag selecionada.' };

        const database = await getDb();
        const tagObjectIds = tagIds.map(id => toObjectId(id)).filter(Boolean);

        const filter = { place_id: { $in: placeIds }, company_id: cId };
        const update = action === 'add' 
            ? { $addToSet: { tags: { $each: tagObjectIds } } }
            : { $pullAll: { tags: tagObjectIds } };

        const result = await database.collection('places').updateMany(filter, update);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- PLACES ---

async function getPlaces(filters = {}, companyId) {
    const database = await getDb();
    const collection = database.collection('places');

    const cId = toObjectId(companyId);
    const query = cId ? { company_id: cId } : {};
    
    // Seleção de IDs específicos (em lote)
    if (filters.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
        query.place_id = { $in: filters.ids };
    }

    if (filters.nome) {
        query.nome = { $regex: filters.nome, $options: 'i' };
    }
    if (filters.tipo) {
        query.tipo = { $regex: filters.tipo, $options: 'i' };
    }
    if (filters.cidade) {
        query.cidade = { $regex: filters.cidade, $options: 'i' };
    }
    if (filters.bairro) {
        query.bairro = { $regex: filters.bairro, $options: 'i' };
    }
    
    if (filters.ratingMin || filters.ratingMax) {
        query.rating = {};
        if (filters.ratingMin && !isNaN(parseFloat(filters.ratingMin))) {
            query.rating.$gte = parseFloat(filters.ratingMin);
        }
        if (filters.ratingMax && !isNaN(parseFloat(filters.ratingMax))) {
            query.rating.$lte = parseFloat(filters.ratingMax);
        }
    }

    if (filters.totalAvaliacoesMin || filters.totalAvaliacoesMax) {
        query.total_avaliacoes = {};
        if (filters.totalAvaliacoesMin && !isNaN(parseInt(filters.totalAvaliacoesMin))) {
            query.total_avaliacoes.$gte = parseInt(filters.totalAvaliacoesMin);
        }
        if (filters.totalAvaliacoesMax && !isNaN(parseInt(filters.totalAvaliacoesMax))) {
            query.total_avaliacoes.$lte = parseInt(filters.totalAvaliacoesMax);
        }
    }
    if (filters.businessStatus) {
        query.businessStatus = filters.businessStatus;
    }

    // Filtros de Status de CRM e Excel
    if (filters.crmStatus === 'exported') {
        query.$or = [{ importado: true }, { crm_exported: true }];
    } else if (filters.crmStatus === 'not_exported') {
        query.importado = { $ne: true };
        query.crm_exported = { $ne: true };
    }

    if (filters.excelStatus === 'exported') {
        query.excel_exported = true;
    } else if (filters.excelStatus === 'not_exported') {
        query.excel_exported = { $ne: true };
    }

    // Filtro por Tags
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        const tagObjectIds = filters.tags.map(t => toObjectId(t)).filter(Boolean);
        query.tags = { $in: tagObjectIds };
    } else if (filters.tags && typeof filters.tags === 'string' && filters.tags.trim()) {
        const tagObj = toObjectId(filters.tags.trim());
        if (tagObj) query.tags = tagObj;
    }

    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 50;
    const skip = (page - 1) * limit;

    const cursor = collection.find(query).skip(skip).limit(limit);
    const data = await cursor.toArray();
    const total = await collection.countDocuments(query);

    return { data, total };
}

async function getPlaceById(placeId, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('places');
        const cId = toObjectId(companyId);
        const query = { place_id: placeId };
        if (cId) query.company_id = cId;

        const place = await collection.findOne(query);
        return place;
    } catch (error) {
        console.error('Erro ao buscar local por ID:', error);
        return null;
    }
}

async function savePlaceDirectly(placeDoc, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('places');

        const cId = toObjectId(companyId);
        if (!cId) {
            return { success: false, error: 'Empresa (companyId) não definida ao salvar local.' };
        }

        const filter = { place_id: placeDoc.place_id, company_id: cId };
        
        const existing = await collection.findOne(filter);
        if (existing && existing.nome) {
            return { success: true, isNew: false, id: existing.place_id };
        }
        
        const docToUpdate = {
            $set: {
                ...placeDoc,
                company_id: cId,
                updated_at: new Date()
            },
            $setOnInsert: {
                created_at: new Date(),
                excel_exported: false,
                crm_exported: false,
                importado: false,
                tags: []
            }
        };
        
        const result = await collection.updateOne(filter, docToUpdate, { upsert: true });
        
        return { success: true, isNew: result.upsertedCount > 0 || !existing, id: placeDoc.place_id };
    } catch (error) {
        console.error('Erro ao salvar local diretamente:', error);
        return { success: false, error: error.message };
    }
}

async function updatePlaceFromGoogle(placeId, companyId) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'Chave da API do Google (GOOGLE_MAPS_API_KEY) não encontrada no .env' };
        }

        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,rating,user_ratings_total,business_status,website&key=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            return { success: false, error: `Erro na API do Google: ${data.status}` };
        }

        const result = data.result;
        
        const database = await getDb();
        const collection = database.collection('places');

        const cId = toObjectId(companyId);
        const filter = { place_id: placeId };
        if (cId) filter.company_id = cId;

        const updateDoc = {
            $set: {
                nome: result.name,
                endereco_completo: result.formatted_address,
                telefone: result.formatted_phone_number || 'N/A',
                rating: result.rating || 0,
                total_avaliacoes: result.user_ratings_total || 0,
                businessStatus: result.business_status || 'OPERATIONAL',
                website: result.website || 'N/A',
                updated_at: new Date()
            }
        };

        await collection.updateOne(filter, updateDoc);
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar local do Google:', error);
        return { success: false, error: error.message };
    }
}

async function updateImportedStatus(placeId, isImported, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('places');

        const cId = toObjectId(companyId);
        const filter = { place_id: placeId };
        if (cId) filter.company_id = cId;

        const updateDoc = {
            $set: {
                importado: isImported,
                crm_exported: isImported,
                crm_exported_at: isImported ? new Date() : null,
                updated_at: new Date()
            }
        };

        await collection.updateOne(filter, updateDoc);
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status de importação:', error);
        return { success: false, error: error.message };
    }
}

async function markPlacesAsExcelExported(placeIds = [], companyId) {
    try {
        const database = await getDb();
        const cId = toObjectId(companyId);
        if (!cId || !Array.isArray(placeIds) || placeIds.length === 0) return { success: false };

        await database.collection('places').updateMany(
            { place_id: { $in: placeIds }, company_id: cId },
            { $set: { excel_exported: true, excel_exported_at: new Date() } }
        );
        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar locais como exportados para Excel:', error);
        return { success: false, error: error.message };
    }
}

// --- EXPORT JOBS (FILA DE EXPORTAÇÃO E COOLDOWN) ---

async function createExportJob(jobDoc) {
    try {
        const database = await getDb();
        const doc = {
            company_id: toObjectId(jobDoc.company_id),
            type: jobDoc.type, // 'excel' | 'crm'
            status: 'pending', // 'pending' | 'processing' | 'completed' | 'failed'
            total_items: jobDoc.total_items || 0,
            processed_items: 0,
            filters: jobDoc.filters || {},
            place_ids: jobDoc.place_ids || [],
            file_url: null,
            file_path: null,
            error_message: null,
            created_at: new Date(),
            finished_at: null,
            cooldown_until: null
        };

        const result = await database.collection('export_jobs').insertOne(doc);
        return { success: true, id: result.insertedId, job: { _id: result.insertedId, ...doc } };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateExportJob(id, updates) {
    try {
        const database = await getDb();
        const objId = toObjectId(id);
        if (!objId) return false;

        const setObj = { ...updates };
        await database.collection('export_jobs').updateOne({ _id: objId }, { $set: setObj });
        return true;
    } catch (error) {
        console.error('Erro ao atualizar job de exportação:', error);
        return false;
    }
}

async function getLatestExportJob(companyId, type = null) {
    try {
        const database = await getDb();
        const cId = toObjectId(companyId);
        if (!cId) return null;

        const query = { company_id: cId };
        if (type) query.type = type;

        return await database.collection('export_jobs').find(query).sort({ created_at: -1 }).limit(1).toArray().then(arr => arr[0] || null);
    } catch (error) {
        console.error('Erro ao buscar último job de exportação:', error);
        return null;
    }
}

async function getExportJobs(companyId) {
    try {
        const database = await getDb();
        const cId = toObjectId(companyId);
        if (!cId) return [];

        return await database.collection('export_jobs').find({ company_id: cId }).sort({ created_at: -1 }).limit(50).toArray();
    } catch (error) {
        return [];
    }
}

async function deleteExportJob(id, companyId) {
    try {
        const database = await getDb();
        const cId = toObjectId(companyId);
        const objId = toObjectId(id);
        if (!cId || !objId) return { success: false, error: 'IDs inválidos.' };

        const job = await database.collection('export_jobs').findOne({ _id: objId, company_id: cId });
        if (job && job.file_path) {
            const fs = require('fs');
            const fullPath = path.join(__dirname, '../frontend/downloads', path.basename(job.file_path));
            if (fs.existsSync(fullPath)) {
                try { fs.unlinkSync(fullPath); } catch (e) {}
            }
        }

        await database.collection('export_jobs').deleteOne({ _id: objId, company_id: cId });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- ACTIVITIES (ATIVIDADES / TERMOS DE BUSCA) ---

async function getActivities(companyId) {
    const database = await getDb();
    const collection = database.collection('activities');
    const cId = toObjectId(companyId);
    const query = cId ? { company_id: cId } : {};

    const cursor = collection.find(query).sort({ nome: 1 });
    return await cursor.toArray();
}

async function addActivity(activity, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        const cId = toObjectId(companyId);

        const doc = {
            nome: activity.nome,
            ativa: activity.ativa || 'V',
            company_id: cId,
            created_at: new Date()
        };
        const result = await collection.updateOne(
            { nome: doc.nome, company_id: cId },
            { $set: doc },
            { upsert: true }
        );
        return { success: true, id: result.upsertedId || null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateActivity(id, activity, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        const updateDoc = {
            $set: {
                nome: activity.nome,
                ativa: activity.ativa,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne(filter, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteActivity(id, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        await collection.deleteOne(filter);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- CITIES (CIDADES) ---

async function getCities(companyId) {
    const database = await getDb();
    const collection = database.collection('cities');
    const cId = toObjectId(companyId);
    const query = cId ? { company_id: cId } : {};

    return await collection.find(query).sort({ municipio: 1 }).toArray();
}

async function addCity(city, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('cities');
        const cId = toObjectId(companyId);

        const doc = {
            municipio: city.municipio,
            estado: city.estado,
            populacao: parseInt(city.populacao) || 0,
            chave: `${city.municipio}|${city.estado}|${cId ? cId.toString() : ''}`,
            status: 'inicial',
            company_id: cId,
            created_at: new Date()
        };
        const result = await collection.insertOne(doc);
        return { success: true, id: result.insertedId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateCity(id, city, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('cities');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        const updateDoc = {
            $set: {
                municipio: city.municipio,
                estado: city.estado,
                populacao: parseInt(city.populacao) || 0,
                chave: `${city.municipio}|${city.estado}|${cId ? cId.toString() : ''}`,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne(filter, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteCity(id, companyId) {
    try {
        const database = await getDb();
        const citiesCollection = database.collection('cities');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        const city = await citiesCollection.findOne(filter);
        if (!city) {
            return { success: false, error: 'Cidade não encontrada' };
        }
        await citiesCollection.deleteOne(filter);

        const neighborhoodsCollection = database.collection('neighborhoods');
        const neighFilter = { municipio: city.municipio, estado: city.estado };
        if (cId) neighFilter.company_id = cId;

        await neighborhoodsCollection.deleteMany(neighFilter);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- NEIGHBORHOODS (BAIRROS) ---

async function getNeighborhoodsByCity(municipio, estado, companyId) {
    const database = await getDb();
    const collection = database.collection('neighborhoods');
    const cId = toObjectId(companyId);

    const query = { municipio, estado };
    if (cId) query.company_id = cId;

    return await collection.find(query).sort({ bairro: 1 }).toArray();
}

async function addNeighborhood(neighborhood, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        const cId = toObjectId(companyId);

        const doc = {
            bairro: neighborhood.bairro,
            genero: neighborhood.genero || 'N',
            municipio: neighborhood.municipio,
            estado: neighborhood.estado,
            chave: `${neighborhood.bairro}|${neighborhood.municipio}|${neighborhood.estado}|${cId ? cId.toString() : ''}`,
            company_id: cId,
            created_at: new Date()
        };
        const result = await collection.updateOne(
            { chave: doc.chave },
            { $set: doc },
            { upsert: true }
        );
        return { success: true, id: result.upsertedId || null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateNeighborhood(id, neighborhood, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        const original = await collection.findOne(filter);
        if (!original) {
            return { success: false, error: 'Bairro não encontrado' };
        }
        
        const updatedBairro = neighborhood.bairro || original.bairro;
        const updatedGenero = neighborhood.genero || original.genero;
        const key = `${updatedBairro}|${original.municipio}|${original.estado}|${cId ? cId.toString() : ''}`;
        
        const updateDoc = {
            $set: {
                bairro: updatedBairro,
                genero: updatedGenero,
                chave: key,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne(filter, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteNeighborhood(id, companyId) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        const cId = toObjectId(companyId);

        const filter = { _id: new ObjectId(id) };
        if (cId) filter.company_id = cId;

        await collection.deleteOne(filter);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- USERS & MASTER INICIALIZAÇÃO ---

async function getUserByEmail(email) {
    try {
        const database = await getDb();
        return await database.collection('users').findOne({ email });
    } catch (error) {
        console.error('Erro ao buscar usuário por email:', error);
        return null;
    }
}

async function getUserById(id) {
    try {
        const database = await getDb();
        const objId = toObjectId(id);
        if (!objId) return null;
        return await database.collection('users').findOne({ _id: objId });
    } catch (error) {
        console.error('Erro ao buscar usuário por ID:', error);
        return null;
    }
}

async function updateUserById(id, updates) {
    try {
        const database = await getDb();
        const objId = toObjectId(id);
        if (!objId) return false;

        const setObj = { ...updates };
        if (setObj.company_id) setObj.company_id = toObjectId(setObj.company_id);
        if (setObj.current_company_id) setObj.current_company_id = toObjectId(setObj.current_company_id);

        await database.collection('users').updateOne({ _id: objId }, { $set: setObj });
        return true;
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return false;
    }
}

async function getUsers(companyId = null, isMaster = false) {
    try {
        const database = await getDb();
        const collection = database.collection('users');

        let query = {};
        if (!isMaster && companyId) {
            query.company_id = toObjectId(companyId);
        } else if (companyId) {
            query.company_id = toObjectId(companyId);
        }

        const users = await collection.find(query, { projection: { password: 0 } }).sort({ created_at: -1 }).toArray();
        return users;
    } catch (error) {
        console.error('Erro ao buscar lista de usuários:', error);
        return [];
    }
}

async function createUser(name, email, password, can_create_users, companyId = null, isMaster = false) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        
        const existing = await collection.findOne({ email });
        if (existing) {
            return { success: false, error: 'Email já está em uso' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const cId = toObjectId(companyId);

        const doc = {
            name: name || 'Usuário',
            email,
            password: hashedPassword,
            can_create_users: !!can_create_users,
            is_master: !!isMaster,
            company_id: cId,
            current_company_id: cId,
            created_at: new Date()
        };

        const result = await collection.insertOne(doc);
        return { success: true, id: result.insertedId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteUser(id, requestingCompanyId = null, isMaster = false) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        const objId = toObjectId(id);

        const filter = { _id: objId };
        if (!isMaster && requestingCompanyId) {
            filter.company_id = toObjectId(requestingCompanyId);
        }

        const result = await collection.deleteOne(filter);
        if (result.deletedCount === 0) {
            return { success: false, error: 'Usuário não encontrado ou sem permissão para excluí-lo' };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- MIGRAÇÃO E INICIALIZAÇÃO MULTI-TENANT ---

async function initMultiTenantAndSuperUser() {
    try {
        const database = await getDb();
        const companiesColl = database.collection('companies');
        const usersColl = database.collection('users');

        // Configuração padrão do CRM MZ Partners tirada das variáveis de ambiente para SEO Company
        const defaultCrmConfig = {
            client_token: process.env.CRM_CLIENT_TOKEN || '',
            channel_id: process.env.CRM_CHANNEL_ID || '554888283608',
            channel_type: process.env.CRM_CHANNEL_TYPE || 'WHATSAPP',
            department_uuid: process.env.CRM_DEPARTMENT_UUID || '',
            agent_uuid: process.env.CRM_AGENT_UUID || '',
            tag_uuid: process.env.CRM_TAG_UUID || ''
        };

        let seoCompany = await companiesColl.findOne({ name: { $regex: '^SEO Company$', $options: 'i' } });
        if (!seoCompany) {
            console.log('Empresa inicial "SEO Company" não encontrada. Criando empresa padrão...');
            const res = await companiesColl.insertOne({
                name: 'SEO Company',
                active: true,
                allow_excel_export: true,
                crm_enabled: true,
                crm_provider: 'mz_partners',
                crm_config: defaultCrmConfig,
                created_at: new Date()
            });
            seoCompany = { _id: res.insertedId, name: 'SEO Company' };
            console.log(`Empresa SEO Company criada com ID: ${seoCompany._id}`);
        } else {
            // Atualizar configuração do CRM se ainda não estiver presente na SEO Company
            await companiesColl.updateOne(
                { _id: seoCompany._id },
                {
                    $set: {
                        allow_excel_export: seoCompany.allow_excel_export !== undefined ? seoCompany.allow_excel_export : true,
                        crm_enabled: seoCompany.crm_enabled !== undefined ? seoCompany.crm_enabled : true,
                        crm_provider: seoCompany.crm_provider || 'mz_partners',
                        crm_config: seoCompany.crm_config || defaultCrmConfig
                    }
                }
            );
        }
        const seoCompanyId = seoCompany._id;

        // Garantir Superusuário Master (Joao Paulo)
        const masterEmail = 'joao@seocompany.com.br';
        let masterUser = await usersColl.findOne({ email: masterEmail });
        if (!masterUser) {
            console.log(`Criando superusuário master ${masterEmail}...`);
            const hashedPassword = await bcrypt.hash('seo123', 10);
            await usersColl.insertOne({
                name: 'Joao Paulo',
                email: masterEmail,
                password: hashedPassword,
                can_create_users: true,
                is_master: true,
                company_id: seoCompanyId,
                current_company_id: seoCompanyId,
                created_at: new Date()
            });
            console.log(`Superusuário ${masterEmail} criado com sucesso.`);
        } else {
            await usersColl.updateOne(
                { _id: masterUser._id },
                {
                    $set: {
                        is_master: true,
                        company_id: masterUser.company_id || seoCompanyId,
                        current_company_id: masterUser.current_company_id || masterUser.company_id || seoCompanyId
                    }
                }
            );
        }

        // Vincular usuários existentes (Junior, etc) sem company_id para a SEO Company
        await usersColl.updateMany(
            { company_id: { $exists: false } },
            {
                $set: {
                    company_id: seoCompanyId,
                    current_company_id: seoCompanyId,
                    is_master: false
                }
            }
        );

        // Migrar coleções legadas sem company_id para a SEO Company
        const collectionsToMigrate = ['places', 'activities', 'cities', 'neighborhoods'];
        for (const collName of collectionsToMigrate) {
            const coll = database.collection(collName);
            const unassignedCount = await coll.countDocuments({ company_id: { $exists: false } });
            if (unassignedCount > 0) {
                console.log(`Migrando ${unassignedCount} registros da coleção ${collName} para SEO Company...`);
                await coll.updateMany(
                    { company_id: { $exists: false } },
                    { $set: { company_id: seoCompanyId } }
                );
            }
        }

        // Criar índices compostos
        await database.collection('places').createIndex({ company_id: 1, place_id: 1 });
        await database.collection('activities').createIndex({ company_id: 1, nome: 1 });
        await database.collection('cities').createIndex({ company_id: 1, chave: 1 });
        await database.collection('neighborhoods').createIndex({ company_id: 1, chave: 1 });
        await database.collection('tags').createIndex({ company_id: 1, name: 1 });
        await database.collection('export_jobs').createIndex({ company_id: 1, created_at: -1 });

        console.log('Inicialização Multi-Tenant e Índices concluídos com sucesso!');
    } catch (error) {
        console.error('Erro na inicialização Multi-Tenant:', error);
    }
}

async function initSuperUser() {
    await initMultiTenantAndSuperUser();
}

module.exports = {
    getDb,
    toObjectId,
    getCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    bulkApplyTags,
    getPlaces,
    getActivities,
    updatePlaceFromGoogle,
    updateImportedStatus,
    markPlacesAsExcelExported,
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
    deleteActivity,
    savePlaceDirectly,
    createExportJob,
    updateExportJob,
    getLatestExportJob,
    getExportJobs,
    deleteExportJob,
    initSuperUser,
    initMultiTenantAndSuperUser,
    getUserByEmail,
    getUsers,
    createUser,
    deleteUser,
    getUserById,
    updateUserById
};
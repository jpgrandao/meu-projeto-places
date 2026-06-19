const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

async function getPlaces(filters = {}) {
    const database = await getDb();
    const collection = database.collection('places');

    // Lógica de filtro avançado
    const query = {};
    
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

    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 50;
    const skip = (page - 1) * limit;

    const cursor = collection.find(query).skip(skip).limit(limit);
    const data = await cursor.toArray();
    const total = await collection.countDocuments(query);

    return { data, total };
}

async function getActivities() {
    const database = await getDb();
    const collection = database.collection('activities');

    const cursor = collection.find({}).sort({ nome: 1 });
    return await cursor.toArray();
}

async function updatePlaceFromGoogle(placeId) {
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

        await collection.updateOne({ place_id: placeId }, updateDoc);
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar local do Google:', error);
        return { success: false, error: error.message };
    }
}

async function updateImportedStatus(placeId, isImported) {
    try {
        const database = await getDb();
        const collection = database.collection('places');

        const updateDoc = {
            $set: {
                importado: isImported,
                updated_at: new Date()
            }
        };

        await collection.updateOne({ place_id: placeId }, updateDoc);
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status de importação:', error);
        return { success: false, error: error.message };
    }
}

async function getPlaceById(placeId) {
    try {
        const database = await getDb();
        const collection = database.collection('places');

        const place = await collection.findOne({ place_id: placeId });
        return place;
    } catch (error) {
        console.error('Erro ao buscar local por ID:', error);
        return null;
    }
}

async function getCities() {
    const database = await getDb();
    const collection = database.collection('cities');
    return await collection.find({}).sort({ municipio: 1 }).toArray();
}

async function addCity(city) {
    try {
        const database = await getDb();
        const collection = database.collection('cities');
        const doc = {
            municipio: city.municipio,
            estado: city.estado,
            populacao: parseInt(city.populacao) || 0,
            chave: `${city.municipio}|${city.estado}`,
            status: 'inicial',
            created_at: new Date()
        };
        const result = await collection.insertOne(doc);
        return { success: true, id: result.insertedId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateCity(id, city) {
    try {
        const database = await getDb();
        const collection = database.collection('cities');
        const updateDoc = {
            $set: {
                municipio: city.municipio,
                estado: city.estado,
                populacao: parseInt(city.populacao) || 0,
                chave: `${city.municipio}|${city.estado}`,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteCity(id) {
    try {
        const database = await getDb();
        const citiesCollection = database.collection('cities');
        const city = await citiesCollection.findOne({ _id: new ObjectId(id) });
        if (!city) {
            return { success: false, error: 'Cidade não encontrada' };
        }
        await citiesCollection.deleteOne({ _id: new ObjectId(id) });
        const neighborhoodsCollection = database.collection('neighborhoods');
        await neighborhoodsCollection.deleteMany({ municipio: city.municipio, estado: city.estado });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getNeighborhoodsByCity(municipio, estado) {
    const database = await getDb();
    const collection = database.collection('neighborhoods');
    return await collection.find({ municipio, estado }).sort({ bairro: 1 }).toArray();
}

async function addNeighborhood(neighborhood) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        const doc = {
            bairro: neighborhood.bairro,
            genero: neighborhood.genero || 'N',
            municipio: neighborhood.municipio,
            estado: neighborhood.estado,
            chave: `${neighborhood.bairro}|${neighborhood.municipio}|${neighborhood.estado}`,
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

async function updateNeighborhood(id, neighborhood) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        
        const original = await collection.findOne({ _id: new ObjectId(id) });
        if (!original) {
            return { success: false, error: 'Bairro não encontrado' };
        }
        
        const updatedBairro = neighborhood.bairro || original.bairro;
        const updatedGenero = neighborhood.genero || original.genero;
        const key = `${updatedBairro}|${original.municipio}|${original.estado}`;
        
        const updateDoc = {
            $set: {
                bairro: updatedBairro,
                genero: updatedGenero,
                chave: key,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteNeighborhood(id) {
    try {
        const database = await getDb();
        const collection = database.collection('neighborhoods');
        await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function addActivity(activity) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        const doc = {
            nome: activity.nome,
            ativa: activity.ativa || 'V',
            created_at: new Date()
        };
        const result = await collection.updateOne(
            { nome: doc.nome },
            { $set: doc },
            { upsert: true }
        );
        return { success: true, id: result.upsertedId || null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateActivity(id, activity) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        const updateDoc = {
            $set: {
                nome: activity.nome,
                ativa: activity.ativa,
                updated_at: new Date()
            }
        };
        const result = await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteActivity(id) {
    try {
        const database = await getDb();
        const collection = database.collection('activities');
        await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}



async function savePlaceDirectly(placeDoc) {
    try {
        const database = await getDb();
        const collection = database.collection('places');
        
        // Verifica se local já existe por place_id
        const existing = await collection.findOne({ place_id: placeDoc.place_id });
        if (existing) {
            return { success: true, isNew: false, id: existing.place_id };
        }
        
        const doc = {
            ...placeDoc,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        await collection.insertOne(doc);
        return { success: true, isNew: true, id: placeDoc.place_id };
    } catch (error) {
        console.error('Erro ao salvar local diretamente:', error);
        return { success: false, error: error.message };
    }
}

async function initSuperUser() {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        
        const count = await collection.countDocuments();
        if (count === 0) {
            console.log('Nenhum usuário encontrado. Criando superusuário...');
            const hashedPassword = await bcrypt.hash('KJP.diga7314', 10);
            await collection.insertOne({
                name: 'Administrador (Master)',
                email: 'joao@seocompany.com.br',
                password: hashedPassword,
                can_create_users: true,
                created_at: new Date()
            });
            console.log('Superusuário joao@seocompany.com.br criado com sucesso.');
        }
    } catch (error) {
        console.error('Erro ao inicializar superusuário:', error);
    }
}

async function getUserById(id) {
    try {
        const database = await getDb();
        return await database.collection('users').findOne({ _id: new ObjectId(id) });
    } catch (error) {
        console.error('Erro ao buscar usuário por ID:', error);
        return null;
    }
}

async function updateUserById(id, updates) {
    try {
        const database = await getDb();
        await database.collection('users').updateOne(
            { _id: new ObjectId(id) },
            { $set: updates }
        );
        return true;
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return false;
    }
}

async function getUserByEmail(email) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        return await collection.findOne({ email });
    } catch (error) {
        console.error('Erro ao buscar usuário por email:', error);
        return null;
    }
}

async function getUserById(id) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        return await collection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
        console.error('Erro ao buscar usuário por ID:', error);
        return null;
    }
}

async function getUsers() {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        const users = await collection.find({}, { projection: { password: 0 } }).sort({ created_at: -1 }).toArray();
        return users;
    } catch (error) {
        console.error('Erro ao buscar lista de usuários:', error);
        return [];
    }
}

async function createUser(name, email, password, can_create_users) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        
        const existing = await collection.findOne({ email });
        if (existing) {
            return { success: false, error: 'Email já está em uso' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await collection.insertOne({
            name: name || 'Usuário',
            email,
            password: hashedPassword,
            can_create_users: !!can_create_users,
            created_at: new Date()
        });
        
        return { success: true, id: result.insertedId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteUser(id) {
    try {
        const database = await getDb();
        const collection = database.collection('users');
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { success: false, error: 'Usuário não encontrado' };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getPlaces,
    getActivities,
    updatePlaceFromGoogle,
    updateImportedStatus,
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
    initSuperUser,
    getUserByEmail,
    getUsers,
    createUser,
    deleteUser,
    getUserById,
    updateUserById
};
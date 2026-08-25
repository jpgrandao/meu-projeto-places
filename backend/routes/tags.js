const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getTags, createTag, updateTag, deleteTag, bulkApplyTags } = require('../database/mongodb');

router.use(verifyToken);

// GET /api/tags - Lista todas as tags da empresa
router.get('/', async (req, res) => {
    try {
        const tags = await getTags(req.company_id);
        res.json({ success: true, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/tags - Cria uma nova tag
router.post('/', async (req, res) => {
    try {
        const { name, color } = req.body;
        const result = await createTag({ name, color }, req.company_id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/tags/:id - Edita uma tag
router.put('/:id', async (req, res) => {
    try {
        const { name, color } = req.body;
        const result = await updateTag(req.params.id, { name, color }, req.company_id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/tags/:id - Exclui uma tag
router.delete('/:id', async (req, res) => {
    try {
        const result = await deleteTag(req.params.id, req.company_id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/tags/bulk - Aplica ou remove tags em lote nos locais selecionados
router.post('/bulk', async (req, res) => {
    try {
        const { placeIds, tagIds, action } = req.body;
        const result = await bulkApplyTags(placeIds, tagIds, action || 'add', req.company_id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

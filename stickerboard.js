const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).json({ success: true, msg: 'Show all stickerboards' })
});

router.get('/:id', (req, res) => {
    res.status(200).json({ success: true, msg: `Show one stickerboard ${req.params.id}` })
});

router.post('/', (req, res) => {
    res.status(200).json({ success: true, msg: 'Create a new stickerboard' })
});

router.put('/:id', (req, res) => {
    res.status(200).json({ success: true, msg: `Update stickerboard ${req.params.id}` })
});

router.delete('/:id', (req, res) => {
    res.status(200).json({ success: true, msg: `Delete stickerboard ${req.params.id}` })
});

// destructure to bring in controller methods for stickerboards
const {
    getStickerboards,
    getStickerboard,
    createStickerboard,
    updateStickerboard,
    deleteStickerboard
} = require('/routes/stickerboard');


// map the express.router for / address to methods we defined
router
    .route('/')
    .get(getStickerboards)
    .post(createStickerboard)
// map the express router for passed id number to methods we defined
router
    .route('/:id')
    .get(getStickerboard)
    .put(updateStickerboard)
    .delete(deleteStickerboard)

module.exports = router;





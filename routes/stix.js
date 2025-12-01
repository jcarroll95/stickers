// Routes for Stickerboard resources
const express = require('express');

// The express router for stix has the potential to receive a request that originally went to stickerboard
// but contained a belongsToBoard id for listing out the stix associated with that one board.
// So when we establish the router in this file we need to pass in an object mergeParams: true to ensure that
// when the stickerboard router redirects the traffic to here we will actually pass that belongsToBoard ID to our
// controller. Before we added this in, the route would return all stix not just the ones associated to that ID.
const router = express.Router( { mergeParams: true });

// Bring in controller functions
const {
    getStix,
    getStick,
    addStick
} = require('../controllers/stick');

// Map routes to controller actions
router.route('/')
    .get(getStix)
//    .post(createStickerboard);

router.route('/:id')
    .get(getStick)
    .post(addStick)
    //.put(updateStickerboard)
    //.delete(deleteStickerboard);

module.exports = router;

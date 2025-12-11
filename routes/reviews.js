// routes for adding comments (reviews) to stickerboards
const express = require('express');
const {
    getReviews,
    getReview,
    addReview,
    updateReview,
    deleteReview
} = require('../controllers/reviews');
const router = express.Router({ mergeParams : true } );
const Review = require('../models/Review');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');

router
    .route('/')
    .get(
        advancedResults(Review, {
            path: 'belongsToBoard',
            select: 'name description'
        }),
        getReviews
    )
    .post(
        protect,
        authorize('user', 'vipuser', 'admin'),
        addReview
    );

router
    .route('/:id')
    .get(getReview)
    .put(protect, authorize('user', 'vipuser', 'admin'), updateReview)
    .delete(
        protect,
        authorize('user', 'vipuser', 'admin'),
        deleteReview
    );

module.exports = router;

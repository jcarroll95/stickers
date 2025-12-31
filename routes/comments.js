// routes for adding comments to stickerboards
const express = require('express');
const {
    getComments,
    getComment,
    addComment,
    updateComment,
    deleteComment
} = require('../controllers/comments');
const router = express.Router({ mergeParams : true } );
const Comment = require('../models/Comment');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');

router
    .route('/')
    .get(
        advancedResults(Comment, {
            path: 'belongsToBoard',
            select: 'name description'
        }),
        getComments
    )
    .post(
        protect,
        authorize('user', 'vipuser', 'admin'),
        addComment
    );

router
    .route('/:id')
    .get(getComment)
    .put(protect, authorize('user', 'vipuser', 'admin'), updateComment)
    .delete(
        protect,
        authorize('user', 'vipuser', 'admin'),
        deleteComment
    );

module.exports = router;

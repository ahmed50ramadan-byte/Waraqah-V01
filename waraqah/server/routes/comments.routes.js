const express = require('express');
const router = express.Router();
const { protectStaff, protectReader, requireRoles } = require('../middleware/auth');
const { REVIEWER_ROLES } = require('../utils/roles');
const { getComments, addComment, pinComment, deleteComment } = require('../controllers/comments.controller');

router.get('/:id/comments', getComments); // عام
router.post('/:id/comments', protectReader, addComment); // قارئ فقط
router.post('/:id/comments/:commentId/pin', protectStaff, requireRoles(...REVIEWER_ROLES), pinComment);
router.delete('/:id/comments/:commentId', protectStaff, requireRoles(...REVIEWER_ROLES), deleteComment);

module.exports = router;

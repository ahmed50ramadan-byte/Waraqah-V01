const express = require('express');
const router = express.Router();
const { protectStaff, protectReader, optionalReader, requireRoles } = require('../middleware/auth');
const { WRITER_ROLES, REVIEWER_ROLES } = require('../utils/roles');
const { imageUpload, audioUpload } = require('../middleware/upload');
const {
  createArticle,
  getHomeFeed,
  getArticlesByTag,
  getPublicArticle,
  rateArticle,
  toggleLikeArticle,
  shareArticle,
  getReviewQueue,
  getArticleForReview,
  addChatMessage,
  publishArticle,
  requestRevision,
  blockArticle,
  authorResubmit,
  uploadAudio,
  editArticle,
  toggleArticleVisibility,
  deleteArticleAdmin
} = require('../controllers/article.controller');

// ---------- عام (لا يحتاج تسجيل دخول) ----------
router.get('/home-feed', getHomeFeed);
router.get('/by-tag/:tag', getArticlesByTag);
router.get('/public/:id', optionalReader, getPublicArticle);

// ---------- القارئ ----------
router.post('/:id/rate', protectReader, rateArticle);
router.post('/:id/like', protectReader, toggleLikeArticle);
router.post('/:id/share', protectReader, shareArticle);

// ---------- تقديم مقال (الكتّاب وجهات المراجعة) ----------
router.post('/', protectStaff, requireRoles(...WRITER_ROLES), imageUpload.single('coverImage'), createArticle);

// ---------- قائمة المراجعة (لكل الموظفين اللي ليهم صلاحية كتابة أو مراجعة) ----------
router.get('/review-queue', protectStaff, getReviewQueue);
router.get('/review/:id', protectStaff, getArticleForReview);
router.post('/review/:id/chat', protectStaff, addChatMessage);
router.post('/review/:id/resubmit', protectStaff, authorResubmit);

// ---------- قرارات جهات المراجعة فقط ----------
router.post('/review/:id/publish', protectStaff, requireRoles(...REVIEWER_ROLES), publishArticle);
router.post('/review/:id/request-revision', protectStaff, requireRoles(...REVIEWER_ROLES), requestRevision);
router.post('/review/:id/block', protectStaff, requireRoles(...REVIEWER_ROLES), blockArticle);
router.post(
  '/review/:id/audio',
  protectStaff,
  requireRoles(...REVIEWER_ROLES),
  audioUpload.single('audio'),
  uploadAudio
);

// ---------- إدارة المقال بعد النشر: تعديل / إخفاء-إظهار / حذف نهائي (جهات المراجعة فقط) ----------
router.put(
  '/review/:id/edit',
  protectStaff,
  requireRoles(...REVIEWER_ROLES),
  imageUpload.single('coverImage'),
  editArticle
);
router.post('/review/:id/toggle-visibility', protectStaff, requireRoles(...REVIEWER_ROLES), toggleArticleVisibility);
router.delete('/review/:id', protectStaff, requireRoles(...REVIEWER_ROLES), deleteArticleAdmin);

module.exports = router;

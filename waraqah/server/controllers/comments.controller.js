const Comment = require('../models/Comment');
const Article = require('../models/Article');
const { awardPoints, todayStr } = require('../utils/pointsEngine');
const { REVIEWER_ROLES } = require('../utils/roles');

const DAILY_COMMENTS_CAP = 2; // حد أقصى تعليقين يوميًا (20 و.ر.ق يوميًا بحد أقصى)

// GET /api/articles/:id/comments (عام) - التعليقات المثبّتة أولاً ثم الأحدث
async function getComments(req, res, next) {
  try {
    const comments = await Comment.find({ article: req.params.id })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(200);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

// POST /api/articles/:id/comments (محمي: قارئ) - يمنح +2 لكل تعليق بحد أقصى تعليقين يوميًا
async function addComment(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'يرجى كتابة نص التعليق.' });
    }

    const article = await Article.findOne({ _id: req.params.id, status: 'published' });
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const reader = req.reader;
    const today = todayStr();
    reader.resetDailyCountersIfNeeded(today);

    const comment = await Comment.create({
      article: article._id,
      reader: reader._id,
      readerName: reader.name,
      text: text.trim()
    });

    article.commentsCount = (article.commentsCount || 0) + 1;
    await article.save();

    let earned = 0;
    if (reader.dailyCommentsCount < DAILY_COMMENTS_CAP) {
      reader.dailyCommentsCount += 1;
      await reader.save();
      await awardPoints(reader, 2, 'write_comment', 'مكافأة كتابة تعليق أدبي.', article._id);
      earned = 2;
    } else {
      await reader.save();
    }

    res.status(201).json({ comment, earned });
  } catch (err) {
    next(err);
  }
}

// POST /api/articles/:id/comments/:commentId/pin (محمي: جهات المراجعة) - تثبيت تعليق
async function pinComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'التعليق غير موجود.' });

    comment.pinned = !comment.pinned;
    await comment.save();

    res.json({ comment });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/articles/:id/comments/:commentId (محمي: جهات المراجعة أو صاحب التعليق)
async function deleteComment(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'التعليق غير موجود.' });

    const isReviewer = req.user && REVIEWER_ROLES.includes(req.user.role);
    if (!isReviewer) {
      return res.status(403).json({ message: 'حذف التعليقات متاح فقط لجهات المراجعة.' });
    }

    await comment.deleteOne();
    await Article.findByIdAndUpdate(comment.article, { $inc: { commentsCount: -1 } });

    res.json({ message: 'تم حذف التعليق.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getComments, addComment, pinComment, deleteComment };

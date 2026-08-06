const Article = require('../models/Article');
const AuditLog = require('../models/AuditLog');
const Comment = require('../models/Comment');
const { REVIEWER_ROLES } = require('../utils/roles');
const { flattenTags } = require('../utils/categories');
const { awardPoints } = require('../utils/pointsEngine');
const { safeDeleteFromCloudinary } = require('../utils/cloudinary');

const VALID_TAGS = flattenTags();

function isReviewer(user) {
  return !!user && REVIEWER_ROLES.includes(user.role);
}

function serializeArticle(article, { includeBody = true, viewerReaderId = null } = {}) {
  const obj = article.toObject ? article.toObject() : article;
  const ratingsObj = obj.ratings || {};
  const values = Object.values(ratingsObj);
  const avgRating = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

  const likesArr = obj.likes || [];

  const result = {
    id: obj._id,
    title: obj.title,
    coverImage: obj.coverImage,
    tags: obj.tags,
    accessLevel: obj.accessLevel || 'public',
    audio: obj.audio,
    status: obj.status,
    authorName: obj.authorName,
    authorRole: obj.authorRole,
    author: obj.author,
    views: obj.views,
    avgRating,
    ratingsCount: values.length,
    myRating: viewerReaderId ? ratingsObj[viewerReaderId.toString()] || 0 : 0,
    likesCount: likesArr.length,
    isLikedByViewer: viewerReaderId ? likesArr.some((id) => id.toString() === viewerReaderId.toString()) : false,
    commentsCount: obj.commentsCount || 0,
    visible: obj.visible !== false,
    createdAt: obj.createdAt,
    publishedAt: obj.publishedAt
  };

  if (includeBody) {
    result.body = obj.body;
    result.chat = obj.chat;
  }

  return result;
}

// =============================================================
// تقديم مقال جديد (محمي: WRITER_ROLES فقط - يُطبّق في الراوت)
// =============================================================
async function createArticle(req, res, next) {
  try {
    const { title, body, accessLevel } = req.body;
    let tags = req.body.tags;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'عنوان المقال مطلوب.' });
    }

    const validAccessLevels = ['public', 'registered', 'golden'];
    const finalAccessLevel = validAccessLevels.includes(accessLevel) ? accessLevel : 'public';

    // tags قد تصل كسلسلة JSON أو كمصفوفة حسب طريقة الإرسال (FormData)
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch (e) {
        tags = [tags];
      }
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ message: 'يرجى اختيار تصنيف أو وسم واحد على الأقل.' });
    }

    const invalidTags = tags.filter((t) => !VALID_TAGS.includes(t));
    if (invalidTags.length > 0) {
      return res.status(400).json({ message: `تصنيفات غير معروفة: ${invalidTags.join(', ')}` });
    }

    const coverImage = req.file ? req.file.path : null;

    const article = await Article.create({
      title: title.trim(),
      body: body || '',
      tags,
      accessLevel: finalAccessLevel,
      coverImage,
      author: req.user._id,
      authorName: req.user.username,
      authorRole: req.user.role,
      status: 'pending'
    });

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم تقديم مسودة مقال جديد بعنوان "${article.title}".`
    });

    res.status(201).json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// الصفحة الرئيسية: أحدث المقالات + المقالات المميزة (عام)
// =============================================================
async function getHomeFeed(req, res, next) {
  try {
    const published = await Article.find({ status: 'published', visible: true }).sort({ createdAt: -1 });

    const latest = published.slice(0, 4).map((a) => serializeArticle(a, { includeBody: false }));

    const featured = [...published]
      .sort((a, b) => {
        const ra = a.averageRating() || 0;
        const rb = b.averageRating() || 0;
        if (rb !== ra) return rb - ra;
        return (b.views || 0) - (a.views || 0);
      })
      .slice(0, 4)
      .map((a) => serializeArticle(a, { includeBody: false }));

    res.json({ latest, featured });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// مقالات تصنيف/وسم فرعي معيّن (عام)
// =============================================================
async function getArticlesByTag(req, res, next) {
  try {
    const { tag } = req.params;
    const articles = await Article.find({ status: 'published', visible: true, tags: tag }).sort({ createdAt: -1 });
    res.json({ articles: articles.map((a) => serializeArticle(a, { includeBody: false })) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// عرض مقال منشور للقراءة العامة (عام + قارئ اختياري لفحص الحصرية)
// =============================================================
async function getPublicArticle(req, res, next) {
  try {
    const article = await Article.findOne({ _id: req.params.id, status: 'published' });
    if (!article || article.visible === false) {
      return res.status(404).json({ message: 'المقال غير موجود أو غير منشور.' });
    }

    const isReaderLoggedIn = !!req.reader;
    const isGoldMember = !!(req.reader && req.reader.isGoldMember);

    const needsRegistration = article.accessLevel === 'registered' && !isReaderLoggedIn;
    const needsGoldMembership = article.accessLevel === 'golden' && !isGoldMember;

    if (needsRegistration || needsGoldMembership) {
      // محتوى مقفول - نرجع بيانات أساسية فقط بدون النص، مع توضيح سبب القفل للواجهة
      return res.json({
        article: serializeArticle(article, { includeBody: false }),
        locked: true,
        lockReason: needsGoldMembership ? 'golden' : 'registered'
      });
    }

    // زيادة عدد المشاهدات
    article.views = (article.views || 0) + 1;
    await article.save();

    res.json({
      article: serializeArticle(article, { includeBody: true, viewerReaderId: req.reader ? req.reader._id : null }),
      locked: false
    });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// تقييم مقال (محمي: قارئ فقط)
// =============================================================
async function rateArticle(req, res, next) {
  try {
    const { value } = req.body;
    const numValue = Number(value);
    if (!numValue || numValue < 1 || numValue > 5) {
      return res.status(400).json({ message: 'قيمة التقييم يجب أن تكون بين 1 و 5.' });
    }

    const article = await Article.findOne({ _id: req.params.id, status: 'published' });
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    if (!article.ratings) article.ratings = {};
    article.ratings[req.reader._id.toString()] = numValue;
    article.markModified('ratings'); // إجباري مع Mixed/Object عشان Mongoose يسجّل التعديل
    await article.save();

    res.json({ article: serializeArticle(article, { includeBody: false, viewerReaderId: req.reader._id }) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// قائمة مراجعة المقالات (محمي):
// جهة المراجعة تشوف الكل، الكاتب يشوف مقالاته هو بس
// =============================================================
async function getReviewQueue(req, res, next) {
  try {
    const query = isReviewer(req.user) ? {} : { author: req.user._id };
    const articles = await Article.find(query).sort({ createdAt: -1 });
    res.json({ articles: articles.map((a) => serializeArticle(a, { includeBody: false })) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// جلب مقال واحد لصفحة المراجعة (محمي: جهة مراجعة أو صاحب المقال)
// =============================================================
async function getArticleForReview(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const canAccess = isReviewer(req.user) || article.author.toString() === req.user._id.toString();
    if (!canAccess) {
      return res.status(403).json({ message: 'لا تملك صلاحية الوصول لهذا المقال.' });
    }

    res.json({ article: serializeArticle(article), isReviewer: isReviewer(req.user) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// إضافة رسالة في محادثة المراجعة (محمي: جهة مراجعة أو صاحب المقال)
// =============================================================
async function addChatMessage(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'يرجى كتابة نص الرسالة.' });

    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const reviewer = isReviewer(req.user);
    const isAuthor = article.author.toString() === req.user._id.toString();
    if (!reviewer && !isAuthor) {
      return res.status(403).json({ message: 'لا تملك صلاحية الوصول لهذا المقال.' });
    }

    article.chat.push({
      from: reviewer ? 'reviewer' : 'author',
      userId: req.user._id,
      name: req.user.username,
      text: text.trim()
    });
    await article.save();

    res.status(201).json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// قرارات جهة المراجعة: نشر / إعادة للمراجعة / حظر
// (محمي: REVIEWER_ROLES فقط - يُطبّق في الراوت)
// =============================================================
async function publishArticle(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    article.status = 'published';
    article.publishedAt = new Date();
    article.chat.push({ from: 'reviewer', userId: req.user._id, name: req.user.username, text: 'تم اعتماد المقال ونشره.' });
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم اعتماد ونشر المقال "${article.title}".`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

async function requestRevision(req, res, next) {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ message: 'يرجى كتابة التعديلات المطلوبة.' });

    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    article.status = 'revision';
    article.chat.push({ from: 'reviewer', userId: req.user._id, name: req.user.username, text: note.trim() });
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `طُلبت تعديلات على المقال "${article.title}": ${note.trim()}`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

async function blockArticle(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ message: 'يرجى كتابة سبب حظر النشر.' });

    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    article.status = 'blocked';
    article.chat.push({
      from: 'reviewer',
      userId: req.user._id,
      name: req.user.username,
      text: `تم حظر نشر المقال - السبب: ${reason.trim()}`
    });
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم حظر نشر المقال "${article.title}" لمخالفته سياسة النشر: ${reason.trim()}`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// الكاتب يعدّل مقاله ويعيد إرساله بعد طلب تعديل (محمي: صاحب المقال فقط)
// =============================================================
async function authorResubmit(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    if (article.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'لا يمكنك تعديل مقال لست صاحبه.' });
    }
    if (article.status !== 'revision') {
      return res.status(400).json({ message: 'يمكن إعادة الإرسال فقط عندما يطلب المراجع تعديلات.' });
    }

    const { title, body } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'عنوان المقال مطلوب.' });

    article.title = title.trim();
    article.body = body || '';
    article.status = 'pending';
    article.chat.push({
      from: 'author',
      userId: req.user._id,
      name: req.user.username,
      text: 'تم تعديل المقال وإعادة إرساله للمراجعة.'
    });
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `أعاد الكاتب [${req.user.username}] إرسال المقال "${article.title}" بعد التعديل.`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// رفع/تحديث الملف الصوتي (محمي: REVIEWER_ROLES فقط - في أي وقت)
// =============================================================
async function uploadAudio(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });
    if (!req.file) return res.status(400).json({ message: 'يرجى إرفاق ملف صوتي.' });

    // احذف الملف الصوتي القديم لو موجود
    if (article.audio) {
      await safeDeleteFromCloudinary(article.audio, 'video'); // الصوتيات مخزنة تحت resource_type: video في Cloudinary
    }

    article.audio = req.file.path;
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم إضافة/تحديث الملف الصوتي للمقال "${article.title}".`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// إعجاب/حفظ المقال (محمي: قارئ) - Toggle، والمكافأة (+2) مرة واحدة فقط لكل مقال طوال الوقت
// =============================================================
async function toggleLikeArticle(req, res, next) {
  try {
    const article = await Article.findOne({ _id: req.params.id, status: 'published' });
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const reader = req.reader;
    const readerId = reader._id.toString();
    const alreadyLiked = article.likes.some((id) => id.toString() === readerId);

    if (alreadyLiked) {
      article.likes = article.likes.filter((id) => id.toString() !== readerId);
    } else {
      article.likes.push(reader._id);
    }
    await article.save();

    // المكافأة تُمنح مرة واحدة فقط طوال الوقت لكل مقال، حتى لو اتعمل عليه إعجاب/إلغاء متكرر
    const alreadyRewarded = reader.rewardedLikedArticles.some((id) => id.toString() === article._id.toString());
    if (!alreadyLiked && !alreadyRewarded) {
      reader.rewardedLikedArticles.push(article._id);
      await reader.save();
      await awardPoints(reader, 2, 'like_article', 'مكافأة إعجاب/حفظ مقال.', article._id);
    }

    res.json({
      liked: !alreadyLiked,
      likesCount: article.likes.length,
      waraqBalance: reader.waraqBalance
    });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// مشاركة المقال (محمي: قارئ) - المكافأة (+10) مرة واحدة فقط لكل مقال طوال الوقت
// =============================================================
async function shareArticle(req, res, next) {
  try {
    const article = await Article.findOne({ _id: req.params.id, status: 'published' });
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const reader = req.reader;
    const alreadyRewarded = reader.rewardedSharedArticles.some((id) => id.toString() === article._id.toString());

    let earned = 0;
    if (!alreadyRewarded) {
      reader.rewardedSharedArticles.push(article._id);
      await reader.save();
      await awardPoints(reader, 10, 'share_article', 'مكافأة مشاركة مقال على السوشيال ميديا.', article._id);
      earned = 10;
    }

    res.json({ earned, waraqBalance: reader.waraqBalance });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// تعديل مقال منشور (أو أي مقال بأي حالة) - محمي: جهات المراجعة فقط
// =============================================================
async function editArticle(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    const { title, body, accessLevel } = req.body;
    let tags = req.body.tags;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ message: 'عنوان المقال مطلوب.' });
      article.title = title.trim();
    }
    if (body !== undefined) article.body = body;
    if (accessLevel !== undefined && ['public', 'registered', 'golden'].includes(accessLevel)) {
      article.accessLevel = accessLevel;
    }

    if (tags !== undefined) {
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = [tags]; }
      }
      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ message: 'يجب اختيار تصنيف أو وسم واحد على الأقل.' });
      }
      const invalidTags = tags.filter((t) => !VALID_TAGS.includes(t));
      if (invalidTags.length > 0) {
        return res.status(400).json({ message: `تصنيفات غير معروفة: ${invalidTags.join(', ')}` });
      }
      article.tags = tags;
    }

    if (req.file) {
      if (article.coverImage) {
        await safeDeleteFromCloudinary(article.coverImage, 'image');
      }
      article.coverImage = req.file.path;
    }

    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم تعديل المقال "${article.title}" بواسطة جهة المراجعة.`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// إخفاء/إظهار مقال منشور للقراء - محمي: جهات المراجعة فقط
// =============================================================
async function toggleArticleVisibility(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    article.visible = !article.visible;
    await article.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم ${article.visible ? 'إظهار' : 'إخفاء'} المقال "${article.title}" ${article.visible ? 'للقراء' : 'عن القراء'}.`
    });

    res.json({ article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

// =============================================================
// حذف مقال نهائيًا (مع ملفاته المرفوعة وتعليقاته) - محمي: جهات المراجعة فقط
// =============================================================
async function deleteArticleAdmin(req, res, next) {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'المقال غير موجود.' });

    if (article.coverImage) {
      await safeDeleteFromCloudinary(article.coverImage, 'image');
    }
    if (article.audio) {
      await safeDeleteFromCloudinary(article.audio, 'video');
    }

    await Comment.deleteMany({ article: article._id });

    const articleTitle = article.title;
    await article.deleteOne();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم حذف المقال "${articleTitle}" نهائيًا.`
    });

    res.json({ message: 'تم حذف المقال نهائيًا.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};

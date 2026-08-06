# Waraqah API - الباك إند

باك إند حقيقي لمجلة "ورقة" مبني بـ **Node.js + Express + MongoDB**، فيه:

- تسجيل دخول موظفين وقرّاء منفصل تمامًا، بكلمات سر مشفّرة (bcrypt) ورموز دخول JWT.
- صلاحيات حسب الدور الوظيفي (13 دور + IT) لكل إجراء.
- رفع ملفات حقيقي (صور المقالات، صور الفريق، الملفات الصوتية) بدل base64.
- سير عمل مراجعة كامل: تقديم → مراجعة → نشر / إعادة تعديل / حظر، مع محادثة بين الكاتب والمراجع.
- تقييم القراء للمقالات، عداد مشاهدات، محتوى حصري للمشتركين.
- سجل مراجعات (Audit Log) دائم في قاعدة البيانات.
- حماية: Helmet، CORS، Rate Limiting على مسارات الدخول.

## 1) التثبيت

```bash
cd server
npm install
cp .env.example .env
```

افتح ملف `.env` واملأ:
- `MONGO_URI`: رابط قاعدة بياناتك (محلي أو MongoDB Atlas مجانًا من mongodb.com/atlas)
- `JWT_SECRET`: نص عشوائي طويل (مثلاً 40+ حرف)
- `CLIENT_ORIGIN`: رابط الواجهة الأمامية بعد رفعها

## 2) التشغيل

```bash
npm run dev     # للتطوير (يعيد التشغيل تلقائيًا عند أي تعديل)
npm start       # للإنتاج
```

السيرفر هيشتغل على `http://localhost:5000` (أو الـ PORT اللي حددته).

## 3) إنشاء أول حساب (المالك)

أول ما تشغّل السيرفر، اقاعدة البيانات هتكون فاضية من المستخدمين. ابعت طلب واحد بس (من Postman أو من الواجهة نفسها) لإنشاء أول حساب "مالك":

```
POST /api/auth/bootstrap
Content-Type: application/json

{
  "username": "admin",
  "password": "كلمة سر قوية هنا",
  "email": "admin@waraqah.com"
}
```

هذا المسار بيرفض أي طلب تاني بعد أول مرة (بمجرد ما يبقى فيه مستخدم واحد في القاعدة).

بعد كده أي حساب تاني (رئيس تحرير، مدير تحرير، IT...) يتعمل من:

```
POST /api/auth/staff   (محمي - يحتاج توكن المالك/رئيس التحرير/مدير التحرير/IT)
```

## 4) أهم نقاط الـ API

### المصادقة
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| POST | `/api/auth/bootstrap` | إنشاء أول حساب مالك | عام (مرة واحدة) |
| POST | `/api/auth/login` | دخول موظف | عام |
| GET | `/api/auth/me` | بيانات الموظف الحالي | موظف مسجل |
| POST | `/api/auth/staff` | إنشاء حساب موظف جديد | Owner/EIC/ME/IT |

### القرّاء
| Method | المسار | الوصف |
|---|---|---|
| POST | `/api/readers/register` | تسجيل حساب قارئ جديد |
| POST | `/api/readers/login` | دخول قارئ |
| GET | `/api/readers/me` | بيانات القارئ الحالي |

### المقالات
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/articles/home-feed` | أحدث المقالات + المميزة | عام |
| GET | `/api/articles/by-tag/:tag` | مقالات تصنيف فرعي | عام |
| GET | `/api/articles/public/:id` | قراءة مقال منشور | عام (+قارئ اختياري للحصري) |
| POST | `/api/articles/:id/rate` | تقييم مقال (1-5) | قارئ مسجل |
| POST | `/api/articles` | تقديم مقال جديد (multipart: title, body, tags, exclusive, coverImage) | كتّاب/مراجعون |
| GET | `/api/articles/review-queue` | قائمة المراجعة | موظف مسجل |
| GET | `/api/articles/review/:id` | تفاصيل مقال للمراجعة | مراجع أو صاحب المقال |
| POST | `/api/articles/review/:id/chat` | إرسال رسالة محادثة | مراجع أو صاحب المقال |
| POST | `/api/articles/review/:id/resubmit` | إعادة إرسال بعد تعديل | صاحب المقال |
| POST | `/api/articles/review/:id/publish` | اعتماد ونشر | جهات المراجعة فقط |
| POST | `/api/articles/review/:id/request-revision` | طلب تعديل | جهات المراجعة فقط |
| POST | `/api/articles/review/:id/block` | حظر النشر | جهات المراجعة فقط |
| POST | `/api/articles/review/:id/audio` | رفع/تحديث ملف صوتي (multipart: audio) | جهات المراجعة فقط |

### فريق التحرير
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/team` | قائمة الفريق (بالنبذة والصورة ظاهرين افتراضيًا) | عام |
| POST | `/api/team` | إضافة عضو (multipart: name, role, bio, photo) | Owner/EIC |
| PUT | `/api/team/:id` | تعديل عضو | Owner/EIC |
| DELETE | `/api/team/:id` | حذف عضو | Owner/EIC |

### سجل المراجعات
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/audit` | آخر 200 ملاحظة | موظف مسجل |
| POST | `/api/audit` | تدوين ملاحظة يدوية | موظف مسجل |

## 5) التدرج الوظيفي الكامل (12 دورًا)

المالك (Owner) ← رئيس التحرير (Editor-in-Chief) ← نائب رئيس التحرير (Deputy Editor) ← مدير التحرير (Managing Editor) ← منسق التحرير (Editorial Coordinator) ← محرر القسم (Section Editor) ← كاتب المحتوى (Content Writer) ← المترجم الأدبي (Translator) ← المدقق اللغوي (Proofreader) ← مصمم الجرافيك (Graphic Designer) ← مدير المحتوى الرقمي (Digital Content Manager) ← قسم تكنولوجيا المعلومات (IT).

## 6) جهات المراجعة (REVIEWER_ROLES)

المالك، رئيس التحرير، نائب رئيس التحرير، مدير التحرير، منسق التحرير، محرر القسم. — تملك صلاحية نشر/إعادة مراجعة/حظر أي مقال.

## 7) مين يقدر يكتب مقال (WRITER_ROLES)

جهات المراجعة + كاتب المحتوى + المترجم الأدبي.

## 8) مين يقدر ينشئ حسابات موظفين (STAFF_CREATOR_ROLES)

المالك، رئيس التحرير، مدير التحرير، قسم تكنولوجيا المعلومات (IT).

## 9) مين يقدر يدير إعدادات الموقع (SETTINGS_MANAGER_ROLES)

المالك، رئيس التحرير، قسم تكنولوجيا المعلومات (IT) — روابط السوشيال ميديا وإعلان الموقع.

### مسارات الإعدادات
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/settings` | جلب روابط السوشيال ميديا والإعلان الحالي | عام |
| PUT | `/api/settings/social` | تحديث روابط فيسبوك/إنستجرام/تليجرام | SETTINGS_MANAGER_ROLES |
| PUT | `/api/settings/ad` | رفع/تحديث إعلان (multipart: image, linkUrl) | SETTINGS_MANAGER_ROLES |
| DELETE | `/api/settings/ad` | إزالة الإعلان الحالي | SETTINGS_MANAGER_ROLES |

## 10) نظام "ورق" - نقاط الولاء (API)

### نقاط القارئ
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/points/me` | رصيد القارئ + رتبته + كود الإحالة | قارئ |
| GET | `/api/points/history` | آخر 50 حركة نقاط | قارئ |
| POST | `/api/points/heartbeat` | نبضة تتبّع قراءة نشطة (كل 20 ثانية) | قارئ (Rate limited) |

### التفاعل مع المقالات
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| POST | `/api/articles/:id/like` | إعجاب/إلغاء إعجاب (+2 مرة واحدة) | قارئ |
| POST | `/api/articles/:id/share` | تسجيل مشاركة (+10 مرة واحدة) | قارئ |
| GET | `/api/articles/:id/comments` | جلب تعليقات المقال | عام |
| POST | `/api/articles/:id/comments` | إضافة تعليق (+2 حتى تعليقين/يوم) | قارئ |
| POST | `/api/articles/:id/comments/:commentId/pin` | تثبيت/إلغاء تثبيت تعليق | REVIEWER_ROLES |
| DELETE | `/api/articles/:id/comments/:commentId` | حذف تعليق | REVIEWER_ROLES |

### متجر الهدايا
| Method | المسار | الوصف | الحماية |
|---|---|---|---|
| GET | `/api/rewards` | كتالوج الهدايا النشطة | عام |
| POST | `/api/rewards/:id/redeem` | استبدال هدية بالنقاط | قارئ |
| GET | `/api/rewards/my-redemptions` | طلبات الاستبدال الخاصة بالقارئ | قارئ |
| GET | `/api/rewards/all` | كل الهدايا (حتى الموقوفة) | SETTINGS_MANAGER_ROLES |
| POST | `/api/rewards` | إضافة هدية (multipart: image) | SETTINGS_MANAGER_ROLES |
| PUT | `/api/rewards/:id` | تعديل هدية | SETTINGS_MANAGER_ROLES |
| DELETE | `/api/rewards/:id` | حذف هدية | SETTINGS_MANAGER_ROLES |
| GET | `/api/rewards/redemptions` | كل طلبات الاستبدال (لوحة الإدارة) | SETTINGS_MANAGER_ROLES |
| PUT | `/api/rewards/redemptions/:id` | تحديث حالة طلب استبدال | SETTINGS_MANAGER_ROLES |

## 11) قبل النشر الفعلي (Production)

- استخدم HTTPS دايمًا (عبر Nginx reverse proxy أو خدمة الاستضافة).
- غيّر `JWT_SECRET` لقيمة عشوائية طويلة فعلاً ولا تشاركها.
- فعّل نسخ احتياطي دوري لقاعدة البيانات.
- لو الاستضافة عندها تخزين ملفات دائم منفصل (مثل S3)، فكّر تنقل رفع الملفات إليه بدل القرص المحلي، لأن أغلب استضافات الـ PaaS (مثل Render/Railway) بتمسح الملفات المحلية عند إعادة التشغيل.

// =============================================================
// نظام رتب القارئ - مبني على إجمالي "ورق" المكتسب طوال الوقت (waraqTotalEarned)
// =============================================================

const RANKS = [
  {
    key: 'visitor',
    name: 'العابر',
    minTotal: 0,
    perks: ['إمكانية القراءة، التفاعل، وجمع النقاط.']
  },
  {
    key: 'regular_reader',
    name: 'القارئ المواظب',
    minTotal: 201,
    perks: ['فتح خاصية إحصائيات القراءة الشخصية في البروفايل.']
  },
  {
    key: 'passionate_reader',
    name: 'المُطالع الشغوف',
    minTotal: 801,
    perks: ['شارة "قارئ نشط"', 'إمكانية حفظ عدد لا نهائي من المقالات.']
  },
  {
    key: 'engaged_critic',
    name: 'الناقد المشارك',
    minTotal: 5000,
    perks: ['الوصول لصفحة تبديل الهدايا', 'شارة بروفايل مميزة', 'أولوية تثبيت التعليقات.']
  },
  {
    key: 'letters_keeper',
    name: 'سادن الحرف',
    minTotal: 10000,
    perks: ['الوصول المبكر للمقالات الحصرية قبل نشرها بـ 48 ساعة', 'خصم 10% على متجر الهدايا.']
  },
  {
    key: 'waraqah_dean',
    name: 'عميد الورقة',
    minTotal: 15000,
    perks: ['الحصول على الـ Coin الملموسة مجانًا كإهداء', 'دعوات الصالونات الثقافية المغلقة.']
  }
];

/**
 * يرجع الرتبة الحالية بناءً على إجمالي الورق المكتسب.
 */
function getRankForTotal(totalEarned) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (totalEarned >= rank.minTotal) current = rank;
    else break;
  }
  return current;
}

/**
 * يرجع الرتبة التالية (أو null لو وصل لأعلى رتبة) + كم ورق ناقص للوصول لها.
 */
function getNextRankInfo(totalEarned) {
  const currentIndex = RANKS.findIndex((r) => r.key === getRankForTotal(totalEarned).key);
  const next = RANKS[currentIndex + 1];
  if (!next) return { next: null, remaining: 0 };
  return { next, remaining: Math.max(0, next.minTotal - totalEarned) };
}

module.exports = { RANKS, getRankForTotal, getNextRankInfo };

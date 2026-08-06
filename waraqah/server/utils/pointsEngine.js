const PointsTransaction = require('../models/PointsTransaction');
const { getRankForTotal } = require('./ranks');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * يمنح نقاط "ورق" لقارئ، يحدّث رصيده وإجماليه، ويسجّل الحركة في الدفتر.
 * دايمًا بيرجع { reader, transaction, rankChanged, newRank } عشان يقدر الكود اللي بينادي
 * الدالة يعرف لو القارئ اترقّى رتبة عشان يظهرله إشعار خاص لو حابب.
 *
 * ملاحظة أمان: الدالة دي هي المكان الوحيد المسموح له يغيّر رصيد القارئ - أي إضافة نقاط
 * لازم تعدي من هنا، ومفيش أي مسار بياخد رقم النقاط جاهز من الفرونت إند.
 */
async function awardPoints(reader, amount, type, description = '', relatedArticle = null) {
  if (!amount) return { reader, transaction: null, rankChanged: false, newRank: null };

  const oldRank = getRankForTotal(reader.waraqTotalEarned);

  reader.waraqBalance = Math.max(0, (reader.waraqBalance || 0) + amount);
  if (amount > 0) {
    reader.waraqTotalEarned = (reader.waraqTotalEarned || 0) + amount;
  }
  await reader.save();

  const transaction = await PointsTransaction.create({
    reader: reader._id,
    amount,
    type,
    description,
    relatedArticle
  });

  const newRank = getRankForTotal(reader.waraqTotalEarned);
  const rankChanged = newRank.key !== oldRank.key;

  return { reader, transaction, rankChanged, newRank };
}

/**
 * يخصم نقاط (عند استبدال هدية مثلاً). يرفض العملية لو الرصيد مش كافي.
 */
async function deductPoints(reader, amount, type, description = '') {
  if (amount <= 0) throw new Error('قيمة الخصم يجب أن تكون أكبر من صفر.');
  if ((reader.waraqBalance || 0) < amount) {
    const err = new Error('رصيدك من الورق غير كافٍ لاستبدال هذه الهدية.');
    err.statusCode = 400;
    throw err;
  }
  return awardPoints(reader, -amount, type, description);
}

module.exports = { awardPoints, deductPoints, todayStr };

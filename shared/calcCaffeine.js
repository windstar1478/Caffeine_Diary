/* 카페인 반감기(5시간) 기반 체내 잔여량 및 수면 위험도 계산 */

const HALF_LIFE_HOURS = 5; // 카페인 평균 반감기: 5시간
const SAFE_THRESHOLD_MG = 50; // 숙면 권장 최대 잔여량 기준: 50mg

// 한국 시간(KST) 기준 오늘 날짜 문자열("YYYY-MM-DD") 반환
function getTodayKSTDateStr(baseDate = new Date()) {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(baseDate.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0];
}

// 1. 특정 기준 시각(targetDate)의 총 잔여 카페인 계산
function calculateRemainingCaffeine(records, targetDate = new Date()) {
  let totalRemaining = 0;

  records.forEach((record) => {
    if (!record.intakeTime || typeof record.caffeineMg !== 'number') return;
    // 문자열("2026-11-13T18:00:00")이 들어오면 HH:MM만 추출
  
    const intakeDate = record.intakeTime.includes('T')
      ? new Date(record.intakeTime)
      : new Date(`${getTodayKSTDateStr(targetDate)}T${record.intakeTime}:00+09:00`);

    if (isNaN(intakeDate.getTime())) return;

    const elapsedHours = (targetDate.getTime() - intakeDate.getTime()) / (1000 * 60 * 60);

    // 기준 시각보다 이전에 마신 기록만 반감기 누적 계산
    if (elapsedHours >= 0) {
      const remaining = record.caffeineMg * Math.pow(0.5, elapsedHours / HALF_LIFE_HOURS);
      totalRemaining += remaining;
    }
  });

  return Math.round(totalRemaining);
}

// 2. 목표 취침 시각 기준 예상 잔여량 및 수면 위험도 판정
function assessSleepRisk(records, bedtimeStr = '23:00', now = new Date()) {
  const todayStr = getTodayKSTDateStr(now);

  // 오늘 날짜 + 목표 취침 시각을 KST Date 객체로 생성
  let bedtimeDate = new Date(`${todayStr}T${bedtimeStr}:00+09:00`);

  // 설정한 취침 시각이 현재 시각보다 이미 지났다면 다음 날로 보정
  if (bedtimeDate.getTime() <= now.getTime()) {
    bedtimeDate = new Date(bedtimeDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const bedtimeRemaining = calculateRemainingCaffeine(records, bedtimeDate);

  let level = 'safe';
  let label = '안전 (숙면 가능)';

  if (bedtimeRemaining >= 100) {
    level = 'danger';
    label = '위험 (각성 주의)';
  } else if (bedtimeRemaining >= SAFE_THRESHOLD_MG) {
    level = 'warning';
    label = '주의 (입면 지연 가능)';
  }

  return {
    bedtimeRemaining,
    level, // 'safe' | 'warning' | 'danger'
    label,
  };
}

// 3. 숙면을 위한 마지막 카페인(아메리카노 1잔 150mg 기준) 섭취 마지노선 시각 역산
function calculateCutoffTime(bedtimeStr = '23:00', standardDoseMg = 150) {
  const [bedHours, bedMinutes] = bedtimeStr.split(':').map(Number);

  // 150mg이 50mg 이하로 떨어지는 데 필요한 시간: 5 * log2(150 / 50) = 7.92시간
  const requiredHours = HALF_LIFE_HOURS * Math.log2(standardDoseMg / SAFE_THRESHOLD_MG);
  const requiredMinutes = Math.round(requiredHours * 60);

  const totalBedMinutes = bedHours * 60 + bedMinutes;
  let cutoffTotalMinutes = totalBedMinutes - requiredMinutes;

  if (cutoffTotalMinutes < 0) {
    cutoffTotalMinutes += 24 * 60;
  }

  const cutoffH = String(Math.floor(cutoffTotalMinutes / 60)).padStart(2, '0');
  const cutoffM = String(cutoffTotalMinutes % 60).padStart(2, '0');

  return `${cutoffH}:${cutoffM}`;
}

module.exports = {
  calculateRemainingCaffeine,
  assessSleepRisk,
  calculateCutoffTime,
};

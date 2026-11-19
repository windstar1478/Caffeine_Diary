/* 음료 섭취 기록 / 수면 기록 입력값 검증 (담당 B) */

const MAX_CAFFEINE_PER_RECORD_MG = 1000; // 1회 기록 상한 (오입력 방지용)
const SLEEP_ONSET_LEVELS = ['easy', 'normal', 'hard']; // 입면 난이도
const REFRESH_SCORE_MIN = 1;
const REFRESH_SCORE_MAX = 5;

// 오프셋이 반드시 포함된 ISO 8601 (예: 2026-11-16T14:30:00+09:00)
// 오프셋 없는 문자열은 서버 시간대로 해석되어 날짜가 어긋날 수 있으므로 거부한다.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDateTime(value) {
  return typeof value === 'string' && ISO_WITH_OFFSET.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // 2026-02-30 같은 존재하지 않는 날짜 거부
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// 음료별 카페인 함량 유효성 검사
function isValidCaffeineMg(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_CAFFEINE_PER_RECORD_MG;
}

// 수면 점수 범위 검증 (1~5 정수)
function isValidRefreshScore(value) {
  return Number.isInteger(value) && value >= REFRESH_SCORE_MIN && value <= REFRESH_SCORE_MAX;
}

/**
 * 섭취 기록 검증
 * - drinkId가 있으면 음료 DB에서 이름/함량을 가져온다 (DB 수치 우선).
 * - drinkId가 없으면 직접 입력(drinkName + caffeineMg)으로 처리한다.
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
function validateIntake(body, drinks) {
  const errors = [];
  const input = body || {};
  let drinkId = null;
  let drinkName;
  let caffeineMg;

  if (input.drinkId !== undefined && input.drinkId !== null && input.drinkId !== '') {
    const drink = drinks.find((d) => d.id === input.drinkId);
    if (!drink) {
      errors.push(`음료 DB에 없는 drinkId입니다: ${input.drinkId}`);
    } else if (!isValidCaffeineMg(drink.caffeineMg)) {
      errors.push(`음료 DB의 카페인 함량이 올바르지 않습니다: ${input.drinkId}`);
    } else {
      drinkId = drink.id;
      drinkName = drink.name;
      caffeineMg = drink.caffeineMg;
    }
  } else {
    if (typeof input.drinkName !== 'string' || input.drinkName.trim() === '') {
      errors.push('drinkId 또는 drinkName이 필요합니다.');
    } else {
      drinkName = input.drinkName.trim();
    }
    if (!isValidCaffeineMg(input.caffeineMg)) {
      errors.push(`caffeineMg는 0 초과 ${MAX_CAFFEINE_PER_RECORD_MG} 이하의 숫자여야 합니다.`);
    } else {
      caffeineMg = input.caffeineMg;
    }
  }

  if (!isValidIsoDateTime(input.intakeTime)) {
    errors.push('intakeTime은 오프셋이 포함된 ISO 형식이어야 합니다. 예: 2026-11-16T14:30:00+09:00');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { drinkId, drinkName, caffeineMg, intakeTime: input.intakeTime },
  };
}

/**
 * 수면 기록 검증
 * date = 기상한 날짜 (= 전날 밤의 수면)
 */
function validateSleep(body) {
  const errors = [];
  const input = body || {};

  if (!isValidDate(input.date)) {
    errors.push('date는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.');
  }
  if (!SLEEP_ONSET_LEVELS.includes(input.sleepOnsetDifficulty)) {
    errors.push(`sleepOnsetDifficulty는 ${SLEEP_ONSET_LEVELS.join(' | ')} 중 하나여야 합니다.`);
  }
  if (!isValidRefreshScore(input.refreshScore)) {
    errors.push(`refreshScore는 ${REFRESH_SCORE_MIN}~${REFRESH_SCORE_MAX} 사이의 정수여야 합니다.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: input.date,
      sleepOnsetDifficulty: input.sleepOnsetDifficulty,
      refreshScore: input.refreshScore,
    },
  };
}

module.exports = {
  MAX_CAFFEINE_PER_RECORD_MG,
  SLEEP_ONSET_LEVELS,
  isValidIsoDateTime,
  isValidDate,
  isValidCaffeineMg,
  isValidRefreshScore,
  validateIntake,
  validateSleep,
};

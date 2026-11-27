const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { calculateAverageCutoff, calculateSleepDifficultyRates } = require('../../shared/stats');

const router = express.Router();
const dataDirectory = path.join(__dirname, '../../data');

router.get('/', async (req, res) => {
  const source = req.query.source || 'actual';
  if (!['actual', 'sample'].includes(source)) {
    return res.status(400).json({ message: '올바른 데이터 종류를 선택해 주세요.' });
  }

  try {
    let records = [];
    let message = '아직 실제 기록이 없습니다. 샘플 데이터로 대시보드를 확인해 보세요.';
    if (source === 'sample') {
      const sample = JSON.parse(await fs.readFile(path.join(dataDirectory, 'sample-data.json'), 'utf8'));
      records = sample.dailyRecords;
      message = '발표용 가상 데이터입니다. 실제 사용자 기록이 아닙니다.';
    } else {
      // B 담당의 실제 저장 형식 확정 후, 섭취일별로 수면 기록을 결합합니다.
      const contents = await Promise.all(['records.json', 'sleep.json'].map(async (name) => {
        const text = await fs.readFile(path.join(dataDirectory, name), 'utf8');
        return text.trim() ? JSON.parse(text) : [];
      }));
      const isEmpty = contents.every((value) => Array.isArray(value) && value.length === 0);
      if (!isEmpty) {
        return res.status(409).json({ message: '실제 기록이 있습니다. 저장 형식에 맞춘 통계 연결 작업이 필요합니다. 샘플 데이터는 사용할 수 있습니다.' });
      }
    }

    // 날짜 순서로 7일 단위 구간을 구성합니다. 샘플은 월요일부터 21일입니다.
    const ordered = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const weeks = [];
    for (let index = 0; index < ordered.length; index += 7) {
      const days = ordered.slice(index, index + 7);
      weeks.push({
        startDate: days[0].date,
        endDate: days[days.length - 1].date,
        days,
        averageCutoff: calculateAverageCutoff(days),
        difficultyRates: calculateSleepDifficultyRates(days),
      });
    }
    res.json({ source, message, totalDays: ordered.length, weeks });
  } catch (error) {
    console.error('주간 통계 조회 실패:', error.message);
    res.status(500).json({ message: '통계를 불러오지 못했습니다. 데이터 파일을 확인한 뒤 다시 시도해 주세요.' });
  }
});

module.exports = router;

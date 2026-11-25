const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const {
  calculateRemainingCaffeine,
  assessSleepRisk,
  calculateCutoffTime,
} = require('../../shared/calcCaffeine');

const RECORDS_PATH = path.join(__dirname, '../../data/records.json');

// GET /api/caffeine/status?bedtime=23:00
router.get('/status', (req, res) => {
  const bedtime = req.query.bedtime || '23:00';
  let records = [];

  if (fs.existsSync(RECORDS_PATH)) {
    try {
      const raw = fs.readFileSync(RECORDS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        records = parsed;
      }
    } catch (e) {
      records = [];
    }
  }

  const now = new Date();
  const currentRemaining = calculateRemainingCaffeine(records, now);;
  const risk = assessSleepRisk(records, bedtime, now);
  const cutoffTime = calculateCutoffTime(bedtime);

  res.json({
    currentRemaining,
    bedtimeRemaining: risk.bedtimeRemaining,
    riskLevel: risk.level,
    riskLabel: risk.label,
    cutoffTime,
  });
});

module.exports = router;

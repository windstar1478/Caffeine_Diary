/* 음료 DB 조회 / 섭취 기록 / 수면 기록 CRUD API (담당 B)
 *
 * server.js에서 app.use('/api', recordsRouter)로 연결
 *
 *   GET    /api/drinks                    음료 DB 목록
 *   GET    /api/records?date=YYYY-MM-DD   섭취 기록 조회 (date 또는 from/to 필터 선택)
 *   POST   /api/records                   섭취 기록 저장
 *   DELETE /api/records/:id               섭취 기록 삭제
 *   GET    /api/sleep?from=&to=           수면 기록 조회
 *   POST   /api/sleep                     수면 기록 저장 (같은 date면 덮어씀)
 *   DELETE /api/sleep/:id                 수면 기록 삭제
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateIntake, validateSleep, isValidDate } = require('../services/validators');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../data');
const DRINKS_PATH = path.join(DATA_DIR, 'drinks.json');
const RECORDS_PATH = path.join(DATA_DIR, 'records.json');
const SLEEP_PATH = path.join(DATA_DIR, 'sleep.json');

// ------------------------------------------------------------
// JSON 파일 입출력
// ------------------------------------------------------------

// 파일이 없거나 비어 있으면 빈 배열 반환
function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (raw === '') return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)}의 최상위 값이 배열이 아닙니다.`);
  }
  return parsed;
}

// 임시 파일에 쓴 뒤 rename → 쓰는 도중 서버가 꺼져도 원본이 깨지지 않음
function writeJsonArray(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// "2026-11-16T14:30:00+09:00" → "2026-11-16" (기록 시점의 현지 날짜)
function localDateOf(isoString) {
  return isoString.slice(0, 10);
}

// date / from / to 쿼리로 날짜 범위 필터
function parseDateRange(query) {
  const { date, from, to } = query;
  if (date !== undefined) {
    if (!isValidDate(date)) return { error: 'date는 YYYY-MM-DD 형식이어야 합니다.' };
    return { from: date, to: date };
  }
  if (from !== undefined && !isValidDate(from)) return { error: 'from은 YYYY-MM-DD 형식이어야 합니다.' };
  if (to !== undefined && !isValidDate(to)) return { error: 'to는 YYYY-MM-DD 형식이어야 합니다.' };
  return { from, to };
}

function inRange(day, { from, to }) {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

// ------------------------------------------------------------
// 음료 DB
// ------------------------------------------------------------

router.get('/drinks', (req, res, next) => {
  try {
    res.json(readJsonArray(DRINKS_PATH));
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// 섭취 기록
// ------------------------------------------------------------

router.get('/records', (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ error: range.error });

    const records = readJsonArray(RECORDS_PATH)
      .filter((r) => inRange(localDateOf(r.intakeTime), range))
      .sort((a, b) => Date.parse(a.intakeTime) - Date.parse(b.intakeTime));

    return res.json(records);
  } catch (err) {
    return next(err);
  }
});

router.post('/records', (req, res, next) => {
  try {
    const drinks = readJsonArray(DRINKS_PATH);
    const result = validateIntake(req.body, drinks);
    if (!result.ok) {
      return res.status(400).json({ error: '입력값이 올바르지 않습니다.', details: result.errors });
    }

    const record = {
      id: crypto.randomUUID(),
      ...result.value,
      createdAt: new Date().toISOString(),
    };

    const records = readJsonArray(RECORDS_PATH);
    records.push(record);
    writeJsonArray(RECORDS_PATH, records);

    return res.status(201).json(record);
  } catch (err) {
    return next(err);
  }
});

router.delete('/records/:id', (req, res, next) => {
  try {
    const records = readJsonArray(RECORDS_PATH);
    const remaining = records.filter((r) => r.id !== req.params.id);
    if (remaining.length === records.length) {
      return res.status(404).json({ error: '해당 기록을 찾을 수 없습니다.' });
    }
    writeJsonArray(RECORDS_PATH, remaining);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------------------------------
// 수면 기록
// ------------------------------------------------------------

router.get('/sleep', (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ error: range.error });

    const sleepLogs = readJsonArray(SLEEP_PATH)
      .filter((s) => inRange(s.date, range))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json(sleepLogs);
  } catch (err) {
    return next(err);
  }
});

// 하루 1건 원칙: 같은 date가 있으면 덮어쓰고 200, 새로 만들면 201
router.post('/sleep', (req, res, next) => {
  try {
    const result = validateSleep(req.body);
    if (!result.ok) {
      return res.status(400).json({ error: '입력값이 올바르지 않습니다.', details: result.errors });
    }

    const sleepLogs = readJsonArray(SLEEP_PATH);
    const idx = sleepLogs.findIndex((s) => s.date === result.value.date);
    const now = new Date().toISOString();

    if (idx >= 0) {
      sleepLogs[idx] = { ...sleepLogs[idx], ...result.value, updatedAt: now };
      writeJsonArray(SLEEP_PATH, sleepLogs);
      return res.status(200).json(sleepLogs[idx]);
    }

    const log = { id: crypto.randomUUID(), ...result.value, createdAt: now };
    sleepLogs.push(log);
    writeJsonArray(SLEEP_PATH, sleepLogs);
    return res.status(201).json(log);
  } catch (err) {
    return next(err);
  }
});

router.delete('/sleep/:id', (req, res, next) => {
  try {
    const sleepLogs = readJsonArray(SLEEP_PATH);
    const remaining = sleepLogs.filter((s) => s.id !== req.params.id);
    if (remaining.length === sleepLogs.length) {
      return res.status(404).json({ error: '해당 기록을 찾을 수 없습니다.' });
    }
    writeJsonArray(SLEEP_PATH, remaining);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

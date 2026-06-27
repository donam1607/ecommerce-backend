const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { PageVisit } = require('../db');
const { protect, admin } = require('../auth.middleware');

// Helper: today's date key in UTC "YYYY-MM-DD"
const todayKey = () => new Date().toISOString().slice(0, 10);

const dateKeyFor = (d) => {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
};

// POST /api/analytics/visit (Public) - registers unique daily devices and active user ids
router.post('/visit', async (req, res) => {
  try {
    const { visitorId, userId } = req.body;

    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
      return res.status(400).json({ error: 'visitorId required (max 64 chars)' });
    }

    const dateKey = todayKey();
    const ipAddress = (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      null
    );

    const [visit, created] = await PageVisit.findOrCreate({
      where: { visitorId, dateKey },
      defaults: {
        visitorId,
        userId: userId || null,
        dateKey,
        pageViews: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        userAgent: req.headers['user-agent'] || null,
        ipAddress,
      },
    });

    if (!created) {
      await visit.update({
        pageViews: visit.pageViews + 1,
        lastSeen: new Date(),
        ...(userId && !visit.userId ? { userId } : {}),
      });
    }

    res.status(200).json({ ok: true, created });
  } catch (err) {
    console.error('[analytics/visit]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/stats (Admin-only) - computes traffic metrics and last 30-day window
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const today = todayKey();

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dateKeyFor(yesterdayDate);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoKey = dateKeyFor(thirtyDaysAgo);

    // Today metrics
    const todayVisits = await PageVisit.findAll({ where: { dateKey: today } });
    const todayUniqueVisitors = new Set(todayVisits.map(v => v.visitorId)).size;
    const todayLoggedIn = new Set(
      todayVisits.filter(v => v.userId).map(v => v.userId)
    ).size;
    const todayPageViews = todayVisits.reduce((sum, v) => sum + v.pageViews, 0);

    // Yesterday metrics
    const yestVisits = await PageVisit.findAll({ where: { dateKey: yesterday } });
    const yestUniqueVisitors = new Set(yestVisits.map(v => v.visitorId)).size;
    const yestPageViews = yestVisits.reduce((sum, v) => sum + v.pageViews, 0);

    // Cumulative totals
    const allVisits = await PageVisit.findAll({ attributes: ['visitorId', 'userId', 'pageViews'] });
    const totalUniqueVisitors = new Set(allVisits.map(v => v.visitorId)).size;
    const totalLoggedInUsers = new Set(
      allVisits.filter(v => v.userId).map(v => v.userId)
    ).size;
    const totalPageViews = allVisits.reduce((sum, v) => sum + v.pageViews, 0);

    // 30 days window
    const last30Raw = await PageVisit.findAll({
      where: { dateKey: { [Op.gte]: thirtyDaysAgoKey } },
      attributes: ['visitorId', 'dateKey', 'userId', 'pageViews'],
      order: [['dateKey', 'ASC']],
    });

    const byDate = {};
    last30Raw.forEach(v => {
      if (!byDate[v.dateKey]) byDate[v.dateKey] = { visitors: new Set(), loggedIn: new Set(), pageViews: 0 };
      byDate[v.dateKey].visitors.add(v.visitorId);
      if (v.userId) byDate[v.dateKey].loggedIn.add(v.userId);
      byDate[v.dateKey].pageViews += v.pageViews;
    });

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKeyFor(d);
      const entry = byDate[key];
      last30Days.push({
        date: key,
        uniqueVisitors: entry ? entry.visitors.size : 0,
        loggedIn: entry ? entry.loggedIn.size : 0,
        pageViews: entry ? entry.pageViews : 0,
      });
    }

    const visitorGrowth = yestUniqueVisitors > 0
      ? (((todayUniqueVisitors - yestUniqueVisitors) / yestUniqueVisitors) * 100).toFixed(1)
      : null;
    const pageViewGrowth = yestPageViews > 0
      ? (((todayPageViews - yestPageViews) / yestPageViews) * 100).toFixed(1)
      : null;

    res.json({
      today: {
        uniqueVisitors: todayUniqueVisitors,
        loggedIn: todayLoggedIn,
        pageViews: todayPageViews,
      },
      yesterday: {
        uniqueVisitors: yestUniqueVisitors,
        pageViews: yestPageViews,
      },
      growth: {
        visitors: visitorGrowth,
        pageViews: pageViewGrowth,
      },
      allTime: {
        uniqueVisitors: totalUniqueVisitors,
        loggedInUsers: totalLoggedInUsers,
        pageViews: totalPageViews,
      },
      last30Days,
    });
  } catch (err) {
    console.error('[analytics/stats]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

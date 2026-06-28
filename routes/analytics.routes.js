const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { PageVisit, User } = require('../db');
const { protect, admin } = require('../auth.middleware');

// ─── Helpers ────────────────────────────────────────────────────────────────

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateKeyFor = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Parse User-Agent string into human-readable device info.
 */
function parseUserAgent(ua) {
  if (!ua) return { deviceType: 'Unknown', browser: 'Unknown', os: 'Unknown' };

  // Device type
  let deviceType = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) deviceType = 'Tablet';
  else if (/mobile|iphone|ipod|android(?!.*tablet)|blackberry|windows phone|opera mini|iemobile/i.test(ua)) deviceType = 'Mobile';

  // Browser
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Browser';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  // OS
  let os = 'Unknown';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone OS/i.test(ua)) {
    const v = ua.match(/iPhone OS ([\d_]+)/);
    os = `iOS ${v ? v[1].replace(/_/g, '.') : ''}`;
  }
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/);
    os = `Android ${v ? v[1] : ''}`;
  }
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { deviceType, browser, os };
}

/**
 * Lookup geolocation & advanced network attributes from ip-api.com.
 * Non-blocking updates.
 */
async function lookupGeo(ip, visitRecord) {
  if (!ip || /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/i.test(ip)) return;
  if (visitRecord.country && visitRecord.isp) return; // Already resolved

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,mobile,proxy`,
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await res.json();
    if (data.status === 'success') {
      await visitRecord.update({
        country: data.country || null,
        countryCode: data.countryCode || null,
        city: data.city || null,
        region: data.regionName || null,
        isp: data.isp || null,
        isMobileData: !!data.mobile,
        isVpn: !!data.proxy,
      });
    }
  } catch (_) {
    // Non-blocking catch
  }
}

function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes(':')) return ip.replace(/:[^:]+$/, ':****');
  return ip.replace(/\.\d+$/, '.***');
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /api/analytics/visit (Public)
router.post('/visit', async (req, res) => {
  try {
    const { visitorId, userId, screenResolution, browserLanguage, entryPage, referrer } = req.body;

    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
      return res.status(400).json({ error: 'visitorId required (max 64 chars)' });
    }

    const dateKey = todayKey();
    const rawIp = (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
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
        ipAddress: rawIp,
        screenResolution: screenResolution || null,
        browserLanguage: browserLanguage || null,
        entryPage: entryPage || null,
        referrer: referrer || null,
      },
    });

    if (!created) {
      await visit.update({
        pageViews: visit.pageViews + 1,
        lastSeen: new Date(),
        ...(userId && !visit.userId ? { userId } : {}),
        // Update properties if missing
        ...(screenResolution && !visit.screenResolution ? { screenResolution } : {}),
        ...(browserLanguage && !visit.browserLanguage ? { browserLanguage } : {}),
        ...(entryPage && !visit.entryPage ? { entryPage } : {}),
        ...(referrer && !visit.referrer ? { referrer } : {}),
      });
    }

    // Fire-and-forget IP geolocation lookup
    lookupGeo(rawIp, visit);

    res.status(200).json({ ok: true, created });
  } catch (err) {
    console.error('[analytics/visit]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/stats (Admin)
// Supports optional date parameter: ?date=YYYY-MM-DD
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const today = todayKey();
    const targetDate = req.query.date || today;

    // Calculate previous day for growth comparison
    const targetDateObj = new Date(targetDate + 'T12:00:00');
    const prevDateObj = new Date(targetDateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const yesterday = dateKeyFor(prevDateObj);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoKey = dateKeyFor(thirtyDaysAgo);

    const [todayVisits, yestVisits, allVisits, last30Raw] = await Promise.all([
      PageVisit.findAll({ where: { dateKey: targetDate } }),
      PageVisit.findAll({ where: { dateKey: yesterday } }),
      PageVisit.findAll({ attributes: ['visitorId', 'userId', 'pageViews'] }),
      PageVisit.findAll({
        where: { dateKey: { [Op.gte]: thirtyDaysAgoKey } },
        attributes: ['visitorId', 'dateKey', 'userId', 'pageViews'],
        order: [['dateKey', 'ASC']],
      }),
    ]);

    const todayUniqueVisitors = new Set(todayVisits.map(v => v.visitorId)).size;
    const todayLoggedIn = new Set(todayVisits.filter(v => v.userId).map(v => v.userId)).size;
    const todayPageViews = todayVisits.reduce((s, v) => s + v.pageViews, 0);
    const yestUniqueVisitors = new Set(yestVisits.map(v => v.visitorId)).size;
    const yestPageViews = yestVisits.reduce((s, v) => s + v.pageViews, 0);

    const totalUniqueVisitors = new Set(allVisits.map(v => v.visitorId)).size;
    const totalLoggedInUsers = new Set(allVisits.filter(v => v.userId).map(v => v.userId)).size;
    const totalPageViews = allVisits.reduce((s, v) => s + v.pageViews, 0);

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
      ? (((todayUniqueVisitors - yestUniqueVisitors) / yestUniqueVisitors) * 100).toFixed(1) : null;
    const pageViewGrowth = yestPageViews > 0
      ? (((todayPageViews - yestPageViews) / yestPageViews) * 100).toFixed(1) : null;

    res.json({
      targetDate,
      today: { uniqueVisitors: todayUniqueVisitors, loggedIn: todayLoggedIn, pageViews: todayPageViews },
      yesterday: { uniqueVisitors: yestUniqueVisitors, pageViews: yestPageViews },
      growth: { visitors: visitorGrowth, pageViews: pageViewGrowth },
      allTime: { uniqueVisitors: totalUniqueVisitors, loggedInUsers: totalLoggedInUsers, pageViews: totalPageViews },
      last30Days,
    });
  } catch (err) {
    console.error('[analytics/stats]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/devices (Admin)
// Query params: ?date=YYYY-MM-DD&loggedInOnly=true&page=1&limit=50
router.get('/devices', protect, admin, async (req, res) => {
  try {
    const { date, loggedInOnly, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Build query conditions
    const where = {};
    if (date) {
      where.dateKey = date;
    }
    if (loggedInOnly === 'true') {
      where.userId = { [Op.ne]: null };
    }

    const { count, rows } = await PageVisit.findAndCountAll({
      where,
      order: [['lastSeen', 'DESC']],
      limit: limitNum,
      offset,
    });

    // Populate user account names/emails
    const userIds = [...new Set(rows.filter(r => r.userId).map(r => r.userId))];
    let userMap = {};
    if (userIds.length > 0) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'name', 'email'],
      });
      users.forEach(u => { userMap[u.id] = { name: u.name, email: u.email }; });
    }

    const devices = rows.map(v => {
      const ua = parseUserAgent(v.userAgent);
      return {
        id: v.id,
        visitorId: v.visitorId,
        dateKey: v.dateKey,
        pageViews: v.pageViews,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        // Tech details
        deviceType: ua.deviceType,
        browser: ua.browser,
        os: ua.os,
        screenResolution: v.screenResolution || 'Unknown',
        browserLanguage: v.browserLanguage || 'Unknown',
        entryPage: v.entryPage || 'Unknown',
        referrer: v.referrer || 'Direct',
        // Location
        ip: maskIp(v.ipAddress),
        country: v.country || null,
        countryCode: v.countryCode || null,
        city: v.city || null,
        region: v.region || null,
        // Advanced Network Info
        isp: v.isp || 'Local/LAN',
        isMobileData: !!v.isMobileData,
        isVpn: !!v.isVpn,
        // User accounts
        userId: v.userId || null,
        userName: v.userId && userMap[v.userId] ? userMap[v.userId].name : null,
        userEmail: v.userId && userMap[v.userId] ? userMap[v.userId].email : null,
      };
    });

    res.json({
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
      devices,
    });
  } catch (err) {
    console.error('[analytics/devices]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

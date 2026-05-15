import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as adminService from '../services/admin.service.js';
import * as drawService from '../services/draw.service.js';

export const kpis = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardKpis();
  res.json({ success: true, data });
});

export const revenueChart = asyncHandler(async (req, res) => {
  const data = await adminService.revenueByWeekChart(24);
  res.json({ success: true, data });
});

export const transactions = asyncHandler(async (req, res) => {
  const data = await adminService.listWalletTransactions(req.query);
  res.json({ success: true, data });
});

export const drawHistory = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawHistory(req.query);
  res.json({ success: true, data });
});

export const draws = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawsAdmin(req.query);
  res.json({ success: true, data });
});

export const triggerDraw = asyncHandler(async (req, res) => {
  const { drawId } = req.body;
  const summary = await drawService.executeWeeklyDraw({
    drawId,
    admin: req.user,
    ip: req.ip,
  });
  res.json({ success: true, data: summary });
});

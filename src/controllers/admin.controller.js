import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as adminService from '../services/admin.service.js';
import * as drawService from '../services/draw.service.js';

// Get KPIs for the admin dashboard overview card.
export const kpis = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardKpis();
  res.json({ success: true, data });
});

// Get paginated/filtered list of users.
export const users = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers(req.query);
  res.json({ success: true, data });
});

// Get weekly revenue data for the chart dashboard (last 6 weeks).
export const revenueChart = asyncHandler(async (req, res) => {
  const data = await adminService.revenueByWeekChart(6);
  res.json({ success: true, data });
});

// List all wallet deposits/payouts with filtering support.
export const transactions = asyncHandler(async (req, res) => {
  const data = await adminService.listWalletTransactions(req.query);
  res.json({ success: true, data });
});

// Get the history of all completed draws.
export const drawHistory = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawHistory(req.query);
  res.json({ success: true, data });
});

// Get all draws (open, pending, completed) for administration.
export const draws = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawsAdmin(req.query);
  res.json({ success: true, data });
});

// Manually kick off a weekly draw from the admin panel.
export const triggerDraw = asyncHandler(async (req, res) => {
  const { drawId } = req.body;
  const summary = await drawService.executeWeeklyDraw({
    drawId,
    admin: req.user,
    ip: req.ip,
  });
  res.json({ success: true, data: summary });
});

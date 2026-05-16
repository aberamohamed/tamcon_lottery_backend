import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as adminService from '../services/admin.service.js';
import * as drawService from '../services/draw.service.js';

/**
 * Retrieves KPI data for the admin dashboard.
 */
export const kpis = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardKpis();
  res.json({ success: true, data });
});

/**
 * Lists users for the admin panel with optional filtering.
 */
export const users = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers(req.query);
  res.json({ success: true, data });
});

/**
 * Retrieves data for the revenue chart spanning the last 6 weeks.
 */
export const revenueChart = asyncHandler(async (req, res) => {
  const data = await adminService.revenueByWeekChart(6);
  res.json({ success: true, data });
});

/**
 * Lists wallet transactions across all users.
 */
export const transactions = asyncHandler(async (req, res) => {
  const data = await adminService.listWalletTransactions(req.query);
  res.json({ success: true, data });
});

/**
 * Lists the completed draws history.
 */
export const drawHistory = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawHistory(req.query);
  res.json({ success: true, data });
});

/**
 * Lists all lottery draws (open, pending, completed) for the admin panel.
 */
export const draws = asyncHandler(async (req, res) => {
  const data = await adminService.listDrawsAdmin(req.query);
  res.json({ success: true, data });
});

/**
 * Triggers the weekly draw manually from the admin panel.
 */
export const triggerDraw = asyncHandler(async (req, res) => {
  const { drawId } = req.body;
  const summary = await drawService.executeWeeklyDraw({
    drawId,
    admin: req.user,
    ip: req.ip,
  });
  res.json({ success: true, data: summary });
});

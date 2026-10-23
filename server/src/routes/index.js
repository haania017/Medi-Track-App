import express from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import { familiesRouter, familyMembersRouter } from './families.js';
import medicineRoutes from './medicines.js';
import doseRoutes from './doses.js';
import stockRoutes from './stock.js';
import carePlanRoutes from './carePlans.js';
import notificationRoutes from './notifications.js';
import reportRoutes from './reports.js';
import allergyRoutes from './allergies.js';
import medicineInfoRoutes from './medicineInfo.js';
import prescriptionRoutes from './prescriptions.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Family hub. Mounted on explicit prefixes so an unknown path under
// /api/v1 falls through to the 404 handler instead of an auth check.
router.use('/families', familiesRouter);
router.use('/family-members', familyMembersRouter);

router.use('/medicines', medicineRoutes);
router.use('/doses', doseRoutes);
router.use('/stock', stockRoutes);
router.use('/care-plans', carePlanRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/allergies', allergyRoutes);
router.use('/medicine-info', medicineInfoRoutes);
// Prescription scans and package scans share the same workflow.
router.use('/prescriptions', prescriptionRoutes);
router.use('/packages', prescriptionRoutes);

export default router;

import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.model.js';

/**
 * Record a user joining a session.
 * Idempotent — will not duplicate if user already has an open record.
 */
export async function recordJoin(sessionId, userId, userName, registerNo, ipAddress) {
  // Check for existing open record (reconnect scenario)
  const existing = await Attendance.findOne({
    sessionId,
    userId,
    leaveTime: null,
  });

  if (existing) {
    // It's a reconnect
    existing.reconnectCount += 1;
    // Update IP if it changed
    if (ipAddress) existing.ipAddress = ipAddress;
    await existing.save();
    return existing;
  }

  const record = new Attendance({ 
    sessionId, 
    userId, 
    userName, 
    registerNo, 
    ipAddress, 
    joinTime: new Date() 
  });
  await record.save();
  return record;
}

/**
 * Record a user leaving a session.
 */
export async function recordLeave(sessionId, userId) {
  const record = await Attendance.findOne({
    sessionId,
    userId,
    leaveTime: null,
  });

  if (!record) return null;

  const now = new Date();
  record.leaveTime = now;
  record.duration = Math.round((now - record.joinTime) / 1000); // seconds
  await record.save();
  return record;
}

/**
 * Get aggregated attendance report for a session (no duplications).
 * Optimized with MongoDB Aggregation for speed.
 */
export async function getAttendanceReport(sessionId) {
  const report = await Attendance.aggregate([
    { $match: { sessionId: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: "$userId",
        userName: { $first: "$userName" },
        registerNo: { $first: "$registerNo" },
        joinTime: { $min: "$joinTime" },
        allLeaveTimes: { $push: "$leaveTime" },
        hasOpenSession: { $max: { $cond: [{ $eq: ["$leaveTime", null] }, 1, 0] } },
        duration: { $sum: { $ifNull: ["$duration", 0] } },
        reconnectCount: { $sum: { $ifNull: ["$reconnectCount", 0] } },
        sessionsCount: { $sum: 1 },
        ips: { $addToSet: "$ipAddress" }
      }
    },
    {
      $addFields: {
        leaveTime: {
          $cond: {
            if: { $eq: ["$hasOpenSession", 1] },
            then: null,
            else: { $max: "$allLeaveTimes" }
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $project: {
        _id: 1,
        userId: { $arrayElemAt: ["$userInfo", 0] },
        userName: 1,
        registerNo: 1,
        joinTime: 1,
        leaveTime: 1,
        duration: 1,
        reconnectCount: 1,
        sessionsCount: 1,
        ips: 1
      }
    },
    { $sort: { joinTime: 1 } }
  ]);

  return report;
}

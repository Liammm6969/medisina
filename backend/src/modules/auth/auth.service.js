import User from './auth.model.js';
import PersonnelModel from '../personnel/personnel.model.js';
import { generateResetToken, verifyToken } from '#utils/crypto.js';
import { sendResetPasswordEmail, sendEmail, sendEmailApproval } from '#utils/email.js';
import ApiError from '#utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';
import notificationService from '#modules/notifications/notification.service.js';
import { NOTIFICATION_TYPES, PRIORITY_LEVELS } from '#utils/constants.js';
import mongoose from 'mongoose';
import logger from '#logger/logger.js';
import fetch from "node-fetch";
import personnelService from '#modules/personnel/personnel.service.js';
import cache from '#utils/cache.js';
import { CACHE_KEYS, CACHE_TTL } from '#utils/cacheKeys.js';
class AuthService {
  async registerOrCreate(userData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { email } = userData;
      const response = await fetch(`https://isfakemail.com/api/check?url=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data.isDisposable) {
        throw new ApiError("Temporary emails are not allowed", 400);
      }
      const duplicate = await User.isDuplicateEmail(email)

      if (duplicate) throw new ApiError(`A personnel with this ${duplicate} already exists.`, StatusCodes.CONFLICT);

      const [newUser] = await User.create([userData], { session });

      await this.createPersonnelRecord(newUser, userData, session);

      await notificationService.createNotification({
        recipientId: newUser._id,
        title: 'ACCOUNT CREATED',
        message: `Welcome ${newUser.firstName}! Your account has been created successfully. Please wait for admin approval.`,
        type: NOTIFICATION_TYPES.SYSTEM,
        priority: PRIORITY_LEVELS.HIGH,
        isActionRequired: true
      }, session);

      const admins = await User.find({ role: 'Admin', isDeleted: false }).select('_id').session(session);

      const adminNotifications = admins.map(admin => ({
        recipientId: admin._id,
        title: 'NEW USER REGISTRATION',
        message: `${newUser.firstName} ${newUser.lastName} (${newUser.email}) has registered and is pending approval.`,
        type: NOTIFICATION_TYPES.APPROVAL,
        priority: PRIORITY_LEVELS.HIGH,
        isActionRequired: true
      }));

      if (adminNotifications.length > 0) {
        await notificationService.createBulkNotifications(adminNotifications, session);
      }

      newUser.accountCreated = Date.now()

      await session.commitTransaction();

      await cache.delPattern(CACHE_KEYS.USER.PATTERN);

      return newUser.toPersonnelJSON();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async createPersonnelRecord(user, userData, session = null) {

    const personnelData = {
      firstName: user?.firstName,
      middleName: user?.middleName,
      lastName: user?.lastName,
      gender: userData?.gender || user?.gender,
      age: userData?.age || null,
      dateOfBirth: userData?.dateOfBirth || null,
      civilStatus: userData?.civilStatus,
      position: userData?.position,
      schoolDistrictDivision: user?.schoolDistrictDivision || userData?.schoolDistrictDivision || [],
      schoolName: user?.schoolName || userData?.schoolName || [],
      schoolId: user?.schoolId || userData?.schoolId || [],
      yearsInService: userData?.yearsInService || 0,
      firstYearInService: userData?.firstYearInService || null,
      createdBy: user?._id
    };

    const isDuplicate = await PersonnelModel.isDuplicateName({
      firstName: personnelData.firstName,
      lastName: personnelData.lastName
    });

    if (isDuplicate) {
      throw new ApiError(`Personnel record already exists for ${personnelData.firstName} ${personnelData.lastName}`, StatusCodes.CONFLICT);
    }

    const options = session ? { session, ordered: true } : { ordered: true };
    const [newPersonnel] = await PersonnelModel.create([personnelData], options);
    return newPersonnel;
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email })
    if (!user) {
      throw new ApiError(`Password reset requested for non-existent email: ${email}`, StatusCodes.NOT_FOUND);
    }

    const { token, hashed } = generateResetToken()

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    await sendResetPasswordEmail(email, token)
    return "If an account exists with this email, a reset link has been sent."
  }

  async resetPassword(token, password) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const hashedToken = verifyToken(token);

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      }).session(session);

      if (!user) {
        const expiredUser = await User.findOne({
          resetPasswordToken: hashedToken
        }).session(session);

        if (expiredUser) {
          throw new ApiError("Reset token has expired. Please request a new password reset.", StatusCodes.BAD_REQUEST);
        }

        throw new ApiError("Invalid or expired token", StatusCodes.BAD_REQUEST);
      }

      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ session });

      await sendEmail(user.email, 'Your Password has been changed', `This is a confirmation that the password for your account "${user.email}" has just been changed.`,);

      await notificationService.createNotification({
        recipientId: user._id,
        title: 'PASSWORD CHANGED',
        message: 'Your password has been successfully changed. If you did not make this change, please contact support immediately.',
        type: NOTIFICATION_TYPES.SYSTEM,
        priority: PRIORITY_LEVELS.HIGH,
        isActionRequired: false
      }, session);

      await session.commitTransaction();

      return 'Password updated successfully'
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  async fetchAllUsers() {
    const cacheKey = CACHE_KEYS.USER.ALL;
    const { data } = await cache.getOrSet(
      cacheKey,
      async () => {
        const users = await User.find({ isDeleted: false })
          .select('-password -resetPasswordToken -resetPasswordExpires')
          .lean();
        return users.map(user => ({
          ...user,
          createdAt: new Date(user.createdAt).toLocaleDateString("en-GB")
        }));
      },
      CACHE_TTL.SHORT
    );
    return data;
  }

  async searchUsers(query, options = {}) {
    const { limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;

    let filter = { isDeleted: false };

    if (query && query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      filter.$or = [
        { firstName: searchRegex },
        { middleName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { role: searchRegex },
        { schoolDistrictDivision: searchRegex }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .limit(limit)
        .skip(skip)
        .lean(),
      User.countDocuments(filter)
    ]);

    const formattedUsers = users.map(user => ({
      ...user,
      createdAt: new Date(user.createdAt).toLocaleDateString("en-GB")
    }));

    return {
      data: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getAllUserCount() {
    return await User.countDocuments({ isDeleted: false })
  }

  async updateUser(email, data) {
    const existingUser = await User.findOne({
      isDeleted: false,
      email,
    })
      .select('_id email status')
      .lean();

    if (!existingUser) throw new ApiError('User not found', StatusCodes.NOT_FOUND);

    if (data.status && data.status === 'Approved' && existingUser.status !== 'Approved') {
      sendEmailApproval(email);

      await notificationService.createNotification({
        recipientId: existingUser._id,
        title: 'ACCOUNT APPROVED',
        message: `Congratulations! Your account has been approved. You can now access all features.`,
        type: NOTIFICATION_TYPES.APPROVED,
        priority: PRIORITY_LEVELS.HIGH,
        isActionRequired: false
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      existingUser._id,
      data,
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires').lean();

    await cache.delPattern(CACHE_KEYS.USER.PATTERN);
    return updatedUser;
  }
  async toggleAllStatus() {
    const result = await User.updateMany(
      { isDeleted: false },
      { $set: { status: "Approved" } }
    );

    await cache.delPattern(CACHE_KEYS.USER.PATTERN);

    return result
  }

  async getUserById(userId) {
    return await User.find({ _id: userId })
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .lean()
  }

  async isDuplicateEmail(email) {
    const duplicate = await User.isDuplicateEmail(email)

    if (duplicate) throw new ApiError(`A User with this ${duplicate} already exists.`, StatusCodes.CONFLICT);

    return false
  }

}

export default new AuthService()
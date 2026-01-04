import { StatusCodes } from "http-status-codes";
import authService from './auth.service.js';
import passport from 'passport';
import asyncHandler from "express-async-handler";
import logger from '#logger/logger.js'
import ApiError from "#utils/ApiError.js";
import { clearEncryptedCookie } from '#middleware/encryptedCookie.js';
import fetch from "node-fetch";
export const registerOrCreate = asyncHandler(async (req, res) => {
  const user = await authService.registerOrCreate(req.body);
  return res.status(StatusCodes.CREATED).json({ message: "Personnel Registered", user });
});

export const login = asyncHandler(async (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      const errorMsg = info?.message || 'Unauthorized';
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: errorMsg });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.logIn(user, (err) => {
        if (err) return next(err);


        const rememberMe = Boolean(req.body?.rememberMe);
        if (rememberMe) {
          req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
          req.sessionStore.ttl = 60 * 60 * 24 * 30;
        }

        req.session.save((err) => {
          if (err) return next(err);

          if (!req.user) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              error: "User serialization failed"
            });
          }

          return res.status(StatusCodes.OK).json({
            message: "Login successful",
            user: req.user.toPersonnelJSON()
          });
        });
      });
    });
  })(req, res, next);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = req.body.email;
  const user = await authService.forgotPassword(email);
  res.status(StatusCodes.OK).send(user);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password: newPassword } = req.body;
  if (!token) throw new ApiError("Token must be provided", StatusCodes.BAD_REQUEST);
  if (!newPassword) throw new ApiError("New Password must be provided", StatusCodes.BAD_REQUEST);
  const result = await authService.resetPassword(token, newPassword);
  res.status(StatusCodes.OK).json({ message: result });
});

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password: newPassword } = req.body;

  if (!token) throw new ApiError("Token must be provided", StatusCodes.BAD_REQUEST);
  if (!newPassword) throw new ApiError("New Password must be provided", StatusCodes.BAD_REQUEST);


  const result = await authService.resetPassword(token, newPassword);
  res.status(StatusCodes.OK).json({ message: result });
});

export const logout = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Logout failed' });
    req.session.destroy((err) => {
      if (err) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to destroy session' });

      clearEncryptedCookie(res, 'medisync.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    });
    
  });
};

export const fetchAllUsers = asyncHandler(async (req, res) => {
  const users = await authService.fetchAllUsers()

  // Prevent browser/CDN caching to ensure fresh data in Vercel
  // res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  // res.set('Pragma', 'no-cache');
  // res.set('Expires', '0');

  return res.status(StatusCodes.OK).json({
    data: users
  })
})

export const searchUsers = asyncHandler(async (req, res) => {
  const { query, limit, page } = req.query;
  const result = await authService.searchUsers(query, { limit: parseInt(limit) || 50, page: parseInt(page) || 1 });

  return res.status(StatusCodes.OK).json(result);
})
export const getAllUserCount = asyncHandler(async (req, res) => {
  const users = await authService.getAllUserCount()

  return res.status(StatusCodes.OK).json({
    users
  })
})

export const updateUser = asyncHandler(async (req, res) => {
  const { email } = req.query

  if (!email) throw new ApiError('Email is required', StatusCodes.BAD_REQUEST)

  const {...updateData } = req.body

  const user = await authService.updateUser(email, updateData)

  return res.status(StatusCodes.OK).json({
    message: "User updated successfully",
    user

  })
})

export const toggleAllStatus = asyncHandler(async (req, res) => {
  const user = await authService.toggleAllStatus()

  if (!user) throw new ApiError("No Users to update", NOT_FOUND)
  return res.status(StatusCodes.OK).json({
    userCount: user.length
  })
})


export const isDuplicateEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  if (!email) throw new ApiError('email is required', StatusCodes.BAD_REQUEST);
  const response = await fetch(`https://isfakemail.com/api/check?url=${encodeURIComponent(email)}`);
  const data = await response.json();
  if (data.isDisposable) {
    throw new ApiError("Temporary emails are not allowed", 400);
  }
  const user = await authService.isDuplicateEmail(email);

  return res.status(StatusCodes.OK).json({
    data: user
  });
});

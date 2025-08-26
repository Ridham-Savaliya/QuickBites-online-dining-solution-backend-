import userModel from "../models/userMOdel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import oauth2client from "../config/google.js";
import { sendMail } from "../utills/sendEmail.js";
import sellerModel from "../models/sellerModel.js";
import { Admin } from "../models/adminModel.js";
import { google } from "googleapis";

// Helper function to generate a token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if the email is already in use
    const isEmailTaken = await Promise.all([
      Admin.findOne({ email }),
      sellerModel.findOne({ email }),
      userModel.findOne({ email }),
    ]);

    if (isEmailTaken.some((result) => result)) {
      return res.status(400).json({
        success: false,
        message: "This Email is already in use. Please use another email!",
      });
    }

    // Validate the data
    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be 2 letters or more",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8 characters long",
      });
    }

    // Encrypt the password
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashPassword,
    };

    // Store user in database
    const newUser = new userModel(userData);
    await newUser.save();

    // Generate JWT token
    const token = createToken(newUser._id);

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required!" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password!" });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: "you have not set your password try google login!" });

    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password!" });
    }

    // Generate token
    const token = createToken(user._id);

    res.json({
      success: true,
      token,
      message: "Login successful!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required!" });
    }

    // Find the user with this email
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found!" });
    }

    // Generate OTP and save it
    // const generatedOtp = generateOTP();
    // const hashedOtp = await bcrypt.hash(generatedOtp, 10);
    // const otpRecord = await OTP.create({ user: user._id, otp: hashedOtp, createdAt: Date.now(), expiresAt: Date.now() + 300000 }); // 5 minutes validity

    // const mailOptions = {
    //   from: process.env.NODEMAILER_USER,
    //   to: email,
    //   subject: "QuickBites - Password Reset OTP",
    //   html: `
    //     <!DOCTYPE html>
    //     <html>
    //     <head>
    //         <title>QuickBites - OTP Verification</title>
    //         <style>
    //             body { font-family: Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 0; }
    //             .email-container { max-width: 500px; margin: 30px auto; background: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1); text-align: center; border-top: 5px solid #ff6600; }
    //             .header { background-color: #ff6600; color: #ffffff; padding: 15px; font-size: 22px; font-weight: bold; border-radius: 10px 10px 0 0; }
    //             .content { font-size: 16px; color: #333333; margin: 20px 0; }
    //             .otp-code { font-size: 24px; font-weight: bold; color: #ffffff; background: #ff6600; padding: 10px 20px; display: inline-block; border-radius: 5px; letter-spacing: 2px; margin: 10px 0; }
    //             .footer { font-size: 12px; color: #666666; margin-top: 20px; border-top: 1px solid #dddddd; padding-top: 10px; }
    //         </style>
    //     </head>
    //     <body>
    //         <div class="email-container">
    //             <div class="header">QuickBites - Online Dining Solutions</div>
    //             <div class="content">
    //                 <p>Hello,</p>
    //                 <p>Your OTP for password reset is:</p>
    //                 <div class="otp-code">${generatedOtp}</div>
    //                 <p>This OTP is valid for only 5 minutes. Do not share it with anyone.</p>
    //                 <p>If you did not request this, please ignore this email.</p>
    //             </div>
    //             <div class="footer">
    //                 &copy; 2025 QuickBites - Online Dining Solutions. All Rights Reserved.
    //             </div>
    //         </div>
    //     </body>
    //     </html>
    //   `,
    // };

    // await sendMail(mailOptions);

    res.status(200).json({ success: true, message: "You have been verfied to reset your password!" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ success: false, message: "Something went wrong! Please try again later." });
  }
};

const resetPassword = async (req, res) => {
  const { email, newPassword, cPassword } = req.body;

  console.log(email, newPassword, cPassword);

  try {
    if (!email || !newPassword || !cPassword) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    if (newPassword !== cPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match!" });
    }

    // const otpRecord = await OTP.findById(otpId);

    // if (!otpRecord) {
    //   return res.status(401).json({ success: false, message: "Invalid or expired OTP!" });
    // }

    // Check if the OTP is expired
    // if (otpRecord.expiresAt < Date.now()) {
    //   await OTP.findByIdAndDelete(otpId);
    //   return res.status(401).json({ success: false, message: "OTP has expired!" });
    // }

    // const isMatch = await bcrypt.compare(verificationCode, otpRecord.otp);
    // if (!isMatch) {
    //   return res.status(401).json({ success: false, message: "Invalid OTP!" });
    // }

    const user = await userModel.findOne({ email });
    // console.log(user);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    if (!user?.password) {
      return res.status(404).json({ success: false, message: "please set your password first to reset it!" });
    }

    const isExistPassword = await bcrypt.compare(newPassword, user?.password);
    if (isExistPassword) {
      return res.status(400).json({ success: false, message: "New password should not be the same as the old password!" });
    }

    const hashedPwd = await bcrypt.hash(newPassword, 10);
    await userModel.findByIdAndUpdate(user._id, { password: hashedPwd });

    // await OTP.findByIdAndDelete(otpRecord._id);

    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ success: false, message: "Something went wrong! Please try again later." });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { code } = req.query;

    const googleRes = await oauth2client.getToken(code);
    oauth2client.setCredentials(googleRes.tokens);

    let userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
    );

    const { email, name } = userRes.data;

    let user = await userModel.findOne({ email });

    if (!user) {
      user = await userModel.create({ email, name });
    }

    const token = createToken(user._id);

    res.json({ success: true, token, message: "Login successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // Get userId from the auth middleware
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const userData = await userModel.findById(userId).select("-password");
    if (!userData) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    res.json({ success: true, userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, gender, dob } = req.body;
    const image = req.file;
    const userId = req.userId; // Get userId from the auth middleware

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    const updateData = { name, phone, address, gender, dob };

    if (image) {
      // Upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(image.path, {
        resource_type: "image",
      });
      updateData.image = imageUpload.secure_url;
    }

    await userModel.findByIdAndUpdate(userId, updateData);
    res.json({ success: true, message: "Profile Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}).select("-password");
    res.json({ success: true, users, message: "Users Fetched" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.body;
    await userModel.findByIdAndDelete(userId);
    res.json({ success: true, message: "User Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export {
  register,
  login,
  forgetPassword,
  resetPassword,
  googleLogin,
  getProfile,
  updateProfile,
  getAllUsers,
  deleteUser,
};
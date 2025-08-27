import orderModel from "../models/orderModel.js";
import restaurantModel from "../models/restaurantModel.js";
import userModel from "../models/userMOdel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/adminModel.js";
import oauth2client  from "../config/google.js";
import axios from "axios";
import sellerModel from "../models/sellerModel.js";
import { PromotionModel } from "../models/promotion.js";
import connectCloudinary from "../config/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import deliveryAgentModel from "../models/deliveryAgentModel.js";
import { Feedback } from "../models/feedbackModel.js";

const getDashData = async (req, res) => {
  try {
    const orderData = await orderModel.find({});

    const filterData = orderData.filter((order, _) => order.payment);
    const getAmount = filterData.map((order) => order.amount);
    let revenue = 0;
    getAmount.forEach((amount) => (revenue += amount));

    const users = await userModel.find({});

    const pendingOrders = orderData.filter(
      (order, _) => order.status !== "Delivered"
    );
    const deliveredOrders = orderData.filter(
      (order, _) => order.status === "Delivered"
    );

    const resto = await restaurantModel.find({});

    const dashData = {
      totalOrders: orderData.length,
      revenue,
      totalUsers: users.length,
      pendingOrders: pendingOrders.length,
      deliveredOrders: deliveredOrders.length,
      totalResto: resto.length,
    };

    res.json({ success: true, dashData, message: "Data Fetched" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

const getMonthlyRevenue = async (req, res) => {
  try {
    const revenuePerMonth = await orderModel.aggregate([
      {
        $match: {
          isCancelled: false,
          payment: true
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$date" }
          },
          totalRevenue: { $sum: "$amount" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(revenuePerMonth);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

const getDailyOrders = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // includes today

    const ordersPerDay = await orderModel.aggregate([
      {
        $match: {
          isCancelled: false,
          date: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" }
          },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(ordersPerDay);
  } catch (err) {
    res.status(500).json({ error: 'Server Error for daily-orders' });
  }
};


const approvResto = async (req, res) => {
  try {
    const { restoId } = req.body;

    await restaurantModel.findByIdAndUpdate(restoId, {
      isrequested: false,
      isOpen: true,
    });

    res.json({ success: true, message: "Accepted" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

const rejectResto = async (req, res) => {
  try {
    const { restoId, rejectionReason } = req.body;

    console.log(restoId, rejectionReason);

    await restaurantModel.findByIdAndUpdate(restoId, {
      isrejected: true,
      isOpen: false,
      rejectionmsg: rejectionReason,
    });

    res.json({ success: true, message: "Rejected" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

// register a admin

const registerAdmin = async (req, res) => {
  const { userName, email, password, gender, address, profilePhoto, DOB } =
    req.body;

  if (!userName || !email || !password || !DOB) {
    return res.status(400).json({ message: "Missing required fields!" });
  }

  let profilephoto = null;

  if (req.file) {
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "admin_folder",
      });
      profilephoto = result.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      return res.status(500).json({ message: "Profile photo upload failed!" });
    }
  }

  try {
    // Check if email exists in any of the models
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

    // Check if username is already taken
    const existingUser = await Admin.findOne({ userName });
    if (existingUser) {
      return res.status(409).json({ message: "Username already in use!" });
    }

    const [day, month, year] = DOB.split("/");
    const parsedDOB = new Date(`${year}-${month}-${day}`);
    if (isNaN(parsedDOB.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid DOB format! Use DD/MM/YYYY." });
    }

    // Create new Admin
    const newAdmin = await Admin.create({
      userName,
      email,
      password,
      DOB: parsedDOB,
      address,
      gender,
      profilePhoto: profilephoto,
    });

    res
      .status(201)
      .json({ message: "Admin Registered Successfully!", newAdmin });
  } catch (error) {
    console.error("Failed at registration!", error);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// get the admin-profile
const getAdminProfile = async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId) {
      return res
        .status(400)
        .json({ message: "adminId is required in query params." });
    }

    const admin = await Admin.findById(adminId).select("-password"); // exclude password

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.status(200).json({ admin });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res
      .status(500)
      .json({ message: "Server error. Could not fetch admin profile." });
  }
};

// update the admin
const updateAdmin = async (req, res) => {
  const { userName, email, password, gender, address, DOB } = req.body;
  const adminId = req.params.adminId;

  try {
    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Handle optional profile photo
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "admin_folder",
        });
        admin.profilePhoto = result.secure_url;
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        return res
          .status(500)
          .json({ message: "Profile photo upload failed!" });
      }
    }

    // Update only provided fields
    if (userName) admin.userName = userName;
    if (email) admin.email = email;
    if (password) admin.password = password;
    if (gender) admin.gender = gender;
    if (address) admin.address = address;

    if (DOB) {
      const [day, month, year] = DOB.split("/");
      const parsedDOB = new Date(`${year}-${month}-${day}`);
      if (isNaN(parsedDOB.getTime())) {
        return res
          .status(400)
          .json({ message: "Invalid DOB format! Use DD/MM/YYYY." });
      }
      admin.DOB = parsedDOB;
    }

    await admin.save();
    res.status(200).json({ message: "Admin updated successfully", admin });
  } catch (error) {
    console.error("Admin update failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Google OAuth Login for Admin
const googleLogin = async (req, res) => {
  const { credential } = req.body;

  try {
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required!"
      });
    }

    // Verify the Google token
    const ticket = await oauth2client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if admin exists with this email
    let admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "No admin account found with this Google email!"
      });
    }

    // Update admin with Google ID if not already set
    if (!admin.googleId) {
      admin.googleId = googleId;
      await admin.save();
    }

    // Generate JWT token
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        userName: admin.userName,
        email: admin.email
      },
      message: "Google login successful!"
    });

  } catch (error) {
    console.error("Error in Google login:", error);
    res.status(500).json({
      success: false,
      message: "Google authentication failed!"
    });
  }
};

// Admin Login
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required!" 
      });
    }

    const normalizeEmail = email.toLowerCase();
    const admin = await Admin.findOne({ email: normalizeEmail });

    if (!admin) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password!" 
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password!" 
      });
    }

    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        userName: admin.userName,
        email: admin.email
      },
      message: "Login successful!"
    });

  } catch (error) {
    console.error("Error in loginAdmin:", error);
    res.status(500).json({ 
      success: false,
      message: "Something went wrong! Please try again later." 
    });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required!" 
      });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: "No admin found with this email address!" 
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email address.",
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    return res
      .status(500)
      .json({ 
        success: false,
        message: "Something went wrong! Please try again later." 
      });
  }
};

// Verify Google credential for password reset
const verifyGoogleReset = async (req, res) => {
  const { credential, email } = req.body;

  try {
    if (!credential || !email) {
      return res.status(400).json({
        success: false,
        message: "Google credential and email are required!"
      });
    }

    // Verify the Google token
    const ticket = await oauth2client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleEmail = payload.email;

    // Check if the Google email matches the admin email
    if (googleEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Google account email does not match the admin email!"
      });
    }

    // Check if admin exists with this email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found with this email!"
      });
    }

    res.status(200).json({
      success: true,
      message: "Google verification successful! You can now reset your password."
    });

  } catch (error) {
    console.error("Error in Google verification:", error);
    res.status(500).json({
      success: false,
      message: "Google verification failed!"
    });
  }
};

// Reset password after Google verification
const resetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  try {
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required!" 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Passwords do not match!" 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long!"
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: "Admin not found!" 
      });
    }

    // Check if new password is same as old password
    if (admin.password) {
      const isSamePassword = await bcrypt.compare(newPassword, admin.password);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: "New password cannot be the same as your current password!"
        });
      }
    }

    // Hash and update the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await Admin.findByIdAndUpdate(admin._id, { password: hashedPassword });

    res.status(200).json({ 
      success: true, 
      message: "Password reset successful!" 
    });

  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.status(500).json({ 
      success: false,
      message: "Something went wrong! Please try again later." 
    });
  }
};


// verify OTP & Login

const verifyOTPAndLogin = async (req, res) => {
  const { otpId, verificationCode } = req.body;

  try {
    if (!otpId || !verificationCode) {
      return res
        .status(400)
        .json({ message: "OTP ID and verification code are required!" });
    }

    const otpRecord = await OTP.findOne({ _id: otpId });

    if (!otpRecord) {
      console.error(`OTP record not found for ID: ${otpId}`);
      return res.status(401).json({ message: "Invalid OTP!" });
    }

    console.log("Found OTP record:", otpRecord);

    const isMatch = await bcrypt.compare(verificationCode, otpRecord.otp);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid OTP!" });
    }

    const token = jwt.sign(
      { adminId: otpRecord.admin },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.setHeader("Authorization", `Bearer ${token}`);
    // await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: "Login Successful", token });
  } catch (error) {
    console.error("Error in verifying the OTP:", error);
    res.status(500).json({ message: "Failed to verify the OTP & Login!" });
  }
};

const logoutAdmin = async (req, res) => {
  try {
    // console.log("Received Headers:", req.headers); // Debugging

    const authHeader =
      req.headers["authorization"] || req.headers["Authorization"];
    // console.log("Auth Header:", authHeader); // Check if it's received

    // Directly use authHeader if there's no "Bearer" prefix
    const tokenFromHeader = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    // console.log("Token from headers:", tokenFromHeader); // Final check

    if (!tokenFromHeader) {
      return res
        .status(401)
        .json({ message: "Unauthorized! Token is missing." });
    }

    const decoded = jwt.verify(tokenFromHeader, process.env.JWT_SECRET);
    const adminId = decoded.adminId;

    // Remove OTP related to the adminId
    // await OTP.deleteOne({ admin: adminId });

    // res.clearCookie("token", {
    //   httpOnly: false,
    //   secure: false,
    //   sameSite: "Lax",
    //   path: "/",
    // });

    // res.setHeader("Authorization", "");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Failed to log out" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orderData = await orderModel.find();
    res.json({ success: true, orderData });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

const getAllPromtions = async (req, res) => {
  const { adminId } = req.params;

  try {
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required to fetch the promotions!",
      });
    }

    const promotions = await PromotionModel.find({ });
    if (!promotions) {
      return res
        .status(404)
        .json({ success: false, message: "promotions not found!" });
    }

    return res.status(200).json({
      success: true,
      message: "promotions fetched successfully!",
      promotions,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: true, message: "failed to fetch the promotions" });
  }
};

const addPromotion = async (req, res) => {
  const { promotionName, discount, offerCode, adminId } = req.body;
  const _id = adminId;
  try {
    if (!promotionName || !discount || !offerCode || !adminId) {
      return res
        .status(400)
        .json({ success: false, message: "missing fields!" });
    }

    const admin = await Admin.findById(_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "TO add the promtion admin is required!",
      });
    }

    const isExist = await PromotionModel.findOne({ offerCode });
    if (isExist) {
      return res
        .status(409)
        .json({ success: false, message: "promotion already exist" });
    }

    let promotionurl;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "promotionbanner is required!" });
    }

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file?.path, {
        folder: "promotions",
      });

      if (result) {
        promotionurl = result.secure_url;
      }
    }

    const promotion = await PromotionModel.create({
      promotionName,
      promotionBanner: promotionurl,
      discount,
      offerCode,
      adminId,
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      message: "promotion added successfully",
      promotion,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "failed to add promotion!" });
  }
};

const deletPromotion = async (req, res) => {
  const { promtotionId } = req.body;

  const _id = promtotionId;

  try {
    const isexist = await PromotionModel.findById(_id);
    if (!isexist) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion Not Found For Deletion!" });
    }

    await PromotionModel.deleteOne({ _id });

    return res
      .status(200)
      .json({ success: true, message: "promotion deleted successfully!" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "failed to delete the promotion" });
  }
};

const updatePromotion = async (req, res) => {
  const { promotionId, promotionName, discount, offerCode, adminId, isActive } =
    req.body;
  const _id = promotionId;
  try {
    if (!promotionName || !discount || !offerCode) {
      return res
        .status(400)
        .json({ success: false, message: "missing fields!" });
    }

    const isexist = await PromotionModel.findById(_id);
    if (!isexist) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion Not Found For Updation!" });
    }

    let promotionurl;

    // if (!req.file) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "promotionbanner is required!" });
    // }

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file?.path, {
        folder: "promotions",
      });

      if (result) {
        promotionurl = result.secure_url;
      }
    }

    // updating the record

    const updatedPromtion = await PromotionModel.findByIdAndUpdate(
      { _id },
      {
        promotionName: promotionName,
        discount: discount,
        offerCode: offerCode,
        promotionBanner: promotionurl,
        isActive: isActive,
      }
    );

    return res.status(200).json({
      success: true,
      message: "promotion updated successfully",
      updatedPromtion,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "failed to update the promotion!" });
  }
};

const checkPromotion = async (req, res) => {
  const { offerCode } = req.body;
  try {
    const promotion = await PromotionModel.findOne({ offerCode });
    if (!promotion) {
      return res
        .status(404)
        .json({ success: false, message: "promotion not found to check" });
    }

    if (!promotion.isActive) {
      return res.status(403).json({
        success: false,
        message: "promotion is not 'Availabe/Active' to use",
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "promotion is valid to be applied!" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "failed to check the promotion" });
  }
};

const getUserOrderReport = async (req, res) => {
  try {
    const users = await userModel.find().select("name email phone");

    const orderCounts = await orderModel.aggregate([
      { $group: { _id: "$userId", orders: { $sum: 1 } } },
    ]);

    // Build orderCountMap safely
    const orderCountMap = {};
    orderCounts.forEach((count) => {
      if (count?._id) {
        orderCountMap[count._id.toString()] = count.orders || 0;
      }
    });

    // Build report safely
    const report = users.map((user, index) => {
      const userIdStr = user?._id ? user._id.toString() : null;

      return {
        id: index + 1,
        name: user?.name || "N/A",
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        orders: userIdStr && orderCountMap[userIdStr] ? orderCountMap[userIdStr] : 0,
      };
    });

    res.status(200).json({
      success: true,
      userReport: report,
      message: "User order report generated successfully",
    });
  } catch (error) {
    console.error("getUserOrderReport error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};


const getOrderStatusReport = async (req, res) => {
  try {
    // Step 1: Fetch all orders with relevant fields
    const orders = await orderModel.find().select("_id date status");

    // Step 2: Aggregate order counts by status
    const statusCounts = await orderModel.aggregate([
      {
        $group: {
          _id: "$status", // Group by status
          count: { $sum: 1 }, // Count orders per status
        },
      },
    ]);

    // Step 3: Convert statusCounts to a map for easier lookup
    const statusCountMap = {};
    statusCounts.forEach((status) => {
      statusCountMap[status._id] = status.count;
    });

    // Step 4: Format the detailed report
    const detailedReport = orders.map((order) => ({
      orderId: order._id.toString(), // Convert ObjectId to string
      date: order.date.toISOString().split("T")[0], // Format as YYYY-MM-DD
      status: order.status,
    }));

    // Step 5: Add total counts for each status
    const summary = {
      Delivered:
        statusCountMap["Delivered"] || statusCountMap["delivered"] || 0,
      Pending: statusCountMap["Pending"] || statusCountMap["pending"] || 0,
      Accepted: statusCountMap["Accepted"] || statusCountMap["accepted"] || 0,
      Placed: statusCountMap["Placed"] || statusCountMap["placed"] || 0,
    };

    // Step 6: Combine detailed report and summary
    const report = {
      statusSummary: summary,
      orders: detailedReport,
    };

    // Step 7: Send the response
    res.status(200).json({
      success: true,
      data: report,
      message: "Order status report generated successfully",
    });
  } catch (error) {
    console.error("Error generating order status report:", error);
    res.status(500).json({
      success: false,
      message: "Server error while generating report",
      error: error.message,
    });
  }
};

const getRestaurantReport = async (req, res) => {
  try {
    // Aggregate all order data for all restaurants (grouped by sellerId)
    const RestaurantReports = await orderModel.aggregate([
      {
        $match: {
          // isCancelled: false,  // Exclude cancelled orders
          // isCompleted: true    // Include only completed orders
        },
      },
      {
        $group: {
          _id: "$sellerId", // Group by sellerId (restaurant)
          ordersReceived: { $sum: 1 }, // Count orders for each sellerId
          totalAmount: { $sum: "$amount" }, // Sum the total amount for each sellerId
        },
      },
    ]);

    // Fetch all restaurant details from the restaurantModel where sellerId matches
    const restaurants = await restaurantModel
      .find()
      .select("name ownername phone sellerId _id");

    // Create a map to store order data by sellerId
    const countOrdersReceived = {};
    RestaurantReports.forEach((order) => {
      countOrdersReceived[order._id] = {
        ordersReceived: order.ordersReceived,
        totalAmount: order.totalAmount,
      };
    });

    // Generate the detailed report by matching orders data with restaurants
    const detailedReport = restaurants.map((restaurant) => {
      // Ensure matching sellerId between orders and restaurants
      const orderData = countOrdersReceived[restaurant.sellerId] || {
        ordersReceived: 0,
        totalAmount: 0,
      };

      return {
        restaurantName: restaurant.name,
        ownerName: restaurant.ownername,
        phone: restaurant.phone,
        ordersReceived: orderData.ordersReceived,
        totalAmount: orderData.totalAmount,
      };
    });

    // Final report structure
    const report = {
      detailedReport,
    };

    // Send the response with the report
    res.status(200).json({
      success: true,
      message: "Report generated successfully",
      report,
    });
  } catch (error) {
    // Handle errors and send response
    res.status(500).json({
      success: false,
      message: "Failed to generate the RestaurantReports!",
      error: error.message,
    });
  }
};

const getDeliveryBoyReport = async (req, res) => {
  try {
    const agent = await deliveryAgentModel
      .find()
      .select("firstName lastName restoname contactNo totalDeliveries");

    const deliveryBoyReport = agent.map((agent) => {
      return {
        firstname: agent.firstName,
        lastname: agent.lastName,
        RestorauntName: agent.restoname,
        contactNumber: agent.contactNo,
        ordersDelivered: agent.totalDeliveries,
      };
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "deliveryAgent Report Generated successully!",
        deliveryBoyReport,
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "failed to generate the report for the deliveryBoy!",
    });
  }
};

const sendContactMessage = async (req, res) => {
  try {
    const { name, email, feedbackMsg } = req.body;

    // Basic validation
    if (!name || !email || !feedbackMsg) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const newFeedback = await Feedback.create({
      name,
      email,
      feedbackMessage: feedbackMsg,
    });

    const user = await userModel.findOne({ email });
    if (user) {
      newFeedback.isRegisteredUser = true;
      await newFeedback.save();
    }

    res.status(201).json({ success: true, message: "Feedback sent", data: newFeedback });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getAllContactMessages = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }); // Newest first
    res.status(200).json({ success: true, data: feedbacks });
  } catch (err) {
    console.error("Error fetching feedbacks:", err);
    res.status(500).json({ success: false, message: "Failed to fetch feedbacks" });
  }
};



export {
  getDashData,
  getAllOrders,
  forgotPassword,
  approvResto,
  rejectResto,
  registerAdmin,
  loginAdmin,
  verifyOTPAndLogin,
  logoutAdmin,
  updateAdmin,
  getAdminProfile,
  getAllPromtions,
  addPromotion,
  updatePromotion,
  deletPromotion,
  checkPromotion,
  getUserOrderReport,
  getRestaurantReport,
  getOrderStatusReport,
  getDeliveryBoyReport,
  sendContactMessage,
  getAllContactMessages,
  getDailyOrders,
  getMonthlyRevenue,
  googleLogin,
  verifyGoogleReset,
  resetPassword
};

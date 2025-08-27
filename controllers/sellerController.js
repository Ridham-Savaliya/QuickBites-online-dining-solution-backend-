import sellerModel from "../models/sellerModel.js";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendMail } from "../utills/sendEmail.js";
import { Admin } from "../models/adminModel.js";
import userModel from "../models/userMOdel.js";
import orderModel from "../models/orderModel.js";
import oauth2client from "../config/google.js";
import axios from "axios";

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Minimal diagnostics to ensure backend is using the expected OAuth credentials
    const clientIdForLog = (process.env.GOOGLE_CLIENT_ID || '').slice(0, 12);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'postmessage';
    console.log(`[googleLogin] Using GOOGLE_CLIENT_ID(prefix)=${clientIdForLog} redirectUri=${redirectUri}`);
    // check user available or not
    const seller = await sellerModel.findOne({ email });

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

    if (seller) {
      return res.json({
        success: false,
        message: "Seller already registered!. Please Login",
      });
    }

    // validate the data
    if (name.length < 2) {
      return res.json({
        success: false,
        message: "name must be 2 letter or more",
      });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "email must be in formate" });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Password must be 8 character long",
      });
    }

    // encrypt the password
    const salt = await bcrypt.genSalt(10);

    const hashPassword = await bcrypt.hash(password, salt);

    const sellerData = {
      name,
      email,
      password: hashPassword,
    };

    // store user in database
    const newSeller = new sellerModel(sellerData);

    await newSeller.save();

    // create token
    const token = jwt.sign({ id: newSeller._id }, process.env.JWT_SECRET);

    res.json({ success: true, token, message: "Register successfull" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the seller by email
    const sellerDoc = await sellerModel.findOne({ email });

    if (!sellerDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Seller not found!" });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, sellerDoc.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: sellerDoc._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong at login" });
  }
};

const googleLogin = async (req, res) => {
  const { code } = req.body;

  try {
    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Google auth code is required!" });
    }

    // Get tokens from Google (explicitly pass redirect_uri and client credentials)
    const { tokens } = await oauth2client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
    });
    oauth2client.setCredentials(tokens);

    // Get user profile
    const { data } = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    // Check if seller exists
    let seller = await sellerModel.findOne({ email: data.email });

    if (!seller) {
      // Auto-register seller if not found
      seller = new sellerModel({
        name: data.name,
        email: data.email,
        password: "", // not required for Google login
      });
      await seller.save();
    }

    // Generate token
    const token = jwt.sign({ id: seller._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
    });
  } catch (error) {
    console.error("Error in googleLogin:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Something went wrong with Google login",
      });
  }
};

// Reset password using Google verification
const resetPasswordWithGoogle = async (req, res) => {
  const { code, newPassword, cPassword } = req.body;

  try {
    if (!code || !newPassword || !cPassword) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    if (newPassword !== cPassword) {
      return res.status(400).json({ message: "Passwords do not match!" });
    }

    // Exchange Google code for tokens
    const { tokens } = await oauth2client.getToken(code);
    oauth2client.setCredentials(tokens);

    // Get user info
    const { data } = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    // Find seller by Google email
    const seller = await sellerModel.findOne({ email: data.email });
    if (!seller) {
      return res
        .status(404)
        .json({ message: "No account found with this Google email" });
    }

    // sdvd

    // Ensure password isn’t the same as old one
    const isSamePassword = await bcrypt.compare(newPassword, seller.password);
    if (isSamePassword) {
      return res
        .status(400)
        .json({ message: "New password cannot be same as old password!" });
    }

    // Hash and update
    const hashedPwd = await bcrypt.hash(newPassword, 10);
    await sellerModel.findByIdAndUpdate(seller._id, { password: hashedPwd });

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully!" });
  } catch (error) {
    console.error("Error in resetPasswordWithGoogle:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong, try again later" });
  }
};

const getAllResponses = async (req, res) => {
  const { sellerId } = req.body;

  try {
    const data = await orderModel.find({ sellerId });
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Responses Not Found!" });
    }

    const ResponseData = data.map((order) => ({
      orderId: order._id,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      })),
      feedback: order.feedback,
      response: order.response,
    }));

    return res.status(200).json({
      success: true,
      message: "responses fetched successfully!",
      ResponseData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "failed to fetch the responses!" });
  }
};

export {
  register,
  login,
  resetPasswordWithGoogle,
  googleLogin,
  getAllResponses,
};

import express from "express"
import {
  registerAdmin,
  loginAdmin,
  forgotPassword,
  verifyOTPAndLogin,
  logoutAdmin,
  updateAdmin,
  getAdminProfile,
  googleLogin,
  verifyGoogleReset,
  resetPassword,
  getAllOrders,
  addPromotion,
  updatePromotion,
  deletPromotion,
  checkPromotion,
  getAllPromtions,
  getUserOrderReport,
  getOrderStatusReport,
  getRestaurantReport,
  getDeliveryBoyReport,
  sendContactMessage,
  getAllContactMessages,
} from "../controllers/adminController.js"
import upload from "../middlewares/multer.js"

const AdminAuthRouter = express.Router();

// Admin Authentication Routes
AdminAuthRouter.post("/register",upload.single("profilePhoto"), registerAdmin);
AdminAuthRouter.post("/login", loginAdmin);
AdminAuthRouter.put("/updateadmin-profile/:adminId",upload.single('profilePhoto'), updateAdmin);
AdminAuthRouter.get('/getadmin-profile',  getAdminProfile);
AdminAuthRouter.get('/getallpromotions/:adminId',  getAllPromtions);
AdminAuthRouter.get('/generateUserReportsby-admin',  getUserOrderReport);
AdminAuthRouter.get('/getDeliveryBoyReportsby-admin',  getDeliveryBoyReport);
AdminAuthRouter.get('/generateRestaurantReportBy-admin',  getRestaurantReport);
AdminAuthRouter.get('/generateOrderStatusReportsby-admin',  getOrderStatusReport);
AdminAuthRouter.post('/addpromotion',upload.single('promotionBanner'),  addPromotion);
AdminAuthRouter.put('/updatepromotion',upload.single('promotionBanner'),  updatePromotion);
AdminAuthRouter.delete('/deletpromotion',  deletPromotion);
AdminAuthRouter.post('/receiveFeedback',  sendContactMessage);
AdminAuthRouter.get('/getAllContactMessages',  getAllContactMessages);
AdminAuthRouter.post('/checkpromotion',  checkPromotion);
AdminAuthRouter.post("/forgot-password", forgotPassword);
AdminAuthRouter.post("/google", googleLogin);
AdminAuthRouter.post("/verify-google-reset", verifyGoogleReset);
AdminAuthRouter.post("/reset-password", resetPassword);

AdminAuthRouter.post("/logout", logoutAdmin);
AdminAuthRouter.get('/getall-orders', getAllOrders);


export{ AdminAuthRouter};

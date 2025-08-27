import express from "express";
import {
  register,
  login,
  resetPasswordWithGoogle,
  getAllResponses,
  googleLogin,
} from "../controllers/sellerController.js";

const sellerRouter = express.Router();

sellerRouter.post("/register", register);
sellerRouter.post("/login", login);
sellerRouter.post("/google-login", googleLogin);
sellerRouter.post("/forget-password", resetPasswordWithGoogle);
sellerRouter.post("/getallresponses", getAllResponses);

export default sellerRouter;
